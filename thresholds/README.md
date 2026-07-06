# AI SRF Threshold Schema

A DevOps-style schema (SLI, SLO, error budget, enforcement) for governing operational controls across the AI and agentic stack, organized by the five layers of the CoSAI AI Shared Responsibility Framework, with thresholds parameterized by industry-vertical regulation.

## What this is

The CoSAI AI SRF answers who is accountable for each component of an AI system. This schema answers a follow-on question: what measurable threshold must that accountable party keep the component within, and what happens automatically when it drifts out?

Each control binds together five things: an SRF layer and component, exactly one accountable persona, a Service Level Indicator (the measured quantity), a Service Level Objective with an error budget, and enforcement actions for breach and for budget exhaustion.

## Source of truth

All taxonomy values are verified against the CoSAI AI Shared Responsibility Framework v1.0, approved by the CoSAI Project Governing Board on 26 May 2026 (document at the project root).

| Schema element | SRF v1.0 source |
| --- | --- |
| Five layers (`srf_layer`) | Section 3, Appendix A.7.2 (L1 Business & Usage through L5 Model Provider) |
| Personas (`owner.persona`) | Section 3.1, the eight CoSAI-RM personas |
| Autonomy levels (`autonomy_scope`) | Appendix A.1.3.3, L0-L5 adapted from SAE J3016 |
| Intervention tiers (`enforcement.*.intervention_tier`) | Appendix A.1.3.2, T1-T5 human intervention table |
| Evidence categories (`evidence.categories`) | Appendix A.7.1 |
| Component names | Responsibility matrices in A.1.2 through A.1.5 |
| Drill cadences in AISRF-APP-001 | Appendix A.7.3, agentic-specific evidence |

An earlier draft invented its own autonomy labels (informational, suggestive, delegated_bounded, and so on). Those are gone; the framework has a canonical L0-L5 taxonomy and this schema uses it.

## Design decisions

**Catalog and profile, mirroring OSCAL.** One vertical-agnostic baseline catalog holds the controls. Thin per-vertical profiles override only `target_value`, `error_budget`, `enforcement`, and `regulatory_drivers`, or add wholly new controls that have no general equivalent (healthcare's drift monitoring control, driven by FDA's Predetermined Change Control Plan, is the canonical example). This keeps regulatory deltas reviewable: a compliance reader can see exactly what a vertical tightens without rereading the whole catalog.

**Complementary to OSCAL, not a replacement.** OSCAL owns what controls exist, assessment results, and the audit trail. This schema owns the live operational threshold, the error budget, and the automatic enforcement action. The seam is `evidence.oscal_component_uuid` and `evidence.oscal_bindings` on each control (each binding pairs a catalog source URI with a control ID, since a bare ID is ambiguous), plus a reserved `generate_oscal_assessment_result` flag on enforcement actions. No generator exists yet that produces an OSCAL assessment result from a breach event.

**Real SRE semantics, not just SRE vocabulary.** Error budgets carry a `burn_rate_alert_threshold` so the schema can drive multiwindow burn-rate alerting (Prometheus-style), and breach actions are separate from budget-exhaustion actions. The intent is that these definitions can compile to actual alerting rules, not only compliance paperwork.

**Enforcement is organizational policy, not SRF mandate.** SRF v1.0 A.6.2 is explicit that the framework assigns accountability and evidence while consequence and remedy belong to regulation, contract, and governance policy. The `enforcement` block encodes the deploying organization's own operational policy, with actions mapped to the framework's T1-T5 intervention tiers so escalation authority is unambiguous.

## Files

| File | Purpose |
| --- | --- |
| `ai-srf-threshold-control.schema.json` | JSON Schema (draft-07) for a single control object |
| `examples/baseline-catalog.yaml` | Five controls, one per SRF layer, vertical-agnostic |
| `examples/financial-services.profile.yaml` | Overrides four controls; cites SR 11-7, GLBA Safeguards Rule, EU AI Act Annex III(5)(b) and Article 14 |
| `examples/healthcare.profile.yaml` | Overrides three controls, adds drift monitoring; cites FDA AI/ML SaMD guidance (PCCP), HIPAA Security Rule |
| `generate-gap-register.py` | Resolves every `oscal_bindings` entry against the NIST 800-53 rev 5 OSCAL catalog and classifies parameter gaps |
| `gap-register.md`, `gap-register.json` | Generated gap register; drafted as feedback for the NIST 800-53 AI overlay effort |

## Gap register

Every threshold control anchors to live 800-53 rev 5 controls (verified against catalog version 5.2.0), so catalog breadth is not the gap. The gap is parameter typing: no rev 5 ODP can carry a measured objective (target value, comparison, window, error budget). The best any binding achieves is a frequency ODP that can hold a review or test cadence. `gap-register.md` documents this per control and proposes typed measured-objective ODPs for the AI overlay. Regenerate with `python3 generate-gap-register.py` (downloads and caches the catalog, or pass `--catalog` a local copy).

The register also covers the six industry vertical control sets in `data/*-controls.json` (258 measured thresholds), one section per vertical. Vertical controls that declare `threshold.evidence.oscal_bindings` resolve like baseline controls; the rest are classified `no_binding` and flagged as backlog for the COSAiS overlays (NISTIR 8605B Generative AI, 8605D Agentic AI) as those publish.

## Relationship to the generated OSCAL vertical profiles

The vertical thresholds are also published as OSCAL 1.2.2 documents: `export/srf-oscal-verticals-catalog.json` (all 258 controls, thresholds as OSCAL parameters) and `export/srf-{vertical}.profile.json` per vertical, generated by `build/generate_oscal_verticals.py` from `data/*-controls.json`. Those documents carry the same objective tuples (metric, operator, param, window, breach action) that this directory's YAML catalog and profiles express with error budgets and burn-rate alerting. The YAML track remains canonical for SRE semantics (error budgets, enforcement tiers); the OSCAL track is canonical for interchange. Converging the two on the `thresholds/` schema, so a threshold changes in one place, is the open convergence pass from the OSCAL vertical mapping plan.

## Validation status

Baseline catalog controls validate against the schema (jsonschema Draft7Validator). Profile files are partial-override documents and intentionally do not validate as full control objects; the `additions` section of a profile does. Making overrides machine-checkable needs either a merge step that resolves a profile onto the baseline before validating, or a separate permissive schema for profile documents. Neither exists yet.

## Open items

Profile merge semantics are described here in prose but not implemented; a small resolver script using the `imports`, `overrides`, and `additions` fields is the natural next step. The OSCAL breach-to-assessment-result generator and alerting-rule generation from `indicator` and `objective` are discussed above but not built. The catalog is deliberately thin at five controls, one per layer, as a proof of concept; scaling it out is the largest remaining task and the one requiring the most per-layer domain judgment. Multi-vertical stacking (a healthcare fintech applying both profiles) has no defined override precedence.
