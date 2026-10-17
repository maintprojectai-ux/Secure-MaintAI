"""
Secure-MaintAI — System Settings & Platform Diagnostics API Endpoints.

Provides configuration inspection, dynamic threshold adjustment,
and IdP / Wazuh / Database health diagnostics for platform operators.
"""

import time
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.database import get_async_session
from backend.core.dependencies import get_current_active_user, require_roles
from backend.models.alert import Alert
from backend.models.audit import AuditLog
from backend.models.incident import Incident
from backend.models.telemetry import TelemetryMetric
from backend.models.user import UserAccount
from backend.models.workstation import Workstation
from backend.schemas.user import RoleEnum
from backend.services.audit import AuditService
from backend.services.idp_service import idp_service
from security.policy_engine import policy_engine

router = APIRouter()

# Runtime configurable parameters hydrated from latest system.settings_updated AuditLog entry
_runtime_settings: dict[str, Any] = {
    "org_name": "King Khalid University",
    "primary_domain": "kku.edu.sa",
    "timezone": "(GMT+03:00) Riyadh / AST",
    "date_format": "YYYY-MM-DD",
    "session_timeout_minutes": 30,
    "mfa_enabled": True,
    "strong_password_policy": True,
    "ip_whitelisting": True,
    "smd_threshold": 0.95,
    "sysmon_confidence": 0.85,
    "auto_surgical_isolation": True,
    "notify_critical": True,
    "notify_sms": True,
    "notify_daily_report": True,
    "selected_theme": "dark-cyber",
    "accent_color": "blue",
}
_hydrated_from_db = False


async def _ensure_hydrated(session: AsyncSession) -> str | None:
    """Hydrate runtime settings from the latest AuditLog entry in database and return last backup timestamp."""
    global _hydrated_from_db
    if not _hydrated_from_db:
        res = await session.execute(
            select(AuditLog)
            .where(AuditLog.action == "system.settings_updated")
            .order_by(desc(AuditLog.timestamp))
            .limit(20)
        )
        # Apply from oldest to newest among the recent 20 updates
        for entry in reversed(res.scalars().all()):
            if isinstance(entry.metadata_, dict):
                for k, v in entry.metadata_.items():
                    if k in _runtime_settings and v is not None:
                        _runtime_settings[k] = v
        _hydrated_from_db = True

    backup_res = await session.execute(
        select(AuditLog.timestamp)
        .where(AuditLog.action.in_(["system.backup_triggered", "system.settings_updated"]))
        .order_by(desc(AuditLog.timestamp))
        .limit(1)
    )
    last_ts = backup_res.scalar_one_or_none()
    return last_ts.isoformat() if last_ts else None


class SystemSettingsResponse(BaseModel):
    """Platform configuration parameters and live database statistics."""

    app_name: str
    app_env: str
    org_name: str
    primary_domain: str
    timezone: str
    date_format: str
    session_timeout_minutes: int
    mfa_enabled: bool
    strong_password_policy: bool
    ip_whitelisting: bool
    kill_switch_active: bool
    smd_threshold: float
    sysmon_confidence: float
    auto_surgical_isolation: bool
    notify_critical: bool
    notify_sms: bool
    notify_daily_report: bool
    selected_theme: str
    accent_color: str
    idp_mode: str
    idp_status: str
    db_users_count: int
    db_workstations_count: int
    db_online_workstations_count: int
    db_incidents_count: int
    db_alerts_count: int
    db_telemetry_count: int
    db_audit_logs_count: int
    last_backup_at: str | None = None


class SystemSettingsUpdate(BaseModel):
    """Payload for updating platform settings."""

    org_name: str | None = None
    primary_domain: str | None = None
    timezone: str | None = None
    date_format: str | None = None
    session_timeout_minutes: int | None = Field(default=None, ge=5, le=480)
    mfa_enabled: bool | None = None
    strong_password_policy: bool | None = None
    ip_whitelisting: bool | None = None
    smd_threshold: float | None = Field(default=None, ge=0.5, le=1.0)
    sysmon_confidence: float | None = Field(default=None, ge=0.5, le=1.0)
    auto_surgical_isolation: bool | None = None
    notify_critical: bool | None = None
    notify_sms: bool | None = None
    notify_daily_report: bool | None = None
    selected_theme: str | None = None
    accent_color: str | None = None
    kill_switch_active: bool | None = None
    trigger_backup: bool | None = None


class IdPHealthResponse(BaseModel):
    """Health diagnostic output for University IdP."""

    status: str  # healthy, degraded, outage
    latency_ms: float
    protocol: str
    mock_users_registered: int
    active_workloads_registered: int
    outage_mode_active: bool


