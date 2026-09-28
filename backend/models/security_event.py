"""
Secure-MaintAI — Security Event Model.

Per implementation plan Section 13: security event pipeline.
Per engineering rules Section 17: normalized internal security event schema.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, UUIDPrimaryKeyMixin


class SecurityEvent(Base, UUIDPrimaryKeyMixin):
    """Normalized security event from internal or external sources."""

    __tablename__ = "security_event"

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        comment="Source system: ml-engine, siem, xdr, agent, manual",
    )
    correlated_anomaly_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("anomaly_detection.id"),
        nullable=True,
    )
    workstation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("workstation.id"),
        nullable=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("user_account.id"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    threat_type: Mapped[str | None] = mapped_column(
        String(120), nullable=True, comment="ransomware, cryptojacking, unauthorized_access"
    )
    ioc_value: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Indicator of compromise: IP, hash, domain, process"
    )
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    mitre_tactic: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        server_default="new",
        default="new",
        comment="new, correlated, investigating, contained, closed",
    )
    severity: Mapped[str] = mapped_column(String(16), nullable=False, comment="LOW, MEDIUM, HIGH, CRITICAL")
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[list | None] = mapped_column(JSON, nullable=True)
    raw_event_reference: Mapped[str | None] = mapped_column(String(512), nullable=True)
    correlation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        nullable=True,
        comment="Links related events across the detection pipeline",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    @property
    def event_time(self) -> datetime:
        """Alias for timestamp."""
        return self.timestamp

    @property
    def source_system(self) -> str:
        """Alias for source."""
        return self.source

    __table_args__ = (
        Index("ix_security_event_timestamp", "timestamp"),
        Index("ix_security_event_severity", "severity"),
        Index("ix_security_event_type", "event_type"),
        Index("ix_security_event_threat_type", "threat_type"),
        Index("ix_security_event_status", "status"),
        Index("ix_security_event_workstation", "workstation_id"),
        Index("ix_security_event_correlation", "correlation_id"),
    )

    def __repr__(self) -> str:
        return f"<SecurityEvent(type={self.event_type}, severity={self.severity}, confidence={self.confidence})>"
