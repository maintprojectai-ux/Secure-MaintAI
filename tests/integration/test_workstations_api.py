"""
Integration Tests — Workstations API.

Tests workstation inventory querying, detail inspection, and metadata updates.
"""

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_workstations_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """GET /api/v1/workstations should return 401 Unauthorized when no token provided."""
    response = await async_client.get("/api/v1/workstations")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_workstation_by_id_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """GET /api/v1/workstations/{id} should return 401 Unauthorized when no token provided."""
    random_id = str(uuid.uuid4())
    response = await async_client.get(f"/api/v1/workstations/{random_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_workstation_requires_authentication(
    async_client: AsyncClient,
) -> None:
    """PATCH /api/v1/workstations/{id} should return 401 Unauthorized when no token provided."""
    random_id = str(uuid.uuid4())
    response = await async_client.patch(
        f"/api/v1/workstations/{random_id}",
        json={"department": "Computer Science"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_workstation_forbidden_for_student(
    async_client: AsyncClient,
    student_headers: dict[str, str],
) -> None:
    """PATCH /api/v1/workstations/{id} should return 403 Forbidden for non-admin/non-operator users."""
    random_id = str(uuid.uuid4())
    response = await async_client.patch(
        f"/api/v1/workstations/{random_id}",
        headers=student_headers,
        json={"department": "Computer Science"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_and_update_workstation_as_admin(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Admins should be able to list workstations and update metadata including asset_tag."""
    # 1. Register a workstation via agent registration
    reg_res = await async_client.post(
        "/api/v1/agents/register",
        json={
            "hostname": "kku-cs-node-01",
            "ip_address": "10.10.4.15",
            "operating_system": "Ubuntu 22.04 LTS",
            "department": "Engineering",
            "lab": "Lab 1",
        },
    )
    assert reg_res.status_code == 201
    ws_id = reg_res.json()["workstation_id"]

    # 2. List workstations with admin_headers
    list_res = await async_client.get("/api/v1/workstations", headers=admin_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(w["id"] == ws_id for w in list_data["items"])

    # 3. Update workstation metadata via PATCH
    patch_res = await async_client.patch(
        f"/api/v1/workstations/{ws_id}",
        headers=admin_headers,
        json={
            "department": "College of Computer Science",
            "lab": "AI Lab 3",
            "asset_tag": "KKU-ASSET-2026-99",
            "status": "MAINTENANCE",
        },
    )
    assert patch_res.status_code == 200
    updated_data = patch_res.json()
    assert updated_data["department"] == "College of Computer Science"
    assert updated_data["lab"] == "AI Lab 3"
    assert updated_data["asset_tag"] == "KKU-ASSET-2026-99"
    assert updated_data["status"] == "MAINTENANCE"
