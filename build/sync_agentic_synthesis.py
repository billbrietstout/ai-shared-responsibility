#!/usr/bin/env python3
"""Hide internal source codes on the agentic synthesis page.

Readers see numbered [n] links (prior-art pattern) and title links to URLs.
Stable row anchors remain id=\"src-{CODE}\" for deep links.

Source tables and codes: agentic-ai-security/agentic-security.md
(parse_synthesis in generate_principle_catalogs.py).

Writes agentic-security.md, llms-full.txt, index.html.
"""
from __future__ import annotations

import html as html_mod
import importlib.util
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENTIC = os.path.join(ROOT, "agentic-ai-security")
MD_PATH = os.path.join(AGENTIC, "agentic-security.md")
LLMS_FULL = os.path.join(AGENTIC, "llms-full.txt")
HTML_PATH = os.path.join(AGENTIC, "index.html")
CATALOG_PATH = os.path.join(ROOT, "data", "ai-agentic-principles.json")
GPC = os.path.join(ROOT, "build", "generate_principle_catalogs.py")

def split_bullet_citation(line: str) -> tuple[str, str] | None:
    """Split a one-line bullet into prefix and parenthetical citation."""
    line = line.rstrip()
    if not line.startswith("- ") or not line.endswith(")"):
        return None
    depth = 0
    cite_start: int | None = None
    for i, ch in enumerate(line):
        if ch == "(":
            if depth == 0 and i > 0 and line[i - 1] == " ":
                cite_start = i
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0 and cite_start is not None and i == len(line) - 1:
                return line[:cite_start], line[cite_start + 1 : -1]
            if depth == 0:
                cite_start = None
    return None

EDITORIAL_POSITION = "editorial-position"
EDITORIAL_CITE = "editorial position"

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

TALKS_HEADER = r"\*\*Conference talks\*\*"
TALKS_CAPTION = "Conference talks cited on this page"

LLMS_FULL_HEADER = """# AI and Agent Security: A Cross-Framework Synthesis

> A topic-organized synthesis of the axioms, invariant rules, and principles that recur across sixty-eight published whitepapers, guides, and frameworks on AI and agentic AI security, drawn from BIML, CIS, CSA, CoSAI, NIST, OWASP, SANS, ETSI, ENISA, the Frontier Model Forum, OpenSSF, AI Verify, and CISA. Six claims from seven talks at the first [un]prompted conference (March 2026), and nine claims from seven talks at [un]prompted II (October 2026), appear in the conference section of the source table below.
>
> Canonical HTML: https://aisharedresponsibility.com/agentic-ai-security/
> This file: https://aisharedresponsibility.com/agentic-ai-security/llms-full.txt
> Source markdown: https://aisharedresponsibility.com/agentic-ai-security/agentic-security.md
"""

ANCHOR_IN_ROW = re.compile(r'<a id="src-([A-Z][A-Z0-9-]+)"></a>')
PLAIN_ROW_CODE = re.compile(
    r"^\| ([A-Z][A-Z0-9-]+) \| (.+?) \| (.+?) \| (.+?) \| (\S+) \|(.*)$"
)

INTRO_MD_REPLACEMENTS = [
    (
        "Six claims from seven talks at the first [un]prompted conference (March 2026) carry UNPROMPTED1- source codes, and nine claims from seven talks at [un]prompted II (October 2026) carry UNPROMPTED2- source codes.",
        "Six claims from seven talks at the first [un]prompted conference (March 2026), and nine claims from seven talks at [un]prompted II (October 2026), appear in the conference section of the source table below.",
    ),
    (
        "using the short codes defined in the [Source Documents](#sources) table directly below, placed here rather than at the end so a code is defined before the first time it's used, not after.",
        "using the numbered sources in the [Source Documents](#sources) table directly below, placed here rather than at the end so a source is defined before the first time it is used, not after.",
    ),
    (
        "In March 2026, six claims from seven talks at the first [un]prompted conference were added, cited with the UNPROMPTED1- codes in the source table below. In October 2026, nine claims from seven talks at [un]prompted II were added, cited with the UNPROMPTED2- codes.",
        "In March 2026, six claims from seven talks at the first [un]prompted conference were added; they appear in the conference section of the source table below. In October 2026, nine claims from seven talks at [un]prompted II were added there as well.",
    ),
    (
        "The SANS Critical AI Security Guidelines v1.2 source code was retired when the inventory stopped carrying that edition; v1.4 remains as ",
        "The SANS Critical AI Security Guidelines v1.2 edition was retired when the inventory stopped carrying that edition; v1.4 remains as ",
    ),
]

