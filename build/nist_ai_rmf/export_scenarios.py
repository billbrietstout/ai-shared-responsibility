#!/usr/bin/env python3
"""Export precomputed scenario retrieval JSON for plain-HTTP agent access."""
from __future__ import annotations

import json
from pathlib import Path

from retrieve_lib import pack_result

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "nist-ai-rmf" / "data"
OUT = ROOT / "nist-ai-rmf" / "retrieve"

# Stable agent URLs: /nist-ai-rmf/retrieve/<slug>.json
SCENARIOS = [
    {
        "slug": "human-oversight",
        "q": "What policies cover human-AI configurations and oversight of AI systems?",
        "notes": "Expect GOVERN 3.2 / MAP 3.5 style hits",
    },
    {
        "slug": "confabulation",
        "q": "What is confabulation risk in generative AI and how does it mislead users?",
        "notes": "GenAI Profile risk-confabulation",
    },
    {
        "slug": "govern-inventory",
        "q": "How should organizations inventory generative AI systems including data provenance?",
        "notes": "GOVERN 1.6 inventory + GAI provenance",
    },
    {
        "slug": "supply-chain",
        "q": "How should organizations manage third-party AI software and supply chain risks?",
        "notes": "GOVERN 6 / MAP 4 / MANAGE 3 third-party",
    },
    {
        "slug": "prompt-injection",
        "q": "How should GAI prompt injection and information security risks be measured?",
        "notes": "Information security risk + MEASURE security",
    },
]


def main() -> None:
    chunks = json.loads((DATA / "chunks.json").read_text(encoding="utf-8"))
    bm25 = json.loads((DATA / "bm25.json").read_text(encoding="utf-8"))
    emb = json.loads((DATA / "embeddings.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)

    index = {
        "description": (
            "Precomputed hybrid retrieval results for demo scenarios. "
            "Plain HTTP GET returns application/json on GitHub Pages. "
            "Arbitrary ?format=json query URLs are browser-JS only and return HTML to plain fetchers."
        ),
        "scenarios": [],
    }

    for sc in SCENARIOS:
        result = pack_result(chunks, bm25, emb, sc["q"], top_k=8)
        result["slug"] = sc["slug"]
        result["notes"] = sc["notes"]
        path = OUT / f"{sc['slug']}.json"
        path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        tops = [m["anchor"] for m in result["matched_chunks"][:3]]
        print(f"{sc['slug']}: conf={result['confidence']} tops={tops}")
        index["scenarios"].append(
            {
                "slug": sc["slug"],
                "q": sc["q"],
                "url": f"https://aisharedresponsibility.com/nist-ai-rmf/retrieve/{sc['slug']}.json",
                "notes": sc["notes"],
                "top_anchors": tops,
                "confidence": result["confidence"],
            }
        )

    (OUT / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"wrote {len(SCENARIOS)} scenarios + index -> {OUT}")


if __name__ == "__main__":
    main()
