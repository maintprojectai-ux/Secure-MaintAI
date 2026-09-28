"""
Secure-MaintAI — Telemetry Schemas.

Defines the canonical telemetry contract.
Per engineering rules Section 10: all telemetry must have agent_id, timestamp, schema_version.
Per engineering rules Section 11: validated, cleaned, and normalized before processing.

Designed so the persistence layer can be swapped from PostgreSQL to TimescaleDB
without changing the domain/API contracts.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CpuMetrics(BaseModel):
    """CPU telemetry metrics."""

    usage_percent: float = Field(..., ge=0.0, le=100.0)
    core_count: int | None = Field(default=None, ge=1)
    load_average_1m: float | None = Field(default=None, ge=0.0)
    load_average_5m: float | None = Field(default=None, ge=0.0)
    load_average_15m: float | None = Field(default=None, ge=0.0)


class MemoryMetrics(BaseModel):
    """Memory telemetry metrics."""

    usage_percent: float = Field(..., ge=0.0, le=100.0)
    total_bytes: int | None = Field(default=None, ge=0)
    available_bytes: int | None = Field(default=None, ge=0)
    used_bytes: int | None = Field(default=None, ge=0)


class DiskMetrics(BaseModel):
    """Disk I/O telemetry metrics."""

    read_bytes_per_sec: float = Field(..., ge=0.0)
    write_bytes_per_sec: float = Field(..., ge=0.0)
    usage_percent: float | None = Field(default=None, ge=0.0, le=100.0)
    total_bytes: int | None = Field(default=None, ge=0)


class NetworkMetrics(BaseModel):
    """Network telemetry metrics."""

    bytes_in_per_sec: float = Field(..., ge=0.0)
    bytes_out_per_sec: float = Field(..., ge=0.0)
    connections_active: int | None = Field(default=None, ge=0)


class TelemetryCreate(BaseModel):
    """
    Schema for incoming telemetry data from the monitoring agent.

    This is the canonical ingestion contract. The agent submits telemetry
    conforming to this schema. The backend validates and rejects invalid data.
    """

    agent_id: UUID
    workstation_id: UUID
    timestamp: datetime
    schema_version: str = Field(
        default="1.0",
        pattern=r"^\d+\.\d+$",
        description="Telemetry schema version for forward compatibility.",
    )
    cpu: CpuMetrics
    memory: MemoryMetrics
    disk: DiskMetrics
    network: NetworkMetrics
    process_count: int = Field(..., ge=0, le=65535)
    system_events: list[str] = Field(
        default_factory=list,
        max_length=100,
        description="Recent system event summaries (no sensitive content).",
    )


class TelemetryBatchCreate(BaseModel):
    """Schema for batch ingestion of telemetry records (e.g. from local buffer)."""

    items: list[TelemetryCreate] = Field(..., min_length=1, max_length=500)


class TelemetryIngestResponse(BaseModel):
    """Response returned upon successful telemetry ingestion."""

    status: str = "success"
    processed_count: int = Field(..., ge=0)
    rejected_count: int = Field(default=0, ge=0)
    ingestion_timestamp: datetime


class TelemetryResponse(BaseModel):
    """Schema for telemetry data in API responses."""

    id: UUID
    workstation_id: UUID
    timestamp: datetime
    schema_version: str | None = "1.0"
    cpu_usage: float
    memory_usage: float
    disk_read: float
    disk_write: float
    network_in: float
    network_out: float
    process_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
