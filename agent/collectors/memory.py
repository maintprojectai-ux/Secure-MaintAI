"""
Secure-MaintAI — Memory Utilization Collector.

Gathers real-time RAM metrics.
Matching backend.schemas.telemetry.MemoryMetrics.
"""

from typing import Any

import psutil


def collect_memory_metrics() -> dict[str, Any]:
    """
    Collect system virtual memory statistics.
    """
    mem = psutil.virtual_memory()

    return {
        "usage_percent": max(0.0, min(100.0, float(mem.percent))),
        "total_bytes": mem.total,
        "available_bytes": mem.available,
        "used_bytes": mem.used,
    }
