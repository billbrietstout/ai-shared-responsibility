#!/usr/bin/env python3
"""Validate golden scenario questions against the static hybrid index (hit@k)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from retrieve_lib import pack_result, search_ranked

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "nist-ai-rmf" / "data"


def hit_matches(hits, expect: set[str]) -> bool:
    anchors = {h["anchor"] for h in hits}
    if expect & anchors:
        return True
    for h in hits:
        path = h.get("section_path") or ""
        title = h.get("title") or ""
        cid = h.get("chunk_id") or ""
        for exp in expect:
            e = exp.lower()
            if e in cid.lower() or e in (h.get("anchor") or "").lower():
                return True
            m = re.match(r"^(gov|map|measure|manage)-(\d+)(?:-(\d+))?$", e)
            if m:
                fn = {"gov": "GOVERN", "map": "MAP", "measure": "MEASURE", "manage": "MANAGE"}[
                    m.group(1)
                ]
                num = m.group(2) + (("." + m.group(3)) if m.group(3) else "")
                label = f"{fn} {num}"
                if label in path or label in title:
                    return True
            if e.startswith(("gv-", "mp-", "ms-", "mg-")):
                parts = e.split("-")
                if len(parts) >= 4:
                    dotted_id = f"{parts[0]}-{parts[1]}.{parts[2]}-{parts[3]}"
                    if dotted_id.lower() in cid.lower() or e in cid.lower():
                        return True
                if e in cid.lower():
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
        ranked = search_ranked(chunks, bm25, emb, g["q"], top_k=k)
        hits = [chunks[i] for i, *_ in ranked]
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

    # Also ensure scenario export pack_result shape is non-empty for key queries
    sample = pack_result(chunks, bm25, emb, "confabulation generative AI")
    assert sample["matched_chunks"], "pack_result returned no chunks"

    total = len(golden)
    print(f"\n{passed}/{total} passed (hit@{k})")
    if failed:
        print("failed:", ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
