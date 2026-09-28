"""
Secure-MaintAI — Safe Process Metadata Collector.

Collects system process statistics and top resource consumers.
Per engineering rules Section 9: Privacy by Design.
Collects only high-level process performance metadata (PID, name, % CPU, % RAM, status).
NEVER inspects keystrokes, screen contents, or private files.
"""

from typing import Any

import psutil


def collect_process_metrics(top_n: int = 5) -> dict[str, Any]:
    """
    Collect total process count and top resource-consuming processes safely.
    """
    process_count = 0
    processes: list[dict[str, Any]] = []

    for proc in psutil.process_iter(
        ["pid", "name", "cpu_percent", "memory_percent", "status", "username"]
    ):
        process_count += 1
        try:
            info = proc.info
            # Include only non-empty names
            if info.get("name"):
                processes.append(
                    {
                        "pid": info["pid"],
                        "name": info["name"][:128],
                        "cpu_percent": float(info.get("cpu_percent") or 0.0),
                        "memory_percent": float(info.get("memory_percent") or 0.0),
                        "status": str(info.get("status") or "running"),
                        "username": str(info.get("username") or "")[:64],
                    }
                )
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    # Sort by CPU and memory usage to find top resource consumers
    processes.sort(key=lambda p: p["cpu_percent"] + p["memory_percent"], reverse=True)
    top_processes = processes[:top_n]

    return {
        "process_count": process_count,
        "top_processes": top_processes,
    }


def collect_agent_self_overhead(pid: int | None = None) -> dict[str, float]:
    """
    Measure the monitoring agent's own resource footprint (Rule 9, Guide §2.1 & §4.2).
    Returns agent process CPU percent and resident memory (RSS) in megabytes.
    """
    proc = psutil.Process(pid)
    rss_mb = proc.memory_info().rss / (1024 * 1024)
    cpu_pct = proc.cpu_percent(interval=None)
    return {
        "agent_rss_mb": round(rss_mb, 2),
        "agent_cpu_percent": round(cpu_pct, 2),
    }

