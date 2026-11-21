#!/usr/bin/env python3
"""Checks for the threat model draft. Run after tests/test_cascade.js, which writes the export files.
1. The JSON Schema is valid draft 2020-12.
2. Each example-*.yaml / example-*.json pair is the same data and validates.
3. The prototype's JSON and YAML exports validate and match each other.
4. Wording: no "split", no British spellings, in any deliverable file.
"""
import json, os, re, sys
import yaml
from jsonschema import Draft202012Validator, FormatChecker

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(D, "tests")
fails = 0
def check(name, ok, detail=""):
    global fails
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else "\n     " + detail))
    fails += 0 if ok else 1

schema = json.load(open(os.path.join(D, "threat-model.schema.json")))
try:
    Draft202012Validator.check_schema(schema); check("schema is valid draft 2020-12", True)
except Exception as e:
    check("schema is valid draft 2020-12", False, str(e))
V = Draft202012Validator(schema, format_checker=FormatChecker())
def errors(doc): return ["%s: %s" % (list(e.path), e.message[:160]) for e in V.iter_errors(doc)]

examples = sorted(f[8:-5] for f in os.listdir(D) if f.startswith("example-") and f.endswith(".yaml"))
check("eleven examples are present", examples == ["case", "case-saas", "h2r", "i2r", "l2o", "o2c", "p2f", "p2p", "q2a", "r2f", "r2r"], str(examples))
for ex_id in examples:
    yx = yaml.safe_load(open(os.path.join(D, "example-%s.yaml" % ex_id)))
    jx = json.load(open(os.path.join(D, "example-%s.json" % ex_id)))
    check("example-%s YAML equals JSON" % ex_id, yx == jx)
    e = errors(yx); check("example-%s validates against the schema" % ex_id, not e, "; ".join(e[:5]))
    if ex_id != "o2c":
        check("example-%s overlay is off by default" % ex_id, yx["system"]["overlays_enabled"] == [])
        check("example-%s has L1-L5 components, a derived link and an overlay" % ex_id,
              {c["layer"] for c in yx["components"]} == {"L1", "L2", "L3", "L4", "L5"}
              and any(r.get("derived") for r in yx["relationships"])
              and len(yx.get("overlays") or []) == 1
              and all(o.get("verification", {}).get("status") == "unverified" for o in yx["obligations"]))

y = yaml.safe_load(open(os.path.join(D, "example-o2c.yaml")))
j = json.load(open(os.path.join(D, "example-o2c.json")))

import copy
bad_doc = copy.deepcopy(y); bad_doc["stakeholders"][0]["persona_id"] = "srf.role.ai-system-users"
check("a stakeholder with a persona_id is rejected (stakeholders are not personas)", bool(errors(bad_doc)))
bad_doc = copy.deepcopy(y); bad_doc["stakeholders"][0]["owner"] = {"status": "none"}
check("a stakeholder with an owner is rejected", bool(errors(bad_doc)))
bad_doc = copy.deepcopy(y); bad_doc["relationships"][0]["type"] = "association"
check("association is not a stored relationship type", bool(errors(bad_doc)))
bad_doc = copy.deepcopy(y); del bad_doc["relationships"][0]["type"]
check("a link without a type must be flagged unclassified", bool(errors(bad_doc)))
bad_doc["relationships"][0]["unclassified"] = True
check("an unclassified link may omit its type", not errors(bad_doc), "; ".join(errors(bad_doc)[:3]))
bad_doc = copy.deepcopy(y); bad_doc["components"][0]["versions"] = [{"version": "2", "set": {"persona_id": "x"}}]
check("a component version can only set component fields", bool(errors(bad_doc)))
check("example has snapshots, stakeholders, versions and candidate L4 types",
      len(y["snapshots"]) == 3 and len(y["stakeholders"]) == 6
      and any(c.get("versions") for c in y["components"]) and any(r.get("versions") for r in y["relationships"])
      and {"network", "edge_ot_host"} <= {c["type"] for c in y["components"]})

