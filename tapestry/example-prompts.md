# Project Tapestry: example prompts for aisharedresponsibility.com

Copy-ready prompts that ground AI Alliance [Project Tapestry](https://thealliance.ai/projects/tapestry) questions in the published JSON on [aisharedresponsibility.com](https://aisharedresponsibility.com/).

These prompts assume `main` has published the Federated-Consortium extension (`data/tapestry-controls.json`, Federated-Consortium in `matrix.json`, and the two proposed-extension personas). Re-fetch URLs in each new session; do not reuse earlier fetches.

**Human browser:** [https://aisharedresponsibility.com/tapestry/controls/](https://aisharedresponsibility.com/tapestry/controls/)  
**Join conventions:** [https://aisharedresponsibility.com/developers/schema/](https://aisharedresponsibility.com/developers/schema/)  
**Join hints index:** [https://aisharedresponsibility.com/data/index.json](https://aisharedresponsibility.com/data/index.json) (`join_hints`)

Provenance note: Federated-Consortium, TAP-SRF controls, and the two Tapestry personas are `proposed-extension`. They are not CoSAI-ratified.

---

## Shared rules (paste once per chat)

```
You ground answers for AI Alliance Project Tapestry in published JSON from aisharedresponsibility.com.

Re-fetch every URL you use. Do not reuse earlier session content.
Before answering, confirm:
- models[].id in matrix.json includes Federated-Consortium
- personas.json includes sovereign-participant-node and consortium-core-coordinator

Always fetch when relevant:
1. https://aisharedresponsibility.com/data/matrix.json
2. https://aisharedresponsibility.com/data/personas.json
3. https://aisharedresponsibility.com/data/tapestry-controls.json
When the question touches national law or moral orientation, also fetch:
4. https://aisharedresponsibility.com/data/jurisdictions.json
5. https://aisharedresponsibility.com/data/regulations.json
6. https://aisharedresponsibility.com/data/moral-regulatory-hierarchy.json
For graph / join work, also fetch:
7. https://aisharedresponsibility.com/data/index.json  (read join_hints)
8. https://aisharedresponsibility.com/ids.json
9. https://aisharedresponsibility.com/ontology/nodes.json
10. https://aisharedresponsibility.com/ontology/edges.json

Rules:
- Operating model is Federated-Consortium unless I say otherwise.
- Parties are shared_commons and sovereign_assets, never customer/provider.
- Exactly one accountable persona per activity: consortium-core-coordinator or sovereign-participant-node.
- Use disclosure_tiers and tier_selection_rule; never equate accountability with universal public disclosure.
- Mark provenance proposed-extension.
- Cite control ids and implementation_status. If status is open, say the duty is recorded but the mechanism is unresolved.
- Prefer ontology edges keyed by ids.json (join_hints.preferred_path). Join source files only for properties edges omit.
- If the JSON does not resolve the question, say so.
```

---

## A. Accountability demos

### A1. Operating model: peers, not vendor/customer

**JSON:** `matrix.json`, `personas.json`

```
Fetch:
- https://aisharedresponsibility.com/data/matrix.json
- https://aisharedresponsibility.com/data/personas.json

Re-fetch now. Confirm models[].id includes Federated-Consortium and personas includes sovereign-participant-node before answering.

Question: Project Tapestry is a federated consortium for co-training a Shared Base while each nation keeps sovereign data local. Using only those files:
1. Contrast Federated-Consortium parties with AI-SaaS customer/provider parties.
2. For each layer L1-L5, state the shared_commons and sovereign_assets cell values.
3. Name the two proposed-extension personas and which accountability domain each defaults to.
4. Explain why "shared" is not a final accountability answer in this model.

Cite model.id, cell keys, and persona ids. Do not invent a third party.
```

**Tapestry need:** trusted governance with peer institutions, not a cloud RACI.

---

### A2. Who answers for contribution vs certification

**JSON:** `tapestry-controls.json`

```
Fetch:
- https://aisharedresponsibility.com/data/tapestry-controls.json

Question: For Project Tapestry, assign one accountable persona to each duty below. Use only controls in that file.
1. Accepting a weight update into the Shared Base without seeing raw training data
2. Declaring lawful rights to train on local data before submitting weights
3. Anti-capture review before a certification or standards change
4. Keeping sovereign derivative lineage and license records
5. Exit/migration documentation so a participant can leave independently

For each duty: control id, title, layer, lifecycle_stage, accountability_domain, accountable_persona, disclosure_tier, implementation_status.
Flag every control whose status is open or conflicted-in-source.
```

**Tapestry need:** Governance & Participation WG “who evaluates, who certifies.”

---

### A3. Disclosure tier without forcing public data

**JSON:** `tapestry-controls.json` (tiers + `tier_selection_rule`)

```
Fetch:
- https://aisharedresponsibility.com/data/tapestry-controls.json

Read accountability_domains, disclosure_tiers, property_classes, and tier_selection_rule.

Scenario: A national hospital node will contribute only weight updates from PHI-bearing local CPT. It cannot publish provenance publicly and cannot send raw data to the core.

Using the tier_selection_rule and property_classes:
1. Pick the disclosure tier for (a) memorization/poisoning checks on the weight artifact, (b) existence of consent records, (c) the legal judgment "we hold sufficient rights."
2. State which controls apply (ids) and which persona owns each.
3. Explain why technical-evaluation can dominate consortium-confidential for a sovereignty-constrained node, and where contractual-representation still must remain.

Do not recommend universal public disclosure.
```

**Tapestry need:** TAP-010 proportionate verification; only the weights are shared.

---

### A4. National law on the sovereign-assets side

**JSON:** `tapestry-controls.json`, `jurisdictions.json`, `regulations.json`, `moral-regulatory-hierarchy.json`

```
Fetch:
- https://aisharedresponsibility.com/data/tapestry-controls.json
- https://aisharedresponsibility.com/data/jurisdictions.json
- https://aisharedresponsibility.com/data/regulations.json
- https://aisharedresponsibility.com/data/moral-regulatory-hierarchy.json

Scenario: Two Tapestry participant nodes join the same training run.
- Node A: jurisdiction = eu
- Node B: jurisdiction = south-korea (or korea, matching jurisdictions.json)

Task:
1. Find every TAP-SRF control with jurisdiction_binding.
2. For Node A and Node B separately, resolve example_instruments through regulations.json (match id or mapping_key) and report jurisdiction, lifecycle, and applicable_verticals if present.
3. From moral-regulatory-hierarchy.json, give actor/action/outcome salience for the matched priority instruments that appear for each node.
4. Answer: which duties stay on sovereign-participant-node (local law) vs consortium-core-coordinator (commons), and why the consortium must not collapse both nodes into one acceptable-use rule.

Cite control ids and instrument ids. If an instrument is missing from the moral file, say unmatched rather than inventing scores.
```

**Tapestry need:** cultural/national sovereignty; Phase 0 cultural alignment; local law without capture.

---

### A5. Anti-capture checklist for a governance proposal

**JSON:** `tapestry-controls.json`, `matrix.json`

```
Fetch:
- https://aisharedresponsibility.com/data/tapestry-controls.json
- https://aisharedresponsibility.com/data/matrix.json

Proposal under review: "Any participant that receives Shared Base access must contribute all downstream fine-tunes and evaluation datasets back to the commons under CDLA-2.0."

Using only the JSON:
1. List every control this proposal would violate (id, title, accountable_persona, mappings.tap_adr or anti_capture_principle).
2. State which anti-capture direction it breaks: capture of the commons, capture of participants, or both.
3. Propose a compliant rewrite that keeps Shared Commons open while leaving Participant Sovereign Assets voluntary.
4. Name the single persona accountable for publishing the corrected participation terms.

Cite Federated-Consortium cells that support the rewrite.
```

**Tapestry need:** anti-capture principle; openness vs sovereignty tension.

---

### A6. Open follow-ons for Phase 1 governance entity

**JSON:** `tapestry-controls.json`

```
Fetch:
- https://aisharedresponsibility.com/data/tapestry-controls.json

Task: Produce a Phase 1 governance backlog from this file alone.
1. Table all controls where implementation_status is open or conflicted-in-source: id, title, lifecycle_stage, accountable_persona, implementation_status_note if present.
2. Map each row to the TAP-010 Follow-on decisions language in the file (follow-on items 2-6 appear in notes and tier_frontier_note).
3. Rank by leverage using tier_frontier_note: prefer work that strengthens technical-evaluation without raw-data access.
4. For each ranked item, state the minimum deliverable the Governance & Participation work group must publish (one sentence).

Do not invent controls outside the file.
```

**Tapestry need:** Phase 1 initial governance and entity; WG early deliverables.

---

## B. Knowledge-graph prompts

### Shared graph preamble

```
You build knowledge graphs for AI Alliance Project Tapestry from aisharedresponsibility.com.

Re-fetch every URL you use. Do not reuse earlier session content.
Before answering, confirm models[].id includes Federated-Consortium and personas includes sovereign-participant-node.

Preferred path (from /data/index.json join_hints):
1. Resolve IDs via https://aisharedresponsibility.com/ids.json
2. Traverse https://aisharedresponsibility.com/ontology/edges.json and https://aisharedresponsibility.com/ontology/nodes.json
3. Join source files only for properties edges omit (disclosure_tier, implementation_status, jurisdiction_binding, moral_profile, matrix cells)

Tapestry source files when needed:
- https://aisharedresponsibility.com/data/matrix.json
- https://aisharedresponsibility.com/data/personas.json
- https://aisharedresponsibility.com/data/tapestry-controls.json
- https://aisharedresponsibility.com/data/layers.json
- https://aisharedresponsibility.com/data/jurisdictions.json
- https://aisharedresponsibility.com/data/regulations.json
- https://aisharedresponsibility.com/data/moral-regulatory-hierarchy.json

Rules:
- Use canonical srf.* / ext.* IDs as node ids.
- Exactly one accountable persona per control.
- Mark provenance proposed-extension for Federated-Consortium and TAP-SRF controls.
- Do not invent nodes or edges absent from the fetched data.
- Output: (A) mermaid flowchart or graph LR, (B) a JSON {nodes, edges} array using the ontology rel names, (C) a short join log listing which files supplied which properties.
```

---

### B1. Core architecture graph

```
Using the knowledge-graph preamble, fetch ontology nodes/edges plus matrix.json, personas.json, and layers.json.

Build a knowledge graph centered on srf.concept.project-tapestry that includes:
- extends_operating_model → srf.opmodel.federated-consortium
- accountable_for_domain edges from each srf.layer.L* to the two personas, with domain and operating_model properties
- operates_at_layer for both tapestry personas
- matrix cell values as edge properties on the domain edges (commons-governed / participant-owned / N/A)

Exclude the 26 TAP-SRF control nodes in this graph.
Output mermaid + JSON {nodes, edges} + join log.
```

**Joins:** ontology `extends_operating_model`, `accountable_for_domain`, `operates_at_layer` + matrix cells + persona records.

---

### B2. Full control accountability graph

```
Using the knowledge-graph preamble, fetch ontology edges/nodes and tapestry-controls.json.

Start from every node matching srf.control.tapestry.*.
Keep only these edge types from the ontology:
- part_of_extension
- applies_to_layer
- accountable_to
- applies_in_operating_model

Enrich each control node with properties from tapestry-controls.json:
accountability_domain, lifecycle_stage, disclosure_tier (threshold.disclosure_tier),
property_class, implementation_status, bears_on_commons.

Color or group mermaid nodes by accountability_domain (shared-commons vs sovereign-assets).
List any control whose ontology accountable_to target disagrees with control.accountable_persona.
Output mermaid + JSON + join log.
```

**Joins:** ontology structural edges + control property join on `srf.control.tapestry.<id>`.

---

### B3. Jurisdiction binding subgraph

```
Using the knowledge-graph preamble, fetch tapestry-controls.json, jurisdictions.json, regulations.json,
moral-regulatory-hierarchy.json, and ontology edges.

Build a graph for a two-node scenario:
- Node A jurisdiction = eu
- Node B jurisdiction = south-korea (match the exact id in jurisdictions.json)

Include only TAP-SRF controls that carry jurisdiction_binding.
For each such control:
1. Ontology edges resolves_against_instrument (keep requirement_class, resolves_per)
2. Join each target instrument to jurisdictions.json via regulations.json item.jurisdiction → issued_in_jurisdiction
3. Join instruments that appear in moral-regulatory-hierarchy.json requirements[]:
   requirement -part_of→ instrument, requirement -emphasizes→ srf.moral.{actor|action|outcome} with salience

Produce two mermaid subgraphs (Node A / Node B) that share the same control nodes but differ on which instruments are in-scope for that jurisdiction.
Also emit JSON {nodes, edges}.
If an example_instrument has no moral requirements, keep the regulation node and note unmatched in the join log.
```

**Joins:** `resolves_against_instrument` → regulations → jurisdictions → moral `part_of` / `emphasizes`.

---

### B4. Disclosure-tier decision graph

```
Using the knowledge-graph preamble, fetch only tapestry-controls.json (plus ids.json if you need canonical ids).

Build a decision knowledge graph from:
accountability_domains, disclosure_tiers, property_classes, tier_selection_rule, and every control.

Nodes:
- two domains
- five disclosure tiers (include verification_strength and disclosure_breadth as properties)
- three property_classes
- each control

Edges (you may mint these local rel names; prefix them local.* so they are not confused with ontology rels):
- local.has_floor: property_class → disclosure_tier (minimum_tier)
- local.capped_at: domain/rule → disclosure_tier when sovereign-assets and bears_on_commons=false
- local.uses_tier: control → disclosure_tier
- local.in_domain: control → domain
- local.has_class: control → property_class

Highlight the undominated frontier named in tier_frontier_note.
Output mermaid + JSON + a table of controls whose selected tier equals the property_class floor.
```

**Joins:** all inside `tapestry-controls.json`; ontology optional for id spelling.

---

### B5. Open-items / Phase-1 governance backlog graph

```
Using the knowledge-graph preamble, fetch tapestry-controls.json and ontology edges.

Build a subgraph of controls where implementation_status is open or conflicted-in-source.
For each:
- keep accountable_to, applies_to_layer, part_of_extension
- attach implementation_status_note as a node property
- add a synthetic node local.tap010.follow_on.{n} when the note references a TAP-010 follow-on item, and edge local.blocks → that follow-on

Group by accountable persona.
Output mermaid ranked left-to-right by leverage implied in tier_frontier_note (technical-evaluation without raw-data access first).
Also JSON {nodes, edges} and a one-line deliverable per open control for Governance & Participation.
```

**Joins:** ontology accountability edges + control status notes.

---

### B6. Contribution path graph (weight update lifecycle)

```
Using the knowledge-graph preamble, fetch tapestry-controls.json, ontology edges, and personas.json.

Build a lifecycle knowledge graph for one Contributed CPT weight update:
Filter controls to lifecycle_stage in {contribution, evaluation, integration}.
Order them as a path, but keep ontology edges rather than inventing sequence edges unless the file declares order.

Show:
- sovereign-participant-node duties on contribution (L2/L5 CON)
- consortium-core-coordinator duties on evaluation/integration (L5 EVL, L4 INT, L5 INT)
- disclosure_tier on each step
- anti-capture relevant L1 CON/EVL controls that gate the path

Output mermaid sequence-style flowchart using canonical ids as node labels, plus JSON {nodes, edges}.
Join log must show how accountable_to was taken from ontology and verified against tapestry-controls.json.
```

**Joins:** lifecycle filter on controls + ontology `accountable_to` / layer / opmodel.

---

### B7. Bulk ingest from the knowledge pack

```
Using the knowledge-graph preamble, fetch:
- https://aisharedresponsibility.com/export/ontology.json
OR (if too large for context) ontology/nodes.json + ontology/edges.json

Project a Tapestry-only knowledge graph:
Keep a node if its id contains tapestry, federated-consortium, sovereign-participant-node, or consortium-core-coordinator,
OR it is the target/source of an edge touching those ids (include layers, moral dims, and ext.framework.* only when linked).

Do not fetch tapestry-controls.json unless you need disclosure_tier or implementation_status properties.
Output:
1. counts: nodes_kept, edges_kept, by rel
2. mermaid graph LR of the projected graph (collapse control nodes into one node per layer if mermaid would exceed ~40 nodes, but keep full JSON)
3. JSON {nodes, edges}
```

**Joins:** pure ontology projection; optional property enrich from controls.

---

## C. `join_hints` query prompts

Start from [data/index.json](https://aisharedresponsibility.com/data/index.json) `join_hints`. Prefer `/ontology/edges.json` keyed by `/ids.json`. Use the field-level `associations[].join` strings only to rebuild or verify an edge.

### Preferred pattern

```
1. Fetch https://aisharedresponsibility.com/data/index.json → read join_hints
2. Resolve IDs in https://aisharedresponsibility.com/ids.json
3. Filter https://aisharedresponsibility.com/ontology/edges.json WHERE rel = <hint.rel>
4. Optionally verify with the source-file join string in associations[]
```

### C1. Force `join_hints` for every TAP-SRF control

```
Fetch https://aisharedresponsibility.com/data/index.json and follow join_hints.preferred_path.

Query: For every srf.control.tapestry.* control, return a row:
control_id | layer | accountable_persona | operating_model | instruments

Method:
1. Filter ontology/edges.json by source prefix srf.control.tapestry.
2. Pivot on rel in (applies_to_layer, accountable_to, applies_in_operating_model, resolves_against_instrument).
3. Do not invent joins. If a property is missing from edges (disclosure_tier, implementation_status), join data/tapestry-controls.json on the short id after the tapestry. prefix.
4. Cite which join_hints.associations[].rel you used for each column. For resolves_against_instrument, note that it is present in ontology edges but not yet listed in associations[].
```

### C2. `accountable_to`

```
Using join_hints, answer: who is accountable for srf.control.tapestry.TAP-SRF-L5-EVL-001?

Method: edges WHERE rel = "accountable_to" AND source = that id.
Verify against tapestry-controls.json accountable_persona.
Do not invent a second owner.
```

### C3. `governed_by` via `mapping_key` (vertical example)

```
Using join_hints, for srf.control.finance.SRF-L1-DEV-001:
1. List governed_by edges and citations.
2. Verify by joining control.mappings.<key> to regulations.json item.mapping_key (not item.id).
3. Show the mapping_key → regulation id pairs.
```

### C4. Evidence path (jurisdiction → regulation → control → persona)

```
Using join_hints, run this multi-hop query and return the path as mermaid plus a table:

START srf.jurisdiction.eu
← issued_in_jurisdiction ← ext.framework.*
Then restrict to frameworks that appear as resolves_against_instrument targets
from srf.control.tapestry.* controls that carry jurisdiction_binding.
From those controls → accountable_to → srf.role.*
From those controls → applies_to_layer → srf.layer.*

Cite each rel from join_hints.associations or from ontology when the Tapestry-only rel is not yet in associations[].
```

### C5. Moral stack: `part_of` + `emphasizes` + optional `implements`

```
Using join_hints:
1. Take ext.framework.eu-ai-act
2. Walk part_of edges backward to ext.requirement.eu-ai-act.*
3. Walk emphasizes edges with salience to srf.moral.{actor|action|outcome}
4. If any srf.control.tapestry.* has resolves_against_instrument to eu-ai-act, attach those controls (do not claim implements unless an implements edge exists)

Output mermaid + JSON {nodes, edges} + join log.
```

### C6. `superseded_by`

```
Using join_hints, find every superseded_by edge in ontology/edges.json.
For each, verify regulations.json lifecycle is rescinded and superseded_by matches.
Report any mismatch. This is not Tapestry-specific; it checks the join convention the Tapestry jurisdiction path depends on.
```

### Association cheat sheet

| `associations[].rel` | Question |
| --- | --- |
| `accountable_to` | Who answers for this control? |
| `governed_by` | Which framework cites apply? |
| `applies_to_layer` | Which SRF layer? |
| `applies_in_operating_model` | SaaS / PaaS / Federated / …? |
| `belongs_to_vertical` | Finance vs tapestry vs …? |
| `specializes` | Sector persona → which canonical role? |
| `issued_in_jurisdiction` | Which legal order issued this? |
| `superseded_by` | What replaced this instrument? |
| `part_of` / `emphasizes` | Requirement’s moral orientation |
| `implements` | Which requirement does this control implement? |
| `applies_to_vertical` | Which industries does this instrument hit? |

Tapestry ontology rels present in edges but not yet in `associations[]`: `part_of_extension`, `accountable_for_domain`, `resolves_against_instrument`.

---

## D. File → need map

| Need | Primary JSON |
| --- | --- |
| Peer / sovereignty split | `matrix.json`, `personas.json` |
| Named duties + owners | `tapestry-controls.json` |
| Weights-only verification | `tapestry-controls.json` disclosure tiers |
| National / cultural law | `jurisdiction_binding` → `jurisdictions.json` → `regulations.json` → `moral-regulatory-hierarchy.json` |
| Anti-capture review | TAP-SRF L1 controls + matrix cells |
| Certification vs private derivatives | `TAP-SRF-L1-CRT-001`, L3 sovereign derivative controls |
| Knowledge graph structure | `ontology/nodes.json`, `ontology/edges.json`, `ids.json` |
| Join path discovery | `data/index.json` → `join_hints` |

---

## Upstream Tapestry references

- [TAP-010: Open Commons and Sovereign Assets](https://github.com/The-AI-Alliance/tapestry/blob/develop/docs/architecture/decisions/adr-010-open-commons-sovereign-assets.md)
- [Anti-capture principle](https://github.com/The-AI-Alliance/tapestry/blob/develop/docs/governance/anti-capture-principle.md)
- [Governance & Participation work group](https://github.com/The-AI-Alliance/tapestry/tree/develop/docs/work-groups/governance-participation)
- [Project page](https://thealliance.ai/projects/tapestry)
