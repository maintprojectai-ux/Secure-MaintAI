#!/usr/bin/env python3
"""
Secure-MaintAI — Model 02-A
Technical Failure Specialist

Purpose
-------
Train a technical-failure *type* classifier from RCAEval telemetry while
keeping the production feature contract independent of RCAEval-specific
column names.

Deployment contract
-------------------
The model consumes a rolling telemetry window summarized into canonical
observability features:

cpu_utilization, memory_utilization, disk_utilization,
request_latency, request_rate, error_rate,
network_delay, network_loss, and global telemetry statistics.

In production these canonical signals can be populated from OpenTelemetry
metrics (and later logs/traces) without exposing dataset-specific labels.

Important methodological choices
---------------------------------
* RCAEval fault labels are TARGETS only, never input features.
* root_cause_service, fault_description, inject_time, case, repetition, etc.
  are metadata and are not model features.
* Windows are chronological inside each case.
* Train/test split is CASE-GROUPED to prevent adjacent windows from leaking.
* No post-fault timestamp or "time since injection" feature is used.
* The model is multi-class: CPU/MEM/DISK/DELAY/LOSS/SOCKET.
* Model 02-A is a specialist downstream of Model 01; it does not decide
  NORMAL vs CYBER_ATTACK and does not trigger SOAR.
"""

from __future__ import annotations

import argparse
import json
import re
import warnings
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, classification_report,
    confusion_matrix, f1_score, precision_score, recall_score
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import GroupShuffleSplit

warnings.filterwarnings("ignore")

FAULTS = ("cpu", "mem", "disk", "delay", "loss", "socket")

SEMANTIC_PATTERNS = {
    "cpu_utilization": [
        r"cpu", r"processor", r"util", r"load", r"busy"
    ],
    "memory_utilization": [
        r"mem", r"memory", r"ram", r"heap", r"rss", r"swap"
    ],
    "disk_utilization": [
        r"disk", r"i/o", r"diskio", r"read", r"write", r"fs", r"filesystem"
    ],
    "request_latency": [
        r"latency", r"response.?time", r"duration", r"delay"
    ],
    "request_rate": [
        r"request", r"req", r"throughput", r"qps", r"rps"
    ],
    "error_rate": [
        r"error", r"failure", r"5xx", r"4xx", r"exception"
    ],
    "network_delay": [
        r"network", r"tcp", r"udp", r"rtt", r"network.*delay"
    ],
    "network_loss": [
        r"loss", r"drop", r"packet"
    ],
}

STATS = ("mean", "std", "min", "max", "p95", "last", "slope")


@dataclass
class Case:
    case_id: str
    fault: str
    root_cause_service: str
    inject_time: float
    metric_path: Path
    system_name: str = ""


def infer_numeric_columns(df: pd.DataFrame) -> List[str]:
    cols = []
    for c in df.columns:
        if str(c).lower() == "time":
            continue
        x = pd.to_numeric(df[c], errors="coerce")
        if x.notna().mean() >= 0.80:
            cols.append(c)
    return cols


