# Scoring rubric

Automated checks first. Human instruments second. Do not average them into one
score.

## Inventory fidelity (Q1)

Compare predicted `inventory` to gold `inventory.json`.

Match tokens by normalized id: lowercase, hyphens and underscores treated as
the same. Also match on normalized `name`.

Report precision, recall, and F1 for:

- components
- external_actors
- data_stores
- data_flows
- trust_boundaries
- llm_components

Macro F1 is the unweighted mean of those six F1 values.

A missing trust boundary in gold (`missing_trust_boundaries: true`) is a gold
fact. Predicting invented boundaries is a false positive.

## Format invariance

For the same `system_id`, take the three format predictions. Jaccard of
inventory id sets, then Jaccard of threat `diagram_referent` sets. Mean over
the three pairs (image-mermaid, image-svg, mermaid-svg).

## Method and phase coverage (Q2)

- PHANTOM-B fraction: gold LLM components whose predicted threats include all
  eight letters P, H, A, N, T, O, M, B. Letters may be spread across several
  threats for that referent.
- An empty `llm_subset` requires `llm_subset_empty: true` and
  `qa.phantom_b_complete: null`. Default first-message `if_no_ai_nodes` is
  `continue_without_llm`, which sets `phantom_coverage.status: not_applicable`.
  An empty subset never counts as complete.
- Traditional applicability: every run records `traditional_coverage.status`
  as `complete`, `incomplete`, or `not_applicable`. Only a confirmed
  `artifact-only` review may use `not_applicable`. Missing runtime or
  integration evidence is `incomplete`.
- Typed STRIDE: processes receive S, T, R, I, D, E; actors receive S and R;
  stores receive T, R, I, D; flows receive T, I, D. The evaluator compares
  the declared `expected_considerations` pairs with the consideration rows.
  Duplicate, missing, and extra pairs fail.
- Abuse-case coverage records each evidenced high-value transaction,
  authorization decision, and delegated action. A conditional exclusion names
  the referent and reason.
- Operational coverage records NIST adversarial, accidental, structural, and
  environmental source classes when availability, physical safety, OT, or
  continuity is in scope.
- Crossing fraction: gold flows with `crosses_boundary` set that are named as
  a `diagram_referent` or whose endpoints are.
- Composition coverage declares paths for AI-to-traditional flows, retrieval,
  identity delegation, tool actuation, output consumption, feedback loops,
  and shared stores. `considered_paths` and `remaining_paths` must partition
  the expected path ids.

## Report completeness (Track A, after P-report)

These fields are required by prompt pack v3:

- `review_context` with profile, claim evidence, critical assets, prohibited
  outcomes, continuity or safety constraints, and supplied context that is
  either attributed or null
- `representation.version` or `source_id` set, or explicitly `unknown`
- `adversary.assumptions` non-empty; `adversary.positions` covers drawn zones
- `existing_controls` present; empty only with `none_drawn`
- each existing control names `coverage_referents` and `coverage_basis`
- `control_absences` names the inventory referent where an expected control is
  not shown; the observation must not claim that the deployed control is absent
- `claim_boundary.does_not_claim` and `claim_boundary.box` non-empty
- every threat has `attacker_position` matching a positions id
- mitigate and eliminate have an inventory `control_point` and
  `action.validation` (`test`, `log`, or `fail_condition`)
- each `evidence_refs` value resolves to a `control_absences` id
- each replica inheritance maps representative and replica inventory ids and
  names one configuration-divergence threat
- each threat has `importance.factors`, `importance.needs_input`, and a unique
  review position; factors name their evidence and source
- `review_order` contains each threat id once; it does not change ids or claim
  likelihood, impact, severity, or residual risk
- `source_manifest` records source id, kind, URL, license, integration mode,
  catalog version, retrieval date, and content hash
- each external reference names its mapping relation, affected referents,
  evidence, confidence, and status
- CVE and NVD references may claim `affected` only with known supplier,
  product, version, component referent, and applicability evidence
- `report.markdown` projects every `threats[].id`, every
  `adversary.positions[].id`, and every `existing_controls[].id`; threats are
  grouped by `diagram_referent` in tables that keep the same columns on later
  rows
- `report.reviewer` is null until a human signs
- `P-report` is the only step that authors `report.markdown`
- `P-export-md` emits that stored string, `P-export-json` serializes the final
  matrix, and `P-export-csv` writes one row per threat with a stable header
- Track A leaves SRF and vertical CSV cells empty; Track B and Track C fill the
  same stable columns
- `P-export-diagram` writes a Mermaid threat-model diagram of the inventory
  with threat ids on their referents

## Schema

`eval/threat-model/schema.json`. Extra failures the harness flags even if JSON
Schema is skipped:

- `diagram_referent` must resolve to an inventory id
- `action.type` in mitigate, eliminate, transfer, accept
- mitigate and eliminate `control_point` resolves to a component, store, flow,
  or trust-boundary id
- `llm_subset_empty`, PHANTOM-B applicability, and QA agree
- STRIDE coverage has no silent remainder
- existing-control coverage and control-absence evidence resolve to inventory ids
- replica inheritance ids and divergence threat resolve
- `review_order`, when present, contains every threat id once
- `chain_meta.prompt_pack_version` is `3.0`
- review profile and traditional applicability agree
- typed STRIDE rows equal the declared element-letter pairs
- traditional, abuse, operational, AI, and composition QA flags agree with
  their coverage states
- composition considerations bind to declared paths and inventory referents
- source ids resolve to the run manifest; catalog versions match
- affected CVE or NVD mappings include product and version evidence
- when `qa.report_present` is true, `report.markdown` contains every threat,
  attacker-position, and existing-control id
- importance positions are unique and every factor has evidence
- STRIDE / PHANTOM-B / CIA letters in the published alphabets
- `srf.party` must not be `shared`
- `ai_exchange_slug` must be an id in `data/threats.json` whose `ai_exchange` field is a URL. DSGAI-keyed ids (`dsgaiNN`) are not AI Exchange slugs.

## Hamming loss (optional)

When `labels/expert-corrections.json` lists gold STRIDE and CIA letter sets per
threat id, Hamming loss is the fraction of alphabet letters that disagree.
Auspex Table 2 method. Do not compute this against the model's own labels.

## SRF and vertical tracks (optional)

If `threats[].srf` is present:

- `persona` in `data/personas.json` (core or declared specialization)
- `layer` in L1-L5
- `party` is customer or provider
- If `copied_from_threats_json` is true, persona must match
  `threats.json` accountability for the named operating model
- `layer_coverage` states expected, considered, and remaining L1 to L5 layers
- Track C requires completed Track B, non-empty `vertical_ids`, and injected
  source rows
- each vertical obligation and candidate control retains its source id and
  applicability evidence
- acceptance authority remains null when the supplied source does not name it

## Workflow fixtures

Gold fixture metadata checks these bounded contracts:

- a traditional-only service marks AI and composition not applicable
- a full or bounded AI system cannot skip traditional analysis
- an artifact-only review states the claim boundary that permits exclusion
- a mixed system requires composition coverage
- an unknown component version forbids an affected CVE claim

## SME (required for closure)

See `sme/` and Auspex Section 3. Closure means:

- Two reviewers per system
- Overall Likert on clarity and copilot value
- Per-threat realism Likert and false-positive bit, with the Auspex cross-tab
- Expert-corrected labels and Hamming loss
- Shostack Q4: would you threat model this way again?

Until those exist, `closure` stays false in every machine report.
