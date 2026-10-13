"""
Unit Tests — Identity Provider (IdP) Context Resolver Service.

Tests:
- Directory profile resolution for STUDENT, RESEARCHER, IT_OPERATOR.
- TTL-based caching boundaries and cache eviction.
- Active research workload registration and preservation metadata.
- Safe fail-soft fallback behavior during simulated IdP outages.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from backend.schemas.idp import (
    AuthorizedWorkload,
    IdPIdentityContext,
    WorkloadType,
)
from backend.services.idp_service import IdPService


@pytest.fixture
def clean_idp() -> IdPService:
    """Provide a fresh IdP service instance."""
    service = IdPService(cache_ttl_seconds=300)
    service.clear_cache()
    return service


@pytest.mark.asyncio
async def test_resolve_mock_user_profile(clean_idp: IdPService) -> None:
    """Resolving a registered mock user returns full identity context."""
    user_id = str(uuid.uuid4())
    prof = IdPIdentityContext(
        user_id=user_id,
        username="dr_turing",
        email="alan.turing@kku.edu.sa",
        role="RESEARCHER",
        department="Computer Science",
        lab="Quantum Computing Lab",
        status="ACTIVE",
    )
    clean_idp.register_mock_user(prof)

    ctx = await clean_idp.get_user_context(user_id)
    assert ctx.username == "dr_turing"
    assert ctx.role == "RESEARCHER"
    assert ctx.department == "Computer Science"
    assert ctx.is_fallback is False


@pytest.mark.asyncio
async def test_cache_hits_and_expiry(clean_idp: IdPService) -> None:
    """Cache returns valid context within TTL and evicts when expired."""
    user_id = str(uuid.uuid4())
    prof = IdPIdentityContext(
        user_id=user_id,
        username="student_ada",
        email="ada@kku.edu.sa",
        role="STUDENT",
        department="Engineering",
        ttl_seconds=2,
    )
    clean_idp.register_mock_user(prof)

    # First fetch -> cache populated
    ctx1 = await clean_idp.get_user_context(user_id)
    assert ctx1.username == "student_ada"

    # Simulate expired timestamp in cache
    expired_time = datetime.now(timezone.utc) - timedelta(seconds=10)
    clean_idp._user_cache[user_id] = (ctx1, expired_time)

    # Re-fetch -> fetches fresh from directory
    ctx2 = await clean_idp.get_user_context(user_id)
    assert ctx2.username == "student_ada"


@pytest.mark.asyncio
async def test_active_workload_registration(clean_idp: IdPService) -> None:
    """Workstation context includes registered active authorized compute jobs."""
    ws_id = uuid.uuid4()
    workload = AuthorizedWorkload(
        job_id="HPC-JOB-9021",
        workload_type=WorkloadType.HPC_SIMULATION,
        description="Fluid Dynamics Simulation 128-node",
        workstation_id=ws_id,
        authorized_processes=["python", "sim_fluids.py", "mpirun"],
        is_active=True,
    )
    clean_idp.register_workload(workload)

    ws_ctx = await clean_idp.get_workstation_context(ws_id)
    assert len(ws_ctx.active_workloads) == 1
    assert ws_ctx.active_workloads[0].job_id == "HPC-JOB-9021"
    assert ws_ctx.active_workloads[0].workload_type == WorkloadType.HPC_SIMULATION


@pytest.mark.asyncio
async def test_outage_mode_returns_safe_fallback_context(clean_idp: IdPService) -> None:
    """When IdP is down, safe fallback context with least privilege is returned."""
    clean_idp.set_outage_mode(True)

    ctx = await clean_idp.get_user_context("unknown-user-id-999")
    assert ctx.is_fallback is True
    assert ctx.role == "STUDENT"
    assert "IdP Offline" in ctx.department


@pytest.mark.asyncio
async def test_get_user_role(clean_idp: IdPService) -> None:
    """
    Identity resolution: Query known mock users and test fallback behaviour.
    Test Input: Mock Student, Researcher, and IT Operator accounts, simulated identity-provider unavailability.
    Expected Result: The service returns the expected context or a conservative fallback profile.
    """
    # 1. Mock Student Account
    student_id = str(uuid.uuid4())
    clean_idp.register_mock_user(
        IdPIdentityContext(
            user_id=student_id,
            username="student_01",
            email="student_01@kku.edu.sa",
            role="STUDENT",
            department="Computer Engineering",
        )
    )
    ctx_student = await clean_idp.get_user_context(student_id)
    print(f"\n[Identity Resolution] Student: user={ctx_student.username}, role={ctx_student.role}, dept={ctx_student.department}")
    assert ctx_student.role == "STUDENT"
    assert ctx_student.is_fallback is False

    # 2. Mock Researcher Account
    researcher_id = str(uuid.uuid4())
    clean_idp.register_mock_user(
        IdPIdentityContext(
            user_id=researcher_id,
            username="dr_researcher",
            email="dr_researcher@kku.edu.sa",
            role="RESEARCHER",
            department="AI Research Lab",
        )
    )
    ctx_researcher = await clean_idp.get_user_context(researcher_id)
    print(f"[Identity Resolution] Researcher: user={ctx_researcher.username}, role={ctx_researcher.role}, dept={ctx_researcher.department}")
    assert ctx_researcher.role == "RESEARCHER"
    assert ctx_researcher.is_fallback is False

    # 3. Mock IT Operator Account
    it_op_id = str(uuid.uuid4())
    clean_idp.register_mock_user(
        IdPIdentityContext(
            user_id=it_op_id,
            username="it_operator_01",
            email="it_operator_01@kku.edu.sa",
            role="IT_OPERATOR",
            department="Central IT Infrastructure",
        )
    )
    ctx_it_op = await clean_idp.get_user_context(it_op_id)
    print(f"[Identity Resolution] IT Operator: user={ctx_it_op.username}, role={ctx_it_op.role}, dept={ctx_it_op.department}")
    assert ctx_it_op.role == "IT_OPERATOR"
    assert ctx_it_op.is_fallback is False

    # 4. Simulated Identity-Provider Unavailability (Outage Fallback)
    import logging
    logging.disable(logging.WARNING)
    try:
        clean_idp.set_outage_mode(True)
        fallback_ctx = await clean_idp.get_user_context("user-during-outage-01")
        print(f"[Identity Resolution] Outage Fallback: role={fallback_ctx.role}, dept={fallback_ctx.department}, is_fallback={fallback_ctx.is_fallback}")
        assert fallback_ctx.role == "STUDENT"
        assert fallback_ctx.is_fallback is True
        assert "IdP Offline" in fallback_ctx.department
    finally:
        clean_idp.set_outage_mode(False)
        logging.disable(logging.NOTSET)
