#!/usr/bin/env python3
"""Visible text on /tools/prompts/threat-model/ must be human-facing.

Two files feed the page:
- prompts.json is the file the chat loads. It holds model-facing text only:
  citations[].note, roles[].tradecraft, notices_first, declines_to_opine.
- page_text.json holds the human-facing text: citation byline, why_cited,
  license wording, and role summaries. build_page.py reads it. The chat never does.

This test checks that the Sources and Roles sections show page_text.json text,
that no model-facing text appears there, and that the two files agree on ids.
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

HUMAN_KEYS = {"byline", "why_cited", "license", "license_display", "role_summary"}


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


def find_keys(node, keys: set[str], path: str = "") -> list[str]:
    hits: list[str] = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k in keys:
                hits.append(f"{path}.{k}")
            hits.extend(find_keys(v, keys, f"{path}.{k}"))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            hits.extend(find_keys(v, keys, f"{path}[{i}]"))
    return hits


def main() -> int:
    pack = json.loads((PAGE_DIR / "prompts.json").read_text(encoding="utf-8"))
    text = json.loads((PAGE_DIR / "page_text.json").read_text(encoding="utf-8"))
    page = (PAGE_DIR / "index.html").read_text(encoding="utf-8")
    errors: list[str] = []

    for hit in find_keys(pack, HUMAN_KEYS):
        errors.append(f"prompts.json holds a human-facing key: {hit}")

    cit_ids = {c["id"] for c in pack["citations"]}
    role_ids = {r["id"] for r in pack["roles"]}
    if set(text["citations"]) != cit_ids:
        errors.append(
            f"page_text citations ids {sorted(set(text['citations']) ^ cit_ids)} do not match prompts.json"
        )
    if set(text["roles"]) != role_ids:
        errors.append(
            f"page_text role ids {sorted(set(text['roles']) ^ role_ids)} do not match prompts.json"
        )

    sources = section(page, "sources")
    if not sources.found:
        errors.append("Sources section not found (expected h2#sources)")
    src_visible = norm(" ".join(sources.text))

    for c in pack["citations"]:
        cid = c["id"]
        t = text["citations"].get(cid, {})
        note = norm(c["note"])
        if note and note in src_visible:
            errors.append(f"{cid}: model-facing note is visible in Sources")
        if not t.get("why_cited"):
            errors.append(f"{cid}: missing why_cited in page_text.json")
        elif norm(t["why_cited"]) not in src_visible:
            errors.append(f"{cid}: why_cited is not shown in Sources")
        if not t.get("byline"):
            errors.append(f"{cid}: missing byline in page_text.json")
        elif norm(t["byline"]) not in src_visible:
            errors.append(f"{cid}: byline is not shown in Sources")
        if c["url"] not in sources.hrefs:
            errors.append(f"{cid}: link {c['url']} is not in Sources")
        if norm(c["title"]) not in src_visible:
            errors.append(f"{cid}: title is not shown in Sources")
        if t.get("license") and norm(t["license"]).rstrip(".") not in src_visible:
            errors.append(f"{cid}: license is not shown in Sources")

    roles = section(page, "roles")
    if not roles.found:
        errors.append("Roles section not found (expected h2#roles)")
    roles_visible = norm(" ".join(roles.text))

    for r in pack["roles"]:
        rid = r["id"]
        summary = norm(text["roles"].get(rid, {}).get("role_summary", ""))
        if not summary:
            errors.append(f"{rid}: missing role_summary in page_text.json")
        elif summary not in roles_visible:
            errors.append(f"{rid}: role_summary is not shown in Roles")
        t = text["roles"].get(rid, {})
        for key in ("watches_for", "does_not_claim"):
            items = t.get(key, [])
            if not items:
                errors.append(f"{rid}: missing {key} in page_text.json")
            for item in items:
                if norm(item) not in roles_visible:
                    errors.append(f"{rid}: {key} item is not shown in Roles: {item[:60]}")
        for item in t.get("does_not_claim", []):
            if re.match(r"(?i)it\s", item) or item.endswith("."):
                errors.append(f"{rid}: does_not_claim item is not a short noun phrase: {item[:60]}")
        visible_lower = roles_visible.lower()
        for item in r.get("notices_first", []) + r.get("declines_to_opine", []):
            if norm(item).lower() in visible_lower:
                errors.append(f"{rid}: model-facing list text is visible in Roles: {item[:60]}")
        if norm(r["tradecraft"]) in roles_visible:
            errors.append(f"{rid}: tradecraft text is visible in Roles")
        for sentence in re.split(r"(?<=[.!?])\s+", norm(r["tradecraft"])):
            if len(sentence) >= 25 and sentence in roles_visible:
                errors.append(f"{rid}: tradecraft sentence visible in Roles: {sentence[:60]}")
    if "Role:" in roles_visible:
        errors.append("Roles text contains a 'Role:' prefix copied from tradecraft")
    if page.count('class="role-points"') != 2 * len(pack["roles"]):
        errors.append("each role needs a Watches for and a Does not claim block with class role-points")
    if not re.search(r"\.role-points ul\s*\{[^}]*padding-left", page):
        errors.append("role-points lists have no padding-left rule, so they are not visibly nested")
    for label in ("Notices first", "Declines to infer"):
        if label.lower() in roles_visible.lower():
            errors.append(f"Roles text contains the model-facing label '{label}'")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        f"ok: {len(pack['citations'])} citations and {len(pack['roles'])} roles show page_text.json "
        "text; Roles show page_text.json lists and no model-facing list text; "
        "prompts.json has no human-facing keys; ids resolve"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
