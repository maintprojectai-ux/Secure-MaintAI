"""
Secure-MaintAI — API v1 Router.

Aggregates all v1 sub-routers.
Per engineering rules Section 7: versioned APIs at /api/v1/...
"""

from fastapi import APIRouter

from backend.api.v1.agents import router as agents_router
from backend.api.v1.alerts import router as alerts_router
from backend.api.v1.auth import router as auth_router
from backend.api.v1.dashboard import router as dashboard_router
from backend.api.v1.demo import router as demo_router
from backend.api.v1.health import router as health_router
from backend.api.v1.incidents import router as incidents_router
from backend.api.v1.policy import router as policy_router
from backend.api.v1.security import router as security_router
from backend.api.v1.telemetry import router as telemetry_router
from backend.api.v1.users import router as users_router
from backend.api.v1.workstations import router as workstations_router

api_v1_router = APIRouter()

# Health endpoints (no auth required)
api_v1_router.include_router(health_router, tags=["health"])

# Authentication endpoints
api_v1_router.include_router(auth_router, prefix="/auth", tags=["authentication"])

# Dashboard live KPIs and research validation metrics
api_v1_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])

# Live demonstration authentic trigger pipeline
api_v1_router.include_router(demo_router, prefix="/demo", tags=["demo"])

# User management endpoints (authenticated & RBAC)
api_v1_router.include_router(users_router, prefix="/users", tags=["users"])

# Agent enrollment and heartbeat endpoints
api_v1_router.include_router(agents_router, prefix="/agents", tags=["agents"])

# Telemetry ingestion and query endpoints
api_v1_router.include_router(telemetry_router, prefix="/telemetry", tags=["telemetry"])

# Security events and correlation endpoints
api_v1_router.include_router(security_router, prefix="/security", tags=["security"])

# Alert management endpoints
api_v1_router.include_router(alerts_router, prefix="/alerts", tags=["alerts"])

# Incident management endpoints
api_v1_router.include_router(incidents_router, prefix="/incidents", tags=["incidents"])

# Policy evaluation and SOAR triggers
api_v1_router.include_router(policy_router, prefix="/policy", tags=["policy"])

# Workstation inventory and device management endpoints
api_v1_router.include_router(
    workstations_router, prefix="/workstations", tags=["workstations"]
)
