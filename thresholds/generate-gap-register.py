#!/usr/bin/env python3
"""Generate the OSCAL parameter gap register for the AI SRF threshold catalog.

Resolves each threshold control's oscal_bindings against the NIST SP 800-53
rev 5 OSCAL catalog and classifies, per binding, whether the catalog control
can carry the threshold's measured objective (target, comparison, window,
error budget).

Gap classes, per binding:
  control_not_found   binding's control_id does not resolve in the catalog
  withdrawn           control resolves but is withdrawn in rev 5
  no_odp              control has no parameters at all
  cadence_only        parameters exist; at least one can carry a review or
                      test frequency, but none can carry a numeric target,
                      evaluation window, or error budget
  untyped_odp         parameters exist but are freeform labels or fixed
                      selections; none can carry a measured objective

Per threshold control, the register records the best case across bindings
and whether the objective (target_value + window + error_budget) has any
place to live in the catalog. Output: gap-register.json (machine-readable)
and gap-register.md (NIST feedback draft).

Usage: python3 generate-gap-register.py [--catalog PATH]
If --catalog is omitted, the script downloads the rev 5 catalog JSON from
the source URI recorded in the threshold catalog and caches it in /tmp.
"""

import argparse
import datetime
import json
import pathlib
import re
import sys
import urllib.request

import yaml

HERE = pathlib.Path(__file__).resolve().parent
CACHE = pathlib.Path("/tmp/NIST_SP-800-53_rev5_catalog.json")

FREQ_RE = re.compile(r"frequenc|time period|how often|at least (annually|quarterly|monthly)", re.I)


def load_threshold_controls():
    """Baseline controls plus profile additions, with source file recorded."""
    controls = []
    base = yaml.safe_load((HERE / "examples/baseline-catalog.yaml").read_text())
    for c in base["controls"]:
        controls.append((c, "baseline-catalog.yaml"))
    for prof in sorted((HERE / "examples").glob("*.profile.yaml")):
        doc = yaml.safe_load(prof.read_text())
        for c in doc.get("additions", []):
            controls.append((c, prof.name))
    return controls


def get_catalog(path_arg, source_uri):
    if path_arg:
        return json.loads(pathlib.Path(path_arg).read_text())
    if not CACHE.exists():
        print(f"downloading catalog from {source_uri} ...", file=sys.stderr)
        with urllib.request.urlopen(source_uri, timeout=120) as r:
            CACHE.write_bytes(r.read())
    return json.loads(CACHE.read_text())


def index_catalog(catalog):
    """Flatten groups/controls/enhancements into {id: control}."""
    idx = {}

    def walk(node):
        for ctl in node.get("controls", []):
            idx[ctl["id"]] = ctl
            walk(ctl)
        for grp in node.get("groups", []):
            walk(grp)

    walk(catalog["catalog"])
    return idx


def is_withdrawn(ctl):
    return any(
        p.get("name") == "status" and p.get("value") == "withdrawn"
        for p in ctl.get("props", [])
    )


def param_text(param):
    bits = [param.get("label", "")]
    for g in param.get("guidelines", []):
        bits.append(g.get("prose", ""))
    sel = param.get("select", {})
    bits.extend(sel.get("choice", []))
    return " ".join(bits)


def classify_binding(ctl):
    """Classify one resolved catalog control against objective needs."""
    if is_withdrawn(ctl):
        return "withdrawn", []
    params = ctl.get("params", [])
    if not params:
        return "no_odp", []
    analyzed = []
    any_cadence = False
    for p in params:
        text = param_text(p)
        cadence = bool(FREQ_RE.search(text))
        any_cadence = any_cadence or cadence
        analyzed.append({
            "param_id": p.get("id"),
            "label": p.get("label") or (text[:80] if text else None),
            "has_selection": "select" in p,
            "cadence_capable": cadence,
        })
    # 800-53 rev 5 ODPs are untyped strings or fixed selections. None can
    # carry a numeric target with comparison, an evaluation window, or an
    # error budget, so the ceiling here is cadence_only.
    return ("cadence_only" if any_cadence else "untyped_odp"), analyzed


