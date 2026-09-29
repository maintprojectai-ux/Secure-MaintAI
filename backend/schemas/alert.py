"""
Secure-MaintAI — Alert Schemas.

Defines the canonical alert contract.
Per implementation plan Section 21: alert lifecycle
OPEN → ACKNOWLEDGED → INVESTIGATING → CONTAINED → RESOLVED.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertStatus(str, Enum):
    """Alert lifecycle states per the implementation plan."""

    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    CONTAINED = "CONTAINED"
    RESOLVED = "RESOLVED"


class AlertSourceType(str, Enum):
    """Source type that generated the alert."""

    ANOMALY_DETECTION = "ANOMALY_DETECTION"
    SECURITY_EVENT = "SECURITY_EVENT"
    INCIDENT = "INCIDENT"
    AGENT_HEALTH = "AGENT_HEALTH"
    SYSTEM = "SYSTEM"
    MANUAL = "MANUAL"


class AlertCreate(BaseModel):
    """Schema for creating a new alert."""

    source_type: AlertSourceType
    source_id: UUID | None = Field(
        default=None,
        description="ID of the source record (anomaly, security event, etc.).",
    )
    severity: AlertSeverity
    title: str = Field(..., min_length=1, max_length=256)
    description: str = Field(..., max_length=4096)


class AlertResponse(BaseModel):
    """Schema for alert data in API responses."""

    id: UUID
    source_type: AlertSourceType
    source_id: UUID | None = None
    severity: AlertSeverity
    status: AlertStatus
    title: str
    description: str
    created_at: datetime
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None

    model_config = {"from_attributes": True}
