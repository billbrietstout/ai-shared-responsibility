# SRF data sources

Static reference catalog of the machine-readable files this skill fetches over
plain HTTPS. Treat this as a quick offline index. The live, authoritative
version is always `https://aisharedresponsibility.com/data/index.json` and
`https://aisharedresponsibility.com/llms.txt`. If the two disagree, the live
site wins. Prefer live `record_count` values over any count written here.

## Start here

| File | URL | Use it for |
| --- | --- | --- |
| Link index | `https://aisharedresponsibility.com/llms.txt` | Confirming a URL exists before fetching it; discovering new pages or data files |
| Data index | `https://aisharedresponsibility.com/data/index.json` | Schema keys and record counts for every file below |
| Full text | `https://aisharedresponsibility.com/llms-full.txt` | One-shot fetch when a question spans multiple parts of the framework |
| Join conventions | `https://aisharedresponsibility.com/developers/schema/` | Preferred join paths; also summarized under `join_hints` in `/data/index.json` |

## Core framework

| File | URL | Notes |
| --- | --- | --- |
| Layers | `https://aisharedresponsibility.com/data/layers.json` | L1-L5 |
| Personas | `https://aisharedresponsibility.com/data/personas.json` | Eight canonical personas plus `sector_specializations` |
| Responsibility matrix | `https://aisharedresponsibility.com/data/matrix.json` | CoSAI-core models AI-SaaS, AI-PaaS, Agent-PaaS, IaaS, plus proposed Federated-Consortium. Read `parties` per model. Core cell values: `customer-owned`, `shared`, `provider-managed`, `model-evaluation`, `N/A`. Federated values: `participant-owned`, `commons-governed`. |
| Jurisdictions | `https://aisharedresponsibility.com/data/jurisdictions.json` | Issuing-jurisdiction vocabulary |
| Regulations | `https://aisharedresponsibility.com/data/regulations.json` | Instruments with jurisdiction, optional `mapping_key`, `applicable_verticals`, `lifecycle`, `superseded_by` |
| Moral regulatory hierarchy | `https://aisharedresponsibility.com/data/moral-regulatory-hierarchy.json` | Requirement-level actor/action/outcome salience (0-3) for priority instruments |

## Vertical and extension control schemas

One file per industry vertical. Each record maps a control to an SRF layer, an
accountable persona, applicable operating models, and regulatory mappings.
Vertical schemas are companion-site extensions, not CoSAI-ratified.

| Vertical | URL |
| --- | --- |
| Financial services | `https://aisharedresponsibility.com/data/finance-controls.json` |
| Healthcare | `https://aisharedresponsibility.com/data/healthcare-controls.json` |
| Insurance | `https://aisharedresponsibility.com/data/insurance-controls.json` |
| Public sector | `https://aisharedresponsibility.com/data/public-sector-controls.json` |
| Defense / DoD | `https://aisharedresponsibility.com/data/defense-controls.json` |
| Manufacturing | `https://aisharedresponsibility.com/data/manufacturing-controls.json` |
| Project Tapestry (Federated-Consortium) | `https://aisharedresponsibility.com/data/tapestry-controls.json` |

## Cross-cutting data

| File | URL | Use it for |
| --- | --- | --- |
| Vendor risk categories | `https://aisharedresponsibility.com/data/vendor-risk.json` | Vendor-vs-customer split, attestation baseline, evidence to demand per supplier category |
| Threat-to-accountability crosswalk | `https://aisharedresponsibility.com/data/threats.json` | OWASP AI Exchange and DSGAI data-plane failures mapped to SRF layer and persona per operating model |
| Threat source registry | `https://aisharedresponsibility.com/data/threat-sources.json` | Authority, license, and binding rules for external threat sources |
| Finding routing reference | `https://aisharedresponsibility.com/data/finding-routing.json` | Resolving a scored finding to one accountable persona and an escalation ladder |
| Proposed SRF next-version extensions | `https://aisharedresponsibility.com/data/srf-vnext-extensions.json` | Companion asks for a future CoSAI paper; not part of v1.0 |

## Canonical IDs and knowledge layer

| File | URL | Use it for |
| --- | --- | --- |
| Canonical ID registry | `https://aisharedresponsibility.com/ids.json` | One stable `srf.*` ID per concept, layer, role, operating model, jurisdiction, and control |
| Glossary registry | `https://aisharedresponsibility.com/glossary.json` | Every SRF term with its definition and canonical anchor |
| Glossary API | `https://aisharedresponsibility.com/api/glossary/{anchor}.json` | A single term. Anchors are **case-sensitive** and match filenames: `accountability.json`, `L1.json`, `AI-SaaS.json`. List them at `/api/glossary/index.json`. |
| Ontology nodes | `https://aisharedresponsibility.com/ontology/nodes.json` | Concept graph: layers, operating models, personas, jurisdictions, controls, external standards |
| Ontology edges | `https://aisharedresponsibility.com/ontology/edges.json` | Typed relationships including `governed_by`, `specializes`, `issued_in_jurisdiction`, `applies_to_vertical`, and `superseded_by` |

## Naming convention

Vertical slugs used in URLs: `finance`, `healthcare`, `insurance`,
`public-sector`, `defense`, `manufacturing`. Use these exact slugs; the site
uses "healthcare," not "medical."

Control short IDs such as `SRF-L1-ACQ-001` collide across verticals. The
canonical form is `srf.control.<vertical>.<id>`. A control's `mappings` keys
join to `regulations.json` via each item's `mapping_key` field, not via the
regulation `id`.

Before citing an instrument, read its `lifecycle`. The field is absent while the
instrument is in force, `draft` when the text can still change, and `rescinded`
once the issuer withdrew it. A rescinded item names its replacement in
`superseded_by` and carries a matching edge, so the OCC Model Risk Management
handbook booklet resolves to `sr-26-2`, the revised interagency guidance that
replaced it in April 2026. Mappings to a `draft` instrument are held at `TBD` on
purpose, because section numbering moves between drafts.

Requirement-level moral tags live in `moral-regulatory-hierarchy.json`.
Traverse `emphasizes` (with `salience`) and `implements` edges in
`/ontology/edges.json` rather than re-deriving scores from prose.

`implements` is scoped to the instrument a citation is filed under, so it always
sits beside a `governed_by` edge from the same control. A requirement with zero
`implements` edges means no control implements it, not that the graph is
incomplete; `unmatched_expected` in the moral file records which ones and why.

Jurisdiction to vertical: control schemas own vertical specificity. Prefer
`applies_to_vertical` edges from each regulation's `applicable_verticals`
(derived from control citations when present). The evidence path is
jurisdiction → regulation ← `governed_by` ← control → `belongs_to_vertical`.
US multistate (NAIC) is a peer root to federal, not `subordinate_to` it;
only Colorado and New York nest under `us-federal`.
