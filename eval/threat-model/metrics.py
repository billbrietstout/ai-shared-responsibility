"""Shared scoring helpers for AI diagram threat-model evaluation."""
from __future__ import annotations

import json
import re
from pathlib import Path

STRIDE = list("STRIDE")
PHANTOM = ["P", "H", "A", "N", "T", "O", "M", "B"]
CIA = list("CIA")
ACTIONS = {"mitigate", "eliminate", "transfer", "accept"}
LAYERS = {"L1", "L2", "L3", "L4", "L5"}
PARTIES = {"customer", "provider"}
FORMATS = ("image", "mermaid", "svg")
SLUGS = {
    "directpromptinjection",
    "indirectpromptinjection",
    "evasion",
    "runtimemodelpoison",
    "devmodelpoison",
    "datapoison",
    "supplymodelpoison",
    "disclosureinoutput",
    "modelinversionandmembership",
    "devdataleak",
    "modelexfiltration",
    "runtimemodelleak",
    "devmodelleak",
    "airesourceexhaustion",
    "inputdataleak",
    "outputcontainsconventionalinjection",
}


def norm(token: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (token or "").lower()).strip("-")


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def gold_systems(gold_dir: Path) -> dict:
    out = {}
    for inv in sorted(gold_dir.glob("*/inventory.json")):
        data = load_json(inv)
        out[data["system_id"]] = data
    return out


def inventory_index(inv: dict) -> dict:
    """Map normalized id and name to canonical id."""
    index = {}
    for key in ("components", "external_actors", "data_stores"):
        for item in inv.get(key, []):
            cid = item["id"]
            index[norm(cid)] = cid
            index[norm(item.get("name", ""))] = cid
    for flow in inv.get("data_flows", []):
        index[norm(flow["id"])] = flow["id"]
        if flow.get("label"):
            index[norm(flow["label"])] = flow["id"]
    for bound in inv.get("trust_boundaries", []):
        index[norm(bound["id"])] = bound["id"]
        index[norm(bound.get("name", ""))] = bound["id"]
    return index


def resolve(token: str, index: dict) -> str | None:
    if not token:
        return None
    if token in index.values():
        return token
    return index.get(norm(token))


def id_set(inv: dict, key: str) -> set[str]:
    if key == "llm_components":
        return {norm(x) for x in inv.get("llm_components", [])}
    return {norm(item["id"]) for item in inv.get(key, [])}


def prf(predicted: set, gold: set) -> dict:
    tp = len(predicted & gold)
    fp = len(predicted - gold)
    fn = len(gold - predicted)
    prec = tp / (tp + fp) if (tp + fp) else 1.0
    rec = tp / (tp + fn) if (tp + fn) else 1.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    return {
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "gold_n": len(gold),
        "pred_n": len(predicted),
    }


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


def inventory_fidelity(pred_inv: dict, gold_inv: dict) -> dict:
    keys = [
        "components",
        "external_actors",
        "data_stores",
        "data_flows",
        "trust_boundaries",
        "llm_components",
    ]
    scores = {k: prf(id_set(pred_inv, k), id_set(gold_inv, k)) for k in keys}
    f1s = [v["f1"] for v in scores.values()]
    scores["macro_f1"] = round(sum(f1s) / len(f1s), 4) if f1s else 0.0
    return scores


def referent_set(matrix: dict) -> set[str]:
    return {norm(t.get("diagram_referent", "")) for t in matrix.get("threats", []) if t.get("diagram_referent")}


def inventory_id_universe(inv: dict) -> set[str]:
    ids = set()
    for key in ("components", "external_actors", "data_stores", "data_flows", "trust_boundaries"):
        ids |= id_set(inv, key)
    return ids


