"""
Secure-MaintAI — CPU Utilization Collector.

Gathers real-time processor utilization and load averages.
Per engineering rules Section 9: non-blocking, minimal overhead.
"""

from typing import Any

import psutil


def collect_cpu_metrics() -> dict[str, Any]:
    """
    Collect CPU metrics matching backend.schemas.telemetry.CpuMetrics.
    """
    # interval=0.1 calculates percentage without blocking the main event loop
    cpu_percent = psutil.cpu_percent(interval=0.1)

    load_1m, load_5m, load_15m = None, None, None
    if hasattr(psutil, "getloadavg"):
        try:
            loads = psutil.getloadavg()
            load_1m, load_5m, load_15m = loads[0], loads[1], loads[2]
        except (AttributeError, OSError):
            pass

    return {
        "usage_percent": max(0.0, min(100.0, float(cpu_percent))),
        "core_count": psutil.cpu_count(logical=True) or 1,
        "load_average_1m": load_1m,
        "load_average_5m": load_5m,
        "load_average_15m": load_15m,
    }
