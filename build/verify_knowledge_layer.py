#!/usr/bin/env python3
"""Integrity checks for the generated knowledge layer. Exit non-zero on failure."""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from accountable_models import (
    CONTROL_SOURCES, FORBIDDEN_OWNER_FIELDS, applicable_models, canonical_ids,
    sector_to_srf, specialization_map, to_canonical,
)
from obligation_kind import REQUIRED_CATALOGS, SOURCE_KINDS, current_obligation
from risk_obligation_links import derived_control_rows, link_problem

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
for vertical in CONTROL_SOURCES:
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

# 6b2. Competency questions: one accountable persona per control, bound to
# personas.json (canonical or declared specialization). Fail if a free-text
# label invents a parallel persona name. Same bind for threats and
# finding-routing rows that name an accountable_persona.
allowed_personas = canonical_personas | {s["id"] for s in specs}
VERTICALS = ("finance", "healthcare", "insurance",
             "public-sector", "defense", "manufacturing")
KNOWN_LAYERS = {f"L{i}" for i in range(1, 6)}

missing_persona = []
bad_persona = []
multi_persona = []
bad_layer = []
for vertical in CONTROL_SOURCES:
    for c in J(f"data/{vertical}-controls.json")["controls"]:
        cid = f"{vertical}:{c['id']}"
        ap = c.get("accountable_persona")
        if ap is None or (isinstance(ap, str) and not ap.strip()):
            missing_persona.append(cid)
        elif isinstance(ap, (list, tuple)):
            multi_persona.append(cid)
        elif ap not in allowed_personas:
            bad_persona.append(f"{cid}:{ap}")
        layer = c.get("layer")
        if layer not in KNOWN_LAYERS:
            bad_layer.append(f"{cid}:{layer}")

check(not missing_persona,
      f"every vertical control names an accountable_persona "
      f"(bad: {missing_persona[:5]})")
check(not multi_persona,
      f"every vertical control names exactly one accountable_persona "
      f"(bad: {multi_persona[:5]})")
check(not bad_persona,
      f"every accountable_persona resolves in personas.json "
      f"(bad: {bad_persona[:5]})")
check(not bad_layer,
      f"every vertical control layer is L1-L5 (bad: {bad_layer[:5]})")

# One canonical SRF persona per applicable SRF model. The edge carries
# operating_model. Shared, a list, and a second owner field are rejected.
_personas_doc = J("data/personas.json")
_canonical = canonical_ids(_personas_doc)
_specs = specialization_map(_personas_doc)
_sector_map = sector_to_srf(ROOT)
_model_edges = {
    (e["source"], e.get("operating_model"), e["target"])
    for e in edges["edges"] if e["rel"] == "accountable_to"
}
bad_by_model = []
for vertical in CONTROL_SOURCES:
    for c in J(f"data/{vertical}-controls.json")["controls"]:
        cid = f"{vertical}:{c['id']}"
        src = f"srf.control.{vertical}.{c['id']}"
        for forbidden in FORBIDDEN_OWNER_FIELDS:
            if forbidden in c:
                bad_by_model.append(f"{cid}:{forbidden}")
        expected = applicable_models(c.get("operating_models"), _sector_map)
        by_model = c.get("accountable_by_model")
        if not isinstance(by_model, dict) or list(by_model) != expected:
            bad_by_model.append(f"{cid}:models")
            continue
        values = []
        for model in expected:
            persona = by_model[model]
            if not isinstance(persona, str) or persona not in _canonical:
                bad_by_model.append(f"{cid}:{model}:{persona}")
                continue
            values.append(persona)
            tgt = f"srf.role.{persona}"
            if (src, model, tgt) not in _model_edges:
                bad_by_model.append(f"{cid}:missing-edge:{model}")
        ap = c.get("accountable_persona")
        ap_canon = to_canonical(ap, _specs) if isinstance(ap, str) else None
        if len(set(values)) == 1:
            if ap_canon != values[0]:
                bad_by_model.append(f"{cid}:single-field")
        elif ap_canon not in values:
            bad_by_model.append(f"{cid}:single-field")
check(not bad_by_model,
      f"exactly one canonical persona per applicable SRF model "
      f"(bad: {bad_by_model[:6]})")

