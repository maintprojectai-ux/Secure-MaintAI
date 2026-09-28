"""
Secure-MaintAI — Anomaly Detection Schemas.

Defines the canonical anomaly contract.
Per engineering rules Section 16: classification outputs NORMAL, TECHNICAL_ANOMALY, SECURITY_ANOMALY
with confidence, severity, evidence, and model_version.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class AnomalyType(str, Enum):
    """Anomaly classification types per the project report."""

    NORMAL = "NORMAL"
    TECHNICAL_ANOMALY = "TECHNICAL_ANOMALY"
    SECURITY_ANOMALY = "SECURITY_ANOMALY"


class AnomalyStatus(str, Enum):
    """Anomaly lifecycle status."""

    DETECTED = "DETECTED"
    CONFIRMED = "CONFIRMED"
    DISMISSED = "DISMISSED"
    ESCALATED = "ESCALATED"


class AnomalyCreate(BaseModel):
    """Schema for creating an anomaly detection record."""

    workstation_id: UUID
    timestamp: datetime
    anomaly_type: AnomalyType
    score: float = Field(..., ge=0.0, le=1.0, description="Anomaly score (0-1).")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence (0-1).")
    model_name: str = Field(..., max_length=128)
    model_version: str = Field(..., max_length=32)
    features_snapshot: dict | None = Field(
        default=None,
        description="Snapshot of feature values used for this detection.",
    )
    evidence: list[str] = Field(
        default_factory=list,
        description="Human-readable evidence supporting the classification.",
    )


class AnomalyResponse(BaseModel):
    """Schema for anomaly data in API responses."""

    id: UUID
    workstation_id: UUID
    timestamp: datetime
    anomaly_type: AnomalyType
    score: float
    confidence: float
    model_name: str
    model_version: str
    features_snapshot: dict | None = None
    evidence: list[str] = Field(default_factory=list)
    status: AnomalyStatus
    created_at: datetime

    @field_validator("evidence", mode="before")
    @classmethod
    def _coerce_evidence(cls, v: Any) -> list[str]:
        if v is None:
            return []
        return v

    model_config = {"from_attributes": True}
