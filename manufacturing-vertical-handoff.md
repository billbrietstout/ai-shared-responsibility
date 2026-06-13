# Manufacturing Vertical: Handoff Brief

Working brief for building the manufacturing SRF control schema. Context, decisions, and build guidance follow. Follow CLAUDE.md writing rules (no em dashes, no AI filler phrases). Read "Lessons from prior builds" before writing anything.

---

## Why manufacturing, why now (June 2026)

Finance filled the SR 26-2 gap. Healthcare filled the FDA TPLC gap. Insurance filled the NAIC exam gap. Public sector filled the M-25-21 gap. Defense filled the CMMC/DoD RAI gap. Manufacturing has three converging deadlines that create the same shape of opening:

1. **August 2, 2026**: EU AI Act high-risk compliance deadline. Providers of high-risk AI systems must complete conformity assessments, register systems in the EU AI database, implement a quality management system, and activate post-market monitoring before placing a system on the market. Deployers must implement human oversight, retain automated logs for at least six months, and conduct Fundamental Rights Impact Assessments (FRIAs) where required. Many manufacturers deploy AI systems that qualify as high-risk under Annex III (safety-critical systems, critical infrastructure) or as safety components under the EU Machinery Regulation, which triggers automatic high-risk classification. The EU AI Act provides no control catalog, no thresholds, and no evidence model for meeting these obligations. Same shape of gap as every prior vertical.

2. **January 20, 2027**: EU Machinery Regulation (EU) 2023/1230 applies. It replaces Directive 2006/42/EC and introduces explicit AI and machine learning requirements: Annex I items 5 and 6 define "safety components with fully or partially self-evolving behaviour using machine learning approaches ensuring safety functions" and the machinery embedding them as high-risk. An AI system that is a safety component under the Machinery Regulation is automatically a high-risk AI system under the AI Act. Manufacturers have under seven months from the AI Act deadline to prepare for the Machinery Regulation deadline; the compliance work is the same work, but no schema connects the two.

3. **IEC 62443 and the OT gap**: IEC 62443 is the global industrial cybersecurity standard for OT/ICS environments. ISA published ISA-TR62443-2-2-2025 in December 2025. The standard defines security zones, conduit models, and security levels for industrial automation and control systems. But it was not designed for AI governance: it has no concept of model drift, no AI-specific accountability assignment, and no evidence model for AI outputs. The SRF fills the same gap here as in every other vertical: named accountable persona per control, measurable thresholds, machine-readable evidence.

Additional signal: ISO 42001:2023 (AI management system) is gaining adoption as the quality management system anchor for EU AI Act Article 17 compliance. But ISO 42001 assigns no accountable party per control and provides no thresholds. NIST published a preliminary draft of the Cybersecurity Framework Profile for Artificial Intelligence (Cyber AI Profile) on December 16, 2025; the Trustworthy AI in Critical Infrastructure profile is still in development. ISA published a position paper "Industrial AI and Its Impact on Automation" (November 2025) endorsing ISA/IEC 62443 as the OT AI governance anchor but noting the gap in AI-specific controls. The practitioner community is ready for a schema that bridges these standards.

---

## Key external facts (verified June 2026)

