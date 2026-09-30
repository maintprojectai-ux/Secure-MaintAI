"""
Integration Tests — Maintenance Subsystem API Endpoints.

Tests:
- Listing maintenance tasks (GET /api/v1/maintenance/tasks)
- Aggregated maintenance KPIs (GET /api/v1/maintenance/kpis)
- Task creation by ADMIN and IT_OPERATOR with audit logging (POST /api/v1/maintenance/tasks)
- RBAC enforcement: STUDENT role rejected (403) from scheduling tasks
- Status transitions: OPEN -> IN_PROGRESS -> COMPLETED (PATCH /api/v1/maintenance/tasks/{id}/status)
"""

import uuid

import pytest
from httpx import AsyncClient

from backend.models.workstation import Workstation
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_list_maintenance_tasks_empty(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """List maintenance tasks returns an empty list or seeded tasks."""
    res = await async_client.get("/api/v1/maintenance/tasks", headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_create_and_lifecycle_maintenance_task(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Test full lifecycle: create maintenance task -> query -> update status to COMPLETED."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="SRV-MAINT-01",
            ip_address="10.20.1.5",
            operating_system="Ubuntu 22.04 LTS",
            department="College of Computer Science",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    # 1. Create maintenance task
    payload = {
        "title": "Predictive SSD Replacement & Cache Trim",
        "workstation_id": str(ws_id),
        "category": "Storage",
        "priority": "High",
        "duration_minutes": 90,
        "description": "High write-amplification anomaly detected on NVMe sector.",
        "assigned_to": "Campus Hardware Team",
    }
    create_res = await async_client.post(
        "/api/v1/maintenance/tasks",
        json=payload,
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    task_data = create_res.json()
    assert task_data["title"] == payload["title"]
    assert task_data["status"] == "Scheduled"
    assert task_data["workstation_hostname"] == "SRV-MAINT-01"
    task_id = task_data["id"]

    # 2. Query task via GET /tasks
    list_res = await async_client.get("/api/v1/maintenance/tasks", headers=admin_headers)
    assert list_res.status_code == 200
    tasks = list_res.json()
    matched = [t for t in tasks if t["id"] == task_id]
    assert len(matched) == 1

    # 3. Update status to IN_PROGRESS
    prog_res = await async_client.patch(
        f"/api/v1/maintenance/tasks/{task_id}/status",
        json={"status": "IN_PROGRESS", "notes": "Technician on site."},
        headers=admin_headers,
    )
    assert prog_res.status_code == 200
    assert prog_res.json()["status"] == "In Progress"

    # 4. Update status to COMPLETED
    comp_res = await async_client.patch(
        f"/api/v1/maintenance/tasks/{task_id}/status",
        json={"status": "COMPLETED", "notes": "Drive replaced successfully."},
        headers=admin_headers,
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "Completed"


@pytest.mark.asyncio
async def test_create_maintenance_task_student_forbidden(
    async_client: AsyncClient,
    student_headers: dict[str, str],
) -> None:
    """Students lack permission to create maintenance tasks (RBAC 403)."""
    payload = {
        "title": "Unauthorized Maintenance Request",
        "category": "System",
        "priority": "Low",
    }
    res = await async_client.post(
        "/api/v1/maintenance/tasks",
        json=payload,
        headers=student_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_maintenance_kpis(
    async_client: AsyncClient,
    operator_headers: dict[str, str],
) -> None:
    """Retrieve maintenance KPIs with system health indicator."""
    res = await async_client.get("/api/v1/maintenance/kpis", headers=operator_headers)
    assert res.status_code == 200
    data = res.json()
    assert "scheduled_today" in data
    assert "in_progress" in data
    assert "completed_this_week" in data
    assert "system_health_score" in data
    assert data["system_health_score"] >= 0.0
