#!/usr/bin/env python3
"""Visible text on /tools/prompts/threat-model/ must be human-facing.

prompts.json holds model-facing fields next to human-facing ones:
- citations[].note and roles[].tradecraft are instructions to the model.
- citations[].why_cited, citations[].byline, and roles[].role_summary are for people.

The Sources and Roles sections may show the human-facing fields only.
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


class SectionText(HTMLParser):
    """Visible text and link targets after the h2 with the given id, up to the next h2."""

    def __init__(self, heading_id: str) -> None:
        super().__init__()
        self.heading_id = heading_id
        self.found = False
        self.active = False
        self.in_h2 = False
        self.text: list[str] = []
        self.hrefs: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "h2":
            if self.active:
                self.active = False
            if a.get("id") == self.heading_id:
                self.found = True
                self.active = True
                self.in_h2 = True
        elif self.active and tag == "a" and a.get("href"):
            self.hrefs.append(a["href"])

    def handle_endtag(self, tag):
        if tag == "h2":
            self.in_h2 = False

    def handle_data(self, data):
        if self.active and not self.in_h2:
            self.text.append(data)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def section(page: str, heading_id: str) -> SectionText:
    parser = SectionText(heading_id)
    parser.feed(page)
    return parser


def tradecraft_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", norm(text))
    return [p for p in parts if len(p) >= 25]


def main() -> int:
    pack = json.loads((PAGE_DIR / "prompts.json").read_text(encoding="utf-8"))
    page = (PAGE_DIR / "index.html").read_text(encoding="utf-8")
    errors: list[str] = []

    sources = section(page, "sources")
    if not sources.found:
        errors.append("Sources section not found (expected h2#sources)")
    src_visible = norm(" ".join(sources.text))

    for c in pack["citations"]:
        cid = c["id"]
        note = norm(c["note"])
        if note and note in src_visible:
            errors.append(f"{cid}: model-facing note is visible in Sources")
        if not c.get("why_cited"):
            errors.append(f"{cid}: missing why_cited")
        elif norm(c["why_cited"]) not in src_visible:
            errors.append(f"{cid}: why_cited is not shown in Sources")
        if c["url"] not in sources.hrefs:
            errors.append(f"{cid}: link {c['url']} is not in Sources")
        if norm(c["title"]) not in src_visible:
            errors.append(f"{cid}: title is not shown in Sources")
        if c.get("license") and norm(c["license"]).rstrip(".") not in src_visible:
            errors.append(f"{cid}: license is not shown in Sources")

    roles = section(page, "roles")
    if not roles.found:
        errors.append("Roles section not found (expected h2#roles)")
    roles_visible = norm(" ".join(roles.text))

    for r in pack["roles"]:
        rid = r["id"]
        summary = norm(r.get("role_summary", ""))
        if not summary:
            errors.append(f"{rid}: missing role_summary")
        elif summary not in roles_visible:
            errors.append(f"{rid}: role_summary is not shown in Roles")
        if norm(r["tradecraft"]) in roles_visible:
            errors.append(f"{rid}: tradecraft text is visible in Roles")
        for sentence in tradecraft_sentences(r["tradecraft"]):
            if sentence in roles_visible:
                errors.append(f"{rid}: tradecraft sentence visible in Roles: {sentence[:60]}")
    if "Role:" in roles_visible:
        errors.append("Roles text contains a 'Role:' prefix copied from tradecraft")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        f"ok: {len(pack['citations'])} citations show why_cited and no note; "
        f"{len(pack['roles'])} roles show role_summary and no tradecraft"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
