# SRF layer-by-layer threat model tool: design

Draft for Bill Stout, Nov 16, 2026 (PT), updated later the same day for Bill's decisions and again to add four more example processes. Later the same day, Bill asked that this prototype be committed under `tools/threat-model/` in the site repo. It is not listed on `tools/index.html` or in the site navigation, and it is not part of CoSAI SRF v1.0. Bill approved the items marked **Approved by Bill** below. No item is still "proposed, pending Bill"; the open questions are listed at the end. Example owners are placeholders. Every obligation is unverified and is not legal advice.

## Files

| File | What it is |
|---|---|
| `DESIGN.md` | This document |
| `threat-model.schema.json` | JSON Schema (draft 2020-12), version `0.1.0-draft` |
| `example-o2c.yaml` / `example-o2c.json` | Agentic Order to Cash (O2C). The prototype default. |
| `example-p2p.yaml` / `example-p2p.json` | Agentic Procure to Pay (P2P) |
| `example-h2r.yaml` / `example-h2r.json` | Agentic Hire to Retire (H2R) |
| `example-r2r.yaml` / `example-r2r.json` | Agentic Record to Report (R2R, financial close) |
| `example-case.yaml` / `example-case.json` | Agentic Case to Resolution (customer service) |
| `example-case-saas.yaml` / `example-case-saas.json` | Case to Resolution on a managed AI service desk (AI-SaaS). Shows the L5 N/A customer case |
| `index.html` | Single-file prototype. Open `/tools/threat-model/` in a browser, or open this file locally. An example picker loads any of the six; O2C is the default. No build step, no network calls |
| `tests/test_cascade.js` | 75 headless tests of the cascade logic, the one graph, derived links, default multiplicity, versions, data flow, stakeholders, gaps, controls, layer order, the six examples, catalog links, the example picker, the pane layout and the UI (jsdom) |
| `tests/test_schema_export.py` | 55 checks: schema, every example, export, the export disclaimer, rejection cases, and a wording check |

## Decisions by Bill, Nov 16, 2026

Source: "Decisions by Bill, Nov 16, 2026" in `drafts/architecture-frameworks-srf.md`, plus two later sets of decisions relayed the same day (rows a to d, then rows e to i).

| # | Item | Status | Where it is in the tool |
|---|---|---|---|
| 1 | Ownership is an overlay: a field and a band on each component | **Approved by Bill** | `owner` field on every component; the owner line on each node; the "Ownership overlay" switch fills red any component with zero owners or two or more (TM-G01, TM-G02) |
| 2 | The 9 relationship types | **Approved by Bill** | `relationship.type`. Association stays out of the stored types; a link can carry `unclassified: true` ("unclassified, needs review") instead (TM-G22) |
| 2a | Cite ArchiMate 4, using v4 definitions where verified | **Approved by Bill** | See "Relationship types." All 9 types appear in ArchiMate 4 according to two secondary sources; none is verified against the official v4 text, so each is flagged |
| 3 | An L3 component realizes L1 logic, with the logic version and the L1 owner's approval on the link | **Approved by Bill** as both a candidate SRF pattern and a candidate control | `realization` with `logic_version` and `l1_approval` (TM-G04, TM-G20). Nothing was sent to CoSAI |
| 4 | A data flow view across L1 to L5 | **Approved by Bill**, added | "Data flow" tab; `TM.dataFlows()` |
| 5 | Network, facilities, edge or OT hosts, and location as candidate L4 component types | **Approved by Bill** as candidates, added | Types `network`, `facility`, `edge_ot_host`, `location`; two examples (TM-G25) |
| 6 | Versioned states in the first version | **Approved by Bill**, added | `versions`, `valid_from`, `valid_until` on components and links; `snapshots`; the Snapshot selector |
| 7 | Affected individuals and relevant authorities as stakeholders on L1 threat models | **Approved by Bill**, added | `stakeholders`, `threat.stakeholder_ids` (TM-G24). Not personas, never owners |
| b | `cascade`, `multiplicity` and `boundary` fields on links | **Approved by Bill** | `relationship.cascade`, `.multiplicity`, `.boundary` |
| d | A control in place lowers a component from failed to impacted; it does not stop a cascade | **Approved by Bill**, built | See "How a cascade is computed" |
| e | Merge the parent-child graph and the dependency graph into one graph of typed links with the `cascade` field; parent-child links still roll impact up | **Approved by Bill** (replaces the earlier proposal to keep two graphs), built | `CASCADE_RULES` now holds composition and aggregation; see "One component graph" for the two intended changes in behavior |
| f | The `derived` flag | **Approved by Bill**, built | `derived` and `derived_from` on links; example `rel.d1`; TM-G27 |
| g | L1 step owners map to AI System Governance | **Approved by Bill**, as built | Every L1 step owner in the example; a test checks it |
| h | Apply default multiplicity rules automatically; users can override them; gaps flag violations | **Approved by Bill**, built | Rules MD-01 to MD-05; `multiplicity_rules` and `multiplicity_overrides`; TM-G18 and TM-G26; a table on the Gaps tab |
| i | Keep this a separate tool | **Approved by Bill** | No site or Decision Record change. "Fit with the site" now only describes possible links |

`drafts/architecture-frameworks-srf.md` (decision 11) still records the separate graphs as approved. This file follows Bill's later decision to merge them. I did not edit that file.

Bill's decision 8 (raise the v1.0 layer-name differences with the workstream: not yet) and decision 9 (recheck COBIT 7 after Nov 19) do not change the tool.

## Decisions by Bill, Nov 17, 2026

Bill answered Part 1 of the Nov 17 publication plan. Items 7 to 11 of that plan are not approved and were not done. The tool stays off `/tools/`, the sitemap and the navigation.

