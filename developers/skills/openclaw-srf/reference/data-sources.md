# SRF data sources

Static reference catalog of the machine-readable files this skill fetches over
plain HTTPS. Treat this as a quick offline index. The live, authoritative
version is always `https://aisharedresponsibility.com/data/index.json` and
`https://aisharedresponsibility.com/llms.txt`. If the two disagree, the live
site wins.

## Start here

| File | URL | Use it for |
| --- | --- | --- |
| Link index | `https://aisharedresponsibility.com/llms.txt` | Confirming a URL exists before fetching it; discovering new pages or data files |
| Data index | `https://aisharedresponsibility.com/data/index.json` | Schema keys and record counts for every file below |
| Full text | `https://aisharedresponsibility.com/llms-full.txt` | One-shot fetch when a question spans multiple parts of the framework |

## Core framework

| File | URL | Records |
| --- | --- | --- |
| Layers | `https://aisharedresponsibility.com/data/layers.json` | 5 (L1-L5) |
| Personas | `https://aisharedresponsibility.com/data/personas.json` | 8 canonical + sector specializations |
| Responsibility matrix | `https://aisharedresponsibility.com/data/matrix.json` | 4 operating models x 5 layers |
| Jurisdictions | `https://aisharedresponsibility.com/data/jurisdictions.json` | 11 (international, oecd, EU, US federal/multistate/states, UK, China, Singapore, Canada) |
| Regulations | `https://aisharedresponsibility.com/data/regulations.json` | 45 instruments with jurisdiction, mapping_key, and applicable_verticals |
| Moral regulatory hierarchy | `https://aisharedresponsibility.com/data/moral-regulatory-hierarchy.json` | Requirement-level actor/action/outcome salience (0-3) for EU AI Act, OECD AI Principles, NIST AI RMF, SR 26-2 |

## Vertical control schemas

One file per industry. Each record maps a control to an SRF layer, an
accountable persona, applicable operating models, and a regulatory mapping.

| Vertical | URL | Controls |
| --- | --- | --- |
| Financial services | `https://aisharedresponsibility.com/data/finance-controls.json` | 40 |
| Healthcare | `https://aisharedresponsibility.com/data/healthcare-controls.json` | 40 |
| Insurance | `https://aisharedresponsibility.com/data/insurance-controls.json` | 40 |
| Public sector | `https://aisharedresponsibility.com/data/public-sector-controls.json` | 40 |
| Defense / DoD | `https://aisharedresponsibility.com/data/defense-controls.json` | 53 |
| Manufacturing | `https://aisharedresponsibility.com/data/manufacturing-controls.json` | 45 |

## Cross-cutting data

| File | URL | Use it for |
| --- | --- | --- |
| Vendor risk categories | `https://aisharedresponsibility.com/data/vendor-risk.json` | Vendor-vs-customer split, attestation baseline, evidence to demand per supplier category |
| Threat-to-accountability crosswalk | `https://aisharedresponsibility.com/data/threats.json` | The sixteen OWASP AI Exchange threats mapped to an SRF layer and accountable persona per operating model |
| Finding routing reference | `https://aisharedresponsibility.com/data/finding-routing.json` | Resolving a scored finding to one accountable persona and an escalation ladder |

## Canonical IDs and knowledge layer

| File | URL | Use it for |
| --- | --- | --- |
| Canonical ID registry | `https://aisharedresponsibility.com/ids.json` | One stable `srf.*` ID per concept, layer, role, operating model, jurisdiction, and control |
| Glossary registry | `https://aisharedresponsibility.com/glossary.json` | Every SRF term with its definition and canonical anchor |
| Glossary API | `https://aisharedresponsibility.com/api/glossary/{anchor}.json` | A single term, for example `accountability.json`, `L1.json`, `AI-SaaS.json` |
| Ontology nodes | `https://aisharedresponsibility.com/ontology/nodes.json` | Concept graph: layers, operating models, personas, jurisdictions, controls, external standards |
| Ontology edges | `https://aisharedresponsibility.com/ontology/edges.json` | Typed relationships including `governed_by`, `specializes`, and `issued_in_jurisdiction` |
| Join conventions | `https://aisharedresponsibility.com/developers/schema/` | Preferred join paths; also summarized under `join_hints` in `/data/index.json` |

## Naming convention

Vertical slugs used in URLs: `finance`, `healthcare`, `insurance`,
`public-sector`, `defense`, `manufacturing`. Use these exact slugs; the site
uses "healthcare," not "medical."

Control short IDs such as `SRF-L1-ACQ-001` collide across verticals. The
canonical form is `srf.control.<vertical>.<id>`. A control's `mappings` keys
join to `regulations.json` via each item's `mapping_key` field, not via the
regulation `id`.

Requirement-level moral tags live in `moral-regulatory-hierarchy.json`.
Traverse `emphasizes` (with `salience`) and `implements` edges in
`/ontology/edges.json` rather than re-deriving scores from prose.

Jurisdiction to vertical: prefer `applies_to_vertical` edges from each
regulation's `applicable_verticals`. The evidence path is jurisdiction →
regulation ← `governed_by` ← control → `belongs_to_vertical`.