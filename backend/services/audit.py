"""
Secure-MaintAI — Audit Logging Service.

Creates immutable audit entries for all privileged operations.
Per implementation plan Section 23: every privileged operation creates an audit entry.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.logging import get_logger
from backend.models.audit import AuditLog

logger = get_logger("audit")


class AuditService:
    """
    Service for creating audit log entries.

    Usage:
        audit = AuditService(session)
        await audit.log(
            actor="user:abc-123",
            action="user.login",
            resource="user:abc-123",
            result="success",
        )
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def log(
        self,
        *,
        actor: str,
        action: str,
        resource: str,
        result: str,
        source_ip: str | None = None,
        correlation_id: uuid.UUID | None = None,
        metadata_: dict | None = None,
    ) -> AuditLog:
        """
        Create an audit log entry.

        Args:
            actor: User or system identity that performed the action.
            action: Action performed (e.g., 'user.login', 'incident.create').
            resource: Resource affected (e.g., 'user:abc-123').
            result: Outcome: 'success', 'failure', 'denied'.
            source_ip: Source IP address of the request.
            correlation_id: Correlation ID for tracing related events.
            metadata_: Additional non-sensitive context.

        Returns:
            The created AuditLog entry.
        """
        entry = AuditLog(
            actor=actor,
            action=action,
            resource=resource,
            result=result,
            source_ip=source_ip,
            correlation_id=correlation_id,
            metadata_=metadata_,
        )
        self._session.add(entry)

        logger.info(
            "audit_event",
            actor=actor,
            action=action,
            resource=resource,
            result=result,
        )

        return entry
