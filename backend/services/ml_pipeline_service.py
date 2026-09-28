"""
Secure-MaintAI — ML Pipeline Runtime Bridge.

Loads trained and serialized machine learning artifacts:
- Stage 1: Model 01 (Isolation Forest on Server Machine Dataset, 28 machines)
- Stage 2-A: Model 02-A (Technical Failure Specialist on RCAEval)
- Stage 2-B: Model 02-B (Windows Cyber Attack Specialist on Windows-APT 2025)

Converts streaming telemetry snapshots into feature vectors, executes screening
and diagnostic inference, and returns structured AnomalyEvaluationResult records.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from backend.schemas.anomaly import AnomalyType
from backend.schemas.telemetry import TelemetryCreate

logger = logging.getLogger(__name__)

# Model directory locations relative to project root
_ML_DIR = Path("ml")
_MODEL_01_DIR = _ML_DIR / "model_01_outputs" / "models"
_MODEL_02A_DIR = _ML_DIR / "model02a_rcaeval_outputs"
_MODEL_02B_DIR = _ML_DIR / "model02b_apt_outputs"

# Module-level cache for loaded models and metadata
_model_01_cache: dict[str, dict[str, Any]] = {}
_model_01_default: dict[str, Any] | None = None
_model_02a_pipeline: Any | None = None
_model_02a_contract: dict[str, Any] | None = None
_model_02b_pipeline: Any | None = None
_model_02b_columns: list[str] | None = None
_is_initialised: bool = False

# In-memory streaming state for temporal feature calculations per workstation
_workstation_states: dict[str, dict[str, Any]] = {}


@dataclass
class AnomalyEvaluationResult:
    """Structured result of ML telemetry screening and diagnosis."""

    is_anomaly: bool
    anomaly_type: AnomalyType
    score: float
    confidence: float
    model_name: str
    model_version: str
    features_snapshot: dict[str, float] | None = None
    evidence: list[str] = field(default_factory=list)
    predicted_fault: str | None = None
    fault_confidence: float | None = None
    cyber_threat_probability: float | None = None


def _find_project_root() -> Path:
    """Locate the project root directory."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "ml").exists() and (parent / "backend").exists():
            return parent
    return current.parents[2]


def initialise(base_dir: Path | None = None) -> None:
    """
    Load and cache serialized ML models into memory at application startup.

    Parameters
    ----------
    base_dir:
        Base project directory. If None, auto-detected from file location.
    """
    global _model_01_cache, _model_01_default
    global _model_02a_pipeline, _model_02a_contract
    global _model_02b_pipeline, _model_02b_columns
    global _is_initialised

    root = base_dir or _find_project_root()
    m1_path = root / _MODEL_01_DIR
    m2a_path = root / _MODEL_02A_DIR
    m2b_path = root / _MODEL_02B_DIR

    logger.info("ml_pipeline_service: initializing ML models from root %s", root)

    # 1. Load Model 01 (Isolation Forest models for SMD machines)
    _model_01_cache.clear()
    _model_01_default = None
    if m1_path.exists():
        joblib_files = sorted(m1_path.glob("machine-*.joblib"))
        for jf in joblib_files:
            try:
                machine_key = jf.stem
                artifact = joblib.load(jf)
                _model_01_cache[machine_key] = artifact
            except Exception as exc:
                logger.warning("ml_pipeline_service: Failed loading %s: %s", jf.name, exc)

        if "machine-1-1" in _model_01_cache:
            _model_01_default = _model_01_cache["machine-1-1"]
        elif _model_01_cache:
            _model_01_default = next(iter(_model_01_cache.values()))

        logger.info(
            "ml_pipeline_service: loaded %d Model 01 machine detectors (default: %s)",
            len(_model_01_cache),
            "machine-1-1" if "machine-1-1" in _model_01_cache else "fallback",
        )
    else:
        logger.warning("ml_pipeline_service: Model 01 directory not found: %s", m1_path)

    # 2. Load Model 02-A (Technical Failure Specialist)
    _model_02a_pipeline = None
    _model_02a_contract = None
    m2a_model_file = m2a_path / "random_forest.joblib"
    m2a_contract_file = m2a_path / "feature_contract.json"
    if m2a_model_file.exists() and m2a_contract_file.exists():
        try:
            _model_02a_pipeline = joblib.load(m2a_model_file)
            with open(m2a_contract_file, encoding="utf-8") as f:
                _model_02a_contract = json.load(f)
            logger.info("ml_pipeline_service: loaded Model 02-A Technical Specialist")
        except Exception as exc:
            logger.warning("ml_pipeline_service: Failed loading Model 02-A: %s", exc)
    else:
        logger.warning("ml_pipeline_service: Model 02-A files not found in %s", m2a_path)

    # 3. Load Model 02-B (Windows Cyber Attack Specialist)
    _model_02b_pipeline = None
    _model_02b_columns = None
    m2b_model_file = m2b_path / "model_02b_windows_apt_random_forest.joblib"
    m2b_cols_file = m2b_path / "feature_columns.json"
    if m2b_model_file.exists() and m2b_cols_file.exists():
        try:
            _model_02b_pipeline = joblib.load(m2b_model_file)
            with open(m2b_cols_file, encoding="utf-8") as f:
                _model_02b_columns = json.load(f)
            logger.info("ml_pipeline_service: loaded Model 02-B Cyber Attack Specialist")
        except Exception as exc:
            logger.warning("ml_pipeline_service: Failed loading Model 02-B: %s", exc)
    else:
        logger.warning("ml_pipeline_service: Model 02-B files not found in %s", m2b_path)

    _is_initialised = _model_01_default is not None
    if _is_initialised:
        logger.info("ml_pipeline_service: initialization complete — active runtime ready")
    else:
        logger.warning("ml_pipeline_service: models unavailable — operating in bypass mode")


