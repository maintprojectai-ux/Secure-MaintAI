"""
Secure-MaintAI — Endpoint Monitoring Agent Configuration.

Stores runtime configuration, agent identity, collection intervals,
and local disk buffer settings.
Per engineering rules Section 9: lightweight, privacy-by-design, resource-capped.
"""

import json
import os
from pathlib import Path
from uuid import UUID

from pydantic import BaseModel, Field


class AgentConfig(BaseModel):
    """Configuration settings for the monitoring agent."""

    # Backend Connection
    backend_url: str = Field(
        default="http://127.0.0.1:8000/api/v1", description="Backend API base URL"
    )
    timeout_seconds: float = Field(
        default=30.0, description="HTTP request timeout in seconds"
    )
    max_retries: int = Field(
        default=3, description="Maximum HTTP retry attempts with exponential backoff"
    )

    # Agent Identity (persisted across restarts once registered)
    agent_id: UUID | None = Field(
        default=None, description="Unique agent identifier assigned by backend"
    )
    workstation_id: UUID | None = Field(
        default=None, description="Workstation UUID assigned by backend"
    )
    auth_token: str | None = Field(
        default=None, description="Authentication token for agent API communication"
    )

    # Metadata
    department: str | None = Field(default=None, description="Department name")
    lab: str | None = Field(default=None, description="Lab or room identifier")
    agent_version: str = Field(default="1.0.0", description="Agent software version")

    # Collection Intervals
    collection_interval_seconds: int = Field(
        default=10, ge=1, le=3600, description="Telemetry collection interval"
    )
    heartbeat_interval_seconds: int = Field(
        default=60, ge=5, le=86400, description="Heartbeat ping interval"
    )

    # Local Disk Buffer (survives network outages)
    buffer_directory: str = Field(
        default=".agent_buffer",
        description="Directory to store offline telemetry records",
    )
    max_buffer_size_mb: int = Field(
        default=50, ge=5, le=500, description="Maximum disk buffer size in MB"
    )
    max_batch_size: int = Field(
        default=50, ge=1, le=500, description="Max records to flush per transmission"
    )

    # State File Path
    state_file_path: str = Field(
        default=".agent_state.json", description="Local file saving agent identity"
    )


def load_agent_config(env_prefix: str = "AGENT_") -> AgentConfig:
    """
    Load agent configuration from environment variables,
    falling back to local state file if already registered.
    """
    config = AgentConfig(
        backend_url=os.getenv(
            f"{env_prefix}BACKEND_URL", "http://127.0.0.1:8000/api/v1"
        ),
        department=os.getenv(f"{env_prefix}DEPARTMENT", None),
        lab=os.getenv(f"{env_prefix}LAB", None),
        collection_interval_seconds=int(
            os.getenv(f"{env_prefix}COLLECTION_INTERVAL", "10")
        ),
        heartbeat_interval_seconds=int(
            os.getenv(f"{env_prefix}HEARTBEAT_INTERVAL", "60")
        ),
        buffer_directory=os.getenv(f"{env_prefix}BUFFER_DIR", ".agent_buffer"),
        max_buffer_size_mb=int(os.getenv(f"{env_prefix}MAX_BUFFER_MB", "50")),
        state_file_path=os.getenv(f"{env_prefix}STATE_FILE", ".agent_state.json"),
    )

    # Load persisted agent_id, workstation_id, and auth_token from state file if present
    state_path = Path(config.state_file_path)
    if state_path.exists():
        try:
            with open(state_path, encoding="utf-8") as f:
                state = json.load(f)
                if state.get("agent_id"):
                    config.agent_id = UUID(state["agent_id"])
                if state.get("workstation_id"):
                    config.workstation_id = UUID(state["workstation_id"])
                if state.get("auth_token"):
                    config.auth_token = state["auth_token"]
        except (json.JSONDecodeError, OSError, ValueError):
            pass

    return config


def save_agent_state(config: AgentConfig) -> None:
    """Save agent identity and credentials to local state file."""
    state = {
        "agent_id": str(config.agent_id) if config.agent_id else None,
        "workstation_id": str(config.workstation_id) if config.workstation_id else None,
        "auth_token": config.auth_token,
        "agent_version": config.agent_version,
    }
    state_path = Path(config.state_file_path)
    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
