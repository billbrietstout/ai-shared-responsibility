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
  no_binding          control declares a measured threshold but no 800-53
                      binding yet (industry vertical controls; see below)

Per threshold control, the register records the best case across bindings
and whether the objective (target_value + window + error_budget) has any
place to live in the catalog. Output: gap-register.json (machine-readable)
and gap-register.md (NIST feedback draft).

Beyond the baseline threshold catalog, the register now covers the six
industry vertical control sets in data/*-controls.json (260 controls, each
with a threshold tuple). Vertical controls that declare
threshold.evidence.oscal_bindings are resolved against the catalog exactly
like baseline controls; controls without bindings are classified
`no_binding` and counted per vertical. Generative and agentic thresholds
should bind to the COSAiS overlays (NISTIR 8605B Generative AI, 8605D
Agentic AI) as those publish, since they are 800-53 overlays that carry
organization-defined parameters.

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


VERTICALS = ["finance", "public-sector", "healthcare", "insurance",
             "defense", "manufacturing"]


def load_vertical_controls():
    """Industry vertical controls from data/*-controls.json.

    Returns {vertical: [(control, source_file)]}. Each control carries a
    threshold tuple (metric, operator, param, window, breach_action) and may
    carry threshold.evidence.oscal_bindings; most do not yet.
    """
    out = {}
    data_dir = HERE.parent / "data"
    for v in VERTICALS:
        path = data_dir / f"{v}-controls.json"
        if not path.exists():
            continue
        doc = json.loads(path.read_text())
        out[v] = [(c, path.name) for c in doc.get("controls", [])]
    return out


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
    "no_binding": 5,
}

GAP_LABEL = {
    "cadence_only": "ODPs exist; can carry test/review cadence only",
    "untyped_odp": "ODPs exist but are untyped; cannot carry a measured objective",
    "no_odp": "control has no ODPs at all",
    "withdrawn": "control withdrawn in rev 5",
    "control_not_found": "no such control in the catalog",
    "no_binding": "measured threshold declared but no 800-53 binding proposed yet",
}


def classify_vertical_control(c, src_file, idx):
    """Build a register entry for one industry vertical control."""
    th = c.get("threshold", {})
    entry = {
        "id": c["id"],
        "title": c["title"],
        "srf_layer": c.get("layer"),
        "defined_in": src_file,
        "threshold": {
            "metric": th.get("metric"),
            "operator": th.get("operator"),
            "param": th.get("param"),
            "window": th.get("window"),
            "breach_action": th.get("breach_action"),
        },
        "bindings": [],
    }
    for b in th.get("evidence", {}).get("oscal_bindings", []):
        cid = b["control_id"]
        ctl = idx.get(cid)
        if ctl is None:
            gap, params, title = "control_not_found", [], None
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
    entry["best_case"] = min(
        (b["gap_class"] for b in entry["bindings"]),
        key=GAP_RANK.get, default="no_binding")
    entry["objective_can_bind"] = False
    return entry


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

    # Industry vertical sections (one per vertical, per the OSCAL vertical
    # mapping plan workstream C).
    register["verticals"] = {}
    for v, ctls in load_vertical_controls().items():
        entries = [classify_vertical_control(c, src, idx) for c, src in ctls]
        bound = [e for e in entries if e["bindings"]]
        register["verticals"][v] = {
            "source_file": ctls[0][1] if ctls else None,
            "control_count": len(entries),
            "with_bindings": len(bound),
            "without_bindings": len(entries) - len(bound),
            "oscal_profile": f"https://aisharedresponsibility.com/export/srf-{v}.profile.json",
            "controls": entries,
        }

    (HERE / "gap-register.json").write_text(json.dumps(register, indent=2) + "\n")
    (HERE / "gap-register.md").write_text(render_markdown(register))
    n_vert = sum(vd["control_count"] for vd in register["verticals"].values())
    print(f"wrote gap-register.json and gap-register.md "
          f"({len(register['controls'])} threshold controls, {n_vert} vertical "
          f"controls, catalog version {meta.get('version')})")


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
    w("## Findings by industry vertical")
    w("")
    w("The six industry vertical control sets (`data/*-controls.json`, also "
      "published as OSCAL profiles under `/export/`) each declare a measured "
      "threshold per control. This section records, per vertical, how many of "
      "those thresholds have a proposed 800-53 binding and classifies the "
      "bindings that exist. Controls without bindings are the backlog for the "
      "COSAiS overlay effort: generative and agentic thresholds should bind "
      "to NISTIR 8605B (Generative AI) and 8605D (Agentic AI) as those "
      "overlays publish, since both are 800-53 overlays that carry "
      "organization-defined parameters; predictive-AI thresholds map to "
      "8605A. Until then they are classified `no_binding` here rather than "
      "bound to invented anchors.")
    w("")
    for v, vd in reg.get("verticals", {}).items():
        w(f"### {v.replace('-', ' ').title()} ({vd['source_file']})")
        w("")
        w(f"{vd['control_count']} controls; {vd['with_bindings']} with 800-53 "
          f"bindings, {vd['without_bindings']} classified `no_binding`. OSCAL "
          f"profile: {vd['oscal_profile']}")
        w("")
        bound = [e for e in vd["controls"] if e["bindings"]]
        if bound:
            w("| Control | 800-53 binding | Gap class |")
            w("| --- | --- | --- |")
            for e in bound:
                for b in e["bindings"]:
                    w(f"| `{e['id']}` | `{b['control_id']}` | `{b['gap_class']}` |")
            w("")
        by_layer = {}
        for e in vd["controls"]:
            if not e["bindings"]:
                by_layer.setdefault(e["srf_layer"], []).append(e["id"])
        if by_layer:
            w("Unbound thresholds by layer: "
              + "; ".join(f"{layer}: {len(ids)}"
                          for layer, ids in sorted(by_layer.items())) + ".")
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
    w("3. **For the COSAiS overlay series (NISTIR 8605, 8605A-D):** the industry vertical "
      "sections above enumerate 260 measured thresholds with no 800-53 binding yet. Where an "
      "overlay control covers the same behavior (guardrail coverage, drift bounds, oversight "
      "responsiveness), the overlay's ODPs are the natural home for these objectives; typed "
      "measured-objective ODPs in 8605B (Generative AI) and 8605D (Agentic AI) would let the "
      "vertical OSCAL profiles bind directly as the overlays publish.")
    w("4. **For the AI RMF Critical Infrastructure profile:** each prioritized outcome could name "
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