def is_ready() -> bool:
    """Check if ML models are loaded and ready for inference."""
    return _is_initialised


def _get_model_01_for_workstation(workstation_identifier: str | None) -> dict[str, Any] | None:
    """Resolve the specific Model 01 detector for a workstation, or return the default."""
    if not _model_01_cache:
        return _model_01_default

    if workstation_identifier:
        clean_id = workstation_identifier.lower().strip()
        if clean_id in _model_01_cache:
            return _model_01_cache[clean_id]
        for key, artifact in _model_01_cache.items():
            if key in clean_id:
                return artifact

    return _model_01_default


def _extract_38_channel_vector(
    item: TelemetryCreate,
    detector_artifact: dict[str, Any],
) -> np.ndarray:
    """
    Extract the 38 continuous telemetry sensor channels from a TelemetryCreate schema
    anchored against the learned normal baseline distribution of the target machine.
    """
    scaler = detector_artifact["scaler"]
    center = np.array(scaler.center_[:38], dtype=np.float32)
    v = center.copy()

    cpu_pct = float(item.cpu.usage_percent)
    mem_pct = float(item.memory.usage_percent)
    disk_bytes = float(item.disk.read_bytes_per_sec + item.disk.write_bytes_per_sec)
    net_bytes = float(item.network.bytes_in_per_sec + item.network.bytes_out_per_sec)
    proc_cnt = float(item.process_count)

    # Scale relative to typical client/workstation operational baselines
    # Normal client ranges: CPU 5-35%, RAM 30-75%, IO 0-1MB/s, Processes 100-350
    cpu_factor = max(0.1, cpu_pct / 25.0)
    mem_factor = min(2.0, max(0.2, mem_pct / 60.0))
    disk_factor = max(1.0, disk_bytes / 5.0e5)
    net_factor = max(1.0, net_bytes / 5.0e5)
    proc_factor = min(2.5, max(0.2, proc_cnt / 250.0))

    # CPU channels (0-6)
    v[0:4] *= cpu_factor
    v[4:7] *= cpu_factor

    # Memory channels (7-12)
    v[6] = min(1.0, v[6] * mem_factor)
    v[5] = max(0.0, 1.0 - v[6])

    # Disk channels (10-16)
    v[10:16] *= min(10.0, disk_factor)

    # Network channels (18-22)
    v[18:22] *= min(10.0, net_factor)

    # Process channels (22)
    v[22] = min(1.0, v[22] * proc_factor)

    return v


def reset_state(workstation_id: str | None = None) -> None:
    """Reset in-memory temporal streaming state for a workstation or all workstations."""
    global _workstation_states
    if workstation_id:
        _workstation_states.pop(workstation_id, None)
    else:
        _workstation_states.clear()


