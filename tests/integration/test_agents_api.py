"""
Integration Tests — Agents API.

Tests agent registration and periodic heartbeat endpoints.
"""

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_agent_registration_validation_rejects_missing_fields(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/agents/register should reject incomplete registration requests."""
    response = await async_client.post(
        "/api/v1/agents/register",
        json={"hostname": ""},  # missing required ip and os
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_agent_heartbeat_unknown_agent_returns_404(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/agents/heartbeat with unknown agent_id should return 404."""
    unknown_id = str(uuid.uuid4())
    response = await async_client.post(
        "/api/v1/agents/heartbeat",
        json={
            "agent_id": unknown_id,
            "status": "ONLINE",
            "agent_version": "1.0.0",
            "cpu_usage": 25.5,
            "memory_usage": 60.0,
        },
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_agent_heartbeat_bounds_validation(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/agents/heartbeat should reject impossible CPU percentages (>100)."""
    response = await async_client.post(
        "/api/v1/agents/heartbeat",
        json={
            "agent_id": str(uuid.uuid4()),
            "status": "ONLINE",
            "cpu_usage": 150.0,  # Invalid: > 100%
        },
    )
    assert response.status_code == 422
