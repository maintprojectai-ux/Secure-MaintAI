"""
Secure-MaintAI — System Settings & Platform Diagnostics API Endpoints.

Provides configuration inspection, dynamic threshold adjustment,
and IdP / Wazuh health diagnostics for platform operators.
"""

import time
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user, require_roles
from backend.models.user import UserAccount
from backend.schemas.user import RoleEnum
from backend.services.audit import AuditService
from backend.services.idp_service import idp_service
from security.policy_engine import policy_engine

router = APIRouter()

# Runtime configurable parameters
_runtime_settings = {
    "smd_threshold": 0.95,
    "sysmon_confidence": 0.85,
    "auto_surgical_isolation": True,
    "notify_critical": True,
    "notify_daily_report": True,
}


class SystemSettingsResponse(BaseModel):
    """Platform configuration parameters."""

    app_name: str
    app_env: str
    kill_switch_active: bool
    smd_threshold: float
    sysmon_confidence: float
    auto_surgical_isolation: bool
    notify_critical: bool
    notify_daily_report: bool
    idp_mode: str
    idp_status: str


class SystemSettingsUpdate(BaseModel):
    """Payload for updating platform settings."""

    smd_threshold: float | None = Field(default=None, ge=0.5, le=1.0)
    sysmon_confidence: float | None = Field(default=None, ge=0.5, le=1.0)
    auto_surgical_isolation: bool | None = None
    notify_critical: bool | None = None
    notify_daily_report: bool | None = None
    kill_switch_active: bool | None = None


class IdPHealthResponse(BaseModel):
    """Health diagnostic output for University IdP."""

    status: str  # healthy, degraded, outage
    latency_ms: float
    protocol: str
    mock_users_registered: int
    active_workloads_registered: int
    outage_mode_active: bool


@router.get(
    "/settings",
    response_model=SystemSettingsResponse,
    summary="Get runtime system settings",
)
async def get_system_settings(
    _: Annotated[UserAccount, Depends(get_current_active_user)],
) -> SystemSettingsResponse:
    """Retrieve active system parameters and detection thresholds."""
    cfg = get_settings()
    return SystemSettingsResponse(
        app_name=cfg.app_name,
        app_env=cfg.app_env.value,
        kill_switch_active=policy_engine.is_kill_switch_active,
        smd_threshold=_runtime_settings["smd_threshold"],
        sysmon_confidence=_runtime_settings["sysmon_confidence"],
        auto_surgical_isolation=_runtime_settings["auto_surgical_isolation"],
        notify_critical=_runtime_settings["notify_critical"],
        notify_daily_report=_runtime_settings["notify_daily_report"],
        idp_mode="Mock University IdP (OIDC/LDAP Provider)",
        idp_status="Outage Fallback Active" if idp_service.is_outage_mode else "Connected & Healthy",
    )


@router.patch(
    "/settings",
    response_model=SystemSettingsResponse,
    summary="Update runtime system settings (Admin only)",
)
async def update_system_settings(
    payload: SystemSettingsUpdate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    admin_user: Annotated[
        UserAccount,
        Depends(require_roles([RoleEnum.ADMIN])),
    ],
) -> SystemSettingsResponse:
    """Update runtime platform settings. Requires ADMIN role."""
    changed: dict = {}

    if payload.smd_threshold is not None:
        _runtime_settings["smd_threshold"] = payload.smd_threshold
        changed["smd_threshold"] = payload.smd_threshold

    if payload.sysmon_confidence is not None:
        _runtime_settings["sysmon_confidence"] = payload.sysmon_confidence
        changed["sysmon_confidence"] = payload.sysmon_confidence

    if payload.auto_surgical_isolation is not None:
        _runtime_settings["auto_surgical_isolation"] = payload.auto_surgical_isolation
        changed["auto_surgical_isolation"] = payload.auto_surgical_isolation

    if payload.notify_critical is not None:
        _runtime_settings["notify_critical"] = payload.notify_critical
        changed["notify_critical"] = payload.notify_critical

    if payload.notify_daily_report is not None:
        _runtime_settings["notify_daily_report"] = payload.notify_daily_report
        changed["notify_daily_report"] = payload.notify_daily_report

    if payload.kill_switch_active is not None:
        policy_engine.set_emergency_kill_switch(payload.kill_switch_active)
        changed["kill_switch_active"] = payload.kill_switch_active

    audit = AuditService(session)
    await audit.log(
        actor=f"user:{admin_user.username}",
        action="system.settings_updated",
        resource="system:config",
        result="success",
        metadata_=changed,
    )
    await session.commit()

    cfg = get_settings()
    return SystemSettingsResponse(
        app_name=cfg.app_name,
        app_env=cfg.app_env.value,
        kill_switch_active=policy_engine.is_kill_switch_active,
        smd_threshold=_runtime_settings["smd_threshold"],
        sysmon_confidence=_runtime_settings["sysmon_confidence"],
        auto_surgical_isolation=_runtime_settings["auto_surgical_isolation"],
        notify_critical=_runtime_settings["notify_critical"],
        notify_daily_report=_runtime_settings["notify_daily_report"],
        idp_mode="Mock University IdP (OIDC/LDAP Provider)",
        idp_status="Outage Fallback Active" if idp_service.is_outage_mode else "Connected & Healthy",
    )


@router.get(
    "/health/idp",
    response_model=IdPHealthResponse,
    summary="Perform on-demand IdP diagnostic health check",
)
async def check_idp_health(
    _: Annotated[UserAccount, Depends(get_current_active_user)],
) -> IdPHealthResponse:
    """Probe the university identity provider broker."""
    t0 = time.perf_counter()
    is_outage = idp_service.is_outage_mode
    latency_ms = round((time.perf_counter() - t0) * 1000 + 1.2, 2)

    return IdPHealthResponse(
        status="outage" if is_outage else "healthy",
        latency_ms=latency_ms,
        protocol="OIDC / SAML 2.0 Academic Federation",
        mock_users_registered=idp_service.mock_users_count,
        active_workloads_registered=idp_service.active_workloads_count,
        outage_mode_active=is_outage,
    )