HEADER_ROW_MARKERS = ("| Code |", "| # |")


def parse_sources():
    spec = importlib.util.spec_from_file_location("gpc_sync", GPC)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.parse_synthesis()


def url_maps(sources: dict) -> tuple[dict[str, str], dict[str, str]]:
    url_to_code: dict[str, str] = {}
    title_to_code: dict[str, str] = {}
    for code, meta in sources.items():
        title_to_code[meta["title"]] = code
        url = meta["url"]
        if url not in url_to_code:
            url_to_code[url] = code
    unique_url: dict[str, str] = {}
    url_counts: dict[str, int] = {}
    for meta in sources.values():
        url_counts[meta["url"]] = url_counts.get(meta["url"], 0) + 1
    for code, meta in sources.items():
        if url_counts[meta["url"]] == 1:
            unique_url[meta["url"]] = code
    return title_to_code, unique_url


def code_pattern(codes: set[str]) -> re.Pattern[str]:
    ordered = sorted(codes, key=len, reverse=True)
    body = "|".join(re.escape(c) for c in ordered)
    return re.compile(rf"(?<![A-Z0-9-])({body})(?![A-Z0-9-])")


def statement_src_map() -> dict[str, list[str]]:
    data = json.loads(open(CATALOG_PATH, encoding="utf-8").read())
    out: dict[str, list[str]] = {}
    for principle in data.get("principles", []):
        stmt = (principle.get("statement") or "").strip()
        if not stmt:
            continue
        out[stmt] = list(principle.get("src") or [])
    return out


def restore_bullet_citations(md: str, stmt_src: dict[str, list[str]]) -> str:
    """Put canonical source codes back into bullet citations after a bad title-link pass."""
    out = []
    for line in md.split("\n"):
        split = split_bullet_citation(line)
        if not split:
            out.append(line)
            continue
        prefix, inner = split
        stmt = prefix[2:].strip()
        if EDITORIAL_CITE in inner.lower():
            out.append(line)
            continue
        if re.fullmatch(r"[A-Z][A-Z0-9-]+(?:,\s*[A-Z][A-Z0-9-]+)*", inner.strip()):
            out.append(line)
            continue
        srcs = stmt_src.get(stmt)
        if not srcs:
            out.append(line)
            continue
        out.append(f"{prefix} ({', '.join(srcs)})")
    return "\n".join(out)


def markdown_links_to_codes(
    text: str,
    title_to_code: dict[str, str],
    unique_url_to_code: dict[str, str],
    codes: set[str],
) -> str:
    def repl(m: re.Match[str]) -> str:
        label, link = m.group(1), m.group(2)
        if label in codes:
            return label
        if label in title_to_code:
            return title_to_code[label]
        if link in unique_url_to_code:
            return unique_url_to_code[link]
        return m.group(0)

    return re.sub(r"\[([^\]]+)\]\(([^\)]+)\)", repl, text)


def split_table_row(line: str) -> list[str] | None:
    if not line.startswith("| ") or line.startswith("|---"):
        return None
    inner = line.strip()
    if inner.endswith("|"):
        inner = inner[:-1]
    parts = [p.strip() for p in inner[1:].split("|")]
    return parts


def parse_row_fields(parts: list[str]) -> tuple[str, str, str, str, str, str] | None:
    if len(parts) < 5:
        return None
    first = parts[0]
    m = ANCHOR_IN_ROW.search(first)
    code = None
    if m:
        code = m.group(1)
        if len(parts) < 5:
            return None
        title_cell, org, date, link = parts[1], parts[2], parts[3], parts[4]
        extra = "|".join(parts[5:]) if len(parts) > 5 else ""
    else:
        m2 = re.match(r"^([A-Z][A-Z0-9-]+)$", first)
        if not m2:
            return None
        code = m2.group(1)
        title_cell, org, date, link = parts[1], parts[2], parts[3], parts[4]
        extra = "|".join(parts[5:]) if len(parts) > 5 else ""
    title = title_cell
    tm = re.match(r"\[(.+?)\]\([^\)]+\)", title_cell.strip())
    if tm:
        title = tm.group(1)
    return code, title.strip(), org.strip(), date.strip(), link.strip(), extra


