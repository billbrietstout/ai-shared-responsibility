#!/usr/bin/env python3
"""Build draft L4/L5 platform and AI Model Provider risk rows for threats.json (PR 4 series)."""
from __future__ import annotations

import copy
import json
from collections import defaultdict
from pathlib import Path

from obligation_kind import citation_pattern, current_obligation
from risk_obligation_links import derived_control_rows
from roca_orphans import cited_requirement_ids, control_slug, load_inputs, repo_root

SRF_MODELS = ("AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS")

L4_ACCOUNTABILITY_TEMPLATE = {
    "AI-SaaS": {
        "accountable_persona": "ai-platform-provider",
        "accountable_party": "provider",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "The provider owns the managed AI platform in this model. The customer is accountable for configuration it controls, because the L4 matrix cell is shared.",
    },
    "AI-PaaS": {
        "accountable_persona": "ai-platform-provider",
        "accountable_party": "provider",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "The provider owns the platform runtime. The customer owns custom deployments and integrations on that runtime.",
    },
    "Agent-PaaS": {
        "accountable_persona": "ai-platform-provider",
        "accountable_party": "provider",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "The provider owns orchestration and inference infrastructure. The customer owns agents it defines on that infrastructure.",
    },
    "IaaS": {
        "accountable_persona": "ai-platform-provider",
        "accountable_party": "customer",
        "responsibility": {"customer": "customer-owned", "provider": "provider-managed"},
        "note": "The customer runs the AI platform stack. The infrastructure provider retains obligations for physical and virtual resources underneath.",
    },
}

L5_ACCOUNTABILITY_TEMPLATE = {
    "AI-SaaS": {
        "accountable_persona": "model-provider",
        "accountable_party": "provider",
        "responsibility": {"customer": "N/A", "provider": "provider-managed"},
        "note": "The SaaS provider supplies the model and owns provider-side model duties in this model.",
    },
    "AI-PaaS": {
        "accountable_persona": "model-provider",
        "accountable_party": "provider",
        "responsibility": {"customer": "model-evaluation", "provider": "provider-managed"},
        "note": "The model provider owns the model artifact. The customer evaluates whether that model fits its use cases.",
    },
    "Agent-PaaS": {
        "accountable_persona": "model-provider",
        "accountable_party": "provider",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "The model provider owns the base model. The customer validates behavior under agent workloads.",
    },
    "IaaS": {
        "accountable_persona": "model-provider",
        "accountable_party": "customer",
        "responsibility": {"customer": "customer-owned", "provider": "provider-managed"},
        "note": "The customer procures or builds models it runs. Third-party model vendors remain subject to contract terms the customer enforces.",
    },
}

GOVERNANCE_ACCOUNTABILITY = {
    "AI-SaaS": {
        "accountable_persona": "ai-system-governance",
        "accountable_party": "customer",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "Accountable persona is ai-system-governance for program records above a single platform control. The L1 cell is shared; the customer leads governance of AI use.",
    },
    "AI-PaaS": {
        "accountable_persona": "ai-system-governance",
        "accountable_party": "customer",
        "responsibility": {"customer": "customer-owned", "provider": "provider-managed"},
        "note": "The customer owns governance records for AI it builds on the platform.",
    },
    "Agent-PaaS": {
        "accountable_persona": "ai-system-governance",
        "accountable_party": "customer",
        "responsibility": {"customer": "customer-owned", "provider": "provider-managed"},
        "note": "The customer owns governance records for agents and applications it defines.",
    },
    "IaaS": {
        "accountable_persona": "ai-system-governance",
        "accountable_party": "customer",
        "responsibility": {"customer": "customer-owned", "provider": "provider-managed"},
        "note": "The customer owns governance records for the full stack.",
    },
}