- **EU AI Act (Regulation 2024/1689)**: Entered into force August 2, 2024. Prohibited practices effective February 2, 2025. GPAI model obligations effective August 2, 2025. **High-risk system provider and deployer obligations effective August 2, 2026.** High-risk AI includes Annex III systems (critical infrastructure, safety systems, employment) and products covered by harmonized legislation (including machinery) where the AI is a safety component. Conformity assessment routes: self-assessment (most cases) or third-party (some Annex III). Registration in EU AI database required before market placement.
- **EU Machinery Regulation (EU) 2023/1230**: Applies from **January 20, 2027**. Annex I item 5: safety components using machine learning that ensure safety functions. Item 6: machinery embedding such components. These are automatically high-risk AI under the AI Act. Manufacturers must protect safety functions against third-party attacks for the operational lifetime of the machine.
- **IEC 62443 series**: Global OT/ICS cybersecurity standard. ISA-TR62443-2-2-2025 (December 2025): security protection schemes for IACS. The zone-and-conduit model defines security zones (collections of assets with equivalent security requirements) and conduits (communications paths between zones). Security levels SL 1-4. No AI-specific controls exist in the current series.
- **ISO 42001:2023**: First certifiable AI management system standard. Relevant as the EU AI Act Article 17 quality management system anchor. Voluntary. Assigns no accountable party per control; no thresholds. Structural complement to the SRF, not a substitute.
- **NIST Cyber AI Profile**: Preliminary draft published December 16, 2025. Uses NIST CSF 2.0 with three AI Focus Areas: Secure, Detect, Thwart. Still in comment period; not yet final. Mark as TBD in mappings.
- **NIST Trustworthy AI in Critical Infrastructure Profile**: In development as of June 2026. Scoped to OT, ICS, and cyber-physical environments. Do not cite; not yet published.
- **ISA position paper "Industrial AI and Its Impact on Automation"** (November 2025): Endorses ISA/IEC 62443 as the OT AI governance framework. Notes AI's roles in predictive maintenance, digital twins, robotics, real-time optimization. Calls for transparency, security, reliability, and OT standards alignment.
- **NIST AI RMF 1.0 and the Generative AI Profile (NIST-AI-600-1)**: Stable mapping targets. Use for all applicable controls.
- **OWASP LLM Top 10**: Stable mapping target for L3/L5 controls involving model inputs, outputs, and agent actions.
- **IEC 61508**: Functional safety for E/E/PE safety-related systems (SIL 1-4). Applies where AI is integrated into safety-instrumented systems (SIS). Section numbering is complex; mark all IEC 61508 mappings TBD with a `mapping_status_note` and cite only part numbers (IEC 61508-1 through IEC 61508-7), not specific clauses.

---

## Architecture: three planes, manufacturing additions

Same structure as all prior verticals. Do not redesign.

**1. Accountability plane**: Reuse the six existing personas (`ai-system-governance`, `data-provider`, `application-developer`, `agentic-platform-provider`, `ai-platform-provider`, `model-provider`). The how-to guide maps these to manufacturing roles (Plant AI Safety Officer / VP Manufacturing, OT Data Manager, OT/MES Engineer, Automation Platform Owner, OT Infrastructure/ICS Security Team, AI Model Vendor / Equipment OEM). Do not mint job-title personas in the JSON.

**2. Control plane**: Per-layer control objects keyed to a manufacturing AI lifecycle:
- `design` — AI system design, EU AI Act risk classification, safety requirements specification, OT architecture review
- `validation` — Factory acceptance testing (FAT), site acceptance testing (SAT), conformity assessment, safety validation, FRIA
- `ops` — Operational deployment and continuous monitoring
- `change` — Change management for model and software updates in OT environments (the distinctive manufacturing stage; OT systems cannot be patched on the IT cycle)

ID convention: `SRF-{layer}-{DES|VAL|OPS|CHG}-{seq}` (three-digit seq, zero-padded).
Schema metadata: `schema_version: "0.1"`, `srf_version: "1.0"`, `industry: "manufacturing"`.

**Two new fields** (not in sibling schemas — add to every control):
- `ot_applicability`: `"ot-only"` (control applies only to OT/ICS-deployed AI), `"it-only"` (IT-side AI), or `"both"`
- `eu_ai_act_risk_class`: `"high-risk"`, `"limited-risk"`, `"minimal-risk"`, or `"N/A"` per the system's likely classification; use `"N/A"` for controls that are EU AI Act-agnostic

**3. Evidence plane**: OCSF v1.8.0. Governance documents (EU AI Act technical file, FRIA, FAT/SAT report, conformity assessment certificate, safety case, change record) are named explicitly. IEC 61508 SIL assessments and safety case documents exist as classified documents in some contexts; note document type and custodian role only, no URL.

**Operating models** (four):
- `AI-SaaS` — cloud AI services for IT-side manufacturing (predictive maintenance SaaS, supply chain optimization, cloud-based quality management)
- `OT-Edge` — AI deployed on edge hardware within the OT/ICS network (condition monitoring on PLCs/SCADA, visual quality inspection at the production line, adaptive process control) — the distinctive manufacturing model; security zone and conduit requirements apply
- `Product-Embedded` — AI embedded in products placed on the EU market (robotic systems, smart machinery, cobots, AI-enabled tools); EU AI Act Annex I / Machinery Regulation obligations apply to the placing-on-market actor
- `AI-PaaS` — platform-based (digital twin platforms, cloud MES, IIoT data platforms, model management infrastructure)

