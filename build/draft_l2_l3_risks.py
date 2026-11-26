#!/usr/bin/env python3
"""Build draft L2/L3 business and usage risk rows for threats.json (PR 3 series)."""
from __future__ import annotations

import copy
import json
from collections import defaultdict
from pathlib import Path

from obligation_kind import citation_pattern, current_obligation
from risk_obligation_links import derived_control_rows
from roca_orphans import cited_requirement_ids, control_slug, load_inputs, repo_root

SRF_MODELS = ("AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS")


L2_ACCOUNTABILITY_TEMPLATE = {
    "AI-SaaS": {
        "accountable_persona": "data-provider",
        "accountable_party": "customer",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "The provider owns managed data planes in this model. The customer is accountable for information it connects or supplies, because the L2 matrix cell is shared and this failure is information the customer governs.",
    },
    "AI-PaaS": {
        "accountable_persona": "data-provider",
        "accountable_party": "customer",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "The customer leads for data pipelines and corpora it owns. The provider owns integrity for data planes it manages.",
    },
    "Agent-PaaS": {
        "accountable_persona": "data-provider",
        "accountable_party": "customer",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "The customer leads for memory, retrieval, and context stores it populates. The provider owns managed state it writes.",
    },
    "IaaS": {
        "accountable_persona": "data-provider",
        "accountable_party": "customer",
        "responsibility": {"customer": "customer-owned", "provider": "provider-managed"},
        "note": "The customer owns the entire information layer in this operating model.",
    },
}

L3_ACCOUNTABILITY_TEMPLATE = {
    "AI-SaaS": {
        "accountable_persona": "application-developer",
        "accountable_party": "customer",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "The SaaS provider builds the application. The customer is accountable for business use and configuration it controls, because the L3 cell is shared.",
    },
    "AI-PaaS": {
        "accountable_persona": "application-developer",
        "accountable_party": "customer",
        "responsibility": {"customer": "customer-owned", "provider": "provider-managed"},
        "note": "The customer builds and operates the application on the provider platform.",
    },
    "Agent-PaaS": {
        "accountable_persona": "application-developer",
        "accountable_party": "customer",
        "responsibility": {"customer": "customer-owned", "provider": "provider-managed"},
        "note": "The customer owns agent definitions and application behavior on the orchestration runtime.",
    },
    "IaaS": {
        "accountable_persona": "application-developer",
        "accountable_party": "customer",
        "responsibility": {"customer": "customer-owned", "provider": "provider-managed"},
        "note": "The customer owns the full application stack.",
    },
}

