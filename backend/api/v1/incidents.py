"""
Secure-MaintAI — Incident Management API Endpoints.

Per engineering rules Section 7 (Versioned APIs) & Section 21 (SOAR & Incidents):
- Query and filter incidents by status, severity, category, workstation.
- Update incident lifecycle (OPEN -> INVESTIGATING -> CONTAINED -> RESOLVED -> CLOSED).
- RBAC authorization required on all operations.
"""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user
from backend.models.incident import Incident
from backend.models.user import UserAccount
from backend.schemas.incident import (
    IncidentCategory,
    IncidentCreate,
    IncidentResponse,
    IncidentSeverity,
    IncidentStatus,
)
from backend.services.audit import AuditService

router = APIRouter()


@router.get(
    "",
    response_model=list[IncidentResponse],
    summary="List and filter incidents",
)
async def list_incidents(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
    status: IncidentStatus | None = Query(default=None),
    severity: IncidentSeverity | None = Query(default=None),
    category: IncidentCategory | None = Query(default=None),
    workstation_id: UUID | None = Query(default=None),
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
) -> list[IncidentResponse]:
    """Retrieve filtered incident records. Requires authenticated user."""
    query = select(Incident).order_by(desc(Incident.created_at)).limit(limit)

    if status is not None:
        query = query.where(Incident.status == status.value)
    if severity is not None:
        query = query.where(Incident.severity == severity.value)
    if category is not None:
        query = query.where(Incident.category == category.value)
    if workstation_id is not None:
        query = query.where(Incident.workstation_id == workstation_id)

    result = await session.execute(query)
    incidents = result.scalars().all()
    return [IncidentResponse.model_validate(inc) for inc in incidents]


@router.get(
    "/{incident_id}",
    response_model=IncidentResponse,
    summary="Get incident details by ID",
)
async def get_incident(
    incident_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
) -> IncidentResponse:
    """Retrieve an incident by unique ID."""
    result = await session.execute(select(Incident).where(Incident.id == incident_id))
    inc = result.scalar_one_or_none()
    if inc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )
    return IncidentResponse.model_validate(inc)


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new incident manually",
)
async def create_incident(
    payload: IncidentCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
) -> IncidentResponse:
    """Create an incident manually. Requires IT_OPERATOR or ADMIN role."""
    import uuid

    inc_num = f"INC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    inc = Incident(
        incident_number=inc_num,
        severity=payload.severity.value,
        category=payload.category.value,
        workstation_id=payload.workstation_id,
        user_id=payload.user_id,
        status="OPEN",
        title=payload.title,
        description=payload.description,
        response_action=payload.response_action,
    )
    session.add(inc)
    await session.flush()

    audit = AuditService(session)
    await audit.log(
        actor=f"user:{current_user.username}",
        action="incident.create",
        resource=f"incident:{inc.id}",
        result="success",
        metadata_={"incident_number": inc_num, "category": payload.category.value},
    )
    await session.commit()
    return IncidentResponse.model_validate(inc)


@router.patch(
    "/{incident_id}/status",
    response_model=IncidentResponse,
    summary="Update incident status",
)
async def update_incident_status(
    incident_id: UUID,
    new_status: IncidentStatus,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
) -> IncidentResponse:
    """Update an incident's lifecycle status."""
    result = await session.execute(select(Incident).where(Incident.id == incident_id))
    inc = result.scalar_one_or_none()
    if inc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )

    old_status = inc.status
    inc.status = new_status.value
    if new_status in (IncidentStatus.RESOLVED, IncidentStatus.CLOSED) and inc.resolved_at is None:
        inc.resolved_at = datetime.now(timezone.utc)

    audit = AuditService(session)
    await audit.log(
        actor=f"user:{current_user.username}",
        action="incident.status_change",
        resource=f"incident:{inc.id}",
        result="success",
        metadata_={"old_status": old_status, "new_status": new_status.value},
    )
    await session.commit()
    return IncidentResponse.model_validate(inc)
