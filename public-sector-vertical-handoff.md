# Public Sector Vertical Plan: Handoff Summary

Working brief for building the public-sector SRF control schema, scoped to U.S. federal civilian agencies (FCEB). Defense (DoW) and the IC are out of scope; they run their own authorization regimes through DISA SRG impact levels. Follow CLAUDE.md writing rules (no em dashes, no AI filler phrases). Read "Lessons from prior builds" before writing anything; it exists because the finance and healthcare builds each shipped avoidable defects.

## Why public sector, why now (June 2026)

Finance filled the SR 26-2 gap, healthcare the FDA TPLC gap, insurance the NAIC exam gap. The civilian-agency gap has the hardest deadline yet:

1. OMB M-25-21 (April 3, 2025) requires agencies to apply minimum risk management practices to every high-impact AI use case and report compliance to OMB by September 22, 2026. Use cases that cannot meet the minimum practices must be discontinued. That deadline is roughly three months out. As of April 2026 agencies had reported about 3,611 AI use cases, 445 of them high-impact (verify current counts before publishing). The memo names the practices but provides no control catalog, no thresholds, and no evidence model. Same shape of gap as SR 26-2.
2. FedRAMP 20x is moving AI services into agencies faster than agency-side governance can absorb them. GSA announced AI prioritization for 20x authorizations in August 2025; the first AI 20x Low authorizations landed January 2026, OpenAI holds 20x Moderate, and IBM authorized 11 AI products including watsonx in April 2026. The Phase Two Moderate pilot concludes end of Q2 FY2026 with broader rollout in Q3 and Q4. FedRAMP authorizes the CSP side only; the agency side of each AI service's responsibility split has no schema.
3. NIST's COSAiS project (SP 800-53 control overlays for securing AI systems) is the official answer, but it is still in draft. The predictive-AI overlay was an annotated outline in January 2026 with comments due February 13. Agencies facing the September deadline cannot wait for it.

The wedge: cloud adoption took off when the FedRAMP Customer Responsibility Matrix made the shared responsibility split contract boilerplate. For AI services the CRM covers 800-53 security controls but assigns nobody to the AI-specific obligations in M-25-21 and M-25-22. The SRF contribution is the same as the other verticals: named accountable persona per control, measurable thresholds, machine-readable evidence. Here it slots directly into an artifact every agency ISSO already uses.

## Key external facts (verified June 2026)

- OMB M-25-21 "Accelerating Federal Use of AI through Innovation, Governance, and Public Trust" (April 3, 2025): CAIO appointment, AI governance boards, public use-case inventories, and a single consolidated "high-impact AI" risk category. Seven minimum practices for high-impact AI: pre-deployment testing, AI impact assessment, ongoing monitoring, human training and assessment, human oversight and intervention, remedies or appeals, end-user and public feedback. Agency compliance plans were published fall 2025 (DHS, VA, HHS, EEOC plans are public; useful persona references). September 22, 2026: minimum-practices report to OMB. Verify exact section numbers against the memo PDF before mapping; do not cite from secondary summaries.
- OMB M-25-22 (companion, April 2025): AI acquisition. Performance-based acquisition terms, data and IP rights (agency data not used to train vendor models without consent), vendor lock-in avoidance, transparency requirements. This is the L5/supplier mapping anchor.
- FedRAMP 20x: Key Security Indicators (KSIs) with machine-readable evidence pulled from production environments rather than point-in-time documents. This is philosophically identical to the SRF evidence plane; say so on the hub page. Verify current KSI names against fedramp.gov or the FedRAMP GitHub before crosswalking; the set is still evolving through the pilot phases.
- NIST COSAiS: overlays planned for generative AI, predictive AI, single-agent and multi-agent systems, and AI developer practices. All draft. Mark COSAiS mappings TBD with a mapping_status_note; revisit when initial public drafts land.
- NIST AI RMF 1.0 and the Generative AI Profile (NIST-AI-600-1) remain the named risk framework in agency compliance plans; stable mapping target.
- FIPS 199 impact levels (Low, Moderate, High) plus the M-25-21 high-impact AI designation form the tier table. Tiering is by impact level and use-case designation, not bank-style materiality.