GAP_RANK = {  # lower is better
    "cadence_only": 0,
    "untyped_odp": 1,
    "no_odp": 2,
    "withdrawn": 3,
    "control_not_found": 4,
}

GAP_LABEL = {
    "cadence_only": "ODPs exist; can carry test/review cadence only",
    "untyped_odp": "ODPs exist but are untyped; cannot carry a measured objective",
    "no_odp": "control has no ODPs at all",
    "withdrawn": "control withdrawn in rev 5",
    "control_not_found": "no such control in the catalog",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", help="path to a local copy of the 800-53 rev5 OSCAL catalog JSON")
    args = ap.parse_args()

    controls = load_threshold_controls()

    # All bindings must agree on one source URI for this register
    sources = {
        b["source"]
        for c, _ in controls
        for b in c.get("evidence", {}).get("oscal_bindings", [])
    }
    if len(sources) != 1:
        sys.exit(f"expected exactly one OSCAL source across bindings, found {len(sources)}")
    source_uri = sources.pop()

    catalog = get_catalog(args.catalog, source_uri)
    idx = index_catalog(catalog)
    meta = catalog["catalog"]["metadata"]

    register = {
        "generated": datetime.date.today().isoformat(),
        "oscal_catalog": {
            "source": source_uri,
            "title": meta.get("title"),
            "version": meta.get("version"),
            "oscal_version": meta.get("oscal-version"),
        },
        "objective_fields_needing_a_home": [
            "objective.target_value", "objective.comparison", "objective.window",
            "objective.error_budget.budget", "objective.error_budget.burn_rate_alert_threshold",
        ],
        "controls": [],
    }

    for c, src_file in controls:
        entry = {
            "id": c["id"],
            "title": c["title"],
            "srf_layer": c["srf_layer"],
            "defined_in": src_file,
            "objective": c["objective"],
            "bindings": [],
        }
        for b in c.get("evidence", {}).get("oscal_bindings", []):
            cid = b["control_id"]
            ctl = idx.get(cid)
            if ctl is None:
                gap, params = "control_not_found", []
                title = None
            else:
                gap, params = classify_binding(ctl)
                title = ctl.get("title")
            entry["bindings"].append({
                "control_id": cid,
                "catalog_title": title,
                "rationale": b.get("rationale"),
                "gap_class": gap,
                "gap_note": GAP_LABEL[gap],
                "params": params,
            })
        best = min((b["gap_class"] for b in entry["bindings"]), key=GAP_RANK.get, default="control_not_found")
        entry["best_case"] = best
        entry["objective_can_bind"] = False  # true only if a typed ODP existed; none do in rev 5
        register["controls"].append(entry)

    (HERE / "gap-register.json").write_text(json.dumps(register, indent=2) + "\n")
    (HERE / "gap-register.md").write_text(render_markdown(register))
    print(f"wrote gap-register.json and gap-register.md "
          f"({len(register['controls'])} controls, catalog version {meta.get('version')})")


def render_markdown(reg):
    cat = reg["oscal_catalog"]
    lines = []
    w = lines.append
    w("# OSCAL Parameter Gap Register: AI SRF Threshold Controls vs NIST SP 800-53 rev 5")
    w("")
    w(f"Generated {reg['generated']} by `generate-gap-register.py` against {cat['title']}, "
      f"catalog version {cat['version']} (OSCAL {cat['oscal_version']}).")
    w("")
    w("## Purpose")
    w("")
    w("Each AI SRF threshold control declares candidate anchor controls in the 800-53 rev 5 "
      "catalog (`evidence.oscal_bindings`). This register asks one question per binding: could "
      "the catalog control's organization-defined parameters (ODPs) carry the threshold's "
      "measured objective, meaning a numeric target with comparison operator, an evaluation "
      "window, and an error budget with burn-rate alerting? Where the answer is no, the gap is "
      "classified. The register is intended as implementation-grounded feedback for the NIST "
      "SP 800-53 Control Overlays for Securing AI Systems effort and, for the structural "
      "findings, the OSCAL models themselves.")
    w("")
    w("## Gap classes")
    w("")
    w("| Class | Meaning |")
    w("| --- | --- |")
    for k in ["cadence_only", "untyped_odp", "no_odp", "withdrawn", "control_not_found"]:
        w(f"| `{k}` | {GAP_LABEL[k]} |")
    w("")
    w("## Findings by threshold control")
    w("")
    for e in reg["controls"]:
        obj = e["objective"]
        eb = obj.get("error_budget", {})
        w(f"### {e['id']}: {e['title']}")
        w("")
        w(f"Layer `{e['srf_layer']}`, defined in `{e['defined_in']}`. Objective: indicator "
          f"{obj['comparison']} {obj['target_value']} over {obj['window']}, "
          f"error budget {eb.get('budget', 'n/a')}"
          + (f", burn-rate alert at {eb['burn_rate_alert_threshold']}x"
             if eb.get("burn_rate_alert_threshold") else "") + ".")
        w("")
        w("| 800-53 binding | Catalog control | ODPs | Gap class |")
        w("| --- | --- | --- | --- |")
        for b in e["bindings"]:
            odps = ", ".join(f"`{p['param_id']}`" + (" (cadence)" if p["cadence_capable"] else "")
                             for p in b["params"]) or "none"
            w(f"| `{b['control_id']}` | {b['catalog_title'] or 'NOT FOUND'} | {odps} | `{b['gap_class']}` |")
        w("")
        w(f"Best case across bindings: `{e['best_case']}`. Objective can bind to an ODP: "
          f"**{'yes' if e['objective_can_bind'] else 'no'}**.")
        w("")
    w("## Summary finding")
    w("")
    n = len(reg["controls"])
    resolved = sum(1 for e in reg["controls"]
                   if all(b["gap_class"] not in ("control_not_found", "withdrawn") for b in e["bindings"]))
    w(f"Of {n} threshold controls, {resolved} resolve to live anchor controls in rev 5; the "
      "catalog's breadth is not the problem. The gap is uniformly one of parameter typing: no "
      "rev 5 ODP can express a measured objective. The best any binding achieves is "
      "`cadence_only`, where a frequency ODP can carry how often something is reviewed or "
      "tested but not what value it must hold, over what window, with what tolerated shortfall.")
    w("")
    w("## Proposed feedback")
    w("")
    w("1. **For the AI overlay (SP 800-53 Control Overlays for Securing AI Systems):** where an "
      "overlay control governs continuously measurable AI behavior (inventory coverage, "
      "guardrail coverage at inference, override responsiveness, attestation currency, drift "
      "within declared bounds), define ODPs structured as measured objectives rather than "
      "freeform strings: target value, comparison, evaluation window, and tolerated shortfall. "
      "The `objective` object of the AI SRF threshold schema is a candidate shape.")
    w("2. **For OSCAL:** parameters currently admit labels, guidelines, and fixed selections. A "
      "typed parameter constraint (numeric with unit and window semantics) would let profiles "
      "carry operational thresholds natively, and would let a resolved threshold emit "
      "`set-parameter` values that provably match the live alerting configuration.")
    w("3. **For the AI RMF Critical Infrastructure profile:** each prioritized outcome could name "
      "the measurable indicator that would make it auditable. The healthcare drift control "
      "(AISRF-MODEL-002) is a worked example of a profile-driven addition with a concrete SLI "
      "bound to `ca-7`, whose `ca-07_odp.01` (system-level metrics) is exactly the right hook "
      "but is untyped today.")
    w("")
    w("---")
    w("")
    w("*Regenerate with `python3 generate-gap-register.py`. Machine-readable form: "
      "`gap-register.json`.*")
    w("")
    return "\n".join(lines)


if __name__ == "__main__":
    main()
