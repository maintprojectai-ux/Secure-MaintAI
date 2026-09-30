"""
Secure-MaintAI — Maintenance Subsystem Schemas.

Defines data contracts for predictive maintenance tasks, work orders,
and fleet maintenance indicators.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MaintenanceTaskResponse(BaseModel):
    """Schema representing a maintenance task or advisory in the API."""

    id: UUID
    title: str
    workstation_id: UUID | None = None
    workstation_hostname: str = "Unknown"
    department: str = "IT Infrastructure"
    status: str = "Scheduled"  # Scheduled, In Progress, Completed, Overdue
    scheduled_time: datetime
    duration: str = "1h 30m"
    duration_minutes: int = 90
    assigned_to: str = "Hardware Support"
    priority: str = "Medium"  # Low, Medium, High, Critical
    category: str = "System"  # System, Database, Network, Backup, Security, Application, Virtualization
    description: str = ""
    affected_systems: list[str] = Field(default_factory=list)
    incident_number: str | None = None

    model_config = {"from_attributes": True}


class MaintenanceTaskCreate(BaseModel):
    """Schema for scheduling a new predictive or routine maintenance task."""

    title: str = Field(..., min_length=3, max_length=256)
    workstation_id: UUID | None = None
    category: str = Field(default="System", max_length=64)
    priority: str = Field(default="Medium", max_length=32)
    scheduled_time: datetime | None = None
    duration_minutes: int = Field(default=60, ge=15, le=1440)
    description: str = Field(default="", max_length=2048)
    assigned_to: str = Field(default="Hardware Support", max_length=128)


class MaintenanceStatusUpdate(BaseModel):
    """Schema for updating maintenance task execution status."""

    status: str = Field(..., max_length=32, description="Completed, In Progress, Scheduled, Overdue, Cancelled")
    notes: str | None = Field(default=None, max_length=1024)


class MaintenanceKPIsResponse(BaseModel):
    """Aggregated KPIs for the maintenance dashboard."""

    scheduled_today: int
    in_progress: int
    completed_this_week: int
    overdue: int
    system_health_score: float
