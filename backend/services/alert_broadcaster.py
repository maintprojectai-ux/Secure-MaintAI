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
import signal
from collections.abc import AsyncIterator
from typing import Any

from backend.core.logging import get_logger

logger = get_logger("alert_broadcaster")


class AlertBroadcaster:
    """In-memory pub-sub broadcaster for SSE alert streams."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str | None]] = set()
        self._lock = asyncio.Lock()
        self._shutting_down = False
        self._signals_hooked = False

    def _ensure_signal_hooks(self) -> None:
        """Chain onto Uvicorn's SIGINT/SIGTERM handlers so SSE streams close immediately on reload."""
        if self._signals_hooked:
            return
        self._signals_hooked = True
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                prev_handler = signal.getsignal(sig)
                if callable(prev_handler):
                    def _wrapped(s: int, f: Any, _prev: Any = prev_handler) -> None:
                        self.trigger_shutdown()
                        _prev(s, f)

                    signal.signal(sig, _wrapped)
            except Exception:
                pass

    def trigger_shutdown(self) -> None:
        """Signal all active SSE streams to close immediately so Uvicorn can reload cleanly."""
        self._shutting_down = True
        for q in list(self._subscribers):
            try:
                q.put_nowait(None)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                    q.put_nowait(None)
                except Exception:
                    pass

    async def subscribe(self) -> AsyncIterator[str]:
        """Subscribe a new client to the SSE event stream."""
        self._ensure_signal_hooks()
        queue: asyncio.Queue[str | None] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add(queue)
            logger.info("sse_client_connected", total_clients=len(self._subscribers))

        try:
            # Yield initial connection confirmation
            yield f"event: ping\ndata: {json.dumps({'status': 'connected'})}\n\n"

            while not self._shutting_down:
                try:
                    # Wait for next event or send keep-alive every 15 seconds
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    if msg is None or self._shutting_down:
                        break
                    yield msg
                except asyncio.TimeoutError:
                    if self._shutting_down:
                        break
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
