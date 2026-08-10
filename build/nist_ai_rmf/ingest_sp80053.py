#!/usr/bin/env python3
"""Ingest NIST SP 800-53 Rev 5 OSCAL catalog into a separate static RAG corpus.

Approach B: catalog statement + guidance prose only (not 800-53A assessment
procedures). Writes dual-readable Markdown under nist-ai-rmf/sp800-53/sources/
and chunks under nist-ai-rmf/sp800-53/data/. Does not merge into the AI RMF
index. Download the OSCAL JSON at build time (not committed).
"""
from __future__ import annotations

import argparse
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "nist-ai-rmf" / "sp800-53"
SRC = OUT / "sources"
DATA = OUT / "data"

DEFAULT_URL = (
    "https://raw.githubusercontent.com/usnistgov/oscal-content/main/"
    "nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json"
)
DOC_ID = "sp800-53-rev5"
NIST_ID = "NIST.SP.800-53"
OFFICIAL_DOI = "https://doi.org/10.6028/NIST.SP.800-53r5"
OFFICIAL_PDF = "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf"

INSERT_RE = re.compile(r"\{\{\s*insert:\s*param,\s*([^}]+?)\s*\}\}", re.I)


def fetch_catalog(url: str, cache: Path) -> dict:
    cache.parent.mkdir(parents=True, exist_ok=True)
    if cache.exists() and cache.stat().st_size > 1_000_000:
        print(f"using cache {cache}")
        return json.loads(cache.read_text(encoding="utf-8"))
    print(f"downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "aisharedresponsibility-sp80053-ingest/0.1"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read()
    cache.write_bytes(raw)
    return json.loads(raw.decode("utf-8"))


def param_labels(control: dict) -> dict[str, str]:
    labels: dict[str, str] = {}
    for p in control.get("params") or []:
        pid = (p.get("id") or "").strip()
        label = ""
        for prop in p.get("props") or []:
            if prop.get("name") == "label" and prop.get("value"):
                label = str(prop["value"]).strip()
                break
        if not label:
            label = (p.get("label") or pid or "organization-defined").strip()
        if pid:
            labels[pid] = label
            # OSCAL inserts sometimes use underscored forms
            labels[pid.replace("-", "_")] = label
    return labels


def expand_inserts(text: str, labels: dict[str, str]) -> str:
    def repl(m: re.Match) -> str:
        key = m.group(1).strip()
        label = labels.get(key) or labels.get(key.replace("_", "-")) or key
        return f"[{label}]"

    return INSERT_RE.sub(repl, text or "")


def collect_statement_lines(parts: list | None, labels: dict[str, str], depth: int = 0) -> list[str]:
    """Walk statement/item tree; skip guidance and assessment parts."""
    lines: list[str] = []
    for part in parts or []:
        name = (part.get("name") or "").lower()
        if name in {"guidance", "assessment-objective", "assessment-method", "assessment-objects"}:
            continue
        prose = expand_inserts(part.get("prose") or "", labels).strip()
        if name == "statement" and prose:
            lines.append(prose)
        elif name == "item" and prose:
            lines.append(f"{'  ' * depth}- {prose}")
        child_depth = depth + 1 if name == "item" else depth
        if name in {"statement", "item"}:
            lines.extend(collect_statement_lines(part.get("parts"), labels, child_depth))
    return lines


def guidance_prose(parts: list | None, labels: dict[str, str]) -> str:
    """Collect guidance/discussion at the control root (sibling of statement)."""
    chunks: list[str] = []
    for part in parts or []:
        name = (part.get("name") or "").lower()
        if name != "guidance":
            continue
        prose = expand_inserts(part.get("prose") or "", labels).strip()
        if prose:
            chunks.append(prose)
        for sub in part.get("parts") or []:
            if (sub.get("name") or "").lower() == "guidance":
                sp = expand_inserts(sub.get("prose") or "", labels).strip()
                if sp:
                    chunks.append(sp)
    return "\n\n".join(chunks)



def statement_text(control: dict, labels: dict[str, str]) -> str:
    lines = collect_statement_lines(control.get("parts"), labels, 0)
    # Deduplicate while preserving order
    seen = set()
    out = []
    for line in lines:
        key = line.strip()
        if key and key not in seen:
            seen.add(key)
            out.append(line)
    return "\n".join(out).strip()


def control_label(control: dict) -> str:
    """Prefer OSCAL id form (AC-2) so queries match; keep prop label as secondary."""
    cid = (control.get("id") or "").lower()
    if "." in cid:
        base, enh = cid.split(".", 1)
        return f"{base.upper()}({enh})"
    if cid:
        return cid.upper()
    for prop in control.get("props") or []:
        if prop.get("name") == "label" and prop.get("value"):
            return str(prop["value"]).strip()
    return ""


def family_title(group: dict) -> str:
    return (group.get("title") or group.get("id") or "family").strip()


def slug_anchor(cid: str) -> str:
    return (cid or "").lower().replace("_", "-")


def write_attribution(version: str, oscal_url: str, last_modified: str) -> None:
    text = f"""# Attribution: NIST SP 800-53 Rev 5 catalog extract

This directory is a **demonstration** extract for the NIST AI RMF static RAG demo
(Approach B: separate corpus). It is **not** an official NIST publication, profile,
baseline, or endorsement.

## Source

| Field | Value |
|-------|-------|
| Publication | NIST SP 800-53 Revision 5 |
| OSCAL package version | {version} |
| OSCAL last-modified | {last_modified} |
| Official DOI | {OFFICIAL_DOI} |
| Official PDF | {OFFICIAL_PDF} |
| OSCAL JSON used | {oscal_url} |

NIST publications are works of the U.S. Government and, as such, are not subject to
copyright protection in the United States. This demo redistributes cleaned Markdown
and retrieval chunks derived from the public OSCAL catalog.

## Scope of this extract

Included: control **statement** and **guidance** (discussion) for base controls and
enhancements.

Excluded: SP 800-53A assessment objectives and methods, baselines (SP 800-53B), and
organization-defined parameter resolutions beyond labeled ODP placeholders.

For normative or compliance use, cite the official NIST PDF/DOI, not this demo.
"""
    (SRC / "ATTRIBUTION.md").write_text(text, encoding="utf-8")


def render_control_md(control: dict, labels: dict[str, str], heading_level: int) -> tuple[str, dict]:
    cid = control.get("id") or ""
    anchor = slug_anchor(cid)
    label = control_label(control)
    title = (control.get("title") or "").strip()
    stmt = statement_text(control, labels)
    guide = guidance_prose(control.get("parts"), labels)
    hashes = "#" * heading_level
    body = [f'{hashes} {label} {title} <a id="{anchor}"></a>', ""]
    if stmt:
        body.append("**Control.**")
        body.append("")
        body.append(stmt)
        body.append("")
    if guide:
        body.append("**Discussion.**")
        body.append("")
        body.append(guide)
        body.append("")
    text_for_chunk = "\n".join(
        [
            f"{label} {title}.",
            stmt,
            guide,
        ]
    ).strip()
    chunk = {
        "chunk_id": f"{DOC_ID}:{anchor}",
        "doc_id": DOC_ID,
        "nist_id": NIST_ID,
        "version": None,  # filled by caller
        "title": f"{label} {title}".strip(),
        "section_path": f"SP 800-53 / {label} {title}".strip(),
        "anchor": anchor,
        "source_md": f"sp800-53/sources/PLACEHOLDER.md",
        "level": heading_level,
        "topics": ["sp800-53", "catalog"],
        "related_controls": [],
        "family": (cid.split("-")[0] if "-" in cid else cid).lower(),
        "control_id": label,
        "text": text_for_chunk[:12000],
    }
    return "\n".join(body), chunk


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument(
        "--cache",
        type=Path,
        default=ROOT / "build" / "nist_ai_rmf" / ".cache" / "NIST_SP-800-53_rev5_catalog.json",
    )
    args = ap.parse_args()

    raw = fetch_catalog(args.url, args.cache)
    catalog = raw.get("catalog") or raw
    meta = catalog.get("metadata") or {}
    version = str(meta.get("version") or "5")
    last_modified = str(meta.get("last-modified") or "")

    SRC.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    write_attribution(version, args.url, last_modified)

    chunks: list[dict] = []
    family_index: list[tuple[str, str, int]] = []

    for group in catalog.get("groups") or []:
        fam_id = (group.get("id") or "family").lower()
        fam_title = family_title(group)
        fam_file = f"{fam_id}.md"
        md_parts = [
            f"# {fam_title} <a id=\"{fam_id}\"></a>",
            "",
            "```",
            f"doc_id: {DOC_ID}",
            f"nist_id: {NIST_ID}",
            f"version: {version}",
            f"family: {fam_id}",
            f"doi: {OFFICIAL_DOI}",
            "disclaimer: Structured Markdown extract for demo retrieval. Not official NIST output.",
            "```",
            "",
        ]
        n_controls = 0
        for control in group.get("controls") or []:
            labels = param_labels(control)
            block, chunk = render_control_md(control, labels, 2)
            chunk["version"] = version
            chunk["source_md"] = f"sp800-53/sources/{fam_file}"
            chunk["section_path"] = f"{fam_title} / {chunk['title']}"
            chunk["family"] = fam_id
            chunk["topics"] = ["sp800-53", "catalog", fam_id]
            md_parts.append(block)
            chunks.append(chunk)
            n_controls += 1
            for enh in control.get("controls") or []:
                elabels = param_labels(enh)
                # inherit parent params for inserts
                merged = {**labels, **elabels}
                eblock, echunk = render_control_md(enh, merged, 3)
                echunk["version"] = version
                echunk["source_md"] = f"sp800-53/sources/{fam_file}"
                echunk["section_path"] = f"{fam_title} / {chunk['title']} / {echunk['title']}"
                echunk["family"] = fam_id
                echunk["parent_id"] = chunk["chunk_id"]
                echunk["topics"] = ["sp800-53", "catalog", fam_id, "enhancement"]
                md_parts.append(eblock)
                chunks.append(echunk)
                n_controls += 1

        (SRC / fam_file).write_text("\n".join(md_parts).rstrip() + "\n", encoding="utf-8")
        family_index.append((fam_id, fam_title, n_controls))
        print(f"wrote sources/{fam_file} ({n_controls} controls/enhancements)")

    index_lines = [
        "# SP 800-53 Rev 5 family index <a id=\"index\"></a>",
        "",
        f"OSCAL package version **{version}**. Statement + guidance only. See [ATTRIBUTION.md](ATTRIBUTION.md).",
        "",
    ]
    for fam_id, fam_title, n in family_index:
        index_lines.append(f"- [{fam_title}]({fam_id}.md) (`{fam_id}`, {n} entries)")
    (SRC / "index.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    (DATA / "chunks.json").write_text(json.dumps(chunks, indent=2), encoding="utf-8")

    manifest = {
        "demo_id": "nist-sp800-53-rag",
        "title": "NIST SP 800-53 Rev 5 catalog (separate corpus)",
        "version": "0.1.0",
        "catalog_version": version,
        "disclaimer": "Not official NIST output. Derived from public OSCAL SP 800-53 catalog for demonstration.",
        "official_doi": OFFICIAL_DOI,
        "official_pdf": OFFICIAL_PDF,
        "oscal_source": args.url,
        "scope": {
            "includes": ["control statement", "control guidance/discussion", "enhancements"],
            "excludes": ["800-53A assessment procedures", "800-53B baselines", "resolved ODPs"],
        },
        "isolation": {
            "default_ai_rmf_corpus": "nist-ai-rmf/data",
            "this_corpus": "nist-ai-rmf/sp800-53/data",
            "blend_with_ai_rmf": False,
            "ui_opt_in_doc_id": DOC_ID,
        },
        "documents": [
            {
                "doc_id": DOC_ID,
                "title": "NIST SP 800-53 Revision 5 (catalog extract)",
                "nist_id": NIST_ID,
                "version": version,
                "doi": OFFICIAL_DOI,
                "pdf": OFFICIAL_PDF,
                "source_md": "sp800-53/sources/",
            }
        ],
        "families": [{"id": f, "title": t, "n": n} for f, t, n in family_index],
        "chunk_count": len(chunks),
        "join_hints": {
            "scope": "standalone-sibling",
            "entry_point": "nist-ai-rmf/llms.txt",
            "chunk_key": "chunk_id",
            "anchor_scheme": "control id lowercased",
        },
    }
    (DATA / "corpus-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"chunks={len(chunks)} -> {DATA / 'chunks.json'}")


if __name__ == "__main__":
    main()