| # | Item | What changed |
|---|---|---|
| 2 | Cite outside threat sources | Optional `catalog_threat_id` and `external_refs` on each threat. Filled only where a real match exists in `/data/threats.json`; `external_refs` copies that entry's IDs. See "Catalog links" |
| 3 | Per-obligation provenance | Each obligation in the Threats tab shows "Unverified, needs counsel". `citation` stays null |
| 4 | Disclaimer where readers look | `system.disclaimer` is the first field of every JSON and YAML export, the YAML export starts with it as a comment, and the Threats tab ends with it. The sentence matches the page header |
| 5 | Accessibility | The graph SVG is a group, not an image, so its focusable nodes are no longer nested in an image (`nested-interactive`). Each node's accessible name starts with its visible text (`label-content-name-mismatch`). A List view shows every component by layer as text. The two text areas have labels |
| 6 | Explain ROCA and the link words | A one-line glossary under the filters. Each link filter shows its plain reading; the ArchiMate term is in the tooltip |
| Q1 | Who is accountable for the reasoning-LLM threat | The AI Model Provider persona (`srf.role.model-provider`) on the provider side, as in `/data/threats.json`. The Agent-PaaS examples name "Model vendor (placeholder)" and the AI-SaaS example names the SaaS vendor's model provider. In each, the accountable is also the owner of the reasoning LLM, so TM-G06 no longer fires for this threat |
| Q5 | Is Agent-PaaS right for the examples | Kept, and an AI-SaaS example was added: Case to Resolution on a managed AI service desk. See "Example business processes" |
| Q2 | ArchiMate 4 text | Not used. See "Relationship types" |
| Part 2 | Evidence for L2 and L5 starting points | Listed in "Evidence for L2 and L5 starting points", and as help text on L2 and L5 components in the Component tab |

## Purpose

The tool models one AI system as components across the 5 SRF v1.0 layers:

- L1 AI Business & Usage
- L2 AI Information
- L3 AI Application
- L4 AI Platform
- L5 AI Model Provider

A user records each component's layer, type and one owner. The user then links components with typed relationships and attaches threats as ROCA chains (Risk, Obligation, Control, Accountable). The tool answers four questions:

1. If this component or threat fails, which components fail or are harmed, in which layer, and whose are they? (cascade, or blast radius)
2. Which controls does a component run itself, and which does it inherit from another component?
3. Where is ownership missing: no owner, an owner marked "shared," or a threat with no single accountable person?
4. Where does one person own the business logic while another owns the component that runs it?

It is separate from the existing site tools. It reads no site data today (see "Fit with the site").

## Terms

- **Component**: the thing that is owned. It has exactly one owner (default rule MD-03).
- **Layer**: where a component sits (L1 to L5).
- **Owner**: a named role, mapped to one of the 8 SRF v1.0 personas, on the customer or provider side.
- **Persona**: one of the 8 SRF v1.0 accountability roles: AI System Users, AI System Governance, Data Provider, Application Developer, Agentic Platform and Framework Providers, AI Platform Provider, AI Model Serving, AI Model Provider (ID `model-provider`). Legal roles named in a law are addressees of obligations, not personas (rule PER-3).
- **Operating model**: one of AI-SaaS, AI-PaaS, Agent-PaaS, IaaS. Set once for the system; a component can override it.

## Data model

One document holds one system. Top-level keys: `tm_schema_version`, `system`, `overlays`, `components`, `relationships`, `obligations`, `controls`, `threats`. The schema rejects unknown keys.

**multiplicity_rules** (top level, optional): model-wide changes to the default multiplicity rules, each `{rule_id, lower, upper, off, reason}`.

**system**: `id`, `name`, `operating_model` (one of the 4), `as_of` (the date whose state is shown and used for Required tests), `snapshot_id` (optional; a snapshot replaces `as_of`), `overlays_enabled` (for example `[banking]`).

**snapshots** (Approved by Bill, decision 6): `id`, `name`, `as_of`, optional `pins {record_id: version}`. A pin of `base` means "no versions applied."

**stakeholders** (Approved by Bill, decision 7): `id` (`stk.*`), `name`, `kind` (`affected_individuals` or `relevant_authority`), `description`, `affected_by_component_ids` (L1 components whose harm reaches them), `vertical`. The schema gives stakeholders no `persona_id`, `party` or `owner` field, so they cannot be used as personas or owners.

**overlays**: vertical obligation overlays on the horizontal baseline. Any component, relationship, obligation, control or threat tagged `vertical: banking` is in scope only when `banking` is enabled. Untagged records, and obligations tagged `baseline`, are always in scope.

**components**:

- `id` (`cmp.*`), `name`, `layer`, `type`
- `srf_component`: optional. One of the 15 component names in the SRF matrix figure, as listed in site `layers.json`.
- `owner`, in one of three forms:
  - `{status: assigned, name, persona_id, party: customer|provider, placeholder}`
  - `{status: none}`
  - `{status: shared, names: [...]}`
  The last two are allowed only so the gap is recorded and shown. "Shared" is never a final answer (PER-4).
- `logic`: for `business_logic` components. Holds `version`, `approved_by`, `approved_on` and `change_control`. L1 logic is an asset with its own change control.
- `settings`: for `model_settings` components. Holds `model_version`, `reasoning_effort`, `fallback` and `change_approver`. These settings change L1 behavior, so an L1 person approves changes.
- `operating_model`: optional override. SRF v1.0 section 3 says operating models may need to be defined per component.
- `versions`, `valid_from`, `valid_until`: versioned states (see "Versioned states").
- `multiplicity_overrides`: optional changes to a default multiplicity rule for this component (see "Default multiplicity rules").

Component types: `business_process`, `process_step`, `business_logic`, `data_store`, `data_feed`, `input_channel`, `orchestrator`, `sub_agent`, `ai_component`, `policy_service`, `model_settings`, `tool`, `agent_runtime`, `gateway`, `guardrail`, `platform`, `model`. Candidate L4 types (Approved by Bill as candidates, decision 5): `network`, `facility`, `edge_ot_host`, `location`. They are not SRF v1.0 components, and TM-G25 labels each use.

**relationships**:

- `id` (`rel.*`), `type`, `from`, `to`
- `unclassified`: optional flag, "unclassified, needs review." A flagged link may omit `type` and `cascade`. A link with no type is drawn grey and skipped by the cascade (TM-G22).
- `cascade` (Approved by Bill): `hard` or `soft`. Required on every classified link.
- `multiplicity` (Approved by Bill): optional `{lower, upper}`. The allowed number of links of this type into the `to` component. It wins over the default rule for that link type and target.
- `boundary` (Approved by Bill): optional. Asserted per operating model as `crosses`, `internal` or `unknown`. If absent, the tool derives it from the owners' `party`.
- `versions`, `valid_from`, `valid_until`: versioned states.
- `logic_version` and `l1_approval {approved_by, approved_on, ref}`: for realization of L1 logic.
- `access_mode` (`read`, `write`, `readwrite`), `provides` (`function` or `controls`, for serving), `carries` (for flow).
- `containment_control_ids`: controls on this link. In "with controls" mode, one in place lowers a failure crossing the link to impact. The field keeps its first name so older files still load.
- `derived` (Approved by Bill): true if the link was inferred through a chain rather than drawn. A derived link must list `derived_from`, the chain of links it summarizes, in order.