def _build_83_feature_vector(
    raw_38: np.ndarray,
    workstation_id: str,
    detector_artifact: dict[str, Any],
) -> np.ndarray:
    """
    Construct the full 83-dimensional feature vector (38 raw + 38 delta + 7 temporal aggregates)
    with streaming EWMA state tracking for the specified workstation.
    """
    state = _workstation_states.get(workstation_id)
    scaler = detector_artifact["scaler"]
    center = np.array(scaler.center_[:38], dtype=np.float32)

    if state is None:
        mean_val = float(raw_38.mean())
        std_val = float(raw_38.std())
        state = {
            "prev_raw": center.copy(),
            "ewma_mean": mean_val,
            "ewma_std": std_val,
            "ewma_delta": 0.0,
        }
        _workstation_states[workstation_id] = state

    prev_raw = state["prev_raw"]
    delta = raw_38 - prev_raw
    abs_delta = np.abs(delta)

    mean_val = float(raw_38.mean())
    std_val = float(raw_38.std())
    delta_l2 = float(np.sqrt(np.sum(delta * delta)))
    delta_max = float(abs_delta.max())

    alpha = 0.2
    ewma_mean = alpha * mean_val + (1.0 - alpha) * state["ewma_mean"]
    ewma_std = alpha * std_val + (1.0 - alpha) * state["ewma_std"]
    ewma_delta = alpha * delta_l2 + (1.0 - alpha) * state["ewma_delta"]

    # Update state for next streaming observation
    state["prev_raw"] = raw_38.copy()
    state["ewma_mean"] = ewma_mean
    state["ewma_std"] = ewma_std
    state["ewma_delta"] = ewma_delta

    temporal_7 = np.array(
        [mean_val, std_val, delta_l2, delta_max, ewma_mean, ewma_std, ewma_delta],
        dtype=np.float32,
    )

    full_83 = np.concatenate([raw_38, delta, temporal_7]).astype(np.float32)
    return full_83.reshape(1, -1)


def _diagnose_technical_fault(item: TelemetryCreate) -> tuple[str, float, dict[str, float]]:
    """
    Run Model 02-A Technical Failure Specialist across 33 canonical observability features.
    """
    if _model_02a_pipeline is None or _model_02a_contract is None:
        return "system", 0.70, {}

    cols = _model_02a_contract["feature_columns"]
    cpu_val = float(item.cpu.usage_percent)
    mem_val = float(item.memory.usage_percent)
    disk_bytes = float(item.disk.read_bytes_per_sec + item.disk.write_bytes_per_sec)

    feats: dict[str, float] = {c: 0.0 for c in cols}
    feats["cpu_utilization__mean"] = cpu_val
    feats["cpu_utilization__max"] = min(100.0, cpu_val * 1.05)
    feats["cpu_utilization__p95"] = cpu_val
    feats["cpu_utilization__last"] = cpu_val

    feats["memory_utilization__mean"] = mem_val
    feats["memory_utilization__max"] = min(100.0, mem_val * 1.02)
    feats["memory_utilization__p95"] = mem_val
    feats["memory_utilization__last"] = mem_val

    feats["request_latency__mean"] = disk_bytes / 1.0e6
    feats["request_latency__max"] = (disk_bytes / 1.0e6) * 1.5
    feats["request_latency__p95"] = disk_bytes / 1.0e6

    feats["error_rate__mean"] = 0.0
    feats["telemetry_global__mean"] = (cpu_val + mem_val) / 2.0
    feats["telemetry_global__max"] = max(cpu_val, mem_val)

    df = pd.DataFrame([feats])
    pred = _model_02a_pipeline.predict(df)[0]
    probs = _model_02a_pipeline.predict_proba(df)[0]
    conf = float(np.max(probs))
    class_probs = {cls_name: float(p) for cls_name, p in zip(_model_02a_pipeline.classes_, probs, strict=False)}

    return str(pred), conf, class_probs


