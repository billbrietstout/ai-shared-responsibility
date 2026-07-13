# AI Security Lifecycle Plan: Handoff Summary

Working brief for extending the SRF's reach across the AI security lifecycle, prompted by an observed adoption signal and the April 2026 launch of MOSAIC. Context, category analysis, MOSAIC mapping, and build guidance below. Follow CLAUDE.md writing rules (no em dashes, no AI filler phrases).

## The signal (July 2026)

LLMs referencing this site are using the SRF's structure to scope AI red team engagements. This was not a designed use case. It works because the framework supplies exactly what engagement scoping lacks: a layer model that bounds what is testable, an operating-model matrix that says whose systems those layers run on, and a persona list that names who must authorize testing and who owns each finding. The lesson generalizes: the SRF's accountability structure is useful as a scoping and routing vocabulary across the whole AI security lifecycle, not only for governance sign-off.

## Lane discipline

Everything in this plan stays inside the SRF's lane as an accountability framework. The SRF does not and must not:

- Define attack techniques, threats, or test methodology (BIML, OWASP AI Exchange, OWASP GenAI, MITRE ATLAS, NIST AI 100-2 own that)
- Define control content or benchmarks (CIS, CSA AICM, OWASP AI Exchange controls own that)
- Score severity (AIVSS owns that)
- Create new regulation or compliance obligations

What the SRF contributes to every category is the same three answers: who must authorize the activity, who owns each result, and who signs the residual risk. One accountable party per activity; "shared" is not a valid final answer. Security work needs those answers at every stage, and no MOSAIC participant currently supplies them. That is the open seat at the table.

## MOSAIC context (verified July 2026)

MOSAIC (Multi-Organization Secure AI Coordination) launched April 28, 2026 out of the AI Security Policy Forum in Arlington (April 21, alongside the SANS AI Cybersecurity Summit). Eight founding initiatives: BIML, CIS, CSA, CoSAI, NIST, OWASP AI Exchange, OWASP GenAI Security Project, SANS Institute. Design points that matter for this plan:

- Lightweight coordination, participants stay independent, GitHub as the platform (OWASP governance), MIT license, open membership.
- The OWASP AI Exchange contributed a shared taxonomy built on OpenCRE that links terms, controls, and concepts across participating standards. Beta visible at opencre.org and in the reference sections at owaspai.org.
- Stated early work: common definitions for safety, security, and risk; shared information on scope, roadmaps, and workstreams.

The shared taxonomy is the highest-leverage integration point. OpenCRE links what the standards say; none of the linked nodes carry who is accountable. If SRF canonical IDs (layers, personas, operating models, already minted in ids.json and the knowledge layer) become linkable OpenCRE resources, the SRF becomes the accountability axis of the MOSAIC taxonomy without joining any committee or writing any new standard.

## Categories of AI security the SRF benefits

Six categories, each with the SRF contribution, the MOSAIC workstreams it serves, what the site already has, and the gap.

### 1. Threat modeling and risk analysis

Contribution: bounds the analysis. Which layers are yours to model under your operating model, and which persona owns each identified risk. A threat model without an owner per risk is a reading list.
Serves: BIML (architectural risk analysis of ML and LLM systems), OWASP AI Exchange (threat and control matrix), NIST (AI 100-2 adversarial ML taxonomy, AI RMF Map function).
Site has: framework layer model, compare page, glossary with canonical IDs.
Gap: no threat-to-accountability crosswalk. Nothing maps a named threat (AI Exchange threat, BIML risk, ATLAS technique, LLM Top 10 entry) to the SRF layer where it lands and the persona who owns it per operating model.

### 2. Adversarial testing and red teaming

