"""
Integration Tests — Anomaly Detection Persistence via Telemetry Ingestion.

Verifies:
- Ingestion of normal telemetry does NOT create an AnomalyDetection row.
- Ingestion of anomalous telemetry automatically screens metrics and creates
  an AnomalyDetection record with correct anomaly_type, score, and evidence.
- Batch telemetry ingestion screens each item and records anomalies accordingly.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from backend.models.anomaly import AnomalyDetection
from backend.models.telemetry import TelemetryMetric
from backend.models.workstation import Workstation
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_normal_telemetry_persists_metric_without_anomaly(
    async_client: AsyncClient,
) -> None:
    """Ingesting benign baseline telemetry stores metrics but does not trigger an anomaly record."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="machine-1-1",
            ip_address="192.168.1.50",
            operating_system="Ubuntu 22.04",
            department="Computer Science",
            lab="Lab-A",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    payload = {
        "agent_id": str(uuid.uuid4()),
        "workstation_id": str(ws_id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "schema_version": "1.0",
        "cpu": {"usage_percent": 15.0, "user_percent": 10.0, "system_percent": 5.0},
        "memory": {"usage_percent": 30.0},
        "disk": {"read_bytes_per_sec": 1024.0, "write_bytes_per_sec": 2048.0},
        "network": {"bytes_in_per_sec": 512.0, "bytes_out_per_sec": 256.0},
        "process_count": 80,
    }

    response = await async_client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert data["processed_count"] == 1

    # Verify DB: 1 metric, 0 anomalies
    async with TestAsyncSession() as session:
        metrics_res = await session.execute(select(TelemetryMetric).where(TelemetryMetric.workstation_id == ws_id))
        assert len(metrics_res.scalars().all()) == 1

        anomalies_res = await session.execute(select(AnomalyDetection).where(AnomalyDetection.workstation_id == ws_id))
        assert len(anomalies_res.scalars().all()) == 0


@pytest.mark.asyncio
async def test_anomalous_telemetry_creates_persisted_anomaly_record(
    async_client: AsyncClient,
) -> None:
    """Ingesting spiked abnormal telemetry creates an AnomalyDetection record."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="machine-1-1",
            ip_address="192.168.1.51",
            operating_system="Ubuntu 22.04",
            department="Computer Science",
            lab="Lab-B",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    payload = {
        "agent_id": str(uuid.uuid4()),
        "workstation_id": str(ws_id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "schema_version": "1.0",
        "cpu": {"usage_percent": 99.8, "user_percent": 75.0, "system_percent": 24.8},
        "memory": {"usage_percent": 97.5},
        "disk": {"read_bytes_per_sec": 50000000.0, "write_bytes_per_sec": 90000000.0},
        "network": {"bytes_in_per_sec": 80000000.0, "bytes_out_per_sec": 85000000.0},
        "process_count": 950,
    }

    response = await async_client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 201

    # Verify DB: 1 metric, 1 persisted anomaly
    async with TestAsyncSession() as session:
        anomalies_res = await session.execute(select(AnomalyDetection).where(AnomalyDetection.workstation_id == ws_id))
        anomalies = anomalies_res.scalars().all()
        assert len(anomalies) == 1

        anomaly = anomalies[0]
        assert anomaly.workstation_id == ws_id
        assert anomaly.anomaly_type in ("TECHNICAL_ANOMALY", "SECURITY_ANOMALY")
        assert anomaly.score >= 0.50
        assert anomaly.confidence >= 0.70
        assert anomaly.status == "DETECTED"
        assert len(anomaly.evidence) > 0
        assert anomaly.features_snapshot is not None
        assert anomaly.features_snapshot["cpu_usage"] == 99.8


@pytest.mark.asyncio
async def test_batch_telemetry_creates_anomalies_for_spiked_items(
    async_client: AsyncClient,
) -> None:
    """Batch ingestion evaluates each telemetry item and creates anomalies appropriately."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="machine-1-2",
            ip_address="192.168.1.52",
            operating_system="Ubuntu 22.04",
            department="Electrical Engineering",
            lab="PowerLab",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    now_iso = datetime.now(timezone.utc).isoformat()
    normal_item = {
        "agent_id": str(uuid.uuid4()),
        "workstation_id": str(ws_id),
        "timestamp": now_iso,
        "schema_version": "1.0",
        "cpu": {"usage_percent": 18.0},
        "memory": {"usage_percent": 32.0},
        "disk": {"read_bytes_per_sec": 512.0, "write_bytes_per_sec": 1024.0},
        "network": {"bytes_in_per_sec": 1000.0, "bytes_out_per_sec": 1000.0},
        "process_count": 90,
    }

    spiked_item = {
        "agent_id": str(uuid.uuid4()),
        "workstation_id": str(ws_id),
        "timestamp": now_iso,
        "schema_version": "1.0",
        "cpu": {"usage_percent": 99.0},
        "memory": {"usage_percent": 96.0},
        "disk": {"read_bytes_per_sec": 60000000.0, "write_bytes_per_sec": 70000000.0},
        "network": {"bytes_in_per_sec": 90000000.0, "bytes_out_per_sec": 95000000.0},
        "process_count": 1100,
    }

    response = await async_client.post(
        "/api/v1/telemetry/batch",
        json={"items": [normal_item, spiked_item]},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["processed_count"] == 2

    # Verify DB: 2 metrics, 1 anomaly from the spiked item
    async with TestAsyncSession() as session:
        metrics_res = await session.execute(select(TelemetryMetric).where(TelemetryMetric.workstation_id == ws_id))
        assert len(metrics_res.scalars().all()) == 2

        anomalies_res = await session.execute(select(AnomalyDetection).where(AnomalyDetection.workstation_id == ws_id))
        anomalies = anomalies_res.scalars().all()
        assert len(anomalies) == 1
        assert anomalies[0].score >= 0.50