def schema_issues(matrix: dict, schema_required=True) -> list[str]:
    issues = []
    for field in (
        "system_name",
        "perspective",
        "representation",
        "inventory",
        "solution_description",
        "llm_subset",
        "llm_subset_empty",
        "stride_coverage",
        "phantom_coverage",
        "threats",
        "qa",
    ):
        if field not in matrix:
            issues.append(f"missing {field}")
    inv = matrix.get("inventory") or {}
    universe = inventory_id_universe(inv)
    index = inventory_index(inv)
    action_point_ids = set()
    for key in ("components", "data_stores", "data_flows", "trust_boundaries"):
        action_point_ids |= id_set(inv, key)

    llm_subset = matrix.get("llm_subset") or []
    llm_subset_empty = matrix.get("llm_subset_empty")
    if not isinstance(llm_subset_empty, bool):
        issues.append("llm_subset_empty missing or not boolean")
    elif llm_subset_empty != (len(llm_subset) == 0):
        issues.append("llm_subset_empty does not match llm_subset")

    qa = matrix.get("qa") or {}
    if qa.get("llm_subset_empty") != llm_subset_empty:
        issues.append("qa.llm_subset_empty does not match root")
    phantom_complete = qa.get("phantom_b_complete")
    if llm_subset_empty is True and phantom_complete is not None:
        issues.append("qa.phantom_b_complete must be null for empty llm_subset")
    if llm_subset_empty is False and not isinstance(phantom_complete, bool):
        issues.append("qa.phantom_b_complete must be boolean for non-empty llm_subset")

    absences = matrix.get("control_absences") or []
    absence_ids = {row.get("id") for row in absences if row.get("id")}
    for row in absences:
        aid = row.get("id", "control-absence")
        ref = row.get("expected_referent")
        if norm(ref) not in action_point_ids:
            issues.append(f"{aid}: expected_referent {ref!r} not in inventory")
        observation = str(row.get("observation") or "").lower()
        if not any(
            phrase in observation
            for phrase in ("not shown", "does not show", "not drawn", "does not draw")
        ):
            issues.append(f"{aid}: observation does not state diagram limitation")

    for row in matrix.get("existing_controls") or []:
        cid = row.get("id", "existing-control")
        ref = row.get("diagram_referent")
        if not resolve(ref, index) and norm(ref) not in universe:
            issues.append(f"{cid}: diagram_referent {ref!r} not in inventory")
        coverage_refs = row.get("coverage_referents")
        if not isinstance(coverage_refs, list):
            issues.append(f"{cid}: missing coverage_referents")
        else:
            for coverage_ref in coverage_refs:
                if (
                    not resolve(coverage_ref, index)
                    and norm(coverage_ref) not in universe
                ):
                    issues.append(
                        f"{cid}: coverage referent {coverage_ref!r} not in inventory"
                    )
        if row.get("coverage_basis") not in {
            "connected",
            "contained",
            "label_only",
            "badge_only",
            "unknown",
        }:
            issues.append(f"{cid}: bad coverage_basis")

    for i, threat in enumerate(matrix.get("threats", [])):
        tid = threat.get("id", f"index-{i}")
        if not re.fullmatch(r"T[0-9]+", str(tid or "")):
            issues.append(f"{tid}: id must match T[0-9]+")
        ref = threat.get("diagram_referent")
        if not ref:
            issues.append(f"{tid}: missing diagram_referent")
        elif not resolve(ref, index) and norm(ref) not in universe:
            issues.append(f"{tid}: diagram_referent {ref!r} not in inventory")
        if not (threat.get("scenario") or "").strip():
            issues.append(f"{tid}: empty scenario")
        action = threat.get("action") or {}
        if action.get("type") not in ACTIONS:
            issues.append(f"{tid}: action.type {action.get('type')!r} not allowed")
        if action.get("type") in {"mitigate", "eliminate"}:
            control_point = action.get("control_point")
            if norm(control_point) not in action_point_ids:
                issues.append(
                    f"{tid}: control_point {control_point!r} not actionable inventory id"
                )
            validation = action.get("validation") or {}
            if validation.get("kind") not in {"test", "log", "fail_condition"}:
                issues.append(f"{tid}: missing action validation")
        for evidence_ref in threat.get("evidence_refs") or []:
            if evidence_ref not in absence_ids:
                issues.append(f"{tid}: evidence_ref {evidence_ref!r} not found")
        for letter in threat.get("stride") or []:
            if letter not in STRIDE:
                issues.append(f"{tid}: bad STRIDE letter {letter}")
        for letter in threat.get("phantom_b") or []:
            if letter not in PHANTOM:
                issues.append(f"{tid}: bad PHANTOM-B letter {letter}")
        for letter in threat.get("cia") or []:
            if letter not in CIA:
                issues.append(f"{tid}: bad CIA letter {letter}")
        srf = threat.get("srf")
        if srf:
            if srf.get("layer") not in (None, *LAYERS):
                issues.append(f"{tid}: bad srf.layer {srf.get('layer')}")
            if srf.get("party") == "shared":
                issues.append(f"{tid}: srf.party is shared")
            if srf.get("party") not in (None, *PARTIES):
                issues.append(f"{tid}: bad srf.party {srf.get('party')}")
            slug = (srf.get("join") or {}).get("ai_exchange_slug")
            if slug and slug not in SLUGS:
                issues.append(f"{tid}: invented ai_exchange_slug {slug}")

    stride_coverage = matrix.get("stride_coverage")
    if not isinstance(stride_coverage, dict):
        issues.append("stride_coverage missing")
    else:
        expected = {norm(x) for x in stride_coverage.get("expected_elements", [])}
        considered = {
            norm(x) for x in stride_coverage.get("considered_elements", [])
        }
        remaining = {
            norm(x) for x in stride_coverage.get("remaining_elements", [])
        }
        if stride_coverage.get("complete") is not True:
            issues.append("stride_coverage incomplete")
        if remaining:
            issues.append("stride_coverage has remaining elements")
        if not expected.issubset(considered):
            issues.append("stride_coverage expected elements not all considered")
        by_element: dict[str, set[str]] = {}
        consideration_keys = []
        for row in matrix.get("stride_considerations") or []:
            element_id = norm(row.get("element_id"))
            letter = row.get("letter")
            consideration_keys.append((element_id, letter))
            by_element.setdefault(element_id, set()).add(letter)
        if len(consideration_keys) != len(set(consideration_keys)):
            issues.append("stride_considerations contains duplicate element/letter rows")
        for element_id in expected:
            if by_element.get(element_id, set()) != set(STRIDE):
                issues.append(f"stride letters incomplete: {element_id}")
        expected_rows = (len(expected) * len(STRIDE)) + len(
            matrix.get("replica_coverage") or []
        )
        if stride_coverage.get("rows_expected") != expected_rows:
            issues.append("stride_coverage rows_expected is inconsistent")
        if stride_coverage.get("rows_written_total") != len(consideration_keys):
            issues.append("stride_coverage rows_written_total is inconsistent")

    phantom_coverage = matrix.get("phantom_coverage")
    if not isinstance(phantom_coverage, dict):
        issues.append("phantom_coverage missing")
    elif llm_subset_empty is True:
        if phantom_coverage.get("status") != "not_applicable":
            issues.append("phantom_coverage must be not_applicable for empty subset")
    elif phantom_coverage.get("status") not in {"complete", "incomplete"}:
        issues.append("phantom_coverage status invalid")

    threats_by_id = {
        row.get("id"): row for row in matrix.get("threats") or [] if row.get("id")
    }
    for row in matrix.get("replica_coverage") or []:
        representative_id = row.get("representative_id")
        replica_id = row.get("replica_id")
        if norm(representative_id) not in universe or norm(replica_id) not in universe:
            issues.append(
                f"replica component missing: {representative_id} -> {replica_id}"
            )
        for pair in row.get("inherited_element_pairs") or []:
            if (
                norm(pair.get("representative_id")) not in universe
                or norm(pair.get("replica_id")) not in universe
            ):
                issues.append("replica inherited element missing")
        divergence_id = row.get("divergence_threat_id")
        divergence = threats_by_id.get(divergence_id)
        if not divergence or norm(divergence.get("diagram_referent")) != norm(
            replica_id
        ):
            issues.append(f"replica divergence threat missing: {replica_id}")

    review_order = matrix.get("review_order")
    if review_order:
        review_ids = [row.get("threat_id") for row in review_order]
        if len(review_ids) != len(set(review_ids)):
            issues.append("review_order contains duplicate threat ids")
        if set(review_ids) != set(threats_by_id):
            issues.append("review_order does not contain every threat id")

    chain_meta = matrix.get("chain_meta") or {}
    if chain_meta and chain_meta.get("prompt_pack_version") != "2.0":
        issues.append("chain_meta.prompt_pack_version is not 2.0")
    return issues


