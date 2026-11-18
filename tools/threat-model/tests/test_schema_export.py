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
check("six examples are present (o2c, p2p, h2r, r2r, case, case-saas)", examples == ["case", "case-saas", "h2r", "o2c", "p2p", "r2r"], str(examples))
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
for root, _, files in os.walk(D):
    for f in files:
        if f.startswith("out-export") or not f.endswith((".md", ".json", ".yaml", ".html", ".js", ".py")): continue
        p = os.path.join(root, f)
        if p == os.path.abspath(__file__): continue
        hits = [m.group(0) for m in bad.finditer(open(p, encoding="utf8").read())]
        check("wording check: " + os.path.relpath(p, D), not hits, ", ".join(sorted(set(hits))))

print("\n%d failed" % fails)
sys.exit(1 if fails else 0)
