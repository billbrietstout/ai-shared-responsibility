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

# 6b. Control-to-regulation joins resolve via mapping_key, and sector
# specializations carry an explicit specializes edge to a canonical persona.
regs = J("data/regulations.json")
juris = J("data/jurisdictions.json")
personas = J("data/personas.json")
key_to_ext = {i["mapping_key"]: f"ext.framework.{i['id']}"
              for i in regs["items"] if i.get("mapping_key")}
juris_ids = {j["id"] for j in juris["jurisdictions"]}
canonical_personas = {p["id"] for p in personas["personas"]}
specs = personas.get("sector_specializations", [])

missing_juris = [i["id"] for i in regs["items"]
                 if i.get("jurisdiction") and i["jurisdiction"] not in juris_ids]
check(not missing_juris,
      f"every regulation.jurisdiction resolves (bad: {missing_juris[:5]})")

# A duplicated mapping_key would silently collapse in key_to_ext and send a
# control's governed_by edge to whichever instrument was parsed last.
declared_keys = [i["mapping_key"] for i in regs["items"] if i.get("mapping_key")]
dup_keys = sorted({k for k in declared_keys if declared_keys.count(k) > 1})
check(not dup_keys, f"mapping_key values unique (bad: {dup_keys})")

unmapped_keys = set()
placeholder = __import__("re").compile(r"^\s*(TBD|N/?A|None|-)\b", __import__("re").I)
for vertical in ("finance", "healthcare", "insurance",
                 "public-sector", "defense", "manufacturing"):
    for c in J(f"data/{vertical}-controls.json")["controls"]:
        for mkey, citation in (c.get("mappings") or {}).items():
            if mkey == "mapping_status_note":
                continue
            if not isinstance(citation, str) or not citation.strip() or placeholder.match(citation):
                continue
            if mkey not in key_to_ext:
                unmapped_keys.add(mkey)
check(not unmapped_keys,
      f"every non-placeholder mappings key has a regulations.mapping_key "
      f"(bad: {sorted(unmapped_keys)})")

governed = [e for e in edges["edges"] if e["rel"] == "governed_by"]
check(len(governed) > 0, f"governed_by edges present ({len(governed)})")
check(all(e["source"].startswith("srf.control.") and
          e["target"].startswith("ext.framework.") for e in governed),
      "governed_by edges run control -> ext.framework")

specializes = [e for e in edges["edges"] if e["rel"] == "specializes"]
check(len(specializes) == len(specs),
      f"specializes edges match sector_specializations "
      f"({len(specializes)} vs {len(specs)})")
bad_spec = []
for s in specs:
    parent = s.get("specializes")
    if parent not in canonical_personas:
        bad_spec.append(s["id"])
    if f"srf.role.{s['id']}" not in node_ids:
        bad_spec.append(s["id"])
check(not bad_spec,
      f"every sector specialization resolves and specializes a canonical "
      f"persona (bad: {bad_spec})")

# 6c. Moral orientation hierarchy: dimensions, requirements, rollups, implements.
moral_path = os.path.join(ROOT, "data", "moral-regulatory-hierarchy.json")
if os.path.exists(moral_path):
    moral = J("data/moral-regulatory-hierarchy.json")
    dims = moral.get("dimensions", {})
    check(set(dims) == {"actor", "action", "outcome"},
          "moral dimensions are exactly actor/action/outcome")
    for dim in dims:
        check(f"srf.moral.{dim}" in node_ids,
              f"moral dimension node present ({dim})")
    reqs = moral.get("requirements", [])
    check(len(reqs) > 0, f"moral requirements authored ({len(reqs)})")
    bad_req = []
    for req in reqs:
        rid = f"ext.requirement.{req['id']}"
        profile = req.get("moral_profile") or {}
        if rid not in node_ids:
            bad_req.append(req["id"] + ":missing-node")
            continue
        if not profile.get("rationale"):
            bad_req.append(req["id"] + ":no-rationale")
        for dim in ("actor", "action", "outcome"):
            sal = profile.get(dim)
            if sal not in (0, 1, 2, 3):
                bad_req.append(req["id"] + f":bad-{dim}")
        if f"ext.framework.{req['instrument']}" not in node_ids:
            bad_req.append(req["id"] + ":bad-instrument")
    check(not bad_req, f"moral requirements well-formed (bad: {bad_req[:5]})")

    emphasizes = [e for e in edges["edges"] if e["rel"] == "emphasizes"]
    check(len(emphasizes) > 0, f"emphasizes edges present ({len(emphasizes)})")
    check(all(e.get("salience") in (1, 2, 3) for e in emphasizes),
          "emphasizes edges carry salience 1-3")

    part_of = [e for e in edges["edges"] if e["rel"] == "part_of"]
    check(len(part_of) == len(reqs),
          f"part_of edges match requirements ({len(part_of)} vs {len(reqs)})")

    implements = [e for e in edges["edges"] if e["rel"] == "implements"]
    check(len(implements) > 0, f"implements edges present ({len(implements)})")
    check(all(e["source"].startswith("srf.control.") and
              e["target"].startswith("ext.requirement.") for e in implements),
          "implements edges run control -> requirement")

    # implements refines governed_by: a control can only implement a requirement
    # of an instrument it actually cites. Without this, citation_match text from
    # one instrument silently matches another instrument's citation string.
    cites = {}
    for e in edges["edges"]:
        if e["rel"] == "governed_by":
            cites.setdefault(e["source"], set()).add(e["target"])
    orphan_impl = []
    for e in implements:
        req = e["target"].replace("ext.requirement.", "")
        parent = f"ext.framework.{req.rsplit('.', 1)[0]}"
        if parent not in cites.get(e["source"], ()):
            orphan_impl.append(f'{e["source"]} -> {req}')
    check(not orphan_impl,
          f"every implements edge sits under a governed_by edge to the same "
          f"instrument (bad: {orphan_impl[:5]})")

    # A requirement whose patterns match nothing is either uncited (fine, its
    # instrument has no mapping_key) or the patterns miss the citation style the
    # schemas actually use, which is a silent authoring bug.
    keyed = {r["id"] for r in J("data/regulations.json")["items"]
             if r.get("mapping_key")}
    linked = {e["target"].replace("ext.requirement.", "") for e in implements}
    expected = moral.get("unmatched_expected", {})
    dead = sorted(r["id"] for r in reqs
                  if r["instrument"] in keyed
                  and r["id"] not in linked
                  and r["id"] not in expected)
    check(not dead,
          f"requirements on cited instruments match at least one control "
          f"citation (bad: {dead})")
    stale = sorted(set(expected) & linked)
    check(not stale,
          f"unmatched_expected holds no requirement that now matches a citation "
          f"(bad: {stale})")

    for instrument in moral.get("priority_instruments", []):
        nid = f"ext.framework.{instrument}"
        node = next((n for n in nodes["nodes"] if n["id"] == nid), None)
        check(node and "moral_profile_rollup" in node,
              f"instrument rollup present on {instrument}")

