# ROCA data fields

ROCA is Risk, Obligation, Control, Accountable. It is not a RACI chart. This file records the data fields the relationship map reads. Bill can change any choice listed here.

The explorer at `/tools/relationship-map/` draws those fields as four columns. It does not draw the full link mesh. `?view=full` opens the chain when the query can build one, and the empty start state otherwise. `?tapestry=1` does not add Tapestry records to that chain.

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

The 42 rows in `data/threats.json` are the Risk records (L1 12, L2 7, L3 8, L4 8, L5 7). Eleven of the L1 rows are a draft of business and usage risks. The generator emits one `ext.threat.*` node per row, a `mitigated_by` edge to each related control, a `risk_owner` edge to the accountable persona for each of the four SRF models, and a `triggers_obligation` edge for each `obligations[]` entry. The edge carries the same `basis` as the row, and the citation list in `obligation_source` (the edge field is not named `source`, because `source` is the edge's start node). There is no separate path file. A ROCA path is the join of these edges.

`obligations[]` has 363 links. 339 use `basis` `derived_via_control`. The source lists the related control, the mapping key, and the citation string that matched a requirement. That link means the control that addresses the risk cites that requirement. It does not mean the legal text names the risk.

Five links use `basis` `official_text`. Each one is EU AI Act Article 15(5). The source quotes the sentence that names data poisoning, model poisoning of pre-trained components used in training, adversarial examples or model evasion, and confidentiality attacks. The quote is from the consolidated text of Regulation (EU) 2024/1689 dated 2026-07-27. The five risks are evasion, supply-chain model poisoning, disclosure in output, model inversion and membership inference, and model exfiltration by input-output harvesting. Two more `official_text` links quote OECD/LEGAL/0449. Principle 1.2(b) on `outofpurpose` names uses outside the intended purpose. Principle 1.4(b) on `missingoversight` names undue harm and the override. Seventeen links use `basis` `named_citation`. Each one names a requirement that states a duty for that risk. The text does not state the harm, and no related control cites that requirement. The chain draws that link dashed. A requirement that is only an institutional procedure, or a bundle that does not name one harm, is still not stored. Catalog instruments are not obligations, so an OWASP or AICM citation does not become a link. `schemas/threats.schema.json` requires `basis` and `source`. `build/verify_knowledge_layer.py` rejects a derived link whose citation does not match the requirement. An `official_text` link must carry a URL and a citation.

## Article records and the instrument fallback

New rows in `requirements[]` keep `moral_profile` null. Null means the obligation is recorded and has not been tagged on actor, action, and outcome. The generator does not invent salience for those rows.

39 records were added, each with a URL and a citation:

- 36 NIST AI RMF subcategories, from NIST AI 100-1 (January 26, 2023), `https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf`. The sentences are the subcategory text in the function tables. Line-break hyphens in the PDF extract were rejoined. GOVERN 2.3 was skipped that day because the table extract placed an extra token in the sentence. The subcategory statement was recorded on November 16.
- 3 M-25-21 Section 4(b) practices (pre-deployment testing, AI impact assessment, ongoing monitoring), from the White House PDF fetched on November 15, 2026. The memorandum lists them in order under heading 4.b. Control files cite that order as Section 4(b)(i), (ii), and (iii).

Sixteen EU AI Act article records were added from the consolidated text of Regulation (EU) 2024/1689 dated 2026-07-27 (02024R1689), which includes amending Regulation (EU) 2026/1744. EUR-Lex was not fetched. The URL on each new record is `https://eur-lex.europa.eu/eli/reg/2024/1689/oj`. The articles are 4, 11, 12, 13, 16, 17, 25, 27, 28, 43, 47, 49, 51, 52, 73, and 86. Those are the articles a control citation names that did not already have a record. `moral_profile` is null. Where the consolidated text marks a passage with M1 for Regulation (EU) 2026/1744, the record's `source_note` names the article and paragraph. Articles 5, 6, 9, 10, 14, 15, 26, 53, and 72 already had records and were left as they were. The consolidated text also marks amendments in Articles 10 and 72. Those older records do not carry that note.

Three control citations carry a parenthetical that does not match the article heading. Article 28 is notifying authorities. Article 51 classifies general-purpose AI models with systemic risk. Article 52 is the procedure for that classification. The records follow the article text. The citation string still matches `Article 28`, `Article 51`, or `Article 52`, so the control's `implements` edge points at that record.

When a control cites a current obligation and no article record matches, the `governed_by` edge sets `obligation_fallback` to true. When an article matches, the flag is false. Catalog edges do not get the flag. The 39 NIST and M-25-21 records added 104 `derived_via_control` threat links (99 from the NIST rows, 5 from the M-25-21 rows). The 16 EU article records do not add threat links. They add 58 `implements` edges where a control citation names the article. On 32 controls, no earlier EU article record had matched, so `obligation_fallback` on the EU AI Act edge changes from true to false.

On November 16, 2026, 90 requirement records were added from public text. `moral_profile` is null on each of them. The set is 13 NIST AI RMF subcategories, including GOVERN 2.3; 15 NIST SP 800-171 Revision 2 requirement statements and the 20 CMMC Level 2 practices that use those numbers; the remaining cited sections of M-25-21 and the cited sections of M-25-22; EU AI Act Annexes III, IV, VI, and VII, from the consolidated HTML CELEX 02024R1689-20260727; 45 CFR 170.315(b)(11) with paragraphs (i) through (vi), plus (d)(2) and (g)(10); and 45 CFR 164.310(a)(2)(i), 164.502(e), and 164.514. The NIST SP 800-171 sentences are Revision 2. The instrument URL in `data/regulations.json` points at Revision 3, which renumbers them. The new records added 57 `derived_via_control` threat links.

366 current-obligation edges still have `obligation_fallback` true. Paywalled IEC and ISO text was not copied. FDA guidance, the NAIC model bulletin, Colorado Regulation 10-1-1, NYDFS Circular Letter No. 7, the DoD RAI pathway, the DoD Cloud Computing Security Requirements Guide, and DoDI 5000.89 and 5000.90 were not fetched. RESPOND 1.1 is a Cybersecurity Framework subcategory, so it has no AI RMF record. CMMC practices whose identifiers end in e, and the two citations that name only 32 CFR Part 170 Level 2 or Level 3, have no record. EU Machinery Regulation citations that still say TBD were not linked. Where a control parenthetical names a different subject than the section heading, the record follows the heading. That is true for 45 CFR 170.315(b)(11)(i) through (vi), and for M-25-21 Section 3(b)(v), which the public-sector control writes as Section 3(a)(v).

## One accountable persona per SRF model

Each vertical control has `accountable_by_model`. The keys are the SRF models the control applies to: a model named on the control, or the SRF model that `data/sector-model-map.json` assigns to a sector name on the control. Each value is one canonical SRF persona. `Shared` is not a value. `co_accountable_persona` and `accountability_split` are rejected. A sector specialization such as `clinical-ai-governance` stays in `accountable_persona`. The per-model field stores the canonical persona that specialization points at, `ai-system-governance`.

The four L5 controls whose field and note disagreed now name `ai-system-governance` on every SRF model they apply to. The measured work is the institution commissioning the evaluation, the challenge, or the due-diligence package. The persona text in `data/personas.json`, from SRF v1.0 section 3.1, assigns that evaluation and compliance duty to AI System Governance. The model provider remains the subject of the review, and the provider's own release evaluation stays on the provider's release control.

The three joint-accountability controls now have one owner per model:

- Finance `SRF-L4-MON-002` is `ai-platform-provider` on all four models. The control measures gateway failures. On IaaS the customer fills that platform role for the gateway it runs.
- Finance `SRF-L4-MON-003` is `ai-platform-provider` on AI-PaaS and Agent-PaaS, where matrix.json marks L4 provider-managed, and `ai-model-serving` on IaaS, where the customer runs the instances and the persona text assigns confidential-computing execution to AI Model Serving.
- Finance `SRF-L5-MON-001` is `ai-platform-provider` on AI-PaaS and Agent-PaaS, and `ai-model-serving` on IaaS. Signing the artifact stays on `SRF-L5-DEV-002`, owned by `model-provider`.

18 risk-owner cells were set to the persona of a linked control that applies in that model, preferring a control at the risk's layer. At that edit, 4 cells had no linked control in that model (`modelinversionandmembership` and `devmodelleak` and `dsgai05` on AI-SaaS, and `dsgai11` on IaaS). Those four kept their persona and set `no_linked_control_in_model`. Later controls closed the `dsgai05` AI-SaaS gap and the `dsgai11` IaaS gap, so those two cells no longer set `no_linked_control_in_model`. SRF-COM-L5-001 and SRF-COM-L5-004 close the `modelinversionandmembership` AI-SaaS gap, because both apply in AI-SaaS and name `model-provider`, which is that cell's persona. One cell from that edit still has no linked control in that model: `devmodelleak` on AI-SaaS. The draft L1 rows add eight more cells with `no_linked_control_in_model`: `missingoversight` on AI-SaaS, AI-PaaS, and IaaS, `misleadingclaims` on all four models, and `uncontestable` on IaaS. `thresholds/gap-register.md` lists every cell that sets the flag. 9 of the original 31 mismatched cells already matched after the sector map and the control-owner edits, so the persona was left as it was. The previous persona and note for each changed cell are in `owner_alignment`.

## Orphan check

Bill's rule for the relationship map is that every risk, obligation, control, and accountable persona sits in at least one complete ROCA chain. A chain runs from a risk to an obligation, from that obligation to a control, and from that control to an accountable persona.

`build/roca_orphans.py` reads the same links the map builds in `tools/relationship-map/app.js`.

- Risk to obligation: `threats[].obligations[]` in `data/threats.json`. An obligation is a `requirements[]` row in `data/moral-regulatory-hierarchy.json`.
- Obligation to control: a control citation that matches the requirement, using the same match as `citationsForControl`, or the control named in `threats[].obligations[].source.controls[]`.
- Risk to control, direct column: the control id is in `threats[].related_controls`.
- Risk to control, transitive column: the control cites an obligation that some risk links. A control can appear in both columns. The two columns are counted separately.
- Control to persona: `accountable_by_model` or `accountable_persona` on controls in `data/*-controls.json`, including `data/common-controls.json`. A persona named for any of the four operating models (AI-SaaS, AI-PaaS, Agent-PaaS, and IaaS) counts.

An item is an orphan when a link is missing.

- A risk is an orphan when it has no obligation, or no obligation that reaches a control with an accountable persona.
- An obligation is an orphan when no risk links it, or it reaches no control.
- A control is an orphan when it is in neither the direct column nor the transitive column, or it reaches no obligation, or it names no accountable persona.
- A persona is an orphan when no control it is accountable for is on a complete chain.

The persona list is `personas[]` and `sector_specializations[]` in `data/personas.json`. The check counts every control file under `data/`, including common controls and tapestry controls. The map does not draw tapestry records on an SRF chain. This check still reports a tapestry control when a link is missing.

A control that is also a row in `thresholds/gap-register.json` is still an orphan when a link is missing. The report marks that line `in gap register`.

An item is counted in each layer it names. The total counts the item once. Layer here is the SRF layer on the record (`L1` through `L5`).

Run the check from the repository root:

```
python3 build/roca_orphans.py
```

The command prints each orphan, grouped by type and layer, with the id and the missing link. `thresholds/orphan-baseline.json` holds the orphan counts by type and layer, and the direct and transitive control-to-risk counts. The run fails when an orphan count is above that baseline, and when the script itself errors. Orphans at or below the baseline do not fail the run.

`mode` in that file is `report-only`. Set `mode` to `blocking` to fail the run when any orphan remains. Use that setting when the counts reach 0.

`python3 build/test_roca_orphans.py` runs the fixture tests. `python3 build/roca_orphans.py --print-baseline` prints a baseline document for the current data. Replace `thresholds/orphan-baseline.json` with that output when the accepted counts change, and keep `mode` as `report-only` until the counts are 0.