def coverage(matrix: dict, gold_inv: dict) -> dict:
    llm = [norm(x) for x in (matrix.get("llm_subset") or gold_inv.get("llm_components") or [])]
    threats = matrix.get("threats") or []
    by_ref = {}
    for t in threats:
        by_ref.setdefault(norm(t.get("diagram_referent", "")), []).append(t)
    phantom_complete = 0
    phantom_total = max(len(llm), 1) if gold_inv.get("llm_components") else 0
    for cid in [norm(x) for x in gold_inv.get("llm_components", [])]:
        letters = set()
        for t in by_ref.get(cid, []):
            letters.update(t.get("phantom_b") or [])
        if letters >= set(PHANTOM):
            phantom_complete += 1
    processes = gold_inv.get("components") or []
    stride_complete = 0
    for proc in processes:
        letters = set()
        for t in by_ref.get(norm(proc["id"]), []):
            letters.update(t.get("stride") or [])
        if letters:
            stride_complete += 1
    crossing = [f for f in gold_inv.get("data_flows", []) if f.get("crosses_boundary")]
    crossing_hit = 0
    threat_refs = {norm(t.get("diagram_referent", "")) for t in threats}
    for flow in crossing:
        if norm(flow["id"]) in threat_refs or norm(flow["from"]) in threat_refs or norm(flow["to"]) in threat_refs:
            crossing_hit += 1
    return {
        "phantom_b_components_complete": phantom_complete,
        "phantom_b_components_total": len(gold_inv.get("llm_components", [])),
        "phantom_b_fraction": round(phantom_complete / len(gold_inv["llm_components"]), 4) if gold_inv.get("llm_components") else 1.0,
        "stride_processes_with_any": stride_complete,
        "stride_processes_total": len(processes),
        "stride_fraction": round(stride_complete / len(processes), 4) if processes else 1.0,
        "crossing_flows_touched": crossing_hit,
        "crossing_flows_total": len(crossing),
        "crossing_fraction": round(crossing_hit / len(crossing), 4) if crossing else 1.0,
        "threat_count": len(threats),
    }