**obligations**: `id`, `title`, `instrument`, `citation`, `instrument_type`, `strength` (`binding`, `voluntary`, `unknown`), `in_force` (`yes`, `no`, `unknown`), `applies_from`, `applies_until`, `applies_if`, `vertical`, `verification {status, method, checked_on}`, `sources`. Every example obligation has `verification.status: unverified` and `citation: null`.

**controls**: `id`, `title`, `component_id` (exactly one component, rule CH-4), `status` (`in_place`, `planned`, `missing`), `applies_to_children`, `obligation_links [{obligation_id, basis, review_status}]`, optional `catalog_control_id` (for example a `srf.control.cross.*` ID), `vertical`. A control's owner is its component's owner.

**threats** (one ROCA chain each):

- `risk {asset, actor, failure_mode, impact}`
- `target_component_id`
- `failure_class`:
  - `logic`: the logic is wrong and runs as written. The L1 logic owner is accountable.
  - `execution`: the logic is right but runs wrongly. The executing component's owner fixes it; the impact lands at L1.
  - `data`, `model_behavior`, `control_loss`: a dependency fails.
- `obligation_ids`, or a `no_obligation {reason}` finding when there are none (CH-1)
- `control_ids`
- `accountable`: exactly one person
- `business_response_owner`: optional. The L1 owner who decides the business response to an execution failure.
- `stakeholder_ids`: affected individuals and relevant authorities. Not owners.

## Relationship types

Approved by Bill (decision 2). The tool uses 9 of the 11 ArchiMate relationship types and cites **ArchiMate 4** (Bill, Nov 16, 2026). It leaves out association, which is untyped (the `unclassified` flag replaces it), and specialization, which belongs in a type schema.

**Verification of the v4 definitions.** I could not read the official ArchiMate 4 text:

- The Open Group's specification pages require sign-in.
- The publisher's sample PDFs of the v4 specification and Pocket Guide state that use with generative AI tools is not permitted without written permission, so I did not open them.

**Nov 17, 2026.** Bill supplied a copy of the ArchiMate 4 specification. Its copyright notice does not permit using the publication in connection with generative AI tools without written permission from The Open Group. Checking the definitions with an AI assistant falls under that, so the copy was not used. No flag was cleared. Clearing them needs a person to compare the 9 definitions by hand, or written permission.

Two secondary sources list all 11 ArchiMate 4 relationship types with short definitions: Linked.Archi's ArchiMate 4.0 guide, which cites specification chapter 5, and Archyno's "ArchiMate relationships" article. Their wording matches the ArchiMate 3.2 reference card for every type below, except that Linked.Archi reports a wider Assignment in v4. So the table uses the 3.2 reference-card wording, which is official, and flags every type as **not verified against the official ArchiMate 4 text**.

| Type | Definition (ArchiMate 3.2 reference card wording) | In ArchiMate 4? | Graph | Plain name from the chat | Direction (`from` to `to`) |
|---|---|---|---|---|---|
| composition | An element consists of one or more other concepts | Yes, secondary sources only. Flag: not verified in v4 | component (parent-child) | parent-of (part cannot exist alone) | whole to part |
| aggregation | An element combines one or more other concepts | Yes, secondary only. Flag | component (parent-child) | parent-of (part is shared) | whole to part |
| assignment | Allocation of responsibility, performance of behavior, storage, or execution | Yes, secondary only. Flag. Linked.Archi reports that v4 also lets an application component be assigned to a data object (golden source) | component | runtime or performer | assignee to what it executes |
| realization | An element plays a critical role in the creation, achievement, sustenance, or operation of a more abstract element | Yes, secondary only. Flag | component | executes-logic-of | L3 realizer to L1 logic or step |
| serving | An element provides its functionality to another element | Yes, secondary only. Flag | component | depends-on (reversed); with `provides: controls`, inherits-controls-from (reversed) | provider to consumer |
| access | Behavior and active structure elements observe or act upon passive structure elements | Yes, secondary only. Flag | component | data dependency | accessor to data |
| flow | Transfer from one element to another | Yes, secondary only. Flag | component | delegates-to, when it carries authority | source to target |
| triggering | A temporal or causal relationship between elements | Yes, secondary only. Flag | component | step order | earlier step to later step |
| influence | An element affects the implementation or achievement of some motivation element | Yes, secondary only. Flag | motivation | (none) | obligation to control |

## One component graph

Approved by Bill (decision e). Earlier drafts kept a containment graph (composition, aggregation) apart from a dependency graph. The tool now keeps one graph. Every component link is a typed edge with a `cascade` field, and the cascade runs over all of them in one pass. Composition and aggregation are still told apart as **parent-child** links, because they do three jobs the other types do not:

- they roll impact up from part to whole
- they pass down controls marked `applies_to_children`
- they are checked for cycles (TM-G11) and for a part with two wholes (MD-05)

Influence links stay outside the component graph, because they join an obligation to a control, not two components.

Dependencies form a graph, not a stack. A link can go up, down or across layers.

The merge keeps every result the earlier tests checked. For every component in the example, the merged cascade reaches the same components in the same states as the two-graph version did, in both modes and in both the Nov 16 and December states. A one-off check against the old engine found no differences. The merge changes behavior in two cases, both on purpose:

1. **Strongest state wins on a whole.** Before, roll-up skipped a whole that the cascade had already reached, so a whole that a failed component only read stayed "exposed" even when one of its parts failed. Now roll-up raises it to "impacted." A test builds this case.
2. **The `cascade` field now applies to parent-child links.** Before, roll-up ignored it. Now a hard parent-child link rolls impact up from a failed or an impacted part. A soft one rolls it up only from a failed part, for a whole that keeps working when one part is merely degraded. Every parent-child link in the example is hard, so the example's results do not change.

Roll-up still never travels from whole to part, and an impacted whole passes nothing on through dependency links. A failed step therefore still does not fail its sibling steps.

## How a cascade is computed

The `cascade`, `multiplicity` and `boundary` fields are Approved by Bill. The rules below are my design.

States, from strongest to weakest:

- **failed**: the component misbehaves and can pass the failure on.
- **impacted**: the component works, but its business outcome is harmed. It passes nothing on except by roll-up.
- **exposed**: the component lost a protection: an inherited control, or data read by a failed component.