def table_codes_in_section(md: str, header_pat: str) -> list[str]:
    pos = re.search(header_pat, md)
    if not pos:
        raise SystemExit(f"source section not found: {header_pat}")
    chunk = md[pos.end() :]
    nxt = re.search(r"\n\*\*", chunk)
    if nxt:
        chunk = chunk[: nxt.start()]
    codes = []
    for line in chunk.split("\n"):
        parts = split_table_row(line)
        if not parts:
            continue
        parsed = parse_row_fields(parts)
        if parsed:
            codes.append(parsed[0])
    return codes


def talk_codes_in_section(md: str) -> list[str]:
    pos = re.search(TALKS_HEADER, md)
    if not pos:
        return []
    chunk = md[pos.end() :]
    nxt = re.search(r"\n## ", chunk)
    if nxt:
        chunk = chunk[: nxt.start()]
    codes = []
    for line in chunk.split("\n"):
        parts = split_table_row(line)
        if not parts:
            continue
        parsed = parse_row_fields(parts)
        if parsed:
            codes.append(parsed[0])
    return codes


def build_numbering(md: str, sources: dict) -> dict[str, int]:
    codes: list[str] = []
    for _slug, header_pat, _cap in TABLE_GROUPS:
        codes.extend(table_codes_in_section(md, header_pat))
    codes.extend(talk_codes_in_section(md))
    missing = sorted(set(sources) - set(codes))
    extra = [c for c in codes if c not in sources]
    if missing:
        raise SystemExit(f"table rows missing sources: {missing[:5]}")
    if extra:
        raise SystemExit(f"unknown table codes: {extra[:5]}")
    return {code: i + 1 for i, code in enumerate(codes)}


def display_title(title: str, code: str) -> str:
    """Drop a trailing parenthetical that repeats the site source code."""
    suffix = f"({code})"
    if title.endswith(suffix):
        return title[: -len(suffix)].rstrip()
    return title


def md_title_link(meta: dict, code: str) -> str:
    title = display_title(meta["title"], code).replace("|", "\\|")
    return f"[{title}]({meta['url']})"


def html_cite_link(code: str, meta: dict, num: int) -> str:
    title = html_mod.escape(display_title(meta["title"], code), quote=True)
    label = html_mod.escape(f"[{num}]")
    return (
        f'<a class="pa-cite" href="#src-{code}" title="{title}" '
        f'aria-label="{title}">[{num}]</a>'
    )


def link_markdown_prose(
    text: str, sources: dict, nums: dict[str, int], title_to_code: dict[str, str]
) -> str:
    codes = set(sources)
    pat = code_pattern(codes)
    out = []
    for line in text.split("\n"):
        if line.startswith("| ") or line.strip() in HEADER_ROW_MARKERS:
            out.append(line)
            continue

        def repl(m: re.Match[str], line: str = line) -> str:
            code = m.group(1)
            start = m.start()
            if code == EDITORIAL_POSITION:
                return m.group(0)
            if start > 0 and line[start - 1] == "[":
                return m.group(0)
            ctx = line[max(0, start - 160) : start]
            if re.search(r"https?://\S*$", ctx):
                return m.group(0)
            if f'<a id="src-{code}"></a>' in ctx:
                return m.group(0)
            return md_title_link(sources[code], code)

        out.append(pat.sub(repl, line))
    return "\n".join(out)


def rewrite_table_header_block(md: str) -> str:
    md = md.replace("| Code | Title |", "| # | Title |", 3)
    md = md.replace(
        "| Code | Title | Organization | Date | Link | Claims |",
        "| # | Title | Organization | Date | Link | Claims |",
        1,
    )
    return md


