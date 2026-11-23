#!/usr/bin/env python3
"""Aggregate every cited source into data/sources.json, /sources/, and exports.

Sources of truth:
  - data/regulations.json
  - data/security-principles.json (frameworks table)
  - data/ai-agentic-principles.json (sources table)
  - framework/prior-art/index.html (numbered sources list)

Run: python3 build/generate_sources.py
Check: python3 build/generate_sources.py --check
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
from datetime import UTC, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://aisharedresponsibility.com"

KIND_ORDER = [
    "law-regulation",
    "standard",
    "framework-guidance",
    "paper",
    "talk",
]
KIND_LABELS = {
    "law-regulation": "Law or regulation",
    "standard": "Standard",
    "framework-guidance": "Framework or guidance",
    "paper": "Paper",
    "talk": "Talk",
}

ISO_NUM_RE = re.compile(r"^(ISO/IEC\s+\d+(?::\d+)?)")
YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
PRIOR_LI_RE = re.compile(
    r'<li id="(src-\d+)"><span class="pa-src__id">\[\d+\]</span>(.*?)</li>',
    re.DOTALL,
)
HREF_RE = re.compile(r'href="([^"]+)"')


def iso_reader_title(name: str) -> str:
    """ISO and ISO/IEC standards: number only on reader-facing surfaces."""
    if not name:
        return name
    m = ISO_NUM_RE.match(name.strip())
    if m:
        return m.group(1)
    m = re.match(r"^(ISO\s+\d+(?::\d+)?)", name.strip())
    if m:
        return m.group(1)
    return name


def parse_year(*candidates: str | None) -> str:
    for raw in candidates:
        if not raw:
            continue
        m = YEAR_RE.search(str(raw))
        if m:
            return m.group(0)
    return ""


def reg_kind(item: dict) -> str:
    sk = item.get("source_kind") or ""
    name = item.get("name") or ""
    if sk == "binding":
        return "law-regulation"
    if ISO_NUM_RE.match(name) or name.strip().startswith("ISO/IEC"):
        return "standard"
    return "framework-guidance"


def fw_kind(key: str, fw: dict) -> str:
    name = (fw.get("name") or "").lower()
    pub = (fw.get("publisher") or "").lower()
    if key == "sch" or "proceedings" in pub:
        return "paper"
    if "iso/iec" in name or name.startswith("iso/iec"):
        return "standard"
    return "framework-guidance"


def agentic_kind(code: str, meta: dict) -> str:
    if code.startswith("UNPROMPTED"):
        return "talk"
    url = (meta.get("url") or "").lower()
    title = (meta.get("title") or "").lower()
    if "cheat" in title or "cheatsheet" in url:
        return "framework-guidance"
    if any(tok in url for tok in ("arxiv", "white-paper", "whitepaper", ".pdf")):
        return "paper"
    if any(tok in title for tok in ("framework", "guideline", "guide", "controls", "matrix")):
        return "framework-guidance"
    return "paper"


def prior_kind(body: str) -> str:
    low = re.sub(r"<[^>]+>", " ", body).lower()
    if "iso/iec" in low:
        return "standard"
    if "nist" in low and ("framework" in low or "csf" in low or "rmf" in low):
        return "framework-guidance"
    if "shared responsibility" in low:
        return "framework-guidance"
    if "primer" in low or "blog" in low or "announces" in low:
        return "paper"
    return "framework-guidance"


def strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return " ".join(s.split())


def publisher_from_reg(item: dict) -> str:
    return (item.get("body") or item.get("jurisdiction") or "").strip()


def publisher_from_agentic(meta: dict) -> str:
    return (meta.get("org") or "").strip()


def publisher_from_prior(body: str) -> str:
    plain = strip_tags(body)
    for sep in (",", "—", "–"):
        if sep in plain[:120]:
            head = plain.split(sep, 1)[0].strip()
            if 3 < len(head) < 80:
                return head
    return ""


def prior_title(body: str) -> str:
    plain = strip_tags(body)
    plain = re.sub(r"\(read [^)]+\)", "", plain, flags=re.I)
    plain = re.sub(r"\s+", " ", plain).strip()
    if len(plain) > 220:
        plain = plain[:217] + "..."
    return plain


def load_regulations() -> list[dict]:
    data = json.load(open(os.path.join(ROOT, "data", "regulations.json"), encoding="utf-8"))
    out = []
    for item in data.get("items") or []:
        sid = item["id"]
        title = iso_reader_title(item.get("name") or item.get("short") or sid)
        url = (item.get("url") or "").strip()
        out.append({
            "anchor": f"src-reg-{sid}",
            "kind": reg_kind(item),
            "title": title,
            "publisher": publisher_from_reg(item),
            "year": parse_year(item.get("published"), item.get("version")),
            "url": url,
            "origin": "regulations",
        })
    return out


def load_security_frameworks() -> tuple[list[dict], list[str]]:
    data = json.load(open(os.path.join(ROOT, "data", "security-principles.json"), encoding="utf-8"))
    out = []
    skipped = []
    for key, fw in sorted((data.get("frameworks") or {}).items()):
        title = iso_reader_title(fw.get("name") or key)
        url = (fw.get("reference") or "").strip()
        pub = (fw.get("publisher") or "").strip()
        if not url:
            skipped.append(f"src-fw-{key}: omitted from catalog (no canonical document URL)")
            continue
        out.append({
            "anchor": f"src-fw-{key}",
            "kind": fw_kind(key, fw),
            "title": title,
            "publisher": pub,
            "year": parse_year(pub, fw.get("name")),
            "url": url,
            "origin": "security-principles",
        })
    return out, skipped


def load_agentic_sources() -> list[dict]:
    data = json.load(open(os.path.join(ROOT, "data", "ai-agentic-principles.json"), encoding="utf-8"))
    out = []
    for code, meta in sorted((data.get("sources") or {}).items()):
        title = iso_reader_title(meta.get("title") or code)
        url = (meta.get("url") or "").strip()
        out.append({
            "anchor": f"src-{code}",
            "kind": agentic_kind(code, meta),
            "title": title,
            "publisher": publisher_from_agentic(meta),
            "year": parse_year(meta.get("date")),
            "url": url,
            "origin": "agentic-synthesis",
        })
    return out


def load_prior_art() -> list[dict]:
    path = os.path.join(ROOT, "framework", "prior-art", "index.html")
    text = open(path, encoding="utf-8").read()
    out = []
    for m in PRIOR_LI_RE.finditer(text):
        anchor = m.group(1)
        body = m.group(2)
        urls = HREF_RE.findall(body)
        url = urls[0] if urls else ""
        title = prior_title(body)
        out.append({
            "anchor": anchor,
            "kind": prior_kind(body),
            "title": title,
            "publisher": publisher_from_prior(body),
            "year": parse_year(body),
            "url": url.strip(),
            "origin": "prior-art",
        })
    return out


def collect_entries() -> tuple[list[dict], list[str]]:
    fw_entries, fw_skipped = load_security_frameworks()
    entries = (
        load_regulations()
        + fw_entries
        + load_agentic_sources()
        + load_prior_art()
    )
    missing = []
    for e in entries:
        gaps = []
        if not e.get("publisher"):
            gaps.append("publisher")
        if not e.get("year"):
            gaps.append("year")
        if not e.get("url"):
            gaps.append("url")
        if gaps:
            missing.append(f"{e['anchor']}: missing {', '.join(gaps)}")
    missing = fw_skipped + missing
    return entries, missing


def csl_type(kind: str) -> str:
    if kind == "law-regulation":
        return "legislation"
    return "document"


def to_csl(entries: list[dict]) -> list[dict]:
    out = []
    for e in entries:
        item = {
            "id": e["anchor"],
            "type": csl_type(e["kind"]),
            "title": e["title"],
        }
        if e.get("url"):
            item["URL"] = e["url"]
        if e.get("publisher"):
            item["publisher"] = e["publisher"]
        if e.get("year"):
            item["issued"] = {"date-parts": [[int(e["year"])]]}
        out.append(item)
    return out


def bib_key(anchor: str) -> str:
    k = re.sub(r"[^a-zA-Z0-9]", "", anchor)
    if k and k[0].isdigit():
        k = "s" + k
    return k or "source"


def bib_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")


def to_bibtex(entries: list[dict]) -> str:
    lines = []
    for e in entries:
        key = bib_key(e["anchor"])
        fields = [f"  title = {{{bib_escape(e['title'])}}}"]
        if e.get("publisher"):
            fields.append(f"  organization = {{{bib_escape(e['publisher'])}}}")
        if e.get("year"):
            fields.append(f"  year = {{{e['year']}}}")
        if e.get("url"):
            fields.append(f"  url = {{{e['url']}}}")
        entry_type = "misc"
        if e["kind"] == "law-regulation":
            entry_type = "misc"
        lines.append(f"@{entry_type}{{{key},\n" + ",\n".join(fields) + "\n}")
    return "\n".join(lines) + "\n"


def render_html(entries: list[dict]) -> str:
    by_kind: dict[str, list[dict]] = {k: [] for k in KIND_ORDER}
    for e in entries:
        by_kind.setdefault(e["kind"], []).append(e)
    for kind in KIND_ORDER:
        by_kind[kind].sort(key=lambda x: x["title"].lower())

    sections = []
    for kind in KIND_ORDER:
        group = by_kind.get(kind) or []
        if not group:
            continue
        items = []
        for e in group:
            meta_bits = []
            if e.get("publisher"):
                meta_bits.append(html.escape(e["publisher"]))
            if e.get("year"):
                meta_bits.append(html.escape(e["year"]))
            meta = " · ".join(meta_bits)
            title = html.escape(e["title"])
            if e.get("url"):
                doc = (
                    f'<a href="{html.escape(e["url"])}" target="_blank" rel="noopener">'
                    f"{title}</a>"
                )
            else:
                doc = f"<span>{title}</span>"
            anchor_esc = html.escape(e["anchor"])
            items.append(
                f'          <li id="{anchor_esc}" class="src-item">'
                f'<div class="src-item__head">'
                f'<div class="src-item__title">{doc}</div>'
                f'<a class="src-item__perma" href="#{anchor_esc}" '
                f'aria-label="Permanent link to this source">#</a>'
                f"</div>"
                + (f'<div class="src-item__meta">{meta}</div>' if meta else "")
                + "</li>"
            )
        sections.append(
            f'      <section class="src-group" aria-labelledby="kind-{kind}" data-llm="{kind}">\n'
            f'        <h2 id="kind-{kind}" class="src-group__heading">{KIND_LABELS[kind]}</h2>\n'
            f'        <ol class="src-list">\n'
            + "\n".join(items)
            + "\n        </ol>\n      </section>"
        )

    counts = {k: len(by_kind.get(k) or []) for k in KIND_ORDER}
    total = sum(counts.values())
    ld_items = []
    for e in entries:
        schema_type = "Legislation" if e["kind"] == "law-regulation" else "CreativeWork"
        node = {
            "@type": schema_type,
            "name": e["title"],
            "url": e["url"] or f"{SITE}/sources/#{e['anchor']}",
        }
        if e.get("publisher"):
            node["publisher"] = {"@type": "Organization", "name": e["publisher"]}
        if e.get("year"):
            node["datePublished"] = e["year"]
        ld_items.append(node)

    json_ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Cited sources for AI Shared Responsibility",
        "url": f"{SITE}/sources/",
        "numberOfItems": total,
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": node}
            for i, node in enumerate(ld_items)
        ],
    }

    export_blurb = (
        f'<p class="src-exports">Machine-readable exports: '
        f'<a href="/export/sources.csl.json">CSL-JSON</a> · '
        f'<a href="/export/sources.bib">BibTeX</a> · '
        f'<a href="/data/sources.json">sources.json</a></p>'
    )

    body_sections = "\n".join(sections)
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sources | AI Shared Responsibility</title>
    <meta
      name="description"
      content="Canonical list of every regulation, standard, framework, paper, and talk cited on this site, with stable anchor ids and links to the official documents."
    />
    <meta name="color-scheme" content="light dark" />
    <link rel="canonical" href="{SITE}/sources/" />
    <link rel="stylesheet" href="/shared/styles.css" />
    <style>
      .src-layout {{
        max-width: 900px;
        margin: 0 auto;
        padding: var(--sp-8) var(--sp-6) var(--sp-12);
        min-width: 0;
        overflow-x: clip;
      }}
      .src-intro {{
        font-size: var(--text-sm);
        color: var(--slate-600);
        line-height: var(--leading-normal);
        margin-bottom: var(--sp-6);
      }}
      .src-exports {{
        font-size: var(--text-sm);
        margin-bottom: var(--sp-10);
      }}
      .src-exports a {{ color: var(--cosai-blue); font-weight: 600; }}
      .src-group {{ margin-bottom: var(--sp-10); scroll-margin-top: var(--sp-6); }}
      .src-group__heading {{
        font-size: var(--text-lg);
        font-weight: 700;
        color: var(--slate-800);
        border-bottom: 2px solid var(--slate-200);
        padding-bottom: var(--sp-2);
        margin-bottom: var(--sp-4);
      }}
      .src-list {{
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }}
      .src-item {{
        border: 1px solid var(--slate-200);
        border-radius: var(--radius-md);
        padding: var(--sp-4) var(--sp-5);
        background: var(--surface);
        min-width: 0;
        overflow-wrap: anywhere;
      }}
      .src-item__head {{
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-3);
        min-width: 0;
      }}
      .src-item__perma {{
        flex-shrink: 0;
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--slate-400);
        text-decoration: none;
        padding: 0 var(--sp-1);
      }}
      .src-item__perma:hover {{
        color: var(--cosai-blue);
      }}
      .src-item__title {{
        font-size: var(--text-base);
        font-weight: 600;
        color: var(--slate-900);
        flex: 1 1 auto;
        min-width: 0;
        overflow-wrap: anywhere;
      }}
      .src-item__title a {{
        color: var(--cosai-blue);
        text-decoration: none;
        overflow-wrap: anywhere;
        word-break: break-word;
      }}
      .src-item__title a:hover {{ text-decoration: underline; }}
      .src-item__meta {{
        font-size: var(--text-xs);
        color: var(--slate-500);
        margin-top: var(--sp-1);
      }}
    </style>
    <script type="application/ld+json">
{json.dumps(json_ld, indent=2)}
    </script>
    <!-- llm:meta -->
    <meta name="llm:type" content="reference" />
    <meta name="llm:canonical-id" content="srf.page.sources" />
    <meta name="llm:concepts" content="srf.framework.cosai-srf,ext.framework.nist-ai-rmf,ext.framework.eu-ai-act" />
    <!-- /llm:meta -->
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <script type="module" src="/shared/components.js"></script>
    <site-nav current="sources"></site-nav>

    <header class="page-hero" data-llm="summary">
      <div class="page-hero__inner">
        <span class="page-hero__eyebrow">Reference</span>
        <h1 class="page-hero__title">Sources</h1>
        <p class="page-hero__lede">
          Every regulation, standard, framework, paper, and talk this site cites,
          with a link to the original. Each entry has its own link you can share
          or cite. {total} entries.
        </p>
      </div>
    </header>

    <main id="main" class="page-body" data-llm="sources-catalog">
      <div class="src-layout">
        <p class="src-intro">To link to an entry, copy its # link.</p>
        {export_blurb}
{body_sections}
      </div>
    </main>

    <site-footer></site-footer>
  </body>
</html>
"""