# 6d. Jurisdiction -> regulation -> vertical join.
vertical_nodes = {f"srf.vertical.{v}" for v in
                  ("finance", "healthcare", "insurance",
                   "public-sector", "defense", "manufacturing")}
check(vertical_nodes <= node_ids, "all six vertical nodes present")
missing_av = [i["id"] for i in regs["items"] if not i.get("applicable_verticals")]
check(not missing_av,
      f"every regulation declares applicable_verticals (bad: {missing_av[:5]})")
bad_av = []
for i in regs["items"]:
    for v in i.get("applicable_verticals") or []:
        if f"srf.vertical.{v}" not in vertical_nodes:
            bad_av.append(f"{i['id']}:{v}")
check(not bad_av, f"applicable_verticals use known vertical slugs (bad: {bad_av[:5]})")
atv = [e for e in edges["edges"] if e["rel"] == "applies_to_vertical"]
check(len(atv) > 0, f"applies_to_vertical edges present ({len(atv)})")
check(all(e["source"].startswith("ext.framework.") and
          e["target"].startswith("srf.vertical.") for e in atv),
      "applies_to_vertical edges run regulation -> vertical")

# An entry claiming derived-from-controls must match the evidence path exactly.
# A placeholder citation such as "TBD: overlays are pre-draft" is not evidence,
# so an instrument carrying only placeholders cannot claim a derived list.
evidence_verticals = {}
for e in edges["edges"]:
    if e["rel"] != "governed_by":
        continue
    vslug = e["source"].split(".")[2]
    evidence_verticals.setdefault(e["target"], set()).add(vslug)
bad_derived = []
for i in regs["items"]:
    if i.get("applicable_verticals_source") != "derived-from-controls":
        continue
    ev = evidence_verticals.get(f"ext.framework.{i['id']}", set())
    if ev != set(i.get("applicable_verticals") or []):
        bad_derived.append(
            f"{i['id']} declared={sorted(i.get('applicable_verticals') or [])} "
            f"evidence={sorted(ev)}")
check(not bad_derived,
      f"derived-from-controls lists match the evidence path "
      f"(bad: {bad_derived[:4]})")

# Guard the small controlled vocabularies so a typo cannot quietly create a
# fourth verification state or a third depth.
bad_status = sorted({str(i.get("verification_status")) for i in regs["items"]}
                    - {"None", "unverified", "verified"})
check(not bad_status, f"verification_status uses a known value (bad: {bad_status})")
bad_depth = sorted({str(i.get("depth")) for i in regs["items"]}
                   - {"full", "reference"})
check(not bad_depth, f"depth uses a known value (bad: {bad_depth})")
bad_source = sorted({str(i.get("applicable_verticals_source")) for i in regs["items"]}
                    - {"derived-from-controls", "declared-cross-cutting",
                       "declared-sector", "derived+declared"})
check(not bad_source,
      f"applicable_verticals_source uses a known value (bad: {bad_source})")
# New comparative jurisdictions resolve.
for jid in ("oecd", "uk", "china", "singapore", "canada",
            "japan", "australia", "south-korea", "brazil", "india",
            "us-california"):
    check(f"srf.jurisdiction.{jid}" in node_ids, f"jurisdiction node present ({jid})")

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