def rewrite_source_table_rows(
    md: str, sources: dict, nums: dict[str, int]
) -> str:
    lines = []
    for line in md.split("\n"):
        parts = split_table_row(line)
        if not parts:
            lines.append(line)
            continue
        parsed = parse_row_fields(parts)
        if not parsed:
            lines.append(line)
            continue
        code, title, org, date, link, extra = parsed
        if code not in sources:
            lines.append(line)
            continue
        num = nums[code]
        meta = sources[code]
        title_link = md_title_link(meta, code)
        anchor = f'<a id="src-{code}"></a>'
        if extra:
            row = (
                f"| {anchor}{num} | {title_link} | {org} | {date} | {link} | {extra} |"
            )
        else:
            row = f"| {anchor}{num} | {title_link} | {org} | {date} | {link} |"
        lines.append(row)
    return "\n".join(lines)


def apply_intro_replacements(md: str, sources: dict) -> str:
    for old, new in INTRO_MD_REPLACEMENTS:
        md = md.replace(old, new)
    return md


def html_table_row(code: str, meta: dict, num: int) -> str:
    title = html_mod.escape(display_title(meta["title"], code))
    org = html_mod.escape(meta["org"])
    date = html_mod.escape(meta["date"])
    url = html_mod.escape(meta["url"], quote=True)
    num_cell = f'<span class="ag-src__id">[{num}]</span>'
    title_link = (
        f'<a href="{url}" target="_blank" rel="noopener">{title}</a>'
    )
    return (
        f'<tr id="src-{code}"><th scope="row">{num_cell}</th>'
        f"<td>{title_link}</td><td>{org}</td><td>{date}</td></tr>"
    )


def rebuild_paper_tables(html: str, md: str, sources: dict, nums: dict[str, int]) -> str:
    for _slug, header_pat, caption in TABLE_GROUPS:
        codes = table_codes_in_section(md, header_pat)
        rows = "".join(html_table_row(c, sources[c], nums[c]) for c in codes)
        tbody = f"<tbody>{rows}</tbody>"
        block_re = re.compile(
            rf"(<caption>{re.escape(caption)}</caption>\s*"
            rf"<thead><tr>.*?</thead>)<tbody>.*?</tbody>",
            re.S,
        )
        thead = (
            '<thead><tr><th scope="col">#</th><th scope="col">Title</th>'
            '<th scope="col">Organization</th><th scope="col">Date</th>'
            "</tr></thead>"
        )
        block = f"<caption>{caption}</caption>{thead}{tbody}"
        if not block_re.search(html):
            raise SystemExit(f"table not found for caption: {caption}")
        html = block_re.sub(block, html, count=1)
    return html


def extract_talk_claims_html(html: str) -> dict[str, str]:
    table = re.search(
        r'<table class="src-table src-table--talks">.*?<tbody>(.*?)</tbody>',
        html,
        re.S,
    )
    if not table:
        return {}
    out: dict[str, str] = {}
    for m in re.finditer(
        r'<tr id="src-([A-Z][A-Z0-9-]+)".*?'
        r'<td class="claims"[^>]*>(.*?)</td>\s*</tr>',
        table.group(1),
        re.S,
    ):
        out[m.group(1)] = m.group(2).strip()
    return out


def rebuild_talks_table(html: str, md: str, sources: dict, nums: dict[str, int]) -> str:
    codes = talk_codes_in_section(md)
    claims_by_code = extract_talk_claims_html(html)
    rows = []
    for code in codes:
        meta = sources[code]
        num = nums[code]
        title = html_mod.escape(display_title(meta["title"], code))
        org = html_mod.escape(meta["org"])
        date = html_mod.escape(meta["date"])
        url = html_mod.escape(meta["url"], quote=True)
        claims_html = claims_by_code.get(code, "")
        if not claims_html:
            claims_html = (
                f'<span class="claim-missing">Not yet recorded</span>'
            )
        num_cell = f'<span class="ag-src__id">[{num}]</span>'
        title_link = f'<a href="{url}" target="_blank" rel="noopener">{title}</a>'
        row = (
            f'<tr id="src-{code}"><td data-label="#">{num_cell}</td>'
            f'<td data-label="Title">{title_link}</td>'
            f'<td data-label="Organization">{org}</td>'
            f'<td data-label="Date">{date}</td>'
            f'<td class="claims" data-label="Claims">{claims_html}</td></tr>'
        )
        rows.append(row)
    tbody = "<tbody>" + "".join(rows) + "</tbody>"
    start = html.find('<table class="src-table src-table--talks">')
    if start < 0:
        raise SystemExit("conference talks table not found in index.html")
    end = html.find("</table>", start)
    if end < 0:
        raise SystemExit("conference talks table end not found")
    end += len("</table>")
    table_html = html[start:end]
    inner_re = re.compile(
        rf"<caption>{re.escape(TALKS_CAPTION)}</caption>.*?"
        rf"<tbody>.*</tbody>",
        re.S,
    )
    thead = (
        '<thead><tr><th scope="col">#</th><th scope="col">Title</th>'
        '<th scope="col">Organization</th><th scope="col">Date</th>'
        '<th scope="col">Claims</th></tr></thead>'
    )
    block = f"<caption>{TALKS_CAPTION}</caption>{thead}{tbody}"
    if not inner_re.search(table_html):
        raise SystemExit("conference talks table not found in index.html")
    new_table = inner_re.sub(block, table_html, count=1)
    return html[:start] + new_table + html[end:]


