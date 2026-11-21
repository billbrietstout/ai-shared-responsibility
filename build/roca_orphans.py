#!/usr/bin/env python3
"""Report ROCA orphans. A chain is risk, obligation, control, accountable persona.

The links match tools/relationship-map/app.js (see the header comment and
citationsForControl). Report-only mode prints every break and fails only when
an orphan count is above thresholds/orphan-baseline.json, or the script errors.
Set mode to blocking in that file to fail when any orphan remains.

Gap-register rows are not excused. A control that is in
thresholds/gap-register.json and is also an orphan is counted and marked
"in gap register".
"""
from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from obligation_kind import citation_pattern, current_obligation

KINDS = ("risk", "obligation", "control", "persona")
CORE_LAYERS = ("L1", "L2", "L3", "L4", "L5")
PLACEHOLDER = re.compile(r"^\s*(TBD|N/?A|None|-)\b", re.I)

RISK_NO_OBLIGATION = "no obligation"
RISK_BAD_ID = "obligation id does not match a requirement"
RISK_NO_CONTROL = "no obligation reaches a control"
RISK_NO_PERSONA = "no obligation reaches a control with an accountable persona"
OBLIGATION_NO_RISK = "no risk links it"
OBLIGATION_NO_CONTROL = "reaches no control"
CONTROL_NO_RISK = "no risk"
CONTROL_NO_OBLIGATION = "no obligation"
CONTROL_NO_PERSONA = "no accountable persona"
PERSONA_NO_CHAIN = "accountable for no control in a complete chain"


def repo_root():
    return Path(__file__).resolve().parent.parent


def load_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def is_placeholder(value):
    """Same skip rule as citationsForControl in the relationship map."""
    if not isinstance(value, str) or not value.strip():
        return True
    return bool(PLACEHOLDER.search(value))


def layer_names(raw):
    if isinstance(raw, str) and raw.strip():
        return [raw.strip()]
    if isinstance(raw, list):
        names = [item.strip() for item in raw if isinstance(item, str) and item.strip()]
        if names:
            return names
    return ["none"]


def layer_sort_key(name):
    if name in CORE_LAYERS:
        return (0, CORE_LAYERS.index(name))
    if name == "none":
        return (2, name)
    return (1, name)


def empty_layer_counts():
    return {layer: 0 for layer in CORE_LAYERS}


def bump_layers(counts, layers):
    for layer in layers:
        counts[layer] = counts.get(layer, 0) + 1


def control_slug(path):
    name = path.name
    suffix = "-controls.json"
    if not name.endswith(suffix):
        raise ValueError(f"control file name does not end with {suffix}: {path.name}")
    return name[: -len(suffix)]


def cited_requirement_ids(control, regs_by_key, matchers):
    """Requirement ids citationsForControl would attach to this control.

    Instrument-level fallbacks are not requirements, so they are not returned.
    """
    seen = set()
    found = []
    mappings = control.get("mappings") or {}
    if not isinstance(mappings, dict):
        return found
    for key, citation in mappings.items():
        if key == "mapping_status_note" or is_placeholder(citation):
            continue
        reg = regs_by_key.get(key)
        if not reg or not current_obligation(reg):
            continue
        for matcher in matchers.get(reg["id"], []):
            req = matcher["req"]
            req_id = req["id"]
            if req_id in seen:
                continue
            if any(pattern.search(citation) for pattern in matcher["pats"]):
                seen.add(req_id)
                found.append(req_id)
    return found


def has_instrument_fallback(control, regs_by_key, matchers):
    """True when a current-obligation citation matches no requirement."""
    matched = set()
    mappings = control.get("mappings") or {}
    if not isinstance(mappings, dict):
        return False
    for key, citation in mappings.items():
        if key == "mapping_status_note" or is_placeholder(citation):
            continue
        reg = regs_by_key.get(key)
        if not reg or not current_obligation(reg):
            continue
        for matcher in matchers.get(reg["id"], []):
            if any(pattern.search(citation) for pattern in matcher["pats"]):
                matched.add(reg["id"])
                break
    for key, citation in mappings.items():
        if key == "mapping_status_note" or is_placeholder(citation):
            continue
        reg = regs_by_key.get(key)
        if not reg or not current_obligation(reg) or reg["id"] in matched:
            continue
        return True
    return False


