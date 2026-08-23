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

## Coverage (Q2)

- PHANTOM-B fraction: gold LLM components whose predicted threats include all
  eight letters P, H, A, N, T, O, M, B. Letters may be spread across several
  threats for that referent.
- An empty `llm_subset` requires `llm_subset_empty: true`,
  `phantom_coverage.status: not_applicable`, and
  `qa.phantom_b_complete: null`. An empty subset never counts as complete.
- STRIDE fraction: gold processes that have at least one predicted STRIDE
  letter on a threat pointing at them. Full six-letter consideration is a
  schema and harness check when `stride_considerations` is present.
- `stride_coverage.complete` must be true, `remaining_elements` must be empty,
  and every `expected_elements` id must have all six consideration rows.
- Crossing fraction: gold flows with `crosses_boundary` set that are named as
  a `diagram_referent` or whose endpoints are.

## Report completeness (Track A, after P-report)

These fields are required by prompt pack v2:

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
- optional `review_order` contains each threat id once; it does not change ids
  or claim likelihood, impact, or residual risk
- `report.markdown` is present; `report.reviewer` is null until a human signs
- `P-report` is the only step that authors `report.markdown`
- `P-export-md` emits that stored string, `P-export-json` serializes the final
  matrix, and `P-export-csv` writes one row per threat with a stable header
- Track A leaves the SRF CSV cells empty; Track B fills the same columns
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
- `chain_meta.prompt_pack_version` is `2.0`
- STRIDE / PHANTOM-B / CIA letters in the published alphabets
- `srf.party` must not be `shared`
- `ai_exchange_slug` must be one of the sixteen ids in `data/threats.json`

## Hamming loss (optional)

When `labels/expert-corrections.json` lists gold STRIDE and CIA letter sets per
threat id, Hamming loss is the fraction of alphabet letters that disagree.
Auspex Table 2 method. Do not compute this against the model's own labels.

## SRF track (optional)

If `threats[].srf` is present:

- `persona` in `data/personas.json` (core or declared specialization)
- `layer` in L1-L5
- `party` is customer or provider
- If `copied_from_threats_json` is true, persona must match
  `threats.json` accountability for the named operating model

## SME (required for closure)

See `sme/` and Auspex Section 3. Closure means:

- Two reviewers per system
- Overall Likert on clarity and copilot value
- Per-threat realism Likert and false-positive bit, with the Auspex cross-tab
- Expert-corrected labels and Hamming loss
- Shostack Q4: would you threat model this way again?

Until those exist, `closure` stays false in every machine report.
