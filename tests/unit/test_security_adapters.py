"""
Unit tests for Wazuh and Network Security Adapters.

Tests:
- Normalization of Sysmon Process Creation (Event ID 1).
- Normalization of LSASS credential dumping (Event ID 10).
- Normalization of Cryptojacking process and port indicators.
- Normalization of Network flow records (mining pools and exfiltration).
- Batch parsing and resilience against malformed inputs.
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from backend.schemas.security_event import SecurityEventSeverity, SecurityEventType
from security.adapters.network_adapter import NetworkAdapter
from security.adapters.wazuh_adapter import WazuhAdapter


@pytest.fixture
def wazuh_adapter() -> WazuhAdapter:
    return WazuhAdapter()


@pytest.fixture
def network_adapter() -> NetworkAdapter:
    return NetworkAdapter()


class TestWazuhAdapter:
    """Test suite for Wazuh and Sysmon log normalization."""

    def test_parse_sysmon_process_create(self, wazuh_adapter: WazuhAdapter):
        ws_id = uuid4()
        raw = {
            "timestamp": "2026-09-09T18:30:00Z",
            "rule": {"id": "100101", "level": 6, "description": "Sysmon - Event 1: Process creation"},
            "data": {
                "win": {
                    "system": {"eventID": 1},
                    "eventdata": {
                        "image": "C:\\Windows\\System32\\cmd.exe",
                        "commandLine": "cmd.exe /c whoami",
                        "parentImage": "C:\\Windows\\explorer.exe",
                    },
                }
            },
        }
        event = wazuh_adapter.parse_event(raw, workstation_id=ws_id)

        assert event is not None
        assert event.workstation_id == ws_id
        assert event.source == "wazuh"
        assert event.event_type in (SecurityEventType.SUSPICIOUS_PROCESS, SecurityEventType.POLICY_VIOLATION)
        assert event.severity == SecurityEventSeverity.MEDIUM
        assert any("cmd.exe" in ev for ev in event.evidence)

    def test_parse_sysmon_lsass_dumping(self, wazuh_adapter: WazuhAdapter):
        raw = {
            "timestamp": "2026-09-09T19:00:00Z",
            "rule": {"id": "100110", "level": 12, "description": "Sysmon - Event 10: Process accessed"},
            "data": {
                "win": {
                    "system": {"eventID": 10},
                    "eventdata": {
                        "image": "C:\\Temp\\mimikatz.exe",
                        "targetFilename": "C:\\Windows\\System32\\lsass.exe",
                    },
                }
            },
        }
        event = wazuh_adapter.parse_event(raw)

        assert event is not None
        assert event.event_type == SecurityEventType.PRIVILEGE_ESCALATION
        assert event.severity == SecurityEventSeverity.HIGH
        assert any("mimikatz.exe" in ev for ev in event.evidence)

    def test_parse_cryptojacking_process(self, wazuh_adapter: WazuhAdapter):
        raw = {
            "rule": {"id": "100999", "level": 14, "description": "Suspicious high-compute process"},
            "data": {
                "win": {
                    "system": {"eventID": 1},
                    "eventdata": {
                        "image": "C:\\Users\\Public\\xmrig.exe",
                        "commandLine": "xmrig.exe -o stratum+tcp://xmr.pool:3333",
                    },
                }
            },
        }
        event = wazuh_adapter.parse_event(raw)

        assert event is not None
        assert event.event_type == SecurityEventType.CRYPTOJACKING
        assert event.severity == SecurityEventSeverity.CRITICAL
        assert event.confidence >= 0.85

    def test_batch_parse_handles_malformed_entries(self, wazuh_adapter: WazuhAdapter):
        events = [
            {"rule": {"id": "1", "level": 3, "description": "Valid Event"}},
            {},  # Empty
            {"invalid": True},
        ]
        parsed = wazuh_adapter.batch_parse(events)
        assert len(parsed) >= 1


class TestNetworkAdapter:
    """Test suite for Network socket log normalization."""

    def test_parse_mining_pool_connection(self, network_adapter: NetworkAdapter):
        raw = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "dest_ip": "198.51.100.25",
            "dest_port": 3333,
            "dest_host": "xmr.supportxmr.com",
            "protocol": "TCP",
        }
        event = network_adapter.parse_event(raw)

        assert event is not None
        assert event.event_type == SecurityEventType.CRYPTOJACKING
        assert event.severity == SecurityEventSeverity.CRITICAL
        assert event.confidence >= 0.90
        assert any("DestinationPort: 3333" in ev for ev in event.evidence)

    def test_parse_data_exfiltration(self, network_adapter: NetworkAdapter):
        raw = {
            "dest_ip": "203.0.113.88",
            "dest_port": 443,
            "bytes_sent": 250000000.0,  # 250 MB
        }
        event = network_adapter.parse_event(raw)

        assert event is not None
        assert event.event_type == SecurityEventType.DATA_EXFILTRATION
        assert event.severity == SecurityEventSeverity.HIGH
        assert any("250.0 MB" in ev for ev in event.evidence)