def named_personas(control, known):
    found = []
    by_model = control.get("accountable_by_model") or {}
    if isinstance(by_model, dict):
        for value in by_model.values():
            if isinstance(value, str) and value.strip():
                found.append(value.strip())
    one = control.get("accountable_persona")
    if isinstance(one, str) and one.strip():
        found.append(one.strip())
    resolved = []
    for persona_id in found:
        if persona_id in known and persona_id not in resolved:
            resolved.append(persona_id)
    return resolved


def gap_register_keys(doc):
    keys = set()

    def take(entry, default_file):
        if not isinstance(entry, dict):
            return
        control_id = entry.get("id")
        if not isinstance(control_id, str) or not control_id:
            return
        filename = entry.get("defined_in") or default_file
        if isinstance(filename, str) and filename:
            keys.add((filename, control_id))

    for entry in doc.get("controls") or []:
        take(entry, None)
    common = doc.get("common") or {}
    if isinstance(common, dict):
        for entry in common.get("controls") or []:
            take(entry, common.get("source_file"))
    verticals = doc.get("verticals") or {}
    if isinstance(verticals, dict):
        for block in verticals.values():
            if not isinstance(block, dict):
                continue
            for entry in block.get("controls") or []:
                take(entry, block.get("source_file"))
    return keys


def load_inputs(root):
    root = Path(root)
    data = root / "data"
    required = [
        data / "threats.json",
        data / "moral-regulatory-hierarchy.json",
        data / "regulations.json",
        data / "personas.json",
    ]
    missing = [str(path.relative_to(root)) for path in required if not path.is_file()]
    if missing:
        raise ValueError("missing " + ", ".join(missing))
    control_paths = sorted(data.glob("*-controls.json"))
    if not control_paths:
        raise ValueError("missing data/*-controls.json")
    gap_path = root / "thresholds" / "gap-register.json"
    gap_doc = load_json(gap_path) if gap_path.is_file() else None
    return {
        "threats": load_json(required[0]),
        "requirements": load_json(required[1]),
        "regulations": load_json(required[2]),
        "personas": load_json(required[3]),
        "control_paths": control_paths,
        "gap_doc": gap_doc,
        "gap_found": gap_path.is_file(),
    }