def link_html_text(text: str, sources: dict, nums: dict[str, int]) -> str:
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
            if code not in nums:
                return m.group(0)
            return html_cite_link(code, sources[code], nums[code])

        out.append(pat.sub(repl, part))
    return "".join(out)


def patch_html_intro(html: str, sources: dict, nums: dict[str, int]) -> str:
    html = re.sub(
        r"source codes that start with UNPROMPTED1-.*?UNPROMPTED2-[^.<]*",
        "numbered entries in the conference section of the source table below",
        html,
        count=1,
        flags=re.S,
    )
    html = html.replace(
        "They use UNPROMPTED1- codes.",
        "They appear in the conference section of the source table.",
    )
    html = html.replace(
        "They use UNPROMPTED2- codes.",
        "They appear in the conference section of the source table.",
    )
    html = re.sub(
        r"The SANS Critical AI Security Guidelines v1\.2 source code was retired",
        "The SANS Critical AI Security Guidelines v1.2 edition was retired",
        html,
        count=1,
    )
    if "SANS-CAISG14" in sources:
        meta = sources["SANS-CAISG14"]
        num = nums.get("SANS-CAISG14", 0)
        rep = html_cite_link("SANS-CAISG14", meta, num)
        html = re.sub(
            r'<a class="[^"]*" href="#src-SANS-CAISG14"[^>]*>[^<]+</a>',
            rep,
            html,
            count=1,
        )
    return html


def ensure_html_styles(html: str) -> str:
    inject = """
      .prose .pa-cite {
        font-size: var(--text-sm);
        white-space: nowrap;
        font-weight: 600;
        color: var(--cosai-blue);
        text-decoration: none;
      }
      .prose .pa-cite:hover { text-decoration: underline; }
      .src-table tbody tr:target {
        background: var(--cosai-blue-light);
      }
      .ag-src__id {
        font-weight: 600;
        color: var(--slate-900);
        white-space: nowrap;
      }
      .src-table td[data-label="#"] .ag-src__id,
      .src-table th[scope="row"] .ag-src__id {
        color: var(--cosai-blue);
      }
"""
    if ".prose .pa-cite" in html and "ag-src__id" in html:
        return html
    html = re.sub(
        r"\.prose \.ag-cite[^}]+\}[^}]+\}",
        "",
        html,
        count=2,
    )
    html = re.sub(
        r"\.src-table th\[scope=\"row\"\][^}]+\}",
        "",
        html,
        count=1,
    )
    return html.replace(
        "      .doc-meta a { font-weight: 600; }",
        "      .doc-meta a { font-weight: 600; }" + inject,
        1,
    )


def strip_html_legacy_cite_links(html: str, sources: dict, nums: dict[str, int]) -> str:
    def repl(m: re.Match[str]) -> str:
        code = m.group(2)
        if code not in sources:
            return m.group(0)
        return html_cite_link(code, sources[code], nums[code])

    return re.sub(
        r'<a class="ag-cite" href="#src-([A-Z][A-Z0-9-]+)"[^>]*>([A-Z][A-Z0-9-]+)</a>',
        repl,
        html,
    )


