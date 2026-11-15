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