bad_doc = copy.deepcopy(y); d1 = next(r for r in bad_doc["relationships"] if r["id"] == "rel.d1"); del d1["derived_from"]
check("a derived link must list derived_from", bool(errors(bad_doc)))
bad_doc = copy.deepcopy(y); bad_doc["multiplicity_rules"] = [{"rule_id": "MD-99", "off": True}]
check("an override must name a default rule MD-01 to MD-05", bool(errors(bad_doc)))
bad_doc = copy.deepcopy(y); bad_doc["multiplicity_rules"] = [{"rule_id": "MD-04", "off": True, "reason": "test"}]
check("a model-wide multiplicity rule change validates", not errors(bad_doc), "; ".join(errors(bad_doc)[:3]))
bad_doc = copy.deepcopy(y); bad_doc["system"]["apqc_pcf"] = [{"number": "3.5.4", "element_id": "10185", "version": "v8.0", "name": "Manage sales orders", "match": "exact"}]
check("an APQC match value of exact is rejected", bool(errors(bad_doc)))
bad_doc["system"]["apqc_pcf"][0]["match"] = "partial"
check("an optional apqc_pcf row validates, and O2C has no APQC field", not errors(bad_doc) and "apqc_pcf" not in y["system"], "; ".join(errors(bad_doc)[:3]))
check("example has a derived link and a multiplicity override",
      any(r.get("derived") for r in y["relationships"]) and any(c.get("multiplicity_overrides") for c in y["components"]))

ej, ey = os.path.join(T, "out-export.json"), os.path.join(T, "out-export.yaml")
if os.path.exists(ej) and os.path.exists(ey):
    xj = json.load(open(ej)); xy = yaml.safe_load(open(ey))
    check("prototype YAML export parses and equals its JSON export", xj == xy)
    check("prototype export equals the example", xj == j)
    check("prototype export starts with the disclaimer", list(xj["system"].keys())[0] == "disclaimer" and open(ey).read().startswith("# Prototype. Every owner is a placeholder."))
    e = errors(xy); check("prototype export validates against the schema", not e, "; ".join(e[:5]))
else:
    check("export files exist (run test_cascade.js first)", False, "missing out-export.*")

bad = re.compile(r"\bsplit\w*|\bmodelling\b|\bbehaviour|\borganis|\blabelled\b|\bcolour|\bcentre\b|\banalyse\b", re.I)
for root, dirs, files in os.walk(D):
    dirs[:] = [d for d in dirs if d != "node_modules"]
    for f in files:
        if f.startswith("out-export") or f == "package-lock.json" or not f.endswith((".md", ".json", ".yaml", ".html", ".js", ".py")): continue
        p = os.path.join(root, f)
        if p == os.path.abspath(__file__): continue
        hits = [m.group(0) for m in bad.finditer(open(p, encoding="utf8").read())]
        check("wording check: " + os.path.relpath(p, D), not hits, ", ".join(sorted(set(hits))))

# Catalog agreement, status, and the control-ownership gap.
# The side is accountable.party, copied from data/threats.json accountable_party
# after checking that the catalog responsibility cells equal data/matrix.json.
# The target component's owner party is not the threat's side.
DATA = os.path.join(os.path.dirname(D), "..", "data")
cat = json.load(open(os.path.join(DATA, "threats.json")))
matrix = json.load(open(os.path.join(DATA, "matrix.json")))
check("threat count matches the rows", cat.get("count") == len(cat["threats"]) == 38, str(cat.get("count")))
from collections import Counter
_layers = Counter(t["srf_layer"] for t in cat["threats"])
check("threat layer_counts match the rows",
      cat.get("layer_counts") == {k: _layers[k] for k in ("L1", "L2", "L3", "L4", "L5")}
      == {"L1": 8, "L2": 7, "L3": 8, "L4": 8, "L5": 7},
      str(cat.get("layer_counts")))
by_cat = {t["id"]: t for t in cat["threats"]}
STATUS = {"verified", "placeholder", "proposed"}
EX_IDS = ["case", "case-saas", "h2r", "i2r", "l2o", "o2c", "p2f", "p2p", "q2a", "r2f", "r2r"]

def bare(pid):
    return (pid or "").replace("srf.role.", "")

def linked_owner_personas(model, threat):
    comps = {c["id"]: c for c in model["components"]}
    ctls = {c["id"]: c for c in model["controls"]}
    out = []
    for cid in threat.get("control_ids") or []:
        comp = comps[ctls[cid]["component_id"]]
        owner = comp.get("owner") or {}
        if owner.get("status") == "assigned":
            out.append(bare(owner.get("persona_id")))
    return out

