"""
Secure-MaintAI — Base Security Event Adapter Interface.

Per engineering rules Section 17:
- Normalized internal schema.
- Vendor-agnostic adapter layer.
- Graceful handling of malformed or incomplete external payloads.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from backend.schemas.security_event import SecurityEventCreate


class BaseSecurityAdapter(ABC):
    """Abstract interface for external security event normalization adapters."""

    @abstractmethod
    def parse_event(self, raw_data: dict[str, Any]) -> SecurityEventCreate | None:
        """
        Parse a single external event dictionary into a normalized SecurityEventCreate model.

        Parameters
        ----------
        raw_data:
            Raw external payload dictionary (e.g. from Wazuh, Sysmon, or network logger).

        Returns
        -------
        SecurityEventCreate or None if the payload cannot be parsed.
        """
        raise NotImplementedError

    def batch_parse(self, events: list[dict[str, Any]]) -> list[SecurityEventCreate]:
        """
        Parse a list of raw event payloads, discarding unparseable entries.

        Parameters
        ----------
        events:
            List of raw external payload dictionaries.

        Returns
        -------
        List of successfully parsed SecurityEventCreate instances.
        """
        results: list[SecurityEventCreate] = []
        for raw in events:
            parsed = self.parse_event(raw)
            if parsed is not None:
                results.append(parsed)
        return results
