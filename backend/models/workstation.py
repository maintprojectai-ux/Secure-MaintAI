"""
Secure-MaintAI — Workstation Model.

Per implementation plan Section 5: workstation table.
"""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from backend.models.lookup import Location
    from backend.models.user import UserAccount


class Workstation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Managed workstation/endpoint in the university infrastructure."""

    __tablename__ = "workstation"

    hostname: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    asset_tag: Mapped[str | None] = mapped_column(
        String(60), unique=True, nullable=True, comment="University asset label"
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        unique=True,
        nullable=True,
        comment="Unique agent identity for authenticated communication",
    )
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    mac_address: Mapped[str | None] = mapped_column(
        String(30), unique=True, nullable=True, comment="Network adapter MAC address"
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("location.id"), nullable=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("department.id"), nullable=True)
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("user_account.id"), nullable=True)
    operating_system: Mapped[str] = mapped_column(String(128), nullable=False)
    hardware_specs: Mapped[dict | None] = mapped_column(JSON, nullable=True, comment="CPU, RAM, storage, GPU specs")
    department: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lab: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="ONLINE",
        comment="ONLINE, OFFLINE, MAINTENANCE, COMPROMISED, DECOMMISSIONED",
    )
    agent_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    installed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    assigned_user: Mapped["UserAccount | None"] = relationship("UserAccount", lazy="selectin")
    location: Mapped["Location | None"] = relationship("Location", lazy="selectin")

    @property
    def os_name(self) -> str:
        """Alias for operating_system."""
        return self.operating_system

    __table_args__ = (
        Index("ix_workstation_status", "status"),
        Index("ix_workstation_department", "department"),
        Index("ix_workstation_last_seen", "last_seen_at"),
        Index("ix_workstation_asset_tag", "asset_tag"),
    )

    def __repr__(self) -> str:
        return f"<Workstation(hostname='{self.hostname}', status='{self.status}')>"
