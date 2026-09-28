"""
Secure-MaintAI — Wazuh & Sysmon Security Event Adapter.

Parses raw Wazuh alerts and Sysmon JSON logs into the canonical SecurityEventCreate schema.
Per engineering rules Section 17:
- Normalized internal schema.
- Handles Wazuh nested fields and flattened formats.
- Extracts forensic evidence for correlation.
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

# Mining executable and pool patterns
_CRYPTO_PATTERNS = [
    r"xmrig",
    r"minerd",
    r"cgminer",
    r"stratum\+tcp",
    r"cryptonight",
    r"monero",
    r"ethminer",
    r"nicehash",
    r"nanopool",
    r"supportxmr",
]


class WazuhAdapter(BaseSecurityAdapter):
    """Adapter for normalizing Wazuh SIEM alerts and Sysmon host event streams."""

    def _map_severity(self, rule_level: int) -> SecurityEventSeverity:
        """Map numeric Wazuh rule level (1-16) to canonical severity enum."""
        if rule_level >= 13:
            return SecurityEventSeverity.CRITICAL
        if rule_level >= 9:
            return SecurityEventSeverity.HIGH
        if rule_level >= 5:
            return SecurityEventSeverity.MEDIUM
        return SecurityEventSeverity.LOW

    def _parse_timestamp(self, raw_ts: Any) -> datetime:
        """Parse various ISO/UTC timestamp formats into timezone-aware datetime."""
        if not raw_ts:
            return datetime.now(timezone.utc)
        if isinstance(raw_ts, datetime):
            return raw_ts if raw_ts.tzinfo else raw_ts.replace(tzinfo=timezone.utc)
        try:
            clean_str = str(raw_ts).replace("@", "").strip()
            # Handle ISO 8601 strings
            dt = datetime.fromisoformat(clean_str.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)

    def _determine_event_type(
        self,
        event_id: int | None,
        rule_desc: str,
        image: str,
        cmdline: str,
        dest_port: int | None,
    ) -> SecurityEventType:
        """Determine normalized event type from Sysmon Event ID and command contents."""
        combined_text = f"{rule_desc} {image} {cmdline}".lower()

        # 1. Cryptojacking detection
        if any(re.search(pat, combined_text) for pat in _CRYPTO_PATTERNS):
            return SecurityEventType.CRYPTOJACKING
        if dest_port in {3333, 4444, 5555, 7777, 8888, 9999}:
            return SecurityEventType.CRYPTOJACKING

        # 2. Sysmon Event ID mapping
        if event_id == 1:
            if "powershell" in combined_text or "cmd.exe" in combined_text or "rundll32" in combined_text:
                return SecurityEventType.POLICY_VIOLATION
            return SecurityEventType.SUSPICIOUS_PROCESS
        if event_id == 3:
            return SecurityEventType.NETWORK_ANOMALY
        if event_id in (8, 25):  # CreateRemoteThread, ProcessTampering
            return SecurityEventType.MALWARE_DETECTED
        if event_id == 10:  # ProcessAccess (LSASS dumping)
            return SecurityEventType.PRIVILEGE_ESCALATION
        if event_id in (12, 13, 14):  # Registry persistence
            return SecurityEventType.PRIVILEGE_ESCALATION
        if event_id == 22:  # DNS query
            return SecurityEventType.NETWORK_ANOMALY
        if event_id == 4625:  # Windows Auth Failure
            return SecurityEventType.AUTHENTICATION_FAILURE

        # 3. Rule description heuristics
        if "authentication failed" in combined_text or "logon failed" in combined_text:
            return SecurityEventType.AUTHENTICATION_FAILURE
        if "privilege" in combined_text or "escalat" in combined_text:
            return SecurityEventType.PRIVILEGE_ESCALATION
        if "malware" in combined_text or "trojan" in combined_text or "ransomware" in combined_text:
            return SecurityEventType.MALWARE_DETECTED
        if "exfiltration" in combined_text or "data leak" in combined_text:
            return SecurityEventType.DATA_EXFILTRATION

        return SecurityEventType.SUSPICIOUS_PROCESS

    def parse_event(
        self,
        raw_data: dict[str, Any],
        workstation_id: UUID | None = None,
        user_id: UUID | None = None,
    ) -> SecurityEventCreate | None:
        """
        Normalize a Wazuh alert or Sysmon record into a SecurityEventCreate schema.
        """
        if not isinstance(raw_data, dict) or not raw_data:
            return None

        # Handle nested Wazuh alert structure or flattened JSON
        rule = raw_data.get("rule", {})
        rule_id = str(rule.get("id", raw_data.get("_source.rule.id", "unknown")))
        rule_level = int(rule.get("level", raw_data.get("_source.rule.level", 5)))
        rule_desc = str(
            rule.get("description", raw_data.get("_source.rule.description", "Wazuh Security Event"))
        )

        data_block = raw_data.get("data", {})
        win = data_block.get("win", {})
        system = win.get("system", {})
        eventdata = win.get("eventdata", {})

        # Extract Event ID
        raw_event_id = system.get("eventID", raw_data.get("_source.data.win.system.eventID"))
        event_id = int(raw_event_id) if raw_event_id is not None and str(raw_event_id).isdigit() else None

        # Extract event forensic data
        image = str(eventdata.get("image", raw_data.get("_source.data.win.eventdata.image", "")))
        cmdline = str(
            eventdata.get("commandLine", raw_data.get("_source.data.win.eventdata.commandLine", ""))
        )
        parent_img = str(
            eventdata.get("parentImage", raw_data.get("_source.data.win.eventdata.parentImage", ""))
        )
        dest_ip = str(
            eventdata.get("destinationIp", raw_data.get("_source.data.win.eventdata.destinationIp", ""))
        )
        raw_port = eventdata.get("destinationPort", raw_data.get("_source.data.win.eventdata.destinationPort"))
        dest_port = int(raw_port) if raw_port is not None and str(raw_port).isdigit() else None
        target_file = str(
            eventdata.get("targetFilename", raw_data.get("_source.data.win.eventdata.targetFilename", ""))
        )
        target_obj = str(
            eventdata.get("targetObject", raw_data.get("_source.data.win.eventdata.targetObject", ""))
        )

        # Parse timestamp
        raw_ts = (
            raw_data.get("timestamp")
            or raw_data.get("@timestamp")
            or raw_data.get("_source.@timestamp")
            or system.get("systemTime")
        )
        ts = self._parse_timestamp(raw_ts)

        # Severity and Type
        severity = self._map_severity(rule_level)
        event_type = self._determine_event_type(event_id, rule_desc, image, cmdline, dest_port)

        # Build evidence list
        evidence: list[str] = []
        if image:
            evidence.append(f"Image: {image}")
        if cmdline:
            evidence.append(f"CommandLine: {cmdline}")
        if parent_img:
            evidence.append(f"ParentImage: {parent_img}")
        if dest_ip:
            dest_str = f"Destination: {dest_ip}"
            if dest_port:
                dest_str += f":{dest_port}"
            evidence.append(dest_str)
        if target_file:
            evidence.append(f"TargetFile: {target_file}")
        if target_obj:
            evidence.append(f"TargetObject: {target_obj}")
        if not evidence:
            evidence.append(f"Wazuh Rule {rule_id}: {rule_desc}")

        confidence = min(1.0, max(0.60, float(rule_level) / 15.0))

        return SecurityEventCreate(
            timestamp=ts,
            source="wazuh",
            workstation_id=workstation_id,
            user_id=user_id,
            event_type=event_type,
            severity=severity,
            confidence=confidence,
            description=rule_desc,
            evidence=evidence,
            raw_event_reference=f"wazuh-rule-{rule_id}" + (f"-event-{event_id}" if event_id else ""),
        )
