#!/usr/bin/env python3
"""Rewrite the per-control 'Regulatory mappings' blocks in llms-full.txt from
data/<vertical>-controls.json.

llms-full.txt is hand-maintained prose, but each control block ends with a
verbatim copy of that control's mappings object. Those copies drifted from the
source data: citation text was revised, separators changed, and whole mapping
keys were added without the copies following. An agent that retrieves
llms-full.txt should get the same citations as one that reads /data, so this
script treats the JSON as authoritative and rewrites only the mapping lines.
Everything else in the file is left byte for byte alone.

Run after editing any vertical control schema, then run build/verify_pages.py.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "llms-full.txt")

# Section heading text in llms-full.txt to vertical slug.
VERTICAL_HEADINGS = {
    "Financial Services": "finance",
    "Healthcare": "healthcare",
    "Insurance": "insurance",
    "Public Sector": "public-sector",
    "Defense / DoD": "defense",
    "Manufacturing": "manufacturing",
}

HEADING = re.compile(r"^#{2,5} ")
SECTION = re.compile(r"^### (.+?)\s*$")
CONTROL = re.compile(r"^##### (SRF-[A-Z0-9-]+):")
MAPPING_LINE = re.compile(r"^  - [a-z0-9_]+: ")
MAPPINGS_HEAD = "Regulatory mappings:"


def load_controls():
    out = {}
    for slug in VERTICAL_HEADINGS.values():
        path = os.path.join(ROOT, "data", f"{slug}-controls.json")
        with open(path, encoding="utf-8") as fh:
            payload = json.load(fh)
        out[slug] = {c["id"]: c for c in payload["controls"]}
    return out


def mapping_lines(control):
    mappings = control.get("mappings") or {}
    return [f"  - {key}: {value}" for key, value in mappings.items()
            if key != "mapping_status_note"]


def find_blocks(lines):
    """Yield (start, end, vertical, control_id) for every control block."""
    vertical = None
    starts = []
    for idx, line in enumerate(lines):
        section = SECTION.match(line)
        if section and section.group(1) in VERTICAL_HEADINGS:
            vertical = VERTICAL_HEADINGS[section.group(1)]
        control = CONTROL.match(line)
        if control:
            starts.append((idx, vertical, control.group(1)))
    blocks = []
    for pos, (idx, vertical, cid) in enumerate(starts):
        limit = starts[pos + 1][0] if pos + 1 < len(starts) else len(lines)
        end = limit
        for probe in range(idx + 1, limit):
            if HEADING.match(lines[probe]):
                end = probe
                break
        blocks.append((idx, end, vertical, cid))
    return blocks


def main():
    with open(TARGET, encoding="utf-8") as fh:
        lines = fh.read().split("\n")

    controls = load_controls()
    blocks = find_blocks(lines)
    unknown = [(v, c) for _, _, v, c in blocks
               if v not in controls or c not in controls[v]]
    if unknown:
        print(f"ERROR: control blocks not found in data: {unknown[:5]}",
              file=sys.stderr)
        return 1

    rewritten = inserted = 0
    # Walk backwards so earlier line numbers stay valid as we splice.
    for start, end, vertical, cid in reversed(blocks):
        wanted = mapping_lines(controls[vertical][cid])
        body = lines[start:end]
        head = next((i for i, l in enumerate(body)
                     if l.strip() == MAPPINGS_HEAD), None)
        if head is None:
            tail = max(i for i, l in enumerate(body) if l.strip())
            lines[start + tail + 1:start + tail + 1] = \
                ["", MAPPINGS_HEAD] + wanted
            inserted += 1
            continue
        stop = head + 1
        while stop < len(body) and MAPPING_LINE.match(body[stop]):
            stop += 1
        current = body[head + 1:stop]
        if current != wanted:
            lines[start + head + 1:start + stop] = wanted
            rewritten += 1

    with open(TARGET, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    print(f"llms-full.txt: {len(blocks)} control blocks, "
          f"{rewritten} mapping lists rewritten, {inserted} inserted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