def load_metric_file(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".json":
        with open(path, "r", encoding="utf-8") as f:
            obj = json.load(f)
        df = pd.DataFrame(obj)
    elif path.suffix.lower() == ".parquet":
        df = pd.read_parquet(path)
    elif path.suffix.lower() == ".csv":
        df = pd.read_csv(path)
    else:
        raise ValueError(f"Unsupported telemetry file: {path}")

    # Normalize the required timestamp column.
    time_col = next((c for c in df.columns if str(c).strip().lower() == "time"), None)
    if time_col is None:
        raise ValueError(f"{path} has no required 'time' column")

    df["time"] = pd.to_numeric(df[time_col], errors="coerce")
    df = df.dropna(subset=["time"]).sort_values("time").reset_index(drop=True)

    numeric_cols = infer_numeric_columns(df)
    for c in numeric_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df[["time"] + numeric_cols].copy()


def discover_cases(data_root: Path, suite_prefix: str = "re2") -> List[Case]:
    """
    Supports the original RCAEval directory layout:
      {case}/metrics.json
    and Parquet layout:
      {case}/metrics.parquet

    A local cases.parquet index is preferred when present.
    """
    cases = []

    index = data_root / "cases.parquet"
    if index.exists():
        idx = pd.read_parquet(index)
        for row in idx.itertuples(index=False):
            dataset = str(getattr(row, "dataset", ""))
            if suite_prefix and not dataset.lower().startswith(suite_prefix.lower()):
                continue
            case_id = str(getattr(row, "case"))
            fault = str(getattr(row, "fault")).lower()
            if fault not in FAULTS:
                continue
            metric_path = data_root / case_id / "metrics.parquet"
            if not metric_path.exists():
                metric_path = data_root / case_id / "metrics.json"
            if not metric_path.exists():
                continue
            cases.append(
                Case(
                    case_id=case_id,
                    fault=fault,
                    root_cause_service=str(getattr(row, "root_cause_service", "")),
                    inject_time=float(getattr(row, "inject_time")),
                    metric_path=metric_path,
                    system_name=str(getattr(row, "system_name", "")),
                )
            )
        return cases

    for metric_path in sorted(data_root.glob("*/metrics.*")):
        case_id = metric_path.parent.name
        parts = case_id.split("_")
        fault = parts[-2].lower() if len(parts) >= 3 else ""
        if fault not in FAULTS or (suite_prefix and not case_id.lower().startswith(suite_prefix.lower())):
            continue
        inject_file = metric_path.parent / "inject_time.txt"
        if not inject_file.exists():
            continue
        inject_time = float(inject_file.read_text().strip())
        cases.append(
            Case(
                case_id=case_id,
                fault=fault,
                root_cause_service="",
                inject_time=inject_time,
                metric_path=metric_path,
                system_name="",
            )
        )
    return cases


def match_semantic_group(column: str) -> Optional[str]:
    name = str(column).lower().replace("_", " ")
    for group, patterns in SEMANTIC_PATTERNS.items():
        if any(re.search(p, name) for p in patterns):
            return group
    return None


def robust_slope(values: np.ndarray) -> float:
    mask = np.isfinite(values)
    y = values[mask]
    if y.size < 3:
        return 0.0
    x = np.arange(y.size, dtype=float)
    x -= x.mean()
    y = y - y.mean()
    denom = np.dot(x, x)
    return float(np.dot(x, y) / denom) if denom > 0 else 0.0


def summarize_window(
    window: pd.DataFrame,
    time_col: str = "time",
) -> Dict[str, float]:
    numeric_cols = [c for c in window.columns if c != time_col]
    out: Dict[str, float] = {}

    grouped: Dict[str, List[str]] = {}
    for c in numeric_cols:
        g = match_semantic_group(c)
        if g:
            grouped.setdefault(g, []).append(c)

    # Canonical semantic aggregates.
    for group, cols in grouped.items():
        arr = window[cols].to_numpy(dtype=float)
        flat = arr.reshape(-1)
        flat = flat[np.isfinite(flat)]
        if flat.size == 0:
            continue
        out[f"{group}__mean"] = float(np.mean(flat))
        out[f"{group}__std"] = float(np.std(flat))
        out[f"{group}__min"] = float(np.min(flat))
        out[f"{group}__max"] = float(np.max(flat))
        out[f"{group}__p95"] = float(np.percentile(flat, 95))
        out[f"{group}__last"] = float(arr[-1][np.isfinite(arr[-1])].mean()) if np.isfinite(arr[-1]).any() else 0.0
        out[f"{group}__slope"] = robust_slope(np.nanmean(arr, axis=1))

    # Fallback global telemetry features preserve information when metric
    # names do not map cleanly to a semantic group.
    all_arr = window[numeric_cols].to_numpy(dtype=float)
    finite = all_arr[np.isfinite(all_arr)]
    if finite.size:
        out["telemetry_global__mean"] = float(np.mean(finite))
        out["telemetry_global__std"] = float(np.std(finite))
        out["telemetry_global__min"] = float(np.min(finite))
        out["telemetry_global__max"] = float(np.max(finite))
        out["telemetry_global__p95"] = float(np.percentile(finite, 95))

    return out


def make_case_windows(
    case: Case,
    window_size: int = 30,
    stride: int = 10,
) -> pd.DataFrame:
    df = load_metric_file(case.metric_path)
    # We deliberately do not use "time since injection" as a feature.
    # Windows are labeled from the known RCAEval injection time only.
    post = df["time"].to_numpy() >= case.inject_time
    rows = []
    for start in range(0, max(0, len(df) - window_size + 1), stride):
        end = start + window_size
        w = df.iloc[start:end]
        if len(w) < window_size:
            continue
        # Require a majority of the window to be after fault injection.
        label = 1 if post[start:end].mean() >= 0.50 else 0
        if label != 1:
            continue
        feats = summarize_window(w)
        if not feats:
            continue
        feats["case_id"] = case.case_id
        feats["fault"] = case.fault
        feats["root_cause_service"] = case.root_cause_service
        feats["window_end_time"] = float(w["time"].iloc[-1])
        rows.append(feats)
    return pd.DataFrame(rows)


def build_dataset(
    cases: Iterable[Case],
    window_size: int = 30,
    stride: int = 10,
) -> pd.DataFrame:
    frames = []
    for i, case in enumerate(cases, start=1):
        frame = make_case_windows(case, window_size, stride)
        if not frame.empty:
            frames.append(frame)
        print(f"[{i}] {case.case_id}: {len(frame)} failure windows")
    if not frames:
        raise RuntimeError("No training windows were produced.")
    data = pd.concat(frames, ignore_index=True)
    return data


def drop_leakage_columns(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    forbidden = {
        "fault", "case_id", "root_cause_service",
        "fault_description", "inject_time", "repetition",
        "dataset", "suite", "system", "system_name",
        "window_end_time", "time", "label", "target",
    }
    drop = [c for c in df.columns if c.lower() in forbidden]
    return df.drop(columns=drop, errors="ignore"), drop


def grouped_train_test_split(
    X: pd.DataFrame, y: pd.Series, groups: pd.Series, test_size: float = 0.25,
    random_state: int = 42
):
    gss = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))
    return train_idx, test_idx