**Responsibility split values**:
- `manufacturer` — the manufacturing organization deploying or placing the AI system on the market
- `equipment-oem` — the OEM supplying the AI-enabled machine, robot, or system
- `ai-vendor` — the AI software or model vendor
- `system-integrator` — the SI who integrated AI into the plant or product
- `shared` — split between parties; the accountable party must document the split

**Regulatory crosswalk fields** (mappings object on every control):
```json
{
  "eu_ai_act": "Article TBD / Annex TBD",
  "eu_machinery_reg": "Annex I item TBD",
  "iec_62443": "ISA-62443-2-1 Section TBD",
  "iso_42001": "Section TBD",
  "nist_ai_rmf": "GOVERN 1.1",
  "iec_61508": "TBD",
  "nist_cyber_ai": "TBD",
  "owasp_llm": "N/A"
}
```

Mark every unverified section number TBD with a `mapping_status_note` field. EU AI Act and Machinery Regulation article numbering are exactly the kind of thing that gets invented incorrectly; cite only from the regulation text. IEC 61508 section numbering is similarly hazardous.

---

## Lessons from prior builds (do not repeat)

1. **No em dashes anywhere**: HTML, JSON strings, xlsx cells. Healthcare shipped 228; all had to be swept. Check with `grep -r " -- \|—"`.
2. **`param_type` on every threshold**: `zero-tolerance`, `verification`, or `tier-configurable`. Use exactly these three values; do not invent variations. Binary document/artifact completion checks (plan exists, certificate on file, test completed) must use `verification` with `param='true'` and `operator='=='`; do not use `zero-tolerance` for these. Hard security events (unauthorized access count, safety bypass count) use `zero-tolerance`. Quantitative metrics with configurable bounds use `tier-configurable`.
3. **Counts in page copy must come from the JSON**: Run `jq '.controls | length'` before hardcoding any number. Per-layer counts must match the JSON.
4. **Do not invent regulatory citation IDs, section numbers, or dates**: Mark unverified mappings TBD with a `mapping_status_note`. EU AI Act article numbers, IEC 62443 section numbers, and IEC 61508 clause references are all high-risk for hallucination. Cite only what you can verify against the actual text.
5. **xlsx must be generated programmatically from the JSON**: Never hand-code.
6. **Controls browser requirements**: fetch the JSON, filter sidebar, search input, `escHtml` on every interpolated field, keyboard operability (Enter/Space) with `aria-expanded` on expandable cards, global underscore replace in mapping labels, hide TBD and N/A mappings from display. New filter dimensions for manufacturing: `ot_applicability` and `eu_ai_act_risk_class`.
7. **Experimental-schema notice (amber callout) on every page**: "Proposed extension of the CoSAI Shared Responsibility Framework, developed independently to demonstrate the approach. Not part of CoSAI SRF v1.0 and not endorsed by CoSAI, the European Commission, ISA, IEC, or any standards body or government agency. EU AI Act and EU Machinery Regulation references must be verified against current regulatory text before use in compliance submissions."
8. **Hub page persona and layer counts must match the JSON exactly**: Run a diff after generating the JSON before writing any sub-page copy.
9. **IEC 61508 evidence**: Safety case documents and SIL assessments may be confidential. Do not claim they are accessible via URL. Note document type, custodian role (functional safety engineer, safety officer), and access path only.
10. **`ot_applicability` and `eu_ai_act_risk_class` are new fields**: Add them to every control. The controls browser must expose both as filter dimensions. Mirror the defense build's approach with `nss_applicability` and `il_applicability`.
11. **Industries page update**: Add the manufacturing card with accent color `--mfg` (use `#b45309` — amber-700, distinct from the existing `--gov` amber). Add corresponding CSS classes `v-card__accent--mfg` and `v-card__icon--mfg` (icon background `#fffbeb`). Set status to Live. Use emoji 🏭.

---

## Remaining deliverables

### 1. `/industries/index.html`
Add the manufacturing card. Add CSS for `--mfg` classes. Set Live. Place after the defense card. Card copy:

> 45 controls for OT/ICS deployments, product-embedded AI, and IT-side manufacturing systems. Aligned to EU AI Act high-risk obligations (August 2026 deadline), EU Machinery Regulation 2023/1230 (January 2027), and IEC 62443 OT cybersecurity zones.

Reg tags: `EU AI Act`, `IEC 62443`, `ISO 42001`, `NIST AI RMF`

