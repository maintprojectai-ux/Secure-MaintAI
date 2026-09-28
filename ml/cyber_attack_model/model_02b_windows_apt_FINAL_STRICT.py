#!/usr/bin/env python3
"""
Secure-MaintAI — Model 02-B FINAL
Windows-APT 2025 Cyber Attack Specialist

Training/deployment alignment:
Windows Sysmon + Windows Event Logs -> Wazuh Agent -> Wazuh Manager/Indexer
-> canonical event fields -> 5-minute telemetry context -> behavioral features
-> cyber evidence.

Ground-truth protocol:
* Positive: non-Maryam rows marked technique-tagged/technique-unmatched by
  the v4 scenario-mapping supplement.
* Negative: Maryam Wazuh-management baseline, explicitly documented by the
  supplement as benign infrastructure telemetry.
* Excluded: untagged non-Maryam and unresolved/NA rows.
* MITRE, scenario, rule, hash, GUID and ground-truth fields are never model X.

This script is the executed reference implementation used for the final
Model 02-B results delivered with Secure-MaintAI.
 python cyber_attack_model/model_02b_windows_apt_FINAL_STRICT.py --zip "data/Windows-APT 2025 A Dataset for APT-Inspired Attack.zip" --output model02b_apt_outputs
"""

from __future__ import annotations
import argparse, json, re, time, zipfile
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, average_precision_score, balanced_accuracy_score,
    classification_report, confusion_matrix, f1_score, precision_score,
    recall_score, roc_auc_score
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BASE = "Windows-APT 2025 A Dataset for APT-Inspired Attack/"
EVENT_COLS = {
    "image": "_source.data.win.eventdata.image",
    "parent_image": "_source.data.win.eventdata.parentImage",
    "command_line": "_source.data.win.eventdata.commandLine",
    "source_ip": "_source.data.win.eventdata.sourceIp",
    "destination_ip": "_source.data.win.eventdata.destinationIp",
    "destination_port": "_source.data.win.eventdata.destinationPort",
    "target_filename": "_source.data.win.eventdata.targetFilename",
    "registry_path": "_source.data.win.eventdata.targetObject",
}

def norm(c):
    return re.sub(r"\s+", " ", str(c).replace("\ufeff","").strip().lower())

def cfind(columns, *names):
    m = {norm(c): c for c in columns}
    for n in names:
        if norm(n) in m:
            return m[norm(n)]
    return None

def load_source(path: Path, member: str | None = None) -> pd.DataFrame:
    if member:
        with zipfile.ZipFile(path) as z:
            return pd.read_csv(z.open(member), low_memory=False)
    return pd.read_csv(path, low_memory=False)

def read_zip_tables(zip_path: Path):
    with zipfile.ZipFile(zip_path) as z:
        combined = pd.read_csv(z.open(BASE+"combined.csv"), low_memory=False)
        mapping = pd.read_csv(
            z.open(BASE+"scenario_mapping_supplement/log_to_scenario_mapping.csv"),
            low_memory=False
        )
        source_members = [
            n for n in z.namelist()
            if n.startswith(BASE) and n.count("/") == 1 and n.lower().endswith(".csv")
            and Path(n).name not in {"combined.csv","scenario_manifest.csv","validation_summary.csv"}
        ]
        source_meta = []
        for n in source_members:
            d = pd.read_csv(z.open(n), usecols=["_id"], low_memory=False)
            source_meta.append((Path(n).name, len(d), str(d["_id"].iloc[0])))
        return combined, mapping, source_meta