A component can also be marked **lowered**. That means a control in place on the incoming link turned "failed" into "impacted" (decision d, Approved by Bill).

Rules on the one graph. Only a failed component passes a failure on through a dependency link. A soft dependency link turns "failed" into "impacted." Parent-child links pass impact up only.

| Type | Travels | Result | Reason |
|---|---|---|---|
| serving | provider to consumer | failed (hard) or impacted (soft); exposed if `provides: controls` | The consumer needs what the provider gives |
| assignment | assignee to assigned | failed or impacted | A compromised runtime affects what it runs |
| realization | logic to realizer | failed | Logic failure: the realizer runs flawed logic as written. The L1 owner is accountable |
| realization | realizer to logic | impacted | Execution failure: the realizer's owner fixes it, and the L1 owner decides the business response |
| access | data to accessor | failed or impacted | Tampered data reaches the reader |
| access | accessor to data | failed if `write` or `readwrite`; exposed if `read` | Write access spreads tampering; read access exposes the data |
| flow | source to target | failed or impacted | Contaminated input, instructions or authority travel on |
| triggering | step to next step | failed or impacted | A skipped or forged trigger can bypass later controls |
| composition, aggregation | part to whole | impacted (hard: from a failed or impacted part; soft: from a failed part only) | A broken or degraded part harms the whole. Nothing travels down |
| influence | none | none | Changing an obligation marks its controls for review |
| unclassified, no type | none | none | No defined meaning until someone classifies it |

Algorithm:

1. Resolve the model to the chosen date or snapshot (see "Versioned states"), then apply the overlays.
2. Mark the seed component failed. For a threat, the seed is its target component.
3. Run one worklist over all component links, skipping derived links (see "Derived links"). A component's state rises (exposed, then impacted, then failed) and never falls, so the loop ends even when the graph has cycles. Each reached component stores its hop count and the link it came through, so the tool can show the path.
4. In "with controls" mode, if a link has a `containment_control_ids` control with status `in_place` and the failure would arrive as "failed," the target becomes "impacted" instead and is listed as lowered. The target is still in the blast radius. Because it is impacted, it does not pass a failure on. A control never lowers a link that already gives "impacted" or "exposed." If the target fails through another link, it is not counted as lowered.
5. Roll-up happens inside the same worklist: a failed or impacted part makes each whole above it impacted, subject to the link's `cascade` value. Roll-up never comes back down, and an impacted whole does not pass a failure on.
6. Group the results by layer and by owner, including how many were lowered. "No owner" and "Shared: ..." appear as owners, so gaps show up in the blast radius.
7. List the stakeholders whose `affected_by_component_ids` include a reached component.

The example shows the reasoning LLM case (Nov 16 state). A failure at the L5 reasoning LLM:

1. Passes through the L4 gateway (serving) to the L3 orchestrator.
2. Passes from the orchestrator to all 5 sub-agents (flow that carries delegated authority), and to the candidate L4 warehouse edge/OT host (pick and ship release).
3. Reaches the L1 steps those agents realize, as impact.
4. Rolls up to the O2C process.

That is 23 components reached. The policy service and the credit step are not reached.

In "with controls" mode, the discount authority and refund cap controls sit on the links from the orchestrator to the pricing agent and the disputes agent. They lower both agents from failed to impacted. Both agents stay in the blast radius, but the pricing and disputes steps are no longer reached through them, so 21 components are reached. This is the "hard rules stay outside the model" pattern.

## Example business processes

The prototype includes six worked examples. Use the Example selector in the tool; Order to Cash stays the default. Each of the four added examples is modeled the same way as O2C: an orchestration agent and five sub-agents run on a reasoning LLM from an AI Model Provider; hard rules are enforced by a policy service outside the model; one separate AI component sits off the reasoning-LLM path. Every owner is a placeholder. Every obligation is unverified and is not legal advice. One vertical overlay is included in each example and is off by default.

| Example | Components | Relationships | Threats | Overlay (off by default) |
|---|---|---|---|---|
| Order to Cash (O2C) | 32 | 67 | 13 | Banking |
| Procure to Pay (P2P) | 31 | 68 | 12 | Public sector procurement |
| Hire to Retire (H2R) | 31 | 67 | 12 | Employment law |
| Record to Report (R2R) | 30 | 65 | 12 | SOX-style financial reporting |
| Case to Resolution | 31 | 68 | 12 | Consumer protection |
| Case to Resolution, AI-SaaS | 31 | 68 | 12 | Consumer protection |

**AI-SaaS example (Bill, Nov 17, 2026, Q5).** Case to Resolution fits AI-SaaS best: many contact centers buy a managed AI service desk rather than build agents. The example keeps the Agent-PaaS case's components, links and threats, and changes the operating model and the owners:

- The SaaS vendor builds and runs the agents, the policy service, the model settings, the runtime and the gateway. Those owners are on the provider side.
- The reasoning LLM and the fallback model come from the vendor's own AI Model Provider.
- The customer keeps the L1 process, the hard-rule values it sets in the service, its own L2 data, and the business response.
- Under AI-SaaS, SRF §3.2.1 shows the customer's L5 cell as N/A. The Component tab says so for both models, and TM-G17 reports it as info. The customer cannot test or pin the model; its levers are the hard rules, the L1 response and change-notice terms in the contract.
- A reasoning-LLM failure reaches the same 21 components as in the Agent-PaaS version. Only the owners change, so the per-owner view names the vendor's teams.

A failure at the L5 reasoning LLM, in the worst case:

- **P2P**: reaches the gateway, the orchestrator, all 5 sub-agents and the dock edge/OT host, and lands as impact on the L1 steps those agents realize. It does not reach the policy service or the vendor eligibility step, which is scored by a separate component. 21 components are reached.
- **H2R**: the same pattern. It does not reach the policy service or the background-check step. 21 components are reached.
- **R2R**: the same pattern. It does not reach the policy service or the anomaly review step. 20 components are reached.
- **Case to Resolution**: the same pattern. It does not reach the policy service or the identity verification step. 21 components are reached.

In "with controls" mode, each new example lowers two authority-limited agents from failed to impacted (invoice match and payment; offer and offboarding; close adjustments and reporting; resolution and escalation). The L1 steps those agents realize are no longer reached through them. The agents stay in the blast radius. A control does not stop the cascade.