def _collect_accountable_personas(obj, out):
    if isinstance(obj, dict):
        if "accountable_persona" in obj:
            out.append(obj["accountable_persona"])
        for v in obj.values():
            _collect_accountable_personas(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _collect_accountable_personas(v, out)

for path in ("data/threats.json", "data/finding-routing.json"):
    found = []
    _collect_accountable_personas(J(path), found)
    bad_bind = sorted({p for p in found
                       if not isinstance(p, str) or p not in allowed_personas})
    check(not bad_bind,
          f"{path} accountable_persona values resolve in personas.json "
          f"(bad: {bad_bind[:5]})")
    check(len(found) > 0, f"{path} declares accountable_persona values")

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
        profile = req.get("moral_profile")
        if rid not in node_ids:
            bad_req.append(req["id"] + ":missing-node")
            continue
        # null means the obligation is recorded and not yet tagged.
        if profile is None:
            if f"ext.framework.{req['instrument']}" not in node_ids:
                bad_req.append(req["id"] + ":bad-instrument")
            continue
        if not isinstance(profile, dict) or not profile.get("rationale"):
            bad_req.append(req["id"] + ":no-rationale")
        for dim in ("actor", "action", "outcome"):
            sal = (profile or {}).get(dim)
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

    # Instrument fallback: a current obligation citation with no article
    # match is marked obligation_fallback. A catalog is not an obligation.
    impl_by_src = {}
    for e in implements:
        impl_by_src.setdefault(e["source"], set()).add(e["target"])
    by_ext = {f"ext.framework.{i['id']}": i for i in regs["items"]}
    bad_fb = []
    for e in edges["edges"]:
        if e["rel"] != "governed_by":
            continue
        item = by_ext.get(e["target"])
        if not item or not current_obligation(item):
            if "obligation_fallback" in e:
                bad_fb.append(e["source"] + ":flag-on-non-obligation")
            continue
        if not isinstance(e.get("obligation_fallback"), bool):
            bad_fb.append(e["source"] + ":missing-fallback-flag")
            continue
        prefix = f"ext.requirement.{item['id']}."
        has_article = any(t.startswith(prefix) for t in impl_by_src.get(e["source"], ()))
        if e["obligation_fallback"] == has_article:
            bad_fb.append(e["source"] + "->" + item["id"])
    check(not bad_fb,
          f"obligation_fallback is true only when no article record matched "
          f"(bad: {bad_fb[:4]})")

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
    if vslug == "common":
        continue
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
bad_life = sorted({str(i.get("lifecycle")) for i in regs["items"]}
                  - {"None", "draft", "rescinded"})
check(not bad_life, f"lifecycle uses a known value (bad: {bad_life})")

# 6e. ROCA source_kind: every instrument is binding, a voluntary standard,
# or a catalog. Catalogs are not obligations. The ontology node must carry
# the same kind and the same current-obligation flag the data rule produces.
bad_kind = [i["id"] for i in regs["items"] if i.get("source_kind") not in SOURCE_KINDS]
check(not bad_kind, f"every instrument has a known source_kind (bad: {bad_kind[:5]})")
by_reg_id = {i["id"]: i for i in regs["items"]}
bad_catalog = [cid for cid in REQUIRED_CATALOGS
               if by_reg_id.get(cid, {}).get("source_kind") != "catalog"]
check(not bad_catalog,
      f"named risk lists and control catalogs stay source_kind catalog "
      f"(bad: {bad_catalog})")
bad_node_kind = []
for i in regs["items"]:
    node = next((n for n in nodes["nodes"] if n["id"] == f"ext.framework.{i['id']}"), None)
    if not node or node.get("source_kind") != i.get("source_kind"):
        bad_node_kind.append(i["id"] + ":source_kind")
    elif node.get("current_obligation") is not current_obligation(i):
        bad_node_kind.append(i["id"] + ":current_obligation")
check(not bad_node_kind,
      f"framework nodes copy source_kind and current_obligation "
      f"(bad: {bad_node_kind[:5]})")

# 6f. Sector model names map to exactly one of the four SRF v1.0 models.
# The table is the editable source. Shared is not a model id.
SRF_MODELS = ("AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS")
SECTOR_MODELS = (
    "SaMD-Cloud", "EHR-Embedded", "Agent-Clinical", "On-Premise",
    "Agent-Ops", "Program-Embedded", "Vendor-Model", "Shared-Service",
    "OT-Edge", "Product-Embedded",
)
smap = J("data/sector-model-map.json")
core_models = {m["id"]: m for m in J("data/matrix.json")["models"]
               if m.get("provenance") == "cosai-core"}
check(set(core_models) == set(SRF_MODELS),
      "matrix.json cosai-core models are the four SRF v1.0 models")
listed = [m["id"] for m in smap.get("srf_models", [])]
check(listed == list(SRF_MODELS),
      f"sector map lists the four SRF models in order (got {listed})")
bad_def = [m["id"] for m in smap.get("srf_models", [])
           if core_models.get(m["id"], {}).get("description") != m.get("definition")]
check(not bad_def,
      f"sector map copies the SRF model definition from matrix.json (bad: {bad_def})")
rows = smap.get("mappings", [])
got_names = [r.get("sector_model") for r in rows]
check(got_names == list(SECTOR_MODELS),
      f"sector map has the 10 sector models once, in order (got {got_names})")
bad_row = []
for r in rows:
    if r.get("srf_model") not in SRF_MODELS:
        bad_row.append(r.get("sector_model"))
    alt = (r.get("alternative") or {}).get("srf_model")
    if alt is not None and (alt not in SRF_MODELS or alt == r.get("srf_model")):
        bad_row.append(str(r.get("sector_model")) + ":alternative")
    if not r.get("definition") or not r.get("definition_source") or not r.get("rationale"):
        bad_row.append(str(r.get("sector_model")) + ":missing-text")
check(not bad_row, f"each sector model maps to one SRF model (bad: {bad_row})")
used_sector = set()
for vertical in ("finance", "healthcare", "insurance",
                 "public-sector", "defense", "manufacturing"):
    for c in J(f"data/{vertical}-controls.json")["controls"]:
        for code in c.get("operating_models") or []:
            if code not in SRF_MODELS:
                used_sector.add(code)
check(used_sector == set(SECTOR_MODELS),
      f"sector model names on controls match the map "
      f"(only on controls: {sorted(used_sector - set(SECTOR_MODELS))}; "
      f"only on map: {sorted(set(SECTOR_MODELS) - used_sector)})")

# 6g. Risk records are threats.json. Every obligation link has a basis and a
# source, and a derived link's citation actually matches the requirement.
threat_doc = J("data/threats.json")
req_ids = {r["id"] for r in J("data/moral-regulatory-hierarchy.json")["requirements"]}
control_ids = set()
controls_by_full = {}
for vertical in CONTROL_SOURCES:
    for c in J(f"data/{vertical}-controls.json")["controls"]:
        full = f"srf.control.{vertical}.{c['id']}"
        control_ids.add(full)
        controls_by_full[full] = c
allowed_derived = derived_control_rows(ROOT)
SRF_MODEL_IDS = ("AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS")
bad_threat = []
link_basis = {}
for t in threat_doc["threats"]:
    tid = f"ext.threat.{t['id']}"
    if tid not in node_ids:
        bad_threat.append(t["id"] + ":missing-node")
    for cid in t.get("related_controls") or []:
        if cid not in control_ids:
            bad_threat.append(f"{t['id']}:bad-control:{cid}")
        elif (tid, cid) not in {(e["source"], e["target"])
                                for e in edges["edges"] if e["rel"] == "mitigated_by"}:
            bad_threat.append(f"{t['id']}:missing-mitigated_by:{cid}")
    seen_req = set()
    for link in t.get("obligations") or []:
        problem = link_problem(link, t, allowed_derived)
        if problem:
            bad_threat.append(f"{t['id']}:{problem}")
            continue
        rid = link["requirement"]
        if rid not in req_ids:
            bad_threat.append(f"{t['id']}:unknown-requirement:{rid}")
        if rid in seen_req:
            bad_threat.append(f"{t['id']}:duplicate:{rid}")
        seen_req.add(rid)
        link_basis[link["basis"]] = link_basis.get(link["basis"], 0) + 1
        edge = next((e for e in edges["edges"]
                     if e["rel"] == "triggers_obligation"
                     and e["source"] == tid
                     and e["target"] == f"ext.requirement.{rid}"), None)
        if edge is None or edge.get("basis") != link["basis"]:
            bad_threat.append(f"{t['id']}:missing-edge:{rid}")
    for model in SRF_MODEL_IDS:
        cell = (t.get("accountability") or {}).get(model) or {}
        persona = cell.get("accountable_persona")
        if not persona:
            bad_threat.append(f"{t['id']}:no-owner:{model}")
            continue
        owner_edge = next((e for e in edges["edges"]
                           if e["rel"] == "risk_owner"
                           and e["source"] == tid
                           and e["target"] == f"srf.role.{persona}"
                           and e.get("operating_model") == model), None)
        if owner_edge is None:
            bad_threat.append(f"{t['id']}:missing-risk-owner:{model}")
        linked_owners = []
        for cid in t.get("related_controls") or []:
            owners = (controls_by_full.get(cid) or {}).get("accountable_by_model") or {}
            if model in owners:
                linked_owners.append(owners[model])
        if linked_owners:
            if cell.get("no_linked_control_in_model"):
                bad_threat.append(f"{t['id']}:gap-flag-but-controls:{model}")
            if persona not in linked_owners:
                bad_threat.append(f"{t['id']}:owner-mismatch:{model}")
        elif not cell.get("no_linked_control_in_model"):
            bad_threat.append(f"{t['id']}:unmarked-gap:{model}")
check(not bad_threat,
      f"threat obligation links are traceable and wired "
      f"(bad: {bad_threat[:5]})")
check(sum(link_basis.values()) > 0,
      f"obligation links present ({link_basis})")

# Depth carries a verification promise. A full-depth entry was read against the
# primary source, so it records last_verified and cannot sit at unverified; a
# reference entry has not been read that way and must say so. The OECD entry was
# full depth, unverified, and missing last_verified all at once, which no single
# vocabulary check above would catch.
bad_promise = []
for i in regs["items"]:
    full = i.get("depth") == "full"
    if full and i.get("verification_status") == "unverified":
        bad_promise.append(f"{i['id']}:full-but-unverified")
    if full and not i.get("last_verified"):
        bad_promise.append(f"{i['id']}:full-without-last_verified")
    if not full and not i.get("verification_status"):
        bad_promise.append(f"{i['id']}:reference-without-status")
check(not bad_promise,
      f"depth matches the verification fields (bad: {bad_promise[:5]})")

# A rescinded instrument points at what replaced it, and only a rescinded one
# does, so a stale mapping resolves forward instead of dead-ending.
sup = [e for e in edges["edges"] if e["rel"] == "superseded_by"]
bad_sup = [f"{i['id']}:{i.get('superseded_by')}" for i in regs["items"]
           if i.get("superseded_by")
           and (i.get("lifecycle") != "rescinded"
                or f"ext.framework.{i['superseded_by']}" not in node_ids)]
check(not bad_sup,
      f"superseded_by names a real instrument and only appears on a rescinded "
      f"entry (bad: {bad_sup})")
check(len(sup) == sum(1 for i in regs["items"] if i.get("superseded_by")),
      f"superseded_by edges match the data ({len(sup)})")
# New comparative jurisdictions resolve.
for jid in ("oecd", "uk", "china", "singapore", "canada",
            "japan", "australia", "south-korea", "brazil", "india",
            "us-california"):
    check(f"srf.jurisdiction.{jid}" in node_ids, f"jurisdiction node present ({jid})")

# 6h. Common (sector-neutral) controls. Common is not a vertical: no vertical
# node, no applies_to_vertical or belongs_to_vertical edge, and no governed_by
# edge from principles. The schema is stricter than the sector files.
COMMON_LAYERS = tuple(f"L{i}" for i in range(1, 6))
COMMON_LIFECYCLE = ("design", "validate", "operate", "change", "retire")
COMMON_MODELS = ("AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS")
COMMON_REQUIRED_KEYS = ("nist_ai_rmf", "eu_ai_act", "iso_42001")
COMMON_OPTIONAL_KEYS = ("finos_aigf", "aicm", "owasp_llm", "cis", "mitre_atlas",
                        "nist_csf_2", "nist_cyber_ai", "gdpr")
COMMON_KEYS = set(COMMON_REQUIRED_KEYS) | set(COMMON_OPTIONAL_KEYS)
COMMON_FIELDS_REQUIRED = ("id", "layer", "component", "title", "description",
                          "accountable_persona", "accountable_by_model",
                          "operating_models", "mappings", "threshold",
                          "lifecycle_stage", "common_status")
COMMON_FIELDS_OPTIONAL = ("principles", "former_ids", "eu_ai_act_risk_class",
                          "cross_layer_controls", "cross_layer_note",
                          "accountable_persona_note", "implementing_persona_note")
COMMON_STATUS = ("draft",)
common_doc = J("data/common-controls.json")
common_list = common_doc["controls"]
bad_common = []
common_seen = set()
per_layer_seq = {}
common_principles = (
    {p["id"] for p in J("data/ai-agentic-principles.json")["principles"]}
    | {p["id"] for p in J("data/security-principles.json")["principles"]})
for c in common_list:
    cid = c.get("id", "?")
    allowed = set(COMMON_FIELDS_REQUIRED) | set(COMMON_FIELDS_OPTIONAL)
    for f in COMMON_FIELDS_REQUIRED:
        if f not in c:
            bad_common.append(f"{cid}:missing-{f}")
    for f in c:
        if f not in allowed:
            bad_common.append(f"{cid}:field-not-allowed:{f}")
    m = re.fullmatch(r"SRF-COM-(L[1-5])-(\d{3})", str(cid))
    if not m:
        bad_common.append(f"{cid}:id-convention")
    else:
        if m.group(1) != c.get("layer"):
            bad_common.append(f"{cid}:id-layer-mismatch")
        per_layer_seq.setdefault(m.group(1), []).append(int(m.group(2)))
    if cid in common_seen:
        bad_common.append(f"{cid}:duplicate")
    common_seen.add(cid)
    if c.get("layer") not in COMMON_LAYERS:
        bad_common.append(f"{cid}:layer")
    if c.get("lifecycle_stage") not in COMMON_LIFECYCLE:
        bad_common.append(f"{cid}:lifecycle_stage:{c.get('lifecycle_stage')}")
    if c.get("common_status") not in COMMON_STATUS:
        bad_common.append(f"{cid}:common_status:{c.get('common_status')}")
    if sorted(c.get("operating_models") or []) != sorted(
            set(c.get("operating_models") or [])) or not set(
            c.get("operating_models") or []) <= set(COMMON_MODELS) or not c.get(
            "operating_models"):
        bad_common.append(f"{cid}:operating_models")
    maps = c.get("mappings") or {}
    for k in maps:
        if k not in COMMON_KEYS:
            bad_common.append(f"{cid}:mapping-key-not-allowed:{k}")
    for k in COMMON_REQUIRED_KEYS:
        if not isinstance(maps.get(k), str) or not maps[k].strip():
            bad_common.append(f"{cid}:mapping-missing:{k}")
    for p in c.get("principles") or []:
        if p not in common_principles:
            bad_common.append(f"{cid}:unknown-principle:{p}")
    for old in c.get("former_ids") or []:
        if not re.fullmatch(r"srf\.control\.[a-z-]+\.[A-Za-z0-9-]+", old):
            bad_common.append(f"{cid}:former_id-format:{old}")
check(common_list, f"common controls present ({len(common_list)})")
check(not bad_common, f"common controls follow the common schema (bad: {bad_common[:6]})")
bad_seq = [layer for layer, seqs in per_layer_seq.items()
           if sorted(seqs) != list(range(1, len(seqs) + 1))]
check(not bad_seq, f"common seq runs 001.. per layer (bad: {bad_seq})")
check(common_doc.get("id_convention") == "SRF-COM-{layer}-{seq}",
      "common file declares id_convention SRF-COM-{layer}-{seq}")
check("srf.concept.common-controls" in node_ids, "common scope node present")
check(not [n for n in node_ids if n.startswith("srf.vertical.common")],
      "common has no srf.vertical node")
common_nodes = {f"srf.control.common.{c['id']}" for c in common_list}
check(common_nodes <= node_ids, "every common control has a node")
vert_bad = [e for e in edges["edges"]
            if e["rel"] in ("belongs_to_vertical", "applies_to_vertical")
            and (e["source"] in common_nodes or e["target"] in common_nodes)]
check(not vert_bad, "common controls carry no vertical edges")
scope_bad = [n for n in common_nodes
             if (n, "part_of_common_scope", "srf.concept.common-controls")
             not in {(e["source"], e["rel"], e["target"]) for e in edges["edges"]}]
check(not scope_bad, f"common controls link to the scope node (bad: {scope_bad})")
check(not [e for e in edges["edges"] if e["rel"] == "governed_by"
           and e["target"].startswith(("srf.principle", "ext.principle"))],
      "principles create no governed_by edges")
check(not [e for e in edges["edges"] if e["rel"] in ("refines_common",)],
      "no control-to-control link edges in this release")

# Aliases: an old canonical id resolves to a live node, and is no longer a node.
alias_rows = ids.get("aliases", [])
alias_bad = []
for a in alias_rows:
    if a.get("canonical_id") not in node_ids:
        alias_bad.append(f"{a.get('alias')}:target-missing")
    if a.get("alias") in node_ids:
        alias_bad.append(f"{a.get('alias')}:alias-is-still-a-node")
declared_aliases = {(old, f"srf.control.common.{c['id']}")
                    for c in common_list for old in c.get("former_ids") or []}
if declared_aliases != {(a["alias"], a["canonical_id"]) for a in alias_rows}:
    alias_bad.append("ids.json aliases differ from former_ids")
check(not alias_bad, f"every ids.json alias targets an existing node (bad: {alias_bad[:4]})")
check(len(alias_rows) >= 1, f"aliases present ({len(alias_rows)})")

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