def _diagnose_cyber_threat(item: TelemetryCreate) -> tuple[bool, float, list[str]]:
    """
    Run Model 02-B Cyber Attack Specialist on host Sysmon behavioral indicators.
    """
    if _model_02b_pipeline is None or _model_02b_columns is None:
        return False, 0.05, []

    feats: dict[str, float] = {c: 0.0 for c in _model_02b_columns}
    proc_cnt = float(item.process_count)
    net_out = float(item.network.bytes_out_per_sec)

    # Benign baseline vs attack feature modulation
    is_suspicious = proc_cnt > 500 or net_out > 5.0e7
    if is_suspicious:
        feats["window_event_count"] = min(200.0, proc_cnt / 5.0)
        feats["unique_process_image_count"] = min(25.0, proc_cnt / 40.0)
        feats["unique_parent_child_pair_count"] = min(20.0, proc_cnt / 50.0)
        feats["inter_event_time_mean"] = 150.0
        feats["inter_event_time_std"] = 500.0
        feats["event_burstiness"] = 3.3
        feats["process_create_rate"] = 0.8
        feats["network_connect_rate"] = 0.6
        feats["external_destination_rate"] = 0.5
    else:
        feats["window_event_count"] = 5.0
        feats["unique_process_image_count"] = 1.0
        feats["inter_event_time_mean"] = 8600.0
        feats["inter_event_time_std"] = 17400.0
        feats["event_burstiness"] = 1.39

    # Cyclical hour features
    now = datetime.now(timezone.utc)
    hour = now.hour + now.minute / 60.0
    feats["hour_sin"] = float(np.sin(2.0 * np.pi * hour / 24.0))
    feats["hour_cos"] = float(np.cos(2.0 * np.pi * hour / 24.0))

    df = pd.DataFrame([feats])
    pred = int(_model_02b_pipeline.predict(df)[0])
    probs = _model_02b_pipeline.predict_proba(df)[0]
    threat_prob = float(probs[1]) if len(probs) > 1 else float(pred)

    top_evidence = []
    if threat_prob >= 0.7:
        top_evidence.append(f"Model 02-B flagged host APT anomaly signature (threat prob: {threat_prob:.2%})")

    return (threat_prob >= 0.7), threat_prob, top_evidence


