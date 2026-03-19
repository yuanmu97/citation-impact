"""CCF venue ranking lookup with fuzzy matching."""

from __future__ import annotations

import json
from pathlib import Path


class CCFLookup:
    """Lookup CCF rankings for academic venues (journals and conferences)."""

    def __init__(self, data_path: str | None = None):
        if data_path is None:
            data_path = str(
                Path(__file__).resolve().parent.parent / "data" / "ccf_rankings.json"
            )

        with open(data_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        self._abbr_map: dict[str, str] = {}
        self._fullname_map: dict[str, str] = {}
        self._entries: list[tuple[str, str, str]] = []

        for category in ("journals", "conferences"):
            section = raw.get(category, {})
            for abbr, info in section.items():
                rank = info.get("rank", "")
                fullname = info.get("fullname", "")

                self._abbr_map[abbr.lower()] = rank
                if fullname:
                    self._fullname_map[fullname.lower()] = rank
                self._entries.append((abbr.lower(), fullname.lower(), rank))

    def lookup(self, venue_name: str) -> str | None:
        """Look up the CCF ranking for a venue name.

        Matching strategy (in order):
          1. Exact match on abbreviation (case-insensitive)
          2. Exact match on full name (case-insensitive)
          3. Substring containment: venue_name contains an abbreviation,
             or an abbreviation/fullname contains parts of venue_name

        Args:
            venue_name: The venue name to look up.

        Returns:
            "A", "B", "C", or None if no match found.
        """
        if not venue_name:
            return None

        name_lower = venue_name.strip().lower()

        if name_lower in self._abbr_map:
            return self._abbr_map[name_lower]

        if name_lower in self._fullname_map:
            return self._fullname_map[name_lower]

        for abbr, fullname, rank in self._entries:
            if abbr and abbr in name_lower:
                return rank

        for abbr, fullname, rank in self._entries:
            if fullname and fullname in name_lower:
                return rank

        for abbr, fullname, rank in self._entries:
            if name_lower and name_lower in fullname:
                return rank

        return None
