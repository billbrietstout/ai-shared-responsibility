#!/usr/bin/env python3
"""Validate golden scenario questions against the static hybrid index (hit@k)."""
from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "nist-ai-rmf" / "data"

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


def rrf(lists, k=60):
    scores = {}
    for lst in lists:
        for rank, (i, _) in enumerate(lst):
            scores[i] = scores.get(i, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])


def search(chunks, bm25, emb, query, top_k=8):
    q = tokenize(query)
    bm = bm25_search(q, chunks, bm25, k=40)
    qv = project_query(q, emb.get("projection") or {"dims": emb["dims"], "idf": {}})
    dens_all = dense_search(qv, emb["vectors"], k=40)
    cand = {i for i, _ in bm}
    for i, _ in dens_all[:10]:
        cand.add(i)
    dens = [(i, s) for i, s in dens_all if i in cand]

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
        boosted.append((i, score + 0.12 * cover + depth_bonus))
    boosted.sort(key=lambda x: -x[1])
    return [chunks[i] for i, _ in boosted[:top_k]]


def hit_matches(hits, expect: set[str]) -> bool:
    anchors = {h["anchor"] for h in hits}
    if expect & anchors:
        return True
    for h in hits:
        path = (h.get("section_path") or "")
        title = h.get("title") or ""
        cid = h.get("chunk_id") or ""
        for exp in expect:
            e = exp.lower()
            if e in cid.lower() or e in (h.get("anchor") or "").lower():
                return True
            # GOVERN 3.2 / MAP 3.5 style from gov-3-2
            m = re.match(r"^(gov|map|measure|manage)-(\d+)(?:-(\d+))?$", e)
            if m:
                fn = {"gov": "GOVERN", "map": "MAP", "measure": "MEASURE", "manage": "MANAGE"}[
                    m.group(1)
                ]
                num = m.group(2) + (("." + m.group(3)) if m.group(3) else "")
                label = f"{fn} {num}"
                if label in path or label in title:
                    return True
            if e.startswith("risk-") and e in (h.get("anchor") or ""):
                return True
            if e.startswith(("gv-", "mp-", "ms-", "mg-")):
                dashed = e
                dotted = e.replace("-", ".", 2) if e.count("-") >= 2 else e
                # gv-3-2-001 vs GV-3.2-001
                parts = e.split("-")
                if len(parts) >= 4:
                    dotted_id = f"{parts[0]}-{parts[1]}.{parts[2]}-{parts[3]}"
                    if dotted_id.lower() in cid.lower() or dashed in cid.lower():
                        return True
                if dashed in cid.lower():
                    return True
    return False


def main() -> int:
    chunks = json.loads((DATA / "chunks.json").read_text())
    bm25 = json.loads((DATA / "bm25.json").read_text())
    emb = json.loads((DATA / "embeddings.json").read_text())
    golden = json.loads((DATA / "golden-questions.json").read_text())

    k = 8
    passed = 0
    failed = []
    for g in golden:
        hits = search(chunks, bm25, emb, g["q"], top_k=k)
        expect = set(g.get("expect_any_anchors") or [])
        ok = hit_matches(hits, expect)

        if ok and g.get("expect_doc") and g.get("prefer_profile"):
            docs = {h["doc_id"] for h in hits}
            if g["expect_doc"] not in docs:
                ok = False

        if ok:
            passed += 1
            print(f"PASS {g['id']}: {[h['anchor'] for h in hits[:3]]}")
        else:
            failed.append(g["id"])
            print(
                f"FAIL {g['id']}: expected any of {sorted(expect)}; got {[h['anchor'] for h in hits[:5]]}"
            )

    total = len(golden)
    print(f"\n{passed}/{total} passed (hit@{k})")
    if failed:
        print("failed:", ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
