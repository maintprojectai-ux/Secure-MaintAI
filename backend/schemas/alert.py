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
    """Source type that generated the alert, strictly matching the four report categories."""

    TECHNICAL_ANOMALY = "TECHNICAL_ANOMALY"
    CYBERSECURITY_THREAT = "CYBERSECURITY_THREAT"
    PREDICTIVE_MAINTENANCE = "PREDICTIVE_MAINTENANCE"
    HUMAN_INTERVENTION_REQUIRED = "HUMAN_INTERVENTION_REQUIRED"


class AlertCreate(BaseModel):
    """Schema for creating a new alert."""

    source_type: AlertSourceType
    source_id: UUID | None = Field(
        default=None,
        description="ID of the source record (anomaly, security event, etc.).",
    )
    workstation_id: UUID | None = Field(
        default=None,
        description="ID of the affected workstation.",
    )
    severity: AlertSeverity
    title: str = Field(..., min_length=1, max_length=256)
    description: str = Field(..., max_length=4096)
    requires_human_intervention: bool = Field(
        default=False,
        description="Whether this alert exceeds autonomous parameters and requires human approval.",
    )
    recommendation: str | None = Field(
        default=None,
        max_length=4096,
        description="Actionable operational advice or predictive maintenance guidance.",
    )
    playbook_initiated: str | None = Field(
        default=None,
        max_length=64,
        description="Identifier of the SOAR playbook dispatched or queued.",
    )


class AlertResolve(BaseModel):
    """Optional schema for resolving an alert."""

    notes: str | None = Field(
        default=None,
        max_length=1024,
        description="Resolution notes recorded by operator or SOAR.",
    )


class AlertApprove(BaseModel):
    """Schema for operator authorizing a held action requiring human intervention."""

    notes: str | None = Field(
        default=None,
        max_length=1024,
        description="Operator approval remarks for audit trail.",
    )


class AlertResponse(BaseModel):
    """Schema for alert data in API responses."""

    id: UUID
    source_type: AlertSourceType | str
    source_id: UUID | None = None
    workstation_id: UUID | None = None
    severity: AlertSeverity
    status: AlertStatus
    title: str
    description: str
    requires_human_intervention: bool = False
    recommendation: str | None = None
    playbook_initiated: str | None = None
    created_at: datetime
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None

    model_config = {"from_attributes": True}
