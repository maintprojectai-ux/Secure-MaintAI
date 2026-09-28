"""
Secure-MaintAI — Security Correlation Engine.

Correlates machine learning anomaly detections (Model 01, Model 02-A, Model 02-B)
with host security events (Wazuh, Sysmon, network flows) across temporal windows.

Resolves diagnostic ambiguity between:
- Cybersecurity attacks (Cryptojacking, APT, Exfiltration, Unauthorized Access)
- Legitimate technical/research workloads (High CPU without malicious indicators)
- Infrastructure/hardware degradations (Disk/Memory/Network bottlenecks)

Per engineering rules Section 16 & 17:
- Produces normalized classification, confidence, severity, and forensic evidence.
- Never directly triggers destructive actions; outputs structured recommendations.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID

from backend.models.anomaly import AnomalyDetection
from backend.models.security_event import SecurityEvent
from backend.schemas.security_event import SecurityEventSeverity, SecurityEventType

logger = logging.getLogger(__name__)


@dataclass
class CorrelatedIncident:
    """Unified diagnosis resulting from multi-source security correlation."""

    workstation_id: UUID
    is_threat: bool
    incident_category: str
    severity: SecurityEventSeverity | str
    confidence: float
    title: str = ""
    summary: str = ""
    reason: str | None = None
    evidence: list[str] = field(default_factory=list)
    recommended_action: str = "MONITOR"
    correlated_anomaly_ids: list[UUID] = field(default_factory=list)
    correlated_event_ids: list[UUID] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if self.reason and not self.summary:
            self.summary = self.reason
        elif self.summary and not self.reason:
            self.reason = self.summary
        if not self.title:
            self.title = f"{self.incident_category} ({self.severity})"


class SecurityCorrelationEngine:
    """Multi-source security correlation and diagnostic reasoning engine."""

    def correlate(
        self,
        workstation_id: UUID,
        anomalies: Sequence[AnomalyDetection],
        security_events: Sequence[SecurityEvent],
        workstation_name: str | None = None,
    ) -> CorrelatedIncident:
        """
        Correlate recent anomaly detections and security events for a specific workstation.

        Parameters
        ----------
        workstation_id:
            UUID of the workstation being evaluated.
        anomalies:
            List of recent AnomalyDetection records.
        security_events:
            List of recent SecurityEvent records.
        workstation_name:
            Optional hostname or machine tag.

        Returns
        -------
        CorrelatedIncident
        """
        ws_label = workstation_name or str(workstation_id)
        anomaly_ids = [a.id for a in anomalies if a.id is not None]
        event_ids = [e.id for e in security_events if e.id is not None]

        # Aggregate evidence collections
        aggregated_evidence: list[str] = []
        for a in anomalies:
            if a.evidence:
                aggregated_evidence.extend(a.evidence)
        for e in security_events:
            if e.evidence:
                aggregated_evidence.extend(e.evidence)

        # 1. Check for Cryptojacking Indicators (Rule A)
        has_ml_anomaly = any(a.score >= 0.50 for a in anomalies)
        has_crypto_event = any(
            e.event_type == SecurityEventType.CRYPTOJACKING.value
            or "crypto" in (e.description or "").lower()
            or "stratum" in (e.description or "").lower()
            for e in security_events
        )
        has_mining_evidence = any(
            "stratum" in ev.lower() or "xmrig" in ev.lower() or "mining" in ev.lower()
            for ev in aggregated_evidence
        )

        if has_crypto_event or (has_ml_anomaly and has_mining_evidence):
            logger.info("correlation_engine: detected CRYPTOJACKING on %s", ws_label)
            return CorrelatedIncident(
                workstation_id=workstation_id,
                is_threat=True,
                incident_category="CRYPTOJACKING",
                severity=SecurityEventSeverity.CRITICAL,
                confidence=0.96,
                title=f"Cryptojacking Activity Detected on {ws_label}",
                summary="High compute utilization correlated with outbound cryptocurrency mining pool connections.",
                evidence=aggregated_evidence,
                recommended_action="SURGICAL_ISOLATION",
                correlated_anomaly_ids=anomaly_ids,
                correlated_event_ids=event_ids,
            )

        # 2. Check for APT / Lateral Movement / Malware (Rule B)
        has_apt_anomaly = any(
            a.anomaly_type == "SECURITY_ANOMALY" and a.confidence >= 0.70 for a in anomalies
        )
        has_malware_events = any(
            e.event_type in (
                SecurityEventType.MALWARE_DETECTED.value,
                SecurityEventType.PRIVILEGE_ESCALATION.value,
            )
            for e in security_events
        )
        has_suspicious_injection = any(
            "lsass" in ev.lower()
            or "createremotethread" in ev.lower()
            or "mimikatz" in ev.lower()
            or "processtampering" in ev.lower()
            or "tampering" in ev.lower()
            for ev in aggregated_evidence
        )

        if has_malware_events or has_suspicious_injection or (has_apt_anomaly and has_malware_events):
            logger.info("correlation_engine: detected APT_INTRUSION on %s", ws_label)
            return CorrelatedIncident(
                workstation_id=workstation_id,
                is_threat=True,
                incident_category="APT_INTRUSION",
                severity=SecurityEventSeverity.HIGH,
                confidence=0.92,
                title=f"Host APT Intrusion Signature on {ws_label}",
                summary="Host behavioral threat signatures correlated with suspicious process injection or credential access.",
                evidence=aggregated_evidence,
                recommended_action="SURGICAL_ISOLATION",
                correlated_anomaly_ids=anomaly_ids,
                correlated_event_ids=event_ids,
            )

        # 3. Check for Data Exfiltration (Rule C)
        has_exfil = any(
            e.event_type == SecurityEventType.DATA_EXFILTRATION.value for e in security_events
        )
        if has_exfil:
            logger.info("correlation_engine: detected DATA_EXFILTRATION on %s", ws_label)
            return CorrelatedIncident(
                workstation_id=workstation_id,
                is_threat=True,
                incident_category="DATA_EXFILTRATION",
                severity=SecurityEventSeverity.HIGH,
                confidence=0.88,
                title=f"Potential Data Exfiltration on {ws_label}",
                summary="Abnormal high-volume network egress detected to external destinations.",
                evidence=aggregated_evidence,
                recommended_action="SURGICAL_ISOLATION",
                correlated_anomaly_ids=anomaly_ids,
                correlated_event_ids=event_ids,
            )

        # 4. Check for Brute Force / Unauthorized Access (Rule D)
        auth_failures = [
            e for e in security_events
            if e.event_type == SecurityEventType.AUTHENTICATION_FAILURE.value
        ]
        has_unauth_events = any(
            e.event_type in (
                SecurityEventType.UNAUTHORIZED_ACCESS.value,
                SecurityEventType.POLICY_VIOLATION.value,
                SecurityEventType.SUSPICIOUS_PROCESS.value,
            )
            for e in security_events
        )
        if len(auth_failures) >= 3 or has_unauth_events:
            logger.info("correlation_engine: detected UNAUTHORIZED_ACCESS on %s", ws_label)
            sev = (
                SecurityEventSeverity.HIGH
                if any(e.severity in ("HIGH", "CRITICAL") for e in security_events)
                else SecurityEventSeverity.MEDIUM
            )
            return CorrelatedIncident(
                workstation_id=workstation_id,
                is_threat=True,
                incident_category="UNAUTHORIZED_ACCESS",
                severity=sev,
                confidence=0.85,
                title=f"Unauthorized Access Detected on {ws_label}",
                summary=f"Detected unauthorized security events or authentication failures on host.",
                evidence=aggregated_evidence,
                recommended_action="ALERT_SOC",
                correlated_anomaly_ids=anomaly_ids,
                correlated_event_ids=event_ids,
            )

        # 5. Check for Benign Heavy Compute vs Hardware Degradation (Rule E)
        if has_ml_anomaly:
            # Check if there are ZERO malicious security events
            has_any_malicious_event = any(
                e.event_type in (
                    SecurityEventType.MALWARE_DETECTED.value,
                    SecurityEventType.PRIVILEGE_ESCALATION.value,
                    SecurityEventType.CRYPTOJACKING.value,
                    SecurityEventType.DATA_EXFILTRATION.value,
                    SecurityEventType.UNAUTHORIZED_ACCESS.value,
                )
                for e in security_events
            )
            has_hardware_fault_indicators = any(
                "thrashing" in ev.lower()
                or "degrad" in ev.lower()
                or "latency" in ev.lower()
                or "bus" in ev.lower()
                or "disk" in ev.lower()
                or "sensor" in ev.lower()
                or "memory" in ev.lower()
                or "network" in ev.lower()
                or "io" in ev.lower()
                for ev in aggregated_evidence
            )

            if not has_any_malicious_event and not has_hardware_fault_indicators:
                logger.info("correlation_engine: correlated BENIGN_HIGH_LOAD on %s", ws_label)
                return CorrelatedIncident(
                    workstation_id=workstation_id,
                    is_threat=False,
                    incident_category="BENIGN_HIGH_LOAD",
                    severity=SecurityEventSeverity.LOW,
                    confidence=0.90,
                    title=f"High Compute Workload on {ws_label}",
                    summary="High CPU/Memory utilization without malicious security signals; indicative of legitimate compute or simulation.",
                    evidence=aggregated_evidence,
                    recommended_action="PRESERVE_STATE",
                    correlated_anomaly_ids=anomaly_ids,
                    correlated_event_ids=event_ids,
                )

            # 6. Technical Hardware / Service Fault
            logger.info("correlation_engine: correlated TECHNICAL_FAULT on %s", ws_label)
            return CorrelatedIncident(
                workstation_id=workstation_id,
                is_threat=False,
                incident_category="TECHNICAL_FAULT",
                severity=SecurityEventSeverity.MEDIUM,
                confidence=0.86,
                title=f"Infrastructure Technical Fault on {ws_label}",
                summary="Telemetry anomaly attributed to technical performance bottleneck, hardware degradation, or service delay.",
                evidence=aggregated_evidence,
                recommended_action="LOG_MAINTENANCE",
                correlated_anomaly_ids=anomaly_ids,
                correlated_event_ids=event_ids,
            )

        # 7. Normal operational baseline
        return CorrelatedIncident(
            workstation_id=workstation_id,
            is_threat=False,
            incident_category="NORMAL",
            severity=SecurityEventSeverity.LOW,
            confidence=1.0,
            title=f"Workstation {ws_label} Normal",
            summary="No anomalous telemetry or security incidents detected in operational window.",
            evidence=["All telemetry channels and security logs are within normal thresholds."],
            recommended_action="MONITOR",
            correlated_anomaly_ids=anomaly_ids,
            correlated_event_ids=event_ids,
        )

    # Method alias
    correlate_workstation = correlate


# Global singleton instance
correlation_engine = SecurityCorrelationEngine()
