"""
Integration Tests — Health Endpoints.

Tests that /health and /ready endpoints respond correctly.
These tests use the ASGI test client and do not require a running database
for the /health endpoint. The /ready endpoint requires database access.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint_returns_200(async_client: AsyncClient) -> None:
    """GET /api/v1/health should return 200 with status=healthy."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data
    assert "components" in data


@pytest.mark.asyncio
async def test_health_contains_api_component(async_client: AsyncClient) -> None:
    """Health check should include the api component."""
    response = await async_client.get("/api/v1/health")
    data = response.json()
    component_names = [c["name"] for c in data["components"]]
    assert "api" in component_names
