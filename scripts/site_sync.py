#!/usr/bin/env python3
"""Build a candidate agentic principles update from monitor change IDs.

Usage:
  python3 scripts/site_sync.py \\
    --whitepapers build/fixtures/whitepapers.json \\
    --changes path/to/whitepapers_changes.json

whitepapers_changes.json shape:
  {
    "changed": ["WP-0007", "WP-0020"],
    "updated": "2026-10-30"
  }

Optional lists, written by the weekly fixture job:
  "added", "modified", and "removed"

When "added" or "modified" is present, the report uses those lists.
Otherwise it uses "changed". "removed" is optional either way.

Writes:
  reports/principles-diff.md
  reports/ai-agentic-principles.candidate.json
  reports/ai-agentic-principles.slim.candidate.json

Never removes a principle or a source on its own. Retirements and papers
that left the export are proposed in the diff only. Does not write data/
until a human copies the candidate after review.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

import validate_principles as vp

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
    papers = vp.load_papers(args.whitepapers)
    changes = load_json(args.changes)
    stamp = changes.get("updated") or date.today().isoformat()

    def id_list(key: str) -> list[str]:
        values = changes.get(key) or []
        if not isinstance(values, list):
            return []
        out = []
        for item in values:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
        return out

    removed_ids = id_list("removed")
    removed_set = set(removed_ids)
    added_ids = id_list("added")
    modified_ids = id_list("modified")
    use_split = "added" in changes or "modified" in changes
    if use_split:
        changed_ids = []
        seen: set[str] = set()
        for wp_id in added_ids + modified_ids:
            if wp_id in removed_set or wp_id in seen:
                continue
            seen.add(wp_id)
            changed_ids.append(wp_id)
        added_set = set(added_ids)
    else:
        changed_ids = [
            wp_id for wp_id in id_list("changed") if wp_id not in removed_set
        ]
        added_set = None

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
    modified_without_source = []

    for wp_id in changed_ids:
        paper = papers.get(wp_id)
        code = code_by_wp.get(wp_id)
        if paper and vp.normalized_decision(paper.get("decision")) in (
            "delete_candidate",
            "duplicate",
        ):
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
            # Refresh title, organization, and URL from the monitor when present.
            before = {
                "title": src.get("title"),
                "org": src.get("org"),
                "url": src.get("url"),
                "wp_id": src.get("wp_id"),
                "monitor_issue": src.get("monitor_issue"),
            }
            if paper.get("title"):
                src["title"] = paper["title"]
            org = paper.get("source_org") or paper.get("org")
            if org:
                src["org"] = org
            if paper.get("url"):
                src["url"] = paper["url"]
            src["wp_id"] = wp_id
            src["inventory_status"] = "matched"
            src.pop("inventory_note", None)
            issue = vp.paper_issue_number(paper)
            if issue is not None:
                src["monitor_issue"] = issue
            after = {
                "title": src.get("title"),
                "org": src.get("org"),
                "url": src.get("url"),
                "wp_id": src.get("wp_id"),
                "monitor_issue": src.get("monitor_issue"),
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
            item = {
                "wp_id": wp_id,
                "title": paper.get("title"),
                "url": paper.get("url"),
                "decision": paper.get("decision"),
                "action": (
                    "No site source code cites this paper yet. "
                    "Add a source row and principles only after review."
                ),
            }
            if added_set is not None and wp_id not in added_set:
                modified_without_source.append(item)
            else:
                new_items.append(item)

    removed_items = []
    for wp_id in removed_ids:
        code = code_by_wp.get(wp_id)
        if code:
            action = (
                "This WP- id is not in the new monitor export. "
                f"Propose retiring site principles that cite only {code}. "
                "Do not auto-delete."
            )
        else:
            action = (
                "This WP- id is not in the new monitor export. "
                "No site source cites it."
            )
        removed_items.append({"wp_id": wp_id, "code": code, "action": action})

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
        f"Removed WP- IDs: {', '.join(removed_ids) or '(none)'}",
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

    lines.extend(["", "## Modified papers with no site source"])
    if not modified_without_source:
        lines.append("None.")
    for item in modified_without_source:
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

    lines.extend(["", "## Removed from the monitor export"])
    if not removed_items:
        lines.append("None.")
    for item in removed_items:
        code = item.get("code")
        label = f"`{item['wp_id']}` / `{code}`" if code else f"`{item['wp_id']}`"
        lines.append(f"- {label}: {item['action']}")

    reported = {
        item["wp_id"]
        for item in (
            new_items + modified_without_source + changed_items + retired_items
        )
    }
    lines.extend(["", "## Unknown WP- IDs"])
    unknown_lines = []
    for wp_id in unknown:
        if wp_id in code_by_wp or wp_id in reported or wp_id in removed_set:
            continue
        unknown_lines.append(f"- `{wp_id}` not linked to a site source code.")
    if not unknown_lines:
        lines.append("None.")
    else:
        lines.extend(unknown_lines)

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
            "4. Open a pull request. Do not push to develop or main.",
            "5. If the monitor export changed, refresh "
            "`build/fixtures/whitepapers.json` with "
            "`python3 scripts/sync_whitepapers_fixture.py`.",
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
