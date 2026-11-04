#!/usr/bin/env python3
"""Build the slim whitepaper inventory the scope control reads.

The principles catalog stays as it is. This script only reads it. The
page loads data/whitepaper-inventory.slim.json instead of the full
monitor fixture, which is about a megabyte and includes extracted text.

Scopes:
  cited      papers the agentic catalog cites (the default)
  org        decision include, excluding cited research
  research   monitor rows added because a monitored paper cites them
  all        every monitor row

Cited research is never given a catalog code, so it cannot appear in
the default scope. A metadata-only row, a duplicate, or a row marked
for removal is not recorded as a catalog source.

Usage:
    python3 build/generate_whitepaper_inventory.py
    python3 build/generate_whitepaper_inventory.py --check
    python3 build/generate_whitepaper_inventory.py --root /path/to/repo
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

CITED_RESEARCH_MARK = "as a reference cited by a monitored paper"
EVIDENCE_CODES = ("theoretical", "tested", "possibly_deployed", "deployed")
PAGES = (
    "agentic-ai-security/index.html",
    "assess/whitepaper-assessment/index.html",
)
SLIM_REL = "data/whitepaper-inventory.slim.json"
START = "<!-- inventory-controls:start -->"
END = "<!-- inventory-controls:end -->"
SPAN_RE = re.compile(
    r'(<span\b[^>]*\bdata-inv-count="([a-z0-9-]+)"[^>]*>)(.*?)(</span>)',
    re.S,
)
BLOCK_RE = re.compile(
    re.escape(START) + r".*?" + re.escape(END),
    re.S,
)
META_RE = re.compile(r"<meta\b[^>]*>", re.S)
SCRIPT_RE = re.compile(
    r'<script\b[^>]*\bdata-inv-stamp="cited-papers"[^>]*>.*?</script>',
    re.S,
)


def repo_root(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).resolve()
    return Path(__file__).resolve().parents[1]


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise SystemExit(f"{path} must be a JSON object")
    return data


def raw_evidence(notes: object) -> str:
    match = re.search(r"Evidence level:\s*([^\n]+)", str(notes or ""))
    if not match:
        return ""
    raw = re.split(r"\s+Basis:", match.group(1).strip(), maxsplit=1)[0]
    return raw.strip().rstrip(".")


def evidence_code(raw: str, wp_id: str) -> str:
    if not raw:
        return ""
    low = raw.lower()
    if low.startswith("tested, possibly deployed"):
        return "possibly_deployed"
    if low.startswith("tested"):
        return "tested"
    if low.startswith("theoretical"):
        return "theoretical"
    if low.startswith("deployed"):
        return "deployed"
    raise SystemExit(f"{wp_id}: unrecognized evidence level {raw!r}")


def normalized_decision(value: object, wp_id: str) -> str:
    raw = str(value or "").strip().lower()
    if raw in ("include", "duplicate", "delete_candidate"):
        return raw
    raise SystemExit(f"{wp_id}: unrecognized decision {value!r}")


def is_research(paper: dict) -> bool:
    return CITED_RESEARCH_MARK in str(paper.get("legacy_sheet_row") or "")


def is_arxiv(paper: dict) -> bool:
    return "arxiv.org" in str(paper.get("url") or "").lower()


def invariant_values(paper: dict) -> object:
    """Return the invariant list on one monitor paper.

    The export key is invariants. Older fixtures used invariables.
    invariables is read only when invariants is absent. An empty
    invariants list does not fall back to invariables. Keep this rule
    the same as invariant_values in scripts/validate_principles.py.
    """
    if "invariants" in paper:
        return paper.get("invariants")
    return paper.get("invariables")


def is_extracted(paper: dict) -> bool:
    for vals in (
        paper.get("axioms"),
        invariant_values(paper),
        paper.get("principles"),
    ):
        for item in vals or []:
            text = " ".join(str(item).split())
            if text and not text.lower().startswith("not extracted"):
                return True
    return False


def catalog_index(catalog: dict) -> tuple[dict, int]:
    sources = catalog.get("sources")
    if not isinstance(sources, dict):
        raise SystemExit("agentic catalog has no sources object")
    # One monitor paper can back more than one catalog code when versions
    # share a WP- id. The cited count is the code count.
    cited: dict[str, list] = {}
    talks = 0
    order = 0
    for code, src in sources.items():
        if not isinstance(src, dict):
            raise SystemExit(f"source {code} is not an object")
        if src.get("type") == "conference-talk":
            talks += 1
            continue
        wp_id = str(src.get("wp_id") or "")
        if not re.fullmatch(r"WP-\d{4}", wp_id):
            raise SystemExit(f"source {code} needs a WP- id")
        cited.setdefault(wp_id, []).append(
            {
                "c": code,
                "ord": order,
                "t": str(src.get("title") or "").strip(),
                "u": str(src.get("url") or "").strip(),
                "o": str(src.get("org") or "").strip(),
                "dt": str(src.get("date") or "").strip(),
            }
        )
        order += 1
    return cited, talks


def wp_number(wp_id: str) -> int:
    return int(wp_id.split("-", 1)[1])


def build_inventory(
    fixture: dict,
    catalog: dict,
    classic_count: int | None,
) -> dict:
    papers = fixture.get("papers")
    if not isinstance(papers, list):
        raise SystemExit("fixture has no papers list")
    cited, talks = catalog_index(catalog)
    by_id: dict[str, dict] = {}
    rows = []
    for paper in papers:
        if not isinstance(paper, dict):
            raise SystemExit("a paper row is not an object")
        wp_id = str(paper.get("wp_id") or "")
        if not re.fullmatch(r"WP-\d{4}", wp_id):
            raise SystemExit(f"paper is missing a WP- id: {wp_id!r}")
        if wp_id in by_id:
            raise SystemExit(f"duplicate fixture id {wp_id}")
        by_id[wp_id] = paper
        decision = normalized_decision(paper.get("decision"), wp_id)
        research = is_research(paper)
        infos = cited.get(wp_id) or []
        if infos and research:
            raise SystemExit(
                f"{wp_id} is cited research and is also in the principles "
                "catalog. Cited research stays out of the default scope."
            )
        if infos and decision != "include":
            raise SystemExit(
                f"{wp_id} is cited in the principles catalog but its "
                f"monitor decision is {decision}"
            )
        issue = paper.get("issue_number")
        if not isinstance(issue, int):
            raise SystemExit(f"{wp_id} is missing an integer issue_number")
        ev = evidence_code(raw_evidence(paper.get("legacy_notes")), wp_id)
        row = {
            "i": wp_id,
            "t": str(paper.get("title") or "").strip(),
            "o": str(paper.get("source_org") or "").strip(),
            "dt": str(paper.get("date_published") or "").strip(),
            "u": str(paper.get("url") or "").strip(),
            "n": issue,
            "dec": decision,
            "x": "extracted" if is_extracted(paper) else "metadata",
            "k": "research" if research else "org",
        }
        if infos:
            row["cs"] = infos
            row["c"] = ", ".join(item["c"] for item in infos)
        if ev:
            row["ev"] = ev
        if is_arxiv(paper):
            row["ax"] = 1
        if research and "c" in row:
            raise SystemExit(f"{wp_id} research row was marked as a catalog source")
        rows.append(row)

    missing = sorted(set(cited) - set(by_id))
    if missing:
        raise SystemExit(
            "catalog sources missing from the fixture: " + ", ".join(missing)
        )

    rows.sort(key=lambda row: wp_number(row["i"]))
    org_rows = [row for row in rows if row["k"] == "org" and row["dec"] == "include"]
    research_rows = [row for row in rows if row["k"] == "research"]
    cited_rows = [row for row in rows if "cs" in row]
    code_count = sum(len(row["cs"]) for row in cited_rows)
    if len(cited_rows) != len(cited) or code_count != sum(len(v) for v in cited.values()):
        raise SystemExit("cited row count does not match the catalog")
    org_ids = {row["i"] for row in org_rows}
    research_ids = {row["i"] for row in research_rows}
    if org_ids & research_ids:
        raise SystemExit("organization papers and cited research overlap")
    if not {row["i"] for row in cited_rows} <= org_ids:
        raise SystemExit("a cited paper is missing from included organization papers")
    for row in research_rows:
        if "c" in row:
            raise SystemExit(f"{row['i']} cited research row has a catalog code")

    def bucket(group: list[dict]) -> dict:
        counts = {code: 0 for code in EVIDENCE_CODES}
        counts["untagged"] = 0
        for row in group:
            code = row.get("ev") or ""
            if not code:
                counts["untagged"] += 1
            else:
                counts[code] += 1
        return counts

    research_ev = bucket(research_rows)
    principles = catalog.get("count")
    if not isinstance(principles, int):
        principles = len(catalog.get("principles") or [])
    sections = catalog.get("sections")
    section_count = len(sections) if isinstance(sections, dict) else None
    counts = {
        "cited": code_count,
        "org": len(org_rows),
        "research": len(research_rows),
        "all": len(rows),
        "talks": talks,
        "principles": principles,
        "org-metadata": sum(1 for row in org_rows if row["x"] == "metadata"),
        "org-arxiv": sum(1 for row in org_rows if row.get("ax") == 1),
        "research-extracted": sum(
            1 for row in research_rows if row["x"] == "extracted"
        ),
        "ev-research-theoretical": research_ev["theoretical"],
        "ev-research-tested": research_ev["tested"],
        "ev-research-possibly_deployed": research_ev["possibly_deployed"],
        "ev-research-deployed": research_ev["deployed"],
        "ev-research-untagged": research_ev["untagged"],
    }
    if classic_count is not None:
        counts["classic"] = classic_count
    if section_count is not None:
        counts["sections"] = section_count

    return {
        "version": 1,
        "updated": fixture.get("updated") or "",
        "description": (
            "Slim index of the whitepaper monitor. A row with a catalog "
            "code (c) is cited in the principles catalog. Cited research "
            "(k = research) is not part of that default list. x = metadata "
            "means principles have not been extracted. Those rows are not "
            "sources of principles. ev is the monitor evidence tag, "
            "paraphrased on the page. possibly_deployed is the monitor tag "
            "tested, possibly deployed (needs review). It is not deployed."
        ),
        "generated_from": [
            "build/fixtures/whitepapers.json",
            "data/ai-agentic-principles.json",
        ],
        "fields": {
            "i": "WP- id",
            "t": "title",
            "o": "organization, from the monitor source_org field",
            "dt": "date published, as the monitor recorded it",
            "u": "URL",
            "n": "monitor issue number",
            "dec": "include, duplicate, or delete_candidate",
            "c": "catalog source codes for this monitor row, joined when two codes share a WP- id",
            "cs": "per-code catalog title, URL, organization, and date, in catalog order",
            "x": "extracted or metadata",
            "k": "org or research",
            "ev": "theoretical, tested, possibly_deployed, or deployed",
            "ax": "1 when the URL is on arxiv.org",
        },
        "counts": counts,
        "evidence_research": research_ev,
        "papers": rows,
    }


def count_value(counts: dict, key: str) -> int:
    if key not in counts:
        raise SystemExit(f"HTML asks for unknown inventory count {key}")
    return int(counts[key])


def stamp_spans(html: str, counts: dict) -> str:
    def repl(match: re.Match) -> str:
        value = count_value(counts, match.group(2))
        return f"{match.group(1)}{value}{match.group(4)}"

    return SPAN_RE.sub(repl, html)


def stamp_regions(html: str, counts: dict) -> str:
    def stamp_meta(match: re.Match) -> str:
        block = match.group(0)
        if 'data-inv-stamp="cited-papers"' in block:
            block, found = re.subn(
                r"(?<=in )\d+(?= papers)",
                str(counts["cited"]),
                block,
            )
            if found < 1:
                raise SystemExit("cited-papers stamp found no count")
            return block
        if 'data-inv-stamp="assessment-counts"' in block:
            block, first = re.subn(
                r"(?<=against )\d+(?= classic)",
                str(counts["classic"]),
                block,
                count=1,
            )
            block, second = re.subn(
                r"(?<=, )\d+(?= AI and agentic)",
                str(counts["principles"]),
                block,
                count=1,
            )
            if first != 1 or second != 1:
                raise SystemExit("assessment-counts stamp failed")
            return block
        return block

    html = META_RE.sub(stamp_meta, html)

    def stamp_script(match: re.Match) -> str:
        block, found = re.subn(
            r"(?<=in )\d+(?= papers)",
            str(counts["cited"]),
            match.group(0),
        )
        if found < 1:
            raise SystemExit("JSON-LD cited-papers stamp found no count")
        return block

    return SCRIPT_RE.sub(stamp_script, html)


def render_controls(counts: dict) -> str:
    def n(key: str) -> str:
        return str(count_value(counts, key))

    # The numbers inside the spans are stamped again after insertion.
    return f"""<p class="inv-count-note">Organization papers: <span data-inv-count="org">{n("org")}</span>. Cited research: <span data-inv-count="research">{n("research")}</span>. These counts do not overlap. Cited research is not in the default list.</p>
