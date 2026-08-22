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
- STRIDE fraction: gold processes that have at least one predicted STRIDE
  letter on a threat pointing at them. Full six-letter consideration is a
  stricter SME check; the harness cannot see `not_applicable` rows once they
  were dropped by P-dedup.
- Crossing fraction: gold flows with `crosses_boundary` set that are named as
  a `diagram_referent` or whose endpoints are.

## Report completeness (Track A, after P-report)

These fields are required by the prompts. The harness does not fail a run
that omits them, because gold-echo fixtures have no elicited threats.

- `representation.version` or `source_id` set, or explicitly `unknown`
- `adversary.assumptions` non-empty; `adversary.positions` covers drawn zones
- `existing_controls` present; empty only with `none_drawn`
- `claim_boundary.does_not_claim` and `claim_boundary.box` non-empty
- every threat has `attacker_position` matching a positions id
- mitigate and eliminate have `action.validation` (`test`, `log`, or `fail_condition`)
- `report.markdown` is present; `report.reviewer` is null until a human signs
- after either track, `P-export-md` writes the markdown report,
  `P-export-json` writes the completed JSON file, and `P-export-csv` writes
  one row per threat
- `P-export-diagram` writes a Mermaid threat-model diagram of the inventory
  with threat ids on their referents

## Schema

`eval/threat-model/schema.json`. Extra failures the harness flags even if JSON
Schema is skipped:

- `diagram_referent` must resolve to an inventory id
- `action.type` in mitigate, eliminate, transfer, accept
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
