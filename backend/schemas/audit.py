"""
Secure-MaintAI — Audit Log Schemas.

Defines the canonical audit log contract.
Per implementation plan Section 23: every privileged operation creates an audit entry.
Audit entries are immutable — they are never updated or deleted.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AuditLogCreate(BaseModel):
    """Schema for creating an audit log entry."""

    actor: str = Field(
        ...,
        max_length=256,
        description="User or system identity that performed the action.",
    )
    action: str = Field(
        ...,
        max_length=128,
        description="Action performed (e.g., 'user.login', 'incident.create', 'isolation.execute').",
    )
    resource: str = Field(
        ...,
        max_length=256,
        description="Resource affected (e.g., 'user:abc-123', 'workstation:ws-001').",
    )
    source_ip: str | None = Field(default=None, max_length=45)
    result: str = Field(
        ...,
        max_length=32,
        description="Outcome: 'success', 'failure', 'denied'.",
    )
    correlation_id: UUID | None = Field(
        default=None,
        description="Correlation ID linking related audit events.",
    )
    metadata: dict | None = Field(
        default=None,
        description="Additional context about the action (non-sensitive).",
    )


class AuditLogResponse(BaseModel):
    """Schema for audit log data in API responses."""

    id: UUID
    actor: str
    action: str
    resource: str
    timestamp: datetime
    source_ip: str | None = None
    result: str
    correlation_id: UUID | None = None
    metadata: dict | None = None

    model_config = {"from_attributes": True}
