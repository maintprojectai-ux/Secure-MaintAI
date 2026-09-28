"""
Secure-MaintAI — Security Events Ingestion, Query & Correlation API.

Endpoints:
- POST /api/v1/security/events (Ingest normalized security event)
- POST /api/v1/security/events/wazuh (Ingest raw Wazuh SIEM alert)
- POST /api/v1/security/events/batch (Ingest batch of security events)
- GET  /api/v1/security/events (Query security events with filters)
- GET  /api/v1/security/events/{event_id} (Retrieve specific security event)
- POST /api/v1/security/correlate/{workstation_id} (Trigger multi-source correlation)
"""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user
from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.security_event import SecurityEvent
from backend.models.user import UserAccount
from backend.models.workstation import Workstation
from backend.schemas.security_event import (
    SecurityEventCreate,
    SecurityEventResponse,
    SecurityEventSeverity,
    SecurityEventType,
)
from security.adapters.wazuh_adapter import WazuhAdapter
from security.correlation_engine import CorrelatedIncident, correlation_engine

router = APIRouter()
_wazuh_adapter = WazuhAdapter()


class CorrelatedIncidentResponse(BaseModel):
    """API response schema for multi-signal security correlation."""

    workstation_id: UUID
    is_threat: bool
    incident_category: str
    severity: SecurityEventSeverity
    confidence: float
    title: str
    summary: str
    evidence: list[str] = Field(default_factory=list)
    recommended_action: str
    correlated_anomaly_ids: list[UUID] = Field(default_factory=list)
    correlated_event_ids: list[UUID] = Field(default_factory=list)
    timestamp: datetime


@router.post(
    "/events",
    response_model=SecurityEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a normalized security event",
)
async def ingest_security_event(
    item: SecurityEventCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> SecurityEventResponse:
    """
    Ingest a normalized security event (e.g. from internal detection or security adapter).
    If severity is HIGH or CRITICAL, automatically generates a correlated Alert.
    """
    if item.workstation_id is not None:
        ws_res = await session.execute(select(Workstation.hostname).where(Workstation.id == item.workstation_id))
        if not ws_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workstation '{item.workstation_id}' not found.",
            )

    event_record = SecurityEvent(
        timestamp=item.timestamp,
        source=item.source,
        workstation_id=item.workstation_id,
        user_id=item.user_id,
        event_type=item.event_type.value,
        severity=item.severity.value,
        confidence=item.confidence,
        description=item.description,
        evidence=item.evidence,
        raw_event_reference=item.raw_event_reference,
        correlation_id=item.correlation_id,
    )
    session.add(event_record)
    await session.flush()

    # Automatically generate an Alert if high severity
    if item.severity in (SecurityEventSeverity.HIGH, SecurityEventSeverity.CRITICAL):
        alert_record = Alert(
            source_type="SECURITY_EVENT",
            source_id=event_record.id,
            severity=item.severity.value,
            status="OPEN",
            title=f"Security Alert: {item.event_type.value}",
            description=item.description,
        )
        session.add(alert_record)

    await session.commit()
    await session.refresh(event_record)

    return SecurityEventResponse.model_validate(event_record)


@router.post(
    "/events/wazuh",
    response_model=SecurityEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a raw Wazuh SIEM alert payload",
)
async def ingest_wazuh_event(
    raw_payload: dict[str, Any],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    workstation_id: UUID | None = Query(default=None, description="Optional target workstation UUID"),
) -> SecurityEventResponse:
    """
    Ingest and normalize a raw Wazuh alert JSON payload via the WazuhAdapter.
    """
    parsed = _wazuh_adapter.parse_event(raw_payload, workstation_id=workstation_id)
    if parsed is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unable to parse Wazuh event payload.",
        )

    return await ingest_security_event(parsed, session)