def parse_real_events(combined, mapping, source_meta):
    idpos={str(v):i for i,v in enumerate(combined["_id"].astype(str))}
    source_meta=sorted(source_meta,key=lambda x:idpos.get(x[2],10**12))
    offsets={name:idpos[first] for name,n,first in source_meta}
    m=mapping.copy()
    m["Source_CSV"]=m["Source_CSV"].astype(str).str.strip()
    m["Row_Index"]=pd.to_numeric(m["Row_Index"],errors="coerce").astype("Int64")
    m["global_index"]=[
        offsets.get(s,-1)+int(r) if s in offsets and pd.notna(r) else -1
        for s,r in zip(m["Source_CSV"],m["Row_Index"])
    ]
    if not (m["global_index"]>=0).all():
        raise RuntimeError("Failed Source_CSV + Row_Index ground-truth join.")
    idx=m["global_index"].astype(int).to_numpy()
    if not np.all(combined.iloc[idx]["_source.@timestamp"].astype(str).to_numpy()==m["Timestamp"].astype(str).to_numpy()):
        raise RuntimeError("Ground-truth timestamp alignment failed.")
    if not np.all(combined.iloc[idx]["_source.agent.name"].astype(str).to_numpy()==m["Agent_Name"].astype(str).to_numpy()):
        raise RuntimeError("Ground-truth agent alignment failed.")

    maryam=m["Agent_Name"].astype(str).str.strip().str.lower().eq("maryam")
    # Strict training protocol: only scenario attributions with the strongest
    # two tiers are used as attack-labeled events. SHARED-WEAK remains for
    # sensitivity analysis and is never treated as the primary training label.
    pos=(~maryam)&m["Derived_Label"].isin(["technique-tagged","technique-unmatched"])&m["Attribution_Strength"].isin(["UNIQUE-MATCH","NARROWED"])
    neg=maryam
    m["event_target"]=np.where(pos,1,np.where(neg,0,np.nan))

    cm={norm(c):c for c in combined.columns}
    def C(*names): return cfind(combined.columns,*names)

    tc=C("_source.@timestamp","_source.timestamp","_source.data.win.system.systemTime")
    ac=C("_source.agent.name","Agent-Name")
    ec=C("_source.data.win.system.eventID","EventID")
    if not(tc and ac and ec): raise RuntimeError("Required Wazuh/Sysmon fields are missing.")

    e=pd.DataFrame({
        "global_index":np.arange(len(combined),dtype=np.int64),
        "timestamp_utc":pd.to_datetime(
            combined[tc].astype("string").str.replace(r"\s*@\s*"," ",regex=True),
            format="mixed",errors="coerce",utc=True),
        "agent_name":combined[ac].astype("string").fillna("unknown"),
        "event_id":pd.to_numeric(combined[ec],errors="coerce")
    })
    for k, candidates in EVENT_COLS.items():
        col=C(candidates)
        e[k]=combined[col].astype("string") if col else ""
    e=e.merge(
        m[["global_index","Source_CSV","event_target"]],
        on="global_index",how="left"
    ).dropna(subset=["timestamp_utc"])
    e=e.sort_values(["agent_name","timestamp_utc","global_index"]).reset_index(drop=True)
    return e,m,source_meta

