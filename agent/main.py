"""
Secure-MaintAI — Endpoint Monitoring Agent Daemon.

Main orchestrator running 24/7 background telemetry collection,
local disk buffer draining, and periodic heartbeat reporting.

Per engineering rules Section 9:
- Resource limit: CPU < 2%, RAM < 50MB.
- Privacy by design: Safe metrics only.
- Resilience: Offline buffer surviving disconnects.
"""

import asyncio
import logging
import signal
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx

# Support execution from both project root and standalone agent directory
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))

try:
    from agent.buffer import LocalTelemetryBuffer
    from agent.client import AgentClient
    from agent.collectors import (
        collect_cpu_metrics,
        collect_disk_metrics,
        collect_memory_metrics,
        collect_network_metrics,
        collect_process_metrics,
        collect_system_info,
    )
    from agent.config import AgentConfig, load_agent_config, save_agent_state
except ModuleNotFoundError:
    from buffer import LocalTelemetryBuffer  # type: ignore[no-redef]
    from client import AgentClient  # type: ignore[no-redef]
    from collectors import (  # type: ignore[no-redef]
        collect_cpu_metrics,
        collect_disk_metrics,
        collect_memory_metrics,
        collect_network_metrics,
        collect_process_metrics,
        collect_system_info,
    )
    from config import AgentConfig, load_agent_config, save_agent_state  # type: ignore[no-redef]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("secure-maintai.agent")


