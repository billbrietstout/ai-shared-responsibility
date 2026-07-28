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
`/data/*.json` files (layers, personas, matrix, regulations, jurisdictions,
six control schemas).

## Canonical ID scheme

Stable, namespaced, deduplicated. Each real-world concept has exactly one node;
glossary terms carry a `canonical_id` that resolves to it rather than redefining.

```
srf.framework.cosai-srf       the framework itself
srf.layer.L1 .. L5            architecture layers
srf.opmodel.ai-saas|ai-paas|agent-paas|iaas
srf.role.<persona-id>        personas (incl. sector specializations)
srf.concept.<anchor>         glossary vocabulary
srf.jurisdiction.<id>        jurisdiction vocabulary from jurisdictions.json
srf.moral.actor|action|outcome  moral-orientation dimensions
srf.vertical.<slug>          industry vertical (finance, healthcare, ...)
srf.control.<vertical>.<id>  vertical controls
ext.framework.<reg-id>       external standards and regulations
ext.requirement.<id>         concrete requirements inside an instrument
```

Control-to-regulation joins use `regulations.json` `mapping_key` values against
each control's `mappings` object, and land in the ontology as `governed_by`
edges. Sector specializations land as `specializes` edges back to a canonical
persona. `generate_oscal_verticals.py` is safe to rerun. UUIDs come from `uuid5`, and
`last-modified` is preserved when the rest of the document is unchanged, so a
rerun on unchanged data leaves the working tree clean and a moved timestamp
means the content really moved.

`sync_llms_full.py` rewrites the `Regulatory mappings` list inside each control
block of `llms-full.txt` from the vertical control schemas. That file is
hand-written prose apart from those lists, so the script touches nothing else.
Run it after editing any `data/<vertical>-controls.json`; `verify_pages.py`
fails when a block no longer matches the data.

Moral tags in `moral-regulatory-hierarchy.json` land as `part_of`,
`emphasizes` (with salience), and `implements` edges. An `implements` edge is
only emitted for a requirement of the instrument the citation is filed under, so
`citation_match` text cannot match another instrument's citation string.
Requirements expected to match nothing are declared in `unmatched_expected`, and
the verifier fails on any undeclared miss or on a stale declaration. Regulation
`applicable_verticals` land as `applies_to_vertical` edges to
`srf.vertical.*`. Prefer `/ontology/edges.json` for multi-hop queries; do not
hand-edit a parallel edges file under `/data/`.

## Regenerate

```bash
python3 build/generate_knowledge_layer.py          # write outputs
python3 build/generate_knowledge_layer.py --check  # parse + summarize, no write
python3 build/verify_knowledge_layer.py            # integrity checks (CI-friendly)
```

Run all three after editing the glossary page or any `/data` file, then commit
the regenerated JSON.

## OSCAL vertical catalog and profiles

`generate_oscal_verticals.py` reads the six `data/*-controls.json` files and
writes `export/srf-oscal-verticals-catalog.json` (OSCAL 1.2.2 catalog, 258
controls grouped by SRF layer with one subgroup per vertical) plus one
`export/srf-{vertical}.profile.json` per vertical. Thresholds become OSCAL
parameters, verified regulatory mappings become links into back-matter, and
TBD or N/A mappings stay verbatim as props (never invented links). Control
IDs are namespaced (`fin-srf-l1-dev-001`) because SRF IDs repeat across
verticals; the original ID is in prop `srf-id`.

```bash
python3 build/generate_oscal_verticals.py   # regenerate catalog + profiles
python3 build/verify_oscal.py               # schema + referential integrity
```

The verifier checks referential integrity offline and validates against the
official OSCAL 1.2.2 JSON schemas when they are reachable (or pass
`--schema-dir` with local copies of the release-asset schemas). Run both
after editing any `data/*-controls.json`, then commit the regenerated JSON.
See `oscal-vertical-mapping-plan.md` at the project root for the design.

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

## Continuous integration

`.github/workflows/verify.yml` runs on every push to `develop`/`main` and on
pull requests:

1. `generate_knowledge_layer.py --check` (structural parse)
2. `verify_knowledge_layer.py` (JSON integrity)
3. `verify_pages.py` (metadata, chunk markers, markup)
4. Drift gate: regenerate the knowledge layer, re-run both injectors, then
   `git diff --exit-code`. Fails if committed artifacts or page markers are out
   of date, so stale generated files cannot land.

The drift gate is why the generators must stay idempotent. If you change the
glossary page, a `/data` file, or add a page, run the three build scripts and
commit the result, or CI will fail. Note that the glossary parser tolerates the
`data-llm` chunk markers that `inject_chunk_markers.py` adds to the glossary
sections; do not reintroduce a parser that assumes a fixed attribute order.