def analyze(root):
    loaded = load_inputs(root)
    requirements = {}
    for req in loaded["requirements"].get("requirements") or []:
        if not isinstance(req, dict) or not req.get("id"):
            continue
        if req["id"] in requirements:
            raise ValueError(f"duplicate requirement id: {req['id']}")
        requirements[req["id"]] = req

    regs_by_key = {}
    for item in loaded["regulations"].get("items") or []:
        if isinstance(item, dict) and item.get("mapping_key"):
            regs_by_key[item["mapping_key"]] = item

    matchers = defaultdict(list)
    for req in requirements.values():
        if "citation_match" in req and req["citation_match"] is not None:
            tokens = req["citation_match"]
        else:
            tokens = [req.get("citation")]
        patterns = [citation_pattern(token) for token in tokens if token]
        matchers[req.get("instrument")].append({"req": req, "pats": patterns})

    personas = {}
    persona_doc = loaded["personas"]
    for record in (persona_doc.get("personas") or []) + (persona_doc.get("sector_specializations") or []):
        if not isinstance(record, dict) or not record.get("id"):
            continue
        if record["id"] in personas:
            raise ValueError(f"duplicate persona id: {record['id']}")
        personas[record["id"]] = record

    controls = []
    seen_full = set()
    for path in loaded["control_paths"]:
        doc = load_json(path)
        slug = control_slug(path)
        for control in doc.get("controls") or []:
            if not isinstance(control, dict) or not control.get("id"):
                continue
            full_id = f"srf.control.{slug}.{control['id']}"
            if full_id in seen_full:
                raise ValueError(f"duplicate control id: {full_id}")
            seen_full.add(full_id)
            controls.append({
                "id": control["id"],
                "full_id": full_id,
                "file": path.name,
                "layers": layer_names(control.get("layer")),
                "cited": cited_requirement_ids(control, regs_by_key, matchers),
                "instrument_fallback": has_instrument_fallback(control, regs_by_key, matchers),
                "personas": named_personas(control, personas),
            })

    by_full = {row["full_id"]: row for row in controls}
    gap_keys = gap_register_keys(loaded["gap_doc"]) if loaded["gap_doc"] else set()

    threats = []
    for threat in loaded["threats"].get("threats") or []:
        if isinstance(threat, dict) and threat.get("id"):
            threats.append(threat)

    risk_links = defaultdict(set)
    source_named = defaultdict(set)
    direct_risks = defaultdict(set)
    for threat in threats:
        for link in threat.get("obligations") or []:
            if not isinstance(link, dict):
                continue
            req_id = link.get("requirement")
            if not isinstance(req_id, str) or not req_id:
                continue
            risk_links[threat["id"]].add(req_id)
            rows = (link.get("source") or {}).get("controls") if isinstance(link.get("source"), dict) else None
            if not isinstance(rows, list):
                continue
            for row in rows:
                if isinstance(row, dict) and isinstance(row.get("control"), str) and row["control"]:
                    source_named[req_id].add(row["control"])
        for full_id in threat.get("related_controls") or []:
            if isinstance(full_id, str) and full_id:
                direct_risks[full_id].add(threat["id"])

    linked_requirements = set()
    for req_ids in risk_links.values():
        linked_requirements.update(req_id for req_id in req_ids if req_id in requirements)

    obligation_controls = defaultdict(set)
    for row in controls:
        for req_id in row["cited"]:
            obligation_controls[req_id].add(row["full_id"])
    for req_id, full_ids in source_named.items():
        if req_id not in requirements:
            continue
        for full_id in full_ids:
            if full_id in by_full:
                obligation_controls[req_id].add(full_id)

    for row in controls:
        reached = set(row["cited"])
        for req_id, full_ids in source_named.items():
            if req_id in requirements and row["full_id"] in full_ids:
                reached.add(req_id)
        row["obligations"] = reached
        row["direct"] = bool(direct_risks[row["full_id"]])
        row["transitive"] = any(req_id in linked_requirements for req_id in row["cited"])
        row["reaches_risk"] = row["direct"] or row["transitive"]
        row["in_gap_register"] = (row["file"], row["id"]) in gap_keys

    def control_has_persona(full_id):
        return bool(by_full[full_id]["personas"])

    def on_complete_chain(row, linked, direct, links, reqs, reached):
        """Risk, obligation, this control, and a persona form one chain.

        The citation path is the transitive control-to-risk link. The direct
        path is a risk that lists this control and links an obligation that
        reaches it.
        """
        if not row["personas"]:
            return False
        if any(req_id in linked for req_id in row["cited"]):
            return True
        for threat_id in direct[row["full_id"]]:
            for req_id in links[threat_id]:
                if req_id in reqs and row["full_id"] in reached.get(req_id, ()):
                    return True
        return False

    orphans = []

    for threat in threats:
        req_ids = [req_id for req_id in risk_links[threat["id"]] if req_id in requirements]
        missing = []
        if not risk_links[threat["id"]]:
            missing.append(RISK_NO_OBLIGATION)
        elif not req_ids:
            missing.append(RISK_BAD_ID)
        else:
            reached_controls = set()
            reached_with_persona = False
            for req_id in req_ids:
                for full_id in obligation_controls.get(req_id, ()):
                    reached_controls.add(full_id)
                    if control_has_persona(full_id):
                        reached_with_persona = True
            if not reached_with_persona:
                missing.append(RISK_NO_CONTROL if not reached_controls else RISK_NO_PERSONA)
        if missing:
            orphans.append({
                "type": "risk",
                "id": threat["id"],
                "layers": layer_names(threat.get("srf_layer")),
                "missing": missing,
                "in_gap_register": False,
            })

    controls_for_persona = defaultdict(set)
    for row in controls:
        missing = []
        if not row["reaches_risk"]:
            missing.append(CONTROL_NO_RISK)
        if not row["obligations"]:
            missing.append(CONTROL_NO_OBLIGATION)
        if not row["personas"]:
            missing.append(CONTROL_NO_PERSONA)
        if on_complete_chain(row, linked_requirements, direct_risks, risk_links, requirements, obligation_controls):
            for persona_id in row["personas"]:
                controls_for_persona[persona_id].add(row["full_id"])
        if missing:
            orphans.append({
                "type": "control",
                "id": row["full_id"],
                "layers": row["layers"],
                "missing": missing,
                "in_gap_register": row["in_gap_register"],
            })

    for req_id, req in requirements.items():
        missing = []
        if req_id not in linked_requirements:
            missing.append(OBLIGATION_NO_RISK)
        if not obligation_controls.get(req_id):
            missing.append(OBLIGATION_NO_CONTROL)
        if missing:
            orphans.append({
                "type": "obligation",
                "id": req_id,
                "layers": layer_names(req.get("srf_layers")),
                "missing": missing,
                "in_gap_register": False,
            })

    for persona_id, record in personas.items():
        if controls_for_persona.get(persona_id):
            continue
        orphans.append({
            "type": "persona",
            "id": persona_id,
            "layers": layer_names(record.get("srf_layers")),
            "missing": [PERSONA_NO_CHAIN],
            "in_gap_register": False,
        })

    counts = {}
    for kind in KINDS:
        layer_counts = empty_layer_counts()
        rows = [item for item in orphans if item["type"] == kind]
        for item in rows:
            bump_layers(layer_counts, item["layers"])
        counts[kind] = {"total": len(rows), "by_layer": layer_counts}

    direct = sum(1 for row in controls if row["direct"])
    transitive = sum(1 for row in controls if row["transitive"])
    in_both = sum(1 for row in controls if row["direct"] and row["transitive"])
    population = {
        "risk": len(threats),
        "obligation": len(requirements),
        "control": len(controls),
        "persona": len(personas),
    }
    breaks = []
    for kind in KINDS:
        tally = defaultdict(int)
        for item in orphans:
            if item["type"] != kind:
                continue
            for link in item["missing"]:
                tally[link] += 1
        for link, count in sorted(tally.items(), key=lambda pair: (-pair[1], pair[0])):
            breaks.append({"type": kind, "missing": link, "count": count})

    gap_orphans = {kind: 0 for kind in KINDS}
    for item in orphans:
        if item["in_gap_register"]:
            gap_orphans[item["type"]] += 1

    return {
        "population": population,
        "counts": counts,
        "control_to_risk": {
            "direct": direct,
            "transitive": transitive,
            "in_both_columns": in_both,
        },
        "orphans": orphans,
        "breaks": breaks,
        "gap_register_found": loaded["gap_found"],
        "gap_register_orphans": gap_orphans,
        "instrument_fallback_controls": sum(1 for row in controls if row["instrument_fallback"]),
        "not_in_related_controls": population["control"] - direct,
    }


