"""
Secure-MaintAI — Telemetry Ingestion and Retrieval API.

Endpoints for ingesting high-throughput real-time telemetry from monitoring agents
and retrieving historical workstation metrics.

Per engineering rules Section 10:
- Validate timestamp, bounds (CPU 0-100%, non-negative I/O).
- Reject impossible metric values.
- Optimized for relational storage and future TimescaleDB hypertable extension.
"""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user
from backend.models.anomaly import AnomalyDetection
from backend.models.telemetry import TelemetryMetric
from backend.models.user import UserAccount
from backend.models.workstation import Workstation
from backend.schemas.anomaly import AnomalyResponse
from backend.schemas.telemetry import (
    TelemetryBatchCreate,
    TelemetryCreate,
    TelemetryIngestResponse,
    TelemetryResponse,
)
from backend.services import ml_pipeline_service

router = APIRouter()


@router.get(
    "/anomalies",
    response_model=list[AnomalyResponse],
    summary="Query recent anomaly detections across all workstations",
)
async def list_recent_anomalies(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
    limit: Annotated[int, Query(ge=1, le=200, description="Max anomalies to return")] = 50,
) -> list[AnomalyResponse]:
    """
    Retrieve recently detected anomalies across all monitored workstations.
    Ordered newest-first. Requires authenticated user.
    """
    query = select(AnomalyDetection).order_by(desc(AnomalyDetection.created_at)).limit(limit)
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
    ws_result = await session.execute(select(Workstation.hostname).where(Workstation.id == item.workstation_id))
    hostname = ws_result.scalar_one_or_none()
    if hostname is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workstation '{item.workstation_id}' not found.",
        )

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

    await session.commit()

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

    # Cache hostnames for workstations in this batch
    ws_ids = {item.workstation_id for item in payload.items}
    ws_result = await session.execute(select(Workstation.id, Workstation.hostname).where(Workstation.id.in_(ws_ids)))
    hostname_map = {row[0]: row[1] for row in ws_result.all()}

    records = []
    anomalies = []

    for item in payload.items:
        if item.workstation_id not in hostname_map:
            continue

        records.append(_convert_telemetry_model(item))
        hostname = hostname_map.get(item.workstation_id)

        # ML anomaly evaluation
        eval_res = ml_pipeline_service.evaluate_telemetry_snapshot(item, workstation_name=hostname)
        if eval_res.is_anomaly:
            anomalies.append(
                AnomalyDetection(
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
            )

    if records:
        session.add_all(records)
    if anomalies:
        session.add_all(anomalies)

    await session.commit()

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
    """
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

    return [
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
