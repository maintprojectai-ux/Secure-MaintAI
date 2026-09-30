"""
Integration Tests — Executive Reports & Forensic Export API Endpoints.

Tests:
- Aggregated executive report summary (GET /api/v1/reports/summary)
- Streaming CSV export with cryptographic audit headers (GET /api/v1/reports/export?format=csv)
- Streaming JSON forensic export (GET /api/v1/reports/export?format=json)
- Authentication enforcement (401 without bearer token)
"""

import json

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_report_summary(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Retrieve live executive summary report metrics."""
    res = await async_client.get("/api/v1/reports/summary", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "fleet_uptime_percentage" in data
    assert "total_incidents" in data
    assert "system_health_rating" in data
    assert "threat_distribution" in data
    assert isinstance(data["threat_distribution"], dict)


@pytest.mark.asyncio
async def test_export_report_csv(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Stream live CSV report containing incidents and audit logs."""
    res = await async_client.get("/api/v1/reports/export?format=csv", headers=admin_headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "Content-Disposition" in res.headers
    assert "attachment" in res.headers["Content-Disposition"]
    assert "secure_maintai_report_" in res.headers["Content-Disposition"]

    content = res.text
    assert "Secure-MaintAI Infrastructure & Security Audit Export" in content
    assert "--- INCIDENTS & MAINTENANCE ---" in content
    assert "--- IMMUTABLE AUDIT TRAIL ---" in content


@pytest.mark.asyncio
async def test_export_report_json(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Stream live JSON report containing structured incident and audit records."""
    res = await async_client.get("/api/v1/reports/export?format=json", headers=admin_headers)
    assert res.status_code == 200
    assert "application/json" in res.headers.get("content-type", "")

    parsed = json.loads(res.text)
    assert "report_generated_at" in parsed
    assert "incidents" in parsed
    assert "audit_logs" in parsed
    assert isinstance(parsed["incidents"], list)
    assert isinstance(parsed["audit_logs"], list)


@pytest.mark.asyncio
async def test_report_endpoints_unauthenticated(
    async_client: AsyncClient,
) -> None:
    """Unauthenticated requests are rejected with 401."""
    res_sum = await async_client.get("/api/v1/reports/summary")
    assert res_sum.status_code == 401

    res_exp = await async_client.get("/api/v1/reports/export")
    assert res_exp.status_code == 401
