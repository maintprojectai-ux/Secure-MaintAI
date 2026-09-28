"""
Secure-MaintAI — Audit Log Model.

Per implementation plan Section 23: immutable, append-only audit trail.
Every privileged operation creates an audit entry.
Audit entries are never updated or deleted.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, JSON, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, UUIDPrimaryKeyMixin


class AuditLog(Base, UUIDPrimaryKeyMixin):
    """Immutable audit log entry. No update or delete operations permitted."""

    __tablename__ = "audit_log"

    actor: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
        comment="User or system identity that performed the action",
    )
    action: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        comment="Action performed, e.g. user.login, incident.create",
    )
    resource: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
        comment="Affected resource, e.g. user:abc-123, workstation:ws-001",
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    source_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    result: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="success, failure, denied"
    )
    correlation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSON, nullable=True, comment="Additional non-sensitive context"
    )

    __table_args__ = (
        Index("ix_audit_log_actor", "actor"),
        Index("ix_audit_log_action", "action"),
        Index("ix_audit_log_timestamp", "timestamp"),
        Index("ix_audit_log_correlation", "correlation_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog(actor='{self.actor}', action='{self.action}', "
            f"result='{self.result}')>"
        )
