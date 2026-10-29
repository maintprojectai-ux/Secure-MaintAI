"""
Secure-MaintAI — Telemetry Ingestion and Retrieval API.

Endpoints for ingesting high-throughput real-time telemetry from monitoring agents
and retrieving historical workstation metrics.

Per engineering rules Section 10:
- Validate timestamp, bounds (CPU 0-100%, non-negative I/O).
- Reject impossible metric values.
- Optimized for relational storage and future TimescaleDB hypertable extension.
"""

import time
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user
from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.incident import Incident
from backend.models.telemetry import TelemetryMetric
from backend.models.user import UserAccount
from backend.models.workstation import Workstation
from backend.schemas.anomaly import AnomalyResponse, AnomalyType
from backend.schemas.telemetry import (
    TelemetryBatchCreate,
    TelemetryCreate,
    TelemetryIngestResponse,
    TelemetryResponse,
)
from backend.services import ml_pipeline_service

router = APIRouter()

# In-memory deduplication cache for high-frequency telemetry polling (3-second TTL)
_telemetry_cache: dict[str, tuple[float, list[TelemetryResponse]]] = {}
_TELEMETRY_CACHE_TTL = 3.0


def invalidate_telemetry_cache() -> None:
    """Clear the telemetry query cache when new telemetry snapshots are ingested."""
    _telemetry_cache.clear()


@router.get(
    "/anomalies",
    response_model=list[AnomalyResponse],
    summary="Query recent anomaly detections across all workstations",
)
async def list_recent_anomalies(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
    workstation_id: Annotated[UUID | None, Query(description="Filter by workstation UUID")] = None,
    limit: Annotated[int, Query(ge=1, le=200, description="Max anomalies to return")] = 50,
) -> list[AnomalyResponse]:
    """
    Retrieve recently detected anomalies across monitored workstations.
    Ordered newest-first. Requires authenticated user.
    """
    query = select(AnomalyDetection)
    if workstation_id is not None:
        query = query.where(AnomalyDetection.workstation_id == workstation_id)
    query = query.order_by(desc(AnomalyDetection.created_at)).limit(limit)
    result = await session.execute(query)
    anomalies = result.scalars().all()
    return [AnomalyResponse.model_validate(a) for a in anomalies]


def _convert_telemetry_model(item: TelemetryCreate) -> TelemetryMetric:
    """Convert validated TelemetryCreate schema to SQLAlchemy ORM model."""
    return TelemetryMetric(
        workstation_id=item.workstation_id,
        timestamp=item.timestamp,
        schema_version=item.schema_version,
        cpu_usage=item.cpu.usage_percent,
        memory_usage=item.memory.usage_percent,
        disk_read=item.disk.read_bytes_per_sec,
        disk_write=item.disk.write_bytes_per_sec,
        network_in=item.network.bytes_in_per_sec,
        network_out=item.network.bytes_out_per_sec,
        process_count=item.process_count,
    )


async def _get_active_telemetry_suppression_state(
    session: AsyncSession,
    workstation_ids: set[UUID],
    cooldown_seconds: int = 300,
) -> tuple[dict[str, set[str]], set[str], set[str]]:
    """
    Retrieve active alert sources, active security threat incidents, and active maintenance
    incidents for workstations within the cooldown window.
    Keys and IDs are normalized to strings for cross-driver consistency.
    """
    if not workstation_ids:
        return {}, set(), set()

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=cooldown_seconds)

    # 1. Active or acknowledged alerts within cooldown window
    alerts_query = await session.execute(
        select(Alert.workstation_id, Alert.source_type)
        .where(
            Alert.workstation_id.in_(workstation_ids),
            Alert.status.in_(["OPEN", "CONTAINED", "MONITORED", "ACKNOWLEDGED"]),
            Alert.created_at >= cutoff,
        )
    )
    active_sources_by_ws: dict[str, set[str]] = {}
    for ws_id, src_type in alerts_query.all():
        if ws_id and src_type:
            active_sources_by_ws.setdefault(str(ws_id), set()).add(src_type)

    # 2. Active or contained incidents within cooldown window
    incidents_query = await session.execute(
        select(Incident.workstation_id, Incident.category)
        .where(
            Incident.workstation_id.in_(workstation_ids),
            Incident.category.in_(["SECURITY_THREAT", "MAINTENANCE", "TECHNICAL_FAILURE"]),
            Incident.status.in_(["OPEN", "CONTAINED", "INVESTIGATING", "ACKNOWLEDGED"]),
            Incident.created_at >= cutoff,
        )
    )
    active_threat_ws_ids: set[str] = set()
    active_maintenance_ws_ids: set[str] = set()
    for row in incidents_query.all():
        if row[0] is not None:
            ws_str = str(row[0])
            cat = str(row[1])
            if cat == "SECURITY_THREAT":
                active_threat_ws_ids.add(ws_str)
            elif cat in ("MAINTENANCE", "TECHNICAL_FAILURE"):
                active_maintenance_ws_ids.add(ws_str)

    return active_sources_by_ws, active_threat_ws_ids, active_maintenance_ws_ids


