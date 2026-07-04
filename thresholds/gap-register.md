# OSCAL Parameter Gap Register: AI SRF Threshold Controls vs NIST SP 800-53 rev 5

Generated 2026-07-04 by `generate-gap-register.py` against Electronic (OSCAL) Version of NIST SP 800-53 Rev 5.2.0 Controls and SP 800-53A Rev 5.2.0 Assessment Procedures, catalog version 5.2.0 (OSCAL 1.2.2).

## Purpose

Each AI SRF threshold control declares candidate anchor controls in the 800-53 rev 5 catalog (`evidence.oscal_bindings`). This register asks one question per binding: could the catalog control's organization-defined parameters (ODPs) carry the threshold's measured objective, meaning a numeric target with comparison operator, an evaluation window, and an error budget with burn-rate alerting? Where the answer is no, the gap is classified. The register is intended as implementation-grounded feedback for the NIST SP 800-53 Control Overlays for Securing AI Systems effort and, for the structural findings, the OSCAL models themselves.

## Gap classes

| Class | Meaning |
| --- | --- |
| `cadence_only` | ODPs exist; can carry test/review cadence only |
| `untyped_odp` | ODPs exist but are untyped; cannot carry a measured objective |
| `no_odp` | control has no ODPs at all |
| `withdrawn` | control withdrawn in rev 5 |
| `control_not_found` | no such control in the catalog |

## Findings by threshold control

### AISRF-BIZ-001: AI system inventory coverage

Layer `ai_business_usage`, defined in `baseline-catalog.yaml`. Objective: indicator >= 100 over 30d, error budget 0.05, burn-rate alert at 2x.

| 800-53 binding | Catalog control | ODPs | Gap class |
| --- | --- | --- | --- |
| `cm-8` | System Component Inventory | `cm-08_odp.01`, `cm-08_odp.02` (cadence) | `cadence_only` |
| `pm-5` | System Inventory | `pm-05_odp` (cadence) | `cadence_only` |

Best case across bindings: `cadence_only`. Objective can bind to an ODP: **no**.

### AISRF-INFO-001: Shadow AI detection and triage

Layer `ai_information`, defined in `baseline-catalog.yaml`. Objective: indicator >= 95 over 30d, error budget 0.05, burn-rate alert at 6x.

| 800-53 binding | Catalog control | ODPs | Gap class |
| --- | --- | --- | --- |
| `cm-8.3` | Automated Unauthorized Component Detection | `cm-8.3_prm_1`, `cm-08.03_odp.01`, `cm-08.03_odp.02`, `cm-08.03_odp.03`, `cm-08.03_odp.04` (cadence), `cm-08.03_odp.05`, `cm-08.03_odp.06` | `cadence_only` |
| `si-4` | System Monitoring | `si-04_odp.01`, `si-04_odp.02`, `si-04_odp.03`, `si-04_odp.04`, `si-04_odp.05`, `si-04_odp.06` (cadence) | `cadence_only` |

Best case across bindings: `cadence_only`. Objective can bind to an ODP: **no**.

### AISRF-APP-001: Human override responsiveness

Layer `ai_application`, defined in `baseline-catalog.yaml`. Objective: indicator >= 100 over 90d, error budget 0.

| 800-53 binding | Catalog control | ODPs | Gap class |
| --- | --- | --- | --- |
| `si-17` | Fail-safe Procedures | `si-17_prm_1`, `si-17_odp.01`, `si-17_odp.02` | `untyped_odp` |
| `ir-4` | Incident Handling | none | `no_odp` |

Best case across bindings: `untyped_odp`. Objective can bind to an ODP: **no**.

### AISRF-PLAT-001: Guardrail enforcement coverage at inference

Layer `ai_platform`, defined in `baseline-catalog.yaml`. Objective: indicator >= 99.9 over 30d, error budget 0.001, burn-rate alert at 14.4x.

| 800-53 binding | Catalog control | ODPs | Gap class |
| --- | --- | --- | --- |
| `si-10` | Information Input Validation | `si-10_odp` | `untyped_odp` |
| `si-15` | Information Output Filtering | `si-15_odp` | `untyped_odp` |

Best case across bindings: `untyped_odp`. Objective can bind to an ODP: **no**.

### AISRF-MODEL-001: Model provenance attestation currency

Layer `ai_model_provider`, defined in `baseline-catalog.yaml`. Objective: indicator >= 100 over 30d, error budget 0.

| 800-53 binding | Catalog control | ODPs | Gap class |
| --- | --- | --- | --- |
| `sr-4` | Provenance | `sr-04_odp` | `untyped_odp` |
| `cm-14` | Signed Components | `cm-14_prm_1`, `cm-14_odp.01`, `cm-14_odp.02` | `untyped_odp` |

Best case across bindings: `untyped_odp`. Objective can bind to an ODP: **no**.

### AISRF-MODEL-002: Post-deployment model drift monitoring

Layer `ai_model_provider`, defined in `healthcare.profile.yaml`. Objective: indicator >= 100 over 7d, error budget 0.

| 800-53 binding | Catalog control | ODPs | Gap class |
| --- | --- | --- | --- |
| `ca-7` | Continuous Monitoring | `ca-7_prm_4`, `ca-7_prm_5` (cadence), `ca-07_odp.01`, `ca-07_odp.02` (cadence), `ca-07_odp.03` (cadence), `ca-07_odp.04`, `ca-07_odp.05` (cadence), `ca-07_odp.06`, `ca-07_odp.07` (cadence) | `cadence_only` |
| `si-4` | System Monitoring | `si-04_odp.01`, `si-04_odp.02`, `si-04_odp.03`, `si-04_odp.04`, `si-04_odp.05`, `si-04_odp.06` (cadence) | `cadence_only` |

Best case across bindings: `cadence_only`. Objective can bind to an ODP: **no**.

## Summary finding

Of 6 threshold controls, 6 resolve to live anchor controls in rev 5; the catalog's breadth is not the problem. The gap is uniformly one of parameter typing: no rev 5 ODP can express a measured objective. The best any binding achieves is `cadence_only`, where a frequency ODP can carry how often something is reviewed or tested but not what value it must hold, over what window, with what tolerated shortfall.

## Proposed feedback

1. **For the AI overlay (SP 800-53 Control Overlays for Securing AI Systems):** where an overlay control governs continuously measurable AI behavior (inventory coverage, guardrail coverage at inference, override responsiveness, attestation currency, drift within declared bounds), define ODPs structured as measured objectives rather than freeform strings: target value, comparison, evaluation window, and tolerated shortfall. The `objective` object of the AI SRF threshold schema is a candidate shape.
2. **For OSCAL:** parameters currently admit labels, guidelines, and fixed selections. A typed parameter constraint (numeric with unit and window semantics) would let profiles carry operational thresholds natively, and would let a resolved threshold emit `set-parameter` values that provably match the live alerting configuration.
3. **For the AI RMF Critical Infrastructure profile:** each prioritized outcome could name the measurable indicator that would make it auditable. The healthcare drift control (AISRF-MODEL-002) is a worked example of a profile-driven addition with a concrete SLI bound to `ca-7`, whose `ca-07_odp.01` (system-level metrics) is exactly the right hook but is untyped today.

---

*Regenerate with `python3 generate-gap-register.py`. Machine-readable form: `gap-register.json`.*