The four new examples also use aggregation (a shared tool that is a part of two agents) and an influence link from an obligation to a control. Those two types were not used in the O2C example. Influence is a motivation link; it does not cascade failures.

## Versioned states

Approved by Bill (decision 6). The design below is mine.

- Each component and link can carry `versions: [{version, from, until, note, set, removed}]`. `set` holds only the fields that change, and the schema limits it to that record's own fields. `removed: true` takes the record out from that version on.
- `valid_from` and `valid_until` bound the record's whole life.
- **By date.** Every version whose `from` is on or before the date, and whose `until` is empty or later, is applied in list order. Changes add up.
- **By snapshot.** A snapshot has its own date and can pin a record to one version. A pin applies the versions up to and including that one; `base` applies none. A pin to a version that does not exist is reported (TM-G23).
- The cascade, the gap checks, the controls view and the data flow view all run on the resolved state. Export always writes the full model with every version.

The example has three snapshots:

- **As built, Nov 16, 2026**: 30 findings (3 high, 16 medium, 1 low, 10 info).
- **Planned December release** (Dec 1): cash matching gets an owner, the model settings get an L1 approver, and the policy service moves to hard rules v2.0. 24 findings (2 high, 11 medium, 1 low, 10 info). TM-G01, TM-G09 and TM-G20 clear.
- **December release without the policy service update**: pins `rel.r2` to `base`, so TM-G20 stays.

## Data flow view

Approved by Bill (decision 4). The design below is mine.

The view shows data in motion across L1 to L5. It is built from flow links and access links:

- Read access moves data from the data component to the reader.
- Write access moves it to the data component.
- `readwrite` moves it both ways.

The tab shows:

- a layer-by-layer matrix of moves
- each move with what it carries, the L1 steps it serves (what the source or target realizes), and whether it crosses the customer-provider boundary
- every path from a data source, up to 8 hops

L1 holds no data components in the example, so L1 shows up through the "Serves L1" column. The example adds flows of prompts and business context from the orchestrator through the gateway to both L5 models. It also adds telemetry and decision logs to the agent runtime. The view then shows that PO email text can reach the L5 model, and that 3 data moves cross to the provider side. A button limits the graph to data links.

## Stakeholders

Approved by Bill (decision 7). Affected individuals and relevant authorities are listed on L1 threat models. They are not personas and never owners. The example lists:

- individuals named in customer records
- consumer debtors, if any debts are consumer debts
- a privacy authority (candidate, unverified)
- a securities regulator (candidate, unverified)
- in the banking overlay: credit applicants, and a bank supervisor or consumer finance regulator (candidate, unverified)

Which authorities actually apply was not checked. TM-G24 flags a threat whose cascade reaches L1 but lists no stakeholders.

## Candidate L4 component types

Approved by Bill as candidates (decision 5). `network`, `facility`, `edge_ot_host` and `location` can be used at L4. The example has two:

- a warehouse network link (site VPN)
- a warehouse edge/OT host that drives label printers and conveyor release

The orchestrator sends pick and ship release to the edge/OT host, and the network serves it. TM-G25 labels each use as a candidate.

## Derived links

Approved by Bill (decision f). The rules below are my design.

A derived link records a dependency someone inferred through a chain, such as "the orchestrator depends on the reasoning LLM" through the LLM gateway (example `rel.d1`, derived from `rel.s2` and `rel.s1`). It is drawn as a thin grey dashed line, and a filter can hide it.

The cascade, the data flow view, inherited controls, the boundary count and the multiplicity counts all skip derived links. The chain they summarize already carries the cascade, and a derived shortcut could skip a control on the chain. `TM.cascade(model, seed, {includeDerived: true})` uses them for a what-if, for example when the chain is not drawn yet. TM-G27 lists each derived link (info). It is medium when `derived_from` names fewer than 2 links or a link that does not exist in the chosen state.

## Default multiplicity rules

Approved by Bill (decision h): the defaults apply automatically, users can override them, and gaps flag violations. The rule list comes from what this document already required. The IDs and severities are my design.

| Rule | Default | Range | Reported as |
|---|---|---|---|
| MD-01 | one realizer per L1 logic | 1..1 realization links into an L1 `business_logic` | TM-G18 medium |
| MD-02 | at most one realizer per L1 step | 0..1 realization links into an L1 `process_step` (none is allowed when people do the step; TM-G19 reminds) | TM-G18 medium |
| MD-03 | one owner per component | exactly 1 owner | TM-G01 (none) or TM-G02 (two or more), high |
| MD-04 | one accountable per threat (ROCA) | exactly 1 | TM-G05 high |
| MD-05 | one whole per composition part | 0..1 composition links into a component; use aggregation for a shared part | TM-G18 low |

A control acts on exactly one component (CH-4). The schema enforces that with a single `component_id`, so it needs no default rule.

Overrides, in order of precedence:

1. A `multiplicity` range stated on a link sets the range for that link type into that target.
2. A component's `multiplicity_overrides` changes a rule for that component.
3. The model's `multiplicity_rules` changes a rule for the whole model, or switches it off.

When an override allows what the default forbids, the finding drops to info and says which override allowed it. TM-G26 lists every override, as info with a reason or low without one. The example overrides MD-02 on the disputes step (placeholder reason). The Gaps tab shows the rules in force.

## Inherited and local controls

- **Local**: controls whose `component_id` is this component.
- **Inherited**:
  - from a component that serves this one with `provides: controls`, followed transitively. Example: guardrails serve the orchestrator.
  - from the assignee of an assignment link. Example: the agent runtime's scoped identities apply to the orchestrator.
  - from parent-child ancestors, for controls marked `applies_to_children`. Example: segregation of duties on the O2C process applies to each step.

The SRF v1.0 legend for "Provider-managed" says the customer inherits controls. Serving with `provides: controls` is how the tool records that.

## Required or Recommended

The tool reuses the "Who does what" definition (WDW-1, WDW-2). A control is Required only if at least one linked obligation passes all of these tests:

- its strength is binding
- it is in force on the as-of date
- it is verified and was checked within the last 180 days
- its link is approved, with basis `official_text`, `recital_text` or `source_crosswalk`

The label becomes "Required if" when every qualifying obligation has an `applies_if` condition. It gets the suffix "(recital-based)" when every qualifying link rests on a recital. Any other support makes the control Recommended, and the tool shows why. A control linked only from a threat is "Risk-driven only." In the example, nothing is Required, because every obligation is unverified and every link is a proposed editorial inference.

## Gap checks

