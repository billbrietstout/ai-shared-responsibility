#!/usr/bin/env python3
"""Validate the site principle catalogs against schema and the monitor export.

Grace date
  Unmatched sources, and agentic principles with empty risks or obligations,
  are warnings through 2026-11-30 and errors starting 2026-12-01.

Support
  A principle id that is not on the base catalog fails when its support
  score prints as 0.00 and a cited paper has extracted text. Ids on the
  base catalog stay warnings. A 0.00 score with no extracted text stays
  a warning. The base catalog is --grandfather, else --base-ref, else
  PRINCIPLES_BASE_REF, else origin/develop, else develop.

Usage:
  python3 scripts/validate_principles.py
  python3 scripts/validate_principles.py --whitepapers build/fixtures/whitepapers.json
  python3 scripts/validate_principles.py --as-of 2026-12-01
  python3 scripts/validate_principles.py --base-ref origin/develop

Exit codes:
  0  pass (warnings allowed)
  1  one or more errors
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AGENTIC = ROOT / "data" / "ai-agentic-principles.json"
DEFAULT_CLASSIC = ROOT / "data" / "security-principles.json"
DEFAULT_SCHEMA = ROOT / "schemas" / "principles.schema.json"
DEFAULT_WP = ROOT / "build" / "fixtures" / "whitepapers.json"

# 30 days after 2026-10-31. Warnings run through this date.
# Errors start on 2026-12-01.
GRACE_DATE = date(2026, 11, 30)

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
        in_gha = os.environ.get("GITHUB_ACTIONS") == "true"
        for msg in self.errors:
            print(f"ERROR: {msg}")
            if in_gha:
                print(f"::error::{_gha_escape(msg)}")
        for msg in self.warnings:
            print(f"WARNING: {msg}")
        print(
            f"Summary: {len(self.errors)} error(s), "
            f"{len(self.warnings)} warning(s)"
        )


def _gha_escape(msg: str) -> str:
    return msg.replace("\r", " ").replace("\n", " ").replace("%", "%25")


def load_json(path: Path) -> object:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def parse_as_of(text: str) -> date:
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"expected YYYY-MM-DD, got {text!r}"
        ) from exc


def grace_lapsed(today: date) -> bool:
    return today > GRACE_DATE


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


def trace_list_state(value: object) -> str:
    """Return 'missing', 'ok', or a short error phrase."""
    if value is None:
        return "missing"
    if not isinstance(value, list):
        return "must be an array of non-empty strings"
    if not value:
        return "missing"
    for item in value:
        if not isinstance(item, str) or not item.strip():
            return "must be an array of non-empty strings"
    return "ok"


def positive_issue(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    if value < 1:
        return None
    return value


def safe_ref(ref: str) -> bool:
    if not ref or ref.startswith("-"):
        return False
    return not any(ch in ref for ch in (":", "\n", "\r", " "))


def catalog_relpath(path: Path) -> str | None:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return None


def principle_ids_from_git(ref: str, relpath: str) -> set[str] | None:
    if not safe_ref(ref):
        return None
    try:
        proc = subprocess.run(
            ["git", "show", f"{ref}:{relpath}"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    if proc.returncode != 0 or not proc.stdout.strip():
        return None
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    principles = data.get("principles")
    if not isinstance(principles, list):
        return None
    return {
        p.get("id")
        for p in principles
        if isinstance(p, dict) and isinstance(p.get("id"), str)
    }


def principle_ids_from_catalog(data: object) -> set[str] | None:
    if not isinstance(data, dict):
        return None
    principles = data.get("principles")
    if not isinstance(principles, list):
        return None
    return {
        p.get("id")
        for p in principles
        if isinstance(p, dict) and isinstance(p.get("id"), str)
    }


def resolve_grandfather(
    agentic_path: Path,
    base_ref: str,
    grandfather_file: Path | None,
) -> tuple[set[str] | None, str]:
    """Return (ids, label). ids is None when no baseline could be read."""
    if grandfather_file is not None:
        if not grandfather_file.exists():
            return None, f"missing file {grandfather_file}"
        try:
            data = load_json(grandfather_file)
        except (OSError, json.JSONDecodeError):
            return None, f"unreadable file {grandfather_file}"
        ids = principle_ids_from_catalog(data)
        return ids, str(grandfather_file)

    explicit = base_ref or os.environ.get("PRINCIPLES_BASE_REF") or ""
    rel = catalog_relpath(agentic_path)
    if rel is None:
        return None, ""
    if explicit:
        if not safe_ref(explicit):
            return None, explicit
        return principle_ids_from_git(explicit, rel), explicit
    for candidate in ("origin/develop", "develop"):
        ids = principle_ids_from_git(candidate, rel)
        if ids is not None:
            return ids, candidate
    return None, ""


def validate_agentic(
    data: dict,
    papers_by_id: dict[str, dict],
    report: Report,
    *,
    today: date | None = None,
    grandfather_ids: set[str] | None = None,
) -> None:
    today = today or date.today()
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
    sources_missing_issue: list[str] = []
    for code, src in sources.items():
        status = src.get("inventory_status", "matched")
        wp_id = src.get("wp_id")
        url_owners[norm_url(src.get("url", ""))].append(code)

        raw_issue = src.get("monitor_issue", None)
        parsed_issue = positive_issue(raw_issue)
        if raw_issue is None:
            sources_missing_issue.append(code)
        elif parsed_issue is None:
            report.err(
                f"source {code}: monitor_issue must be a positive integer "
                f"or null, got {raw_issue!r}"
            )

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
            if parsed_issue is not None:
                paper_issue = paper.get("issue")
                if paper_issue is None:
                    report.warn(
                        f"source {code}: monitor_issue {parsed_issue} is set, "
                        f"and paper {wp_id} has no issue field in the fixture"
                    )
                elif paper_issue != parsed_issue:
                    report.err(
                        f"source {code}: monitor_issue {parsed_issue} does not "
                        f"match fixture issue {paper_issue!r} for {wp_id}"
                    )
        elif status == "pending_add":
            if wp_id:
                report.err(
                    f"source {code}: pending_add sources must leave "
                    "wp_id null"
                )
            if not src.get("inventory_note"):
                report.err(
                    f"source {code}: pending_add requires inventory_note"
                )
            else:
                report.warn(
                    f"source {code}: pending_add: {src.get('inventory_note')}"
                )
        elif status == "unmatched":
            if wp_id:
                report.err(
                    f"source {code}: unmatched sources must leave wp_id null"
                )
            if not src.get("inventory_note"):
                report.err(
                    f"source {code}: unmatched requires inventory_note"
                )
            note = src.get("inventory_note") or ""
            msg = f"source {code}: unmatched, so it has no monitor WP- id"
            if note:
                msg += f" ({note})"
            if grace_lapsed(today):
                report.err(
                    msg + f". Grace ended {GRACE_DATE.isoformat()}."
                )
            else:
                report.warn(
                    msg
                    + ". This becomes an error after "
                    + f"{GRACE_DATE.isoformat()}."
                )
        else:
            report.err(
                f"source {code}: unknown inventory_status {status!r}"
            )

    if sources_missing_issue:
        report.warn(
            f"{len(sources_missing_issue)} source(s) have no monitor_issue. "
            "Set this to the GitHub issue number in "
            "billbrietstout/ai-security-whitepaper-monitor."
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

    for p in principles:
        pid = p.get("id", "?")
        empty_fields: list[str] = []
        for field in ("risks", "obligations"):
            state = trace_list_state(p.get(field))
            if state == "missing":
                empty_fields.append(field)
            elif state != "ok":
                report.err(f"principle {pid}: {field} {state}")
        if empty_fields:
            msg = (
                f"principle {pid}: {', '.join(empty_fields)} is empty. "
                "Each principle needs at least one risk and one obligation."
            )
            if grace_lapsed(today):
                report.err(msg + f" Grace ended {GRACE_DATE.isoformat()}.")
            else:
                report.warn(
                    msg
                    + " This becomes an error after "
                    + f"{GRACE_DATE.isoformat()}."
                )

    # Statement support. Score 0.00 is an error only for ids that are not
    # on the baseline catalog. Older ids stay warnings. Skip the score when
    # the export itself is missing: there is no paper text to compare.
    if papers_by_id:
        if grandfather_ids is None:
            report.warn(
                "support score 0.00 stays a warning for every principle "
                "because no base catalog was available to tell new ids "
                "from old ones"
            )
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
            shown = f"{score:.2f}"
            pid = p.get("id", "?")
            is_new = (
                grandfather_ids is not None and pid not in grandfather_ids
            )
            # Empty corpus means the cited sources have no extracted text
            # (often an unmatched talk). That gap is the grace-dated
            # unmatched check. Score 0.00 is an error for a new principle
            # only when paper text exists and the statement misses it.
            if shown == "0.00" and is_new and corpus:
                report.err(
                    f"support score 0.00 for new principle {pid}: "
                    "the statement does not overlap axioms, "
                    "invariables, or principles on its cited papers"
                )
            elif score < SUPPORT_THRESHOLD:
                report.warn(
                    f"support weak for {pid}: best score "
                    f"{shown} below {SUPPORT_THRESHOLD}"
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
    ap.add_argument(
        "--as-of",
        type=parse_as_of,
        default=None,
        help="Check date YYYY-MM-DD. Defaults to today (UTC on GitHub runners).",
    )
    ap.add_argument(
        "--base-ref",
        default="",
        help=(
            "Git ref whose principle ids stay warnings at support score "
            "0.00. Overrides PRINCIPLES_BASE_REF."
        ),
    )
    ap.add_argument(
        "--grandfather",
        type=Path,
        default=None,
        help="Catalog JSON whose principle ids stay warnings at support 0.00.",
    )
    args = ap.parse_args()
    report = Report()
    today = args.as_of or date.today()

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

    grandfather_ids, baseline_label = resolve_grandfather(
        args.agentic, args.base_ref, args.grandfather
    )
    if args.grandfather is not None and grandfather_ids is None:
        report.err(
            "could not read principle ids from grandfather catalog "
            f"{args.grandfather}"
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
        validate_agentic(
            agentic,
            papers,
            report,
            today=today,
            grandfather_ids=grandfather_ids,
        )

    print(
        f"As of {today.isoformat()}. "
        f"Grace date {GRACE_DATE.isoformat()} "
        "(unmatched sources, empty risks, and empty obligations "
        "become errors the next day)."
    )
    if grandfather_ids is None:
        print(f"New-principle baseline: unavailable ({baseline_label or 'no ref'})")
    else:
        print(
            f"New-principle baseline: {baseline_label} "
            f"({len(grandfather_ids)} principle ids)"
        )
    report.print()
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
