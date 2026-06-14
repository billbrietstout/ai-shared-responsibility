#!/usr/bin/env python3
"""
inject_chunk_markers.py

Add retrieval chunk boundaries to existing markup so an LLM can segment a page
without inferring structure from prose. Each content <section> gets a
data-llm="<topic>" attribute derived from its own heading, and the page hero
gets data-llm="summary". One concept per chunk, independently labelled.

Safety:
  - <script> and <style> blocks are stashed before processing and restored
    after, so JS template strings that contain <section>/<article> are never
    touched.
  - Only the opening tag is modified; content is untouched.
  - Idempotent: a tag that already has data-llm is skipped.

Usage:
    python3 build/inject_chunk_markers.py            # apply
    python3 build/inject_chunk_markers.py --check    # report only
    python3 build/inject_chunk_markers.py finance/index.html   # one file
"""

import html, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def slugify(text, maxlen=48):
    s = html.unescape(re.sub(r"<[^>]+>", "", text)).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if len(s) > maxlen:
        s = s[:maxlen].rsplit("-", 1)[0]
    return s

# A few unambiguous normalizations; everything else uses the heading slug.
def normalize(slug):
    rules = [
        (("what-is", "introduction", "overview", "the-srf-in"), "definition"),
        (("responsibility-matrix", "the-matrix"), "responsibility-model"),
    ]
    for keys, val in rules:
        if any(slug.startswith(k) or slug == k for k in keys):
            return val
    return slug or "section"

STASH_RE = re.compile(r"<(script|style)\b.*?</\1>", re.S | re.I)

def stash(src):
    blocks = []
    def repl(m):
        blocks.append(m.group(0))
        return f"\x00{len(blocks)-1}\x00"
    return STASH_RE.sub(repl, src), blocks

def unstash(text, blocks):
    return re.sub(r"\x00(\d+)\x00", lambda m: blocks[int(m.group(1))], text)

def heading_map(body):
    """id -> heading text, for resolving aria-labelledby."""
    out = {}
    for m in re.finditer(r'id="([^"]+)"[^>]*>\s*([^<][^<]{0,90})', body):
        out.setdefault(m.group(1), m.group(2).strip())
    return out

def label_for(tag, body, start_after):
    aria = re.search(r'aria-labelledby="([^"]+)"', tag)
    if aria:
        hm = heading_map(body)
        if aria.group(1) in hm and hm[aria.group(1)].strip():
            return hm[aria.group(1)]
        return aria.group(1)
    al = re.search(r'aria-label="([^"]+)"', tag)
    if al:
        return al.group(1)
    # first heading shortly after the opening tag
    window = body[start_after:start_after + 900]
    h = re.search(r"<h[1-6][^>]*>\s*([^<]{1,90})", window)
    if h:
        return h.group(1)
    idm = re.search(r'id="([^"]+)"', tag)
    if idm:
        return idm.group(1)
    cls = re.search(r'class="([^"]+)"', tag)
    if cls:
        return cls.group(1).split()[0]
    return ""

def process(src):
    body, blocks = stash(src)
    added = []

    # 1. page hero -> summary (header.page-hero or the controls-page div hero)
    def hero(m):
        if "data-llm=" in m.group(0):
            return m.group(0)
        added.append("summary")
        return m.group(0)[:-1] + ' data-llm="summary">'
    body = re.sub(r'<(?:header|div)\b[^>]*class="[^"]*(?:page-hero|controls-hero)[^"]*"[^>]*>',
                  hero, body, count=1)

    # 2. sections -> slug of their heading
    out = []
    last = 0
    for m in re.finditer(r"<section\b[^>]*>", body):
        out.append(body[last:m.start()])
        tag = m.group(0)
        if "data-llm=" in tag:
            out.append(tag)
        else:
            label = label_for(tag, body, m.end())
            val = normalize(slugify(label)) if label else "section"
            added.append(val)
            out.append(tag[:-1] + f' data-llm="{val}">')
        last = m.end()
    out.append(body[last:])
    body = "".join(out)

    # 3. fallback: app-shell pages with no hero and no static sections still get
    # one chunk boundary on <main>, labelled from the page title. Only when the
    # page carries no marker at all (so re-runs stay idempotent).
    if not added and "data-llm=" not in body:
        tm = re.search(r"<title>\s*([^<|—-]+)", body)
        label = slugify(tm.group(1)) if tm else "main"

        def main_tag(m):
            if "data-llm=" in m.group(0):
                return m.group(0)
            added.append(label or "main")
            return m.group(0)[:-1] + f' data-llm="{label or "main"}">'
        # prefer a real <main>, else the controls pages' <div id="main">
        new_body = re.sub(r"<main\b[^>]*>", main_tag, body, count=1)
        if not added:
            new_body = re.sub(r'<div\b[^>]*\bid="main"[^>]*>', main_tag, body, count=1)
        body = new_body

    return unstash(body, blocks), added

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv

    if args:
        pages = [os.path.join(ROOT, a) for a in args]
    else:
        pages = []
        for d, dirs, files in os.walk(ROOT):
            dirs[:] = [x for x in dirs if x not in (".git", "build", "node_modules")
                       and not x.endswith(" 2")]
            if "index.html" in files:
                pages.append(os.path.join(d, "index.html"))

    changed = total = 0
    for path in sorted(pages):
        src = open(path, encoding="utf-8").read()
        new, added = process(src)
        if new != src:
            changed += 1
            total += len(added)
            rel = os.path.relpath(path, ROOT)
            print(f"{'would mark' if check else 'marked'} {rel}: {len(added)} ({', '.join(added)})")
            if not check:
                open(path, "w", encoding="utf-8").write(new)

    print(f"\n{'Would add' if check else 'Added'} {total} markers across {changed} files.")

if __name__ == "__main__":
    main()