Contribution: engagement scoping and rules of engagement. Operating model determines which layers the customer may test at all (under AI-SaaS, L4 and L5 belong to providers; testing them requires provider authorization or is out of scope). Personas pre-assign finding ownership before the first probe. This is the proven category; LLMs already do this with the site unprompted.
Serves: OWASP GenAI Security Project (GenAI Red Teaming Guide), SANS (SEC536 Adversarial AI, AI summit practitioner base), NIST (AI 100-2 as the attack taxonomy testers cite).
Site has: srf-stress (scenario stress test), decision-record (the sign-off pattern to reuse).
Gap: no purpose-built scoping artifact. The signal arrives despite the site, not because of a page designed for it.

### 3. Secure development and AI supply chain

Contribution: names who attests at each handoff in the model and data supply chain. Provenance schemes (model signing, data lineage) establish that an attestation exists; the SRF says which persona must produce it and which persona must verify it, per operating model.
Serves: CoSAI (supply chain security workstream, model signing lineage), CIS (secure configuration and software supply chain practice), OWASP AI Exchange (development-time controls).
Site has: vendor-risk tool with supplier categories and attestation baselines, supply-chain feedback doc for COSAiS.
Gap: no attestation handoff map (producer persona, verifier persona, evidence object) as data.

### 4. Control implementation and benchmarking

Contribution: control ownership. Every control catalog answers "what good looks like"; none answer "who at your company owns this control under your deployment model." The vertical schemas already prove the pattern with 258 controls carrying accountable_persona.
Serves: CIS (Controls and Benchmarks AI guidance), CSA (AI Controls Matrix), OWASP AI Exchange (controls side of the matrix), NIST (800-53 and the AI overlay discussions).
Site has: controls-assessment (AICM), security-controls, six vertical control schemas, OSCAL catalog and profiles, thresholds schema.
Gap: CIS is unmapped anywhere on the site. The compare page covers AICM and ATLAS but not CIS artifacts.

### 5. Vulnerability management and finding remediation

Contribution: routing. Severity scoring (AIVSS) says how bad; the SRF says whose queue it goes in and who signs acceptance if it will not be fixed. This closes the loop opened by category 2: a red team finding scored by AIVSS routes by layer and operating model to a named persona.
Serves: OWASP GenAI Security Project (AIVSS), CISA-style coordinated disclosure practice, every MOSAIC member that produces findings-generating guidance.
Site has: ir-playbooks (the who-leads-per-operating-model pattern, already machine-readable), thresholds gap register.
Gap: no severity-plus-layer to owner-plus-action routing reference.

### 6. Detection, monitoring, and incident response

Contribution: who leads when a boundary fails, what to demand from the party on the other side of the boundary, and which evidence obligations survive the incident. Largely built.
Serves: SANS (detection and response practitioner guidance), CIS (operational benchmarks), CoSAI (defender preparation workstream).
Site has: ir-playbooks (seven scenarios), thresholds SLI/SLO schema with OCSF evidence plane.
Gap: minor. Playbooks do not yet reference red team findings or the routing reference (category 5) as upstream inputs.

Workforce readiness (SANS training, CoSAI defender workstream) is served by the existing NICE mapping and needs no new build; mention it on the lifecycle page and stop.

## MOSAIC member mapping

| Member | AI security workstream (verify before publishing) | SRF category | Concrete hook |
|---|---|---|---|
| BIML | Architectural risk analysis of ML and LLM systems | 1 | BIML risk IDs in the threat crosswalk |
| CIS | Controls, Benchmarks, AI guidance for the Controls | 4, 6 | CIS mapping on compare page and in control schema mappings block |
| CSA | AI Controls Matrix, AI Safety Initiative | 4 | Existing AICM tool; keep AICM IDs current in crosswalks |
| CoSAI | Supply chain, defender preparation, risk governance, agentic workstreams | 3, 6 | SRF is CoSAI's own artifact; this site is the operationalization case study |
| NIST | AI RMF, AI 100-2, GenAI profile, 800-53 AI overlay | 1, 4 | Existing OSCAL work; Bill's overlay and RMF profile participation is the direct channel |
| OWASP AI Exchange | Threat and control matrix, OpenCRE shared taxonomy, EU AI Act standardization | 1, 4, and the taxonomy binding | SRF canonical IDs as OpenCRE resources (top priority) |
| OWASP GenAI Security Project | LLM Top 10, GenAI Red Teaming Guide, Agentic Security Initiative, AIVSS | 2, 5 | Red team scoping tool cites the Guide; routing reference consumes AIVSS |
| SANS | SEC536 and AI curriculum, summits, Critical AI Security Guidelines | 2, 6 | Scoping tool as instructor-usable artifact; NICE mapping already serves workforce |