<p class="inv-count-note">Organization papers that are metadata only: <span data-inv-count="org-metadata">{n("org-metadata")}</span>. Cited research records with extracted principles: <span data-inv-count="research-extracted">{n("research-extracted")}</span>. A metadata-only record is not a source of principles.</p>
<p class="inv-count-note">The organization list includes <span data-inv-count="org-arxiv">{n("org-arxiv")}</span> arXiv records outside the cited research count. The evidence filter opens when the selected list contains an arXiv record.</p>
<fieldset class="inv-options" id="inventory-scope-set">
  <legend>Which records to list</legend>
  <label class="inv-option">
    <input type="radio" name="inventory-scope" value="cited" checked>
    <span>Cited in principles (<span data-inv-count="cited">{n("cited")}</span>)</span>
  </label>
  <label class="inv-option">
    <input type="radio" name="inventory-scope" value="org">
    <span>All included organization papers (<span data-inv-count="org">{n("org")}</span>)</span>
  </label>
  <label class="inv-option">
    <input type="radio" name="inventory-scope" value="research">
    <span>Cited research (<span data-inv-count="research">{n("research")}</span>)</span>
  </label>
  <label class="inv-option">
    <input type="radio" name="inventory-scope" value="all">
    <span>All papers, including cited research (<span data-inv-count="all">{n("all")}</span>)</span>
  </label>
