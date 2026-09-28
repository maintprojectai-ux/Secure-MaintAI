"""
Secure-MaintAI — Audit Log API Endpoints.

Per engineering rules:
- Rule 8: Centralized RBAC; only ADMIN and IT_OPERATOR can query audit logs.
- Rule 24: Logging rules; immutable audit trails.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user, require_roles
from backend.models.audit import AuditLog
from backend.models.user import UserAccount
from backend.schemas.audit import AuditLogPaginatedResponse, AuditLogResponse
from backend.schemas.user import RoleEnum

router = APIRouter()


@router.get(
    "/logs",
    response_model=AuditLogPaginatedResponse,
    summary="List paginated audit log entries",
    dependencies=[Depends(require_roles([RoleEnum.ADMIN, RoleEnum.IT_OPERATOR]))],
)
async def list_audit_logs(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
    action: Annotated[str | None, Query(description="Filter by action name")] = None,
    actor: Annotated[str | None, Query(description="Filter by actor identity")] = None,
    resource: Annotated[str | None, Query(description="Filter by resource")] = None,
    result: Annotated[str | None, Query(description="Filter by result (success, failure, denied)")] = None,
    search: Annotated[str | None, Query(description="Search term in action, actor, or resource")] = None,
) -> AuditLogPaginatedResponse:
    """
    Retrieve immutable audit log records with pagination and filtering.
    Requires ADMIN or IT_OPERATOR privileges.
    """
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)

    if actor:
        query = query.where(AuditLog.actor.ilike(f"%{actor}%"))
        count_query = count_query.where(AuditLog.actor.ilike(f"%{actor}%"))

    if resource:
        query = query.where(AuditLog.resource.ilike(f"%{resource}%"))
        count_query = count_query.where(AuditLog.resource.ilike(f"%{resource}%"))

    if result:
        query = query.where(AuditLog.result == result.lower())
        count_query = count_query.where(AuditLog.result == result.lower())

    if search:
        search_filter = (
            AuditLog.action.ilike(f"%{search}%")
            | AuditLog.actor.ilike(f"%{search}%")
            | AuditLog.resource.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one() or 0

    offset = (page - 1) * page_size
    query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(page_size)
    log_result = await session.execute(query)
    logs = log_result.scalars().all()

    items = [
        AuditLogResponse(
            id=log.id,
            actor=log.actor,
            action=log.action,
            resource=log.resource,
            timestamp=log.timestamp,
            source_ip=log.source_ip,
            result=log.result,
            correlation_id=log.correlation_id,
            metadata=log.metadata_,
        )
        for log in logs
    ]

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return AuditLogPaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/logs/{log_id}",
    response_model=AuditLogResponse,
    summary="Get single audit log entry by ID",
    dependencies=[Depends(require_roles([RoleEnum.ADMIN, RoleEnum.IT_OPERATOR]))],
)
async def get_audit_log(
    log_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
) -> AuditLogResponse:
    """Retrieve an individual audit log entry by its UUID."""
    result = await session.execute(select(AuditLog).where(AuditLog.id == log_id))
    log = result.scalar_one_or_none()
    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit log entry '{log_id}' not found.",
        )
    return AuditLogResponse(
        id=log.id,
        actor=log.actor,
        action=log.action,
        resource=log.resource,
        timestamp=log.timestamp,
        source_ip=log.source_ip,
        result=log.result,
        correlation_id=log.correlation_id,
        metadata=log.metadata_,
    )
