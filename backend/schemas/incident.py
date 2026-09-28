"""
Secure-MaintAI — Incident Schemas.

Defines the canonical incident contract.
Per implementation plan Section 21: every incident contains severity, source,
affected workstation/user, evidence, detection model, confidence, response action,
responder, timestamps, resolution.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class IncidentSeverity(str, Enum):
    """Incident severity levels."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentCategory(str, Enum):
    """Incident categories based on the project report."""

    TECHNICAL_FAILURE = "TECHNICAL_FAILURE"
    SECURITY_THREAT = "SECURITY_THREAT"
    POLICY_VIOLATION = "POLICY_VIOLATION"
    MAINTENANCE = "MAINTENANCE"
    OTHER = "OTHER"


class IncidentStatus(str, Enum):
    """Incident lifecycle states."""

    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    CONTAINED = "CONTAINED"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class IncidentCreate(BaseModel):
    """Schema for creating a new incident."""

    severity: IncidentSeverity
    category: IncidentCategory
    workstation_id: UUID | None = None
    user_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=256)
    description: str = Field(..., max_length=4096)
    response_action: str | None = Field(default=None, max_length=1024)


class IncidentResponse(BaseModel):
    """Schema for incident data in API responses."""

    id: UUID
    incident_number: str
    severity: IncidentSeverity
    category: IncidentCategory
    workstation_id: UUID | None = None
    user_id: UUID | None = None
    status: IncidentStatus
    title: str
    description: str
    response_action: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None

    model_config = {"from_attributes": True}