GOVERNANCE_ACCOUNTABILITY = {
    "AI-SaaS": {
        "accountable_persona": "ai-system-governance",
        "accountable_party": "customer",
        "responsibility": {"customer": "shared", "provider": "provider-managed"},
        "note": "Accountable persona is ai-system-governance for program records that sit above a single data pipeline. The L1 cell is shared; the customer is the accountable party for governance of AI use.",
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
    if threat["id"] in ("unlawfultrainingdata", "unlabeledsyntheticout"):
        return
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
        "id": "incompletetechdoc",
        "name": "Incomplete technical documentation for AI information",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L3", "L5"],
        "impact": "Regulatory and safety traceability",
        "attack_surface": "Documentation for datasets, logs, and models",
        "layer_rationale": "Article 11 requires technical documentation before an AI system is placed on the market. Dataset and processing descriptions sit at the AI Information layer. Model and application sections sit at other layers. This row is the missing or incomplete information record that blocks traceability.",
        "accountability": L2_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment. Checked against https://airisk.mit.edu/risks on 2026-11-21.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["eu-ai-act.art-11"],
    },
    {
        "id": "missinginforecords",
        "name": "Missing logs and records for AI data processing",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L4"],
        "impact": "Forensics and accountability for data use",
        "attack_surface": "Retention of prompts, outputs, and data transformations",
        "layer_rationale": "Article 12 requires automatic logging for certain high-risk systems. Those records are information assets. When logs are missing, investigators cannot reconstruct which data an AI application used.",
        "accountability": L2_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 7 AI system safety, failures, and limitations; subdomain 7.4 Lack of transparency or interpretability. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["eu-ai-act.art-12"],
    },
    {
        "id": "unlawfuldataprocessing",
        "name": "Personal data in AI pipelines processed without applicable principles",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L3"],
        "impact": "Privacy and lawful processing",
        "attack_surface": "Ingestion, retention, and use of personal data for AI",
        "layer_rationale": "GDPR Article 5 sets processing principles. AI training, retrieval, and logging can each process personal data at the information layer. When principles are not applied, the failure is an information-handling act.",
        "accountability": L2_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 2 Privacy and confidentiality; subdomain 2.2 Unlawful or unfair processing. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Other.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["gdpr.art-5"],
    },
    {
        "id": "unencryptedcui",
        "name": "Controlled information not cryptographically protected",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L4"],
        "impact": "Confidentiality of AI information in transit and at rest",
        "attack_surface": "Network paths and stores that carry training or inference data",
        "layer_rationale": "CMMC SC.L2-3.13.1 requires cryptographic mechanisms to protect CUI. AI fine-tune sets, embeddings, and retrieved documents can carry CUI. The control point is the information layer where those assets are stored or moved.",
        "accountability": L2_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 2 Privacy and confidentiality; subdomain 2.1 Unauthorized disclosure. Partial fit. Causal: Entity AI system, Intent Unintentional, Timing Other.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["cmmc-2-0.sc-l2-3-13-1"],
    },
    {
        "id": "unmeasuredaidata",
        "name": "AI information performance and quality not measured",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L3"],
        "impact": "Undetected drift in data quality and model inputs",
        "attack_surface": "Monitoring of datasets, embeddings, and retrieval corpora",
        "layer_rationale": "NIST AI RMF MEASURE functions require tracking performance and risk of AI components. When nobody measures data quality or retrieval performance, bad information reaches the application without a signal.",
        "accountability": L2_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 7 AI system safety, failures, and limitations; subdomain 7.3 Lack of capability or robustness. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            "nist-ai-rmf.measure-2-2",
            "nist-ai-rmf.measure-2-13",
            "nist-ai-rmf.measure-4-2",
        ],
    },
    {
        "id": "unmappedaidata",
        "name": "AI data benefits, costs, and dependencies not mapped",
        "srf_layer": "L2",
        "affected_layers": ["L2"],
        "impact": "Unknown dependencies in AI information supply",
        "attack_surface": "Planning for datasets, third-party feeds, and data sharing",
        "layer_rationale": "MAP 3.2 and MAP 5.2 ask teams to map benefits, costs, and dependencies of AI systems. For information-layer assets, that map must name datasets, feeds, and sharing arrangements.",
        "accountability": L2_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["nist-ai-rmf.map-3-2", "nist-ai-rmf.map-5-2"],
    },
    {
        "id": "unscaledaipolicy",
        "name": "AI risk policies not scaled to systems and processes",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L3"],
        "impact": "Inconsistent protection of AI information",
        "attack_surface": "Governance of data handling across AI programs",
        "layer_rationale": "GOVERN 1.3 scales policies to risk, and MANAGE 4.2 sustains value after deployment. When policies do not reach data-handling teams, information controls stay generic.",
        "accountability": GOVERNANCE_ACCOUNTABILITY,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Other.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["nist-ai-rmf.govern-1-3", "nist-ai-rmf.manage-4-2"],
    },
    {
        "id": "privacylessacquisition",
        "name": "Federal AI acquisition without privacy safeguards",
        "srf_layer": "L2",
        "affected_layers": ["L2"],
        "impact": "Privacy exposure in procured AI data services",
        "attack_surface": "Solicitations and contracts for AI data or models",
        "layer_rationale": "OMB M-25-22 section 3(c) requires privacy protections in AI acquisition. Those protections must appear before the agency accepts data or model services.",
        "accountability": GOVERNANCE_ACCOUNTABILITY,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["omb-m-25-22.3c"],
    },
    {
        "id": "missingato",
        "name": "AI information service used without authorization to operate",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L4"],
        "impact": "Unauthorized production use of AI data planes",
        "attack_surface": "Agency authorization before a data or model service enters production",
        "layer_rationale": "OMB M-25-22 section 4(e)(i) ties authorization to operate to risk acceptance. An AI database or embedding service should not run in production without that sign-off.",
        "accountability": GOVERNANCE_ACCOUNTABILITY,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["omb-m-25-22.4e-i"],
    },
    {
        "id": "untrustworthyclinicalsources",
        "name": "Clinical decision support built on untrustworthy source configuration",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L3"],
        "impact": "Patient harm from bad clinical AI information",
        "attack_surface": "Configuration of clinical knowledge sources and attributes",
        "layer_rationale": "ONC HTI-1 baseline (b)(11) clauses require trustworthy decision support configuration, source attributes, and rules for who may change them. The failure is bad information configuration before the application shows an answer.",
        "accountability": L2_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 3 Misinformation; subdomain 3.1 False or misleading information. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["onc-hti-1.b11-ii", "onc-hti-1.b11-iv", "onc-hti-1.b11-v"],
    },
    {
        "id": "insufficientauditlogs",
        "name": "Insufficient audit records for AI information systems",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L4"],
        "impact": "Undetected misuse of AI data stores",
        "attack_surface": "Audit and accountability logging for AI data access",
        "layer_rationale": "NIST SP 800-171 requirement 3.3.1 requires audit records. AI training stores and retrieval indexes need the same traceability as other CUI systems.",
        "accountability": L2_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 2 Privacy and confidentiality; subdomain 2.1 Unauthorized disclosure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["nist-sp-800-171.3-3-1"],
    },
    {
        "id": "unlawfultrainingdata",
        "name": "Training data without lawful basis or provider security assessment",
        "srf_layer": "L2",
        "affected_layers": ["L2", "L5"],
        "impact": "Regulatory exposure from training corpora",
        "attack_surface": "Collection and curation of generative AI training data",
        "layer_rationale": "China's interim measures require lawful training data and a provider security assessment. No current control cites that obligation. Each operating model stays a gap until a control is approved.",
        "accountability": GAP_GOVERNANCE,
        "mit_ai_risk_repository": "Domain 4 Legal and regulatory compliance; subdomain 4.2 Non-compliance with laws. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            {
                "requirement": "china-genai-interim-measures.training-data",
                "basis": "named_citation",
                "source": {
                    "citation": "Interim Measures Articles 7-8",
                    "url": "https://www.cac.gov.cn/",
                    "document": "china-genai-interim-measures",
                    "note": "Derived. The requirement states provider duties for lawful training data and a security assessment. The text does not state this harm. No related control cites this requirement.",
                },
            }
        ],
        "related_controls": [],
    },
    {
        "id": "nopremarketconformity",
        "name": "High-risk AI application lacks conformity assessment",
        "srf_layer": "L3",
        "affected_layers": ["L3", "L5"],
        "impact": "Unauthorized placement of high-risk AI",
        "attack_surface": "Pre-market assessment of AI applications",
        "layer_rationale": "Articles 43 and Annexes VI and VII set conformity assessment before a high-risk system is placed on the market. Article 52 sets the conformity procedure. Article 47 covers the EU declaration. These duties attach to the application that is offered or deployed.",
        "accountability": L3_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 4 Legal and regulatory compliance; subdomain 4.2 Non-compliance with laws. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            "eu-ai-act.annex-vi",
            "eu-ai-act.annex-vii",
            "eu-ai-act.art-43",
            "eu-ai-act.art-47",
            "eu-ai-act.art-52",
        ],
    },
    {
        "id": "unpatchedappvulns",
        "name": "Known vulnerabilities in the AI application not remediated",
        "srf_layer": "L3",
        "affected_layers": ["L3", "L4"],
        "impact": "Exploitation of application weaknesses",
        "attack_surface": "Vulnerability scanning and patching of AI application components",
        "layer_rationale": "CMMC RA.L2-3.11.2 and NIST SP 800-171 3.11.2 require scanning and timely remediation. AI plugins, orchestrators, and agent runtimes are in scope.",
        "accountability": L3_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 1 Human safety, security, and wellbeing; subdomain 1.3 Cyberattacks. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["cmmc-2-0.ra-l2-3-11-2", "nist-sp-800-171.3-11-2"],
    },
    {
        "id": "weakappaccess",
        "name": "AI application access not limited to authorized users",
        "srf_layer": "L3",
        "affected_layers": ["L3"],
        "impact": "Unauthorized use of AI application functions",
        "attack_surface": "Identification and authentication for AI application users and agents",
        "layer_rationale": "NIST SP 800-171 3.1.1 limits system access to authorized users. Agent tools and admin consoles need the same enforcement.",
        "accountability": L3_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 1 Human safety, security, and wellbeing; subdomain 1.3 Cyberattacks. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["nist-sp-800-171.3-1-1"],
    },
    {
        "id": "bypassedhumanreview",
        "name": "High-impact AI application action without human review or appeal",
        "srf_layer": "L3",
        "affected_layers": ["L3", "L1"],
        "impact": "Harmful or unfair automated decisions",
        "attack_surface": "Human review, fail-safe, and appeal for AI application outputs",
        "layer_rationale": "OMB M-25-21 requires human oversight and appeal paths for certain agency AI. GOVERN 4.2 and MANAGE 3.2 require human review procedures in the AI RMF. The application layer must implement those paths before an action takes effect.",
        "accountability": L3_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 5 Human-computer interaction; subdomain 5.2 Loss of human agency and autonomy. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            "omb-m-25-21.4b-v",
            "omb-m-25-21.4b-vi",
            "nist-ai-rmf.govern-4-2",
            "nist-ai-rmf.manage-3-2",
        ],
    },
    {
        "id": "undeployedtesting",
        "name": "AI application deployed without required testing",
        "srf_layer": "L3",
        "affected_layers": ["L3"],
        "impact": "Unknown failures in production AI behavior",
        "attack_surface": "Pre-deployment testing and validation of AI applications",
        "layer_rationale": "OMB M-25-22 section 4(d)(i) requires testing proposals before award. MAP 2.1, MAP 3.4, and MEASURE 2.9 require task and context testing. The failure is shipping an application without those tests.",
        "accountability": L3_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 7 AI system safety, failures, and limitations; subdomain 7.3 Lack of capability or robustness. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            "omb-m-25-22.4d-i",
            "nist-ai-rmf.map-2-1",
            "nist-ai-rmf.map-3-4",
            "nist-ai-rmf.measure-2-9",
        ],
    },
    {
        "id": "stagnantimprovement",
        "name": "Deployed AI application not improved after incidents or feedback",
        "srf_layer": "L3",
        "affected_layers": ["L3", "L1"],
        "impact": "Repeated harm from the same application failure",
        "attack_surface": "Post-deployment updates to AI application behavior",
        "layer_rationale": "MANAGE 2.2, GOVERN 1.4, and GOVERN 6.2 require continual improvement and feedback use. When teams do not change the application after incidents, the same harm recurs.",
        "accountability": L3_ACCOUNTABILITY_TEMPLATE,
        "mit_ai_risk_repository": "Domain 7 AI system safety, failures, and limitations; subdomain 7.3 Lack of capability or robustness. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            "nist-ai-rmf.manage-2-2",
            "nist-ai-rmf.govern-1-4",
            "nist-ai-rmf.govern-6-2",
        ],
    },
    {
        "id": "incompletevendorai",
        "name": "Procured AI application lacks required documentation package",
        "srf_layer": "L3",
        "affected_layers": ["L3", "L2"],
        "impact": "Unknown behavior of third-party AI components",
        "attack_surface": "Contract documentation for AI applications",
        "layer_rationale": "OMB M-25-22 section 3(d)(v) requires documentation for procured AI. Without it, the agency cannot trace what the application does with data or models.",
        "accountability": GOVERNANCE_ACCOUNTABILITY,
        "mit_ai_risk_repository": "Domain 6 Organizational and institutional risks; subdomain 6.5 Governance failure. Partial fit. Causal: Entity Human, Intent Unintentional, Timing Pre-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": ["omb-m-25-22.3d-v"],
    },
    {
        "id": "unlabeledsyntheticout",
        "name": "Synthetic AI output not labeled or watermarked",
        "srf_layer": "L3",
        "affected_layers": ["L3", "L5"],
        "impact": "Users cannot distinguish synthetic content",
        "attack_surface": "Application output labeling for generative AI",
        "layer_rationale": "China's interim measures require labeling synthetic content. The application shows the output. No current control cites that obligation. Each operating model stays a gap until a control is approved.",
        "accountability": GAP_GOVERNANCE,
        "mit_ai_risk_repository": "Domain 3 Misinformation; subdomain 3.2 Fake or deceptive content. Partial fit. Causal: Entity AI system, Intent Unintentional, Timing Post-deployment.",
        "oecd_aim": "https://oecd.ai/en/incidents (monitor). No incident page was retrieved for this row.",
        "obligations": [
            {
                "requirement": "china-genai-interim-measures.content-labeling",
                "basis": "named_citation",
                "source": {
                    "citation": "Interim Measures content labeling",
                    "url": "https://www.cac.gov.cn/",
                    "document": "china-genai-interim-measures",
                    "note": "Derived. The requirement states labeling duties for synthetic content. The text does not state this harm. No related control cites this requirement.",
                },
            }
        ],
        "related_controls": [],
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
    desc = doc.get("description", "")
    if "Eleven draft L1 rows" in desc:
        doc["description"] = desc.replace(
            "Eleven draft L1 rows add business and usage risks.",
            "Eleven draft L1 rows and nineteen draft L2 and L3 rows add business, information, and application risks.",
        )
    conv = doc.get("id_convention", "")
    if "unreportedincidents)." in conv and "unlawfultrainingdata" not in conv:
        doc["id_convention"] = conv.replace(
            "unreportedincidents).",
            "unreportedincidents). Draft L2 and L3 rows add slugs such as incompletetechdoc, missinginforecords, nopremarketconformity, and unlabeledsyntheticout.",
        )
    verification = doc.setdefault("verification", {})
    verification["information_application_draft"] = {
        "date": "2026-11-21",
        "method": "MIT domain numbers and subdomain names checked against https://airisk.mit.edu/risks on 2026-11-21. Obligation links use derived_via_control only where a related control's citation matches a current obligation.",
    }
    threats_path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added {len(new_rows)} threats; total {doc['count']}")


if __name__ == "__main__":
    main()