### 2. `/manufacturing/index.html`
Hub page. Required elements:
- Experimental-schema amber callout (manufacturing-specific non-endorsement line: "not endorsed by CoSAI, the European Commission, ISA, IEC, or any standards body or government agency")
- Context block: three-deadline framing (Aug 2026 AI Act, Jan 2027 Machinery Reg, IEC 62443 OT gap); ISO 42001 as the QMS anchor; NIST Cyber AI Profile still in draft
- Stat strip: 45 controls, 5 SRF layers, 4 lifecycle stages (DES / VAL / OPS / CHG), 4 operating models
- IL classification equivalent: OT environment table (AI-SaaS vs OT-Edge vs Product-Embedded vs AI-PaaS) with data type, network zone, EU AI Act risk class, key obligation
- Layer coverage list with control counts (must match JSON)
- Responsibility split definitions
- Schema design strip: three planes
- Crosswalk pills: EU AI Act, EU Machinery Reg, IEC 62443, ISO 42001, NIST AI RMF, IEC 61508
- Page cards: How-to guide, Controls browser, JSON download (all Live, not Coming Soon)

### 3. `data/manufacturing-controls.json`
45 controls, distributed 10 / 8 / 10 / 9 / 8 across L1-L5. Model structure on `data/defense-controls.json` with these changes:
- Replace `nss_applicability` / `il_applicability` with `ot_applicability` / `eu_ai_act_risk_class`
- Replace `cmmc_practices` with `iec_62443_sls` (array of applicable IEC 62443 security level strings, e.g., `["SL1","SL2"]`, or empty array)
- `responsibility_split` uses the five manufacturing values above
- `lifecycle_stage` uses `design`, `validation`, `ops`, `change`
- `mappings` uses the manufacturing crosswalk fields above

Top-level metadata:
```json
{
  "schema_version": "0.1",
  "srf_version": "1.0",
  "industry": "manufacturing",
  "description": "...",
  "regulatory_context": "...",
  "id_convention": "SRF-{layer}-{DES|VAL|OPS|CHG}-{seq}",
  "lifecycle_stages": ["design", "validation", "ops", "change"],
  "ot_applicability_values": {
    "ot-only": "Control applies specifically to AI deployed within OT/ICS network zones.",
    "it-only": "Control applies to AI on IT-side systems only.",
    "both": "Control applies regardless of deployment environment."
  },
  "eu_ai_act_risk_classes": {
    "high-risk": "System falls under EU AI Act Annex III or is a safety component under Annex I harmonized legislation.",
    "limited-risk": "System has transparency obligations only (chatbots, synthetic content).",
    "minimal-risk": "No specific EU AI Act obligations beyond voluntary codes of practice.",
    "N/A": "EU AI Act risk classification does not apply to this control."
  },
  "responsibility_split_values": { ... },
  "controls": [ ... ]
}
```

### 4. `/manufacturing/controls/index.html`
Controls browser. All requirements from lesson 6. Filter sidebar must include:
- SRF layer (L1-L5)
- Lifecycle stage (DES, VAL, OPS, CHG)
- OT applicability (OT-only, IT-only, Both)
- EU AI Act risk class (High-risk, Limited-risk, Minimal-risk, N/A)
- Operating model
- Responsibility split
- Accountable persona

### 5. `/manufacturing/how-to/index.html`
Written for the Plant AI Safety Officer, OT Security Team, and Product Compliance Manager. Five steps:
1. Classify AI systems by EU AI Act risk tier and OT/IT/Product-Embedded operating model
2. Map personas to manufacturing roles (see persona table in architecture section)
3. Trace responsibility splits: which controls belong to the manufacturer, equipment OEM, AI vendor, or system integrator
4. Set tier parameters by operating model and EU AI Act risk class
5. Assemble the evidence package: EU AI Act technical file, conformity assessment record, FAT/SAT test results, FRIA, IEC 62443 zone documentation, post-market monitoring plan

Include a role-specific control mapping table (which personas own which layers). Include a manufacturing-specific note on OT change management: model updates in OT environments require change records, safety re-validation, and version freeze windows that do not apply to IT deployments.

