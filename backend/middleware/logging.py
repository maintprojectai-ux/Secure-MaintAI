"""
Secure-MaintAI — Request Logging Middleware.

Logs every HTTP request with structured fields: method, path, status, duration.
Per engineering rules Section 24: use structured logs, never log sensitive data.
"""

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from backend.core.logging import get_logger

logger = get_logger("http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs HTTP requests with correlation IDs."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        start_time = time.perf_counter()

        response = await call_next(request)

        duration_ms = (time.perf_counter() - start_time) * 1000

        # Do not log health checks at DEBUG level to reduce noise
        log_level = (
            "debug"
            if request.url.path in ("/api/v1/health", "/api/v1/ready")
            else "info"
        )

        getattr(logger, log_level)(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
            correlation_id=correlation_id,
            client_ip=request.client.host if request.client else None,
        )

        response.headers["X-Correlation-ID"] = correlation_id
        return response
