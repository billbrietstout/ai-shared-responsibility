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
        "threats",
        "qa",
    ):
        if field not in matrix:
            issues.append(f"missing {field}")
    inv = matrix.get("inventory") or {}
    universe = inventory_id_universe(inv)
    index = inventory_index(inv)
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
        "solution_description": gold["system_name"] + ". " + gold["perspective"],
        "llm_subset": list(gold["llm_components"]),
        "threats": [],
        "qa": {
            "inventory_components_in_solS": True,
            "boundary_crossings_covered": False,
            "phantom_b_complete": False,
            "stride_considered": False,
            "actions_complete": True,
            "open_assumptions": ["gold-echo fixture has no elicited threats"],
            "gaps": ["threat elicitation not present in this fixture"],
        },
        "chain_meta": {"prompt_pack_version": "1.0", "role": "fixture", "track_b_applied": False},
    }
