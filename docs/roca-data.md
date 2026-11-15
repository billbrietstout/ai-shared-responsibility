# ROCA data fields

ROCA is Risk, Obligation, Control, Accountable. It is not a RACI chart. This file records the data fields the relationship map reads. Bill can change any choice listed here.

## Instrument source kind

`data/regulations.json` tags each instrument with `source_kind`:

- `binding`: a statute, regulation, directive, or supervisory instrument the catalog treats as a duty.
- `voluntary_standard`: a voluntary standard, framework, profile, or non-binding guidance. NIST AI RMF and ISO/IEC 42001 are in this group.
- `catalog`: a risk list, threat list, control catalog, control overlay, indicator list, or examiner tool. OWASP LLM Top 10, MITRE ATLAS, CSA AICM, and CIS Controls are catalogs. A catalog is not an obligation.

A record is a current obligation when `source_kind` is `binding` or `voluntary_standard`, `lifecycle` is not `draft` or `rescinded`, and `tags` does not include `proposed`. Set `current_obligation` to false on a record to exclude it even when that rule would include it. The NYDFS 2024 AI cyber letter is excluded because its scope text says the letter adds no requirements.

`build/generate_knowledge_layer.py` copies `source_kind` and `current_obligation` onto each `ext.framework.*` node. `build/verify_knowledge_layer.py` rejects a missing or unknown `source_kind`, and it rejects a node whose flag does not match this rule. `schemas/regulations.schema.json` checks the same enum.
