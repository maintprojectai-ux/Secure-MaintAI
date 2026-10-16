"""
Secure-MaintAI — Policy Evaluation & SOAR Response API Endpoints.

Per engineering rules:
- Rule 16: ML Prediction -> Security Correlation -> Identity Context -> Policy Engine -> Authorized Action.
- Rule 19: Surgical isolation with rollback and emergency kill switch.
- Rule 20: Role-sensitive enforcement across Student, Researcher, and IT Operator profiles.
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user, require_roles
from backend.models.anomaly import AnomalyDetection
from backend.models.security_event import SecurityEvent
from backend.models.user import UserAccount
from backend.schemas.user import RoleEnum
from backend.services.soar_service import PlaybookExecutionResult, SOARService
from security.policy_engine import (
    PolicyEvaluationResult,
    policy_engine,
)

router = APIRouter()


class PolicyEvaluationResponse(BaseModel):
    """Response returned from the policy evaluation endpoint."""

    evaluation: PolicyEvaluationResult
    playbook_execution: PlaybookExecutionResult | None = None


class KillSwitchRequest(BaseModel):
    """Payload to toggle the emergency kill switch."""

    active: bool = Field(..., description="True to activate kill switch, False to deactivate.")
    reason: str = Field(..., min_length=3, max_length=512)


@router.post(
    "/evaluate/{workstation_id}",
    response_model=PolicyEvaluationResponse,
    summary="Evaluate security policy and optionally execute SOAR playbook",
)
async def evaluate_workstation_policy(
    workstation_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[UserAccount, Depends(get_current_active_user)],
    auto_execute: bool = Query(
        default=True,
        description="Whether to automatically execute the authorized SOAR playbook.",
    ),
    user_id_override: UUID | None = Query(
        default=None,
        description="Optional user ID override for policy testing and simulation.",
    ),
) -> PolicyEvaluationResponse:
    """
    Executes the complete Resilience Decision Pipeline via SOARService.evaluate_and_execute:
    1. Queries recent anomaly detections & security events for the workstation.
    2. Runs multi-source correlation engine, IdP context resolution, and policy evaluation.
    3. Optionally dispatches and executes the authorized SOAR playbook.
    """
    anom_res = await session.execute(
        select(AnomalyDetection)
        .where(AnomalyDetection.workstation_id == workstation_id)
        .order_by(desc(AnomalyDetection.timestamp))
        .limit(20)
    )
    anomalies = anom_res.scalars().all()

    sec_res = await session.execute(
        select(SecurityEvent)
        .where(SecurityEvent.workstation_id == workstation_id)
        .order_by(desc(SecurityEvent.timestamp))
        .limit(20)
    )
    security_events = sec_res.scalars().all()

    target_user_id = user_id_override or current_user.id
    soar = SOARService(session)
    _, _, _, evaluation, playbook_res = await soar.evaluate_and_execute(
        workstation_id=workstation_id,
        anomalies=anomalies,
        security_events=security_events,
        target_user_id=target_user_id,
        auto_execute=auto_execute,
        skip_if_human_approval=True,
        operator=f"user:{current_user.username}",
    )

    return PolicyEvaluationResponse(
        evaluation=evaluation,
        playbook_execution=playbook_res,
    )


@router.post(
    "/kill-switch",
    summary="Toggle emergency kill switch (Admin only)",
)
async def toggle_kill_switch(
    payload: KillSwitchRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    admin_user: Annotated[
        UserAccount,
        Depends(require_roles([RoleEnum.ADMIN])),
    ],
) -> dict[str, Any]:
    """
    Emergency kill switch: disables all automated containment actions across the platform.
    Requires ADMIN privileges.
    """
    policy_engine.set_emergency_kill_switch(payload.active)
    from backend.services.audit import AuditService

    audit = AuditService(session)
    await audit.log(
        actor=f"user:{admin_user.username}",
        action="policy.kill_switch_toggled",
        resource="system:policy_engine",
        result="success",
        metadata_={"active": payload.active, "reason": payload.reason},
    )
    await session.commit()
    return {
        "status": "success",
        "kill_switch_active": policy_engine.is_kill_switch_active,
        "message": (
            "Emergency kill switch ACTIVATED. Automated containment suppressed."
            if payload.active
            else "Emergency kill switch DEACTIVATED. Normal policy enforcement resumed."
        ),
    }


@router.post(
    "/rollback-isolation/{workstation_id}",
    summary="Rollback surgical isolation for a workstation",
)
async def rollback_isolation(
    workstation_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    operator: Annotated[
        UserAccount,
        Depends(require_roles([RoleEnum.ADMIN, RoleEnum.IT_OPERATOR])),
    ],
) -> dict[str, Any]:
    """
    Rolls back surgical network isolation and restores workstation status to ONLINE.
    Requires ADMIN or IT_OPERATOR role.
    """
    soar = SOARService(session)
    restored = await soar.rollback_isolation(
        workstation_id=workstation_id,
        operator=f"user:{operator.username}",
    )
    if not restored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workstation '{workstation_id}' not found.",
        )
    return {
        "status": "success",
        "workstation_id": str(workstation_id),
        "message": "Surgical isolation rolled back. Host restored to ONLINE.",
    }
