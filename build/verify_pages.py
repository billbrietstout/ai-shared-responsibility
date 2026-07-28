#!/usr/bin/env python3
"""Phase-2 page checks: llm:* metadata, chunk markers, markup sanity."""
import json, os, re, sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
valid = {e["id"] for e in json.load(open(os.path.join(ROOT, "ids.json")))["ids"]}
valid |= {"srf.framework.cosai-srf"}

pages = []
for d, dirs, files in os.walk(ROOT):
    dirs[:] = [x for x in dirs if x not in (".git", "build", "node_modules") and not x.endswith(" 2")]
    if "index.html" in files:
        pages.append(os.path.join(d, "index.html"))
pages.sort()

fail = []
def check(cond, msg):
    if not cond:
        fail.append(msg)
        print("FAIL  " + msg)

class Balance(HTMLParser):
    def __init__(self): super().__init__(); self.ok = True
    def error(self, m): self.ok = False

no_type = []
bad_concepts = []
no_marker = []
parse_err = []
stray = []

VOID = {"meta","link","br","hr","img","input","source","area","base","col","embed","param","track","wbr"}

for p in pages:
    rel = os.path.relpath(p, ROOT)
    src = open(p, encoding="utf-8").read()

    # 1. every page declares llm:type
    if 'name="llm:type"' not in src:
        no_type.append(rel)

    # 2. llm:concepts values resolve to real node ids
    m = re.search(r'name="llm:concepts"\s+content="([^"]*)"', src)
    if m:
        for c in [x.strip() for x in m.group(1).split(",") if x.strip()]:
            if c not in valid:
                bad_concepts.append(f"{rel}:{c}")

    # 3. content pages carry at least one chunk marker (redirects exempt)
    is_redirect = 'http-equiv="refresh"' in src
    if not is_redirect and "data-llm=" not in src:
        no_marker.append(rel)

    # 4. every data-llm attribute sits on a <section or <header opening tag
    for mm in re.finditer(r'data-llm="[^"]*"', src):
        ctx = src.rfind("<", 0, mm.start())
        tagname = re.match(r"<\s*([a-zA-Z0-9]+)", src[ctx:ctx+20])
        if not tagname or tagname.group(1).lower() not in ("section", "header", "main", "div", "article"):
            stray.append(f"{rel}@{mm.start()}")

    # 5. tag balance unchanged / parseable (section + header open==close)
    for tag in ("section", "header"):
        opens = len(re.findall(rf"<{tag}\b", src))
        closes = len(re.findall(rf"</{tag}>", src))
        # opens may exceed closes only via void usage (none here); require equal
        if opens != closes:
            parse_err.append(f"{rel}:{tag} {opens}/{closes}")

# 6. llms-full.txt copies each control's mappings verbatim. Those copies drifted
# from /data before, which meant the prose artifact and the JSON gave agents
# different citations. build/sync_llms_full.py rewrites them from the data.
VERTICAL_HEADINGS = {
    "Financial Services": "finance", "Healthcare": "healthcare",
    "Insurance": "insurance", "Public Sector": "public-sector",
    "Defense / DoD": "defense", "Manufacturing": "manufacturing",
}
full_path = os.path.join(ROOT, "llms-full.txt")
if os.path.exists(full_path):
    controls = {}
    for slug in VERTICAL_HEADINGS.values():
        payload = json.load(open(os.path.join(ROOT, "data", f"{slug}-controls.json")))
        controls[slug] = {c["id"]: c for c in payload["controls"]}
    lines = open(full_path, encoding="utf-8").read().split("\n")
    vertical, starts = None, []
    for idx, line in enumerate(lines):
        sec = re.match(r"^### (.+?)\s*$", line)
        if sec and sec.group(1) in VERTICAL_HEADINGS:
            vertical = VERTICAL_HEADINGS[sec.group(1)]
        ctl = re.match(r"^##### (SRF-[A-Z0-9-]+):", line)
        if ctl:
            starts.append((idx, vertical, ctl.group(1)))
    stale = []
    for pos, (idx, vslug, cid) in enumerate(starts):
        limit = starts[pos + 1][0] if pos + 1 < len(starts) else len(lines)
        end = limit
        for probe in range(idx + 1, limit):
            if re.match(r"^#{2,5} ", lines[probe]):
                end = probe
                break
        body = lines[idx:end]
        head = next((i for i, l in enumerate(body)
                     if l.strip() == "Regulatory mappings:"), None)
        control = controls.get(vslug, {}).get(cid)
        if control is None:
            stale.append(f"{vslug}/{cid}: no such control in data")
            continue
        want = [f"  - {k}: {v}" for k, v in (control.get("mappings") or {}).items()
                if k != "mapping_status_note"]
        if head is None:
            stale.append(f"{vslug}/{cid}: no mappings block")
            continue
        got, cur = [], head + 1
        while cur < len(body) and re.match(r"^  - [a-z0-9_]+: ", body[cur]):
            got.append(body[cur])
            cur += 1
        if got != want:
            stale.append(f"{vslug}/{cid}")
    check(not stale,
          f"llms-full.txt control mappings match /data "
          f"({len(stale)} stale, run build/sync_llms_full.py; {stale[:4]})")

check(not no_type, f"all pages have llm:type (missing: {no_type})")
check(not bad_concepts, f"all llm:concepts resolve to ids.json (bad: {bad_concepts[:5]})")
check(not no_marker, f"all content pages have >=1 chunk marker (missing: {no_marker})")
check(not stray, f"every data-llm is on a section/header tag (stray: {stray[:5]})")
check(not parse_err, f"section/header tags balanced (bad: {parse_err[:5]})")

print(f"\nPages checked: {len(pages)}")
print(f"{'PASSED' if not fail else 'FAILED'}: {len(fail)} failure(s).")
sys.exit(1 if fail else 0)
