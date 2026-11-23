#!/usr/bin/env python3
"""Link agentic synthesis source codes to anchored source rows.

Source of truth for codes and URLs: agentic-ai-security/agentic-security.md
(parse_synthesis in generate_principle_catalogs.py).

Writes:
  agentic-ai-security/agentic-security.md   inline markdown links
  agentic-ai-security/llms-full.txt        header + linked markdown body
  agentic-ai-security/index.html           Code column, row anchors, inline links

Run after editing agentic-security.md tables or prose citations.
"""
from __future__ import annotations

import html
import importlib.util
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENTIC = os.path.join(ROOT, "agentic-ai-security")
MD_PATH = os.path.join(AGENTIC, "agentic-security.md")
LLMS_FULL = os.path.join(AGENTIC, "llms-full.txt")
HTML_PATH = os.path.join(AGENTIC, "index.html")
GPC = os.path.join(ROOT, "build", "generate_principle_catalogs.py")

SITE = "https://aisharedresponsibility.com/agentic-ai-security/"
EDITORIAL_POSITION = "editorial-position"
EDITORIAL_CITE = "editorial position"

SRC_ROW_RE = re.compile(
    r'^\| (?:<a id="src-([A-Z][A-Z0-9-]+)"></a>)?'
    r'(?:\[([A-Z][A-Z0-9-]+)\]\([^|\)]+\)|([A-Z][A-Z0-9-]+)) \| '
    r"(.+?) \| (.+?) \| (.+?) \| (\S+) \|.*$",
    re.M,
)

TABLE_GROUPS = [
    (
        "agentic",
        r"\*\*Agentic security \(Sections 1-11\)\*\*",
        "Papers cited in the principles on this page",
    ),
    (
        "supply",
        r"\*\*Supply chain and general AI security \(Sections 12-20\)\*\*",
        "Additional organization papers cited in the principles",
    ),
    (
        "peer",
        r"\*\*Peer SDOs and coalitions\*\*",
        "Standards-body and industry papers cited in the principles",
    ),
]

LLMS_FULL_HEADER = """# AI and Agent Security: A Cross-Framework Synthesis

> A topic-organized synthesis of the axioms, invariant rules, and principles that recur across sixty-eight published whitepapers, guides, and frameworks on AI and agentic AI security, drawn from BIML, CIS, CSA, CoSAI, NIST, OWASP, SANS, ETSI, ENISA, the Frontier Model Forum, OpenSSF, AI Verify, and CISA. Six claims from seven talks at the first [un]prompted conference (March 2026) carry UNPROMPTED1- source codes, and nine claims from seven talks at [un]prompted II (October 2026) carry UNPROMPTED2- source codes.
>
> Canonical HTML: https://aisharedresponsibility.com/agentic-ai-security/
> This file: https://aisharedresponsibility.com/agentic-ai-security/llms-full.txt
> Source markdown: https://aisharedresponsibility.com/agentic-ai-security/agentic-security.md
"""


def parse_sources():
    spec = importlib.util.spec_from_file_location("gpc_sync", GPC)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.parse_synthesis()


def escape_title(title: str) -> str:
    return title.replace('"', "'")


def md_link(code: str, meta: dict) -> str:
    return f"[{code}]({meta['url']})"


def html_link(code: str, meta: dict) -> str:
    title = html.escape(meta["title"], quote=True)
    return (
        f'<a class="ag-cite" href="#src-{code}" title="{title}">{code}</a>'
    )


def code_pattern(codes: set[str]) -> re.Pattern[str]:
    ordered = sorted(codes, key=len, reverse=True)
    body = "|".join(re.escape(c) for c in ordered)
    return re.compile(rf"(?<![A-Z0-9-])({body})(?![A-Z0-9-])")


def link_markdown(text: str, sources: dict) -> str:
    codes = set(sources)
    pat = code_pattern(codes)
    out = []
    for line in text.split("\n"):
        if line.startswith("| "):
            out.append(line)
            continue

        def repl(m: re.Match[str], line: str = line) -> str:
            code = m.group(1)
            start = m.start()
            if start > 0 and line[start - 1] == "[":
                return m.group(0)
            ctx = line[max(0, start - 160) : start]
            if re.search(r"https?://\S*$", ctx):
                return m.group(0)
            if f'<a id="src-{code}"></a>' in ctx:
                return m.group(0)
            return md_link(code, sources[code])

        out.append(pat.sub(repl, line))
    return "\n".join(out)


