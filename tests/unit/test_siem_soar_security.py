"""Regression tests for SIEM ingestion classification safeguards."""

from security.adapters.wazuh_adapter import WazuhAdapter
from backend.schemas.security_event import SecurityEventType


def test_jupyter_port_8888_is_not_alone_cryptojacking_evidence():
    adapter = WazuhAdapter()
    result = adapter._determine_event_type(
        event_id=3,
        rule_desc="Network connection observed",
        image="python.exe",
        cmdline="jupyter-lab --port 8888",
        dest_port=8888,
    )
    assert result == SecurityEventType.NETWORK_ANOMALY


def test_explicit_mining_signature_still_detects_cryptojacking():
    adapter = WazuhAdapter()
    result = adapter._determine_event_type(
        event_id=3,
        rule_desc="Outbound connection",
        image="xmrig.exe",
        cmdline="xmrig -o stratum+tcp://pool.example:3333",
        dest_port=3333,
    )
    assert result == SecurityEventType.CRYPTOJACKING