GAP_GOVERNANCE = {
    model: {
        **GOVERNANCE_ACCOUNTABILITY[model],
        "note": "No related control applies in this operating model. The persona stays ai-system-governance, and the cell records no_linked_control_in_model.",
        "no_linked_control_in_model": True,
    }
    for model in GOVERNANCE_ACCOUNTABILITY
}


def load_control_index(root: Path):
    loaded = load_inputs(root)
    requirements = {r["id"]: r for r in loaded["requirements"].get("requirements") or [] if r.get("id")}
    regs_by_key = {}
    for item in loaded["regulations"].get("items") or []:
        if isinstance(item, dict) and item.get("mapping_key"):
            regs_by_key[item["mapping_key"]] = item
    matchers = defaultdict(list)
    for req in requirements.values():
        tokens = req.get("citation_match") if req.get("citation_match") is not None else [req.get("citation")]
        patterns = [citation_pattern(t) for t in tokens if t]
        matchers[req.get("instrument")].append({"req": req, "pats": patterns})

    by_req = defaultdict(list)
    related = set()
    for path in loaded["control_paths"]:
        doc = json.loads(path.read_text(encoding="utf-8"))
        slug = control_slug(path)
        for control in doc.get("controls") or []:
            if not control.get("id"):
                continue
            full = f"srf.control.{slug}.{control['id']}"
            cited = cited_requirement_ids(control, regs_by_key, matchers)
            mappings = control.get("mappings") or {}
            for req_id in cited:
                for key, citation in mappings.items():
                    if key == "mapping_status_note" or not isinstance(citation, str) or not citation.strip():
                        continue
                    if not current_obligation(regs_by_key.get(key)):
                        continue
                    by_req[req_id].append(
                        {
                            "control": full,
                            "mapping_key": key,
                            "citation": citation.strip(),
                            "layer": control.get("layer"),
                        }
                    )
                related.add(full)
    return by_req, related


def load_controls_by_full(root: Path):
    controls = {}
    for vertical in ("finance", "healthcare", "insurance", "public-sector", "defense", "manufacturing", "common"):
        path = root / "data" / f"{vertical}-controls.json"
        if not path.is_file():
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        for control in doc.get("controls") or []:
            if control.get("id"):
                controls[f"srf.control.{vertical}.{control['id']}"] = control
    return controls


def wire_traceable_obligations(threat, req_ids, allowed):
    manual = [o for o in threat.get("obligations") or [] if isinstance(o, dict)]
    links = list(manual)
    related = set()
    for req_id in req_ids:
        rows = allowed.get((threat["id"], req_id), [])
        if not rows:
            continue
        links.append(
            {
                "requirement": req_id,
                "basis": "derived_via_control",
                "source": {"controls": rows},
            }
        )
        for row in rows:
            related.add(row["control"])
    threat["obligations"] = links
    threat["related_controls"] = sorted(related)


def align_accountability(threat, controls_by_full, template):
    for model in SRF_MODELS:
        base = dict(template[model])
        owners = []
        for cid in threat.get("related_controls") or []:
            by_model = (controls_by_full.get(cid) or {}).get("accountable_by_model") or {}
            if model in by_model:
                owners.append(by_model[model])
        if owners:
            persona = owners[0]
            if len(set(owners)) > 1:
                persona = max(set(owners), key=owners.count)
            base["accountable_persona"] = persona
            base.pop("no_linked_control_in_model", None)
        else:
            base["accountable_persona"] = template[model]["accountable_persona"]
            base["note"] = (
                "No related control applies in this operating model. "
                f"The persona stays {template[model]['accountable_persona']}, "
                "and the cell records no_linked_control_in_model."
            )
            base["no_linked_control_in_model"] = True
        threat["accountability"][model] = base


