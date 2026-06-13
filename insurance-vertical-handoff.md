# Insurance Vertical Plan: Handoff Summary

Working brief for building the insurance-targeted SRF control schema. Context, decisions, and build guidance below. Follow CLAUDE.md writing rules (no em dashes, no AI filler phrases). Read the "Lessons from prior builds" section before writing anything; it exists because the finance and healthcare builds each shipped avoidable defects.

## Why insurance, why now (June 2026)

The finance vertical filled the gap SR 26-2 left open; healthcare did the same for FDA TPLC. Insurance has the same shape of gap with a harder deadline:

1. The NAIC AI Systems Evaluation Tool is in a twelve-state multistate pilot running January through September 2026. Examiners will use a standardized framework to review insurer AI governance during market conduct exams. Insurers know the review is coming but have no implementation schema. Publishing a crosswalk while the pilot runs is the wedge.
2. Colorado amended Regulation 10-1-1 (effective October 15, 2025) expands ECDIS governance obligations beyond life insurance to private passenger auto and health benefit insurers. On July 1, 2026, all components of the governance structure and risk management framework must be available to the Division on request. That deadline is weeks away; auto and health insurers are scrambling for exactly this artifact.
3. The NAIC Model Bulletin on the Use of AI Systems by Insurers (December 2023) is adopted in roughly half the states. It requires a written AIS Program covering governance, risk management, internal controls, and third-party oversight, but prescribes no control catalog, no thresholds, and no evidence model. Same gap as SR 26-2.

The SRF contribution is the same as finance: named accountable persona per control, measurable thresholds, machine-readable evidence. Nobody else in the insurance space assigns accountability per control.

## Key external facts (verified June 2026)

- NAIC Model Bulletin (Dec 2023): adopted or substantially adopted in about half the states. Requires a written AIS Program; emphasizes governance, risk management and internal controls, and third-party AI oversight. Verify current adoption count before publishing.
- NAIC AI Systems Evaluation Tool: multistate pilot January to September 2026, twelve participating states. Gives examiners a standardized review framework for insurer AI governance in market conduct exams. Verify the tool's dimension names against NAIC materials before crosswalking; do not invent section IDs.
- Colorado Regulation 10-1-1 (3 CCR 702-10): original effective November 14, 2023 (life); amended version effective October 15, 2025 extends to private passenger auto and health benefit plans. Governance framework must be available to the Division on request from July 1, 2026 for the newly covered lines. A separate quantitative testing regulation for life insurance is in draft; mark testing-standard mappings TBD.
- NYDFS Insurance Circular Letter No. 7 (July 2024): AI and external consumer data in underwriting and pricing for NY-licensed insurers. Requires governance frameworks, fairness analysis, senior management and board accountability.
- EU AI Act: risk assessment and pricing in life and health insurance is high-risk under Annex III. Full high-risk compliance from August 2026.
- Third-party dimension is bigger than in banking: ECDIS vendors, claims-automation vendors, and rating-model vendors dominate. The NAIC bulletin makes insurers accountable for vendor AI. This maps directly to SRF operating models.

## Architecture decision: reuse the three planes

Same structure as finance. Do not redesign.

1. Accountability plane: SRF layers and personas. Reuse the finance persona set where it fits (ai-system-governance, data-provider, application-developer, agentic-platform-provider, ai-platform-provider, model-provider). Insurance-specific persona naming (for example actuarial-review) only if a control genuinely has no fit; prefer reuse.
2. Control plane: per-layer control objects with thresholds and parameters, keyed to an insurance lifecycle: design-development (DEV), validation-testing (VAL), ongoing-monitoring (MON), third-party-oversight (TPO). TPO replaces finance's effective-challenge as the fourth stage because third-party AI oversight is the distinctive insurance obligation. Map control IDs to: NAIC Model Bulletin sections, NAIC Evaluation Tool dimensions, CO Reg 10-1-1 sections, NYDFS CL 7, EU AI Act articles, OWASP LLM Top 10.
3. Evidence plane: OCSF v1.8.0, same as finance. Insurance security telemetry runs on the same SIEM stack as banking. Where a control's evidence is a document or exam artifact rather than telemetry (common in L1), say so honestly in the evidence field; do not force OCSF onto records-management controls.

Operating models (four, parallel to finance): AI-SaaS, AI-PaaS, Agent-Ops (agentic AI in claims, underwriting, or service workflows), Vendor-Model (third-party predictive models and ECDIS vendors; the insurance-distinctive model). Every control declares which models it applies to.

ID convention: SRF-{layer}-{DEV|VAL|MON|TPO}-{seq}. Schema metadata: schema_version 0.1, srf_version 1.0, industry "insurance".

## Lessons from prior builds (do not repeat)

