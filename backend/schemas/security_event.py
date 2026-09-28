"""
Secure-MaintAI — Security Event Schemas.

Defines the canonical security event contract.
Per engineering rules Section 17: normalized internal schema with event_id,
timestamp, source, workstation, user, event_type, severity, confidence,
evidence, correlation_id.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class SecurityEventSeverity(str, Enum):
    """Security event severity levels."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SecurityEventType(str, Enum):
    """Security event type categories."""

    AUTHENTICATION_FAILURE = "AUTHENTICATION_FAILURE"
    PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION"
    SUSPICIOUS_PROCESS = "SUSPICIOUS_PROCESS"
    NETWORK_ANOMALY = "NETWORK_ANOMALY"
    DATA_EXFILTRATION = "DATA_EXFILTRATION"
    MALWARE_DETECTED = "MALWARE_DETECTED"
    CRYPTOJACKING = "CRYPTOJACKING"
    UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS"
    POLICY_VIOLATION = "POLICY_VIOLATION"
    OTHER = "OTHER"


class SecurityEventCreate(BaseModel):
    """Schema for creating a security event."""

    timestamp: datetime
    source: str = Field(
        ...,
        max_length=128,
        description="Source system that generated the event (e.g., 'ml-engine', 'siem').",
    )
    workstation_id: UUID | None = None
    user_id: UUID | None = None
    event_type: SecurityEventType
    severity: SecurityEventSeverity
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence in this event's validity."
    )
    description: str = Field(..., max_length=2048)
    evidence: list[str] = Field(default_factory=list)
    raw_event_reference: str | None = Field(
        default=None,
        max_length=512,
        description="Reference to the original raw event for traceability.",
    )
    correlation_id: UUID | None = Field(
        default=None,
        description="ID linking related events across the pipeline.",
    )


class SecurityEventResponse(BaseModel):
    """Schema for security event data in API responses."""

    id: UUID
    timestamp: datetime
    source: str
    workstation_id: UUID | None = None
    user_id: UUID | None = None
    event_type: SecurityEventType
    severity: SecurityEventSeverity
    confidence: float
    description: str
    evidence: list[str] = Field(default_factory=list)
    raw_event_reference: str | None = None
    correlation_id: UUID | None = None
    created_at: datetime

    @field_validator("evidence", mode="before")
    @classmethod
    def _coerce_evidence(cls, v: Any) -> list[str]:
        if v is None:
            return []
        return v

    model_config = {"from_attributes": True}