RISK_SPECS = [
    {
        "id": "weakplatformaccountability",
        "name": "AI platform security accountability not enforced",
        "srf_layer": "L4",
        "affected_layers": ["L4"],
        "impact": "Unclear ownership when platform controls fail",
        "attack_surface": "Assignment and documentation of security roles on AI platform systems",
        "layer_rationale": "CMMC AC.L2-3.1.6 requires defining and documenting security roles. On an AI platform, those assignments must name who owns inference, orchestration, and tenant isolation.",
        "accountability": L4_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Other.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["cmmc-2-0.accountability"],
    },
    {
        "id": "staleplatformassessment",
        "name": "AI platform security controls not periodically assessed",
        "srf_layer": "L4",
        "affected_layers": ["L4"],
        "impact": "Unknown effectiveness of platform protections",
        "attack_surface": "Security control assessment for inference and orchestration infrastructure",
        "layer_rationale": "CMMC CA.L2-3.12.1 and NIST SP 800-171 3.12.1 require periodic assessment of security controls. AI serving clusters and API gateways are organizational systems in scope.",
        "accountability": L4_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 7 AI system safety, failures, and limitations; subdomain 7.3 Lack of capability or robustness. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["cmmc-2-0.ca-l2-3-12-1", "nist-sp-800-171.3-12-1"],
    },
    {
        "id": "weakplatformmfa",
        "name": "Privileged access to the AI platform without multifactor authentication",
        "srf_layer": "L4",
        "affected_layers": ["L4"],
        "impact": "Compromise of inference and orchestration administration",
        "attack_surface": "Administrative and network access to AI platform components",
        "layer_rationale": "CMMC IA.L2-3.5.3 and NIST SP 800-171 3.5.3 require multifactor authentication for privileged and network access. Platform consoles that change models, routes, or tenants need the same enforcement.",
        "accountability": L4_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 1 Human safety, security, and wellbeing; subdomain 1.3 Cyberattacks. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["cmmc-2-0.ia-l2-3-5-3", "nist-sp-800-171.3-5-3"],
    },
    {
        "id": "unremediatedplatformflaws",
        "name": "Known vulnerabilities on the AI platform not remediated",
        "srf_layer": "L4",
        "affected_layers": ["L4"],
        "impact": "Exploitation of serving and gateway weaknesses",
        "attack_surface": "Vulnerability remediation on AI platform runtimes",
        "layer_rationale": "CMMC RA.L2-3.11.3 requires remediating vulnerabilities in accordance with risk assessments. Unpatched inference gateways and orchestration nodes leave the platform open to known flaws.",
        "accountability": L4_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 1 Human safety, security, and wellbeing; subdomain 1.3 Cyberattacks. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["cmmc-2-0.ra-l2-3-11-3"],
    },
    {
        "id": "unprotectedplatformtraffic",
        "name": "AI platform traffic and keys not cryptographically protected",
        "srf_layer": "L4",
        "affected_layers": ["L4"],
        "impact": "Exposure of model calls and tenant data in transit",
        "attack_surface": "Encryption of platform sessions and cryptographic key management",
        "layer_rationale": "CMMC SC.L2-3.13.8 and SC.L2-3.13.10 and NIST SP 800-171 3.13.8 require protecting confidentiality and keys during transmission. Inference APIs and control planes that move prompts and outputs must meet those duties.",
        "accountability": L4_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 2 Privacy and confidentiality; subdomain 2.1 Unauthorized disclosure. Partial fit. Causal: Entity AI system, Intent Unintentional, Timing Other.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            "cmmc-2-0.sc-l2-3-13-8",
            "cmmc-2-0.sc-l2-3-13-10",
            "nist-sp-800-171.3-13-8",
        ],
    },
    {
        "id": "incompleteplatformqms",
        "name": "AI platform quality management system incomplete",
        "srf_layer": "L4",
        "affected_layers": ["L4", "L1"],
        "impact": "Platform changes ship without documented compliance controls",
        "attack_surface": "Quality management for AI platform releases and monitoring",
        "layer_rationale": "EU AI Act Article 17 requires a documented quality management system for high-risk AI providers. Platform operators that host regulated models must maintain those policies for inference and change control.",
        "accountability": L4_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["eu-ai-act.art-17"],
    },
    {
        "id": "openplatformfacility",
        "name": "AI platform hosting area without facility access controls",
        "srf_layer": "L4",
        "affected_layers": ["L4"],
        "impact": "Physical access to systems that run clinical AI platforms",
        "attack_surface": "Facility security for servers and equipment that host AI platforms",
        "layer_rationale": "An on-premise or colocated AI inference stack is a facility that must limit who can reach the hardware. This row does not link HIPAA 164.310(a)(2)(i), which covers facility access for contingency operations rather than general facility access, and no existing control specifically covers contingency operations.",
        "accountability": L4_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 2 Privacy and confidentiality; subdomain 2.1 Unauthorized disclosure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Other.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [],
    },
    {
        "id": "unregisteredclinicalplatform",
        "name": "Clinical AI platform interoperability capabilities not registered",
        "srf_layer": "L4",
        "affected_layers": ["L4", "L3"],
        "impact": "Opaque clinical AI interfaces in production",
        "attack_surface": "Registration and testing of clinical platform APIs",
        "layer_rationale": "ONC HTI-1 requires registered interoperability functions and standardized test methods. AI platforms that expose clinical decision interfaces must publish those capabilities before use.",
        "accountability": L4_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 7 AI system safety, failures, and limitations; subdomain 7.4 Lack of transparency or interpretability. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["onc-hti-1.d2", "onc-hti-1.g10"],
    },
    {
        "id": "unscreenedmodelpersonnel",
        "name": "AI Model Provider personnel without required screening",
        "srf_layer": "L5",
        "affected_layers": ["L5"],
        "impact": "Insider risk to model weights and training pipelines",
        "attack_surface": "Personnel screening before access to model development systems",
        "layer_rationale": "CMMC PS.L2-3.9.1 and PS.L2-3.9.2 and NIST SP 800-171 3.9.1 require screening individuals before access and after adverse events. Model labs and artifact stores are in scope.",
        "accountability": L5_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 2 Privacy and confidentiality; subdomain 2.1 Unauthorized disclosure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            "cmmc-2-0.ps-l2-3-9-1",
            "cmmc-2-0.ps-l2-3-9-2",
            "nist-sp-800-171.3-9-1",
        ],
    },
    {
        "id": "noncompliantmodelrelease",
        "name": "High-risk model offered without provider compliance duties",
        "srf_layer": "L5",
        "affected_layers": ["L5", "L1"],
        "impact": "Unauthorized placement of a high-risk model",
        "attack_surface": "Pre-market compliance package for models from the AI Model Provider",
        "layer_rationale": "EU AI Act Article 16 lists provider obligations before a high-risk system is placed on the market. The AI Model Provider must keep documentation, logging, conformity, and corrective-action duties current.",
        "accountability": L5_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 4 Legal and regulatory compliance; subdomain 4.2 Non-compliance with laws. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["eu-ai-act.art-16"],
    },
    {
        "id": "incompletemodelqms",
        "name": "AI Model Provider quality management system incomplete",
        "srf_layer": "L5",
        "affected_layers": ["L5", "L4"],
        "impact": "Model updates ship without documented quality controls",
        "attack_surface": "Quality management for model training, evaluation, and release",
        "layer_rationale": "EU AI Act Article 17 requires provider quality management. For the AI Model Provider layer, that system must cover data management, risk management, and post-market monitoring for the model lifecycle.",
        "accountability": L5_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["eu-ai-act.art-17"],
    },
    {
        "id": "undefinednotifyingauthority",
        "name": "Model conformity assessment without a competent notifying authority",
        "srf_layer": "L5",
        "affected_layers": ["L5", "L1"],
        "impact": "Invalid or unrecognized model conformity pathway",
        "attack_surface": "Designation and oversight of notifying authorities for model assessment",
        "layer_rationale": "EU AI Act Article 28 requires Member States to designate notifying authorities for conformity assessment bodies. A model provider that relies on third-party assessment needs a valid authority chain. This row does not link Article 28, because no existing control mapping cites it as notifying authorities. Article 16 and Article 25 do not fit this harm.",
        "accountability": L5_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 4 Legal and regulatory compliance; subdomain 4.2 Non-compliance with laws. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [],
    },
    {
        "id": "unmeasuredmodelrisk",
        "name": "AI model risk and impact not measured",
        "srf_layer": "L5",
        "affected_layers": ["L5"],
        "impact": "Unknown harm from deployed model behavior",
        "attack_surface": "Measurement of model performance, bias, and impact metrics",
        "layer_rationale": "NIST AI RMF MEASURE 1.1 requires appropriate methods to measure AI risks and impacts. When the AI Model Provider does not measure, customers adopt models without quantified risk.",
        "accountability": L5_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 7 AI system safety, failures, and limitations; subdomain 7.3 Lack of capability or robustness. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["nist-ai-rmf.measure-1-1"],
    },
    {
        "id": "opaquefederalmodelacq",
        "name": "Federal acquisition of AI models lacks required transparency",
        "srf_layer": "L5",
        "affected_layers": ["L5", "L1"],
        "impact": "Agencies buy models without mandated disclosures",
        "attack_surface": "Solicitations and vendor documentation for federal AI models",
        "layer_rationale": "OMB M-25-22 Sections 4(c) and 4(d)(iii) require transparency in solicitations, testing plans, and monitoring for high-impact AI. Those duties reach model artifacts the vendor supplies.",
        "accountability": GOVERNANCE_ACCOUNTABILITY,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            "omb-m-25-22.4c-i",
            "omb-m-25-22.4c-ii",
            "omb-m-25-22.4d-iii-c",
            "omb-m-25-22.4d-iii-e",
            "omb-m-25-22.4d-iii-g",
        ],
    },
    {
        "id": "unqualifiedclinicalmodel",
        "name": "Clinical predictive model without required qualification",
        "srf_layer": "L5",
        "affected_layers": ["L5", "L3"],
        "impact": "Patient harm from unqualified clinical models",
        "attack_surface": "Source attributes and qualification for predictive decision support models",
        "layer_rationale": "ONC HTI-1 170.315(b)(11)(i) requires predictive decision support interventions to include source attributes and qualification. The AI Model Provider must document those attributes on the model it supplies.",
        "accountability": L5_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 3 Misinformation; subdomain 3.1 False or misleading information. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["onc-hti-1.b11-i"],
    },
]