1. No em dashes anywhere: HTML, JSON strings, xlsx cells. The healthcare build shipped 228 of them; all had to be swept. Use colons in label-style strings, commas in prose.
2. param_type on every control, using the healthcare vocabulary: zero-tolerance, verification, tier-configurable. The finance build left param_type off 33 of 40 controls and used a divergent vocabulary; do not copy finance here.
3. Any count stated in page copy must be computed from the JSON, not estimated. The healthcare how-to claimed "18 controls" where the data said 31, and claimed 30% filtering where the max was 20%.
4. Do not invent regulatory citation IDs or dates. The healthcare build conflated the 2023 PCCP Guiding Principles with the August 2025 final PCCP guidance. Mark unverified mappings TBD with a verification note, exactly as the finance schema does, and carry a mapping_status_note in the JSON.
5. Any xlsx or downloadable artifact must be generated programmatically from the controls JSON so it cannot drift. The finance workpaper shipped with seven nonexistent control IDs and mismatched titles because it was hand-built against a stale draft.
6. Controls browser requirements: fetch the JSON, filter sidebar, search input, escHtml on every interpolated field, keyboard operability (Enter/Space) with aria-expanded on expandable cards, global underscore replace in mapping labels, hide TBD and N/A mappings from cards.
7. Every page carries the experimental-schema notice (amber callout used on finance and healthcare pages): proposed extension, not part of CoSAI SRF v1.0, not endorsed by CoSAI or any regulator.
8. Directory and file naming: /insurance/ and data/insurance-controls.json. Match the healthcare naming precedent (industry word, not a synonym).
9. Hub page persona listings must match the JSON exactly, including layers with split persona ownership.

## Deliverables to build

1. `/insurance/` hub page: positioning is "the schema examiners will recognize." Stat strip, context block (NAIC pilot, CO July 1 deadline, NYDFS), section cards, schema design strip, layer coverage, crosswalk pills. Flip the industries page insurance card to Live.
2. `data/insurance-controls.json`: 40 controls, distributed roughly 9/8/8/8/7 across L1 to L5 to match the sibling schemas, each with persona, lifecycle stage, operating models, mappings, threshold tuple with param_type, and OCSF or document evidence pointer.
3. `/insurance/how-to/`: written for the AI governance lead preparing for a market conduct exam and the Colorado framework-availability obligation. Five steps: classify lines of business and regulatory scope, select operating model, map personas, set tier parameters (tier by line of business and consumer impact, not bank-style materiality), assemble the exam-ready evidence package.
4. `/insurance/controls/`: controls browser meeting all requirements in lesson 6.
5. Exam-readiness workpaper xlsx, generated from the JSON (Instructions, Tier Parameters, Persona Mapping, Exam Evidence Log).

## Example controls per layer (starting points)

- L1: AIS Program document currency and board approval (NAIC bulletin core requirement); AI system inventory coverage; third-party AI vendor register with named accountable officer; adverse-decision appeal process documentation; governance framework availability readiness (CO 10-1-1 July 2026 obligation).
- L2: ECDIS source documentation and permissible-purpose verification; protected-class proxy variable screening; training data representativeness by line of business; input drift monitoring (PSI); consumer data minimization in agent context stores.
- L3: adverse-action explanation coverage (reason codes for declines and pricing); unfair-discrimination outcome testing cadence; prompt injection defense for consumer-facing AI; human review gate for adverse underwriting and claims decisions; agentic task boundary enforcement for claims automation.
- L4: model gateway authentication; guardrail configuration baseline; PII encryption and access monitoring; vendor-model isolation and egress control; audit log completeness.
- L5: model card with intended line-of-business statement; vendor model due-diligence evidence (NAIC third-party oversight); pre-deployment fairness evaluation; artifact signing; post-deployment performance and drift disclosure SLA from vendors.

## Distribution sequence

State regulator and trade channel first: the NAIC pilot states and industry groups (APCIA, ACLI, NAMIC) are the finance-FINOS analog. Colorado-regulated auto and health insurers are the urgent buyers before July 1. CSA AICM alignment second, CoSAI contribution third, consistent with the finance plan.

## Sources

- NAIC AI issue brief (March 2026, includes Evaluation Tool pilot): https://content.naic.org/sites/default/files/ai-issue-brief.pdf
- NAIC Model Bulletin adoption tracking: https://www.mcdermottlaw.com/insights/state-regulators-address-insurers-use-of-ai-11-states-adopt-naic-model-bulletin/
- Amended CO Regulation 10-1-1 text: https://www.insurereinsure.com/wp-content/uploads/sites/919/2025/08/Amended-Regulation-10-1-1.pdf
- CO expansion analysis (auto and health, July 2026 availability date): https://www.insurereinsure.com/2025/08/27/colorado-division-of-insurance-expands-ai-governance-and-framework-regulation-to-private-passenger-auto-and-health-benefit-plan-insurers/
- NYDFS Circular Letter No. 7: https://complianceconcourse.willkie.com/articles/nydfs-adopts-circular-letter-on-the-use-of-ai-in-insurance/
- Sibling schemas for structural reference: data/finance-controls.json, data/healthcare-controls.json; finance-vertical-handoff.md for the original three-plane rationale.
