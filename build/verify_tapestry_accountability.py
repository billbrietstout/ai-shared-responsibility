#!/usr/bin/env python3
"""Verify data/tapestry-controls.json against its own declared rules.

The Tapestry control set carries three invariants that no other schema on this
site needs, because no other schema describes a federation of peers:

  1. Domain-to-persona agreement. Every control names an accountability_domain
     (shared-commons or sovereign-assets). The accountable_persona must equal the
     value data/layers.json records in that layer's federated_consortium_split
     for that domain. This is what connects the control set to the
     Federated-Consortium operating model instead of leaving the split as a
     field nothing reads.

  2. The tier selection rule. A sovereign-asset control that does not bear on the
     Shared Commons is capped at contractual-representation, because demanding
     more of a purely local matter is capture of participants. Every other
     control has a floor set by its property_class, measured on the
     verification_strength axis declared in the file.

  3. Identifier honesty. The stage code in a control id must match its
     lifecycle_stage, and components must be real components of their layer.

Usage: python3 build/verify_tapestry_accountability.py [--root PATH]
Exit status is non-zero when any check fails.
"""

import argparse
import json
import pathlib
import sys

STAGE_CODES = {
    "CON": "contribution",
    "EVL": "evaluation",
    "INT": "integration",
    "MON": "monitoring",
    "CRT": "certification",
    "EXT": "exit",
}

CEILING_TIER = "contractual-representation"


class Report:
    def __init__(self):
        self.failures = 0

    def check(self, ok, label, detail=""):
        if ok:
            print(f"ok    {label}")
        else:
            self.failures += 1
            print(f"FAIL  {label}" + (f" ({detail})" if detail else ""))
        return ok


