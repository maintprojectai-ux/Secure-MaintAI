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