## Architecture decision: reuse the three planes

Same structure as finance, healthcare, insurance. Do not redesign.

1. Accountability plane: SRF layers and personas. Reuse the existing persona set (ai-system-governance, data-provider, application-developer, agentic-platform-provider, ai-platform-provider, model-provider). The how-to guide, not the schema, maps personas to federal roles: CAIO, Authorizing Official, system owner, ISSO, CDO. Do not mint federal-title personas in the JSON.
2. Control plane: per-layer control objects keyed to a federal AI lifecycle: acquisition-integration (ACQ), pre-deployment-validation (VAL, covering testing and impact assessment), ongoing-monitoring (MON), human-oversight-remedy (OVR). OVR is the distinctive public-sector stage; the M-25-21 oversight, appeal, and feedback practices have no analog in the sibling schemas. Map control IDs to: M-25-21 sections, M-25-22 sections, FedRAMP 20x KSIs, NIST AI RMF, COSAiS (TBD), OWASP LLM Top 10.
3. Evidence plane: OCSF v1.8.0, same as the siblings. Where evidence is a document (impact assessment, ATO letter, inventory entry, compliance plan), say so honestly; do not force OCSF onto governance paperwork.

One public-sector-specific field: each control carries a `responsibility_split` value aligned to FedRAMP CRM categories (csp, agency, shared, inherited). This is the feature that makes the schema legible to ISSOs and is the hub page's headline differentiator.

Operating models (four, parallel to siblings): AI-SaaS, AI-PaaS, Agent-Ops (agentic AI in casework, benefits processing, citizen service), Shared-Service (interagency platforms such as GSA USAi; the public-sector-distinctive model, where inheritance chains run agency to agency). Every control declares which models it applies to.

ID convention: SRF-{layer}-{ACQ|VAL|MON|OVR}-{seq}. Schema metadata: schema_version 0.1, srf_version 1.0, industry "public-sector".

## Lessons from prior builds (do not repeat)

