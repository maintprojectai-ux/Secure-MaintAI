"""
Secure-MaintAI — Health and Readiness Endpoints.

Per engineering rules Section 30: /health and /ready endpoints.
These are unauthenticated — infrastructure must be able to probe them.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.database import get_async_session
from backend.core.logging import get_logger
from backend.schemas.health import ComponentHealth, HealthResponse, ReadyResponse

router = APIRouter()
logger = get_logger("health")


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application health check",
    description="Returns the health status of the application and its components.",
)
async def health_check() -> HealthResponse:
    """
    Basic health check. Returns application status without
    requiring database connectivity (liveness probe).
    """
    settings = get_settings()
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        environment=settings.app_env.value,
        timestamp=datetime.now(timezone.utc),
        components=[
            ComponentHealth(name="api", status="healthy"),
        ],
    )


@router.get(
    "/ready",
    response_model=ReadyResponse,
    summary="Application readiness check",
    description="Checks that all dependencies are available (readiness probe).",
)
async def readiness_check(
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> ReadyResponse:
    """
    Readiness check. Verifies that the database is accessible.
    Returns ready=False if any critical dependency is unavailable.
    """
    checks: dict[str, bool] = {}

    # Database check
    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = True
    except (SQLAlchemyError, Exception) as exc:  # noqa: BLE001
        logger.warning("readiness_db_check_failed", error=str(exc))
        checks["database"] = False

    all_ready = all(checks.values())

    return ReadyResponse(
        ready=all_ready,
        checks=checks,
    )
