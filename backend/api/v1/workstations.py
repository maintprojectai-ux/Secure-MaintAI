"""
Secure-MaintAI — Workstation Inventory and Device Management API.

Endpoints for managing monitored endpoints, inspecting real-time status,
and viewing device hardware/lab assignments.

Per engineering rules Section 8 & 9: RBAC controlled, auditable.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user, require_role
from backend.models.user import UserAccount
from backend.models.workstation import Workstation
from backend.schemas.user import RoleEnum
from backend.schemas.workstation import (
    WorkstationPaginatedResponse,
    WorkstationResponse,
    WorkstationStatus,
    WorkstationUpdate,
)
from backend.services.audit import AuditService

router = APIRouter()


@router.get(
    "",
    response_model=WorkstationPaginatedResponse,
    summary="List workstations (paginated)",
)
async def list_workstations(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
    search: Annotated[str | None, Query(description="Search by hostname or IP")] = None,
    department: Annotated[str | None, Query(description="Filter by department")] = None,
    lab: Annotated[str | None, Query(description="Filter by lab")] = None,
    status: Annotated[WorkstationStatus | None, Query(description="Filter by status")] = None,
) -> WorkstationPaginatedResponse:
    """
    List enrolled workstations with pagination and filtering.
    Requires authenticated user.
    """
    query = select(Workstation)
    count_query = select(func.count(Workstation.id))

    if search:
        search_filter = (Workstation.hostname.ilike(f"%{search}%")) | (Workstation.ip_address.ilike(f"%{search}%"))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if department:
        query = query.where(Workstation.department == department)
        count_query = count_query.where(Workstation.department == department)

    if lab:
        query = query.where(Workstation.lab == lab)
        count_query = count_query.where(Workstation.lab == lab)

    if status:
        query = query.where(Workstation.status == status.value)
        count_query = count_query.where(Workstation.status == status.value)

    # Count
    total_result = await session.execute(count_query)
    total = total_result.scalar_one() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Workstation.created_at.desc()).offset(offset).limit(page_size)
    result = await session.execute(query)
    workstations = result.scalars().all()

    items = [WorkstationResponse.model_validate(w) for w in workstations]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return WorkstationPaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/{workstation_id}",
    response_model=WorkstationResponse,
    summary="Get workstation details by ID",
)
async def get_workstation_by_id(
    workstation_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
) -> WorkstationResponse:
    """
    Get detailed information for a specific workstation.
    """
    result = await session.execute(select(Workstation).where(Workstation.id == workstation_id))
    workstation = result.scalar_one_or_none()

    if workstation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workstation '{workstation_id}' not found.",
        )

    return WorkstationResponse.model_validate(workstation)


@router.patch(
    "/{workstation_id}",
    response_model=WorkstationResponse,
    summary="Update workstation metadata or status",
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.IT_OPERATOR))],
)
async def update_workstation(
    workstation_id: UUID,
    payload: WorkstationUpdate,
    request: Request,
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> WorkstationResponse:
    """
    Update workstation metadata (department, lab) or operational status.
    Requires ADMIN or IT_OPERATOR role.
    """
    audit = AuditService(session)

    result = await session.execute(select(Workstation).where(Workstation.id == workstation_id))
    workstation = result.scalar_one_or_none()

    if workstation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workstation '{workstation_id}' not found.",
        )

    changes: dict[str, str] = {}

    if payload.department is not None:
        changes["department"] = f"{workstation.department} -> {payload.department}"
        workstation.department = payload.department

    if payload.lab is not None:
        changes["lab"] = f"{workstation.lab} -> {payload.lab}"
        workstation.lab = payload.lab

    if payload.status is not None:
        changes["status"] = f"{workstation.status} -> {payload.status.value}"
        workstation.status = payload.status.value

    await audit.log(
        actor=str(current_user.id),
        action="workstation.update",
        resource=f"workstation:{workstation.id}",
        source_ip=request.client.host if request.client else None,
        result="success",
        metadata_={"changes": changes},
    )
    await session.commit()

    return WorkstationResponse.model_validate(workstation)