### 6. `manufacturing-compliance-workpaper.xlsx`
Programmatically generated from the JSON. Four sheets:
- **Instructions**: title, disclaimer, purpose, scope
- **Tier Parameters**: configurable thresholds by operating model (not IL, since manufacturing uses OT/IT/Product-Embedded as the tier axis)
- **Persona Mapping**: SRF personas mapped to manufacturing roles and offices
- **EU AI Act / IEC 62443 Evidence Log**: all 45 controls with fields for OT applicability, EU AI Act risk class, lifecycle stage, evidence artifact, status, notes

---

## Planned controls per layer

Use these as starting points. Write full control objects including all required fields before hardcoding any counts.

**L1 – Governance and Processes (10 controls)**

1. EU AI Act risk classification and registry (DES) — classify every AI system; register high-risk systems in the EU AI database before market placement; `ai-system-governance`
2. AI governance committee with OT and safety representation (DES) — committee must include the plant safety officer or functional safety engineer; `ai-system-governance`
3. AI use case inventory with operating model and risk tier per system (DES) — `ai-system-governance`
4. Conformity assessment program management (VAL) — track which systems require third-party vs self-assessment; `ai-system-governance`
5. Incident reporting plan to market surveillance authority (OPS) — EU AI Act Article 73 serious incident reporting within 15 days for high-risk systems; `ai-system-governance`
6. Third-party AI system procurement policy (DES) — supplier obligations, technical documentation requirements, EU declaration of conformity; `ai-system-governance`
7. Post-market monitoring plan per EU AI Act Article 72 (OPS) — `ai-system-governance`
8. Fundamental Rights Impact Assessment (FRIA) for applicable deployers (DES) — required for public-body deployers and certain private deployers of high-risk AI; `ai-system-governance`
9. AI discontinuation and decommission procedure (CHG) — including safe shutdown of OT-edge AI; `ai-system-governance`
10. OT change management policy for AI systems (CHG) — version freeze windows, safety re-validation trigger conditions, rollback procedure; `ai-system-governance`

**L2 – Data and Input (8 controls)**

1. Sensor and historian data provenance documentation (DES) — authority-to-use, data quality specification, chain of custody; `data-provider`
2. Training data authority-to-use for production data (DES) — consent or contractual basis for using plant production data to train or fine-tune models; `data-provider`
3. OT/IT data boundary enforcement (OPS) — no training data traversal from OT network to cloud without approved conduit and audit log; `data-provider`
4. Input data drift monitoring (OPS) — tier-configurable; PSI or equivalent drift metric on sensor/process inputs; `data-provider`
5. Training data bias assessment for consequential AI (VAL) — personnel, quality, or safety decisions; `data-provider`
6. Adversarial input detection for OT-edge AI (OPS) — anomaly detection on process variable inputs; `ai-platform-provider`
7. AI decision log retention per EU AI Act Article 12 (OPS) — automated logging for high-risk AI; logs retained minimum six months; `data-provider`
8. Production data egress audit for cloud AI services (OPS) — verify no plant data leaves the approved cloud boundary without audit record; `data-provider`

**L3 – Application and Use Case (10 controls)**

1. EU AI Act technical documentation completeness (VAL) — Article 11 and Annex IV; verification; `application-developer`
2. Pre-deployment testing for safety-critical AI (VAL) — test plan and results in technical file before market placement or deployment; `application-developer`
3. Human oversight gate for safety-critical AI outputs (OPS) — zero-tolerance for autonomous safety decisions without a human-confirmed gate; `application-developer`
4. Safety interlock integration verification (VAL) — confirm AI output cannot override safety instrumented system; `application-developer`
5. EU Act conformity assessment completed before market placement (VAL) — third-party or self-assessment per Article 43; verification; `application-developer`
6. FAT/SAT test coverage for AI-enabled machinery (VAL) — factory and site acceptance tests cover AI-specific failure modes; `application-developer`
7. Operator override interface verification (VAL) — override must be tested and functional before deployment; `application-developer`
8. Agentic task boundary enforcement for autonomous systems (OPS) — task scope, authority limits, and abort conditions defined and enforced; `agentic-platform-provider`
9. Prompt injection and adversarial input detection for AI assistants (OPS) — applies to AI-SaaS and AI-PaaS; `application-developer`
10. Explanation availability for AI-assisted quality and safety decisions (OPS) — tier-configurable; operator must be able to request rationale; `application-developer`

**L4 – Platform and Infrastructure (9 controls)**