def hamming_multilabel(pred: list, gold: list, alphabet: list[str]) -> float:
    if not alphabet:
        return 0.0
    p, g = set(pred or []), set(gold or [])
    mismatches = 0
    for letter in alphabet:
        if (letter in p) != (letter in g):
            mismatches += 1
    return mismatches / len(alphabet)


def srf_checks(matrix: dict, personas: set[str], threats_json: dict | None, operating_model: str | None) -> dict:
    issues = []
    join_ok = join_claimed = 0
    by_slug = {}
    if threats_json:
        for row in threats_json.get("threats", []):
            by_slug[row["id"]] = row
    for t in matrix.get("threats", []):
        srf = t.get("srf") or {}
        if not srf:
            continue
        persona = srf.get("persona")
        if persona and persona not in personas:
            issues.append(f"{t.get('id')}: persona {persona} not in personas.json")
        if srf.get("party") == "shared":
            issues.append(f"{t.get('id')}: party shared")
        join = srf.get("join") or {}
        slug = join.get("ai_exchange_slug")
        if slug:
            join_claimed += 1
            gold_row = by_slug.get(slug)
            if not gold_row:
                issues.append(f"{t.get('id')}: slug {slug} missing from threats.json")
            elif join.get("copied_from_threats_json") and operating_model:
                acct = (gold_row.get("accountability") or {}).get(operating_model) or {}
                if srf.get("persona") != acct.get("accountable_persona"):
                    issues.append(f"{t.get('id')}: joined persona does not match threats.json")
                else:
                    join_ok += 1
            else:
                join_ok += 1
    return {
        "issues": issues,
        "join_claimed": join_claimed,
        "join_ok": join_ok,
        "join_match_rate": round(join_ok / join_claimed, 4) if join_claimed else None,
    }


def matrix_from_gold_inventory(gold: dict, kind: str) -> dict:
    """Echo gold inventory into the output schema so the harness can smoke-test."""
    llm_subset = list(gold["llm_components"])
    llm_subset_empty = not llm_subset
    return {
        "system_name": gold["system_name"],
        "perspective": gold["perspective"],
        "representation": {"kind": kind, "source_id": gold["system_id"]},
        "inventory": {
            "components": gold["components"],
            "external_actors": gold["external_actors"],
            "data_stores": gold["data_stores"],
            "data_flows": gold["data_flows"],
            "trust_boundaries": gold["trust_boundaries"],
            "llm_components": gold["llm_components"],
            "missing_trust_boundaries": gold.get("missing_trust_boundaries", False),
        },
        "replica_coverage": [],
        "existing_controls": [],
        "control_absences": [],
        "none_drawn": True,
        "solution_description": gold["system_name"] + ". " + gold["perspective"],
        "llm_subset": llm_subset,
        "llm_subset_empty": llm_subset_empty,
        "llm_subset_decision": {
            "status": "continue_without_llm" if llm_subset_empty else "ready",
            "reason": "gold-echo fixture records the inventory without elicitation",
        },
        "stride_considerations": [],
        "stride_coverage": {
            "budget_rows": 72,
            "letters_per_element": 6,
            "expected_elements": [],
            "considered_elements": [],
            "remaining_elements": [],
            "rows_expected": 0,
            "rows_written_total": 0,
            "complete": True,
        },
        "phantom_considerations": [],
        "phantom_coverage": {
            "status": "not_applicable" if llm_subset_empty else "incomplete",
            "expected_elements": llm_subset,
            "complete_elements": [],
            "missing": (
                []
                if llm_subset_empty
                else [{"element_id": item, "letters": PHANTOM} for item in llm_subset]
            ),
        },
        "threats": [],
        "qa": {
            "inventory_components_in_solS": True,
            "boundary_crossings_covered": False,
            "llm_subset_empty": llm_subset_empty,
            "phantom_b_complete": None if llm_subset_empty else False,
            "stride_considered": True,
            "actions_complete": True,
            "adversary_stated": False,
            "existing_controls_listed": True,
            "control_absences_grounded": True,
            "claim_boundary_stated": False,
            "actions_have_validation": True,
            "control_points_bound": True,
            "attacker_positions_bound": True,
            "evidence_refs_bound": True,
            "replica_coverage_complete": True,
            "review_order_complete": True,
            "report_present": False,
            "open_assumptions": ["gold-echo fixture has no elicited threats"],
            "gaps": ["threat elicitation not present in this fixture"],
        },
        "chain_meta": {
            "prompt_pack_version": "2.0",
            "role": "fixture",
            "track_b_applied": False,
        },
    }