def _should_create_telemetry_alert(
    anomaly_type: AnomalyType,
    workstation_status: str,
    active_sources: set[str],
    has_active_threat_incident: bool,
    has_active_maintenance_incident: bool = False,
) -> bool:
    """
    Determine whether an evaluated anomaly should create an alert or be suppressed.

    Rules:
    - If TECHNICAL_ANOMALY:
      - Suppress if workstation is ISOLATED (containment in progress).
      - Suppress if workstation has an active cyber threat alert or incident (prevent secondary fault noise).
      - Suppress if active maintenance/technical alert (PREDICTIVE_MAINTENANCE, TECHNICAL_ANOMALY) or maintenance incident exists within cooldown.
    - If SECURITY_ANOMALY:
      - Suppress if CYBERSECURITY_THREAT was already alerted within cooldown.
      - A genuinely distinct / non-cooldown security anomaly remains eligible.
    """
    is_isolated = workstation_status == "ISOLATED"
    has_active_cyber_threat = ("CYBERSECURITY_THREAT" in active_sources) or has_active_threat_incident
    has_active_maintenance = (
        bool({"PREDICTIVE_MAINTENANCE", "TECHNICAL_ANOMALY"}.intersection(active_sources))
        or has_active_maintenance_incident
    )

    if anomaly_type == AnomalyType.TECHNICAL_ANOMALY:
        return (
            not is_isolated
            and not has_active_cyber_threat
            and not has_active_maintenance
        )
    elif anomaly_type == AnomalyType.SECURITY_ANOMALY:
        return "CYBERSECURITY_THREAT" not in active_sources

    return False


@router.post(
    "",
    response_model=TelemetryIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a single telemetry snapshot",
)
async def ingest_single_telemetry(
    item: TelemetryCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> TelemetryIngestResponse:
    """
    Ingest a single telemetry metric snapshot from an enrolled agent.
    Validates metric bounds, evaluates ML anomaly screening, and persists records.
    """
    # Verify workstation exists
    ws_result = await session.execute(select(Workstation).where(Workstation.id == item.workstation_id))
    workstation = ws_result.scalar_one_or_none()
    if workstation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workstation '{item.workstation_id}' not found.",
        )
    hostname = workstation.hostname

    # 1. Persist raw telemetry metric
    record = _convert_telemetry_model(item)
    session.add(record)

    # 2. Evaluate ML anomaly screening and diagnostics
    eval_res = ml_pipeline_service.evaluate_telemetry_snapshot(item, workstation_name=hostname)
    if eval_res.is_anomaly:
        anomaly_record = AnomalyDetection(
            workstation_id=item.workstation_id,
            timestamp=item.timestamp,
            anomaly_type=eval_res.anomaly_type.value,
            score=eval_res.score,
            confidence=eval_res.confidence,
            model_name=eval_res.model_name,
            model_version=eval_res.model_version,
            features_snapshot=eval_res.features_snapshot,
            evidence=eval_res.evidence,
            status="DETECTED",
        )
        session.add(anomaly_record)
        await session.flush()

        # Telemetry Alert Deduplication & Isolation Guard (Rules 19 & 21)
        active_sources_by_ws, active_threat_ws_ids, active_maintenance_ws_ids = (
            await _get_active_telemetry_suppression_state(
                session=session,
                workstation_ids={item.workstation_id},
                cooldown_seconds=300,
            )
        )
        ws_id_str = str(item.workstation_id)
        active_sources = active_sources_by_ws.get(ws_id_str, set())
        has_active_threat_incident = ws_id_str in active_threat_ws_ids
        has_active_maintenance_incident = ws_id_str in active_maintenance_ws_ids

        should_create_alert = _should_create_telemetry_alert(
            anomaly_type=eval_res.anomaly_type,
            workstation_status=workstation.status,
            active_sources=active_sources,
            has_active_threat_incident=has_active_threat_incident,
            has_active_maintenance_incident=has_active_maintenance_incident,
        )

        if should_create_alert:
            evidence_str = "; ".join(eval_res.evidence) if eval_res.evidence else "Anomalous telemetry metric observed."
            if eval_res.anomaly_type == AnomalyType.TECHNICAL_ANOMALY:
                is_critical = (
                    item.cpu.usage_percent >= 90.0
                    or item.memory.usage_percent >= 90.0
                    or eval_res.score >= 0.85
                )
                alert = Alert(
                    source_type="TECHNICAL_ANOMALY",
                    source_id=anomaly_record.id,
                    workstation_id=item.workstation_id,
                    severity="HIGH" if is_critical else "MEDIUM",
                    status="OPEN",
                    title=f"Technical Anomaly: {eval_res.predicted_fault or 'Hardware Saturation'}",
                    description=evidence_str,
                    recommendation="Review high-utilization processes or schedule hardware inspection.",
                    requires_human_intervention=False,
                )
                session.add(alert)
            elif eval_res.anomaly_type == AnomalyType.SECURITY_ANOMALY:
                alert = Alert(
                    source_type="CYBERSECURITY_THREAT",
                    source_id=anomaly_record.id,
                    workstation_id=item.workstation_id,
                    severity="CRITICAL" if eval_res.score >= 0.85 else "HIGH",
                    status="OPEN",
                    title="Cyber Threat Detected via ML Telemetry",
                    description=evidence_str,
                    recommendation="Review active socket connections and verify process authenticity.",
                    requires_human_intervention=False,
                )
                session.add(alert)

    await session.commit()
    invalidate_telemetry_cache()
    from backend.api.v1.dashboard import invalidate_dashboard_kpi_cache

    invalidate_dashboard_kpi_cache()

    return TelemetryIngestResponse(
        status="success",
        processed_count=1,
        rejected_count=0,
        ingestion_timestamp=datetime.now(timezone.utc),
    )