def visible_codes_in_text(text: str, codes: set[str]) -> list[str]:
    """Return source codes that appear as visible prose (not only in id= attributes)."""
    scrubbed = re.sub(r'id="src-[A-Z][A-Z0-9-]+"', "", text)
    scrubbed = re.sub(r'<a id="src-[A-Z][A-Z0-9-]+"></a>', "", scrubbed)
    scrubbed = re.sub(
        r'\s(?:title|aria-label)="[^"]*"', "", scrubbed, flags=re.I
    )
    scrubbed = re.sub(r"https?://\S+", "", scrubbed)
    scrubbed = re.sub(r"\[[^\]]*\]\([^\)]+\)", "", scrubbed)
    pat = code_pattern(codes)
    found = set()
    for m in pat.finditer(scrubbed):
        found.add(m.group(1))
    return sorted(found)


def verify_outputs(html: str, sources: dict, md: str, llms: str) -> dict:
    from collections import Counter

    linked = len(re.findall(r'class="pa-cite"', html))
    anchor_ids = re.findall(
        r'(?:\bid|<tr\s+id)="(src-[A-Z][A-Z0-9-]+)"', html
    )
    counts = Counter(anchor_ids)
    dupes = sorted(k for k, v in counts.items() if v > 1)
    missing = sorted(
        code for code in sources if f"src-{code}" not in set(anchor_ids)
    )
    code_set = set(sources)
    visible = {
        "agentic-security.md": visible_codes_in_text(md, code_set),
        "index.html": visible_codes_in_text(html, code_set),
        "llms-full.txt": visible_codes_in_text(llms, code_set),
    }
    return {
        "linked_cites": linked,
        "anchor_count": len(anchor_ids),
        "unique_anchors": len(counts),
        "duplicate_anchors": dupes,
        "missing_row_anchors": missing,
        "visible_source_codes": visible,
    }


def main() -> int:
    check_only = "--check" in sys.argv

    sources, _sections, _order = parse_sources()
    title_to_code, unique_url_to_code = url_maps(sources)

    md_raw = open(MD_PATH, encoding="utf-8").read()
    nums = build_numbering(md_raw, sources)

    md_work = restore_bullet_citations(md_raw, statement_src_map())
    md_work = markdown_links_to_codes(
        md_work, title_to_code, unique_url_to_code, set(sources)
    )
    md_work = apply_intro_replacements(md_work, sources)
    md_work = rewrite_table_header_block(md_work)
    md_work = rewrite_source_table_rows(md_work, sources, nums)
    md_out = link_markdown_prose(md_work, sources, nums, title_to_code)

    html_raw = open(HTML_PATH, encoding="utf-8").read()
    html_raw = ensure_html_styles(html_raw)
    html_raw = rebuild_paper_tables(html_raw, md_raw, sources, nums)
    html_raw = rebuild_talks_table(html_raw, md_raw, sources, nums)

    article_m = re.search(
        r"(<article class=\"prose\">)(.*?)(</article>)", html_raw, re.S
    )
    if not article_m:
        raise SystemExit("prose article not found in index.html")
    article_body = link_html_text(article_m.group(2), sources, nums)
    article_body = strip_html_legacy_cite_links(article_body, sources, nums)
    html_out = (
        html_raw[: article_m.start(2)]
        + article_body
        + html_raw[article_m.end(2) :]
    )
    html_out = strip_html_legacy_cite_links(html_out, sources, nums)
    html_out = patch_html_intro(html_out, sources, nums)

    llms_body = md_out
    if llms_body.startswith("# "):
        llms_body = re.sub(r"^#[^\n]+\n+", "", llms_body, count=1)
    llms_out = LLMS_FULL_HEADER.rstrip() + "\n" + llms_body.lstrip("\n")

    report = verify_outputs(html_out, sources, md_out, llms_out)

    if check_only:
        print(report)
        if (
            report["duplicate_anchors"]
            or report["missing_row_anchors"]
            or any(report["visible_source_codes"].values())
        ):
            return 1
        return 0

    open(MD_PATH, "w", encoding="utf-8").write(md_out)
    open(LLMS_FULL, "w", encoding="utf-8").write(llms_out)
    open(HTML_PATH, "w", encoding="utf-8").write(html_out)
    print(
        f"synced agentic synthesis: {report['linked_cites']} pa-cite links, "
        f"{report['unique_anchors']} row anchors"
    )
    vis = report["visible_source_codes"]
    if any(vis.values()):
        print("visible source codes:", vis, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())