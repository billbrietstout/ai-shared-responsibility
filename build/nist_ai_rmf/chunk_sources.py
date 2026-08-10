#!/usr/bin/env python3
"""Structure-aware chunking for nist-ai-rmf Markdown sources."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "nist-ai-rmf" / "sources"
OUT = ROOT / "nist-ai-rmf" / "data"

HEADING = re.compile(r"^(#{1,6})\s+(.+)$")
ANCHOR = re.compile(r'<a id="([^"]+)"></a>')
FENCE = re.compile(r"^```")

STOP_FRONT = frozenset({"doc_id", "nist_id", "version", "published", "doi", "pdf", "disclaimer"})

DOC_META = {
    "nist-ai-100-1.md": {
        "doc_id": "nist-ai-100-1",
        "version": "1.0",
        "nist_id": "NIST.AI.100-1",
        "topics_base": ["ai-rmf"],
    },
    "nist-ai-600-1.md": {
        "doc_id": "nist-ai-600-1",
        "version": "1.0",
        "nist_id": "NIST.AI.600-1",
        "topics_base": ["ai-rmf", "genai"],
        "applicability": "Companion profile; supplements and does not replace NIST.AI.100-1",
    },
}

# Curated SP 800-53 family / control hints for AI risk themes (IDs only; no catalog prose).
CONTROL_HINTS = {
    "gov": ["PM-9", "PM-11", "CA-2", "CA-7"],
    "supply": ["SA-4", "SA-9", "SA-12", "SR-3"],
    "human": ["AC-2", "AC-3", "AC-6", "AU-2"],
    "measure": ["CA-2", "CA-7", "SI-2", "SI-4"],
    "security": ["SI-3", "SI-4", "SI-7", "SC-7", "RA-5"],
    "privacy": ["PT-2", "PT-3", "SI-12", "MP-6"],
    "incident": ["IR-4", "IR-6", "IR-8", "AU-6"],
    "inventory": ["CM-8", "PM-5", "SA-11"],
}


def infer_topics(path_parts: list[str], text: str) -> list[str]:
    topics: list[str] = []
    blob = " ".join(path_parts + [text[:400]]).lower()
    for key, tag in [
        ("govern", "govern"),
        ("map", "map"),
        ("measure", "measure"),
        ("manage", "manage"),
        ("trust", "trustworthiness"),
        ("risk", "risk"),
        ("genai", "genai"),
        ("gai", "genai"),
        ("bias", "bias"),
        ("privacy", "privacy"),
        ("security", "security"),
        ("oversight", "human-oversight"),
        ("human-ai", "human-oversight"),
        ("third-party", "supply-chain"),
        ("supply", "supply-chain"),
        ("tevv", "tevv"),
        ("incident", "incident"),
        ("confabulation", "genai"),
        ("cbrn", "genai"),
    ]:
        if key in blob and tag not in topics:
            topics.append(tag)
    return topics


def related_controls(topics: list[str], section_path: str) -> list[str]:
    controls: list[str] = []
    path = section_path.lower()
    mapping = []
    if "govern" in path or "gov" in topics:
        mapping += CONTROL_HINTS["gov"]
    if "third-party" in path or "supply" in path or "value chain" in path or "6." in path and "govern" in path:
        mapping += CONTROL_HINTS["supply"]
    if "human" in path or "oversight" in path or "3.2" in path or "3.5" in path:
        mapping += CONTROL_HINTS["human"]
    if "measure" in path or "tevv" in path:
        mapping += CONTROL_HINTS["measure"]
    if "secur" in path or "resilien" in path or "information security" in path:
        mapping += CONTROL_HINTS["security"]
    if "privacy" in path:
        mapping += CONTROL_HINTS["privacy"]
    if "incident" in path or "manage 4" in path or "manage 2.3" in path:
        mapping += CONTROL_HINTS["incident"]
    if "inventory" in path or "1.6" in path:
        mapping += CONTROL_HINTS["inventory"]
    for c in mapping:
        if c not in controls:
            controls.append(c)
    return controls[:8]


def parse_doc(path: Path) -> list[dict]:
    meta = DOC_META[path.name]
    lines = path.read_text(encoding="utf-8").splitlines()
    chunks: list[dict] = []
    stack: list[tuple[int, str]] = []  # level, title
    pending_anchor: str | None = None
    buf: list[str] = []
    in_fence = False
    current: dict | None = None

    def flush():
        nonlocal current, buf
        if not current:
            buf = []
            return
        text = "\n".join(buf).strip()
        # drop yaml-ish fence bodies that are only metadata keys
        if text and not all(
            any(text.startswith(k) or f"\n{k}:" in f"\n{text}" for k in STOP_FRONT)
            for _ in [0]
        ):
            pass
        body = text
        if body and len(body) < 400:
            body = f"{title}. {body}"
        current["text"] = body
        if body and not body.startswith("doc_id:"):
            chunks.append(current)
        current = None
        buf = []

    i = 0
    while i < len(lines):
        line = lines[i]
        if FENCE.match(line):
            in_fence = not in_fence
            if current is not None:
                buf.append(line)
            i += 1
            continue
        am = ANCHOR.match(line.strip())
        if am and not in_fence:
            aid = am.group(1)
            if current is not None:
                # Anchor follows its heading in our Markdown sources.
                current["anchor"] = aid
                current["chunk_id"] = f"{meta['doc_id']}:{aid}"
            else:
                pending_anchor = aid
            i += 1
            continue
        hm = HEADING.match(line) if not in_fence else None
        if hm:
            flush()
            level = len(hm.group(1))
            title = hm.group(2).strip()
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, title))
            section_path = " > ".join(t for _, t in stack)
            anchor = pending_anchor or re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            pending_anchor = None
            topics = list(meta["topics_base"]) + infer_topics([t for _, t in stack], title)
            # dedupe topics
            seen = set()
            topics = [t for t in topics if not (t in seen or seen.add(t))]
            parent_id = None
            if len(stack) > 1:
                # parent is previous chunk with shorter path — assigned in second pass
                parent_id = None
            chunk_id = f"{meta['doc_id']}:{anchor}"
            current = {
                "chunk_id": chunk_id,
                "doc_id": meta["doc_id"],
                "nist_id": meta["nist_id"],
                "version": meta["version"],
                "title": title,
                "section_path": section_path,
                "anchor": anchor,
                "level": level,
                "parent_id": parent_id,
                "topics": topics,
                "related_controls": related_controls(topics, section_path),
                "applicability": meta.get("applicability"),
                "source_md": f"sources/{path.name}",
            }
            buf = []
            i += 1
            continue
        if current is not None:
            buf.append(line)
        i += 1
    flush()

    # assign parent_id by nearest preceding shallower heading
    by_id = {c["chunk_id"]: c for c in chunks}
    stack_ids: list[tuple[int, str]] = []
    for c in chunks:
        while stack_ids and stack_ids[-1][0] >= c["level"]:
            stack_ids.pop()
        if stack_ids:
            c["parent_id"] = stack_ids[-1][1]
        stack_ids.append((c["level"], c["chunk_id"]))
        _ = by_id
    return chunks


def main() -> None:
    all_chunks: list[dict] = []
    for name in ("nist-ai-100-1.md", "nist-ai-600-1.md"):
        path = SRC / name
        parts = parse_doc(path)
        all_chunks.extend(parts)
        print(f"{name}: {len(parts)} chunks")

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "chunks.json").write_text(json.dumps(all_chunks, indent=2), encoding="utf-8")
    with (OUT / "chunks.jsonl").open("w", encoding="utf-8") as f:
        for c in all_chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    print(f"total {len(all_chunks)} -> {OUT / 'chunks.json'}")


if __name__ == "__main__":
    main()
