#!/usr/bin/env python3
"""Format control mappings.regulation citations for human-facing output.

Source data keeps mapping_key values on controls[].mappings. This module turns
them into readable labels joined to citation text, with optional pinpoint URLs
from data/regulation-pinpoints.json falling back to data/regulations.json.
"""

from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGULATIONS_PATH = os.path.join(ROOT, "data", "regulations.json")
PINPOINTS_PATH = os.path.join(ROOT, "data", "regulation-pinpoints.json")

# Vertical-only mapping keys with no regulations.json entry.
_LOCAL_LABELS = {
    "anti_capture_principle": "Anti-capture principle",
    "layers_split": "Layer assignment (federated consortium)",
    "tap_adr": "Tapestry ADR",
    "work_group_charter": "Work group charter",
}

MULTI_CITE_KEYS = frozenset(
    {
        "eu_ai_act",
        "finos_aigf",
        "sr26_2",
        "aicm",
        "m_25_21",
        "m_25_22",
        "fedramp_20x_ksi",
        "naic_model_bulletin",
        "naic_eval_tool",
        "co_reg_10_1_1",
        "nydfs_cl7",
        "owasp_llm",
        "dod_rai_strategy",
        "dodi_5000_90",
        "dodi_5000_89",
        "cc_srg",
        "cmmc_2_0",
        "nist_ai_rmf",
        "hipaa",
    }
)

RAW_MAPPING_LINE = re.compile(r"^  - [a-z][a-z0-9_]*:\s")

EU_ARTICLE_RE = re.compile(r"^Article\s+(\d+)", re.IGNORECASE)
EU_ANNEX_RE = re.compile(r"^Annex\s+([IVXLC]+)", re.IGNORECASE)

EU_CITATION_GRAMMAR = re.compile(
    r"^(Article\s+\d+(?:\(\w+\))*|Annex\s+[IVXLC]+)\s*(\(.*\))?$"
)

ECFR_HIPAA_SECTION_RE = re.compile(
    r"(?:45\s*CFR\s*)?§\s*164\.(\d{3})\b",
    re.IGNORECASE,
)


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


def load_pinpoints(path: str | None = None) -> dict:
    p = path or PINPOINTS_PATH
    if not os.path.isfile(p):
        return {"instruments": {}}
    return json.load(open(p, encoding="utf-8"))


def _anchor_allowlist(inst: dict) -> set[str] | None:
    if inst.get("verified_anchors"):
        return set(inst["verified_anchors"])
    fixture = inst.get("anchor_fixture")
    if fixture:
        fpath = fixture if os.path.isabs(fixture) else os.path.join(ROOT, fixture)
        if os.path.isfile(fpath):
            data = json.load(open(fpath, encoding="utf-8"))
            return set(data.get("anchors") or [])
    return None


def ecfr_hipaa_section_url(citation: str, inst: dict) -> str | None:
    """Map a HIPAA CFR citation token to an eCFR section URL (no paragraph fragment)."""
    m = ECFR_HIPAA_SECTION_RE.search(citation or "")
    if not m:
        return None
    section = m.group(1)
    allow = inst.get("verified_sections")
    if allow is not None and section not in allow:
        return None
    return f"https://www.ecfr.gov/current/title-45/section-164.{section}"


def eurlex_anchor_id(citation: str) -> str | None:
    """Map a single citation token to a EUR-Lex fragment id, if any."""
    cite = (citation or "").strip()
    m = EU_ARTICLE_RE.match(cite)
    if m:
        return f"art_{m.group(1)}"
    m = EU_ANNEX_RE.match(cite)
    if m:
        return f"anx_{m.group(1).upper()}"
    return None


def split_citations(mapping_key: str, value: str) -> list[str]:
    v = (value or "").strip()
    if not v:
        return []
    if mapping_key in MULTI_CITE_KEYS and "; " in v:
        return [p.strip() for p in v.split("; ") if p.strip()]
    return [v]


def document_url(mapping_key: str, reg_by_key: dict[str, dict]) -> str:
    return (reg_by_key.get(mapping_key) or {}).get("url") or ""


def citation_pinpoint_url(
    mapping_key: str,
    citation: str,
    reg_by_key: dict[str, dict],
    pinpoints: dict | None = None,
) -> str:
    """Resolve a pinpoint URL for one citation token, or the instrument document URL."""
    pinpoints = pinpoints if pinpoints is not None else load_pinpoints()
    inst = (pinpoints.get("instruments") or {}).get(mapping_key) or {}
    doc = document_url(mapping_key, reg_by_key)
    resolver = inst.get("resolver") or "document_only"

    if resolver == "iso_catalog":
        return doc
    if resolver == "document_only":
        return doc

    if resolver == "eurlex":
        base = (inst.get("html_base") or doc).rstrip("#")
        anchor = eurlex_anchor_id(citation)
        if not anchor:
            return doc
        allow = _anchor_allowlist(inst)
        if allow is not None and anchor not in allow:
            return doc
        return f"{base}#{anchor}"

    if resolver == "ecfr":
        url = ecfr_hipaa_section_url(citation, inst)
        if url:
            return url
        return doc

    return doc


def mapping_pinpoint_url(
    mapping_key: str,
    value: str,
    reg_by_key: dict[str, dict],
    pinpoints: dict | None = None,
) -> str:
    """URL for a full mappings[field] value (multi-cite uses first pinpoint hit)."""
    cites = split_citations(mapping_key, value)
    if not cites:
        return document_url(mapping_key, reg_by_key)
    pinpoints = pinpoints if pinpoints is not None else load_pinpoints()
    doc = document_url(mapping_key, reg_by_key)
    for cite in cites:
        url = citation_pinpoint_url(mapping_key, cite, reg_by_key, pinpoints)
        if url and url != doc:
            return url
    return citation_pinpoint_url(mapping_key, cites[0], reg_by_key, pinpoints)


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
    mapping_key: str,
    value: str,
    reg_by_key: dict[str, dict],
    pinpoints: dict | None = None,
) -> str:
    text = format_plain(mapping_key, value, reg_by_key)
    if is_placeholder_value((value or "").strip()):
        return f"  - {text}"
    url = mapping_pinpoint_url(mapping_key, value, reg_by_key, pinpoints)
    if url:
        return f"  - [{text}]({url})"
    return f"  - {text}"


def format_html_item(
    mapping_key: str,
    value: str,
    reg_by_key: dict[str, dict],
    esc_html,
    pinpoints: dict | None = None,
) -> str:
    text = format_plain(mapping_key, value, reg_by_key)
    url = mapping_pinpoint_url(mapping_key, value, reg_by_key, pinpoints)
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
    control: dict,
    reg_by_key: dict[str, dict],
    markdown: bool = True,
    pinpoints: dict | None = None,
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
            lines.append(format_markdown_line(key, str(val), reg_by_key, pinpoints))
        else:
            lines.append(f"  - {format_plain(key, str(val), reg_by_key)}")
    return lines


def mapping_lines_sorted(
    control: dict, reg_by_key: dict[str, dict], pinpoints: dict | None = None
) -> list[str]:
    """Markdown lines in schema key order (not sorted) for llms-full parity."""
    mappings = control.get("mappings") or {}
    lines = []
    for key, val in mappings.items():
        if is_skipped_key(key) or val is None:
            continue
        lines.append(format_markdown_line(key, str(val), reg_by_key, pinpoints))
    return lines