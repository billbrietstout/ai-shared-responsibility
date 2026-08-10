#!/usr/bin/env python3
"""Shared offline retrieval helpers for NIST AI RMF RAG build scripts."""
from __future__ import annotations

import math
import re
from collections import Counter

STOP = set(
    "a an and are as at be by for from has in is it its of on or that the to with who whose how what which".split()
)
QUERY_WEAK = set(
    (
        "cover covers covering address addresses addressing include includes including "
        "using based related relate regarding about provide provides ensure ensures "
        "support supports should does did can could would may might must "
        "before after during within without required requiring create creates creating "
        "make makes making get gets getting take takes taking "
        "users user mislead misleading"
    ).split()
)
QUERY_COMMON = set(
    "ai system systems risk risks management framework model models data organization organizations organizational".split()
)
TOKEN = re.compile(r"[a-z0-9][a-z0-9\-]*", re.I)


def tokenize(s: str) -> list[str]:
    return [t for t in TOKEN.findall((s or "").lower()) if t not in STOP and len(t) > 1]


def query_terms(s: str) -> list[str]:
    return [t for t in tokenize(s) if t not in QUERY_WEAK]


def strong_terms(tokens: list[str]) -> list[str]:
    return [t for t in tokens if t not in QUERY_COMMON]


def term_weight(t: str) -> float:
    return 0.35 if t in QUERY_COMMON else 1.0


def min_hits_required(tokens: list[str], df: dict | None = None, n_docs: int | None = None) -> int:
    strong = strong_terms(tokens)
    basis = strong if strong else tokens
    n = len(basis)
    if n <= 1:
        return 1
    # Rare discriminative terms (e.g. TEVV, confabulation): one hit is enough.
    if df is not None:
        rare_cap = max(12, int(0.05 * (n_docs or 300)))
        if any(df.get(t, 0) <= rare_cap for t in strong):
            return 1
    if n == 2:
        return 2
    return max(2, min(n, math.ceil(n * 0.4)))


def count_hits(query_tokens: list[str], doc_tok_set: set[str], strong_only: bool = False) -> int:
    terms = strong_terms(query_tokens) if strong_only and strong_terms(query_tokens) else query_tokens
    return sum(1 for t in terms if t in doc_tok_set)

def fnv1a(term: str) -> int:
    h = 2166136261
    for ch in term.encode("utf-8"):
        h ^= ch
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def project_query(tokens: list[str], projection: dict) -> list[float]:
    dims = projection.get("dims", 256)
    idf = projection.get("idf", {})
    tf = Counter(tokens)
    row = [0.0] * dims
    for term, f in tf.items():
        if term not in idf:
            continue
        weight = term_weight(term) * (1.0 + math.log(f)) * idf[term]
        h = fnv1a(term)
        bucket = h % dims
        sign = 1.0 if (h & 1) == 0 else -1.0
        row[bucket] += sign * weight
    n = math.sqrt(sum(v * v for v in row)) or 1.0
    return [v / n for v in row]


def cosine(a, b) -> float:
    return sum(x * y for x, y in zip(a, b))


def bm25_search(q, chunks, bm25, k=30):
    N = bm25["n_docs"]
    k1, b, avgdl = bm25["k1"], bm25["b"], bm25["avgdl"]
    df = bm25["df"]
    need = min_hits_required(q, df=df, n_docs=N)

    def idf(t):
        return math.log(1 + (N - df.get(t, 0) + 0.5) / (df.get(t, 0) + 0.5))

    scored = []
    for i, ch in enumerate(chunks):
        toks = bm25["tokens"][i] if bm25.get("tokens") else tokenize(f"{ch['title']}. {ch['text']}")
        tf = Counter(toks)
        tok_set = set(toks)
        length = bm25["doc_lens"][i] if bm25.get("doc_lens") else len(toks)
        s = 0.0
        for t in q:
            f = tf.get(t, 0)
            denom = f + k1 * (1 - b + b * length / avgdl)
            s += term_weight(t) * idf(t) * (f * (k1 + 1)) / (denom or 1)
        strong_hit = count_hits(q, tok_set, strong_only=True)
        all_hit = count_hits(q, tok_set, strong_only=False)
        # Mild coordination on strong terms (or all terms if query is only common words).
        basis = len(strong_terms(q)) or len(q) or 1
        coord = strong_hit / basis
        s *= 0.35 + 0.65 * coord
        if s > 0 and strong_hit >= need:
            scored.append((i, s, strong_hit, all_hit))
    scored.sort(key=lambda x: (-x[1], -x[2], -x[3]))
    return scored[:k]


def dense_search(qvec, vectors, k=30):
    scored = [(i, cosine(qvec, v)) for i, v in enumerate(vectors)]
    scored.sort(key=lambda x: -x[1])
    return scored[:k]