verified_owners = 0
gap_rows = []
matched = 0
for ex_id in EX_IDS:
    model = json.load(open(os.path.join(D, "example-%s.json" % ex_id)))
    om = model["system"]["operating_model"]
    for comp in model["components"]:
        owners = [comp.get("owner")]
        for ver in comp.get("versions") or []:
            if "owner" in (ver.get("set") or {}):
                owners.append(ver["set"]["owner"])
        for owner in owners:
            st = owner.get("record_status")
            check("owner %s %s has a status" % (ex_id, comp["id"]), st in STATUS, str(st))
            if st == "verified":
                verified_owners += 1
                check("verified owner %s names approver and date" % comp["id"],
                      bool(owner.get("approved_by")) and bool(owner.get("approved_on")))
            if owner.get("placeholder") or owner.get("status") in ("none", "shared"):
                check("placeholder owner %s is not verified" % comp["id"], st != "verified", st)
    for obl in model["obligations"]:
        check("obligation %s %s has a status" % (ex_id, obl["id"]), obl.get("record_status") in STATUS)
        check("obligation %s stays placeholder" % obl["id"], obl.get("record_status") == "placeholder")
    for ctl in model["controls"]:
        for link in ctl.get("obligation_links") or []:
            check("obligation link %s %s has a status" % (ex_id, link.get("obligation_id")), link.get("record_status") in STATUS)
            check("obligation link stays placeholder", link.get("record_status") == "placeholder")
    for threat in model["threats"]:
        acc = threat.get("accountable") or {}
        check("accountable %s %s has a status" % (ex_id, threat["id"]), acc.get("record_status") in STATUS, str(acc.get("record_status")))
        if acc.get("record_status") == "verified":
            verified_owners += 1
        if acc.get("placeholder") or acc.get("status") in ("none", "shared"):
            check("placeholder accountable %s is not verified" % threat["id"], acc.get("record_status") != "verified")
        if threat.get("business_response_owner"):
            check("response owner %s has a status" % threat["id"], threat["business_response_owner"].get("record_status") in STATUS)
        check("no catalog_divergence on %s" % threat["id"], "catalog_divergence" not in threat)
        cid = threat.get("catalog_threat_id")
        if not cid:
            check("unchecked threat has no match status", "catalog_match_status" not in threat)
            continue
        matched += 1
        entry = by_cat[cid]
        cell = entry["accountability"][om]
        check("catalog responsibility matches the matrix for %s %s" % (ex_id, threat["id"]),
              matrix["cells"][entry["srf_layer"]][om] == cell["responsibility"])
        target = next(c for c in model["components"] if c["id"] == threat["target_component_id"])
        check("layer matches catalog %s %s" % (ex_id, threat["id"]), target["layer"] == entry["srf_layer"],
              "%s vs %s" % (target["layer"], entry["srf_layer"]))
        check("persona matches catalog %s %s" % (ex_id, threat["id"]), bare(acc.get("persona_id")) == cell["accountable_persona"],
              "%s vs %s" % (bare(acc.get("persona_id")), cell["accountable_persona"]))
        check("side matches catalog %s %s" % (ex_id, threat["id"]), acc.get("party") == cell["accountable_party"],
              "%s vs %s" % (acc.get("party"), cell["accountable_party"]))
        check("catalog match is proposed %s %s" % (ex_id, threat["id"]), threat.get("catalog_match_status") == "proposed")
        owns = cell["accountable_persona"] in linked_owner_personas(model, threat)
        flagged = threat.get("control_ownership_gap") is True
        check("gap flag matches ownership %s %s" % (ex_id, threat["id"]), flagged == (not owns),
              "flagged %s owns %s" % (flagged, owns))
        if flagged:
            gap_rows.append((ex_id, threat["id"], cell["accountable_persona"]))

check("35 catalog-matched threats were checked", matched == 35, str(matched))
check("verified owner count in examples is 0", verified_owners == 0, str(verified_owners))
check("ten control-ownership gaps, all thr.data-exposure",
      len(gap_rows) == 10 and all(tid == "thr.data-exposure" for _, tid, _ in gap_rows)
      and len({ex for ex, _, _ in gap_rows}) == 10,
      str(gap_rows))

design = open(os.path.join(D, "DESIGN.md"), encoding="utf8").read()
schema_text = open(os.path.join(D, "threat-model.schema.json"), encoding="utf8").read()
check("schema names ArchiMate 4 relationship types", "ArchiMate 4 relationship types" in schema_text)
check("schema no longer says ArchiMate 3.2 relationship types", "ArchiMate 3.2 relationship" not in schema_text)
check("the unverified v4 mark is gone from the schema and DESIGN.md",
      "not verified in v4" not in schema_text and "not verified in v4" not in design)