@router.post(
    "/batch",
    response_model=TelemetryIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a batch of telemetry snapshots",
)
async def ingest_telemetry_batch(
    payload: TelemetryBatchCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> TelemetryIngestResponse:
    """
    Batch ingestion endpoint for agent buffer draining.
    Handles bulk inserts and ML anomaly evaluation.
    """
    if not payload.items:
        return TelemetryIngestResponse(
            status="success",
            processed_count=0,
            rejected_count=0,
            ingestion_timestamp=datetime.now(timezone.utc),
        )

    # Cache workstations in this batch
    ws_ids = {item.workstation_id for item in payload.items}
    ws_result = await session.execute(select(Workstation).where(Workstation.id.in_(ws_ids)))
    ws_map = {str(w.id): w for w in ws_result.scalars().all()}

    active_sources_by_ws, active_threat_ws_ids, active_maintenance_ws_ids = (
        await _get_active_telemetry_suppression_state(
            session=session,
            workstation_ids=ws_ids,
            cooldown_seconds=300,
        )
    )

    records = []
    anomalies = []
    alerts = []

    for item in payload.items:
        ws_id_str = str(item.workstation_id)
        ws = ws_map.get(ws_id_str)
        if not ws:
            continue

        records.append(_convert_telemetry_model(item))
        hostname = ws.hostname

        # ML anomaly evaluation
        eval_res = ml_pipeline_service.evaluate_telemetry_snapshot(item, workstation_name=hostname)
        if eval_res.is_anomaly:
            anom = AnomalyDetection(
                workstation_id=item.workstation_id,
                timestamp=item.timestamp,
                anomaly_type=eval_res.anomaly_type.value,
                score=eval_res.score,
                confidence=eval_res.confidence,
                model_name=eval_res.model_name,
                model_version=eval_res.model_version,
                features_snapshot=eval_res.features_snapshot,
                evidence=eval_res.evidence,
                status="DETECTED",
            )
            anomalies.append(anom)

            active_sources = active_sources_by_ws.setdefault(ws_id_str, set())
            has_active_threat_incident = ws_id_str in active_threat_ws_ids
            has_active_maintenance_incident = ws_id_str in active_maintenance_ws_ids

            should_create_alert = _should_create_telemetry_alert(
                anomaly_type=eval_res.anomaly_type,
                workstation_status=ws.status,
                active_sources=active_sources,
                has_active_threat_incident=has_active_threat_incident,
                has_active_maintenance_incident=has_active_maintenance_incident,
            )

            if should_create_alert:
                if eval_res.anomaly_type == AnomalyType.TECHNICAL_ANOMALY:
                    active_sources.add("TECHNICAL_ANOMALY")
                elif eval_res.anomaly_type == AnomalyType.SECURITY_ANOMALY:
                    active_sources.add("CYBERSECURITY_THREAT")

                evidence_str = "; ".join(eval_res.evidence) if eval_res.evidence else "Anomalous telemetry metric observed."
                if eval_res.anomaly_type == AnomalyType.TECHNICAL_ANOMALY:
                    is_critical = (
                        item.cpu.usage_percent >= 90.0
                        or item.memory.usage_percent >= 90.0
                        or eval_res.score >= 0.85
                    )
                    alerts.append(
                        Alert(
                            source_type="TECHNICAL_ANOMALY",
                            workstation_id=item.workstation_id,
                            severity="HIGH" if is_critical else "MEDIUM",
                            status="OPEN",
                            title=f"Technical Anomaly: {eval_res.predicted_fault or 'Hardware Saturation'}",
                            description=evidence_str,
                            recommendation="Review high-utilization processes or schedule hardware inspection.",
                            requires_human_intervention=False,
                        )
                    )
                elif eval_res.anomaly_type == AnomalyType.SECURITY_ANOMALY:
                    alerts.append(
                        Alert(
                            source_type="CYBERSECURITY_THREAT",
                            workstation_id=item.workstation_id,
                            severity="CRITICAL" if eval_res.score >= 0.85 else "HIGH",
                            status="OPEN",
                            title="Cyber Threat Detected via ML Telemetry",
                            description=evidence_str,
                            recommendation="Review active socket connections and verify process authenticity.",
                            requires_human_intervention=False,
                        )
                    )

    if records:
        session.add_all(records)
    if anomalies:
        session.add_all(anomalies)
    if alerts:
        session.add_all(alerts)

    await session.commit()
    invalidate_telemetry_cache()
    from backend.api.v1.dashboard import invalidate_dashboard_kpi_cache

    invalidate_dashboard_kpi_cache()

    return TelemetryIngestResponse(
        status="success",
        processed_count=len(records),
        rejected_count=len(payload.items) - len(records),
        ingestion_timestamp=datetime.now(timezone.utc),
    )


@router.get(
    "/workstation/{workstation_id}",
    response_model=list[TelemetryResponse],
    summary="Query recent telemetry metrics for a workstation",
)
async def get_workstation_telemetry(
    workstation_id: str,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
    limit: Annotated[int, Query(ge=1, le=500, description="Max metrics to return")] = 50,
) -> list[TelemetryResponse]:
    """
    Retrieve time-series telemetry metrics for a specific workstation.
    Ordered newest-first. Requires authenticated user.
    Uses short TTL in-memory caching to eliminate duplicate requests and avoid DB connection saturation.
    """
    cache_key = f"{workstation_id}_{limit}"
    now = time.monotonic()
    if cache_key in _telemetry_cache:
        cached_time, cached_data = _telemetry_cache[cache_key]
        if now - cached_time < _TELEMETRY_CACHE_TTL:
            return cached_data

    target_uuid: UUID | None = None
    try:
        target_uuid = UUID(str(workstation_id))
    except (ValueError, TypeError):
        ws_res = await session.execute(select(Workstation.id).where(Workstation.hostname == str(workstation_id)))
        target_uuid = ws_res.scalar_one_or_none()

    if target_uuid is None:
        return []

    query = (
        select(TelemetryMetric)
        .where(TelemetryMetric.workstation_id == target_uuid)
        .order_by(desc(TelemetryMetric.timestamp))
        .limit(limit)
    )
    result = await session.execute(query)
    metrics = result.scalars().all()

    resp = [
        TelemetryResponse(
            id=m.id,
            workstation_id=m.workstation_id,
            timestamp=m.timestamp,
            schema_version=m.schema_version,
            cpu_usage=m.cpu_usage,
            memory_usage=m.memory_usage,
            disk_read=m.disk_read,
            disk_write=m.disk_write,
            network_in=m.network_in,
            network_out=m.network_out,
            process_count=m.process_count,
            created_at=m.created_at,
        )
        for m in metrics
    ]

    # Save to short-lived in-memory cache
    _telemetry_cache[cache_key] = (now, resp)
    if len(_telemetry_cache) > 200:
        _telemetry_cache.clear()

    return resp