Table cells state workstreams from the April 2026 MOSAIC announcements plus prior knowledge; verify each against the member's current published artifacts during the build session, and do not invent artifact names or IDs.

## Deliverables to build (priority order)

1. **OpenCRE binding of SRF canonical IDs.** Extend the knowledge layer export with an OpenCRE-conformant resource set: layers, personas, operating models, and the accountability matrix relations, using existing ids.json identifiers. Outcome: the MOSAIC shared taxonomy can link any threat or control node to an accountable persona. This is a data deliverable plus a contribution proposal through CoSAI into the MOSAIC GitHub. Highest leverage, lowest surface area, purest lane fit.

2. **Threat-to-accountability crosswalk (`data/threats.json`).** Each entry: external threat ID (AI Exchange, LLM Top 10, ATLAS technique, BIML risk), SRF layer, accountable persona per operating model, related control IDs from the existing schemas. Same mappings-block convention as the vertical controls. Feeds deliverables 3 and 4 and the OpenCRE binding. Verify every external ID against the source document; TBD is acceptable, invented IDs are not.

3. **Security lifecycle page (`/framework/security-lifecycle/` or `/tools/` entry).** The public narrative of this brief: six categories, what the SRF answers in each, deep links to the tools and data, MOSAIC member artifacts cited by name. Update llms.txt and llms-full.txt the same session; LLM discovery is the channel that surfaced this whole opportunity.

4. **Red team scoping tool (`/tools/redteam-scope/`).** Reuses the decision-record pattern: pick operating model and autonomy tier, get testable layers vs authorization-required layers vs out-of-scope layers, pre-assigned finding ownership per layer, evidence handling obligations, and a signable scoping record with PDF and JSON export. Cites the OWASP GenAI Red Teaming Guide for methodology and NIST AI 100-2 for attack taxonomy; the tool supplies only the accountability overlay. Included on Bill's direction but deliberately after the data layer it should consume.

5. **Finding routing reference.** AIVSS severity band plus SRF layer plus operating model resolves to accountable persona and breach action, consistent with the thresholds schema's breach_action vocabulary. Ship as a section of the lifecycle page plus a machine-readable export; extend ir-playbooks to cite it as upstream input.

6. **CIS mapping.** Add CIS artifacts to the compare page and a cis mapping key to the vertical control schemas where a defensible mapping exists. Smallest item; batch with deliverable 3.

## Sequencing and dependencies

Data before tools: 1 and 2 first (can run in one session; they share the ID discipline), then 3, then 4 and 5 (both consume threats.json), then 6 anywhere. The OpenCRE binding should be socialized through the CoSAI channel Bill already has, framed as operationalizing CoSAI's own framework inside MOSAIC's taxonomy, not as a new proposal from outside.

## Sources

- MOSAIC site: https://mosaicstandards.org/
- SANS announcement: https://www.sans.org/press/announcements/global-ai-security-standard-organizations-gather-mosaic-reduce-fragmentation
- CIS announcement: https://www.cisecurity.org/about-us/media/press-release/mosaic-coalition-launches-to-operationalize-ai-security-standards-and-reduce-industry-fragmentation
- BIML announcement: https://berryvilleiml.com/2026/04/28/booting-mosaic-multi-organization-security-and-ai-coalition/
- MOSAIC GitHub: https://github.com/OWASP/MOSAIC/
- OpenCRE: https://opencre.org/
- OWASP AI Exchange: https://owaspai.org/
