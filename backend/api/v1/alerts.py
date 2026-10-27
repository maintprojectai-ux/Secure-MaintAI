"""
Secure-MaintAI — Alert Management API Endpoints.

Per engineering rules Section 7 & Section 21:
- Query and filter alerts by status, severity, source type.
- Acknowledge and resolve alerts with timestamps and audit trail.
- RBAC authorization required.
"""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user, require_roles
from backend.core.security import decode_access_token
from backend.models.alert import Alert
from backend.models.user import UserAccount
from backend.schemas.user import RoleEnum
from backend.schemas.alert import (
    AlertApprove,
    AlertCreate,
    AlertResolve,
    AlertResponse,
    AlertSeverity,
    AlertSourceType,
    AlertStatus,
)
from backend.services.alert_broadcaster import alert_broadcaster
from backend.services.audit import AuditService

router = APIRouter()


@router.get(
    "/stream",
    summary="Real-time Server-Sent Events (SSE) stream for alerts",
    description="Streams real-time alert creations, acknowledgments, and resolutions to connected UI clients.",
)
async def stream_alerts(
    token: str | None = Query(default=None),
) -> StreamingResponse:
    """
    Server-Sent Events endpoint for real-time alert updates.
    Accepts ?token= query parameter for browser EventSource compatibility.
    """
    if token:
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token for alerts stream.",
            )

    return StreamingResponse(
        alert_broadcaster.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "",
    response_model=list[AlertResponse],
    summary="List and filter alerts",
)
async def list_alerts(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
    status: AlertStatus | None = Query(default=None),
    severity: AlertSeverity | None = Query(default=None),
    source_type: AlertSourceType | None = Query(default=None),
    workstation_id: UUID | None = Query(default=None),
    requires_human_intervention: bool | None = Query(default=None),
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
) -> list[AlertResponse]:
    """Retrieve filtered alerts. Requires authentication."""
    query = select(Alert).order_by(desc(Alert.created_at)).limit(limit)

    if status is not None:
        query = query.where(Alert.status == status.value)
    if severity is not None:
        query = query.where(Alert.severity == severity.value)
    if source_type is not None:
        query = query.where(Alert.source_type == source_type.value)
    if workstation_id is not None:
        query = query.where(Alert.workstation_id == workstation_id)
    if requires_human_intervention is not None:
        query = query.where(Alert.requires_human_intervention == requires_human_intervention)

    result = await session.execute(query)
    alerts = result.scalars().all()
    return [AlertResponse.model_validate(a) for a in alerts]


@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
    summary="Get alert by ID",
)
async def get_alert(
    alert_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
) -> AlertResponse:
    """Retrieve an alert by unique ID."""
    result = await session.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found.",
        )
    return AlertResponse.model_validate(alert)


@router.post(
    "",
    response_model=AlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an alert manually",
)
async def create_alert(
    payload: AlertCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
) -> AlertResponse:
    """Create a new alert record."""
    alert = Alert(
        source_type=payload.source_type.value,
        source_id=payload.source_id,
        workstation_id=payload.workstation_id,
        severity=payload.severity.value,
        status="OPEN",
        title=payload.title,
        description=payload.description,
        requires_human_intervention=payload.requires_human_intervention,
        recommendation=payload.recommendation,
        playbook_initiated=payload.playbook_initiated,
    )
    session.add(alert)
    await session.flush()

    audit = AuditService(session)
    await audit.log(
        actor=f"user:{current_user.username}",
        action="alert.create",
        resource=f"alert:{alert.id}",
        result="success",
        metadata_={"title": payload.title, "severity": payload.severity.value},
    )
    await session.commit()
    response_data = AlertResponse.model_validate(alert)
    await alert_broadcaster.broadcast("ALERT_CREATED", response_data.model_dump())
    return response_data


@router.patch(
    "/{alert_id}/acknowledge",
    response_model=AlertResponse,
    summary="Acknowledge an alert",
)
@router.post(
    "/{alert_id}/acknowledge",
    response_model=AlertResponse,
    summary="Acknowledge an alert (POST alias)",
    include_in_schema=False,
)
async def acknowledge_alert(
    alert_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
) -> AlertResponse:
    """Mark an alert as acknowledged by a SOC operator."""
    result = await session.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found.",
        )

    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_at = datetime.now(timezone.utc)

    audit = AuditService(session)
    await audit.log(
        actor=f"user:{current_user.username}",
        action="alert.acknowledge",
        resource=f"alert:{alert.id}",
        result="success",
    )
    await session.commit()
    await session.refresh(alert)
    response_data = AlertResponse.model_validate(alert)
    await alert_broadcaster.broadcast("ALERT_ACKNOWLEDGED", response_data.model_dump())
    return response_data


@router.patch(
    "/{alert_id}/resolve",
    response_model=AlertResponse,
    summary="Resolve an alert",
)
@router.post(
    "/{alert_id}/resolve",
    response_model=AlertResponse,
    summary="Resolve an alert (POST alias)",
    include_in_schema=False,
)
async def resolve_alert(
    alert_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    payload: AlertResolve | None = None,
) -> AlertResponse:
    """Mark an alert as resolved."""
    result = await session.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found.",
        )

    alert.status = "RESOLVED"
    alert.resolved_at = datetime.now(timezone.utc)

    audit = AuditService(session)
    await audit.log(
        actor=f"user:{current_user.username}",
        action="alert.resolve",
        resource=f"alert:{alert.id}",
        result="success",
        metadata_={"notes": payload.notes} if payload and payload.notes else None,
    )
    await session.commit()
    await session.refresh(alert)
    response_data = AlertResponse.model_validate(alert)
    await alert_broadcaster.broadcast("ALERT_RESOLVED", response_data.model_dump())
    return response_data


@router.post(
    "/{alert_id}/approve",
    response_model=AlertResponse,
    summary="Authorize an alert requiring human intervention",
)
async def approve_human_intervention_alert(
    alert_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[UserAccount, Depends(require_roles([RoleEnum.ADMIN]))],
    payload: AlertApprove | None = None,
) -> AlertResponse:
    """
    Authorize and execute a held mitigation action for an alert that exceeded
    autonomous AI decision parameters (Point 4).
    """
    result = await session.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found.",
        )

    from backend.services.soar_service import SOARService

    # Transition status via canonical SOAR containment playbook classification
    alert.status = SOARService.resolve_human_intervention_status(alert.playbook_initiated)
    alert.acknowledged_at = datetime.now(timezone.utc)

    audit = AuditService(session)
    await audit.log(
        actor=f"user:{current_user.username}",
        action="alert.human_intervention.approve",
        resource=f"alert:{alert.id}",
        result="success",
        metadata_={
            "notes": payload.notes if payload else None,
            "authorized_action": alert.playbook_initiated or "MANUAL_OPERATOR_AUTHORIZATION",
        },
    )
    await session.commit()
    await session.refresh(alert)
    return AlertResponse.model_validate(alert)
