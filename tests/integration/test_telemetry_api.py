"""
Integration Tests — Telemetry API.

Tests single and batch telemetry ingestion endpoints and historical metrics retrieval.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_telemetry_ingestion_unknown_workstation_returns_404(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/telemetry with unknown workstation should return 404."""
    unknown_id = str(uuid.uuid4())
    payload = {
        "agent_id": str(uuid.uuid4()),
        "workstation_id": unknown_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "schema_version": "1.0",
        "cpu": {"usage_percent": 35.0},
        "memory": {"usage_percent": 65.0},
        "disk": {"read_bytes_per_sec": 1024.0, "write_bytes_per_sec": 2048.0},
        "network": {"bytes_in_per_sec": 512.0, "bytes_out_per_sec": 256.0},
        "process_count": 120,
    }
    response = await async_client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_telemetry_ingestion_rejects_impossible_cpu(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/telemetry should reject CPU values over 100%."""
    payload = {
        "agent_id": str(uuid.uuid4()),
        "workstation_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cpu": {"usage_percent": 110.0},  # Invalid
        "memory": {"usage_percent": 50.0},
        "disk": {"read_bytes_per_sec": 0.0, "write_bytes_per_sec": 0.0},
        "network": {"bytes_in_per_sec": 0.0, "bytes_out_per_sec": 0.0},
        "process_count": 50,
    }
    response = await async_client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_telemetry_batch_rejects_empty_items(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/telemetry/batch should reject empty items list."""
    response = await async_client.post(
        "/api/v1/telemetry/batch",
        json={"items": []},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_workstation_telemetry_requires_auth(
    async_client: AsyncClient,
) -> None:
    """GET /api/v1/telemetry/workstation/{id} should require authentication."""
    random_id = str(uuid.uuid4())
    response = await async_client.get(f"/api/v1/telemetry/workstation/{random_id}")
    assert response.status_code == 401
