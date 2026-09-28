"""
Unit Tests — Agent Local Disk Buffer.

Tests disk-backed FIFO queueing, persistence, batch operations, and size constraints.
Per engineering rules Section 9: offline resilience surviving network drops.
"""

import shutil
import tempfile

import pytest

from agent.buffer import LocalTelemetryBuffer


@pytest.fixture
def temp_buffer() -> LocalTelemetryBuffer:
    """Provide an isolated temporary disk buffer for testing."""
    temp_dir = tempfile.mkdtemp()
    buffer = LocalTelemetryBuffer(buffer_dir=temp_dir, max_size_mb=1)
    yield buffer
    shutil.rmtree(temp_dir, ignore_errors=True)


class TestLocalTelemetryBuffer:
    """Test suite for LocalTelemetryBuffer."""

    def test_push_and_count(self, temp_buffer: LocalTelemetryBuffer) -> None:
        assert temp_buffer.count() == 0
        temp_buffer.push({"sample": "data_1"})
        temp_buffer.push({"sample": "data_2"})
        assert temp_buffer.count() == 2

    def test_peek_and_commit_batch(self, temp_buffer: LocalTelemetryBuffer) -> None:
        temp_buffer.push({"metric": "cpu", "value": 45.2})
        temp_buffer.push({"metric": "memory", "value": 78.1})
        temp_buffer.push({"metric": "disk", "value": 12.0})

        batch = temp_buffer.peek_batch(batch_size=2)
        assert len(batch) == 2
        assert batch[0][1]["metric"] == "cpu"
        assert batch[1][1]["metric"] == "memory"

        # Commit (remove) the 2 processed records
        record_ids = [batch[0][0], batch[1][0]]
        temp_buffer.commit_batch(record_ids)

        assert temp_buffer.count() == 1
        remaining_batch = temp_buffer.peek_batch(batch_size=5)
        assert len(remaining_batch) == 1
        assert remaining_batch[0][1]["metric"] == "disk"

    def test_clear_buffer(self, temp_buffer: LocalTelemetryBuffer) -> None:
        temp_buffer.push({"test": 1})
        temp_buffer.push({"test": 2})
        assert temp_buffer.count() == 2
        temp_buffer.clear()
        assert temp_buffer.count() == 0