def build_windows(e):
    e=e.copy()
    e["window_start"]=e["timestamp_utc"].dt.floor("5min")
    group=["agent_name","window_start"]
    eid=e["event_id"]
    cmd=e["command_line"].fillna("").astype(str).str.lower()
    dip=e["destination_ip"].fillna("").astype(str)
    tf=e["target_filename"].fillna("").astype(str).str.lower()
    reg=e["registry_path"].fillna("").astype(str).str.lower()
    img=e["image"].fillna("").astype(str)
    par=e["parent_image"].fillna("").astype(str)

    flags={
        "process_create":eid.eq(1),"network_connect":eid.eq(3),
        "process_terminate":eid.eq(5),"driver_load":eid.eq(6),
        "image_load":eid.eq(7),"remote_thread":eid.eq(8),
        "process_access":eid.eq(10),"file_create":eid.eq(11),
        "registry_event":eid.isin([12,13,14]),"wmi_event":eid.isin([19,20,21]),
        "dns_query":eid.eq(22),"file_delete":eid.isin([23,26]),
        "process_tampering":eid.eq(25),
        "powershell":cmd.str.contains(r"\bpowershell(?:\.exe)?\b|\bpwsh(?:\.exe)?\b",regex=True),
        "shell":cmd.str.contains(r"\\cmd\.exe\b|\\wscript\.exe\b|\\cscript\.exe\b",regex=True),
        "script_engine":cmd.str.contains(r"\\mshta\.exe\b|\\rundll32\.exe\b",regex=True),
        "user_writable_path":tf.str.contains(r"\\users\\|\\windows\\temp\\|\\programdata\\|\\appdata\\|\\desktop",regex=True),
        "registry_persistence":reg.str.contains(r"\\run\\|\\runonce|\\services\\|\\winlogon|image file execution options",regex=True),
    }
    for k,v in flags.items(): e[k]=v.astype("int8")
    private=("10.","192.168.","172.16.","172.17.","172.18.","172.19.",
             "172.20.","172.21.","172.22.","172.23.","172.24.","172.25.",
             "172.26.","172.27.","172.28.","172.29.","172.30.","172.31.")
    e["external_destination"]=((dip!="")&(~dip.str.startswith(private))).astype("int8")

    count_cols=list(flags)+["external_destination"]
    sums=e.groupby(group,sort=False)[count_cols].sum().add_suffix("_count")
    base=e.groupby(group,sort=False).agg(
        window_event_count=("event_id","size"),
        unique_process_image_count=("image","nunique"),
        unique_destination_ip_count=("destination_ip","nunique"),
        unique_target_filename_count=("target_filename","nunique"),
        target=("event_target","max"),
        source_period=("Source_CSV","first")
    )
    nonempty=e.replace({"image":{"":np.nan},"destination_ip":{"":np.nan},"target_filename":{"":np.nan}})
    base["unique_process_image_count"]=nonempty.groupby(group)["image"].nunique()
    base["unique_destination_ip_count"]=nonempty.groupby(group)["destination_ip"].nunique()
    base["unique_target_filename_count"]=nonempty.groupby(group)["target_filename"].nunique()

    tmp=e.assign(parent_child=(par+"->"+img).where((par!="")&(img!=""),np.nan),
                 destination_port_num=pd.to_numeric(e["destination_port"],errors="coerce"))
    pc=tmp.groupby(group)["parent_child"].nunique().rename("unique_parent_child_pair_count")
    dp=tmp.groupby(group)["destination_port_num"].nunique().rename("unique_destination_port_count")
    e["inter_event_sec"]=e.groupby("agent_name")["timestamp_utc"].diff().dt.total_seconds()
    temp=e.groupby(group)["inter_event_sec"].agg(["mean","std"]).rename(
        columns={"mean":"inter_event_time_mean","std":"inter_event_time_std"}
    )

    w=base.join(sums).join(pc).join(dp).join(temp).reset_index()
    for c in count_cols:w[f"{c}_rate"]=w[f"{c}_count"]/300.0
    w["event_burstiness"]=(
        w["inter_event_time_std"]/w["inter_event_time_mean"].replace(0,np.nan)
    ).replace([np.inf,-np.inf],np.nan).fillna(0)
    hours=pd.to_datetime(w["window_start"],utc=True).dt.hour
    w["hour_sin"]=np.sin(2*np.pi*hours/24)
    w["hour_cos"]=np.cos(2*np.pi*hours/24)

    # High-confidence target policy: attack windows from labeled events;
    # Maryam windows are baseline. Ambiguous/unresolved non-Maryam windows drop out.
    w=w[w["target"].notna()].copy()
    w["target"]=w["target"].astype(int)
    drop={"target","agent_name","window_start","source_period"}|{f"{c}_count" for c in count_cols}
    feature_cols=[c for c in w.columns if c not in drop]
    # deployment/leakage guard
    forbidden_exact = {
        "mitre", "scenario", "scenario_id", "scenario_name", "rule",
        "rule_description", "hash", "guid", "attribution_strength",
        "derived_label", "label", "ground_truth", "event_target", "target"
    }
    forbidden_tokens = re.compile(r"(^|_)(mitre|scenario_id|scenario_name|rule_description|hash|guid|attribution_strength|derived_label|ground_truth|event_target|label)($|_)",
                                   re.I)
    bad_cols=[c for c in feature_cols if norm(c) in forbidden_exact or forbidden_tokens.search(c)]
    if bad_cols: raise RuntimeError(f"Forbidden model features detected: {bad_cols}")
    return w,feature_cols

