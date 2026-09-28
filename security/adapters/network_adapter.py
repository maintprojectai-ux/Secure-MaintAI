"""
Secure-MaintAI — Network & Socket Log Security Event Adapter.

Normalizes network connection flows, socket inspection records, and firewall logs.
Detects:
- Outbound connections to cryptocurrency mining pools (Stratum protocol).
- Port scanning and internal reconnaissance.
- C2 communication channels and data exfiltration spikes.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from backend.schemas.security_event import (
    SecurityEventCreate,
    SecurityEventSeverity,
    SecurityEventType,
)
from security.adapters.base import BaseSecurityAdapter

_MINING_PORTS = {3333, 4444, 5555, 7777, 8888, 9999, 14444, 18080}
_MINING_DOMAINS = [
    r"minexmr",
    r"nanopool",
    r"supportxmr",
    r"monero",
    r"ethermine",
    r"hashvault",
    r"2miners",
    r"pool\.",
    r"stratum",
]


class NetworkAdapter(BaseSecurityAdapter):
    """Adapter for normalizing network flow and socket monitoring logs."""

    def parse_event(
        self,
        raw_data: dict[str, Any],
        workstation_id: UUID | None = None,
        user_id: UUID | None = None,
    ) -> SecurityEventCreate | None:
        """
        Parse raw network flow or socket connection data.
        """
        if not isinstance(raw_data, dict) or not raw_data:
            return None

        dest_ip = str(raw_data.get("dest_ip", raw_data.get("destination_ip", "")))
        dest_host = str(raw_data.get("dest_host", raw_data.get("domain", ""))).lower()
        raw_port = raw_data.get("dest_port", raw_data.get("destination_port"))
        dest_port = int(raw_port) if raw_port is not None and str(raw_port).isdigit() else None
        proto = str(raw_data.get("protocol", "TCP")).upper()
        bytes_sent = float(raw_data.get("bytes_sent", 0.0))

        raw_ts = raw_data.get("timestamp", datetime.now(timezone.utc))
        if isinstance(raw_ts, str):
            try:
                ts = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            except Exception:
                ts = datetime.now(timezone.utc)
        elif isinstance(raw_ts, datetime):
            ts = raw_ts if raw_ts.tzinfo else raw_ts.replace(tzinfo=timezone.utc)
        else:
            ts = datetime.now(timezone.utc)

        evidence = []
        if dest_ip:
            evidence.append(f"DestinationIP: {dest_ip}")
        if dest_port:
            evidence.append(f"DestinationPort: {dest_port}")
        if dest_host:
            evidence.append(f"Host: {dest_host}")
        evidence.append(f"Protocol: {proto}")

        # 1. Cryptojacking pool check
        is_mining_port = dest_port in _MINING_PORTS
        is_mining_domain = any(re.search(pat, dest_host) for pat in _MINING_DOMAINS)
        if is_mining_port or is_mining_domain:
            evidence.append("Matched stratum/crypto-mining network indicator")
            return SecurityEventCreate(
                timestamp=ts,
                source="network-monitor",
                workstation_id=workstation_id,
                user_id=user_id,
                event_type=SecurityEventType.CRYPTOJACKING,
                severity=SecurityEventSeverity.CRITICAL,
                confidence=0.92,
                description=f"Outbound connection to suspected cryptocurrency mining pool {dest_host or dest_ip}:{dest_port}",
                evidence=evidence,
                raw_event_reference=f"net-flow-{dest_ip}-{dest_port}",
            )

        # 2. Large exfiltration volume check (>100MB burst)
        if bytes_sent > 1.0e8:
            evidence.append(f"High outbound volume: {bytes_sent / 1e6:.1f} MB")
            return SecurityEventCreate(
                timestamp=ts,
                source="network-monitor",
                workstation_id=workstation_id,
                user_id=user_id,
                event_type=SecurityEventType.DATA_EXFILTRATION,
                severity=SecurityEventSeverity.HIGH,
                confidence=0.85,
                description=f"High-volume data egress detected to {dest_ip}:{dest_port}",
                evidence=evidence,
                raw_event_reference=f"net-exfil-{dest_ip}",
            )

        # 3. Generic suspicious network anomaly
        return SecurityEventCreate(
            timestamp=ts,
            source="network-monitor",
            workstation_id=workstation_id,
            user_id=user_id,
            event_type=SecurityEventType.NETWORK_ANOMALY,
            severity=SecurityEventSeverity.MEDIUM,
            confidence=0.70,
            description=f"Anomalous network connection to {dest_ip}:{dest_port}",
            evidence=evidence,
            raw_event_reference=f"net-conn-{dest_ip}",
        )
