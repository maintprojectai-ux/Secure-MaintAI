"""
Secure-MaintAI — Local Telemetry Disk Buffer.

Thread-safe, disk-backed FIFO buffer implemented with SQLite.
Stores telemetry records during network outages and flushes them automatically
when connectivity is restored.

Per engineering rules Section 9:
- Max buffer size limit (default 50MB).
- Oldest-record FIFO eviction if storage limit is exceeded.
- Crash-resilient and persists across agent restarts.
"""

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any


class LocalTelemetryBuffer:
    """Disk-backed SQLite FIFO buffer for offline telemetry resilience."""

    def __init__(
        self,
        buffer_dir: str = ".agent_buffer",
        db_filename: str = "telemetry_queue.db",
        max_size_mb: int = 50,
    ) -> None:
        self.buffer_dir = Path(buffer_dir)
        self.buffer_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.buffer_dir / db_filename
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self) -> None:
        """Initialize the buffer table and indexes."""
        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS buffered_telemetry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def push(self, record: dict[str, Any]) -> None:
        """
        Push a telemetry record into the buffer.
        Enforces max disk size with oldest-first eviction.
        """
        payload_str = json.dumps(record, default=str)
        with self._lock:
            # Check file size for FIFO eviction
            if (
                self.db_path.exists()
                and self.db_path.stat().st_size >= self.max_size_bytes
            ):
                self._evict_oldest(batch_size=100)

            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO buffered_telemetry (payload) VALUES (?)",
                    (payload_str,),
                )
                conn.commit()

    def peek_batch(self, batch_size: int = 50) -> list[tuple[int, dict[str, Any]]]:
        """
        Peek at the oldest batch of records without removing them.

        Returns:
            List of (record_id, record_dict).
        """
        with self._lock, sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT id, payload FROM buffered_telemetry ORDER BY id ASC LIMIT ?",
                (batch_size,),
            )
            rows = cursor.fetchall()
            results: list[tuple[int, dict[str, Any]]] = []
            for row_id, payload_str in rows:
                try:
                    results.append((row_id, json.loads(payload_str)))
                except json.JSONDecodeError:
                    # Remove corrupt row
                    conn.execute(
                        "DELETE FROM buffered_telemetry WHERE id = ?", (row_id,)
                    )
                    conn.commit()
            return results

    def commit_batch(self, record_ids: list[int]) -> None:
        """Remove successfully transmitted records from the buffer."""
        if not record_ids:
            return
        with self._lock, sqlite3.connect(self.db_path) as conn:
            placeholders = ",".join("?" for _ in record_ids)
            conn.execute(
                f"DELETE FROM buffered_telemetry WHERE id IN ({placeholders})",
                record_ids,
            )
            conn.commit()

    def _evict_oldest(self, batch_size: int = 100) -> None:
        """Evict the oldest records to respect the maximum buffer size limit."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                DELETE FROM buffered_telemetry
                WHERE id IN (
                    SELECT id FROM buffered_telemetry ORDER BY id ASC LIMIT ?
                )
                """,
                (batch_size,),
            )
            conn.commit()

    def count(self) -> int:
        """Get the number of pending records in the buffer."""
        with self._lock, sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM buffered_telemetry")
            row = cursor.fetchone()
            return row[0] if row else 0

    def clear(self) -> None:
        """Clear all records from the buffer."""
        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM buffered_telemetry")
            conn.commit()
