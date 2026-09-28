"""
Unit Tests — Agent Resource Collectors.

Tests system, CPU, memory, disk, network, and safe process metadata collectors.
Per engineering rules Section 9: non-blocking, non-invasive metrics collection.
"""

from agent.collectors import (
    collect_cpu_metrics,
    collect_disk_metrics,
    collect_memory_metrics,
    collect_network_metrics,
    collect_process_metrics,
    collect_system_info,
)


class TestAgentCollectors:
    """Test suite for agent telemetry collectors."""

    def test_system_info_collector(self) -> None:
        info = collect_system_info()
        assert "hostname" in info and len(info["hostname"]) > 0
        assert "ip_address" in info
        assert "operating_system" in info
        assert "cpu_count" in info and info["cpu_count"] >= 1
        assert "total_memory_bytes" in info and info["total_memory_bytes"] >= 0

    def test_cpu_collector(self) -> None:
        cpu = collect_cpu_metrics()
        assert 0.0 <= cpu["usage_percent"] <= 100.0
        assert cpu["core_count"] >= 1

    def test_memory_collector(self) -> None:
        mem = collect_memory_metrics()
        assert 0.0 <= mem["usage_percent"] <= 100.0
        assert mem["total_bytes"] > 0
        assert mem["available_bytes"] >= 0
        assert mem["used_bytes"] >= 0

    def test_disk_collector(self) -> None:
        disk = collect_disk_metrics()
        assert disk["read_bytes_per_sec"] >= 0.0
        assert disk["write_bytes_per_sec"] >= 0.0
        assert 0.0 <= disk["usage_percent"] <= 100.0
        assert disk["total_bytes"] >= 0

    def test_network_collector(self) -> None:
        net = collect_network_metrics()
        assert net["bytes_in_per_sec"] >= 0.0
        assert net["bytes_out_per_sec"] >= 0.0
        assert net["connections_active"] >= 0

    def test_process_collector(self) -> None:
        proc = collect_process_metrics(top_n=3)
        assert proc["process_count"] >= 1
        assert isinstance(proc["top_processes"], list)
        if proc["top_processes"]:
            top = proc["top_processes"][0]
            assert "pid" in top
            assert "name" in top
            assert "cpu_percent" in top
            assert "memory_percent" in top
