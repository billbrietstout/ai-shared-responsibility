#!/usr/bin/env python3
"""Build BM25 stats + dense embeddings for the NIST AI RMF RAG demo."""
from __future__ import annotations

import json
import math
import re
import struct
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "nist-ai-rmf" / "data"
MANIFEST = DATA / "corpus-manifest.json"

STOP = set(
    "a an and are as at be by for from has in is it its of on or that the to with who whose how what which".split()
)
TOKEN = re.compile(r"[a-z0-9][a-z0-9\-]*", re.I)


def tokenize(s: str) -> list[str]:
    return [t for t in TOKEN.findall((s or "").lower()) if t not in STOP and len(t) > 1]


def build_bm25(chunks: list[dict]) -> dict:
    df: Counter = Counter()
    lengths = []
    for ch in chunks:
        # Title tokens repeated to weight headings in BM25 (structure-aware).
        toks = tokenize(f"{ch.get('title','')} {ch.get('title','')} {ch.get('title','')}. {ch.get('text','')}")
        ch["_tokens"] = toks
        lengths.append(len(toks))
        for t in set(toks):
            df[t] += 1
    n = len(chunks) or 1
    avgdl = sum(lengths) / n
    return {
        "k1": 1.5,
        "b": 0.75,
        "n_docs": n,
        "avgdl": avgdl,
        "df": dict(df),
        "doc_lens": lengths,
    }


def embed_minilm(texts: list[str]):
    import numpy as np
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
    vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
    return [[float(x) for x in row] for row in vecs], {
        "model": "sentence-transformers/all-MiniLM-L6-v2",
        "dims": int(vecs.shape[1]),
        "method": "minilm",
    }


def _l2_normalize_rows(mat: list[list[float]]) -> list[list[float]]:
    out = []
    for row in mat:
        n = math.sqrt(sum(v * v for v in row)) or 1.0
        out.append([v / n for v in row])
    return out


def _stable_bucket(term: str, dims: int) -> tuple[int, float]:
    """Deterministic FNV-1a bucket + sign (must match rag/retrieve.js)."""
    h = 2166136261
    for ch in term.encode("utf-8"):
        h ^= ch
        h = (h * 16777619) & 0xFFFFFFFF
    bucket = h % dims
    sign = 1.0 if (h & 1) == 0 else -1.0
    return bucket, sign


def embed_hashed(texts: list[str], dims: int = 256) -> tuple[list[list[float]], dict]:
    """Feature-hashed TF-IDF style dense vectors (stdlib only).

    Client projects queries with the same hash + IDF table for hybrid cosine search.
    Prefer MiniLM when sentence-transformers is installed.
    """
    doc_toks = [tokenize(t) for t in texts]
    df: Counter = Counter()
    for toks in doc_toks:
        for t in set(toks):
            df[t] += 1
    n = len(texts) or 1
    idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    top_terms = [t for t, _ in sorted(df.items(), key=lambda kv: (-kv[1], kv[0]))[:6000]]
    term_idf = {t: idf[t] for t in top_terms}

    vectors: list[list[float]] = []
    for toks in doc_toks:
        tf = Counter(toks)
        row = [0.0] * dims
        for term, f in tf.items():
            if term not in term_idf:
                continue
            weight = (1.0 + math.log(f)) * term_idf[term]
            h, sign = _stable_bucket(term, dims)
            row[h] += sign * weight
        vectors.append(row)
    vectors = _l2_normalize_rows(vectors)
    projection = {
        "dims": dims,
        "method": "hash-tfidf",
        "idf": term_idf,
    }
    return vectors, {
        "model": "hash-tfidf",
        "dims": dims,
        "method": "hash-tfidf",
        "projection": projection,
    }


def embed_tfidf_svd(texts: list[str], dims: int = 256):
    """Optional sklearn path when available."""
    import numpy as np
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer

    vec = TfidfVectorizer(
        lowercase=True,
        token_pattern=r"[a-z0-9][a-z0-9\-]*",
        stop_words=list(STOP),
        max_features=8000,
        sublinear_tf=True,
    )
    X = vec.fit_transform(texts)
    n_comp = min(dims, max(2, X.shape[1] - 1), X.shape[0] - 1)
    svd = TruncatedSVD(n_components=n_comp, random_state=42)
    dense = svd.fit_transform(X).astype("float32")
    norms = np.linalg.norm(dense, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    dense = dense / norms
    projection = {
        "vocab": {k: int(v) for k, v in vec.vocabulary_.items()},
        "idf": vec.idf_.astype("float32").tolist(),
        "svd_components": svd.components_.astype("float32").tolist(),
    }
    return dense.tolist(), {
        "model": "tfidf-truncatedsvd",
        "dims": int(dense.shape[1]),
        "method": "tfidf-svd",
        "projection": projection,
    }


def main() -> None:
    chunks = json.loads((DATA / "chunks.json").read_text(encoding="utf-8"))
    bm25 = build_bm25(chunks)
    # Strip private token fields before saving chunks again? keep chunks clean —
    # store tokens only inside bm25 sidecar
    token_lists = [ch.pop("_tokens", []) for ch in chunks]
    bm25["tokens"] = token_lists  # parallel to chunks order
    (DATA / "bm25.json").write_text(json.dumps(bm25), encoding="utf-8")

    texts = [f"{c.get('title','')}. {c.get('text','')}" for c in chunks]
    vectors = None
    meta = None
    try:
        vectors, meta = embed_minilm(texts)
        print("embedded with MiniLM", len(vectors), "x", meta["dims"])
    except Exception as e1:
        try:
            vectors, meta = embed_tfidf_svd(texts)
            print("embedded with TF-IDF+SVD", len(vectors), "x", meta["dims"])
        except Exception as e2:
            print(f"MiniLM/sklearn unavailable ({e1} / {e2}); using hash-tfidf")
            vectors, meta = embed_hashed(texts)
            print("embedded with hash-tfidf", len(vectors), "x", meta["dims"])

    flat = [v for row in vectors for v in row]
    (DATA / "embeddings.bin").write_bytes(struct.pack(f"<{len(flat)}f", *flat))

    emb_json = {
        "dims": meta["dims"],
        "n": len(vectors),
        "model": meta["model"],
        "method": meta["method"],
        "vectors": vectors,
    }
    if "projection" in meta:
        emb_json["projection"] = meta["projection"]
    (DATA / "embeddings.json").write_text(json.dumps(emb_json), encoding="utf-8")

    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    man["embedding"] = {
        "model": meta["model"],
        "dims": meta["dims"],
        "method": meta["method"],
        "n_vectors": len(vectors),
        "files": ["data/embeddings.bin", "data/embeddings.json"],
    }
    man["chunk_count"] = len(chunks)
    MANIFEST.write_text(json.dumps(man, indent=2), encoding="utf-8")

    # rewrite chunks without private fields
    (DATA / "chunks.json").write_text(json.dumps(chunks, indent=2), encoding="utf-8")
    print("wrote bm25.json, embeddings.*, updated corpus-manifest.json")


if __name__ == "__main__":
    main()
