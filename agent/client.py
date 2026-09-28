"""
Secure-MaintAI — Agent HTTP/TLS Transport Client.

Handles secure communication with the backend API:
- Workstation registration
- Periodic heartbeat
- Batch/single telemetry transmission
- Exponential backoff retry logic

Per engineering rules Section 9: secure transport, authenticated agent sessions.
"""

import asyncio
import logging
from typing import Any
from uuid import UUID

import httpx

try:
    from agent.config import AgentConfig
except ModuleNotFoundError:
    from config import AgentConfig  # type: ignore[no-redef]

logger = logging.getLogger("agent.client")


class AgentClient:
    """HTTP client for agent-backend communication."""

    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self.base_url = config.backend_url.rstrip("/")

    def _get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config.auth_token:
            headers["Authorization"] = f"Bearer {self.config.auth_token}"
        return headers

    async def register(self, system_info: dict[str, Any]) -> dict[str, Any]:
        """
        Enroll workstation and agent with the backend.
        Returns registration details including agent_id and auth_token.
        """
        url = f"{self.base_url}/agents/register"
        payload = {
            "hostname": system_info["hostname"],
            "ip_address": system_info["ip_address"],
            "mac_address": system_info.get("mac_address"),
            "operating_system": system_info["operating_system"],
            "department": self.config.department,
            "lab": self.config.lab,
            "agent_version": self.config.agent_version,
            "hardware_specs": system_info.get("hardware_specs"),
        }

        async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json()

    async def send_heartbeat(
        self,
        agent_id: UUID,
        cpu_usage: float | None = None,
        memory_usage: float | None = None,
    ) -> int:
        """
        Send a periodic liveness heartbeat ping.

        Returns:
            HTTP status code (e.g. 200 on success, 404 if agent unrecognized, 0 on network failure).
        """
        url = f"{self.base_url}/agents/heartbeat"
        payload = {
            "agent_id": str(agent_id),
            "agent_version": self.config.agent_version,
            "status": "ONLINE",
            "cpu_usage": cpu_usage,
            "memory_usage": memory_usage,
        }

        try:
            async with httpx.AsyncClient(
                timeout=self.config.timeout_seconds, headers=self._get_headers()
            ) as client:
                response = await client.post(url, json=payload)
                return response.status_code
        except (httpx.HTTPError, OSError) as exc:
            logger.warning("Heartbeat failed: %s", exc)
            return 0

    async def send_telemetry_batch(
        self, records: list[dict[str, Any]]
    ) -> tuple[bool, int]:
        """
        Transmit a batch of telemetry records to the backend.

        Returns:
            Tuple of (success: bool, processed_count: int).
        """
        if not records:
            return True, 0

        url = f"{self.base_url}/telemetry/batch"
        payload = {"items": records}

        for attempt in range(1, self.config.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=self.config.timeout_seconds, headers=self._get_headers()
                ) as client:
                    response = await client.post(url, json=payload)
                    if response.status_code in (200, 201):
                        data = response.json()
                        return True, data.get("processed_count", len(records))
                    elif response.status_code == 422:
                        logger.error(
                            "Telemetry payload validation failed: %s", response.text
                        )
                        # Invalid data format; do not retry permanently
                        return False, 0
            except (
                httpx.ConnectError,
                httpx.TimeoutException,
                httpx.NetworkError,
            ) as exc:
                logger.warning(
                    "Network error transmitting telemetry (attempt %d/%d): %s",
                    attempt,
                    self.config.max_retries,
                    exc,
                )
                if attempt < self.config.max_retries:
                    backoff = 2**attempt
                    await asyncio.sleep(backoff)

        return False, 0
