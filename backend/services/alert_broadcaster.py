"""
Secure-MaintAI — Real-Time Alert SSE Broadcaster.

Provides a thread-safe and task-safe async pub-sub broadcaster for Server-Sent Events (SSE).
Connected clients (Dashboard, Alert Center, TopNavbar) receive instant pushes whenever:
- An alert is generated (ML anomaly screening, SOAR playbook, Security Event).
- An alert is acknowledged or resolved by a SOC operator.

Per engineering rules Section 7, 21, and 30: zero-polling real-time updates.
"""

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

from backend.core.logging import get_logger

logger = get_logger("alert_broadcaster")


class AlertBroadcaster:
    """In-memory pub-sub broadcaster for SSE alert streams."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> AsyncIterator[str]:
        """Subscribe a new client to the SSE event stream."""
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add(queue)
            logger.info("sse_client_connected", total_clients=len(self._subscribers))

        try:
            # Yield initial connection confirmation
            yield f"event: ping\ndata: {json.dumps({'status': 'connected'})}\n\n"

            while True:
                try:
                    # Wait for next event or send keep-alive every 20 seconds
                    msg = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield msg
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat ping to prevent proxy/browser timeout
                    yield ": keep-alive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            async with self._lock:
                self._subscribers.discard(queue)
                logger.info("sse_client_disconnected", total_clients=len(self._subscribers))

    async def broadcast(self, event_type: str, data: dict[str, Any]) -> None:
        """Broadcast an alert event to all connected clients."""
        payload = json.dumps({"event": event_type, "data": data}, default=str)
        message = f"event: alert\ndata: {payload}\n\n"

        async with self._lock:
            for q in list(self._subscribers):
                try:
                    q.put_nowait(message)
                except asyncio.QueueFull:
                    # If queue is full, drop oldest item to keep up with stream
                    try:
                        q.get_nowait()
                        q.put_nowait(message)
                    except Exception:
                        pass


alert_broadcaster = AlertBroadcaster()
