"""
Secure-MaintAI — University Identity Provider (IdP) Context Resolver Service.

Per engineering rules Section 18:
- Resolves contextual identity information: user_id, role, department, lab, status.
- Differentiates STUDENT vs RESEARCHER vs IT_OPERATOR vs ADMIN context.
- Maintains TTL-bounded cache. Never treats cached identity context as permanently valid.
- Gracefully handles IdP outages with a safe fallback context (Rule 18, 25, 29 Scenario 5).
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.logging import get_logger
from backend.models.user import UserAccount
from backend.models.workstation import Workstation
from backend.schemas.idp import (
    AuthorizedWorkload,
    IdPIdentityContext,
    IdPWorkstationContext,
)

logger = get_logger("idp_service")


class IdPService:
    """
    Identity Provider context resolver with caching, workload tracking,
    and fail-soft fallback during directory service outages.
    """

    def __init__(self, cache_ttl_seconds: int = 300) -> None:
        self._cache_ttl_seconds = cache_ttl_seconds
        # In-memory context cache: key -> (IdPIdentityContext, timestamp)
        self._user_cache: dict[str, tuple[IdPIdentityContext, datetime]] = {}
        self._workstation_cache: dict[str, tuple[IdPWorkstationContext, datetime]] = {}
        # Registered active research workloads: workstation_id_str -> list[AuthorizedWorkload]
        self._active_workloads: dict[str, list[AuthorizedWorkload]] = {}
        # Pre-configured directory profiles for mock/testing
        self._mock_directory: dict[str, IdPIdentityContext] = {}
        # Outage simulation flag
        self._outage_mode: bool = False

    def set_outage_mode(self, enabled: bool) -> None:
        """Enable or disable simulated IdP outage for testing and resilience verification."""
        self._outage_mode = enabled
        logger.warning("idp_outage_mode_changed", outage_mode=enabled)

    def register_mock_user(self, context: IdPIdentityContext) -> None:
        """Register a user profile in the simulated IdP directory."""
        self._mock_directory[str(context.user_id)] = context
        self._mock_directory[context.username] = context

    def register_workload(self, workload: AuthorizedWorkload) -> None:
        """Register an active authorized compute workload for a workstation."""
        if workload.workstation_id is not None:
            key = str(workload.workstation_id)
            if key not in self._active_workloads:
                self._active_workloads[key] = []
            self._active_workloads[key].append(workload)
            logger.info(
                "idp_workload_registered",
                job_id=workload.job_id,
                workstation_id=key,
                workload_type=workload.workload_type.value,
            )

    def clear_cache(self) -> None:
        """Flush the identity cache."""
        self._user_cache.clear()
        self._workstation_cache.clear()

    async def get_user_context(
        self,
        user_id: UUID | str,
        session: AsyncSession | None = None,
    ) -> IdPIdentityContext:
        """
        Resolve contextual user profile. Checks directory/DB.
        Falls back safely to conservative default context if IdP is unreachable.
        """
        user_key = str(user_id)
        now = datetime.now(timezone.utc)

        # 1. Check if IdP is in outage mode -> Return safe fallback
        if self._outage_mode:
            logger.warning("idp_outage_active_returning_fallback", user_id=user_key)
            return self._build_fallback_context(user_key)

        # 2. Check TTL cache
        if user_key in self._user_cache:
            cached_ctx, cached_at = self._user_cache[user_key]
            age = (now - cached_at).total_seconds()
            if age < cached_ctx.ttl_seconds:
                return cached_ctx

        # 3. Check mock directory
        if user_key in self._mock_directory:
            ctx = self._mock_directory[user_key].model_copy()
            ctx.resolved_at = now
            self._user_cache[user_key] = (ctx, now)
            return ctx

        # 4. If DB session provided, resolve from local UserAccount and Role
        if session is not None:
            try:
                try:
                    parsed_uuid = UUID(user_key)
                except ValueError:
                    parsed_uuid = None

                query = select(UserAccount).options(selectinload(UserAccount.role))
                if parsed_uuid:
                    query = query.where(UserAccount.id == parsed_uuid)
                else:
                    query = query.where(UserAccount.username == user_key)

                result = await session.execute(query)
                user_record = result.scalar_one_or_none()

                if user_record is not None:
                    role_name = user_record.role.name if user_record.role else "STUDENT"
                    ctx = IdPIdentityContext(
                        user_id=str(user_record.id),
                        username=user_record.username,
                        email=user_record.email,
                        role=role_name,
                        department="Computer Science",
                        lab="Academic Lab",
                        status="ACTIVE" if user_record.status == "active" else "INACTIVE",
                        active_workloads=[],
                        is_fallback=False,
                        resolved_at=now,
                        ttl_seconds=self._cache_ttl_seconds,
                    )
                    self._user_cache[user_key] = (ctx, now)
                    return ctx
            except Exception as exc:
                logger.error("idp_db_lookup_failed", error=str(exc), user_id=user_key)

        # 5. Default safe context
        return self._build_fallback_context(user_key)

    async def get_workstation_context(
        self,
        workstation_id: UUID,
        session: AsyncSession | None = None,
    ) -> IdPWorkstationContext:
        """
        Resolve workstation identity, assigned lab, environment type,
        and currently running authorized workloads.
        """
        ws_key = str(workstation_id)
        now = datetime.now(timezone.utc)

        # Check TTL cache
        if ws_key in self._workstation_cache:
            cached_ctx, cached_at = self._workstation_cache[ws_key]
            if (now - cached_at).total_seconds() < 300:
                return cached_ctx

        active_workloads = self._active_workloads.get(ws_key, [])

        hostname = f"ws-{ws_key[:8]}"
        department = "Computer Science"
        lab = "Research Cluster"
        env_type = "RESEARCH_LAB"

        if session is not None:
            try:
                res = await session.execute(select(Workstation).where(Workstation.id == workstation_id))
                ws = res.scalar_one_or_none()
                if ws is not None:
                    hostname = ws.hostname
                    department = ws.department or department
                    lab = ws.lab or lab
                    if "student" in hostname.lower() or "lab" in (lab or "").lower():
                        env_type = "STUDENT_LAB"
                    elif "server" in hostname.lower() or "dc" in (lab or "").lower():
                        env_type = "SERVER_ROOM"
                    else:
                        env_type = "RESEARCH_LAB"
            except Exception as exc:
                logger.error("idp_workstation_lookup_failed", error=str(exc), ws_id=ws_key)

        ctx = IdPWorkstationContext(
            workstation_id=workstation_id,
            hostname=hostname,
            department=department,
            lab=lab,
            environment_type=env_type,
            active_workloads=active_workloads,
        )
        self._workstation_cache[ws_key] = (ctx, now)
        return ctx

    def _build_fallback_context(self, user_id: str) -> IdPIdentityContext:
        """Construct conservative fallback context during IdP outages (Rule 18, 25)."""
        return IdPIdentityContext(
            user_id=user_id,
            username=f"user-{user_id[:8]}",
            email=f"fallback-{user_id[:8]}@kku.edu.sa",
            role="STUDENT",  # Least privilege conservative default
            department="Unknown (IdP Offline)",
            lab=None,
            status="ACTIVE",
            active_workloads=[],
            is_fallback=True,
            resolved_at=datetime.now(timezone.utc),
            ttl_seconds=60,  # Short TTL during outage to recover quickly
        )


# Global singleton instance
idp_service = IdPService()
