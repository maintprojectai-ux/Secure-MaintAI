"""
Secure-MaintAI — FastAPI Application Entry Point.

Creates and configures the FastAPI application with:
- Structured logging
- CORS middleware
- Request logging middleware
- API router mounting
- Health endpoints
- Error handlers
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.v1.router import api_v1_router
from backend.core.config import get_settings
from backend.core.logging import get_logger, setup_logging
from backend.middleware.logging import RequestLoggingMiddleware

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifecycle manager."""
    settings = get_settings()
    setup_logging(
        log_level=settings.app_log_level,
        json_format=settings.is_production,
    )
    logger.info(
        "application_starting",
        app_name=settings.app_name,
        environment=settings.app_env.value,
    )
    # Initialize ML runtime pipeline
    try:
        from backend.services import ml_pipeline_service
        ml_pipeline_service.initialise()
    except Exception as exc:
        logger.warning("ml_initialization_failed", error=str(exc))
    yield
    logger.info("application_shutting_down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description=(
            "AI-driven university infrastructure resilience platform. "
            "Continuous telemetry collection, ML anomaly detection, "
            "technical-vs-cyber classification, and controlled SOAR response."
        ),
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Request logging ---
    app.add_middleware(RequestLoggingMiddleware)

    # --- API routes ---
    app.include_router(api_v1_router, prefix=settings.api_prefix)

    # --- Error handlers ---
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": str(exc)},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        # Never expose internal details per engineering rules Section 7
        logger.error(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            error_type=type(exc).__name__,
            # Do NOT log exc details that might contain sensitive info
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error."},
        )

    return app


app = create_app()
