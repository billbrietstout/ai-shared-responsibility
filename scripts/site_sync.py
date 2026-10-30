#!/usr/bin/env python3
"""Build a candidate agentic principles update from monitor change IDs.

Usage:
  python3 scripts/site_sync.py \\
    --whitepapers build/fixtures/whitepapers.json \\
    --changes path/to/whitepapers_changes.json

whitepapers_changes.json shape:
  { "changed": ["WP-0007", "WP-0020"], "updated": "2026-10-30" }

Writes:
  reports/principles-diff.md
  reports/ai-agentic-principles.candidate.json

Never removes a principle on its own. Retirements are proposed in the diff
only. Does not write data/ until a human copies the candidate after review.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AGENTIC = ROOT / "data" / "ai-agentic-principles.json"
DEFAULT_WP = ROOT / "build" / "fixtures" / "whitepapers.json"
DEFAULT_OUT_DIR = ROOT / "reports"


def load_json(path: Path) -> object:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def norm_url(url: str) -> str:
    if not url:
        return ""
    u = urlsplit(url.strip())
    host = u.netloc.lower().removeprefix("www.")
    path = u.path.rstrip("/")
    return f"{host}{path}".lower()


def slim_agentic(agentic: dict) -> dict:
    principles = [
        {
            "id": p["id"],
            "section": p["section"],
            "category": p["category"],
            "statement": p["statement"],
        }
        for p in agentic["principles"]
    ]
    gap = {
        k: {
            "classic_ids": v["classic_ids"],
            "kind": v["kind"],
            "note": v["note"],
        }
        for k, v in agentic.get("gap_index", {}).items()
    }
    return {
        "$schema_version": agentic.get("$schema_version", "1.0"),
        "projection": "slim",
        "full_catalog": (
            "https://aisharedresponsibility.com/data/ai-agentic-principles.json"
        ),
        "description": (
            "Slim projection of ai-agentic-principles.json for assessment "
            "mapping: id, statement, section, category, and gap_index."
        ),
        "updated": agentic["updated"],
        "count": agentic["count"],
        "gap_index_description": agentic.get("gap_index_description", ""),
        "gap_index": gap,
        "principles": principles,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--whitepapers", type=Path, default=DEFAULT_WP)
    ap.add_argument("--changes", type=Path, required=True)
    ap.add_argument("--agentic", type=Path, default=DEFAULT_AGENTIC)
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = ap.parse_args()

    agentic = load_json(args.agentic)
    papers_doc = load_json(args.whitepapers)
    papers = {
        p["id"]: p
        for p in (papers_doc.get("papers") if isinstance(papers_doc, dict) else papers_doc)
        if p.get("id")
    }
    changes = load_json(args.changes)
    changed_ids = list(changes.get("changed") or [])
    stamp = changes.get("updated") or date.today().isoformat()

    sources = agentic.get("sources", {})
    code_by_wp = {
        src.get("wp_id"): code
        for code, src in sources.items()
        if src.get("wp_id")
    }

    affected_codes = []
    unknown = []
    for wp_id in changed_ids:
        code = code_by_wp.get(wp_id)
        if code:
            affected_codes.append(code)
        else:
            unknown.append(wp_id)

    affected_principles = [
        p
        for p in agentic.get("principles", [])
        if any(c in affected_codes for c in p.get("src", []))
    ]

    new_items = []
    changed_items = []
    retired_items = []

    for wp_id in changed_ids:
        paper = papers.get(wp_id)
        code = code_by_wp.get(wp_id)
        if paper and paper.get("decision") in ("Delete candidate", "Duplicate"):
            if code:
                retired_items.append(
                    {
                        "wp_id": wp_id,
                        "code": code,
                        "decision": paper.get("decision"),
                        "title": paper.get("title"),
                        "action": (
                            "Propose retiring site principles that cite only "
                            f"{code}; do not auto-delete."
                        ),
                    }
                )
            continue
        if code and paper:
            src = sources[code]
            # Refresh title/org/url from monitor when present.
            before = {
                "title": src.get("title"),
                "url": src.get("url"),
                "wp_id": src.get("wp_id"),
            }
            if paper.get("title"):
                src["title"] = paper["title"]
            if paper.get("url"):
                src["url"] = paper["url"]
            src["wp_id"] = wp_id
            src["inventory_status"] = "matched"
            src.pop("inventory_note", None)
            after = {
                "title": src.get("title"),
                "url": src.get("url"),
                "wp_id": src.get("wp_id"),
            }
            changed_items.append(
                {
                    "wp_id": wp_id,
                    "code": code,
                    "before": before,
                    "after": after,
                    "principle_ids": [
                        p["id"]
                        for p in affected_principles
                        if code in p.get("src", [])
                    ],
                }
            )
        elif paper and not code:
            new_items.append(
                {
                    "wp_id": wp_id,
                    "title": paper.get("title"),
                    "url": paper.get("url"),
                    "decision": paper.get("decision"),
                    "action": (
                        "No site source code cites this paper yet. "
                        "Add a source row and principles only after review."
                    ),
                }
            )

    agentic["updated"] = stamp
    agentic["count"] = len(agentic.get("principles", []))

    args.out_dir.mkdir(parents=True, exist_ok=True)
    candidate_path = args.out_dir / "ai-agentic-principles.candidate.json"
    slim_path = args.out_dir / "ai-agentic-principles.slim.candidate.json"
    diff_path = args.out_dir / "principles-diff.md"

    with candidate_path.open("w", encoding="utf-8") as fh:
        json.dump(agentic, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    with slim_path.open("w", encoding="utf-8") as fh:
        json.dump(slim_agentic(agentic), fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    lines = [
        "# Principles sync diff",
        "",
        f"Updated: {stamp}",
        f"Changed WP- IDs: {', '.join(changed_ids) or '(none)'}",
        "",
        "## Changed sources",
    ]
    if not changed_items:
        lines.append("None.")
    for item in changed_items:
        lines.append(
            f"- `{item['wp_id']}` / `{item['code']}`: "
            f"{len(item['principle_ids'])} principle(s) cite this source."
        )
        if item["before"] != item["after"]:
            lines.append(f"  - before: `{item['before']}`")
            lines.append(f"  - after: `{item['after']}`")

    lines.extend(["", "## New monitor papers (no site source yet)"])
    if not new_items:
        lines.append("None.")
    for item in new_items:
        lines.append(
            f"- `{item['wp_id']}` {item.get('title')} "
            f"({item.get('decision')}): {item['action']}"
        )

    lines.extend(["", "## Proposed retirements"])
    if not retired_items:
        lines.append("None.")
    for item in retired_items:
        lines.append(
            f"- `{item['wp_id']}` / `{item.get('code')}` "
            f"({item['decision']}): {item['action']}"
        )

    lines.extend(["", "## Unknown WP- IDs"])
    if not unknown:
        lines.append("None.")
    else:
        for wp_id in unknown:
            if wp_id in code_by_wp:
                continue
            lines.append(f"- `{wp_id}` not linked to a site source code.")

    lines.extend(
        [
            "",
            "## Next steps",
            "1. Review this diff.",
            "2. Run `python3 scripts/validate_principles.py "
            "--agentic reports/ai-agentic-principles.candidate.json`.",
            "3. If accepted, copy the candidate into "
            "`data/ai-agentic-principles.json` and regenerate the slim file "
            "with `python3 build/generate_principle_catalogs.py`, or copy "
            "both candidate files.",
            "4. Open a pull request. Do not push to main.",
            "",
        ]
    )
    diff_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote {diff_path}")
    print(f"Wrote {candidate_path}")
    print(f"Wrote {slim_path}")
    print(
        f"Affected sources: {len(affected_codes)}; "
        f"principles citing them: {len(affected_principles)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