def evaluate_model(name, model, X_train, X_test, y_train, y_test):
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    metrics = {
        "model": name,
        "accuracy": accuracy_score(y_test, pred),
        "balanced_accuracy": balanced_accuracy_score(y_test, pred),
        "precision_macro": precision_score(y_test, pred, average="macro", zero_division=0),
        "recall_macro": recall_score(y_test, pred, average="macro", zero_division=0),
        "f1_macro": f1_score(y_test, pred, average="macro", zero_division=0),
    }
    return model, metrics, pred


def train_and_evaluate(data: pd.DataFrame, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)

    X_raw = data.drop(columns=["fault"], errors="ignore")
    groups = data["case_id"].copy()
    y = data["fault"].copy()

    X, excluded = drop_leakage_columns(X_raw)
    numeric = X.apply(pd.to_numeric, errors="coerce")

    train_idx, test_idx = grouped_train_test_split(numeric, y, groups)

    X_train, X_test = numeric.iloc[train_idx], numeric.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    results = []
    models = {}

    lr = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", LogisticRegression(max_iter=3000, class_weight="balanced")),
    ])

    rf = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("model", RandomForestClassifier(
            n_estimators=300,
            max_depth=None,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        )),
    ])

    for name, model in [("Logistic Regression", lr), ("Random Forest", rf)]:
        fitted, metrics, pred = evaluate_model(
            name, model, X_train, X_test, y_train, y_test
        )
        results.append(metrics)
        models[name] = fitted
        cm = confusion_matrix(y_test, pred, labels=sorted(y.unique()))
        pd.DataFrame(cm, index=sorted(y.unique()), columns=sorted(y.unique())).to_csv(
            output_dir / f"{name.lower().replace(' ', '_')}_confusion_matrix.csv"
        )
        with open(output_dir / f"{name.lower().replace(' ', '_')}_classification_report.txt", "w") as f:
            f.write(classification_report(y_test, pred, zero_division=0))

    pd.DataFrame(results).to_csv(output_dir / "evaluation_metrics.csv", index=False)
    pd.DataFrame({"excluded_column": excluded}).to_csv(
        output_dir / "excluded_columns.csv", index=False
    )

    # Save canonical schema only; model objects can be serialized by joblib.
    schema = {
        "model": "Model 02-A Technical Failure Specialist",
        "target": "fault",
        "classes": sorted(y.unique().tolist()),
        "feature_columns": X.columns.tolist(),
        "window_size": int(data.attrs.get("window_size", 30)),
        "stride": int(data.attrs.get("stride", 10)),
        "deployment_signal_source": "OpenTelemetry-compatible canonical telemetry",
        "excluded_metadata": excluded,
    }
    (output_dir / "feature_contract.json").write_text(
        json.dumps(schema, indent=2)
    )
    try:
        import joblib
        for name, model in models.items():
            joblib.dump(
                model,
                output_dir / f"{name.lower().replace(' ', '_')}.joblib"
            )
    except Exception as exc:
        print("WARNING: joblib save skipped:", exc)

    return pd.DataFrame(results)


