#!/usr/bin/env python3
"""Shared offline retrieval helpers for NIST AI RMF RAG build scripts."""
from __future__ import annotations

import math
import re
from collections import Counter

STOP = set(
    "a an and are as at be by for from has in is it its of on or that the to with who whose how what which".split()
)
TOKEN = re.compile(r"[a-z0-9][a-z0-9\-]*", re.I)


def tokenize(s: str) -> list[str]:
    return [t for t in TOKEN.findall((s or "").lower()) if t not in STOP and len(t) > 1]


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
        weight = (1.0 + math.log(f)) * idf[term]
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

    def idf(t):
        return math.log(1 + (N - df.get(t, 0) + 0.5) / (df.get(t, 0) + 0.5))

    scored = []
    for i, ch in enumerate(chunks):
        toks = bm25["tokens"][i] if bm25.get("tokens") else tokenize(f"{ch['title']}. {ch['text']}")
        tf = Counter(toks)
        length = bm25["doc_lens"][i] if bm25.get("doc_lens") else len(toks)
        s = 0.0
        for t in q:
            f = tf.get(t, 0)
            denom = f + k1 * (1 - b + b * length / avgdl)
            s += idf(t) * (f * (k1 + 1)) / (denom or 1)
        if s > 0:
            scored.append((i, s))
    scored.sort(key=lambda x: -x[1])
    return scored[:k]


def dense_search(qvec, vectors, k=30):
    scored = [(i, cosine(qvec, v)) for i, v in enumerate(vectors)]
    scored.sort(key=lambda x: -x[1])
    return scored[:k]


def search_ranked(chunks, bm25, emb, query, top_k=8):
    """Return list of (chunk_index, bm25_score, dense_score, fused_score)."""
    q = tokenize(query)
    if not q:
        return []
    bm = bm25_search(q, chunks, bm25, k=40)
    qv = project_query(q, emb.get("projection") or {"dims": emb["dims"], "idf": {}})
    dens_all = dense_search(qv, emb["vectors"], k=40)
    cand = {i for i, _ in bm}
    for i, _ in dens_all[:10]:
        cand.add(i)
    dens = [(i, s) for i, s in dens_all if i in cand]
    bm_map = dict(bm)
    dens_map = dict(dens)

    bm_w = 2 if emb.get("method") == "hash-tfidf" else 1
    scores = {}
    for rank, (i, s) in enumerate(bm):
        scores[i] = scores.get(i, 0.0) + bm_w * (1.0 / (60 + rank + 1))
    for rank, (i, s) in enumerate(dens):
        scores[i] = scores.get(i, 0.0) + 1.0 / (60 + rank + 1)

    fused = sorted(scores.items(), key=lambda x: -x[1])
    qset = set(q)
    boosted = []
    for i, score in fused:
        ch = chunks[i]
        title_toks = set(tokenize(ch.get("title", "")))
        cover = len(qset & title_toks) / max(1, len(qset))
        depth_bonus = 0.02 if ch.get("level", 1) >= 3 else 0.0
        if ch.get("anchor", "").startswith("risk-"):
            depth_bonus += 0.03
        if re.match(r"^(gov|map|measure|manage)-\d", ch.get("anchor", "")):
            depth_bonus += 0.02
        fused_s = score + 0.12 * cover + depth_bonus
        boosted.append((i, bm_map.get(i, 0.0), dens_map.get(i, 0.0), fused_s))
    boosted.sort(key=lambda x: -x[3])
    return boosted[:top_k]


def pack_result(chunks, bm25, emb, query, top_k=8) -> dict:
    """Match the browser retrieve.js response shape."""
    q = tokenize(query)
    ranked = search_ranked(chunks, bm25, emb, query, top_k=top_k)
    matched = []
    for i, bm_s, dens_s, fused_s in ranked:
        ch = chunks[i]
        parent = None
        if ch.get("parent_id"):
            parent = next((c for c in chunks if c["chunk_id"] == ch["parent_id"]), None)
        matched.append(
            {
                "chunk_id": ch["chunk_id"],
                "doc_id": ch["doc_id"],
                "nist_id": ch.get("nist_id"),
                "version": ch.get("version"),
                "title": ch.get("title"),
                "section_path": ch.get("section_path"),
                "anchor": ch.get("anchor"),
                "source_url": f"../{ch.get('source_md')}#{ch.get('anchor')}",
                "applicability": ch.get("applicability"),
                "related_controls": ch.get("related_controls") or [],
                "topics": ch.get("topics") or [],
                "scores": {
                    "bm25": round(bm_s, 3),
                    "dense": round(dens_s, 3),
                    "fused": round(fused_s, 3),
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
        "matched_chunks": matched,
        "confidence": conf,
        "embedding_method": emb.get("method"),
        "conflict_note": conflict_note,
        "transport": "static-precomputed",
    }
