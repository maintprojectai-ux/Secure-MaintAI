"""
Secure-MaintAI — Disk Utilization and I/O Collector.

Calculates I/O throughput rate (bytes/sec) and disk capacity usage.
Matching backend.schemas.telemetry.DiskMetrics.
"""

import time
from typing import Any

import psutil

_last_disk_time: float | None = None
_last_disk_read_bytes: int = 0
_last_disk_write_bytes: int = 0


def collect_disk_metrics() -> dict[str, Any]:
    """
    Collect disk I/O rates and usage percentages.
    """
    global _last_disk_time, _last_disk_read_bytes, _last_disk_write_bytes

    now = time.monotonic()
    read_rate = 0.0
    write_rate = 0.0

    try:
        io_counters = psutil.disk_io_counters()
        if io_counters:
            current_read = io_counters.read_bytes
            current_write = io_counters.write_bytes

            if _last_disk_time is not None:
                dt = max(0.001, now - _last_disk_time)
                read_rate = max(0.0, (current_read - _last_disk_read_bytes) / dt)
                write_rate = max(0.0, (current_write - _last_disk_write_bytes) / dt)

            _last_disk_time = now
            _last_disk_read_bytes = current_read
            _last_disk_write_bytes = current_write
    except (psutil.Error, OSError):
        pass

    # Disk usage percentage for primary partition
    usage_percent = 0.0
    total_bytes = 0
    try:
        path = "C:\\" if psutil.WINDOWS else "/"
        usage = psutil.disk_usage(path)
        usage_percent = float(usage.percent)
        total_bytes = usage.total
    except (psutil.Error, OSError):
        pass

    return {
        "read_bytes_per_sec": float(read_rate),
        "write_bytes_per_sec": float(write_rate),
        "usage_percent": max(0.0, min(100.0, usage_percent)),
        "total_bytes": total_bytes,
    }