def build_threat(spec):
    obligations = spec.get("obligations", [])
    manual_links = [o for o in obligations if isinstance(o, dict)]
    req_ids = [o for o in obligations if isinstance(o, str)]
    related = spec.get("related_controls")
    if related is None:
        related = []
    return {
        "id": spec["id"],
        "name": spec["name"],
        "ai_exchange": None,
        "dsgai": None,
        "source_url": "https://airisk.mit.edu/risks",
        "impact": spec["impact"],
        "attack_surface": spec["attack_surface"],
        "srf_layer": spec["srf_layer"],
        "affected_layers": spec["affected_layers"],
        "layer_rationale": spec["layer_rationale"],
        "accountability": copy.deepcopy(spec["accountability"]),
        "mappings": {
            "owasp_llm_top10": None,
            "mitre_atlas": None,
            "biml_llm24": None,
            "owasp_dsgai": None,
            "mit_ai_risk_repository": spec["mit_ai_risk_repository"],
            "oecd_ai_principles": "No OECD principle states this harm on this row. AIM is cited at monitor level. The principles record is data/regulations.json id oecd-ai-principles.",
            "oecd_aim": spec["oecd_aim"],
        },
        "related_controls": related,
        "obligations": manual_links,
        "_req_ids": req_ids,
        "_accountability_template": copy.deepcopy(spec["accountability"]),
    }


