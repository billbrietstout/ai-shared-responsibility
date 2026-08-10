# NIST AI RMF Static RAG Demo

Target: **https://aisharedresponsibility.com/nist-ai-rmf/**

Public demo of dual-readable NIST AI risk sources plus static hybrid retrieval
(BM25 + dense vectors, reciprocal rank fusion, citations). Built for GitHub Pages:
no server, no API keys.

**Not official NIST output.** Derived from public NIST publications for demonstration.
Cite the official NIST PDFs/DOIs for normative use.

## What this demonstrates

Working package for NIST collaboration discussions: publish AI RMF / GenAI Profile text for humans and HTTP-only agents, with section citations, without a ranking API.

- Dual-readable Markdown sources with stable anchors (`sources/`).
- Static hybrid retrieval (BM25 + dense, RRF) from committed `data/` artifacts in the browser.
- Citation-first workflow: `doc_id` / `section_path` → verify in Markdown or official PDF.
- Agent path via `llms.txt`, `retrieve/*.json`, or local ranking over `data/chunks.json`.
- Corpus kept separate from the CoSAI SRF graph; SP 800-53 links are curated IDs only.

Does not demonstrate official NIST packaging, a full NIST corpus, production retrieval for every query, or safe OT/ops use of assistant output. Details: [HOWTO.md](HOWTO.md#what-this-demonstrates) and the page section `#what-this-demonstrates`.

## Isolation

- Separate corpus and IDs from the CoSAI SRF knowledge graph.
- Separate from the TACIP orphan at `/nist/` (that directory stays unlinked).
- COSAiS (NISTIR 8605*) body text is out of v1; still pre-draft. See future work below.

## Contents

| Path | Role |
|------|------|
| `index.html` | Landing page + browser RAG UI |
| `llms.txt` | Agent discovery: sources, `/retrieve/*.json`, `data/chunks.json` |
| `HOWTO.md` | Architecture, llms.txt vs RAG, example LLM prompts, assistant/OT risk boundary |
| `llms-full.txt` | Concatenated clean Markdown sources |
| `sources/` | Dual-readable Markdown + attribution |
| `data/` | Manifest, chunks, BM25, embeddings, graph edges, golden set |
| `retrieve/` | Precomputed scenario JSON (plain HTTP, pure JSON) |
| `rag/` | Client retrieval modules (browser only) |

## Agent retrieval (plain HTTP)

1. **Authoritative:** `sources/*.md` or official NIST PDF.
2. **Ranked scenarios:** `GET /nist-ai-rmf/retrieve/<slug>.json` (see `retrieve/index.json`).
3. **Arbitrary queries:** fetch `data/chunks.json` (+ optional `bm25.json` / `embeddings.json`) and rank locally.

`?format=json` is browser-JS debug only. A plain HTTP GET of `/?q=...&format=json` returns HTML.

## Rebuild indexes

From the repo root (Python 3.12+):

```bash
python3 build/nist_ai_rmf/chunk_sources.py
python3 build/nist_ai_rmf/build_index.py
python3 build/nist_ai_rmf/export_scenarios.py
python3 build/nist_ai_rmf/validate_golden.py
```

`build_index.py` prefers `sentence-transformers` (`all-MiniLM-L6-v2`) when installed,
then scikit-learn TF-IDF+SVD, then a stdlib **hash-TF-IDF** dense layer so indexes
always build without extra packages. The committed `data/` artifacts use the method
recorded in `corpus-manifest.json`. `export_scenarios.py` writes agent-facing
`/retrieve/*.json` files.

## Future corpus

When NISTIR 8605 / COSAiS overlays publish citable drafts, add them under `sources/`
with pinned versions. Do not invent overlay control IDs before then.