def write_json(path: str, payload) -> None:
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def main() -> int:
    check = "--check" in sys.argv
    entries, missing = collect_entries()
    anchors = [e["anchor"] for e in entries]
    if len(anchors) != len(set(anchors)):
        dups = sorted({a for a in anchors if anchors.count(a) > 1})
        print("ERROR: duplicate anchor ids:", dups[:10], file=sys.stderr)
        return 1

    counts = {k: 0 for k in KIND_ORDER}
    for e in entries:
        counts[e["kind"]] = counts.get(e["kind"], 0) + 1

    payload = {
        "updated": datetime.now(UTC).strftime("%Y-%m-%d"),
        "count": len(entries),
        "counts_by_kind": counts,
        "kind_labels": KIND_LABELS,
        "entries": entries,
    }

    if check:
        print("CHECK OK:", json.dumps({"count": len(entries), "counts_by_kind": counts}))
        if missing:
            print("Missing metadata (", len(missing), "):", *missing[:8], sep="\n  ")
        return 0

    write_json("data/sources.json", payload)
    os.makedirs(os.path.join(ROOT, "sources"), exist_ok=True)
    html_path = os.path.join(ROOT, "sources", "index.html")
    with open(html_path, "w", encoding="utf-8") as fh:
        fh.write(render_html(entries))
    write_json("export/sources.csl.json", to_csl(entries))
    bib_path = os.path.join(ROOT, "export", "sources.bib")
    with open(bib_path, "w", encoding="utf-8") as fh:
        fh.write(to_bibtex(entries))

    print(f"Wrote {len(entries)} sources ({counts})")
    if missing:
        print(f"Missing metadata on {len(missing)} entries (see PR body).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())