def link_markdown_tables(text: str, sources: dict) -> str:
    """Add row anchors in source tables: | <a id="src-CODE"></a>[CODE](url) | ..."""
    row_head = re.compile(
        r'^\| (?:<a id="src-([A-Z][A-Z0-9-]+)"></a>)?'
        r'(?:\[([A-Z][A-Z0-9-]+)\]\([^|\)]+\)|([A-Z][A-Z0-9-]+)) \|'
    )
    out = []
    for line in text.split("\n"):
        m = row_head.match(line)
        if m:
            code = m.group(1) or m.group(2) or m.group(3)
            if code in sources:
                anchor = f'<a id="src-{code}"></a>'
                linked = md_link(code, sources[code])
                line = row_head.sub(f"| {anchor}{linked} |", line, count=1)
        out.append(line)
    return "\n".join(out)


def link_html_text(text: str, sources: dict) -> str:
    pat = code_pattern(set(sources))
    parts = re.split(r"(<[^>]+>)", text)
    in_anchor = False
    skip_tag = False
    out = []
    for part in parts:
        if part.startswith("<"):
            low = part.lower()
            if low.startswith("<a ") or low.startswith("<a>"):
                in_anchor = True
            if low.startswith("</a"):
                in_anchor = False
            if low.startswith("<script") or low.startswith("<style"):
                skip_tag = True
            if low.startswith("</script") or low.startswith("</style"):
                skip_tag = False
            out.append(part)
            continue
        if in_anchor or skip_tag:
            out.append(part)
            continue

        def repl(m: re.Match[str]) -> str:
            code = m.group(1)
            return html_link(code, sources[code])

        out.append(pat.sub(repl, part))
    return "".join(out)


def html_table_row(code: str, meta: dict) -> str:
    title = html.escape(meta["title"])
    org = html.escape(meta["org"])
    date = html.escape(meta["date"])
    url = html.escape(meta["url"], quote=True)
    code_cell = html_link(code, meta)
    return (
        f'<tr id="src-{code}"><th scope="row">{code_cell}</th>'
        f"<td>{title}</td><td>{org}</td><td>{date}</td>"
        f'<td><a href="{url}" target="_blank" rel="noopener">Link</a></td></tr>'
    )


def table_codes_in_section(md: str, header_pat: str) -> list[str]:
    pos = re.search(header_pat, md)
    if not pos:
        raise SystemExit(f"source section not found: {header_pat}")
    chunk = md[pos.end() :]
    nxt = re.search(r"\n\*\*", chunk)
    if nxt:
        chunk = chunk[: nxt.start()]
    codes = []
    for anchor_code, link_code, plain_code, *_ in SRC_ROW_RE.findall(chunk):
        codes.append(anchor_code or link_code or plain_code)
    return codes


def rebuild_paper_tables(html: str, md: str, sources: dict) -> str:
    for _slug, header_pat, caption in TABLE_GROUPS:
        codes = table_codes_in_section(md, header_pat)
        rows = "".join(html_table_row(c, sources[c]) for c in codes)
        tbody = f"<tbody>{rows}</tbody>"
        cap_re = re.compile(
            rf"(<caption>{re.escape(caption)}</caption>"
            rf"<thead><tr><th scope=\"col\">Title</th>.*?</thead>)<tbody>.*?</tbody>",
            re.S,
        )
        cap_re2 = re.compile(
            rf"(<caption>{re.escape(caption)}</caption>"
            rf"<thead><tr><th scope=\"col\">Code</th>.*?</thead>)<tbody>.*?</tbody>",
            re.S,
        )
        thead = (
            '<thead><tr><th scope="col">Code</th><th scope="col">Title</th>'
            '<th scope="col">Organization</th><th scope="col">Date</th>'
            '<th scope="col">Link</th></tr></thead>'
        )
        block = f"<caption>{caption}</caption>{thead}{tbody}"
        if cap_re2.search(html):
            html = cap_re2.sub(block, html, count=1)
        elif cap_re.search(html):
            html = cap_re.sub(block, html, count=1)
        else:
            raise SystemExit(f"table not found for caption: {caption}")
    return html


