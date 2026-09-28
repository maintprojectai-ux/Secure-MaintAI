"""
Secure-MaintAI — Unit Tests for Audit Log Query API.

Verifies:
- Rule 8: Server-authoritative RBAC (only ADMIN and IT_OPERATOR can query audit logs).
- Rule 24: Audit logs are queryable with pagination and filter criteria.
"""

import pytest
from httpx import AsyncClient

from backend.models.audit import AuditLog
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_audit_logs_rbac_denied_for_student(
    async_client: AsyncClient,
    student_headers: dict[str, str],
) -> None:
    """STUDENT role must be denied access to audit logs with HTTP 403."""
    response = await async_client.get("/api/v1/audit/logs", headers=student_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_audit_logs_allowed_for_admin(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """ADMIN role must be allowed access to audit logs with HTTP 200."""
    response = await async_client.get("/api/v1/audit/logs", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data


@pytest.mark.asyncio
async def test_audit_logs_query_and_filtering(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Seeded audit logs should be retrievable and filterable."""
    async with TestAsyncSession() as session:
        log1 = AuditLog(
            actor="user:admin",
            action="workstation.isolate",
            resource="workstation:ws-test-01",
            result="success",
            metadata_={"reason": "Testing isolation audit"},
        )
        log2 = AuditLog(
            actor="user:operator",
            action="alert.acknowledge",
            resource="alert:alt-test-01",
            result="success",
            metadata_={"note": "Acknowledged alert"},
        )
        session.add_all([log1, log2])
        await session.commit()

    # Query all
    res = await async_client.get("/api/v1/audit/logs", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2

    # Query with action filter
    res_filtered = await async_client.get(
        "/api/v1/audit/logs?action=workstation.isolate",
        headers=admin_headers,
    )
    assert res_filtered.status_code == 200
    filtered_data = res_filtered.json()
    assert all(item["action"] == "workstation.isolate" for item in filtered_data["items"])