| Rule | Severity | Finds |
|---|---|---|
| TM-G00 | high | Operating model not one of the 4 |
| TM-G01 | high | Component with no owner |
| TM-G02 | high | Component marked shared (two or more owners) |
| TM-G03 | high or low | Owner persona not one of the 8 (high); persona outside the layers the SRF text gives it (low) |
| TM-G04 | medium, low, info | Realization where the logic owner and the execution owner differ. Medium if the link crosses layers and has no L1 approval; info if the approval is on file |
| TM-G05 | high | Threat with no accountable, or a shared one |
| TM-G06 | info | Threat accountable is not the target component's owner. Record why |
| TM-G07 | medium | Threat with no obligation and no `no_obligation` finding (CH-1) |
| TM-G08 | high | Broken reference, or a relationship type outside the 9 on a link not flagged unclassified |
| TM-G09 | medium | Model settings with no L1 change approver |
| TM-G10 | medium | L1 logic with no approved version |
| TM-G11 | high | Parent-child cycle (a part with two wholes is now MD-05, reported as TM-G18) |
| TM-G12 | medium | Threat with no linked control in place |
| TM-G13 | info | Unverified obligations, with a count |
| TM-G14 | info | Parent-child link across layers |
| TM-G15 | info | Placeholder owners, with a count |
| TM-G16 | info | Component with no relationships |
| TM-G17 | medium or info | Provider-side owner on a layer the SRF matrix shows as customer-owned; or a layer shown as N/A |
| TM-G18 | medium or low | Multiplicity out of range: a range stated on a link, or a default rule MD-01, MD-02 or MD-05 |
| TM-G19 | low | L1 step with no realizing component (L1 logic with none is MD-01) |
| TM-G20 | medium | Realization runs a logic version other than the approved one, or records none |
| TM-G21 | medium or info | Cross-layer dependency where the customer-provider boundary is unknown because an end has no single owner (medium); a count of links that cross the boundary (info) |
| TM-G22 | medium or low | Link flagged "unclassified, needs review": medium with no type, low with a tentative type |
| TM-G23 | high | Snapshot pins a version the record does not have |
| TM-G24 | low | Threat whose cascade reaches L1 but lists no stakeholders |
| TM-G25 | info or low | Candidate L4 type in use (info), or used outside L4 (low) |
| TM-G26 | info or low | Default multiplicity rule overridden: info with a reason, low without |
| TM-G27 | info or medium | Derived link listed (info); its chain is missing or broken (medium) |

The example plants gaps on purpose:

- cash matching has no owner
- the fulfillment step is shared
- the cash matching threat has no accountable person
- the model settings have no L1 approver
- the policy service runs hard-rules v1.9, while v2.0 is approved
- one link is unclassified
- one derived link, and one multiplicity override
- the spoofed-PO threat lists no stakeholders

With the banking overlay off, the Nov 16 state gives 30 findings (3 high, 16 medium, 1 low, 10 info), and the December snapshot gives 24 (2 high, 11 medium, 1 low, 10 info). The 2 added info findings are TM-G26 and TM-G27.

## The prototype

`index.html` is one file with inline CSS and JavaScript. It makes no network calls and loads no libraries.