def baseline_document(report):
    return {
        "mode": "report-only",
        "mode_note": (
            "report-only fails when an orphan count is above these counts. "
            "Set mode to blocking to fail when any orphan remains."
        ),
        "layer_count_note": (
            "An item is counted in each layer it names. The total counts the item once."
        ),
        "population": copy.deepcopy(report["population"]),
        "counts": copy.deepcopy(report["counts"]),
        "control_to_risk": {
            "direct": report["control_to_risk"]["direct"],
            "transitive": report["control_to_risk"]["transitive"],
            "in_both_columns": report["control_to_risk"]["in_both_columns"],
        },
        "gap_register_orphans": report["gap_register_orphans"]["control"],
    }


def _layer_pairs(counts):
    return sorted(counts.items(), key=lambda pair: layer_sort_key(pair[0]))


def compare(report, baseline, mode):
    """Return problem strings. Empty means the run may pass."""
    if mode not in ("report-only", "blocking"):
        raise ValueError(f"mode must be report-only or blocking, got {mode!r}")
    problems = []
    if mode == "blocking":
        for kind in KINDS:
            total = report["counts"][kind]["total"]
            if total:
                problems.append(f"blocking mode: {total} {kind} orphan{'s' if total != 1 else ''}")
    base_counts = baseline.get("counts")
    if not isinstance(base_counts, dict):
        raise ValueError("baseline is missing counts")
    for kind in KINDS:
        current = report["counts"][kind]
        recorded = base_counts.get(kind)
        if not isinstance(recorded, dict) or "total" not in recorded:
            raise ValueError(f"baseline is missing counts.{kind}.total")
        if current["total"] > recorded["total"]:
            problems.append(
                f"{kind} orphan count is {current['total']}, baseline is {recorded['total']}"
            )
        recorded_layers = recorded.get("by_layer") or {}
        if not isinstance(recorded_layers, dict):
            raise ValueError(f"baseline counts.{kind}.by_layer is not an object")
        for layer, count in _layer_pairs(current["by_layer"]):
            allowed = recorded_layers.get(layer, 0)
            if count > allowed:
                problems.append(
                    f"{kind} {layer} orphan count is {count}, baseline is {allowed}"
                )
    return problems


