"""
Secure-MaintAI — Telemetry Metric Model.

Per implementation plan Section 5: telemetry_metric table.
Per engineering rules Section 22: designed for time-series workloads.

This table uses PostgreSQL with composite indexes on (workstation_id, timestamp)
for efficient time-range queries. When TimescaleDB is introduced in Phase 1,
the table can be converted to a hypertable without changing the ORM model or API.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, UUIDPrimaryKeyMixin


class TelemetryMetric(Base, UUIDPrimaryKeyMixin):
    """Time-series telemetry data from monitoring agents."""

    __tablename__ = "telemetry_metric"

    workstation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("workstation.id"),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    schema_version: Mapped[str | None] = mapped_column(default="1.0", nullable=True)

    # Flattened metrics for efficient querying and ML feature extraction
    cpu_usage: Mapped[float] = mapped_column(Float, nullable=False)
    memory_usage: Mapped[float] = mapped_column(Float, nullable=False)
    disk_read: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    disk_write: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    network_in: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    network_out: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    process_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Server-side timestamp for audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Property aliases
    @property
    def collected_at(self) -> datetime:
        return self.timestamp

    @property
    def cpu_usage_pct(self) -> float:
        return self.cpu_usage

    @property
    def memory_usage_pct(self) -> float:
        return self.memory_usage

    @property
    def disk_read_mb_s(self) -> float:
        return self.disk_read

    __table_args__ = (
        # Primary query pattern: time-range queries for a specific workstation
        Index("ix_telemetry_workstation_timestamp", "workstation_id", "timestamp"),
        # For aggregation queries across all workstations at a time point
        Index("ix_telemetry_timestamp", "timestamp"),
    )

    def __repr__(self) -> str:
        return f"<TelemetryMetric(workstation={self.workstation_id}, ts={self.timestamp}, cpu={self.cpu_usage}%)>"