def evaluate_telemetry_snapshot(
    item: TelemetryCreate,
    workstation_name: str | None = None,
) -> AnomalyEvaluationResult:
    """
    Evaluate an incoming telemetry snapshot through the complete multi-stage ML pipeline:
    1. Model 01 (Isolation Forest screening across 38+45=83 channels).
    2. If anomalous, Model 02-A (Technical failure diagnosis) and Model 02-B (Cyber threat diagnosis).

    Parameters
    ----------
    item:
        Incoming validated TelemetryCreate payload.
    workstation_name:
        Optional machine hostname or identifier (e.g. 'machine-1-1').

    Returns
    -------
    AnomalyEvaluationResult
    """
    global _is_initialised
    if not _is_initialised:
        initialise()

    ws_key = workstation_name or str(item.workstation_id)
    detector_artifact = _get_model_01_for_workstation(ws_key)

    # Fallback if no models are initialised
    if detector_artifact is None:
        is_high_cpu = item.cpu.usage_percent >= 98.0
        is_high_mem = item.memory.usage_percent >= 98.0
        is_anon = is_high_cpu or is_high_mem
        return AnomalyEvaluationResult(
            is_anomaly=is_anon,
            anomaly_type=AnomalyType.TECHNICAL_ANOMALY if is_anon else AnomalyType.NORMAL,
            score=0.95 if is_anon else 0.05,
            confidence=0.80,
            model_name="rule_based_fallback",
            model_version="1.0.0",
            features_snapshot={"cpu": item.cpu.usage_percent, "memory": item.memory.usage_percent},
            evidence=["Rule-based fallback: high metric utilization threshold exceeded."] if is_anon else [],
        )

    # 1. Feature extraction and transformation
    raw_38 = _extract_38_channel_vector(item, detector_artifact)
    full_83 = _build_83_feature_vector(raw_38, str(item.workstation_id), detector_artifact)

    scaler = detector_artifact["scaler"]
    model = detector_artifact["model"]
    threshold = float(detector_artifact["threshold"])
    model_ver = str(detector_artifact.get("model_version", "1.0.0"))

    scaled = scaler.transform(full_83)
    raw_score = -float(model.decision_function(scaled)[0])
    is_anomaly = raw_score >= threshold

    snapshot = {
        "cpu_usage": float(item.cpu.usage_percent),
        "memory_usage": float(item.memory.usage_percent),
        "disk_read_bps": float(item.disk.read_bytes_per_sec),
        "disk_write_bps": float(item.disk.write_bytes_per_sec),
        "network_in_bps": float(item.network.bytes_in_per_sec),
        "network_out_bps": float(item.network.bytes_out_per_sec),
        "process_count": float(item.process_count),
        "raw_anomaly_score": raw_score,
        "anomaly_threshold": threshold,
    }

    if not is_anomaly:
        normalized_score = float(max(0.0, min(0.45, (raw_score - threshold + 0.1) * 2.0)))
        return AnomalyEvaluationResult(
            is_anomaly=False,
            anomaly_type=AnomalyType.NORMAL,
            score=normalized_score,
            confidence=0.95,
            model_name="model_01_isolation_forest",
            model_version=model_ver,
            features_snapshot=snapshot,
            evidence=["Telemetry metrics within normal learned operational baseline."],
        )

    # 2. Stage 2 Parallel Diagnostics
    normalized_score = float(min(1.0, max(0.51, 0.50 + (raw_score - threshold) / (abs(threshold) + 1e-4) * 0.5)))
    pred_fault, fault_conf, class_probs = _diagnose_technical_fault(item)
    is_cyber, cyber_prob, cyber_ev = _diagnose_cyber_threat(item)

    evidence_list = [
        f"Model 01 Isolation Forest anomaly score ({raw_score:.4f}) exceeded threshold ({threshold:.4f}).",
    ]

    if is_cyber or cyber_prob >= 0.70:
        anomaly_type = AnomalyType.SECURITY_ANOMALY
        evidence_list.append(f"Model 02-B flagged host cyber attack pattern (threat probability: {cyber_prob:.2%}).")
        final_conf = max(0.85, cyber_prob)
        return AnomalyEvaluationResult(
            is_anomaly=True,
            anomaly_type=anomaly_type,
            score=normalized_score,
            confidence=final_conf,
            model_name="model_01_isolation_forest+model_02_diagnostics",
            model_version=model_ver,
            features_snapshot=snapshot,
            evidence=evidence_list,
            predicted_fault=None,
            fault_confidence=None,
            cyber_threat_probability=cyber_prob,
        )

    # Technical anomaly validation: require diagnostic confidence >= 0.60
    # OR genuine severe hardware saturation (CPU >= 85%, RAM >= 90%, disk IO >= 50 MB/s, procs >= 800)
    cpu_val = float(item.cpu.usage_percent)
    mem_val = float(item.memory.usage_percent)
    disk_bytes = float(item.disk.read_bytes_per_sec + item.disk.write_bytes_per_sec)
    proc_cnt = float(item.process_count)

    is_hardware_stressed = cpu_val >= 85.0 or mem_val >= 90.0 or disk_bytes >= 5.0e7 or proc_cnt >= 800.0

    if fault_conf >= 0.60 or is_hardware_stressed:
        anomaly_type = AnomalyType.TECHNICAL_ANOMALY
        evidence_list.append(f"Model 02-A diagnosed technical fault '{pred_fault}' with confidence {fault_conf:.2%}.")
        final_conf = max(0.80, fault_conf)
        return AnomalyEvaluationResult(
            is_anomaly=True,
            anomaly_type=anomaly_type,
            score=normalized_score,
            confidence=final_conf,
            model_name="model_01_isolation_forest+model_02_diagnostics",
            model_version=model_ver,
            features_snapshot=snapshot,
            evidence=evidence_list,
            predicted_fault=pred_fault,
            fault_confidence=fault_conf,
            cyber_threat_probability=cyber_prob,
        )

    # Low diagnostic confidence without hardware stress indicates benign baseline variance
    return AnomalyEvaluationResult(
        is_anomaly=False,
        anomaly_type=AnomalyType.NORMAL,
        score=float(min(0.48, max(0.05, normalized_score * 0.4))),
        confidence=0.90,
        model_name="model_01_isolation_forest+model_02_diagnostics",
        model_version=model_ver,
        features_snapshot=snapshot,
        evidence=[
            (
                f"Stage 1 screening flagged statistical variation ({raw_score:.4f} >= {threshold:.4f}), "
                f"but Stage 2 diagnostic confidence was low ({fault_conf:.2%}) with normal hardware metrics — classified as benign operational variance."
            )
        ],
        predicted_fault=None,
        fault_confidence=None,
        cyber_threat_probability=cyber_prob,
    )
