# ROCA data fields

ROCA is Risk, Obligation, Control, Accountable. It is not a RACI chart. This file records the data fields the relationship map reads. Bill can change any choice listed here.

## Instrument source kind

`data/regulations.json` tags each instrument with `source_kind`:

- `binding`: a statute, regulation, directive, or supervisory instrument the catalog treats as a duty.
- `voluntary_standard`: a voluntary standard, framework, profile, or non-binding guidance. NIST AI RMF and ISO/IEC 42001 are in this group.
- `catalog`: a risk list, threat list, control catalog, control overlay, indicator list, or examiner tool. OWASP LLM Top 10, MITRE ATLAS, CSA AICM, and CIS Controls are catalogs. A catalog is not an obligation.

A record is a current obligation when `source_kind` is `binding` or `voluntary_standard`, `lifecycle` is not `draft` or `rescinded`, and `tags` does not include `proposed`. Set `current_obligation` to false on a record to exclude it even when that rule would include it. The NYDFS 2024 AI cyber letter is excluded because its scope text says the letter adds no requirements.

`build/generate_knowledge_layer.py` copies `source_kind` and `current_obligation` onto each `ext.framework.*` node. `build/verify_knowledge_layer.py` rejects a missing or unknown `source_kind`, and it rejects a node whose flag does not match this rule. `schemas/regulations.schema.json` checks the same enum.

## Sector model map

`data/sector-model-map.json` maps each of the 10 sector operating-model names to one of the four SRF v1.0 models: `AI-SaaS`, `AI-PaaS`, `Agent-PaaS`, `IaaS`. The sector name stays on the control. Edit `srf_model` to change a row. `Shared` is not a model id in this file.

| Sector model | SRF model | Where the definition is |
|---|---|---|
| SaMD-Cloud | AI-SaaS | `data/healthcare-controls.json` |
| EHR-Embedded | AI-SaaS | `data/healthcare-controls.json` |
| Agent-Clinical | Agent-PaaS | `data/healthcare-controls.json` |
| On-Premise | IaaS | `data/healthcare-controls.json` |
| Agent-Ops | Agent-PaaS | Defense, insurance, and public-sector how-to pages |
| Program-Embedded | IaaS | `defense/how-to/index.html` |
| Vendor-Model | AI-PaaS | `insurance/how-to/index.html` |
| Shared-Service | AI-PaaS | `public-sector/how-to/index.html` |
| OT-Edge | IaaS | `manufacturing/how-to/index.html` and `manufacturing/index.html` |
| Product-Embedded | IaaS | `manufacturing/how-to/index.html` and `manufacturing/index.html` |

Three rows record an alternative Bill can switch to without rewriting the definition: EHR-Embedded to `AI-PaaS`, Vendor-Model to `AI-SaaS`, and Shared-Service to `AI-SaaS`. The reason is on the row.

`build/verify_knowledge_layer.py` checks that the 10 names match the names used on controls, that each `srf_model` is one of the four, and that the SRF definitions in the table match `data/matrix.json`. `schemas/sector-model-map.schema.json` checks the same shape. Control `operating_models` lists are unchanged.

## Risk records and obligation links

