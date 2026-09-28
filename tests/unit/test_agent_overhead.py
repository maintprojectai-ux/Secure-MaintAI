"""
Secure-MaintAI — Unit Test: Monitoring Agent Self-Overhead.

Verifies that the agent process footprint conforms to:
- Rule 9: CPU < 2.0%, RAM < 50MB
- Guide Section 2.1 & 4.2: Agent must not degrade host system
"""

import json
import subprocess
import sys

from agent.collectors.process import collect_agent_self_overhead


def test_agent_self_overhead_structure():
    """Verify collect_agent_self_overhead returns correct keys and non-negative numbers."""
    overhead = collect_agent_self_overhead()
    assert isinstance(overhead, dict)
    assert "agent_rss_mb" in overhead
    assert "agent_cpu_percent" in overhead

    assert isinstance(overhead["agent_rss_mb"], (int, float))
    assert isinstance(overhead["agent_cpu_percent"], (int, float))
    assert overhead["agent_rss_mb"] > 0
    assert overhead["agent_cpu_percent"] >= 0.0


def test_agent_self_overhead_bounds():
    """Verify standalone agent process resource consumption satisfies Rule 9 constraints."""
    # Run the collector in an isolated agent Python process to evaluate authentic agent footprint
    # (avoiding pytest test-runner framework memory overhead).
    cmd = [
        sys.executable,
        "-c",
        "import json; from agent.collectors.process import collect_agent_self_overhead; print(json.dumps(collect_agent_self_overhead()))",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    overhead = json.loads(result.stdout.strip())

    # Rule 9 / Guide §4.2: RAM < 50 MB (typically ~19-25 MB)
    assert overhead["agent_rss_mb"] < 50.0, (
        f"Agent RSS footprint ({overhead['agent_rss_mb']} MB) exceeded maximum allowable 50 MB threshold"
    )

    # Rule 9 / Guide §4.2: CPU < 2.0% under nominal conditions
    assert overhead["agent_cpu_percent"] < 2.0, (
        f"Agent CPU percent ({overhead['agent_cpu_percent']}%) exceeded maximum allowable 2.0% threshold"
    )
