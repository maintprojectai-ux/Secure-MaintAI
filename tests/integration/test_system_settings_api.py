"""
Integration Tests — System Settings & Platform Diagnostics API Endpoints.

Tests:
- Querying runtime system configuration (GET /api/v1/system/settings)
- Updating runtime parameters and thresholds as ADMIN (PATCH /api/v1/system/settings)
- RBAC enforcement: non-admin (STUDENT) rejected from PATCH (403)
- On-demand IdP diagnostic health probe (GET /api/v1/system/health/idp)
"""

import pytest
from httpx import AsyncClient

from backend.services.idp_service import idp_service


@pytest.mark.asyncio
async def test_get_system_settings(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Retrieve runtime settings and detection thresholds."""
    res = await async_client.get("/api/v1/system/settings", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "app_name" in data
    assert "smd_threshold" in data
    assert "sysmon_confidence" in data
    assert "kill_switch_active" in data
    assert "idp_status" in data


@pytest.mark.asyncio
async def test_update_system_settings_admin(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Admin can calibrate ML thresholds and toggle policy switches."""
    payload = {
        "smd_threshold": 0.98,
        "sysmon_confidence": 0.90,
        "auto_surgical_isolation": False,
        "kill_switch_active": True,
    }
    res = await async_client.patch(
        "/api/v1/system/settings",
        json=payload,
        headers=admin_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["smd_threshold"] == 0.98
    assert data["sysmon_confidence"] == 0.90
    assert data["auto_surgical_isolation"] is False
    assert data["kill_switch_active"] is True

    # Clean up: restore kill switch to False
    restore_res = await async_client.patch(
        "/api/v1/system/settings",
        json={"kill_switch_active": False, "auto_surgical_isolation": True},
        headers=admin_headers,
    )
    assert restore_res.status_code == 200
    assert restore_res.json()["kill_switch_active"] is False


@pytest.mark.asyncio
async def test_update_system_settings_student_forbidden(
    async_client: AsyncClient,
    student_headers: dict[str, str],
) -> None:
    """Students cannot modify system configuration (RBAC 403)."""
    res = await async_client.patch(
        "/api/v1/system/settings",
        json={"smd_threshold": 0.50},
        headers=student_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_check_idp_health(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Diagnostic health probe returns latency, protocol, and fallback state."""
    # 1. Normal healthy state
    idp_service.set_outage_mode(False)
    res_normal = await async_client.get("/api/v1/system/health/idp", headers=admin_headers)
    assert res_normal.status_code == 200
    data_normal = res_normal.json()
    assert data_normal["status"] == "healthy"
    assert data_normal["outage_mode_active"] is False
    assert data_normal["latency_ms"] >= 0.0

    # 2. Outage simulation state
    idp_service.set_outage_mode(True)
    res_outage = await async_client.get("/api/v1/system/health/idp", headers=admin_headers)
    assert res_outage.status_code == 200
    data_outage = res_outage.json()
    assert data_outage["status"] == "outage"
    assert data_outage["outage_mode_active"] is True

    # Restore normal mode
    idp_service.set_outage_mode(False)