</fieldset>
<fieldset class="inv-options" id="inventory-evidence-set" hidden>
  <legend>Evidence level</legend>
  <p id="inventory-evidence-note">These definitions paraphrase the monitor's evidence tags. They are not quotes from the papers. Button counts match the list you selected. All levels is the default.</p>
  <label class="inv-option">
    <input type="radio" name="inventory-evidence" value="all" checked>
    <span>All levels</span>
  </label>
  <label class="inv-option">
    <input type="radio" name="inventory-evidence" value="theoretical">
    <span>Theoretical (<span data-ev-count="theoretical">0</span>)</span>
  </label>
  <label class="inv-option">
    <input type="radio" name="inventory-evidence" value="tested">
    <span>Tested (<span data-ev-count="tested">0</span>)</span>
  </label>
  <label class="inv-option">
    <input type="radio" name="inventory-evidence" value="possibly_deployed">
    <span>Tested, possibly deployed, needs review (<span data-ev-count="possibly_deployed">0</span>)</span>
  </label>
  <label class="inv-option">
    <input type="radio" name="inventory-evidence" value="deployed">
    <span>Deployed (<span data-ev-count="deployed">0</span>)</span>
  </label>
  <label class="inv-option" data-evidence-option="untagged">
    <input type="radio" name="inventory-evidence" value="untagged">
    <span>Not yet tagged (<span data-ev-count="untagged">0</span>)</span>
  </label>
  <dl class="inv-defs">
    <dt>Theoretical</dt>
    <dd>Paraphrase: a proposal, a position, or a taxonomy. The paper reports no experiment of its own.</dd>
    <dt>Tested</dt>
    <dd>Paraphrase: lab experiments, benchmarks, or simulations.</dd>
    <dt>Tested, possibly deployed (needs review)</dt>
    <dd>This is the monitor's tag, not a paraphrase. An automated read found experiment language and words that can mean production or a real incident. A person has not confirmed that measurement. Do not read this tag as deployed.</dd>
    <dt>Deployed</dt>
    <dd>Paraphrase: measured in production or on a real incident. Only a record the monitor tags deployed belongs here.</dd>
    <dt>Not yet tagged</dt>
    <dd>The monitor record has no evidence level. This option is hidden when the selected list has no untagged record.</dd>
  </dl>
