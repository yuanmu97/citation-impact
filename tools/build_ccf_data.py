#!/usr/bin/env python3
"""
Fetch CCF ranking data from atom-im/ccf GitHub repo and build ccf_rankings.json.

Usage:
    python tools/build_ccf_data.py
"""

import json
import os
import re
import urllib.request

TOML_URL = "https://raw.githubusercontent.com/atom-im/ccf/master/config.toml"
OUTPUT_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "agent", "data", "ccf_rankings.json"),
    os.path.join(os.path.dirname(__file__), "..", "web", "src", "data", "ccf_rankings.json"),
]


def download_toml() -> str:
    print(f"Downloading config.toml from {TOML_URL} ...")
    req = urllib.request.Request(TOML_URL, headers={"User-Agent": "citation-impact-tool"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse_toml_entries(text: str):
    """Lightweight TOML list parser – avoids external dependency."""
    journals: list[dict] = []
    conferences: list[dict] = []

    current_section = None
    current_entry: dict = {}

    for line in text.splitlines():
        stripped = line.strip()

        if stripped == "[[params.journal.list]]":
            if current_entry and current_section is not None:
                (journals if current_section == "journal" else conferences).append(current_entry)
            current_section = "journal"
            current_entry = {}
            continue
        elif stripped == "[[params.conf.list]]":
            if current_entry and current_section is not None:
                (journals if current_section == "journal" else conferences).append(current_entry)
            current_section = "conf"
            current_entry = {}
            continue

        if current_section is None:
            continue

        m = re.match(r'(\w+)\s*=\s*"(.*?)"', stripped)
        if m:
            current_entry[m.group(1)] = m.group(2)

    if current_entry and current_section is not None:
        (journals if current_section == "journal" else conferences).append(current_entry)

    return journals, conferences


def build_rankings_json(journals: list[dict], conferences: list[dict]) -> dict:
    result = {"journals": {}, "conferences": {}, "all_by_name": {}}

    for entry in journals:
        abbr = entry.get("abbr", "").strip()
        if not abbr:
            continue
        result["journals"][abbr] = {
            "fullname": entry.get("fullname", ""),
            "rank": entry.get("rank", ""),
            "field": entry.get("field", ""),
            "publisher": entry.get("publisher", ""),
            "url": entry.get("url", ""),
        }
        rank = entry.get("rank", "")
        result["all_by_name"][abbr.lower()] = rank
        fullname = entry.get("fullname", "")
        if fullname:
            result["all_by_name"][fullname.lower()] = rank

    for entry in conferences:
        abbr = entry.get("abbr", "").strip()
        if not abbr:
            continue
        result["conferences"][abbr] = {
            "fullname": entry.get("fullname", ""),
            "rank": entry.get("rank", ""),
            "field": entry.get("field", ""),
            "publisher": entry.get("publisher", ""),
            "url": entry.get("url", ""),
        }
        rank = entry.get("rank", "")
        result["all_by_name"][abbr.lower()] = rank
        fullname = entry.get("fullname", "")
        if fullname:
            result["all_by_name"][fullname.lower()] = rank

    return result


def main():
    toml_text = download_toml()
    journals, conferences = parse_toml_entries(toml_text)
    print(f"Parsed {len(journals)} journals, {len(conferences)} conferences")

    rankings = build_rankings_json(journals, conferences)
    print(f"Built {len(rankings['all_by_name'])} lookup entries")

    for path in OUTPUT_PATHS:
        abs_path = os.path.abspath(path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as f:
            json.dump(rankings, f, ensure_ascii=False, indent=2)
        print(f"Written to {abs_path}")

    print("Done!")


if __name__ == "__main__":
    main()
