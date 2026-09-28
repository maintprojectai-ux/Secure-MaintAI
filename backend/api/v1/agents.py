"""
Secure-MaintAI — Agent Enrollment and Heartbeat API.

Endpoints for registering workstation agents and receiving periodic health pings.
Per engineering rules Section 9 & 10: unique agent identity, liveness tracking.
"""

import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_async_session
from backend.core.security import create_access_token
from backend.models.workstation import Workstation
from backend.schemas.workstation import (
    AgentHeartbeatRequest,
    AgentHeartbeatResponse,
    AgentRegisterRequest,
    AgentRegisterResponse,
    WorkstationStatus,
)
from backend.services.audit import AuditService

router = APIRouter()


@router.post(
    "/register",
    response_model=AgentRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enroll a workstation and register its monitoring agent",
)
async def register_agent(
    payload: AgentRegisterRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AgentRegisterResponse:
    """
    Enroll a workstation with the platform:
    - Finds existing workstation by hostname or creates a new workstation record.
    - Generates a unique agent_id and authenticates the agent.
    - Returns credentials and operational collection intervals.
    """
    audit = AuditService(session)

    # Check if workstation already exists by hostname
    result = await session.execute(select(Workstation).where(Workstation.hostname == payload.hostname))
    workstation = result.scalar_one_or_none()

    new_agent_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    if workstation is None:
        workstation = Workstation(
            hostname=payload.hostname,
            agent_id=new_agent_id,
            ip_address=payload.ip_address,
            mac_address=payload.mac_address,
            operating_system=payload.operating_system,
            department=payload.department,
            lab=payload.lab,
            agent_version=payload.agent_version,
            hardware_specs=payload.hardware_specs,
            status=WorkstationStatus.ONLINE.value,
            last_seen_at=now,
        )
        session.add(workstation)
    else:
        # Update existing workstation record
        workstation.agent_id = new_agent_id
        workstation.ip_address = payload.ip_address
        if payload.mac_address:
            workstation.mac_address = payload.mac_address
        workstation.operating_system = payload.operating_system
        if payload.department:
            workstation.department = payload.department
        if payload.lab:
            workstation.lab = payload.lab
        workstation.agent_version = payload.agent_version
        if payload.hardware_specs:
            workstation.hardware_specs = payload.hardware_specs
        workstation.status = WorkstationStatus.ONLINE.value
        workstation.last_seen_at = now

    await session.flush()

    # Generate an agent communication token
    agent_token = create_access_token(
        subject=str(workstation.id),
        role="AGENT",
        extra_claims={"agent_id": str(new_agent_id), "type": "agent"},
    )

    await audit.log(
        actor=f"agent:{new_agent_id}",
        action="agent.register",
        resource=f"workstation:{workstation.id}",
        source_ip=request.client.host if request.client else payload.ip_address,
        result="success",
        metadata_={
            "hostname": payload.hostname,
            "ip_address": payload.ip_address,
            "os": payload.operating_system,
        },
    )
    await session.commit()

    return AgentRegisterResponse(
        workstation_id=workstation.id,
        agent_id=new_agent_id,
        token=agent_token,
        heartbeat_interval_seconds=60,
        collection_interval_seconds=10,
    )


@router.post(
    "/heartbeat",
    response_model=AgentHeartbeatResponse,
    summary="Agent periodic liveness ping",
)
async def agent_heartbeat(
    payload: AgentHeartbeatRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AgentHeartbeatResponse:
    """
    Receive heartbeat ping from registered agent.
    Updates the workstation's status and last_seen_at timestamp.
    """
    result = await session.execute(select(Workstation).where(Workstation.agent_id == payload.agent_id))
    workstation = result.scalar_one_or_none()

    if workstation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workstation with agent_id '{payload.agent_id}' not found.",
        )

    now = datetime.now(timezone.utc)
    workstation.last_seen_at = now
    workstation.status = payload.status.value
    workstation.agent_version = payload.agent_version

    await session.commit()

    return AgentHeartbeatResponse(
        status="acknowledged",
        acknowledged_at=now,
        commands=[],
    )


@router.post(
    "/check-liveness",
    summary="Scan for offline agents and create health alerts (Rule 29 Scenario 6)",
)
async def check_agent_liveness(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    threshold_seconds: int = 120,
) -> dict[str, Any]:
    """
    Identifies active workstations whose last heartbeat exceeds threshold_seconds,
    transitions their state to OFFLINE, and generates an AGENT_HEALTH alert.
    """
    from datetime import timedelta

    from backend.models.alert import Alert

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=threshold_seconds)
    result = await session.execute(
        select(Workstation).where(
            Workstation.status == WorkstationStatus.ONLINE.value,
            Workstation.last_seen_at < cutoff,
        )
    )
    offline_workstations = result.scalars().all()
    marked_count = 0

    for ws in offline_workstations:
        ws.status = WorkstationStatus.OFFLINE.value
        alert = Alert(
            source_type="AGENT_HEALTH",
            source_id=ws.id,
            severity="MEDIUM",
            status="OPEN",
            title=f"Workstation Offline: {ws.hostname}",
            description=(
                f"Agent on workstation '{ws.hostname}' ({ws.ip_address}) failed to report "
                f"heartbeat within {threshold_seconds}s threshold. Last seen at {ws.last_seen_at}."
            ),
        )
        session.add(alert)
        marked_count += 1

    await session.commit()
    return {
        "status": "success",
        "offline_count": marked_count,
        "affected_workstations": [ws.hostname for ws in offline_workstations],
    }