1. OT network zone segmentation per IEC 62443 zones-and-conduits model (DES) — AI systems placed in the correct security zone; conduit documentation; verification; `ai-platform-provider`
2. OT-edge AI hardware security baseline (DES) — device hardening, firmware signing, boot integrity; `ai-platform-provider`
3. Air-gap or approved-conduit enforcement for safety-critical OT AI (OPS) — zero-tolerance for unapproved network connections between safety-critical OT zones and external networks; `ai-platform-provider`
4. Patch and update change management for OT AI (CHG) — patches require change record, safety impact assessment, version freeze coordination; verification; `ai-platform-provider`
5. OT SIEM and anomaly detection coverage (OPS) — tier-configurable; `ai-platform-provider`
6. Remote access security for OT AI maintenance (OPS) — zero-tolerance for unauthenticated remote sessions to OT AI systems; `ai-platform-provider`
7. Encrypted communication for AI data in transit (OPS) — tier-configurable; applies differently to OT-edge (latency constraints) vs cloud AI; `ai-platform-provider`
8. AI software bill of materials (SBOM/AIBOM) for OT AI components (DES) — component inventory for supply chain risk management; `ai-platform-provider`
9. Availability SLA for AI in critical production processes (OPS) — tier-configurable; `ai-platform-provider`

**L5 – Model and Supplier (8 controls)**

1. EU AI Act technical file completeness — model supplier obligations (VAL) — declaration of conformity, technical documentation, conformity assessment; verification; `model-provider`
2. Model drift and performance degradation monitoring (OPS) — tier-configurable; calibrated to process criticality; `model-provider`
3. Model version change management trigger (CHG) — every model version change triggers a change record; high-risk AI requires re-validation assessment; verification; `model-provider`
4. Vulnerability disclosure SLA for AI model supplier (OPS) — tier-configurable; `model-provider`
5. BoAIM and model artifact signing (DES) — bill of AI materials, artifact signature verification before deployment; verification; `model-provider`
6. Functional safety validation for AI in safety-instrumented systems (VAL) — SIL-appropriate verification per IEC 61508 where applicable; verification; `model-provider`
7. Model portability and lock-in avoidance documentation (DES) — export capability, migration path; `model-provider`
8. Model supplier due diligence and supply chain risk assessment (DES) — verification; `model-provider`

---

## Distribution sequence

EU AI Act compliance community first: manufacturer associations (VDMA in Germany, NAM in the US, Make UK), product safety consultancies, EU Notified Bodies. ISA/IEC 62443 certification bodies second (TÜV, DNV, Exida). ISO 42001 certification community third. NIST Manufacturing Extension Partnership fourth for US market. CoSAI contribution last, consistent with prior verticals.

---

## Sources

- EU AI Act timeline: https://www.euaiact.com/implementation-timeline
- EU AI Act high-risk compliance deadline analysis: https://trilateralresearch.com/responsible-ai/eu-ai-act-implementation-timeline-mapping-your-models-to-the-new-risk-tiers
- EU Commission high-risk AI classification guidelines (May 2026): https://www.taylorwessing.com/en/insights-and-events/insights/2026/05/ai-act-high-risk-compliance-deadline-20/
- EU Machinery Regulation 2023/1230 and AI: https://inkog.io/labs/eu-machinery-regulation-ai-agents
- EU Machinery Regulation January 2027 primer: https://physical-ai-safety.com/blog/eu-machinery-regulation-2027-primer
- ISA position paper "Industrial AI and Its Impact on Automation" (November 2025): https://www.isa.org/news-press-releases/2025/november/isa-explores-industrial-ai-s-impact-on-automation
- ISA-TR62443-2-2-2025 update: https://www.isa.org/news-press-releases/2025/december/update-to-isa-iec-62443-series-includes-guidance-o
- NIST Cyber AI Profile (December 2025 preliminary draft): https://www.globalpolicywatch.com/2026/01/nist-publishes-preliminary-draft-of-cybersecurity-framework-profile-for-artificial-intelligence-for-public-comment/
- ISO 42001 as EU AI Act QMS anchor: https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/iso-42001-balancing-ai-speed-safety
- IEC 62443 overview: https://www.darktrace.com/cyber-ai-glossary/iec-62443
- ICS/OT cybersecurity trends 2026: https://www.iiot-world.com/ics-security/ics-ot-cybersecurity-trends-2026/
- Sibling schemas for structural reference: `data/defense-controls.json`, `data/public-sector-controls.json`; `defense-vertical-handoff.md` for the freshest lessons-learned lineage