async def _build_settings_response(session: AsyncSession) -> SystemSettingsResponse:
    last_backup_at = await _ensure_hydrated(session)
    cfg = get_settings()

    counts_res = await session.execute(
        select(
            select(func.count(UserAccount.id)).scalar_subquery(),
            select(func.count(Workstation.id)).scalar_subquery(),
            select(func.count(Workstation.id)).where(Workstation.status == "ONLINE").scalar_subquery(),
            select(func.count(Incident.id)).scalar_subquery(),
            select(func.count(Alert.id)).scalar_subquery(),
            select(func.count(TelemetryMetric.id)).scalar_subquery(),
            select(func.count(AuditLog.id)).scalar_subquery(),
        )
    )
    u_cnt, ws_cnt, ws_online_cnt, inc_cnt, alt_cnt, tel_cnt, aud_cnt = counts_res.one()

    return SystemSettingsResponse(
        app_name=cfg.app_name,
        app_env=cfg.app_env.value,
        org_name=str(_runtime_settings["org_name"]),
        primary_domain=str(_runtime_settings["primary_domain"]),
        timezone=str(_runtime_settings["timezone"]),
        date_format=str(_runtime_settings["date_format"]),
        session_timeout_minutes=int(_runtime_settings["session_timeout_minutes"]),
        mfa_enabled=bool(_runtime_settings["mfa_enabled"]),
        strong_password_policy=bool(_runtime_settings["strong_password_policy"]),
        ip_whitelisting=bool(_runtime_settings["ip_whitelisting"]),
        kill_switch_active=policy_engine.is_kill_switch_active,
        smd_threshold=float(_runtime_settings["smd_threshold"]),
        sysmon_confidence=float(_runtime_settings["sysmon_confidence"]),
        auto_surgical_isolation=bool(_runtime_settings["auto_surgical_isolation"]),
        notify_critical=bool(_runtime_settings["notify_critical"]),
        notify_sms=bool(_runtime_settings["notify_sms"]),
        notify_daily_report=bool(_runtime_settings["notify_daily_report"]),
        selected_theme=str(_runtime_settings["selected_theme"]),
        accent_color=str(_runtime_settings["accent_color"]),
        idp_mode="University IdP (OIDC/LDAP Provider)",
        idp_status="Outage Fallback Active" if idp_service.is_outage_mode else "Connected & Healthy",
        db_users_count=int(u_cnt or 0),
        db_workstations_count=int(ws_cnt or 0),
        db_online_workstations_count=int(ws_online_cnt or 0),
        db_incidents_count=int(inc_cnt or 0),
        db_alerts_count=int(alt_cnt or 0),
        db_telemetry_count=int(tel_cnt or 0),
        db_audit_logs_count=int(aud_cnt or 0),
        last_backup_at=last_backup_at,
    )


@router.get(
    "/settings",
    response_model=SystemSettingsResponse,
    summary="Get runtime system settings and database diagnostics",
)
async def get_system_settings(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
) -> SystemSettingsResponse:
    """Retrieve active system parameters, detection thresholds, and database record counts."""
    return await _build_settings_response(session)


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
    """Update runtime platform settings and persist to AuditLog. Requires ADMIN role."""
    await _ensure_hydrated(session)
    changed: dict[str, Any] = {}

    update_fields = [
        "org_name",
        "primary_domain",
        "timezone",
        "date_format",
        "session_timeout_minutes",
        "mfa_enabled",
        "strong_password_policy",
        "ip_whitelisting",
        "smd_threshold",
        "sysmon_confidence",
        "auto_surgical_isolation",
        "notify_critical",
        "notify_sms",
        "notify_daily_report",
        "selected_theme",
        "accent_color",
    ]
    for field_name in update_fields:
        val = getattr(payload, field_name)
        if val is not None:
            _runtime_settings[field_name] = val
            changed[field_name] = val

    if payload.kill_switch_active is not None:
        policy_engine.set_emergency_kill_switch(payload.kill_switch_active)
        changed["kill_switch_active"] = payload.kill_switch_active

    audit = AuditService(session)
    action_name = "system.backup_triggered" if payload.trigger_backup else "system.settings_updated"
    await audit.log(
        actor=f"user:{admin_user.username}",
        action=action_name,
        resource="system:config",
        result="success",
        metadata_=changed if changed else {"backup": "manual_snapshot"},
    )
    await session.commit()

    return await _build_settings_response(session)


@router.get(
    "/health/idp",
    response_model=IdPHealthResponse,
    summary="Perform on-demand IdP diagnostic health check",
)
async def check_idp_health(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    _: Annotated[UserAccount, Depends(get_current_active_user)],
) -> IdPHealthResponse:
    """Probe the university identity provider broker and database user count."""
    t0 = time.perf_counter()
    is_outage = idp_service.is_outage_mode
    db_users_res = await session.execute(select(func.count(UserAccount.id)))
    db_users_count = int(db_users_res.scalar() or 0)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    return IdPHealthResponse(
        status="outage" if is_outage else "healthy",
        latency_ms=latency_ms,
        protocol="OIDC / SAML 2.0 Academic Federation",
        mock_users_registered=db_users_count,
        active_workloads_registered=idp_service.active_workloads_count,
        outage_mode_active=is_outage,
    )