def load(root, name):
    with open(root / "data" / name, encoding="utf-8") as fh:
        return json.load(fh)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=None)
    args = ap.parse_args()
    root = pathlib.Path(args.root) if args.root else \
        pathlib.Path(__file__).resolve().parent.parent

    tap = load(root, "tapestry-controls.json")
    layers = load(root, "layers.json")
    personas = load(root, "personas.json")
    regulations = load(root, "regulations.json")
    jurisdictions = load(root, "jurisdictions.json")

    r = Report()

    layer_by_id = {l["id"]: l for l in layers["layers"]}
    persona_ids = {p["id"] for p in personas["personas"]}
    reg_by_id = {x["id"]: x for x in regulations["items"]}
    juris_ids = {j["id"] for j in jurisdictions["jurisdictions"]}

    tiers = {t["id"]: t for t in tap["disclosure_tiers"]}
    strength = {t["id"]: t["verification_strength"] for t in tap["disclosure_tiers"]}
    classes = tap["property_classes"]
    statuses = set(tap["implementation_status_values"])
    domains = {k: v for k, v in tap["accountability_domains"].items()
               if isinstance(v, dict)}
    stages = set(tap["lifecycle_stages"])
    controls = tap["controls"]

    # ── tier table integrity ────────────────────────────────────────────────
    r.check(sorted(strength.values()) == [1, 2, 3, 4, 5],
            "verification_strength covers 1-5 with no ties",
            str(sorted(strength.values())))
    breadth = sorted(t["disclosure_breadth"] for t in tap["disclosure_tiers"])
    r.check(breadth == [1, 2, 3, 4, 5],
            "disclosure_breadth covers 1-5 with no ties", str(breadth))
    r.check(strength.get(CEILING_TIER) == 1,
            "the anti-capture ceiling tier is the weakest tier")

    bad = [c for c in classes.values() if c["minimum_tier"] not in tiers]
    r.check(not bad, "every property_class minimum_tier is a real tier",
            str([c["minimum_tier"] for c in bad]))

    # The frontier claim in the file is load-bearing for its recommendations,
    # so it is checked rather than asserted.
    dominated = []
    for a in tap["disclosure_tiers"]:
        for b in tap["disclosure_tiers"]:
            if a["id"] == b["id"]:
                continue
            if (b["verification_strength"] > a["verification_strength"]
                    and b["disclosure_breadth"] < a["disclosure_breadth"]):
                dominated.append(a["id"])
                break
    r.check(set(dominated) == {"consortium-confidential", "independent-attestation"},
            "the dominated tiers are the two the frontier note names",
            str(sorted(set(dominated))))

    # ── renames resolve ─────────────────────────────────────────────────────
    ids = [c["id"] for c in controls]
    renames = {k: v for k, v in tap["renamed_from"].items() if k != "note"}
    missing = [v for v in renames.values() if v not in ids]
    r.check(not missing, "every renamed_from target exists", str(missing))

    r.check(len(ids) == len(set(ids)), "control ids are unique",
            str([i for i in ids if ids.count(i) > 1]))
    r.check(len(controls) == int(tap["coverage_note"].split()[0]),
            "coverage_note control count matches the catalog",
            f"{len(controls)} controls")

    # ── per-control checks ──────────────────────────────────────────────────
    id_shape, comp, dom_persona, floors, ceilings = [], [], [], [], []
    tier_class, statuses_bad, stage_bad, om_bad, jb_bad, ceil_note = \
        [], [], [], [], [], []

    for c in controls:
        cid = c["id"]
        parts = cid.split("-")
        if len(parts) != 5 or parts[0] != "TAP" or parts[1] != "SRF":
            id_shape.append(cid)
            continue
        layer, stage_code = parts[2], parts[3]
        if layer != c["layer"] or STAGE_CODES.get(stage_code) != c.get("lifecycle_stage"):
            id_shape.append(cid)

        if c.get("lifecycle_stage") not in stages:
            stage_bad.append(cid)

        L = layer_by_id.get(c["layer"])
        if not L or c["component"] not in L["components"]:
            comp.append(f"{cid}:{c['component']}")

        if c.get("implementation_status") not in statuses:
            statuses_bad.append(cid)

        if c.get("operating_models") != ["Federated-Consortium"] or \
                "Federated-Consortium" not in (L or {}).get("operating_models", {}):
            om_bad.append(cid)

        # 1. domain-to-persona agreement against layers.json
        domain = c.get("accountability_domain")
        split = (L or {}).get("federated_consortium_split", {})
        expected = split.get(
            "shared_commons" if domain == "shared-commons" else "sovereign_assets")
        if domain not in domains or c.get("accountable_persona") != expected:
            dom_persona.append(f"{cid}:{c.get('accountable_persona')}!={expected}")
        if c.get("accountable_persona") not in persona_ids:
            dom_persona.append(f"{cid}:unknown-persona")

        # 2. the tier selection rule
        tier = c["threshold"]["disclosure_tier"]
        pclass = c.get("property_class")
        if tier not in tiers or pclass not in classes:
            tier_class.append(cid)
            continue
        capped = domain == "sovereign-assets" and not c.get("bears_on_commons")
        if capped:
            if strength[tier] > strength[CEILING_TIER]:
                ceilings.append(f"{cid}:{tier}")
            if not c.get("tier_ceiling_note"):
                ceil_note.append(cid)
        else:
            floor = classes[pclass]["minimum_tier"]
            if strength[tier] < strength[floor]:
                floors.append(f"{cid}:{tier}<{floor}")
            if pclass not in tiers[tier]["verifies"]:
                tier_class.append(f"{cid}:{tier} cannot verify {pclass}")

        # 3. jurisdiction bindings resolve through the regulation catalog
        jb = c.get("jurisdiction_binding")
        if jb:
            for inst in jb.get("example_instruments", []):
                if inst not in reg_by_id:
                    jb_bad.append(f"{cid}:{inst}")
                elif reg_by_id[inst].get("jurisdiction") not in juris_ids:
                    jb_bad.append(f"{cid}:{inst}-jurisdiction")

    r.check(not id_shape, "control id layer and stage code match their fields",
            str(id_shape))
    r.check(not stage_bad, "lifecycle_stage is a declared stage", str(stage_bad))
    r.check(not comp, "component is a real component of its layer", str(comp))
    r.check(not statuses_bad, "implementation_status is a declared value",
            str(statuses_bad))
    r.check(not om_bad, "operating_models is Federated-Consortium and layers.json agrees",
            str(om_bad))
    r.check(not dom_persona,
            "accountable_persona matches the layer's federated_consortium_split",
            str(dom_persona))
    r.check(not ceilings,
            "purely sovereign controls stay at or below the anti-capture ceiling",
            str(ceilings))
    r.check(not ceil_note,
            "every ceiling-capped control explains the cap in tier_ceiling_note",
            str(ceil_note))
    r.check(not floors, "commons-bearing controls meet their property_class floor",
            str(floors))
    r.check(not tier_class, "the chosen tier can verify the control's property class",
            str(tier_class))
    r.check(not jb_bad, "jurisdiction_binding instruments resolve in the catalog",
            str(jb_bad))

    # ── L3 has no shared commons, so no control may claim one ───────────────
    l3_commons = [c["id"] for c in controls
                  if c["layer"] == "L3" and c.get("accountability_domain") == "shared-commons"]
    r.check(not l3_commons,
            "no L3 control claims a Shared Commons owner, which layers.json marks N/A",
            str(l3_commons))

    open_count = sum(1 for c in controls
                     if c.get("implementation_status") != "resolved-in-source")
    bad_notes = [c["id"] for c in controls
                 if c.get("implementation_status") != "resolved-in-source"
                 and not c.get("implementation_status_note")]
    r.check(not bad_notes,
            "every open or conflicted control says why in implementation_status_note",
            str(bad_notes))

    print()
    print(f"controls: {len(controls)}  open-or-conflicted: {open_count}  "
          f"shared-commons: {sum(1 for c in controls if c['accountability_domain'] == 'shared-commons')}  "
          f"sovereign-assets: {sum(1 for c in controls if c['accountability_domain'] == 'sovereign-assets')}")
    print(("PASSED" if not r.failures else "FAILED") + f": {r.failures} failure(s).")
    return 1 if r.failures else 0


if __name__ == "__main__":
    sys.exit(main())
