# NIST AI RMF Static RAG Demo

Target: **https://aisharedresponsibility.com/nist-ai-rmf/**

Public demo of dual-readable NIST AI risk sources plus static hybrid retrieval
(BM25 + dense vectors, reciprocal rank fusion, citations). Built for GitHub Pages:
no server, no API keys.

**Not official NIST output.** Derived from public NIST publications for demonstration.
Cite the official NIST PDFs/DOIs for normative use.

## Isolation

- Separate corpus and IDs from the CoSAI SRF knowledge graph.
- Separate from the TACIP orphan at `/nist/` (that directory stays unlinked).
- COSAiS (NISTIR 8605*) body text is out of v1; still pre-draft. See future work below.

## Contents

| Path | Role |
|------|------|
| `index.html` | Landing page + RAG demo UI |
| `llms.txt` | Agent discovery for this corpus |
| `llms-full.txt` | Concatenated clean Markdown sources |
| `sources/` | Dual-readable Markdown + attribution |
| `data/` | Manifest, chunks, BM25, embeddings, graph edges, golden set |
| `rag/` | Client retrieval modules |

## Rebuild indexes

From the repo root (Python 3.12+):

```bash
python3 build/nist_ai_rmf/chunk_sources.py
python3 build/nist_ai_rmf/build_index.py
python3 build/nist_ai_rmf/validate_golden.py
```

`build_index.py` prefers `sentence-transformers` (`all-MiniLM-L6-v2`) when installed,
then scikit-learn TF-IDF+SVD, then a stdlib **hash-TF-IDF** dense layer so indexes
always build without extra packages. The committed `data/` artifacts use the method
recorded in `corpus-manifest.json`.

## Future corpus

When NISTIR 8605 / COSAiS overlays publish citable drafts, add them under `sources/`
with pinned versions. Do not invent overlay control IDs before then.
