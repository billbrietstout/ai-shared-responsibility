"""Shared scoring helpers for AI-enabled system threat-model evaluation."""
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
PROFILES = {"full-system", "bounded-subsystem", "artifact-only"}
PHASE_STATUSES = {"complete", "incomplete", "not_applicable"}
ELEMENT_KEYS = {
    "process": "components",
    "actor": "external_actors",
    "store": "data_stores",
    "flow": "data_flows",
}
IMPORTANCE_FACTORS = {
    "attacker_access",
    "critical_asset",
    "prohibited_outcome",
    "control_gap",
    "cross_layer_propagation",
    "mandatory_obligation",
    "active_exploitation",
    "uncertainty",
}
THREAT_SOURCES = {
    "stride",
    "abuse-case",
    "operational",
    "phantom-b",
    "composition",
    "external-source",
}
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


def gold_workflow_issues(gold: dict) -> list[str]:
    """Check that a bounded gold fixture states a coherent v3 workflow contract."""
    expectations = gold.get("workflow_expectations")
    if expectations is None:
        return []
    issues = []
    if not isinstance(expectations, dict):
        return ["workflow_expectations is not an object"]
    for field in ("traditional_status", "ai_status", "composition_status"):
        if expectations.get(field) not in PHASE_STATUSES:
            issues.append(f"workflow_expectations.{field} is invalid")

    profile = gold.get("review_profile_hint", "full-system")
    if (
        profile in {"full-system", "bounded-subsystem"}
        and expectations.get("traditional_status") == "not_applicable"
    ):
        issues.append(f"{profile} fixture cannot skip traditional analysis")
    if profile == "artifact-only":
        if expectations.get("traditional_status") != "not_applicable":
            issues.append("artifact-only fixture must narrow traditional coverage")
        if not str(expectations.get("claim_boundary") or "").strip():
            issues.append("artifact-only fixture needs a claim boundary")

    llm_components = set(gold.get("llm_components") or [])
    if not llm_components and expectations.get("ai_status") != "not_applicable":
        issues.append("traditional-only fixture must mark AI analysis not applicable")
    if llm_components and profile != "artifact-only":
        if expectations.get("traditional_status") != "complete":
            issues.append("AI system fixture must complete traditional analysis")
        inventory_nodes = {
            item["id"]
            for key in ("components", "external_actors", "data_stores")
            for item in gold.get(key, [])
        }
        if inventory_nodes - llm_components and (
            expectations.get("composition_status") != "complete"
        ):
            issues.append("mixed system fixture must require composition coverage")

    versions = gold.get("component_versions") or []
    for row in versions:
        if row.get("version") == "unknown" and row.get("affected_cve_allowed") is not False:
            issues.append(
                f"{row.get('component_id', 'component')}: unknown version must forbid affected CVEs"
            )
    return issues


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


def _normalized_list(value) -> list[str]:
    if not isinstance(value, list):
        return []
    return [norm(item) for item in value if isinstance(item, str) and item]


def _duplicates(values: list) -> bool:
    return len(values) != len(set(values))


def _phase_issues(name: str, phase, universe: set[str]) -> list[str]:
    """Validate a reusable phase-coverage object and its completion claims."""
    issues = []
    if not isinstance(phase, dict):
        return [f"{name} missing"]
    status = phase.get("status")
    if status not in PHASE_STATUSES:
        issues.append(f"{name} status invalid")

    raw_expected = phase.get("expected_referents")
    raw_considered = phase.get("considered_referents")
    raw_exclusions = phase.get("exclusions")
    raw_gaps = phase.get("gaps")
    if not isinstance(raw_expected, list):
        issues.append(f"{name}.expected_referents missing or not an array")
        raw_expected = []
    if not isinstance(raw_considered, list):
        issues.append(f"{name}.considered_referents missing or not an array")
        raw_considered = []
    if not isinstance(raw_exclusions, list):
        issues.append(f"{name}.exclusions missing or not an array")
        raw_exclusions = []
    if not isinstance(raw_gaps, list):
        issues.append(f"{name}.gaps missing or not an array")
        raw_gaps = []

    expected_list = _normalized_list(raw_expected)
    considered_list = _normalized_list(raw_considered)
    if _duplicates(expected_list):
        issues.append(f"{name}.expected_referents contains duplicates")
    if _duplicates(considered_list):
        issues.append(f"{name}.considered_referents contains duplicates")
    expected, considered = set(expected_list), set(considered_list)

    excluded_list = []
    for exclusion in raw_exclusions:
        referent = (
            exclusion.get("referent") if isinstance(exclusion, dict) else exclusion
        )
        if not isinstance(referent, str) or not referent.strip():
            issues.append(f"{name}.exclusions contains an unbound exclusion")
        else:
            excluded_list.append(norm(referent))
    if _duplicates(excluded_list):
        issues.append(f"{name}.exclusions contains duplicate referents")
    excluded = set(excluded_list)

    for referent in expected | considered | excluded:
        if referent not in universe:
            issues.append(f"{name}: referent {referent!r} not in inventory")
    if not considered.issubset(expected):
        issues.append(f"{name}.considered_referents is not a subset of expected")
    if not excluded.issubset(expected):
        issues.append(f"{name}.exclusions is not a subset of expected")
    if considered & excluded:
        issues.append(f"{name}: a referent is both considered and excluded")
    if status == "complete":
        if expected != considered | excluded:
            issues.append(f"{name} complete but expected referents remain")
        if raw_gaps:
            issues.append(f"{name} complete but gaps are recorded")
    return issues


