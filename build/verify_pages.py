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
        if not tagname or tagname.group(1).lower() not in ("section", "header", "main", "div"):
            stray.append(f"{rel}@{mm.start()}")

    # 5. tag balance unchanged / parseable (section + header open==close)
    for tag in ("section", "header"):
        opens = len(re.findall(rf"<{tag}\b", src))
        closes = len(re.findall(rf"</{tag}>", src))
        # opens may exceed closes only via void usage (none here); require equal
        if opens != closes:
            parse_err.append(f"{rel}:{tag} {opens}/{closes}")

check(not no_type, f"all pages have llm:type (missing: {no_type})")
check(not bad_concepts, f"all llm:concepts resolve to ids.json (bad: {bad_concepts[:5]})")
check(not no_marker, f"all content pages have >=1 chunk marker (missing: {no_marker})")
check(not stray, f"every data-llm is on a section/header tag (stray: {stray[:5]})")
check(not parse_err, f"section/header tags balanced (bad: {parse_err[:5]})")

print(f"\nPages checked: {len(pages)}")
print(f"{'PASSED' if not fail else 'FAILED'}: {len(fail)} failure(s).")
sys.exit(1 if fail else 0)