check("DESIGN.md records Bill's composition wording",
      "an element combines one or more other concepts, where the existence of those concepts depends on that of the element" in design.lower())
check("DESIGN.md cites Bill's November 18 sheet and his two groups",
      "2026-11-18-archimate4-check-sheet-bill-filled.md" in design
      and "Dependency relationship" in design and "Other relationship" in design)
check("association and specialization stay out of the schema enum",
      '"association"' not in schema_text and '"specialization"' not in schema_text)
check("derivation stays unchecked in DESIGN.md", "Whether v4 still allows derived relationships" in design)

ALLOWED = {"proposed", "placeholder"}
def status_problems(obj, where, out):
    if isinstance(obj, dict):
        for key in ("record_status", "catalog_match_status"):
            if key in obj and obj[key] not in ALLOWED:
                out.append("%s %s=%s" % (where, key, obj[key]))
        if obj.get("review_status") == "approved":
            out.append(where + " review_status approved")
        ver = obj.get("verification") or {}
        if ver and ver.get("status") != "unverified":
            out.append(where + " verification " + str(ver.get("status")))
        for k, v in obj.items():
            status_problems(v, where + "." + k, out)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            status_problems(v, where + "[%d]" % i, out)

for name in ("out-scoped-l2.json", "out-scoped-l5.json", "out-scoped-l5-saas.json"):
    path = os.path.join(T, name)
    if not os.path.exists(path):
        check(name + " exists (run test_cascade.js first)", False)
        continue
    doc = json.load(open(path))
    e = errors(doc)
    check(name + " validates", not e, "; ".join(e[:6]))
    problems = []
    status_problems(doc, name, problems)
    check(name + " statuses are Proposed or Placeholder, and obligations stay unverified", not problems, "; ".join(problems[:6]))
    missing = [t["id"] for t in doc["threats"] if t.get("catalog_threat_id") and t["catalog_threat_id"] not in by_cat]
    linked = [t["id"] for t in doc["threats"] if t.get("control_ids")]
    check(name + " threat ids exist and no threat-to-control link was stored on the threat", not missing and not linked, str(missing or linked))
    layer = doc["system"]["assessment_layer"]
    bad_layer = [c["id"] for c in doc["components"] if c.get("layer") in ("L1", "L3", "L4") or (not c.get("edge_actor") and c.get("layer") != layer)]
    check(name + " keeps in-layer components on " + layer + " and edge actors off L1 and L3", not bad_layer, str(bad_layer))
    rel_bad = [r["id"] for r in doc["relationships"] if r.get("type") == "realization" or r.get("cascade")]
    check(name + " has no cascade or realization links", not doc["relationships"] and not rel_bad, str(rel_bad))
    owners = []
    for ctl in doc["controls"]:
        acc = ctl.get("accountable") or {}
        count = 1 if acc.get("name") and acc.get("persona_id") and acc.get("status") not in ("none", "shared") else 0
        if acc.get("status") == "shared":
            count = max(2, len(acc.get("names") or []))
        if count != 1 or ctl.get("party") not in ("customer", "provider"):
            owners.append(ctl["id"])
        if ctl.get("record_status") == "verified" or acc.get("record_status") == "verified":
            owners.append(ctl["id"] + " verified")
    check(name + " gives each control exactly one owner and a customer or provider side", not owners, str(owners))
    row_ids = [r.get("catalog_threat_id") for r in doc.get("layer_results") or [] if r.get("catalog_threat_id")]
    check(name + " result threat ids exist", all(tid in by_cat for tid in row_ids), str(row_ids))
    if name == "out-scoped-l5-saas.json":
        pin = [c for c in doc["controls"] if c["id"] == "ctl.pin-version"][0]
        check("AI-SaaS L5 pin control is provider-side and names the attestation reliance",
              pin.get("party") == "provider" and pin.get("attestation_note") == "The customer relies on the provider's attestation."
              and "SOC" not in pin.get("attestation_note", "") and "ISO" not in pin.get("attestation_note", ""))
    if name == "out-scoped-l5.json":
        retire = [r for r in doc["layer_results"] if r["lifecycle_stage"] == "retire"][0]
        check("L5 retire row is Placeholder", retire.get("status") == "placeholder" and not retire.get("catalog_threat_id"))

print("\n%d failed" % fails)
sys.exit(1 if fails else 0)