class EndpointAgent:
    """The Secure-MaintAI Endpoint Monitoring Agent."""

    def __init__(self, config: AgentConfig | None = None) -> None:
        self.config = config or load_agent_config()
        self.buffer = LocalTelemetryBuffer(
            buffer_dir=self.config.buffer_directory,
            max_size_mb=self.config.max_buffer_size_mb,
        )
        self.client = AgentClient(self.config)
        self._running = False

    async def re_register(self) -> bool:
        """Clear stale identity cache and re-enroll with the backend."""
        self.config.agent_id = None
        self.config.workstation_id = None
        self.config.auth_token = None
        try:
            state_path = Path(self.config.state_file_path)
            if state_path.exists():
                state_path.unlink()
        except OSError as exc:
            logger.warning("Could not remove state file: %s", exc)
        return await self.initialize()

    async def initialize(self) -> bool:
        """Enroll or restore agent identity with the backend."""
        if self.config.agent_id and self.config.workstation_id:
            logger.info(
                "Restoring agent identity: agent_id=%s, workstation_id=%s",
                self.config.agent_id,
                self.config.workstation_id,
            )
            # Verify identity with backend before assuming valid session
            status_code = await self.client.send_heartbeat(agent_id=self.config.agent_id)
            if status_code == 200:
                logger.info("Agent identity verified with backend.")
                return True
            elif status_code == 404:
                logger.warning(
                    "Cached agent_id %s not recognized by backend (404). Re-enrolling...",
                    self.config.agent_id,
                )
                self.config.agent_id = None
                self.config.workstation_id = None
                self.config.auth_token = None
                try:
                    Path(self.config.state_file_path).unlink(missing_ok=True)
                except OSError:
                    pass
            else:
                logger.warning(
                    "Could not verify identity with backend (status %s); proceeding with cached state.",
                    status_code,
                )
                return True

        logger.info(
            "Agent is unregistered. Enrolling with backend at %s...",
            self.config.backend_url,
        )
        system_info = collect_system_info()
        try:
            reg = await self.client.register(system_info)
            self.config.agent_id = UUID(reg["agent_id"])
            self.config.workstation_id = UUID(reg["workstation_id"])
            self.config.auth_token = reg.get("token")
            save_agent_state(self.config)
            logger.info(
                "Agent successfully registered: agent_id=%s, workstation_id=%s",
                self.config.agent_id,
                self.config.workstation_id,
            )
            return True
        except (httpx.HTTPError, OSError, ValueError) as exc:
            logger.error("Failed to enroll agent: %s", exc)
            return False

    def collect_telemetry_snapshot(self) -> dict[str, Any]:
        """Gather a single timestamped telemetry snapshot."""
        cpu = collect_cpu_metrics()
        memory = collect_memory_metrics()
        disk = collect_disk_metrics()
        network = collect_network_metrics()
        proc = collect_process_metrics(top_n=5)

        now = datetime.now(timezone.utc).isoformat()

        return {
            "agent_id": str(self.config.agent_id),
            "workstation_id": str(self.config.workstation_id),
            "timestamp": now,
            "schema_version": "1.0",
            "cpu": cpu,
            "memory": memory,
            "disk": disk,
            "network": network,
            "process_count": proc["process_count"],
            "system_events": [],
        }

    async def flush_buffer(self) -> int:
        """Transmit buffered telemetry records to the backend."""
        pending_count = self.buffer.count()
        if pending_count == 0:
            return 0

        batch = self.buffer.peek_batch(batch_size=self.config.max_batch_size)
        if not batch:
            return 0

        record_ids = [item[0] for item in batch]
        records = [item[1] for item in batch]

        success, count = await self.client.send_telemetry_batch(records)
        if success:
            self.buffer.commit_batch(record_ids)
            remaining = self.buffer.count()
            logger.info("Transmitted %d telemetry records. Buffer remaining: %d.", count, remaining)
            return count

        return 0

    async def collection_loop(self) -> None:
        """Continuous background collection loop."""
        while self._running:
            try:
                # Ensure agent is registered before collecting
                if not self.config.agent_id or not self.config.workstation_id:
                    initialized = await self.initialize()
                    if not initialized:
                        await asyncio.sleep(self.config.collection_interval_seconds)
                        continue

                # 1. Collect and push to local buffer
                snapshot = self.collect_telemetry_snapshot()
                self.buffer.push(snapshot)

                # 2. Attempt buffer flush
                await self.flush_buffer()
            except Exception as exc:  # noqa: BLE001
                logger.error("Error during telemetry collection: %s", exc)

            await asyncio.sleep(self.config.collection_interval_seconds)

    async def heartbeat_loop(self) -> None:
        """Periodic liveness heartbeat ping."""
        while self._running:
            if self.config.agent_id:
                try:
                    cpu = collect_cpu_metrics()
                    mem = collect_memory_metrics()
                    status_code = await self.client.send_heartbeat(
                        agent_id=self.config.agent_id,
                        cpu_usage=cpu["usage_percent"],
                        memory_usage=mem["usage_percent"],
                    )
                    if status_code == 200:
                        logger.info("Heartbeat sent successfully.")
                    elif status_code == 404:
                        logger.warning(
                            "Heartbeat returned 404: agent_id not recognized by backend. Triggering re-enrollment..."
                        )
                        await self.re_register()
                except Exception as exc:  # noqa: BLE001
                    logger.debug("Heartbeat error: %s", exc)

            await asyncio.sleep(self.config.heartbeat_interval_seconds)

    async def run(self) -> None:
        """Run the agent daemon."""
        self._running = True

        # Initialize registration
        initialized = await self.initialize()
        if not initialized:
            logger.warning("Agent registration deferred. Will retry during collection.")

        # Run concurrent background tasks
        try:
            await asyncio.gather(
                self.collection_loop(),
                self.heartbeat_loop(),
            )
        except asyncio.CancelledError:
            logger.info("Agent daemon shutting down...")
        finally:
            self._running = False
            # Final attempt to flush buffer before exit
            await self.flush_buffer()
            logger.info("Agent stopped.")

    def stop(self) -> None:
        """Signal the agent to stop."""
        self._running = False


async def main() -> None:
    """Entry point for standalone agent execution."""
    agent = EndpointAgent()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, agent.stop)
        except NotImplementedError:
            # Signal handlers might not be fully supported on Windows event loops
            pass

    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
