"""
Secure-MaintAI — Network Utilization and Throughput Collector.

Calculates real-time network traffic throughput rate (bytes/sec) and connection count.
Matching backend.schemas.telemetry.NetworkMetrics.
"""

import time
from typing import Any

import psutil

_last_net_time: float | None = None
_last_net_recv_bytes: int = 0
_last_net_sent_bytes: int = 0


def collect_network_metrics() -> dict[str, Any]:
    """
    Collect network throughput in/out and active socket connections.
    """
    global _last_net_time, _last_net_recv_bytes, _last_net_sent_bytes

    now = time.monotonic()
    bytes_in_sec = 0.0
    bytes_out_sec = 0.0

    try:
        net_io = psutil.net_io_counters()
        if net_io:
            current_recv = net_io.bytes_recv
            current_sent = net_io.bytes_sent

            if _last_net_time is not None:
                dt = max(0.001, now - _last_net_time)
                bytes_in_sec = max(0.0, (current_recv - _last_net_recv_bytes) / dt)
                bytes_out_sec = max(0.0, (current_sent - _last_net_sent_bytes) / dt)

            _last_net_time = now
            _last_net_recv_bytes = current_recv
            _last_net_sent_bytes = current_sent
    except (psutil.Error, OSError):
        pass

    connections_count = 0
    try:
        connections_count = len(psutil.net_connections(kind="inet"))
    except (psutil.Error, OSError):
        pass

    return {
        "bytes_in_per_sec": float(bytes_in_sec),
        "bytes_out_per_sec": float(bytes_out_sec),
        "connections_active": connections_count,
    }