def main():
    root = repo_root()
    controls_by_full = load_controls_by_full(root)
    threats_path = root / "data" / "threats.json"
    doc = json.loads(threats_path.read_text(encoding="utf-8"))
    draft_ids = {spec["id"] for spec in RISK_SPECS}
    doc["threats"] = [t for t in doc["threats"] if t["id"] not in draft_ids]
    by_req, _ = load_control_index(root)
    stubs = []
    for spec in RISK_SPECS:
        threat = build_threat(spec)
        req_ids = threat.pop("_req_ids")
        if not threat.get("related_controls"):
            seed = set()
            primary = spec["srf_layer"]
            for req_id in req_ids:
                for row in by_req.get(req_id, []):
                    if row.get("layer") != primary:
                        continue
                    seed.add(row["control"])
            threat["related_controls"] = sorted(seed)
        threat["_req_ids"] = req_ids
        stubs.append(threat)
    doc["threats"].extend(stubs)
    threats_path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    allowed = derived_control_rows(str(root))
    for threat in stubs:
        wire_traceable_obligations(threat, threat.pop("_req_ids"), allowed)
        template = threat.pop("_accountability_template")
        align_accountability(threat, controls_by_full, template)
    doc["threats"] = [t for t in doc["threats"] if t["id"] not in draft_ids] + stubs
    new_rows = stubs
    doc["count"] = len(doc["threats"])
    layer_counts = {layer: 0 for layer in ("L1", "L2", "L3", "L4", "L5")}
    for threat in doc["threats"]:
        layer = threat.get("srf_layer")
        if layer in layer_counts:
            layer_counts[layer] += 1
    doc["layer_counts"] = layer_counts
    desc = doc.get("description", "")
    if "nineteen draft L2 and L3 rows" in desc and "draft L4 and L5 rows" not in desc:
        doc["description"] = desc.replace(
            "nineteen draft L2 and L3 rows add business, information, and application risks.",
            "nineteen draft L2 and L3 rows add business, information, and application risks. "
            "Fifteen draft L4 and L5 rows add platform and AI Model Provider risks.",
        )
    l45_fragment = (
        " Draft L4 and L5 rows add slugs such as weakplatformmfa, "
        "incompleteplatformqms, unscreenedmodelpersonnel, and opaquefederalmodelacq."
    )
    conv = doc.get("id_convention", "")
    while conv.count(l45_fragment) > 1:
        conv = conv.replace(l45_fragment, "", 1)
    if l45_fragment not in conv:
        tail = " Those slugs are not external catalog ids."
        if tail in conv:
            conv = conv.replace(tail, l45_fragment + tail, 1)
        else:
            conv = conv.rstrip() + "." + l45_fragment
    doc["id_convention"] = conv
    # Remove accidental duplicate id_convention fragments from an earlier edit.
    while "Draft L2 and L3 rows add slugs such as incompletetechdoc" in doc.get("id_convention", ""):
        l23_fragment = (
            " Draft L2 and L3 rows add slugs such as incompletetechdoc, missinginforecords, "
            "nopremarketconformity, and unlabeledsyntheticout."
        )
        if doc["id_convention"].count(l23_fragment) > 1:
            doc["id_convention"] = doc["id_convention"].replace(l23_fragment, "", 1)
        else:
            break
    verification = doc.setdefault("verification", {})
    verification["platform_model_provider_draft"] = {
        "date": "2026-11-21",
        "method": "MIT domain numbers and subdomain names checked against https://airisk.mit.edu/risks on 2026-11-21. "
        "Obligation links use derived_via_control only where a related control's citation matches a current obligation.",
    }
    threats_path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added {len(new_rows)} threats; total {doc['count']}")


if __name__ == "__main__":
    main()