"""
Secure-MaintAI — Health and Readiness Schemas.

Per engineering rules Section 30: /health and /ready endpoints.
"""

from datetime import datetime

from pydantic import BaseModel


class ComponentHealth(BaseModel):
    """Health status of a system component."""

    name: str
    status: str  # "healthy", "unhealthy", "degraded"
    details: str | None = None


class HealthResponse(BaseModel):
    """Response schema for the /health endpoint."""

    status: str  # "healthy", "unhealthy", "degraded"
    version: str
    environment: str
    timestamp: datetime
    components: list[ComponentHealth] = []


class ReadyResponse(BaseModel):
    """Response schema for the /ready endpoint."""

    ready: bool
    checks: dict[str, bool] = {}
