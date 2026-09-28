"""
Secure-MaintAI — Incident Model.

Per implementation plan Section 21: incident management.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from backend.models.alert import Alert
    from backend.models.user import UserAccount
    from backend.models.workstation import Workstation


class Incident(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Security or maintenance incident."""

    __tablename__ = "incident"

    incident_number: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        nullable=False,
        comment="Human-readable incident number, e.g. INC-2024-0001",
    )
    alert_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("alert.id"),
        nullable=True,
        comment="First or main alert associated with the incident",
    )
    severity: Mapped[str] = mapped_column(String(16), nullable=False, comment="LOW, MEDIUM, HIGH, CRITICAL")
    category: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="TECHNICAL_FAILURE, SECURITY_THREAT, POLICY_VIOLATION, MAINTENANCE, OTHER",
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
    opened_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("user_account.id"),
        nullable=True,
        comment="User or system account that opened the incident",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="OPEN",
        comment="OPEN, INVESTIGATING, CONTAINED, RESOLVED, CLOSED",
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    response_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_summary: Mapped[str | None] = mapped_column(Text, nullable=True, comment="Resolution notes")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    alert: Mapped["Alert | None"] = relationship("Alert", lazy="selectin")
    workstation: Mapped["Workstation | None"] = relationship("Workstation", lazy="selectin")
    opened_by_user: Mapped["UserAccount | None"] = relationship(
        "UserAccount", foreign_keys=[opened_by], lazy="selectin"
    )

    # Property aliases
    @property
    def incident_status(self) -> str:
        return self.status

    @property
    def opened_at(self) -> datetime:
        return self.created_at

    __table_args__ = (
        Index("ix_incident_status", "status"),
        Index("ix_incident_severity", "severity"),
        Index("ix_incident_category", "category"),
        Index("ix_incident_workstation", "workstation_id"),
        Index("ix_incident_alert", "alert_id"),
    )

    def __repr__(self) -> str:
        return f"<Incident(number='{self.incident_number}', severity={self.severity}, status={self.status})>"