def _phase_qa_issues(
    qa: dict, field: str, phase_name: str, phase: dict | None
) -> list[str]:
    expected = None
    if isinstance(phase, dict) and phase.get("status") != "not_applicable":
        expected = phase.get("status") == "complete"
    if qa.get(field) != expected:
        return [f"qa.{field} does not match {phase_name}"]
    return []


def _id_in_markdown(item_id: str, markdown: str) -> bool:
    """True when item_id appears as its own token, so T1 does not match T10."""
    return (
        re.search(
            rf"(?<![A-Za-z0-9_-]){re.escape(item_id)}(?![A-Za-z0-9_-])",
            markdown,
        )
        is not None
    )


def report_projection_issues(matrix: dict) -> list[str]:
    """When P-report has run, every stored threat, position, and control id
    must appear in report.markdown. Gold-echo leaves report_present false."""
    qa = matrix.get("qa") or {}
    if qa.get("report_present") is not True:
        return []
    report = matrix.get("report")
    markdown = report.get("markdown") if isinstance(report, dict) else None
    if not isinstance(markdown, str) or not markdown.strip():
        return ["qa.report_present is true but report.markdown is empty"]
    issues = []
    missing_threats = [
        str(row.get("id"))
        for row in matrix.get("threats") or []
        if row.get("id") and not _id_in_markdown(str(row["id"]), markdown)
    ]
    if missing_threats:
        issues.append(
            "report.markdown omits threat ids: " + ", ".join(missing_threats)
        )
    missing_positions = [
        str(row.get("id"))
        for row in ((matrix.get("adversary") or {}).get("positions") or [])
        if row.get("id") and not _id_in_markdown(str(row["id"]), markdown)
    ]
    if missing_positions:
        issues.append(
            "report.markdown omits attacker position ids: "
            + ", ".join(missing_positions)
        )
    missing_controls = [
        str(row.get("id"))
        for row in matrix.get("existing_controls") or []
        if row.get("id") and not _id_in_markdown(str(row["id"]), markdown)
    ]
    if missing_controls:
        issues.append(
            "report.markdown omits existing control ids: "
            + ", ".join(missing_controls)
        )
    return issues


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
        "review_context",
        "traditional_coverage",
        "stride_coverage",
        "phantom_coverage",
        "composition_coverage",
        "source_manifest",
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

    review_context = matrix.get("review_context")
    if not isinstance(review_context, dict):
        issues.append("review_context missing")
        review_context = {}
    profile = review_context.get("profile")
    if profile not in PROFILES:
        issues.append("review_context.profile invalid")

    profile_confirmation = review_context.get("profile_confirmation")
    if not isinstance(profile_confirmation, dict):
        issues.append("review_context.profile_confirmation missing")
        profile_confirmation = {}
    if not isinstance(profile_confirmation.get("operator_confirmed"), bool):
        issues.append(
            "review_context.profile_confirmation.operator_confirmed is not boolean"
        )
    if (
        profile == "artifact-only"
        and profile_confirmation.get("operator_confirmed") is not True
    ):
        issues.append("artifact-only profile requires operator confirmation")

    if not str(review_context.get("perspective") or "").strip():
        issues.append("review_context.perspective missing or empty")
    for field in ("vertical_ids", "jurisdictions"):
        if not isinstance(review_context.get(field), list):
            issues.append(f"review_context.{field} missing or not an array")

    scope = review_context.get("scope")
    if not isinstance(scope, dict):
        issues.append("review_context.scope missing")
    else:
        for field in ("included_labels", "excluded_labels"):
            if not isinstance(scope.get(field), list):
                issues.append(f"review_context.scope.{field} is not an array")
        if not isinstance(scope.get("boundary_statement"), str):
            issues.append(
                "review_context.scope.boundary_statement is not a string"
            )

    claim_evidence = review_context.get("claim_evidence")
    if not isinstance(claim_evidence, list):
        issues.append("review_context.claim_evidence missing or not an array")
        claim_evidence = []
    claim_ids = []
    for i, claim in enumerate(claim_evidence):
        if not isinstance(claim, dict):
            issues.append(f"review_context.claim_evidence[{i}] is not an object")
            continue
        claim_id = claim.get("id")
        if not isinstance(claim_id, str) or not re.match(r"^claim-", claim_id):
            issues.append(
                f"review_context.claim_evidence[{i}].id must start with claim-"
            )
        else:
            claim_ids.append(claim_id)
        if claim.get("kind") not in {"diagram", "operator"}:
            issues.append(
                f"review_context.claim_evidence[{i}].kind is invalid"
            )
        for field in ("reference", "supports"):
            if not str(claim.get(field) or "").strip():
                issues.append(
                    f"review_context.claim_evidence[{i}].{field} is empty"
                )
    if _duplicates(claim_ids):
        issues.append("review_context.claim_evidence ids are not unique")
    claim_id_set = set(claim_ids)

    confirmation_ref = profile_confirmation.get("evidence_ref")
    if confirmation_ref is not None and (
        not isinstance(confirmation_ref, str)
        or confirmation_ref not in claim_id_set
    ):
        issues.append(
            "review_context.profile_confirmation.evidence_ref is not claim evidence"
        )

    context_ids = []
    context_fields = (
        ("critical_assets", ("name",)),
        ("prohibited_outcomes", ("statement",)),
        ("continuity_safety_constraints", ("statement",)),
    )
    for field, text_fields in context_fields:
        rows = review_context.get(field)
        if not isinstance(rows, list):
            issues.append(f"review_context.{field} missing or not an array")
            continue
        for i, row in enumerate(rows):
            label = f"review_context.{field}[{i}]"
            if not isinstance(row, dict):
                issues.append(f"{label} is not an object")
                continue
            row_id = row.get("id")
            if not isinstance(row_id, str) or not row_id.strip():
                issues.append(f"{label}.id is empty")
            else:
                context_ids.append(row_id)
            for text_field in text_fields:
                if not str(row.get(text_field) or "").strip():
                    issues.append(f"{label}.{text_field} is empty")
            evidence_refs = row.get("evidence_refs")
            if not isinstance(evidence_refs, list):
                issues.append(f"{label}.evidence_refs is not an array")
            else:
                for evidence_ref in evidence_refs:
                    if (
                        not isinstance(evidence_ref, str)
                        or evidence_ref not in claim_id_set
                    ):
                        issues.append(
                            f"{label}: evidence_ref {evidence_ref!r} not found"
                        )
            if field == "critical_assets":
                diagram_referents = row.get("diagram_referents")
                if not isinstance(diagram_referents, list):
                    issues.append(f"{label}.diagram_referents is not an array")
                elif universe:
                    for diagram_referent in diagram_referents:
                        if not isinstance(diagram_referent, str) or (
                            not resolve(diagram_referent, index)
                            and norm(diagram_referent) not in universe
                        ):
                            issues.append(
                                f"{label}: diagram_referent "
                                f"{diagram_referent!r} not in inventory"
                            )
    if _duplicates(context_ids):
        issues.append("review_context contains duplicate context object ids")

    supplied_severity = review_context.get("supplied_severity")
    if supplied_severity is not None:
        if not isinstance(supplied_severity, dict):
            issues.append("review_context.supplied_severity is not object or null")
        else:
            for field in ("value", "scale", "source"):
                if not str(supplied_severity.get(field) or "").strip():
                    issues.append(
                        f"review_context.supplied_severity.{field} is empty"
                    )
            severity_source = supplied_severity.get("source")
            if severity_source and (
                not isinstance(severity_source, str)
                or severity_source not in claim_id_set
            ):
                issues.append(
                    "review_context.supplied_severity.source is not claim evidence"
                )

    traditional = matrix.get("traditional_coverage")
    issues.extend(_phase_issues("traditional_coverage", traditional, universe))
    if (
        isinstance(traditional, dict)
        and traditional.get("status") == "not_applicable"
        and profile != "artifact-only"
    ):
        issues.append(
            "traditional_coverage may be not_applicable only for artifact-only"
        )
    if (
        isinstance(traditional, dict)
        and traditional.get("status") == "not_applicable"
        and not str(traditional.get("operator_confirmation") or "").strip()
    ):
        issues.append(
            "traditional_coverage not_applicable requires operator confirmation"
        )
    if profile in {"full-system", "bounded-subsystem"} and (
        isinstance(traditional, dict)
        and traditional.get("status") == "not_applicable"
    ):
        issues.append(f"{profile} review requires traditional coverage")

    for name in ("abuse_coverage", "operational_coverage"):
        if name in matrix:
            issues.extend(_phase_issues(name, matrix.get(name), universe))

    llm_subset = matrix.get("llm_subset") or []
    llm_subset_empty = matrix.get("llm_subset_empty")
    if not isinstance(llm_subset_empty, bool):
        issues.append("llm_subset_empty missing or not boolean")
    elif llm_subset_empty != (len(llm_subset) == 0):
        issues.append("llm_subset_empty does not match llm_subset")

    qa = matrix.get("qa") or {}
    for field in (
        "traditional_phase_complete",
        "abuse_cases_complete",
        "operational_events_complete",
        "composition_complete",
        "source_refs_bound",
        "importance_complete",
        "srf_layer_coverage_complete",
        "vertical_join_valid",
    ):
        if field not in qa:
            issues.append(f"qa.{field} missing")
    if qa.get("llm_subset_empty") != llm_subset_empty:
        issues.append("qa.llm_subset_empty does not match root")
    phantom_complete = qa.get("phantom_b_complete")
    if llm_subset_empty is True and phantom_complete is not None:
        issues.append("qa.phantom_b_complete must be null for empty llm_subset")
    if llm_subset_empty is False and not isinstance(phantom_complete, bool):
        issues.append("qa.phantom_b_complete must be boolean for non-empty llm_subset")
    issues.extend(
        _phase_qa_issues(
            qa, "traditional_phase_complete", "traditional_coverage", traditional
        )
    )
    issues.extend(
        _phase_qa_issues(
            qa, "abuse_cases_complete", "abuse_coverage", matrix.get("abuse_coverage")
        )
    )
    issues.extend(
        _phase_qa_issues(
            qa,
            "operational_events_complete",
            "operational_coverage",
            matrix.get("operational_coverage"),
        )
    )

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

    source_manifest = matrix.get("source_manifest")
    source_entries = []
    if not isinstance(source_manifest, dict):
        issues.append("source_manifest missing")
    else:
        if not str(source_manifest.get("source_set_id") or "").strip():
            issues.append("source_manifest.source_set_id is empty")
        source_entries = source_manifest.get("entries")
        if not isinstance(source_entries, list):
            issues.append("source_manifest.entries missing or not an array")
            source_entries = []
    source_ids = []
    source_versions = {}
    for i, entry in enumerate(source_entries):
        if not isinstance(entry, dict):
            issues.append(f"source_manifest.entries[{i}] is not an object")
            continue
        source_id = entry.get("source_id")
        if not isinstance(source_id, str) or not source_id.strip():
            issues.append(f"source_manifest.entries[{i}].source_id is empty")
            continue
        source_ids.append(source_id)
        source_versions[source_id] = entry.get("catalog_version")
        for field in (
            "source_kind",
            "canonical_url",
            "license_id",
            "integration_mode",
            "catalog_version",
            "retrieved_at",
            "content_sha256",
        ):
            if not isinstance(entry.get(field), str) or not entry[field].strip():
                issues.append(
                    f"source_manifest.entries[{i}].{field} is empty"
                )
    if _duplicates(source_ids):
        issues.append("source_manifest contains duplicate source_id values")
    manifest_source_ids = set(source_ids)

    review_positions = []
    any_vertical = False
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
        source = threat.get("source")
        if source not in THREAT_SOURCES:
            issues.append(f"{tid}: source {source!r} not allowed")
        method_sources = threat.get("method_sources")
        if not isinstance(method_sources, list):
            issues.append(f"{tid}: method_sources missing or not an array")
        else:
            if _duplicates(method_sources):
                issues.append(f"{tid}: method_sources contains duplicates")
            for method_source in method_sources:
                if method_source not in THREAT_SOURCES:
                    issues.append(
                        f"{tid}: method source {method_source!r} not allowed"
                    )

        importance = threat.get("importance")
        if not isinstance(importance, dict):
            issues.append(f"{tid}: importance missing")
        else:
            factors = importance.get("factors")
            if not isinstance(factors, list):
                issues.append(f"{tid}: importance.factors missing or not an array")
                factors = []
            for factor in factors:
                if not isinstance(factor, dict):
                    issues.append(f"{tid}: importance factor is not an object")
                    continue
                if factor.get("kind") not in IMPORTANCE_FACTORS:
                    issues.append(
                        f"{tid}: bad importance factor {factor.get('kind')!r}"
                    )
                for field in ("evidence", "source"):
                    if not str(factor.get(field) or "").strip():
                        issues.append(
                            f"{tid}: importance factor has empty {field}"
                        )
            needs_input = importance.get("needs_input")
            if not isinstance(needs_input, list):
                issues.append(f"{tid}: importance.needs_input is not an array")
            review_position = importance.get("review_position")
            if (
                not isinstance(review_position, int)
                or isinstance(review_position, bool)
                or review_position < 1
            ):
                issues.append(f"{tid}: importance.review_position invalid")
            else:
                review_positions.append(review_position)

        external_refs = threat.get("external_refs")
        if not isinstance(external_refs, list):
            issues.append(f"{tid}: external_refs missing or not an array")
            external_refs = []
        external_keys = []
        for external_ref in external_refs:
            if not isinstance(external_ref, dict):
                issues.append(f"{tid}: external_ref is not an object")
                continue
            source_id = external_ref.get("source_id")
            external_id = external_ref.get("external_id")
            external_keys.append((source_id, external_id))
            if source_id not in manifest_source_ids:
                issues.append(
                    f"{tid}: external_ref source_id {source_id!r} not in manifest"
                )
            catalog_version = external_ref.get("catalog_version")
            if (
                source_id in source_versions
                and catalog_version != source_versions[source_id]
            ):
                issues.append(
                    f"{tid}: external_ref catalog_version does not match manifest"
                )
            if external_ref.get("relation") not in {
                "exact",
                "narrower",
                "broader",
                "related",
                "supporting",
            }:
                issues.append(f"{tid}: external_ref relation invalid")
            status = external_ref.get("status")
            if status not in {
                "candidate",
                "mapped",
                "affected",
                "not_affected",
                "unknown",
            }:
                issues.append(f"{tid}: external_ref status invalid")
            for affected in external_ref.get("affected_referents") or []:
                if norm(affected) not in universe:
                    issues.append(
                        f"{tid}: external_ref referent {affected!r} not in inventory"
                    )
            if source_id in {"cve", "nvd"} and status == "affected":
                applicability = external_ref.get("applicability_evidence")
                if not isinstance(applicability, dict):
                    issues.append(
                        f"{tid}: affected {source_id} reference lacks applicability evidence"
                    )
                else:
                    for field in ("supplier", "product", "version"):
                        value = str(applicability.get(field) or "").strip()
                        if not value or value.lower() == "unknown":
                            issues.append(
                                f"{tid}: affected {source_id} reference has no known {field}"
                            )
                    component_ref = applicability.get("component_referent")
                    if norm(component_ref) not in action_point_ids:
                        issues.append(
                            f"{tid}: affected {source_id} component referent is not actionable"
                        )
                    if not applicability.get("evidence_refs"):
                        issues.append(
                            f"{tid}: affected {source_id} reference has no applicability evidence refs"
                        )
        if _duplicates(external_keys):
            issues.append(f"{tid}: external_refs contains duplicate source/id pairs")

        vertical = threat.get("vertical")
        if vertical is not None:
            any_vertical = True
            if not isinstance(vertical, dict):
                issues.append(f"{tid}: vertical is not an object")
            else:
                vertical_ids = set(review_context.get("vertical_ids") or [])
                for field in ("obligations", "control_candidates"):
                    rows = vertical.get(field)
                    if not isinstance(rows, list):
                        issues.append(f"{tid}: vertical.{field} is not an array")
                        continue
                    for row in rows:
                        if not isinstance(row, dict):
                            continue
                        vertical_id = row.get("vertical_id")
                        if vertical_id and vertical_id not in vertical_ids:
                            issues.append(
                                f"{tid}: vertical_id {vertical_id!r} not in review context"
                            )
                        source_id = row.get("source_id")
                        if source_id and source_id not in manifest_source_ids:
                            issues.append(
                                f"{tid}: vertical source_id {source_id!r} not in manifest"
                            )
                if "acceptance_authority" not in vertical:
                    issues.append(f"{tid}: vertical.acceptance_authority missing")
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

    if _duplicates(review_positions):
        issues.append("importance.review_position values are not unique")
    if qa.get("source_refs_bound") is not True:
        issues.append("qa.source_refs_bound must be true")
    if qa.get("importance_complete") is not True:
        issues.append("qa.importance_complete must be true")
    if any_vertical and not isinstance(matrix.get("vertical_context"), dict):
        issues.append("vertical_context required when threats have vertical context")

    stride_coverage = matrix.get("stride_coverage")
    if not isinstance(stride_coverage, dict):
        issues.append("stride_coverage missing")
    else:
        expected_considerations = stride_coverage.get("expected_considerations")
        if not isinstance(expected_considerations, list):
            issues.append(
                "stride_coverage.expected_considerations missing or not an array"
            )
            expected_considerations = []
        expected_pairs = []
        declared_elements = []
        for declaration in expected_considerations:
            if not isinstance(declaration, dict):
                issues.append("stride expected consideration is not an object")
                continue
            element_id = norm(declaration.get("element_id"))
            element_type = declaration.get("element_type")
            letters = declaration.get("letters")
            declared_elements.append(element_id)
            if element_type not in ELEMENT_KEYS:
                issues.append(f"stride element {element_id!r} has invalid type")
            elif element_id not in id_set(inv, ELEMENT_KEYS[element_type]):
                issues.append(
                    f"stride element {element_id!r} not in {element_type} inventory"
                )
            if not isinstance(letters, list) or not letters:
                issues.append(f"stride element {element_id!r} has no letters")
                letters = []
            if _duplicates(letters):
                issues.append(
                    f"stride element {element_id!r} declares duplicate letters"
                )
            for letter in letters:
                if letter not in STRIDE:
                    issues.append(
                        f"stride element {element_id!r} has bad letter {letter!r}"
                    )
                expected_pairs.append((element_id, letter))
        if _duplicates(declared_elements):
            issues.append(
                "stride_coverage.expected_considerations contains duplicate elements"
            )
        if _duplicates(expected_pairs):
            issues.append("stride expected element/letter pairs are not unique")

        expected_list = _normalized_list(stride_coverage.get("expected_elements"))
        considered_list = _normalized_list(
            stride_coverage.get("considered_elements")
        )
        remaining_list = _normalized_list(stride_coverage.get("remaining_elements"))
        if _duplicates(expected_list):
            issues.append("stride_coverage.expected_elements contains duplicates")
        if _duplicates(considered_list):
            issues.append("stride_coverage.considered_elements contains duplicates")
        if _duplicates(remaining_list):
            issues.append("stride_coverage.remaining_elements contains duplicates")
        expected = set(expected_list)
        considered = set(considered_list)
        remaining = set(remaining_list)
        if expected != set(declared_elements):
            issues.append(
                "stride_coverage expected_elements does not match declarations"
            )
        if considered | remaining != expected or considered & remaining:
            issues.append(
                "stride_coverage considered/remaining elements do not partition expected"
            )
        if stride_coverage.get("complete") is not True:
            issues.append("stride_coverage incomplete")
        if remaining:
            issues.append("stride_coverage has remaining elements")

        actual_pairs = []
        for row in matrix.get("stride_considerations") or []:
            element_id = norm(row.get("element_id"))
            letter = row.get("letter")
            actual_pairs.append((element_id, letter))
        if _duplicates(actual_pairs):
            issues.append("stride_considerations contains duplicate element/letter rows")
        if set(actual_pairs) != set(expected_pairs):
            missing_pairs = set(expected_pairs) - set(actual_pairs)
            unexpected_pairs = set(actual_pairs) - set(expected_pairs)
            if missing_pairs:
                issues.append(
                    "stride_considerations missing expected element/letter pairs"
                )
            if unexpected_pairs:
                issues.append(
                    "stride_considerations contains unexpected element/letter pairs"
                )
        expected_rows = len(expected_pairs)
        if stride_coverage.get("rows_expected") != expected_rows:
            issues.append("stride_coverage rows_expected is inconsistent")
        if stride_coverage.get("rows_written_total") != len(actual_pairs):
            issues.append("stride_coverage rows_written_total is inconsistent")

    phantom_coverage = matrix.get("phantom_coverage")
    if not isinstance(phantom_coverage, dict):
        issues.append("phantom_coverage missing")
    elif llm_subset_empty is True:
        if phantom_coverage.get("status") != "not_applicable":
            issues.append("phantom_coverage must be not_applicable for empty subset")
    elif phantom_coverage.get("status") not in {"complete", "incomplete"}:
        issues.append("phantom_coverage status invalid")

    composition = matrix.get("composition_coverage")
    if not isinstance(composition, dict):
        issues.append("composition_coverage missing")
    else:
        expected_paths = composition.get("expected_paths")
        if not isinstance(expected_paths, list):
            issues.append(
                "composition_coverage.expected_paths missing or not an array"
            )
            expected_paths = []
        paths_by_id = {}
        for path in expected_paths:
            if not isinstance(path, dict):
                issues.append("composition expected path is not an object")
                continue
            path_id = path.get("id")
            if not isinstance(path_id, str) or not path_id.strip():
                issues.append("composition expected path has no id")
                continue
            if path_id in paths_by_id:
                issues.append(f"composition path id duplicated: {path_id}")
            paths_by_id[path_id] = path
            referents = path.get("referents")
            if not isinstance(referents, list) or len(referents) < 2:
                issues.append(
                    f"composition path {path_id} needs at least two referents"
                )
                referents = []
            if _duplicates([norm(ref) for ref in referents]):
                issues.append(f"composition path {path_id} repeats a referent")
            for referent in referents:
                if norm(referent) not in universe:
                    issues.append(
                        f"composition path {path_id}: referent {referent!r} not in inventory"
                    )

        considered_paths = composition.get("considered_paths")
        remaining_paths = composition.get("remaining_paths")
        if not isinstance(considered_paths, list):
            issues.append(
                "composition_coverage.considered_paths missing or not an array"
            )
            considered_paths = []
        if not isinstance(remaining_paths, list):
            issues.append(
                "composition_coverage.remaining_paths missing or not an array"
            )
            remaining_paths = []
        if _duplicates(considered_paths):
            issues.append("composition considered_paths contains duplicates")
        if _duplicates(remaining_paths):
            issues.append("composition remaining_paths contains duplicates")
        expected_path_ids = set(paths_by_id)
        considered_path_ids = set(considered_paths)
        remaining_path_ids = set(remaining_paths)
        if (
            considered_path_ids | remaining_path_ids != expected_path_ids
            or considered_path_ids & remaining_path_ids
        ):
            issues.append(
                "composition considered/remaining paths do not partition expected"
            )
        status = composition.get("status")
        if status not in PHASE_STATUSES:
            issues.append("composition_coverage status invalid")
        if status == "complete" and remaining_path_ids:
            issues.append("composition_coverage complete with remaining paths")
        if status == "not_applicable" and expected_path_ids:
            issues.append(
                "composition_coverage not_applicable with expected paths"
            )

        consideration_path_ids = []
        for row in matrix.get("composition_considerations") or []:
            if not isinstance(row, dict):
                issues.append("composition consideration is not an object")
                continue
            path_id = row.get("path_id")
            consideration_path_ids.append(path_id)
            path = paths_by_id.get(path_id)
            if path is None:
                issues.append(
                    f"composition consideration path {path_id!r} is not expected"
                )
                continue
            expected_referents = {norm(ref) for ref in path.get("referents") or []}
            row_referents = {norm(ref) for ref in row.get("referents") or []}
            if row_referents != expected_referents:
                issues.append(
                    f"composition consideration {path_id} referents do not match path"
                )
            diagram_referent = norm(row.get("diagram_referent"))
            if diagram_referent not in expected_referents:
                issues.append(
                    f"composition consideration {path_id} diagram_referent not on path"
                )
        if _duplicates(consideration_path_ids):
            issues.append("composition_considerations contains duplicate path rows")
        if set(consideration_path_ids) != considered_path_ids:
            issues.append(
                "composition_considerations do not exactly match considered paths"
            )

    issues.extend(
        _phase_qa_issues(
            qa, "composition_complete", "composition_coverage", composition
        )
    )

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

    chain_meta = matrix.get("chain_meta")
    if not isinstance(chain_meta, dict):
        issues.append("chain_meta missing")
        chain_meta = {}
    if chain_meta.get("prompt_pack_version") != "3.0":
        issues.append("chain_meta.prompt_pack_version is not 3.0")
    track_b = chain_meta.get("track_b_applied")
    track_c = chain_meta.get("track_c_applied")
    if not isinstance(track_b, bool):
        issues.append("chain_meta.track_b_applied missing or not boolean")
    if not isinstance(track_c, bool):
        issues.append("chain_meta.track_c_applied missing or not boolean")

    layer_coverage = matrix.get("layer_coverage")
    if track_b is True:
        if not str(review_context.get("operating_model") or "").strip():
            issues.append("Track B requires review_context.operating_model")
        if not isinstance(layer_coverage, dict):
            issues.append("Track B requires layer_coverage")
        else:
            expected_layers = layer_coverage.get("expected_layers")
            considered_layers = layer_coverage.get("considered_layers")
            remaining_layers = layer_coverage.get("remaining_layers")
            if not isinstance(expected_layers, list):
                issues.append("layer_coverage.expected_layers is not an array")
                expected_layers = []
            if not isinstance(considered_layers, list):
                issues.append("layer_coverage.considered_layers is not an array")
                considered_layers = []
            if not isinstance(remaining_layers, list):
                issues.append("layer_coverage.remaining_layers is not an array")
                remaining_layers = []
            for layer in expected_layers + considered_layers + remaining_layers:
                if layer not in LAYERS:
                    issues.append(f"layer_coverage has invalid layer {layer!r}")
            if (
                set(considered_layers) | set(remaining_layers)
                != set(expected_layers)
                or set(considered_layers) & set(remaining_layers)
            ):
                issues.append(
                    "layer_coverage considered/remaining do not partition expected"
                )
            if layer_coverage.get("status") not in PHASE_STATUSES:
                issues.append("layer_coverage status invalid")
            if (
                layer_coverage.get("status") == "complete"
                and remaining_layers
            ):
                issues.append("layer_coverage complete with remaining layers")
        expected_layer_qa = (
            isinstance(layer_coverage, dict)
            and layer_coverage.get("status") == "complete"
        )
        if qa.get("srf_layer_coverage_complete") != expected_layer_qa:
            issues.append(
                "qa.srf_layer_coverage_complete does not match layer_coverage"
            )
    elif qa.get("srf_layer_coverage_complete") is not None:
        issues.append(
            "qa.srf_layer_coverage_complete must be null when Track B is not applied"
        )

    if track_c is True:
        if track_b is not True:
            issues.append("Track C requires Track B")
        if not isinstance(matrix.get("vertical_context"), dict):
            issues.append("Track C requires vertical_context")
        if qa.get("vertical_join_valid") is not True:
            issues.append("qa.vertical_join_valid must be true for Track C")
    elif any_vertical:
        if qa.get("vertical_join_valid") is not True:
            issues.append(
                "qa.vertical_join_valid must be true when vertical joins are present"
            )
    elif qa.get("vertical_join_valid") is not None:
        issues.append(
            "qa.vertical_join_valid must be null when no vertical joins are present"
        )
    issues.extend(report_projection_issues(matrix))
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
        "review_context": {
            "profile": "artifact-only",
            "profile_confirmation": {
                "operator_confirmed": True,
                "evidence_ref": "claim-gold-echo-profile",
            },
            "perspective": gold["perspective"],
            "vertical_ids": [],
            "jurisdictions": [],
            "operating_model": None,
            "critical_assets": [],
            "prohibited_outcomes": [],
            "continuity_safety_constraints": [],
            "supplied_severity": None,
            "scope": {
                "included_labels": [],
                "excluded_labels": [],
                "boundary_statement": (
                    "Inventory-only fixture; no integrated system review."
                ),
            },
            "claim_evidence": [
                {
                    "id": "claim-gold-echo-profile",
                    "kind": "operator",
                    "reference": "gold echo fixture mode",
                    "supports": "artifact-only review profile confirmation",
                }
            ],
        },
        "traditional_coverage": {
            "status": "not_applicable",
            "expected_referents": [],
            "considered_referents": [],
            "exclusions": [],
            "operator_confirmation": "claim-gold-echo-profile",
            "gaps": [],
        },
        "llm_subset_decision": {
            "status": "continue_without_llm" if llm_subset_empty else "ready",
            "reason": "gold-echo fixture records the inventory without elicitation",
        },
        "stride_considerations": [],
        "stride_coverage": {
            "budget_rows": 72,
            "expected_considerations": [],
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
        "composition_considerations": [],
        "composition_coverage": {
            "expected_paths": [],
            "considered_paths": [],
            "remaining_paths": [],
            "status": "not_applicable",
        },
        "source_manifest": {
            "source_set_id": "gold-echo-no-external-sources",
            "entries": [],
        },
        "threats": [],
        "qa": {
            "inventory_components_in_solS": True,
            "boundary_crossings_covered": False,
            "llm_subset_empty": llm_subset_empty,
            "phantom_b_complete": None if llm_subset_empty else False,
            "stride_considered": True,
            "traditional_phase_complete": None,
            "abuse_cases_complete": None,
            "operational_events_complete": None,
            "composition_complete": None,
            "source_refs_bound": True,
            "importance_complete": True,
            "srf_layer_coverage_complete": None,
            "vertical_join_valid": None,
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
            "prompt_pack_version": "3.0",
            "role": "fixture",
            "track_b_applied": False,
            "track_c_applied": False,
        },
    }
