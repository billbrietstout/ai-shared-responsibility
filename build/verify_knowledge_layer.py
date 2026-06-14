#!/usr/bin/env python3
"""Integrity checks for the generated knowledge layer. Exit non-zero on failure."""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def J(p): return json.load(open(os.path.join(ROOT, p), encoding="utf-8"))
fail = []
def check(cond, msg):
    print(("ok  " if cond else "FAIL") + "  " + msg)
    if not cond: fail.append(msg)

# 1. Everything parses
reg   = J("glossary.json")
idx   = J("api/glossary/index.json")
nodes = J("ontology/nodes.json")
edges = J("ontology/edges.json")
ids   = J("ids.json")
ef    = J("export/framework.json")
eg    = J("export/glossary.json")
eo    = J("export/ontology.json")

# 2. Glossary anchors in registry match the dt ids in the canonical page
html = open(os.path.join(ROOT, "glossary", "index.html"), encoding="utf-8").read()
dt_ids = re.findall(r'<dt id="([^"]+)"', html)
reg_anchors = [t["anchor"] for t in reg["terms"]]
check(sorted(dt_ids) == sorted(reg_anchors), f"registry anchors == glossary <dt> ids ({len(dt_ids)})")
check(len(set(reg_anchors)) == len(reg_anchors), "no duplicate glossary anchors")

# 3. Counts line up across registry / index / per-term files
check(reg["count"] == len(reg["terms"]) == idx["count"] == len(idx["terms"]),
      f"registry/index counts agree ({reg['count']})")
missing = [a for a in reg_anchors if not os.path.exists(os.path.join(ROOT, "api/glossary", a + ".json"))]
check(not missing, f"all per-term API files exist (missing: {missing})")

# 4. Per-term files are self-contained and consistent with the registry
by_anchor = {t["anchor"]: t for t in reg["terms"]}
bad = []
for a in reg_anchors:
    pt = J(f"api/glossary/{a}.json")
    if not pt.get("definition") or pt["canonical_id"] != by_anchor[a]["canonical_id"]:
        bad.append(a)
check(not bad, f"per-term files self-contained and match registry (bad: {bad})")

# 5. Canonical IDs unique and resolvable
node_ids = {n["id"] for n in nodes["nodes"]}
id_ids   = {e["id"] for e in ids["ids"]}
check(len(node_ids) == len(nodes["nodes"]), "ontology node ids unique")
check(node_ids == id_ids, "ids.json covers exactly the ontology nodes")
canon = {t["canonical_id"] for t in reg["terms"]}
check(canon <= node_ids, "every glossary canonical_id resolves to a node")

# 6. Edges reference real nodes
bad_e = [(e["source"], e["target"]) for e in edges["edges"]
         if e["source"] not in node_ids or e["target"] not in node_ids]
check(not bad_e, f"all edges reference existing nodes (bad: {bad_e[:3]})")

# 7. related[] only references real nodes
bad_r = [n["id"] for n in nodes["nodes"]
         if any(r not in node_ids for r in n.get("related", []))]
check(not bad_r, f"all related[] entries resolve (bad: {bad_r[:3]})")

# 8. Export pack consistency
check(ef["counts"]["concepts"] == len(nodes["nodes"]), "export concepts == nodes")
check(ef["counts"]["definitions"] == len(reg["terms"]), "export definitions == glossary terms")
check(len(eo["nodes"]) == len(nodes["nodes"]) and len(eo["edges"]) == len(edges["edges"]),
      "export/ontology mirrors nodes+edges")
check(len(eg["definitions"]) == len(reg["terms"]), "export/glossary definitions == terms")

# 9. Manifests updated
llms = open(os.path.join(ROOT, "llms.txt"), encoding="utf-8").read()
sm   = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
for path in ["/glossary.json", "/api/glossary/index.json", "/ontology/nodes.json",
             "/ids.json", "/export/framework.json", "/llm/test/"]:
    check(path in llms, f"llms.txt references {path}")
for path in ["glossary.json", "ontology/nodes.json", "ids.json", "export/framework.json", "/llm/test/"]:
    check(path in sm, f"sitemap.xml references {path}")

# 10. Validation tool present and wired to the export pack
lt = open(os.path.join(ROOT, "llm", "test", "index.html"), encoding="utf-8").read()
check("/export/framework.json" in lt and "matched_chunks" in lt, "validation tool loads pack and emits matched_chunks")

# 11. No leftover auto-applied term links in source pages
applied = []
for d, _, files in os.walk(ROOT):
    if "/.git" in d or "/build" in d:
        continue
    for f in files:
        if f.endswith(".html") and 'class="srf-term"' in open(os.path.join(d, f), encoding="utf-8").read():
            applied.append(os.path.relpath(os.path.join(d, f), ROOT))
check(not applied, f"no auto-applied srf-term links left in pages (found: {applied})")

print(f"\n{'PASSED' if not fail else 'FAILED'}: {len(fail)} failure(s).")
sys.exit(1 if fail else 0)
