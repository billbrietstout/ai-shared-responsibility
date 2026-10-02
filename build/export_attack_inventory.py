#!/usr/bin/env python3
"""Export /data/attack-inventory.json as claims-test C-attacks rows.

The output is a pinned source for one claims-test run. It carries the
inventory version and catalog pins so the run can cite them, and one row per
selected entry in the C-attacks row shape (pack 1.0.8). draft_overlap and
stage stay null: the run judges overlap against its own draft.

Selection:
  --topics a,b       entries whose topics intersect the list
  --include-general  with --topics, also keep entries that have no topics
  --scope s1,s2      ai, agentic, classical-reopened
  --ids id1,id2      explicit atk- ids, in the order given

Usage:
  python3 build/export_attack_inventory.py --topics telemetry,MCP --format md
  python3 build/export_attack_inventory.py --scope agentic --out /tmp/attacks.json
"""

import argparse
import json
import pathlib
import sys

QUALITY_RANK = {"exact": 0, "closest": 1, "analogy": 2}
CATALOG_RANK = {"mitre-atlas": 0, "owasp-llm-top10": 1, "owasp-agentic-threats": 2, "owasp-dsgai": 3, "cwe": 4}
SITE = "https://aisharedresponsibility.com"


def format_taxonomy(ref, catalogs):
    if ref["catalog"] == "owasp-agentic-threats":
        return f"OWASP Agentic {ref['id']} (v{catalogs['owasp-agentic-threats']['version']})"
    return ref["id"]


def pick_taxonomy(entry):
    refs = [r for r in entry["taxonomy_refs"] if r["verified"]]
    if not refs:
        refs = entry["taxonomy_refs"]
    if not refs:
        return None
    return min(refs, key=lambda r: (QUALITY_RANK[r["mapping_quality"]], CATALOG_RANK[r["catalog"]]))


def pick_paper(entry):
    papers = [p for p in entry["paper_refs"] if p["verified"]] or entry["paper_refs"]
    if papers:
        p = papers[0]
        text = f"arXiv:{p['id']}" if p["type"] == "arxiv" else f"doi:{p['id']}"
        return text, p["verified"]
    incidents = [x for x in entry["incident_refs"] if x["type"] in ("cve", "atlas-case-study")]
    incidents = [x for x in incidents if x["verified"]] or incidents
    if incidents:
        return incidents[0]["id"], incidents[0]["verified"]
    return None, True


def to_row(n, entry, catalogs):
    tax = pick_taxonomy(entry)
    paper, paper_ok = pick_paper(entry)
    tax_ok = tax["verified"] if tax else True
    return {
        "id": f"ATT-{n:02d}",
        "name": entry["name"],
        "failure_mode": entry["failure_mode"],
        "family": entry["family"],
        "taxonomy_ref": format_taxonomy(tax, catalogs) if tax else None,
        "paper_ref": paper,
        "evidence": "pinned",
        "citation_status": "resolved_pinned" if (tax_ok and paper_ok) else "unresolved_unpinned",
        "draft_overlap": None,
        "stage": None,
        "inventory_id": entry["id"],
    }


def select(entries, topics, include_general, scopes, ids):
    active = [e for e in entries if e["status"] == "active"]
    if ids:
        by_id = {e["id"]: e for e in active}
        missing = [i for i in ids if i not in by_id]
        if missing:
            sys.exit(f"unknown or inactive ids: {', '.join(missing)}")
        active = [by_id[i] for i in ids]
    if scopes:
        active = [e for e in active if e["scope"] in scopes]
    if topics:
        active = [e for e in active if set(e["topics"]) & topics or (include_general and not e["topics"])]
    return active


def to_markdown(doc, rows):
    lines = [
        f"Attack inventory {doc['inventory_version']} ({SITE}/data/attack-inventory.json). "
        f"Draft overlap is left for the run to judge.",
        "",
        "| ATT | Name | Family | Catalog | Paper or incident | Citation status | Failure mode |",
        "| :-- | :-- | :-- | :-- | :-- | :-- | :-- |",
    ]
    for r in rows:
        lines.append(f"| {r['id']} | {r['name']} | {r['family']} | {r['taxonomy_ref'] or 'none'} | "
                     f"{r['paper_ref'] or 'none'} | {r['citation_status']} | {r['failure_mode']} |")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=pathlib.Path(__file__).resolve().parent.parent, type=pathlib.Path)
    ap.add_argument("--topics", default="")
    ap.add_argument("--include-general", action="store_true")
    ap.add_argument("--scope", default="")
    ap.add_argument("--ids", default="")
    ap.add_argument("--format", choices=("json", "md"), default="json")
    ap.add_argument("--out")
    a = ap.parse_args()

    doc = json.loads((a.root / "data" / "attack-inventory.json").read_text())
    split = lambda s: [x.strip() for x in s.split(",") if x.strip()]
    topics = set(split(a.topics))
    entries = select(doc["entries"], topics, a.include_general, set(split(a.scope)), split(a.ids))
    if len(entries) > 40:
        print(f"warning: {len(entries)} rows exceeds the C-attacks cap of 40; narrow the selection",
              file=sys.stderr)
    rows = [to_row(n, e, doc["catalogs"]) for n, e in enumerate(entries, start=1)]

    if a.format == "md":
        out = to_markdown(doc, rows)
    else:
        out = json.dumps({
            "pinned_source": {
                "id": "srf-attack-inventory",
                "url": f"{SITE}/data/attack-inventory.json",
                "inventory_version": doc["inventory_version"],
                "updated": doc["updated"],
                "catalogs": {k: v["version"] for k, v in doc["catalogs"].items()},
                "export_contract": doc["export_contract"],
            },
            "attacks": {
                "topics_used": sorted(topics),
                "topics_derived": False,
                "items": rows,
            },
        }, indent=2, ensure_ascii=False) + "\n"

    if a.out:
        pathlib.Path(a.out).write_text(out)
        print(f"wrote {len(rows)} rows to {a.out}", file=sys.stderr)
    else:
        sys.stdout.write(out)


if __name__ == "__main__":
    main()