- **Layer order** (Bill's rule, Nov 16, 2026): every view that shows SRF layers lists them in sequence, L1 on top and L5 at the bottom. That covers the graph bands, the cascade's impact-by-layer table, the data flow matrix (rows top to bottom, columns left to right) and the layer list in the Edit form. The tool already followed the rule; a test now checks it.
- **Graph**: an SVG with one band per layer. Each node shows its name and owner. A dashed red border marks an ownership gap. Edge color and dash show the type, and a thin line marks a soft link. A small circle marks a link that crosses the customer-provider boundary. Checkboxes hide link types. The SVG has a viewBox and scales to the width of the graph pane, so Fit does not scroll sideways. Zoom out, Zoom in and Fit change that scale. A layer wraps onto another row when the next box would not fit at full size.
- **Details pane**: closed until a component is chosen or Details is pressed. It then opens beside the diagram. Close, or Esc, hides it and returns focus to the component that was chosen, or to Details if that button opened the pane. A handle between the panes sets the details width. The browser stores that width. On a narrow screen the details open as a sheet from the bottom, and the diagram uses the full width.
- **Ownership overlay**: colors nodes by owner. A red fill marks a component with zero owners, or with two or more.
- **Component tab**: layer, type, owner and persona, the SRF matrix value for that layer under the operating model, the version shown and the version list, and a note on candidate L4 types. Also lists the relationships (with cascade, version, approval and boundary) and the local and inherited controls with their Required or Recommended label.
- **Cascade tab**: impact by layer, impact by owner, the path for each reached component, the components a control lowered, and the stakeholders reached. A drop-down in the header picks worst case or "with controls in place." A green border and a down arrow mark a lowered component.
- **Snapshot selector**: picks a snapshot, or uses the As of date. The cascade and gap views follow it.
- **Data flow tab**: the matrix, the moves and the paths described above.
- **Threats tab**: the threat list and the full ROCA chain for the selected threat, with its stakeholders. A Catalog row shows the matching `/data/threats.json` entry and its outside IDs, or says there is no match and why. Each obligation shows "Unverified, needs counsel". The tab ends with the disclaimer.
- **List view**: a button above the graph swaps the graph for a text list of every component, grouped L1 at the top down to L5, with type, owner and cascade state. Selecting a name selects the component.
- **Link filters and glossary**: each filter shows the plain reading from `REL_INFO.plain`; the ArchiMate term is in the tooltip. One line under the filters says "ROCA = Risk, Obligation, Control, Accountable."
- **Gaps tab**: every finding, sorted by severity, with a link to the component, and the default multiplicity rules in force.
- **Edit tab**: add a component or a relationship (with an "unclassified, needs review" option), delete a component, import JSON, and reset to the example.
- **Export tab**: JSON or YAML of the whole model, with a download link. `system.disclaimer` comes first, and the YAML starts with the same sentence as a comment.
- **Evidence help**: the Component tab lists the evidence to ask for on L2 and L5 components. See "Evidence for L2 and L5 starting points".
- **Deep links**: `#select=cmp.x`, `#threat=thr.x`, `&tab=cascade`, `&mode=controls`, `&overlay=banking`, `&owners=1`, `&snapshot=snap.x`.

Limits: YAML import is not supported (JSON only). Edits are not saved between sessions; export to keep them. The edit forms do not add versions; add them in JSON. Each layer is still a grid of boxes. A large model wraps onto more rows. The stored details width is the only layout value kept between sessions.

## Fit with the site

Bill decided to keep this a separate tool (decision i). The prototype now lives at `tools/threat-model/` so the page can load at `/tools/threat-model/`. It is not listed on `tools/index.html` or in the site navigation. The points below describe possible links only. The Decision Record and the other site tools were not changed.

- **"Who does what" view.** That view is catalog-level: for an operating model and a persona, it shows which catalog controls are Required. This tool is instance-level: one system, its components and its owners. They meet at two points:
  - A control here can carry `catalog_control_id`, so its status could come from the view's data rather than from local obligation links.
  - The Required test here is the same definition (WDW-1, WDW-2, WDW-9).
  - If the tool moves onto the site, it must read layers, personas and operating models from `data/`, not from its own lists (OM-1). The prototype embeds its own copies so it can run alone.
- **Decision Record.** The Decision Record captures one system's owner type for each layer, the gaps, and an approval. This tool could prefill the record:
  - each layer's owners, from the components in that layer
  - the "gaps" text, from the high and medium findings
  - a pointer to the exported threat model version that the approver signed off
  Neither tool was changed.
- **Relationship map** (`/tools/relationship-map/`, on develop only). That map shows how catalog records connect (layers, personas, controls). This tool shows how one system's components connect. They answer different questions, so they stay separate.

## Choices taken from the architecture frameworks review

These came from `drafts/architecture-frameworks-srf.md`, "Relationship vocabulary for the threat modeling tool," Nov 16, 2026. Bill's status is in brackets.

1. 9 ArchiMate relationship types replace the 5 plain names first planned; the plain names are kept as readings [Approved by Bill; cite ArchiMate 4].
2. `cascade`, `multiplicity` and `boundary` on each relationship [Approved by Bill].
3. Separate containment and dependency graphs [the review proposed this; Bill chose to merge them into one graph, decision e]. Dependencies as a graph, not a strict stack [kept].
4. Realization for an L3 component that runs L1 logic, with `logic_version` and `l1_approval` [Approved by Bill as a candidate pattern and a candidate control].
5. The ownership overlay [Approved by Bill].
6. Cascade directions per type follow the review's table [part of the cascade design; the fields are approved].
7. The `derived` flag [Approved by Bill].
8. Data flow view, candidate L4 types, versioned states and stakeholders came from the review's candidate list [Approved by Bill, decisions 4 to 7].

Choices that are mine, not the review's:

- the three states and the "lowered" marker
- roll-up that never comes back down, and the soft parent-child rule
- derived links skipped by the cascade
- the default multiplicity rule IDs, severities and override order
- controls on links that lower failed to impacted (behavior set by Bill, decision d)
- serving with `provides: controls` for inherited controls
- explicit soft "results" flows from sub-agents back to the orchestrator
- how versions add up, and snapshot pins
- tying data moves to L1 through realization

## Open questions for Bill

1. Settled Nov 17, 2026: the AI Model Provider on the provider side is accountable for the reasoning-LLM threat.
2. Still open. Bill's copy of the ArchiMate 4 text restricts use with generative AI tools, so the flags stay until a person checks the 9 definitions or written permission is given.
3. Is delegation enough as a flow that carries authority, or does it need its own scope and expiry?
4. Should model settings be one component, as built, or attributes on the gateway's serving link?
5. Settled Nov 17, 2026: keep Agent-PaaS and add one AI-SaaS example (Case to Resolution).
6. Which banking obligations should be checked first: adverse action notices, sanctions screening, or model risk?
7. Should versions add up by date, as built, or should each version be a full copy of the record?
8. Should a soft parent-child link roll up only failures, as built?
9. Should derived links stay out of the cascade unless a user asks for them, as built?

## Catalog links

A threat carries `catalog_threat_id` only where a real entry in `/data/threats.json` describes the same failure. `external_refs` copies that entry's IDs as published (OWASP AI Exchange, OWASP Top 10 for LLM Applications 2025, MITRE ATLAS, OWASP GenAI Data Security Risks 2026, BIML). No ID was added that the catalog does not already hold. A test checks that each match exists and that the IDs equal the catalog's.

| Example threats | Catalog entry | Why it matches |
|---|---|---|
| `thr.spoofed-po` (O2C), `thr.spoofed-resume` (H2R) | `indirectpromptinjection` | Untrusted email or resume text steers the agent as if it were instructions |
| `thr.discount-persuasion`, `thr.threshold-persuasion`, `thr.offer-persuasion`, `thr.materiality-persuasion`, `thr.refund-persuasion` | `directpromptinjection` | A user argues the agent past a rule. The AI Exchange describes direct prompt injection as social engineering of a generative AI |
| `thr.data-exposure` (O2C, P2P, H2R, both Case examples) | `dsgai11` | Agent context crosses customers, suppliers or applicants |
| `thr.master-data-poison` (all six) | `dsgai05` | A tampered record (bank or payout details, account mappings) passes with no integrity check |
| `thr.llm-reinterprets` (all six) | none (`null`) | The catalog's model-behavior entries assume an attacker. Here the model misreads plain business wording. `catalog_note` says so |

Left unmapped on purpose, because the catalog has no entry for the same failure: the spoofed invoice, journal and case threats (untrusted text treated as a valid claim, which is a validation failure more than an injection), authority creep, logic tampering, silent fallback, guardrail outage, the separate scoring components, and the overlay threats. Authority creep is close to OWASP LLM06 Excessive Agency, but the only catalog entry that cites LLM06 (`dsgai06`) is about data exchange between tools, so it was not used.

## Evidence for L2 and L5 starting points

Bill, Nov 17, 2026: these sources can support an L2 or L5 threat model. The layer, SRF A.7.2 and CoSAI Risk Map columns are inference, not SRF text. Risk Map control IDs are from `risk-map/yaml/controls.yaml` in the CoSAI secure-ai-tooling repository (commit 622605a).

| Evidence source | Layer | SRF evidence it supports | CoSAI Risk Map controls it supports (inference) |
|---|---|---|---|
| Benchmarks and evaluations, including bias evaluations and red-team results | L5 (and L3 safety tests) | A.7.2 L5 "Red Team Reports". A.7.1 Assessment ("Tests, evaluations, audits"). Section 3.1.6 asks the AI Model Provider for model cards that detail benchmarks | `controlAdversarialTrainingAndTesting`, `controlRedTeaming` |
| Model scanners, including Hugging Face Hub scan results (malware, pickle import and secrets scans) | L5 model artifacts; L4 when the scan runs in a model registry | A.7.2 L4 "Model Registry". A.7.1 Assessment | `controlModelAndDataIntegrityManagement`, `controlModelRegistryIntegrity`, `controlSecureByDefaultMLTooling` |
| Unwanted-data checks on datasets (personal data, toxic content, copyrighted material, child sexual abuse material) | L2 | A.7.2 L2 "DPIAs" and "Dataset Cards" | `controlTrainingDataSanitization`, `controlTrainingDataManagement`, `controlModelPrivacyEnhancingTechnologies` |
| Vendor data-scrubbing reports | L2 for the customer's own data; L5 for the provider's training data | A.7.2 L2 "Data Lineage". A.7.2 L5 and A.7.4 "Training Data Docs" | `controlTrainingDataSanitization`, `controlTrainingDataManagement` |
| Model cards | L5 | A.7.2 L5 and A.7.4 "Model Cards" | `controlModelAndDataInventoryManagement`, `controlModelRegistryIntegrity` |
| Dataset cards | L2 | A.7.2 L2 "Dataset Cards" | `controlModelAndDataInventoryManagement`, `controlTrainingDataManagement` |

Hugging Face features, checked against the Hugging Face Hub documentation on Nov 17, 2026 (PT):

- **Malware scanning** (`huggingface.co/docs/hub/security-malware`): every repository file under 2 GB is scanned at each commit.
- **Pickle scanning** (`huggingface.co/docs/hub/security-pickle`): the Hub's scanner runs ClamAV and a pickle import scan, which lists the imports in each pickled file and flags suspicious ones. The page says the scan is not foolproof.
- **Secrets scanning** (`huggingface.co/docs/hub/security-secrets`): TruffleHog runs on each push and emails the owner about verified secrets.
- **Third-party scanners**: Protect AI's Guardian (`security-protectai`) and JFrog (`security-jfrog`) scan files and show results on the Hub.
- **Model cards and dataset cards** (`model-cards`, `datasets-cards`): the README.md file in each model or dataset repository.

How to use these at each start:

- **L2 start**: for each data set, ask for its dataset card, its unwanted-data check results and, when a vendor cleaned it, the vendor's scrubbing report. A missing item is a candidate gap on that component.
- **L5 start**: for each model, ask for its model card, its benchmark, evaluation and red-team results, and its scanner results. A scan result covers one file at one commit. Record the version it covers, and recheck when the version changes.

## SRF text versus inference

Taken from SRF v1.0 text (`01-srf-core/framework/CoSAI Shared Responsibility Framework v1.0.md`):

- the 5 layer names and IDs (section 3.2.1 matrix, A.7.2)
- the 8 personas, their names and the layers each covers (section 3.1)
- the 4 operating models and the customer row of the operating model matrix (section 3.2.1)
- "exactly one accountable party per component" (section 3)
- "Security & Governance requirements cascade from the Business layer to the supporting layers" (section 3)
- "the customer inherits controls" for Provider-managed (section 3.2.1 legend)
- operating models may need to be defined per component (section 3)

Taken from Bill's rules and site data, not from SRF v1.0 text:

- "AI Model Provider" as the L5 persona label with ID `model-provider` (PER-2). The v1.0 heading in section 3.1.6 reads "Model Provider."
- "Agentic Platform and Framework Providers" follows the v1.0 heading. Site `personas.json` (v0.7) writes "&".
- The 15 `srf_component` names come from site `layers.json` (v0.7) and the SRF figure, as recorded in `drafts/components-proposed.csv`. I did not check them against the figure image.
- The Required test is WDW-1, WDW-2 and WDW-9 from `RULES.md`.
- Model-behavior threats belong to the AI Model Provider on the provider side. This follows `/data/threats.json` (for example `evasion`) and Bill's Nov 17 answer to Q1. SRF v1.0 section 3.1.6 gives the AI Model Provider "Model security, safety, and performance validation."
- The SRF v1.0 evidence lists used in "Evidence for L2 and L5 starting points": A.7.1 categories, A.7.2 evidence by layer, and A.7.4 vendor evidence.

Inference (mine, or from the architecture frameworks review), except where Bill approved the item above:

- the component and relationship model, the 9 relationship types and their cascade rules
- the cascade states and algorithm
- the gap rules TM-G00 to TM-G27, and the default multiplicity rule IDs MD-01 to MD-05
- the logic/execution boundary rule
- treating model settings as L1-relevant
- the example systems, their components, threats and controls
- the mapping of each example owner to a persona
- the controls on links
- the versioned-state design, the data flow view design, and the stakeholder fields
- the example stakeholders and the candidate L4 examples
- each `catalog_threat_id` match (see "Catalog links")
- which layer, A.7.2 item and CoSAI Risk Map control each evidence source supports

## Unverified

- Every obligation in the examples: Sarbanes-Oxley internal control, ASC 606, debt collection law, CCPA or GDPR, customer contracts, the internal process policies, the banking overlay (ECOA and Regulation B adverse action notices, US sanctions rules, SR 11-7 model risk guidance), the public sector procurement overlay (competition, debarment and domestic preference rules), the employment law overlay (equal employment opportunity law, FCRA as applied to employment screening, wage and hour rules), the SOX-style reporting overlay (disclosure controls, officer certification and Exchange Act reporting), and the consumer protection overlay (unfair-or-deceptive-practices law, complaint-handling rules and required disclosures). None was checked against an official source. Citations are left empty. Applicability needs counsel.
- The ArchiMate 4 definitions of all 9 relationship types. Two secondary sources list all 9 in ArchiMate 4; the official v4 text was not read.
- Which relevant authorities apply to the example. Each is a candidate.
- Every example owner is a placeholder.
- Each catalog match is an editorial reading of the example threat against the catalog entry. Nobody outside this project has reviewed it.

## How to run the tests

```
cd tools/threat-model
npm install jsdom            # once, in any folder; then point NODE_PATH at its node_modules
NODE_PATH=/path/to/node_modules node tests/test_cascade.js
python3 tests/test_schema_export.py   # needs PyYAML and jsonschema
```

`test_cascade.js` (73 tests) writes `tests/out-export.json` and `tests/out-export.yaml`. Then `test_schema_export.py` (55 checks) checks that both validate and match, and that every example validates.
