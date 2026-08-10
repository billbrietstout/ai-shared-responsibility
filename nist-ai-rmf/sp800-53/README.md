# SP 800-53 Rev 5 (opt-in sibling corpus)

Separate from the default AI RMF index under `../data/`. Browser and agents load this
corpus only when Document = `sp800-53-rev5` (or when fetching these URLs directly).

- `sources/`: dual-readable Markdown per control family (statement + guidance)
- `data/`: chunks, BM25, embeddings, empty graph-edges, corpus-manifest

Normative source: https://doi.org/10.6028/NIST.SP.800-53r5  
Rebuild: `python3 build/nist_ai_rmf/ingest_sp80053.py` then
`python3 build/nist_ai_rmf/build_index.py --data-dir nist-ai-rmf/sp800-53/data`
