#!/usr/bin/env python3
"""The Sources list on /tools/prompts/threat-model/ must show human-facing text.

Each citation in prompts.json has a model-facing `note` (an instruction to the
model) and a human-facing `why_cited`. The page may show only the second.
"""
from __future__ import annotations

import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE_DIR = ROOT / "tools" / "prompts" / "threat-model"


class SourcesText(HTMLParser):
    """Collect visible text and link targets between the Sources heading and its list end."""

    def __init__(self) -> None:
        super().__init__()
        self.active = False
        self.done = False
        self.in_heading = False
        self.text: list[str] = []
        self.hrefs: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "h2" and a.get("id") == "sources":
            self.active = True
            self.in_heading = True
        elif self.active and tag == "a" and a.get("href"):
            self.hrefs.append(a["href"])

    def handle_endtag(self, tag):
        if tag == "h2":
            self.in_heading = False
        if self.active and tag == "ul":
            self.active = False
            self.done = True

    def handle_data(self, data):
        if self.active and not self.in_heading:
            self.text.append(data)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def main() -> int:
    pack = json.loads((PAGE_DIR / "prompts.json").read_text(encoding="utf-8"))
    parser = SourcesText()
    parser.feed((PAGE_DIR / "index.html").read_text(encoding="utf-8"))
    errors: list[str] = []
    if not parser.done:
        errors.append("Sources list not found (expected h2#sources followed by a ul)")
    visible = norm(" ".join(parser.text))

    for c in pack["citations"]:
        cid = c["id"]
        note = norm(c["note"])
        if note and note in visible:
            errors.append(f"{cid}: model-facing note is visible in Sources")
        if not c.get("why_cited"):
            errors.append(f"{cid}: missing why_cited")
        elif norm(c["why_cited"]) not in visible:
            errors.append(f"{cid}: why_cited is not shown in Sources")
        if c["url"] not in parser.hrefs:
            errors.append(f"{cid}: link {c['url']} is not in Sources")
        if norm(c["title"]) not in visible:
            errors.append(f"{cid}: title is not shown in Sources")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(f"ok: {len(pack['citations'])} citations show why_cited and no model-facing note")
    return 0


if __name__ == "__main__":
    sys.exit(main())