def render(report, mode=None, problems=None):
    lines = ["ROCA orphan check"]
    if mode:
        lines.append(f"Mode: {mode}")
    pop = report["population"]
    lines.append(
        "Population: "
        f"{pop['risk']} risks, {pop['obligation']} obligations, "
        f"{pop['control']} controls, {pop['persona']} personas"
    )
    orphan_bits = []
    for kind in KINDS:
        total = report["counts"][kind]["total"]
        noun = kind if total == 1 else kind + "s"
        orphan_bits.append(f"{total} {noun}")
    lines.append("Orphans: " + ", ".join(orphan_bits))
    link = report["control_to_risk"]
    lines.append(
        "Control-to-risk columns: "
        f"direct {link['direct']}, transitive {link['transitive']} "
        f"({link['in_both_columns']} in both columns)"
    )
    lines.append(
        f"Controls not in any related_controls: {report['not_in_related_controls']}"
    )
    lines.append(
        "Controls that cite a current obligation with no article match: "
        f"{report['instrument_fallback_controls']}"
    )
    if report["gap_register_found"]:
        lines.append(
            "Orphans marked in gap register: "
            f"{report['gap_register_orphans']['control']} controls"
        )
    else:
        lines.append("Gap register file not found. No line is marked in gap register.")
    lines.append("")
    lines.append("Orphan counts by type and layer")
    header = "type".ljust(12) + "".join(layer.rjust(6) for layer in CORE_LAYERS) + "total".rjust(8)
    lines.append(header)
    for kind in KINDS:
        block = report["counts"][kind]
        row = kind.ljust(12)
        for layer in CORE_LAYERS:
            row += str(block["by_layer"].get(layer, 0)).rjust(6)
        extra = [
            f"{layer} {count}"
            for layer, count in _layer_pairs(block["by_layer"])
            if layer not in CORE_LAYERS and count
        ]
        row += str(block["total"]).rjust(8)
        if extra:
            row += "  " + ", ".join(extra)
        lines.append(row)
    lines.append("")
    lines.append("Breaks")
    if not report["breaks"]:
        lines.append("  none")
    for item in report["breaks"]:
        lines.append(f"  {item['type']}: {item['missing']}: {item['count']}")
    lines.append("")
    grouped = defaultdict(list)
    for item in report["orphans"]:
        grouped[item["type"]].append(item)
    for kind in KINDS:
        rows = grouped.get(kind) or []
        title = kind[0].upper() + kind[1:]
        lines.append(title)
        if not rows:
            lines.append("  none")
            lines.append("")
            continue
        by_layer = defaultdict(list)
        for item in rows:
            for layer in item["layers"]:
                by_layer[layer].append(item)
        for layer in sorted(by_layer, key=layer_sort_key):
            lines.append(f"  {layer}")
            listed = sorted(by_layer[layer], key=lambda item: item["id"])
            for item in listed:
                flag = "; in gap register" if item["in_gap_register"] else ""
                links = "; ".join(item["missing"])
                lines.append(f"    {item['id']}: {links}{flag}")
        lines.append("")
    if problems is not None:
        if problems:
            lines.append("Result: failed")
            for problem in problems:
                lines.append(f"  {problem}")
        else:
            lines.append("Result: within baseline")
    return "\n".join(lines).rstrip() + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Report ROCA orphans.")
    parser.add_argument("--root", type=Path, default=repo_root(), help="repository root")
    parser.add_argument("--baseline", type=Path, default=None, help="baseline JSON path")
    parser.add_argument("--mode", choices=("report-only", "blocking"), default=None,
                        help="override the mode field in the baseline file")
    parser.add_argument("--print-baseline", action="store_true",
                        help="print a baseline document for the current data and exit")
    args = parser.parse_args(argv)
    try:
        report = analyze(args.root)
        if args.print_baseline:
            print(json.dumps(baseline_document(report), indent=2) + "\n", end="")
            return 0
        baseline_path = args.baseline or (args.root / "thresholds" / "orphan-baseline.json")
        if not baseline_path.is_file():
            raise ValueError(f"baseline not found: {baseline_path}")
        baseline = load_json(baseline_path)
        mode = args.mode or baseline.get("mode") or "report-only"
        problems = compare(report, baseline, mode)
    except (OSError, ValueError, json.JSONDecodeError, KeyError, TypeError) as exc:
        print(f"ROCA orphan check failed: {exc}", file=sys.stderr)
        return 2
    print(render(report, mode=mode, problems=problems), end="")
    recorded = baseline.get("control_to_risk") or {}
    current = report["control_to_risk"]
    for column in ("direct", "transitive"):
        recorded_value = recorded.get(column)
        if isinstance(recorded_value, int) and recorded_value != current[column]:
            print(
                f"Note: {column} control-to-risk column is {current[column]}. "
                f"The baseline records {recorded_value}. This note does not fail the run.",
                file=sys.stderr,
            )
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