@router.post(
    "/events/batch",
    status_code=status.HTTP_201_CREATED,
    summary="Batch ingest normalized security events",
)
async def ingest_security_events_batch(
    items: list[SecurityEventCreate],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> dict[str, Any]:
    """Batch ingestion endpoint for security events."""
    if not items:
        return {"status": "success", "processed_count": 0}

    records = [
        SecurityEvent(
            timestamp=item.timestamp,
            source=item.source,
            workstation_id=item.workstation_id,
            user_id=item.user_id,
            event_type=item.event_type.value,
            severity=item.severity.value,
            confidence=item.confidence,
            description=item.description,
            evidence=item.evidence,
            raw_event_reference=item.raw_event_reference,
            correlation_id=item.correlation_id,
        )
        for item in items
    ]
    session.add_all(records)
    await session.commit()

    return {"status": "success", "processed_count": len(records)}


@router.get(
    "/events",
    response_model=list[SecurityEventResponse],
    summary="Query security events with filters",
)
async def get_security_events(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
    workstation_id: UUID | None = Query(default=None),
    severity: SecurityEventSeverity | None = Query(default=None),
    event_type: SecurityEventType | None = Query(default=None),
    source: str | None = Query(default=None),
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
) -> list[SecurityEventResponse]:
    """Retrieve filtered security events. Requires authentication."""
    query = select(SecurityEvent).order_by(desc(SecurityEvent.timestamp)).limit(limit)

    if workstation_id is not None:
        query = query.where(SecurityEvent.workstation_id == workstation_id)
    if severity is not None:
        query = query.where(SecurityEvent.severity == severity.value)
    if event_type is not None:
        query = query.where(SecurityEvent.event_type == event_type.value)
    if source is not None:
        query = query.where(SecurityEvent.source == source)

    result = await session.execute(query)
    events = result.scalars().all()
    return [SecurityEventResponse.model_validate(e) for e in events]


@router.get(
    "/events/{event_id}",
    response_model=SecurityEventResponse,
    summary="Retrieve a security event by ID",
)
async def get_security_event_by_id(
    event_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
) -> SecurityEventResponse:
    """Retrieve a single security event by ID. Requires authentication."""
    result = await session.execute(select(SecurityEvent).where(SecurityEvent.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security event '{event_id}' not found.",
        )
    return SecurityEventResponse.model_validate(event)


@router.post(
    "/correlate/{workstation_id}",
    response_model=CorrelatedIncidentResponse,
    summary="Trigger multi-signal correlation for a workstation",
)
async def correlate_workstation_activity(
    workstation_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> CorrelatedIncidentResponse:
    """
    Correlate recent ML anomalies and security events on a workstation.
    Returns unified diagnostic incident reasoning (e.g. Cryptojacking vs Benign High Compute).
    """
    # 1. Verify workstation
    ws_res = await session.execute(select(Workstation.hostname).where(Workstation.id == workstation_id))
    hostname = ws_res.scalar_one_or_none()
    if hostname is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workstation '{workstation_id}' not found.",
        )

    # 2. Query recent anomalies
    anom_res = await session.execute(
        select(AnomalyDetection)
        .where(AnomalyDetection.workstation_id == workstation_id)
        .order_by(desc(AnomalyDetection.timestamp))
        .limit(limit)
    )
    anomalies = anom_res.scalars().all()

    # 3. Query recent security events
    sec_res = await session.execute(
        select(SecurityEvent)
        .where(SecurityEvent.workstation_id == workstation_id)
        .order_by(desc(SecurityEvent.timestamp))
        .limit(limit)
    )
    sec_events = sec_res.scalars().all()

    # 4. Run correlation engine
    incident: CorrelatedIncident = correlation_engine.correlate(
        workstation_id=workstation_id,
        anomalies=anomalies,
        security_events=sec_events,
        workstation_name=hostname,
    )

    severity_val = (
        incident.severity
        if isinstance(incident.severity, SecurityEventSeverity)
        else SecurityEventSeverity(str(incident.severity).upper())
    )

    return CorrelatedIncidentResponse(
        workstation_id=incident.workstation_id,
        is_threat=incident.is_threat,
        incident_category=incident.incident_category,
        severity=severity_val,
        confidence=incident.confidence,
        title=incident.title,
        summary=incident.summary,
        evidence=incident.evidence,
        recommended_action=incident.recommended_action,
        correlated_anomaly_ids=incident.correlated_anomaly_ids,
        correlated_event_ids=incident.correlated_event_ids,
        timestamp=incident.timestamp,
    )
