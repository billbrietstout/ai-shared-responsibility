# Finance Vertical Plan: Handoff Summary

Working brief for continuing development of the finance-targeted SRF security schema. Context, decisions, and build guidance below. Follow CLAUDE.md writing rules (no em dashes, no AI filler phrases).

## Project assessment (June 2026)

The site operationalizes the CoSAI AI Shared Responsibility Framework (5 layers, 8 personas mapped to ISO/IEC 22989 roles, 4 operating models including Agent-PaaS). Its differentiators against Microsoft/AWS-style AI shared responsibility models:

1. Single accountable party per component (RACI discipline, not "shared" hand-waving)
2. Agent-PaaS as a first-class operating model; ahead of the market
3. Machine-readable data layer (layers.json, personas.json, matrix.json, regulations.json with 180-day staleness badges) plus client-side assessment wizards mapped to AICM, OWASP LLM Top 10, EU AI Act

Adoption thesis: cloud took off when the cloud SRM became contract boilerplate. Enterprise AI is stalled the same way; an accountable-person-per-component framework is the missing contract primitive. Beachhead vertical: financial services (existing MRM culture, named-accountability regimes, regulator demand). Highest-need vertical: healthcare (longest liability chain); go there second with the finance casebook.

## Key external facts (verified June 2026)

- SR 26-2 (Fed/OCC/FDIC, April 2026) replaced SR 11-7. It explicitly puts generative and agentic AI OUT of scope while telling banks to apply existing MRM principles (materiality, ongoing monitoring, effective challenge). This scope gap is the opening the SRF finance schema fills.
- OCSF v1.8.0 (March 2026) added a native `ai_operation` profile with `ai_model` and `message_context` objects, token usage metrics, and role-based interaction tracking. ITU ratification expected June 2026.
- FINOS AI Governance Framework v2.0 has an agentic AI risk catalogue cross-referenced to OWASP, MITRE, EU AI Act. The FINOS Common Controls for AI Services (CC4AI) initiative is backed by Citi, Morgan Stanley, BMO, RBC, BofA plus Microsoft, Google Cloud, AWS. FINOS lacks accountability assignment per control; that is the SRF contribution.

## Architecture decision: three planes

Do NOT encode thresholds into OCSF. OCSF normalizes events, it is not a control language.

1. Accountability plane (exists): personas.json + matrix.json say who is accountable per layer per operating model.
2. Control plane (to build): per-layer control objects with thresholds and parameters, keyed to the MRM lifecycle (development, independent validation, ongoing monitoring, effective challenge). Map control IDs to FINOS AIGF, CSA AICM, SR 26-2 sections, EU AI Act. Add what FINOS lacks: accountable persona per control and operating-model applicability.
3. Evidence plane (OCSF): each threshold names the OCSF event class and attribute that proves it.

Control object shape:

```json
{
  "id": "SRF-L4-MON-003",
  "layer": "L4",
  "component": "Guardrails & Safety Systems",
  "accountable_persona": "ai-platform-provider",
  "operating_models": ["AI-SaaS", "AI-PaaS", "Agent-PaaS"],
  "mrm_stage": "ongoing-monitoring",
  "mappings": { "finos_aigf": "AIR-DET-015", "aicm": "TBD", "sr26_2": "TBD", "eu_ai_act": "TBD" },
  "threshold": {
    "metric": "guardrail_bypass_rate",
    "evidence": { "ocsf_class": "ai_operation", "attribute": "TBD" },
    "operator": "<=",
    "param": "tier-defined",
    "window": "24h",
    "breach_action": "escalate-l1-governance"
  }
}
```

ID convention: SRF-{layer}-{stage DEV|VAL|MON}-{seq}. Verify all TBD mapping IDs against the actual FINOS/AICM/OCSF documents before publishing; do not invent IDs.

Scaling rule: the schema defines parameters and measurement methods, never fixed values. Institutions set values per model tier by materiality (SR 26-2's risk-based approach). Same schema for a community bank and a GSIB; only the tier table differs.

## Deliverables to build

1. `/finance/` section on the site: overview page positioning SRF as the bridge for what SR 26-2 left out of scope.
2. `/data/finance-controls.json`: the control schema, seeded with roughly 5 to 10 controls per layer (L1 to L5), each with persona, MRM stage, mappings, threshold tuple.
3. Validator's how-to guide (`/finance/validators-guide/`): written for second line of defense, not security teams. How a model validator consumes OCSF evidence to perform effective challenge per layer. This is the document an MRM head hands to examiners.
4. SRF-to-OCSF mapping note for contribution through CoSAI; layer/persona/threshold structure proposed to FINOS AIGF and CC4AI.

Follow ARCHITECTURE.md conventions: directory-per-page, root-relative paths, data in /data/, nav entry in shared/components.js, no build step, no external runtime requests.

## Example controls per layer (starting points)

- L1: AI risk appetite statement approved with named accountable executive; model tier classification coverage 100%
- L2: training/RAG data drift (PSI threshold per tier); data classification coverage of AI-accessible stores
- L3: prompt injection detection rate; output filter block-rate monitoring; tool-execution authorization failures
- L4: guardrail bypass rate; gateway authn failures; confidential compute attestation for tier-1 models
- L5: model signature verification at load; model card completeness; vulnerability disclosure SLA

## Distribution sequence

FINOS contribution first (the banks are in the room), CSA AICM alignment second, OASIS/CoSAI standard track third. Long-term vision: registry of published machine-readable responsibility statements ("OpenTelemetry of AI governance").

## Sources

- SR 26-2: https://www.federalreserve.gov/supervisionreg/srletters/SR2602.htm
- FINOS AIGF v2.0: https://www.finos.org/blog/finos-ai-governance-framework-v2.0-addressing-agentic-ai-risks-in-a-rapidly-evolving-landscape
- FINOS CC4AI: https://www.finos.org/press/global-financial-institutions-and-technology-leaders-collaborate-under-finos-to-launch-open-source-common-controls-for-ai-services
- OCSF v1.8.0: https://devops.com/future-proofing-the-foundation-for-ai-ready-security-operations/
- OCSF ITU: https://aws.amazon.com/blogs/opensource/ocsf-achieves-itu-support-powering-ai-ready-security-operations/
- CoSAI SRF announcement: https://www.coalitionforsecureai.org/whos-responsible-when-ai-goes-wrong-a-new-framework-aims-to-answer-that-question/