def patch_talks_table(html: str, sources: dict) -> str:
    def row_repl(m: re.Match[str]) -> str:
        row = m.group(0)
        code_m = re.search(
            r"<tr><td data-label=\"Code\">([A-Z][A-Z0-9-]+)</td>", row
        )
        if not code_m:
            return row
        code = code_m.group(1)
        if f'id="src-{code}"' in row:
            return row
        if f'id="src-{code}"' not in row:
            row = row.replace("<tr>", f'<tr id="src-{code}">', 1)
        return row

    return re.sub(
        r"<tr><td data-label=\"Code\">UNPROMPTED.*?</tr>",
        row_repl,
        html,
        flags=re.S,
    )


def ensure_html_styles(html: str) -> str:
    if ".ag-cite" in html and "tbody tr:target" in html:
        return html
    inject = """
      .prose .ag-cite {
        font-weight: 600;
        color: var(--cosai-blue);
        text-decoration: none;
        white-space: nowrap;
      }
      .prose .ag-cite:hover { text-decoration: underline; }
      .src-table tbody tr:target {
        background: var(--cosai-blue-light);
      }
      .src-table th[scope="row"] {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--slate-900);
        white-space: nowrap;
      }
"""
    return html.replace(
        "      .doc-meta a { font-weight: 600; }",
        "      .doc-meta a { font-weight: 600; }" + inject,
        1,
    )


def verify_outputs(html: str, sources: dict) -> dict:
    from collections import Counter

    linked = len(re.findall(r'class="ag-cite"', html))
    anchor_ids = re.findall(
        r'(?:\bid|<tr\s+id)="(src-[A-Z][A-Z0-9-]+)"', html
    )
    counts = Counter(anchor_ids)
    dupes = sorted(k for k, v in counts.items() if v > 1)
    missing = sorted(
        code for code in sources if f"src-{code}" not in set(anchor_ids)
    )
    return {
        "linked_cites": linked,
        "anchor_count": len(anchor_ids),
        "unique_anchors": len(counts),
        "duplicate_anchors": dupes,
        "missing_row_anchors": missing,
    }


def main() -> int:
    check_only = "--check" in sys.argv
    sources, _sections, _order = parse_sources()
    md_raw = open(MD_PATH, encoding="utf-8").read()
    md_linked = link_markdown_tables(link_markdown(md_raw, sources), sources)

    html_raw = open(HTML_PATH, encoding="utf-8").read()
    html_raw = ensure_html_styles(html_raw)
    html_raw = rebuild_paper_tables(html_raw, md_raw, sources)
    html_raw = patch_talks_table(html_raw, sources)
    article_m = re.search(
        r"(<article class=\"prose\">)(.*?)(</article>)", html_raw, re.S
    )
    if not article_m:
        raise SystemExit("prose article not found in index.html")
    article_body = link_html_text(article_m.group(2), sources)
    html_out = (
        html_raw[: article_m.start(2)]
        + article_body
        + html_raw[article_m.end(2) :]
    )

    llms_body = md_linked
    if llms_body.startswith("# "):
        llms_body = re.sub(r"^#[^\n]+\n+", "", llms_body, count=1)
    llms_out = LLMS_FULL_HEADER.rstrip() + "\n" + llms_body.lstrip("\n")

    report = verify_outputs(html_out, sources)

    if check_only:
        print(report)
        if report["duplicate_anchors"] or report["missing_row_anchors"]:
            return 1
        return 0

    open(MD_PATH, "w", encoding="utf-8").write(md_linked)
    open(LLMS_FULL, "w", encoding="utf-8").write(llms_out)
    open(HTML_PATH, "w", encoding="utf-8").write(html_out)
    print(
        f"synced agentic synthesis: {report['linked_cites']} ag-cite links, "
        f"{report['anchor_count']} row anchors"
    )
    if report["duplicate_anchors"]:
        print("duplicate anchors:", report["duplicate_anchors"], file=sys.stderr)
        return 1
    if report["missing_row_anchors"]:
        print("missing anchors:", report["missing_row_anchors"], file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())