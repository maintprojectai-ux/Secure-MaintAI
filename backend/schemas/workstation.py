"""
Secure-MaintAI — Workstation and Agent Schemas.

Defines the canonical workstation contract and agent communication schemas.
Per engineering rules Section 9 and implementation plan Sections 7 & 8.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class WorkstationStatus(str, Enum):
    """Workstation operational status."""

    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    MAINTENANCE = "MAINTENANCE"
    COMPROMISED = "COMPROMISED"
    DECOMMISSIONED = "DECOMMISSIONED"
    ISOLATED = "ISOLATED"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class WorkstationCreate(BaseModel):
    """Schema for creating/registering a workstation."""

    hostname: str = Field(..., min_length=1, max_length=255)
    ip_address: str = Field(..., max_length=45)
    operating_system: str = Field(..., max_length=128)
    department: str | None = Field(default=None, max_length=128)
    lab: str | None = Field(default=None, max_length=128)
    agent_version: str | None = Field(default=None, max_length=32)


class WorkstationUpdate(BaseModel):
    """Schema for updating workstation metadata or status."""

    department: str | None = Field(default=None, max_length=128)
    lab: str | None = Field(default=None, max_length=128)
    status: WorkstationStatus | None = None


class AgentRegisterRequest(BaseModel):
    """Schema for agent enrollment."""

    hostname: str = Field(..., min_length=1, max_length=255)
    ip_address: str = Field(..., min_length=1, max_length=45)
    mac_address: str | None = Field(default=None, max_length=30)
    operating_system: str = Field(..., min_length=1, max_length=128)
    department: str | None = Field(default=None, max_length=128)
    lab: str | None = Field(default=None, max_length=128)
    agent_version: str = Field(default="1.0.0", max_length=32)
    hardware_specs: dict[str, Any] | None = None


class AgentRegisterResponse(BaseModel):
    """Response returned upon successful agent registration."""

    workstation_id: UUID
    agent_id: UUID
    token: str
    heartbeat_interval_seconds: int = 60
    collection_interval_seconds: int = 10


class AgentHeartbeatRequest(BaseModel):
    """Schema for periodic agent liveness ping."""

    agent_id: UUID
    agent_version: str = Field(default="1.0.0", max_length=32)
    status: WorkstationStatus = WorkstationStatus.ONLINE
    cpu_usage: float | None = Field(default=None, ge=0.0, le=100.0)
    memory_usage: float | None = Field(default=None, ge=0.0, le=100.0)


class AgentHeartbeatResponse(BaseModel):
    """Response returned from heartbeat endpoint."""

    status: str = "acknowledged"
    acknowledged_at: datetime
    commands: list[str] = Field(default_factory=list)


class WorkstationResponse(BaseModel):
    """Schema for workstation data in API responses."""

    id: UUID
    hostname: str
    asset_tag: str | None = None
    agent_id: UUID | None = None
    ip_address: str
    mac_address: str | None = None
    operating_system: str
    department: str | None = None
    lab: str | None = None
    status: WorkstationStatus
    agent_version: str | None = None
    hardware_specs: dict[str, Any] | None = None
    last_seen_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkstationPaginatedResponse(BaseModel):
    """Paginated workstation listing response."""

    items: list[WorkstationResponse]
    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1)
    total_pages: int = Field(..., ge=0)