1. No em dashes anywhere: HTML, JSON strings, xlsx cells. The healthcare build shipped 228; all had to be swept.
2. param_type on every control, healthcare vocabulary: zero-tolerance, verification, tier-configurable. Do not copy finance's divergent vocabulary.
3. Any count stated in page copy must be computed from the JSON, not estimated.
4. Do not invent regulatory citation IDs, section numbers, or dates. Mark unverified mappings TBD with a mapping_status_note in the JSON. Federal memo section numbering is exactly the kind of thing prior builds got wrong; cite only from the primary PDFs.
5. Any xlsx or downloadable artifact must be generated programmatically from the controls JSON so it cannot drift.
6. Controls browser requirements: fetch the JSON, filter sidebar, search input, escHtml on every interpolated field, keyboard operability (Enter/Space) with aria-expanded on expandable cards, global underscore replace in mapping labels, hide TBD and N/A mappings from cards.
7. Every page carries the experimental-schema notice (amber callout): proposed extension, not part of CoSAI SRF v1.0, not endorsed by CoSAI, OMB, GSA, FedRAMP, or any agency. The government context makes the non-endorsement line more important than usual; nothing on these pages may imply federal approval.
8. Directory and file naming: /public-sector/ and data/public-sector-controls.json (Bill's explicit choice, June 2026).
9. Hub page persona listings must match the JSON exactly, including layers with split persona ownership.
10. Check the insurance build output for any new defect patterns before starting; it shipped most recently and its fixes are the freshest precedent.

## Deliverables to build

1. `/public-sector/` hub page: positioning is "the agency side of the CRM, for AI." Stat strip (September 22 deadline countdown context, high-impact use-case count, KSI alignment), context block (M-25-21 deadline, FedRAMP 20x AI fast lane, COSAiS still in draft), section cards, schema design strip, layer coverage, crosswalk pills. Flip the industries page public-sector card to Live (add the card first if absent).
2. `data/public-sector-controls.json`: 40 controls, distributed roughly 9/8/8/8/7 across L1 to L5 to match siblings, each with persona, lifecycle stage, operating models, responsibility_split, mappings, threshold tuple with param_type, and OCSF or document evidence pointer.
3. `/public-sector/how-to/`: written for the agency CAIO staff and ISSO preparing the September 22 OMB report and the next AI service ATO. Five steps: inventory use cases and confirm high-impact designations, select operating model and trace CRM inheritance, map personas to agency roles, set tier parameters by FIPS 199 level and high-impact designation, assemble the evidence package serving both the OMB report and the ATO file.
4. `/public-sector/controls/`: controls browser meeting all requirements in lesson 6.
5. M-25-21 readiness workpaper xlsx, generated from the JSON (Instructions, Tier Parameters, Persona Mapping, Minimum-Practices Evidence Log).

## Example controls per layer (starting points)

- L1: AI use-case inventory completeness and public posting; high-impact designation documented per use case with named designating official; CAIO and governance board charter currency; compliance plan currency; discontinuation and waiver process readiness for failing use cases.
- L2: authority-to-use verification for training and RAG data (Privacy Act SORN coverage); agency data egress to commercial model training blocked per M-25-22 data rights; PII and CUI classification coverage of AI-accessible stores; input drift monitoring (PSI); records-retention compliance for AI interaction logs (NARA).
- L3: pre-deployment testing coverage for high-impact use cases; prompt injection detection; human oversight gate for adverse citizen-facing decisions (benefits, enforcement, eligibility); remedy and appeal mechanism coverage; public feedback channel operational; agentic task boundary enforcement for casework automation.
- L4: AI service within FedRAMP authorization boundary at required impact level; guardrail configuration baseline; gateway authentication; CUI encryption and access monitoring; audit log completeness mapped to KSI evidence expectations.
- L5: model documentation completeness per M-25-22 transparency terms; vendor performance and drift disclosure SLA; artifact signing; vulnerability disclosure SLA; model portability evidence (lock-in avoidance).

## Distribution sequence

GSA and FedRAMP PMO channel first: the 20x program takes community input through its public GitHub, and KSI alignment is the natural contribution vehicle. CAIO Council and agency communities (ACT-IAC, ATARC working groups) second. CSA AICM alignment third, CoSAI contribution fourth, consistent with the sibling plans. GovRAMP (formerly StateRAMP) extends the same schema to state and local later; mention it on the hub page as roadmap, build nothing for it now.

## Sources

- OMB M-25-21 text: https://static.carahsoft.com/concrete/files/9717/4412/5797/Guidance_M-25-21_Accelerating_Federal_Use_of_AI_through_Innovation_Governance_and_Public_Trust.pdf (verify against whitehouse.gov copy)
- M-25-21 and M-25-22 analysis: https://www.hunton.com/privacy-and-cybersecurity-law-blog/omb-issues-revised-policies-on-ai-use-and-procurement-by-federal-agencies
- GSA FedRAMP AI prioritization announcement (Aug 2025): https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-fedramp-prioritize-20x-authorizations-for-ai-08252025
- FedRAMP 20x phases and KSIs: https://www.fedramp.gov and the FedRAMP 2026 public preview: https://preview.fedramp.gov/2026/shared-responsibilities/
- FedRAMP shared responsibility and CRM: https://help.fedramp.gov/hc/en-us/articles/27700955089563-Who-is-responsible-for-the-cloud-security-controls
- NIST COSAiS project: https://csrc.nist.gov/projects/cosais
- DHS M-25-21 compliance plan (persona reference): https://www.dhs.gov/sites/default/files/2025-09/25_0926_cio_dhs_compliance_plan_for_omb_m-25-21_508.pdf
- Sibling schemas for structural reference: data/finance-controls.json, data/healthcare-controls.json, data/insurance-controls.json; insurance-vertical-handoff.md for the lessons-learned lineage.