The 31 rows in `data/threats.json` are the Risk records. The generator emits one `ext.threat.*` node per row, a `mitigated_by` edge to each related control, a `risk_owner` edge to the accountable persona for each of the four SRF models, and a `triggers_obligation` edge for each `obligations[]` entry. The edge carries the same `basis` as the row, and the citation list in `obligation_source` (the edge field is not named `source`, because `source` is the edge's start node). There is no separate path file. A ROCA path is the join of these edges.

`obligations[]` has 153 links. Every one has `basis` `derived_via_control`. The source lists the related control, the mapping key, and the citation string that matched a requirement. The link means the control that addresses the risk cites that requirement. It does not mean the legal text names the risk.

No link uses `official_text`. EUR-Lex returned HTTP 403 and a WAF challenge, so Article 15 was not checked against the official text in this change. No link uses `named_citation`. None of the control citation strings name the threat. A candidate with no control citation that matches a current obligation was not stored. Catalog instruments are not obligations, so an OWASP or AICM citation does not become a link. `schemas/threats.schema.json` requires `basis` and `source`. `build/verify_knowledge_layer.py` rejects a derived link whose citation does not match the requirement.

## Article records and the instrument fallback

New rows in `requirements[]` keep `moral_profile` null. Null means the obligation is recorded and has not been tagged on actor, action, and outcome. The generator does not invent salience for those rows.

39 records were added, each with a URL and a citation:

- 36 NIST AI RMF subcategories, from NIST AI 100-1 (January 26, 2023), `https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf`. The sentences are the subcategory text in the function tables. Line-break hyphens in the PDF extract were rejoined. GOVERN 2.3 was not added: the table extract places an extra token in that sentence.
- 3 M-25-21 Section 4(b) practices (pre-deployment testing, AI impact assessment, ongoing monitoring), from the White House PDF fetched on November 15, 2026. The memorandum lists them in order under heading 4.b. Control files cite that order as Section 4(b)(i), (ii), and (iii).

EU AI Act articles that controls cite and that have no record yet were not added. EUR-Lex returned HTTP 403, so those article titles were not read. The same is true for paywalled IEC and ISO clause text, FDA guidance sections, and state insurance provisions whose official text was not fetched. Those citations stay on the instrument fallback.

When a control cites a current obligation and no article record matches, the `governed_by` edge sets `obligation_fallback` to true. When an article matches, the flag is false. Catalog edges do not get the flag. Adding the 39 records also added 104 `derived_via_control` threat links (99 from the NIST rows, 5 from the M-25-21 rows). No `official_text` or `named_citation` link was added.

## One accountable persona per SRF model

Each vertical control has `accountable_by_model`. The keys are the SRF models the control applies to: a model named on the control, or the SRF model that `data/sector-model-map.json` assigns to a sector name on the control. Each value is one canonical SRF persona. `Shared` is not a value. `co_accountable_persona` and `accountability_split` are rejected. A sector specialization such as `clinical-ai-governance` stays in `accountable_persona`. The per-model field stores the canonical persona that specialization points at, `ai-system-governance`.

The four L5 controls whose field and note disagreed now name `ai-system-governance` on every SRF model they apply to. The measured work is the institution commissioning the evaluation, the challenge, or the due-diligence package. The persona text in `data/personas.json`, from SRF v1.0 section 3.1, assigns that evaluation and compliance duty to AI System Governance. The model provider remains the subject of the review, and the provider's own release evaluation stays on the provider's release control.

The three joint-accountability controls now have one owner per model:

- Finance `SRF-L4-MON-002` is `ai-platform-provider` on all four models. The control measures gateway failures. On IaaS the customer fills that platform role for the gateway it runs.
- Finance `SRF-L4-MON-003` is `ai-platform-provider` on AI-PaaS and Agent-PaaS, where matrix.json marks L4 provider-managed, and `ai-model-serving` on IaaS, where the customer runs the instances and the persona text assigns confidential-computing execution to AI Model Serving.
- Finance `SRF-L5-MON-001` is `ai-platform-provider` on AI-PaaS and Agent-PaaS, and `ai-model-serving` on IaaS. Signing the artifact stays on `SRF-L5-DEV-002`, owned by `model-provider`.

18 risk-owner cells were set to the persona of a linked control that applies in that model, preferring a control at the risk's layer. 4 cells have no linked control in that model (`modelinversionandmembership` and `devmodelleak` and `dsgai05` on AI-SaaS, and `dsgai11` on IaaS). Those four keep their persona and set `no_linked_control_in_model`. 9 of the original 31 mismatched cells already matched after the sector map and the control-owner edits, so the persona was left as it was. The previous persona and note for each changed cell are in `owner_alignment`.