def search_ranked(chunks, bm25, emb, query, top_k=8):
    """Return list of (chunk_index, bm25_score, dense_score, fused_score)."""
    q = query_terms(query)
    if not q:
        return []
    bm = bm25_search(q, chunks, bm25, k=60)
    qv = project_query(q, emb.get("projection") or {"dims": emb["dims"], "idf": {}})
    dens_all = dense_search(qv, emb["vectors"], k=40)
    cand = {i for i, *_ in bm}
    for i, _ in dens_all[:10]:
        cand.add(i)
    dens = [(i, s) for i, s in dens_all if i in cand]
    bm_map = {i: s for i, s, *_ in bm}
    dens_map = dict(dens)

    bm_w = 2.5 if emb.get("method") == "hash-tfidf" else 1
    dens_w = 0.5 if emb.get("method") == "hash-tfidf" else 1
    scores = {}
    for rank, (i, s, _h, _a) in enumerate(bm):
        scores[i] = scores.get(i, 0.0) + bm_w * (1.0 / (60 + rank + 1))
    for rank, (i, s) in enumerate(dens):
        scores[i] = scores.get(i, 0.0) + dens_w * (1.0 / (60 + rank + 1))

    fused = sorted(scores.items(), key=lambda x: -x[1])
    qset = set(q)
    need = min_hits_required(q, df=bm25.get("df"), n_docs=bm25.get("n_docs"))
    boosted = []
    for i, score in fused:
        ch = chunks[i]
        doc_toks = set(tokenize(f"{ch.get('title', '')}. {ch.get('text', '')}"))
        strong_hit = count_hits(q, doc_toks, strong_only=True)
        all_hit = count_hits(q, doc_toks, strong_only=False)
        title_toks = set(tokenize(ch.get("title", "")))
        title_strong = len(set(strong_terms(q)) & title_toks)
        cover = len(qset & title_toks) / max(1, len(qset))
        basis = len(strong_terms(q)) or len(q) or 1
        term_cover = strong_hit / basis
        depth_bonus = 0.02 if ch.get("level", 1) >= 3 else 0.0
        if ch.get("anchor", "").startswith("risk-"):
            depth_bonus += 0.05
        if re.match(r"^(gov|map|measure|manage)-\d", ch.get("anchor", "")):
            depth_bonus += 0.03
        if title_strong >= 2:
            depth_bonus += 0.1
        anchor = (ch.get("anchor") or "").lower()
        if anchor and anchor in qset:
            depth_bonus += 0.12 if "." in anchor else 0.22
        # Demote document-root / very generic title pages.
        title = (ch.get("title") or "").lower()
        if ch.get("level", 1) <= 1 or title.startswith("artificial intelligence risk management framework"):
            depth_bonus -= 0.08
        if strong_hit < need and not (anchor and anchor in qset):
            continue
        coord = 0.4 + 0.6 * term_cover
        fused_s = (score + 0.2 * cover + 0.25 * term_cover + depth_bonus) * coord
        boosted.append((i, bm_map.get(i, 0.0), dens_map.get(i, 0.0), fused_s, strong_hit, all_hit))
    boosted.sort(key=lambda x: (-x[3], -x[4], -x[5]))
    return [(i, bm_s, dens_s, fused_s) for i, bm_s, dens_s, fused_s, _h, _a in boosted[:top_k]]


def pack_result(chunks, bm25, emb, query, top_k=8) -> dict:
    """Match the browser retrieve.js response shape."""
    q = query_terms(query)
    ranked = search_ranked(chunks, bm25, emb, query, top_k=top_k)
    matched = []
    for i, bm_s, dens_s, fused_s in ranked:
        ch = chunks[i]
        parent = None
        if ch.get("parent_id"):
            parent = next((c for c in chunks if c["chunk_id"] == ch["parent_id"]), None)
        doc_toks = set(tokenize(f"{ch.get('title', '')}. {ch.get('text', '')}"))
        strong_hit = count_hits(q, doc_toks, strong_only=True)
        basis = len(strong_terms(q)) or len(q) or 1
        matched.append(
            {
                "chunk_id": ch["chunk_id"],
                "doc_id": ch["doc_id"],
                "nist_id": ch.get("nist_id"),
                "version": ch.get("version"),
                "title": ch.get("title"),
                "section_path": ch.get("section_path"),
                "anchor": ch.get("anchor"),
                "source_url": f"./{ch.get('source_md')}#{ch.get('anchor')}",
                "applicability": ch.get("applicability"),
                "related_controls": ch.get("related_controls") or [],
                "topics": ch.get("topics") or [],
                "scores": {
                    "bm25": round(bm_s, 3),
                    "dense": round(dens_s, 3),
                    "fused": round(fused_s, 3),
                    "term_hits": strong_hit,
                    "term_cover": round(strong_hit / basis, 2),
                },
                "snippet": re.sub(r"\s+", " ", (ch.get("text") or ch.get("title") or ""))[:320],
                "parent": (
                    {
                        "chunk_id": parent["chunk_id"],
                        "title": parent.get("title"),
                        "section_path": parent.get("section_path"),
                    }
                    if parent
                    else None
                ),
            }
        )

    top = matched[0] if matched else None
    cover = 0.0
    if top and q:
        hit = set(tokenize(f"{top['title']} {top['snippet']}"))
        cover = len(hit & set(q)) / len(q)
    conf = 0.0
    if matched:
        conf = round(0.55 * min(1.0, cover) + 0.45 * min(1.0, top["scores"]["fused"] * 8), 2)

    docs = {m["doc_id"] for m in matched}
    conflict_note = None
    if "nist-ai-100-1" in docs and "nist-ai-600-1" in docs:
        conflict_note = (
            "Results include both the base AI RMF (NIST.AI.100-1) and the Generative AI Profile "
            "(NIST.AI.600-1). The Profile supplements and does not replace the base Framework; "
            "verify applicability for your scenario."
        )

    return {
        "query": query,
        "query_terms": q,
        "matched_chunks": matched,
        "confidence": conf,
        "embedding_method": emb.get("method"),
        "conflict_note": conflict_note,
    }