def train(w,feature_cols,out):
    X=w[feature_cols].apply(pd.to_numeric,errors="coerce").replace([np.inf,-np.inf],np.nan)
    y=w["target"].astype(int)
    day=pd.to_datetime(w["window_start"],utc=True).dt.strftime("%Y-%m-%d")
    groups=w["source_period"].astype(str)+"|"+w["agent_name"].astype(str)+"|"+day
    chosen=None
    for seed in range(42,142):
        tr,te=next(GroupShuffleSplit(n_splits=1,test_size=.25,random_state=seed).split(X,y,groups=groups))
        if y.iloc[tr].nunique()==2 and y.iloc[te].nunique()==2:
            chosen=(tr,te,seed);break
    if chosen is None: raise RuntimeError("Could not find a valid grouped train/test split.")
    tr,te,seed=chosen

    models={
        "Logistic Regression":Pipeline([
            ("imputer",SimpleImputer(strategy="median")),
            ("scaler",StandardScaler()),
            ("model",LogisticRegression(max_iter=3000,class_weight="balanced",random_state=42))
        ]),
        "Random Forest":Pipeline([
            ("imputer",SimpleImputer(strategy="median")),
            ("model",RandomForestClassifier(
                n_estimators=250,min_samples_leaf=2,
                class_weight="balanced_subsample",random_state=42,n_jobs=-1
            ))
        ])
    }
    results=[]
    for name,model in models.items():
        model.fit(X.iloc[tr],y.iloc[tr])
        pred=model.predict(X.iloc[te]); prob=model.predict_proba(X.iloc[te])[:,1]
        results.append({
            "model":name,"accuracy":accuracy_score(y.iloc[te],pred),
            "balanced_accuracy":balanced_accuracy_score(y.iloc[te],pred),
            "precision":precision_score(y.iloc[te],pred,zero_division=0),
            "recall":recall_score(y.iloc[te],pred,zero_division=0),
            "f1":f1_score(y.iloc[te],pred,zero_division=0),
            "roc_auc":roc_auc_score(y.iloc[te],prob),
            "average_precision":average_precision_score(y.iloc[te],prob),
            "test_windows":len(te)
        })
        tag=name.lower().replace(" ","_")
        pd.DataFrame(confusion_matrix(y.iloc[te],pred),
                     index=["actual_0","actual_1"],
                     columns=["pred_0","pred_1"]).to_csv(out/f"{tag}_confusion_matrix.csv")
        (out/f"{tag}_classification_report.txt").write_text(
            classification_report(y.iloc[te],pred,zero_division=0),encoding="utf-8")
        if name=="Random Forest":
            fi=pd.DataFrame({"feature":feature_cols,"importance":model.named_steps["model"].feature_importances_}).sort_values("importance",ascending=False)
            fi.to_csv(out/"rf_feature_importance.csv",index=False)
            joblib.dump(model,out/"model_02b_windows_apt_random_forest.joblib")
        else:
            joblib.dump(model,out/"model_02b_windows_apt_logistic_regression.joblib")

    metrics=pd.DataFrame(results)
    metrics.to_csv(out/"evaluation_metrics.csv",index=False)
    w.to_csv(out/"window_dataset.csv",index=False)
    (out/"feature_columns.json").write_text(json.dumps(feature_cols,indent=2),encoding="utf-8")
    return metrics,seed

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--zip",type=Path,required=True)
    ap.add_argument("--output",type=Path,default=Path("model02b_apt_outputs"))
    args=ap.parse_args()
    t=time.time()
    args.output.mkdir(parents=True,exist_ok=True)
    combined,mapping,source_meta=read_zip_tables(args.zip)
    e,m,source_meta=parse_real_events(combined,mapping,source_meta)
    w,feature_cols=build_windows(e)
    metrics,seed=train(w,feature_cols,args.output)
    summary={
        "combined_rows":len(combined),
        "mapping_rows":len(mapping),
        "parsed_events":len(e),
        "training_windows":len(w),
        "positive_windows":int((w.target==1).sum()),
        "negative_windows":int((w.target==0).sum()),
        "feature_count":len(feature_cols),
        "split_seed":seed,
        "elapsed_seconds":round(time.time()-t,2)
    }
    (args.output/"run_summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    print(json.dumps(summary,indent=2))
    print(metrics.to_string(index=False))

if __name__=="__main__":
    main()
