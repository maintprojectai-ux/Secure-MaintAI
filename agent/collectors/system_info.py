"""
Secure-MaintAI — Host and System Information Collector.

Collects workstation hardware and OS metadata for agent enrollment.
"""

import platform
import socket
import uuid
from typing import Any

import psutil


def get_primary_ip_address() -> str:
    """Detect the workstation's primary outbound IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't need to be reachable, allows local OS route selection
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except OSError:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def get_primary_mac_address() -> str | None:
    """Detect the workstation's primary network adapter MAC address."""
    try:
        raw_node = uuid.getnode()
        mac = ":".join(f"{(raw_node >> ele) & 0xff:02X}" for ele in range(0, 8 * 6, 8)[::-1])
        return mac
    except Exception:
        return None


def collect_system_info() -> dict[str, Any]:
    """
    Collect host system specifications and platform details.
    """
    os_name = platform.system()
    os_release = platform.release()
    os_version = platform.version()
    full_os = f"{os_name} {os_release} ({platform.machine()})"

    total_memory = 0
    try:
        total_memory = psutil.virtual_memory().total
    except (psutil.Error, OSError):
        pass

    cpu_count = psutil.cpu_count(logical=True) or 1
    processor = platform.processor() or "Unknown"
    ram_gb = round(total_memory / (1024**3), 1) if total_memory > 0 else 0.0

    hardware_specs = {
        "processor": processor,
        "cpu_cores": cpu_count,
        "ram_gb": ram_gb,
        "architecture": platform.machine(),
    }

    return {
        "hostname": platform.node() or socket.gethostname(),
        "ip_address": get_primary_ip_address(),
        "mac_address": get_primary_mac_address(),
        "operating_system": full_os,
        "platform_system": os_name,
        "platform_release": os_release,
        "platform_version": os_version,
        "architecture": platform.machine(),
        "processor": processor,
        "cpu_count": cpu_count,
        "total_memory_bytes": total_memory,
        "hardware_specs": hardware_specs,
    }
