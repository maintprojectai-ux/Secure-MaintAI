"""
Secure-MaintAI — Anomaly Detection Model.

Per implementation plan Section 5: anomaly_detection table.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, JSON, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, UUIDPrimaryKeyMixin


class AnomalyDetection(Base, UUIDPrimaryKeyMixin):
    """ML anomaly detection results."""

    __tablename__ = "anomaly_detection"

    workstation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("workstation.id"),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    anomaly_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="NORMAL, TECHNICAL_ANOMALY, SECURITY_ANOMALY",
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        server_default="medium",
        comment="low, medium, high, critical",
    )
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_version: Mapped[str] = mapped_column(String(32), nullable=False)
    features_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    evidence: Mapped[list | None] = mapped_column(JSON, nullable=True)
    evidence_summary: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Human-readable explanation of detected evidence"
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="DETECTED",
        comment="DETECTED, CONFIRMED, DISMISSED, ESCALATED",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    @property
    def confidence_score(self) -> float:
        """Alias for confidence."""
        return self.confidence

    @property
    def detected_at(self) -> datetime:
        """Alias for timestamp."""
        return self.timestamp

    __table_args__ = (
        Index("ix_anomaly_workstation_timestamp", "workstation_id", "timestamp"),
        Index("ix_anomaly_type", "anomaly_type"),
        Index("ix_anomaly_status", "status"),
        Index("ix_anomaly_severity", "severity"),
    )

    def __repr__(self) -> str:
        return (
            f"<AnomalyDetection(type={self.anomaly_type}, "
            f"score={self.score}, confidence={self.confidence})>"
        )
