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
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user
from backend.models.alert import Alert
from backend.models.user import UserAccount
from backend.schemas.alert import (
    AlertCreate,
    AlertResponse,
    AlertSeverity,
    AlertSourceType,
    AlertStatus,
)
from backend.services.audit import AuditService

router = APIRouter()


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
        severity=payload.severity.value,
        status="OPEN",
        title=payload.title,
        description=payload.description,
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
    return AlertResponse.model_validate(alert)


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
    return AlertResponse.model_validate(alert)


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
    )
    await session.commit()
    return AlertResponse.model_validate(alert)