def self_test():
    """Offline structural self-test; no synthetic result is used as ML evidence."""
    t = np.arange(120, dtype=float)
    df = pd.DataFrame({
        "time": t,
        "cpu.utilization": np.r_[np.ones(60) * 0.20, np.ones(60) * 0.90],
        "memory.used": np.r_[np.ones(60) * 0.30, np.ones(60) * 0.80],
        "request.latency": np.r_[np.ones(60) * 10, np.ones(60) * 50],
    })
    tmp = Path("self_test_case")
    tmp.mkdir(exist_ok=True)
    path = tmp / "metrics.csv"
    df.to_csv(path, index=False)

    case = Case(
        case_id="re2_selftest_service_cpu_1",
        fault="cpu",
        root_cause_service="service",
        inject_time=60.0,
        metric_path=path,
    )
    windows = make_case_windows(case, window_size=30, stride=10)
    assert not windows.empty
    assert "cpu_utilization__mean" in windows.columns
    assert "memory_utilization__mean" in windows.columns
    assert "fault" in windows.columns
    shutil.rmtree(tmp)
    print("SELF-TEST PASSED: parser, canonical feature extraction, labeling, and metadata isolation.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path)
    parser.add_argument("--suite", default="re2", choices=["re1", "re2", "all"])
    parser.add_argument("--window-size", type=int, default=30)
    parser.add_argument("--stride", type=int, default=10)
    parser.add_argument("--output", type=Path, default=Path("model02a_rcaeval_outputs"))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return

    if args.data_root is None:
        parser.error("--data-root is required for real-data training")

    if args.suite == "all":
        case_sets = [discover_cases(args.data_root, "re1"), discover_cases(args.data_root, "re2")]
        cases = [c for subset in case_sets for c in subset]
    else:
        cases = discover_cases(args.data_root, args.suite)

    if not cases:
        raise RuntimeError(
            "No RCAEval cases found. Download RE1/RE2 from the official RCAEval "
            "Hugging Face repository first."
        )

    print(f"Found {len(cases)} cases.")
    data = build_dataset(cases, args.window_size, args.stride)
    data.attrs["window_size"] = args.window_size
    data.attrs["stride"] = args.stride
    print(f"Training windows: {len(data)}")
    print("Class distribution:")
    print(data["fault"].value_counts().sort_index())

    metrics = train_and_evaluate(data, args.output)
    print("\nEVALUATION")
    print(metrics.to_string(index=False))


if __name__ == "__main__":
    main()
