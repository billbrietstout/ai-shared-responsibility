#!/usr/bin/env python3
"""Validate the site principle catalogs against schema and the monitor export.

Usage:
  python3 scripts/validate_principles.py
  python3 scripts/validate_principles.py --whitepapers build/fixtures/whitepapers.json
  python3 scripts/validate_principles.py --agentic path --classic path

Exit codes:
  0  pass (warnings allowed)
  1  one or more errors
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AGENTIC = ROOT / "data" / "ai-agentic-principles.json"
DEFAULT_CLASSIC = ROOT / "data" / "security-principles.json"
DEFAULT_SCHEMA = ROOT / "schemas" / "principles.schema.json"
DEFAULT_WP = ROOT / "build" / "fixtures" / "whitepapers.json"

WP_RE = re.compile(r"^WP-\d{4}$")
SUPPORT_THRESHOLD = 0.34
NEAR_DUP_THRESHOLD = 0.92


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def print(self) -> None:
        for msg in self.errors:
            print(f"ERROR: {msg}")
        for msg in self.warnings:
            print(f"WARNING: {msg}")
        print(
            f"Summary: {len(self.errors)} error(s), "
            f"{len(self.warnings)} warning(s)"
        )


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


def tokenize(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 2}


def best_support_score(statement: str, corpus: list[str]) -> float:
    if not corpus:
        return 0.0
    stmt_tokens = tokenize(statement)
    best = 0.0
    for bullet in corpus:
        seq = SequenceMatcher(None, statement.lower(), bullet.lower()).ratio()
        bt = tokenize(bullet)
        jacc = (
            len(stmt_tokens & bt) / len(stmt_tokens | bt)
            if stmt_tokens and bt
            else 0.0
        )
        best = max(best, seq, jacc)
    return best


def try_jsonschema(schema: dict, data: object, label: str, report: Report) -> None:
    try:
        import jsonschema  # type: ignore
    except ImportError:
        report.warn(
            f"{label}: jsonschema package not installed; "
            "skipping formal schema check (structural checks still run)"
        )
        return
    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as exc:
        report.err(f"{label}: schema validation failed: {exc.message}")


def validate_classic(data: dict, report: Report) -> None:
    principles = data.get("principles", [])
    if data.get("count") != len(principles):
        report.err(
            f"classic count {data.get('count')} != "
            f"principles length {len(principles)}"
        )
    ids = [p.get("id") for p in principles]
    if len(ids) != len(set(ids)):
        dups = sorted({i for i in ids if ids.count(i) > 1})
        report.err(f"classic duplicate ids: {dups}")
    frameworks = data.get("frameworks", {})
    for p in principles:
        for src in p.get("src", []):
            fw = src.get("fw")
            if fw not in frameworks:
                report.err(
                    f"classic principle {p.get('id')}: "
                    f"unknown framework {fw!r}"
                )


def paper_corpus(paper: dict) -> list[str]:
    out: list[str] = []
    for key in ("axioms", "invariables", "principles"):
        vals = paper.get(key) or []
        if isinstance(vals, list):
            out.extend(str(v) for v in vals)
        elif isinstance(vals, str) and vals.strip():
            out.append(vals)
    return out


def validate_agentic(
    data: dict,
    papers_by_id: dict[str, dict],
    report: Report,
) -> None:
    principles = data.get("principles", [])
    sources = data.get("sources", {})
    sections = data.get("sections", {})

    if data.get("count") != len(principles):
        report.err(
            f"agentic count {data.get('count')} != "
            f"principles length {len(principles)}"
        )

    ids = [p.get("id") for p in principles]
    if len(ids) != len(set(ids)):
        dups = sorted({i for i in ids if ids.count(i) > 1})
        report.err(f"agentic duplicate ids: {dups}")

    for p in principles:
        sec = p.get("section")
        if sec not in sections:
            report.err(
                f"principle {p.get('id')}: section {sec!r} "
                "not in sections map"
            )

    cited: set[str] = set()
    for p in principles:
        for code in p.get("src", []):
            if code not in sources:
                report.err(
                    f"principle {p.get('id')}: src code {code!r} "
                    "does not resolve"
                )
            else:
                cited.add(code)

    for code in sources:
        if code not in cited:
            report.warn(f"source {code} is never cited by a principle")

    url_owners: dict[str, list[str]] = defaultdict(list)
    for code, src in sources.items():
        status = src.get("inventory_status", "matched")
        wp_id = src.get("wp_id")
        url_owners[norm_url(src.get("url", ""))].append(code)

        if status == "matched":
            if not wp_id or not WP_RE.match(str(wp_id)):
                report.err(
                    f"source {code}: matched status requires wp_id "
                    "like WP-0001"
                )
                continue
            paper = papers_by_id.get(wp_id)
            if not paper:
                report.err(
                    f"source {code}: wp_id {wp_id} not found in "
                    "whitepapers.json"
                )
                continue
            decision = paper.get("decision", "")
            if decision in ("Delete candidate", "Duplicate"):
                report.err(
                    f"source {code}: paper {wp_id} decision is "
                    f"{decision!r}; must be Include"
                )
            elif decision != "Include":
                report.warn(
                    f"source {code}: paper {wp_id} decision is "
                    f"{decision!r}"
                )
        elif status in ("pending_add", "unmatched"):
            if wp_id:
                report.err(
                    f"source {code}: {status} sources must leave "
                    "wp_id null"
                )
            if not src.get("inventory_note"):
                report.err(
                    f"source {code}: {status} requires inventory_note"
                )
            else:
                report.warn(
                    f"source {code}: {status} — {src.get('inventory_note')}"
                )
        else:
            report.err(
                f"source {code}: unknown inventory_status {status!r}"
            )

    for url, codes in url_owners.items():
        if url and len(codes) > 1:
            report.warn(
                f"duplicate source URL shared by {', '.join(codes)}: {url}"
            )

    # Include papers with extraction that no site principle uses: gaps.
    used_wp = {
        sources[c]["wp_id"]
        for c in cited
        if sources.get(c, {}).get("wp_id")
    }
    for wp_id, paper in papers_by_id.items():
        if paper.get("decision") != "Include":
            continue
        if not paper_corpus(paper):
            continue
        if wp_id not in used_wp:
            report.warn(
                f"gap: Include paper {wp_id} "
                f"({paper.get('title', '')[:80]}) is unused by site principles"
            )

    # Statement support (warning only).
    unsupported: list[tuple[str, float]] = []
    for p in principles:
        corpus: list[str] = []
        for code in p.get("src", []):
            src = sources.get(code) or {}
            wp_id = src.get("wp_id")
            if not wp_id:
                continue
            paper = papers_by_id.get(wp_id)
            if paper:
                corpus.extend(paper_corpus(paper))
        score = best_support_score(p.get("statement", ""), corpus)
        if score < SUPPORT_THRESHOLD:
            unsupported.append((p.get("id", "?"), score))
            report.warn(
                f"support weak for {p.get('id')}: best score "
                f"{score:.2f} below {SUPPORT_THRESHOLD}"
            )

    # Near-duplicate statements within a section.
    by_section: dict[str, list[dict]] = defaultdict(list)
    for p in principles:
        by_section[p.get("section", "")].append(p)
    for section, rows in by_section.items():
        for i, a in enumerate(rows):
            for b in rows[i + 1 :]:
                ratio = SequenceMatcher(
                    None,
                    a.get("statement", "").lower(),
                    b.get("statement", "").lower(),
                ).ratio()
                if ratio >= NEAR_DUP_THRESHOLD:
                    report.warn(
                        f"near-duplicate in section {section}: "
                        f"{a.get('id')} ~ {b.get('id')} ({ratio:.2f})"
                    )


def load_papers(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    data = load_json(path)
    papers = data.get("papers") if isinstance(data, dict) else data
    out = {}
    for p in papers or []:
        pid = p.get("id")
        if pid:
            out[pid] = p
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--agentic", type=Path, default=DEFAULT_AGENTIC)
    ap.add_argument("--classic", type=Path, default=DEFAULT_CLASSIC)
    ap.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    ap.add_argument("--whitepapers", type=Path, default=DEFAULT_WP)
    args = ap.parse_args()
    report = Report()

    schema = load_json(args.schema) if args.schema.exists() else None
    if schema is None:
        report.err(f"schema not found: {args.schema}")

    classic = load_json(args.classic)
    agentic = load_json(args.agentic)
    papers = load_papers(args.whitepapers)
    if not papers:
        report.warn(
            f"whitepapers export missing or empty at {args.whitepapers}; "
            "skipping WP- ID and support checks"
        )

    if schema is not None:
        try_jsonschema(schema, classic, "classic", report)
        try_jsonschema(schema, agentic, "agentic", report)

    if not isinstance(classic, dict) or "principles" not in classic:
        report.err("classic catalog is not a principle object")
    else:
        validate_classic(classic, report)

    if not isinstance(agentic, dict) or "principles" not in agentic:
        report.err("agentic catalog is not a principle object")
    else:
        validate_agentic(agentic, papers, report)

    report.print()
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
