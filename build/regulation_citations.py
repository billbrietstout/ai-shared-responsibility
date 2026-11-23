#!/usr/bin/env python3
"""Format control mappings.regulation citations for human-facing output.

Source data keeps mapping_key values on controls[].mappings. This module turns
them into readable labels joined to citation text, with optional URLs from
data/regulations.json.
"""

from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGULATIONS_PATH = os.path.join(ROOT, "data", "regulations.json")

# Vertical-only mapping keys with no regulations.json entry.
_LOCAL_LABELS = {
    "anti_capture_principle": "Anti-capture principle",
    "layers_split": "Layer assignment (federated consortium)",
    "tap_adr": "Tapestry ADR",
    "work_group_charter": "Work group charter",
}

RAW_MAPPING_LINE = re.compile(r"^  - [a-z][a-z0-9_]*:\s")


def load_regulations(path: str | None = None) -> dict[str, dict]:
    data = json.load(open(path or REGULATIONS_PATH, encoding="utf-8"))
    out = {}
    for item in data.get("items") or []:
        key = item.get("mapping_key")
        if key:
            out[key] = {
                "id": item["id"],
                "short": item.get("short") or item.get("name"),
                "url": item.get("url") or "",
            }
    return out


def instrument_label(mapping_key: str, reg_by_key: dict[str, dict]) -> str:
    hit = reg_by_key.get(mapping_key)
    if hit:
        return hit["short"]
    return _LOCAL_LABELS.get(mapping_key) or mapping_key.replace("_", " ").title()


def is_skipped_key(mapping_key: str) -> bool:
    return mapping_key == "mapping_status_note"


def is_placeholder_value(value: str) -> bool:
    v = (value or "").strip()
    return v == "" or v == "N/A" or v.startswith("TBD")


def format_plain(mapping_key: str, value: str, reg_by_key: dict[str, dict]) -> str:
    """Return text like 'EU AI Act, Article 9 (Risk management system)'."""
    label = instrument_label(mapping_key, reg_by_key)
    v = (value or "").strip()
    if is_placeholder_value(v):
        return f"{label}: {v}"
    return f"{label}, {v}"


def format_markdown_line(
    mapping_key: str, value: str, reg_by_key: dict[str, dict]
) -> str:
    text = format_plain(mapping_key, value, reg_by_key)
    url = (reg_by_key.get(mapping_key) or {}).get("url") or ""
    if url:
        return f"  - [{text}]({url})"
    return f"  - {text}"


def format_html_item(
    mapping_key: str, value: str, reg_by_key: dict[str, dict], esc_html
) -> str:
    text = format_plain(mapping_key, value, reg_by_key)
    url = (reg_by_key.get(mapping_key) or {}).get("url") or ""
    body = esc_html(text)
    if url and not is_placeholder_value((value or "").strip()):
        return (
            f'<a class="mapping-tag mapping-tag--linked" href="{esc_html(url)}" '
            f'target="_blank" rel="noopener">{body}</a>'
        )
    if url:
        label = esc_html(instrument_label(mapping_key, reg_by_key))
        return (
            f'<span class="mapping-tag">{label}: '
            f'{esc_html((value or "").strip())}</span>'
        )
    return f'<span class="mapping-tag">{body}</span>'


def mapping_lines_for_control(
    control: dict, reg_by_key: dict[str, dict], markdown: bool = True
) -> list[str]:
    mappings = control.get("mappings") or {}
    lines = []
    for key in sorted(mappings.keys()):
        if is_skipped_key(key):
            continue
        val = mappings[key]
        if val is None:
            continue
        if markdown:
            lines.append(format_markdown_line(key, str(val), reg_by_key))
        else:
            lines.append(f"  - {format_plain(key, str(val), reg_by_key)}")
    return lines


def mapping_lines_sorted(control: dict, reg_by_key: dict[str, dict]) -> list[str]:
    """Markdown lines in schema key order (not sorted) for llms-full parity."""
    mappings = control.get("mappings") or {}
    lines = []
    for key, val in mappings.items():
        if is_skipped_key(key) or val is None:
            continue
        lines.append(format_markdown_line(key, str(val), reg_by_key))
    return lines