</fieldset>
<label class="inv-find" for="inventory-find">Find in this list
  <input id="inventory-find" type="search" autocomplete="off">
</label>
<p id="inventory-status" role="status" aria-live="polite"></p>
<p class="inv-count-note">Machine-readable list: <a href="/data/whitepaper-inventory.slim.json">/data/whitepaper-inventory.slim.json</a>. This page does not load the full monitor export.</p>"""


def apply_page(html: str, counts: dict) -> str:
    if START not in html or END not in html:
        raise SystemExit("page is missing inventory-controls markers")
    block = START + "\n" + render_controls(counts) + "\n" + END
    html, found = BLOCK_RE.subn(block, html, count=1)
    if found != 1:
        raise SystemExit("could not replace the inventory control block")
    html = stamp_spans(html, counts)
    html = stamp_regions(html, counts)
    return html


def dumps(payload: dict) -> str:
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"


def classic_count(root: Path) -> int | None:
    path = root / "data" / "security-principles.json"
    if not path.is_file():
        return None
    data = load_json(path)
    count = data.get("count")
    if not isinstance(count, int):
        raise SystemExit("security-principles.json has no integer count")
    return count


def generate(root: Path) -> tuple[dict, str]:
    fixture = load_json(root / "build" / "fixtures" / "whitepapers.json")
    catalog = load_json(root / "data" / "ai-agentic-principles.json")
    inventory = build_inventory(fixture, catalog, classic_count(root))
    return inventory, dumps(inventory)


def write_outputs(root: Path, text: str, counts: dict) -> None:
    slim = root / SLIM_REL
    slim.parent.mkdir(parents=True, exist_ok=True)
    slim.write_text(text, encoding="utf-8")
    for rel in PAGES:
        path = root / rel
        if not path.is_file():
            continue
        updated = apply_page(path.read_text(encoding="utf-8"), counts)
        path.write_text(updated, encoding="utf-8")


def check_outputs(root: Path, text: str, counts: dict) -> int:
    slim = root / SLIM_REL
    if not slim.is_file() or slim.read_text(encoding="utf-8") != text:
        print(f"{SLIM_REL} is out of date. Run build/generate_whitepaper_inventory.py", file=sys.stderr)
        return 1
    failed = False
    for rel in PAGES:
        path = root / rel
        if not path.is_file():
            continue
        current = path.read_text(encoding="utf-8")
        if apply_page(current, counts) != current:
            print(f"{rel} inventory counts are out of date.", file=sys.stderr)
            failed = True
    return 1 if failed else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", help="Repository root. Defaults to this repo.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if the slim file or stamped pages differ. Do not write.",
    )
    args = parser.parse_args(argv)
    root = repo_root(args.root)
    inventory, text = generate(root)
    counts = inventory["counts"]
    if args.check:
        return check_outputs(root, text, counts)
    write_outputs(root, text, counts)
    print(
        f"wrote {SLIM_REL} ({len(text.encode('utf-8'))} bytes, "
        f"{counts['all']} records, cited {counts['cited']}, "
        f"org {counts['org']}, research {counts['research']})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
