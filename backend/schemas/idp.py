"""
Secure-MaintAI — Identity Provider (IdP) Schemas.

Per engineering rules Section 18:
- Provides contextual identity information (user_id, role, department, lab, group, status).
- Captures active authorized workloads for legitimate research compute.
- Enforces TTL-based caching boundaries and fail-safe fallback flags.
"""

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class WorkloadType(str, Enum):
    """Types of authorized workloads running on university workstations/clusters."""

    HPC_SIMULATION = "HPC_SIMULATION"
    MODEL_TRAINING = "MODEL_TRAINING"
    COURSEWORK = "COURSEWORK"
    BATCH_PROCESSING = "BATCH_PROCESSING"
    SYSTEM_MAINTENANCE = "SYSTEM_MAINTENANCE"
    NONE = "NONE"


class AuthorizedWorkload(BaseModel):
    """Context for an active, authorized compute job."""

    job_id: str = Field(..., description="Unique job or reservation identifier.")
    workload_type: WorkloadType = Field(default=WorkloadType.HPC_SIMULATION)
    description: str = Field(..., max_length=512)
    workstation_id: UUID | None = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expected_end_at: datetime | None = None
    authorized_processes: list[str] = Field(
        default_factory=list,
        description="List of allowed binary or script names (e.g. ['python', 'torchrun', 'simulation.exe']).",
    )
    is_active: bool = True
    priority: str = Field(default="NORMAL", description="NORMAL, HIGH, CRITICAL")
    expected_cpu_percent: float | None = Field(default=None, description="Expected CPU threshold for reservation.")
    expected_ram_mb: float | None = Field(default=None, description="Expected memory allocation in MB.")
    approved_by: str | None = Field(default=None, description="Authority approving the workload.")


class IdPIdentityContext(BaseModel):
    """Contextual identity profile resolved from the university IdP / Directory."""

    user_id: str = Field(..., description="University user identifier or UUID.")
    username: str = Field(..., max_length=64)
    email: str = Field(..., max_length=256)
    role: str = Field(
        ...,
        description="University role: 'STUDENT', 'RESEARCHER', 'IT_OPERATOR', 'ADMIN'",
    )
    department: str = Field(..., max_length=128)
    lab: str | None = Field(default=None, max_length=128)
    status: str = Field(default="ACTIVE", description="ACTIVE, SUSPENDED, INACTIVE")
    active_workloads: list[AuthorizedWorkload] = Field(default_factory=list)
    is_fallback: bool = Field(
        default=False,
        description="True if generated from fail-safe cache/defaults during IdP outage.",
    )
    resolved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ttl_seconds: int = Field(default=300, ge=1, le=86400)


class IdPWorkstationContext(BaseModel):
    """Contextual mapping linking a workstation to its assigned lab and primary user."""

    workstation_id: UUID
    hostname: str
    department: str
    lab: str | None = None
    environment_type: str = Field(
        default="RESEARCH_LAB",
        description="RESEARCH_LAB, STUDENT_LAB, SERVER_ROOM, ADMINISTRATIVE",
    )
    assigned_user: IdPIdentityContext | None = None
    active_workloads: list[AuthorizedWorkload] = Field(default_factory=list)
