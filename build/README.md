# Knowledge layer build scripts

Machine-readable knowledge layer for aisharedresponsibility.com. Everything here
is generated from existing source content; do not hand-edit the generated JSON.

## What gets generated

`generate_knowledge_layer.py` reads the canonical sources and writes:

| Output | Purpose |
|---|---|
| `/glossary.json` | Full glossary registry: every term, definition, canonical ID, anchor URL, per-term API link |
| `/api/glossary/index.json` | Index of all terms |
| `/api/glossary/<anchor>.json` | One self-contained file per term (independently retrievable) |
| `/ontology/nodes.json` | Concept graph nodes (concept, framework, role, control) |
| `/ontology/edges.json` | Typed directed relationships between nodes |
| `/ids.json` | Canonical ID registry + glossary anchor cross-reference |
| `/export/glossary.json` | Flattened definitions pack |
| `/export/ontology.json` | Flattened nodes + edges pack |
| `/export/framework.json` | Combined knowledge pack: `{ concepts, relationships, definitions }` |

Sources of truth: `glossary/index.html` (term definitions and anchors) and the
`/data/*.json` files (layers, personas, matrix, regulations, six control schemas).

## Canonical ID scheme

Stable, namespaced, deduplicated. Each real-world concept has exactly one node;
glossary terms carry a `canonical_id` that resolves to it rather than redefining.

```
srf.framework.cosai-srf       the framework itself
srf.layer.L1 .. L5            architecture layers
srf.opmodel.ai-saas|ai-paas|agent-paas|iaas
srf.role.<persona-id>        personas (incl. sector specializations)
srf.concept.<anchor>         glossary vocabulary
srf.control.<vertical>.<id>  vertical controls
ext.framework.<reg-id>       external standards and regulations
```

## Regenerate

```bash
python3 build/generate_knowledge_layer.py          # write outputs
python3 build/generate_knowledge_layer.py --check  # parse + summarize, no write
python3 build/verify_knowledge_layer.py            # integrity checks (CI-friendly)
```

Run all three after editing the glossary page or any `/data` file, then commit
the regenerated JSON.

## Retrieval validation tool

`/llm/test/` is a static, client-side RAG simulation. It loads
`/export/framework.json`, runs BM25 over the chunks, and returns matched chunks,
concept hits, and a confidence score. `?q=QUERY` runs a query from the URL;
`?q=QUERY&format=json` returns the JSON response only. Useful for spotting
chunking gaps and missing semantic links.

## Internal linking resolver (run manually, review the diff)

`link-resolver.mjs` rewrites the first occurrence of each glossary term on a page
into a link to its canonical glossary anchor. It is **dry-run by default and is
not wired into any build step** — pages stay hand-authored until you choose to
apply it.

```bash
node build/link-resolver.mjs                 # dry run, whole site
node build/link-resolver.mjs framework/index.html   # dry run, one file
node build/link-resolver.mjs --max 5 --apply # write, capped at 5 links/page
```

It is markup-safe: it skips text inside `<head>`, `<script>`, `<style>`, `<svg>`,
`<a>`, `<code>`, `<pre>`, links each term once per page, and never touches the
glossary page. Review `git diff` before committing. Adjust the `DENY` set in the
script to suppress terms you do not want auto-linked (for example the layer-name
phrase "Model Provider" matching the persona term).

## Page-level machine metadata (phase 2)

`inject_page_metadata.py` writes three meta tags into every page `<head>`:

```html
<!-- llm:meta -->
<meta name="llm:type" content="framework|glossary|comparison|controls|tool|..." />
<meta name="llm:canonical-id" content="srf.page.<slug>" />
<meta name="llm:concepts" content="<comma-separated ontology node ids>" />
<!-- /llm:meta -->
```

`llm:concepts` values are real node ids from `/ids.json`, so an agent can pivot
from a page straight into the ontology. Per-page type and concept sets come from
`classify()` in the script; vertical concept lists are computed from that
vertical's controls. The block is wrapped in markers and is idempotent.

```bash
python3 build/inject_page_metadata.py          # apply
python3 build/inject_page_metadata.py --check   # report only
```

`srf.page.<slug>` is a page-identifier namespace; it is intentionally separate
from the concept ids in `ids.json` (a page is not a concept).

## Structured chunk markers (phase 2)

`inject_chunk_markers.py` adds `data-llm="<topic>"` to the page hero
(`data-llm="summary"`) and to each content `<section>`, derived from the
section's own heading. App-shell pages with no static sections get one marker on
`<main>` (or the controls pages' `<div id="main">`) labelled from the title.

```bash
python3 build/inject_chunk_markers.py          # apply
python3 build/inject_chunk_markers.py --check   # report only
python3 build/inject_chunk_markers.py finance/index.html   # one file
```

Markup-safe: `<script>` and `<style>` blocks are stashed before processing, so
JS template strings that contain `<section>`/`<article>` are never touched. Only
opening tags are modified; idempotent (a tag with `data-llm` is skipped).

## Verify the pages

```bash
python3 build/verify_pages.py
```

Checks every page declares `llm:type`, all `llm:concepts` resolve to `ids.json`,
content pages carry at least one chunk marker, every `data-llm` sits on a real
carrier tag, and `section`/`header` tags stay balanced.
