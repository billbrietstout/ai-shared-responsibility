# OSCAL Parameter Gap Register: AI SRF Threshold Controls vs NIST SP 800-53 rev 5

Generated 2026-11-21 by `generate-gap-register.py` against Electronic (OSCAL) Version of NIST SP 800-53 Rev 5.2.0 Controls and SP 800-53A Rev 5.2.0 Assessment Procedures, catalog version 5.2.0 (OSCAL 1.2.3).

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

## Findings by industry vertical

The six industry vertical control sets (`data/*-controls.json`, also published as OSCAL profiles under `/export/`) each declare a measured threshold per control (260 sector controls). The all-sectors common set (`data/common-controls.json`, 41 common controls) is included here too. This section records, per source file, how many of those thresholds have a proposed 800-53 binding and classifies the bindings that exist. Controls without bindings are the backlog for the COSAiS overlay effort: generative and agentic thresholds should bind to NISTIR 8605B (Generative AI) and 8605D (Agentic AI) as those overlays publish, since both are 800-53 overlays that carry organization-defined parameters; predictive-AI thresholds map to 8605A. Until then they are classified `no_binding` here rather than bound to invented anchors.

### All sectors (common) (common-controls.json)

41 controls; 0 with 800-53 bindings, 41 classified `no_binding`.

Unbound thresholds by layer: L1: 10; L2: 8; L3: 8; L4: 9; L5: 6.

### Finance (finance-controls.json)

41 controls; 0 with 800-53 bindings, 41 classified `no_binding`. OSCAL profile: https://aisharedresponsibility.com/export/srf-finance.profile.json

Unbound thresholds by layer: L1: 10; L2: 8; L3: 8; L4: 8; L5: 7.

### Public Sector (public-sector-controls.json)

40 controls; 0 with 800-53 bindings, 40 classified `no_binding`. OSCAL profile: https://aisharedresponsibility.com/export/srf-public-sector.profile.json

Unbound thresholds by layer: L1: 10; L2: 8; L3: 8; L4: 8; L5: 6.

### Healthcare (healthcare-controls.json)

41 controls; 0 with 800-53 bindings, 41 classified `no_binding`. OSCAL profile: https://aisharedresponsibility.com/export/srf-healthcare.profile.json

Unbound thresholds by layer: L1: 10; L2: 8; L3: 8; L4: 8; L5: 7.

### Insurance (insurance-controls.json)

40 controls; 0 with 800-53 bindings, 40 classified `no_binding`. OSCAL profile: https://aisharedresponsibility.com/export/srf-insurance.profile.json

Unbound thresholds by layer: L1: 9; L2: 8; L3: 8; L4: 8; L5: 7.

### Defense (defense-controls.json)

53 controls; 0 with 800-53 bindings, 53 classified `no_binding`. OSCAL profile: https://aisharedresponsibility.com/export/srf-defense.profile.json

Unbound thresholds by layer: L1: 11; L2: 10; L3: 11; L4: 12; L5: 9.

### Manufacturing (manufacturing-controls.json)

45 controls; 0 with 800-53 bindings, 45 classified `no_binding`. OSCAL profile: https://aisharedresponsibility.com/export/srf-manufacturing.profile.json

Unbound thresholds by layer: L1: 10; L2: 8; L3: 10; L4: 9; L5: 8.

## Risks with no linked control in an operating model

A risk cell sets `no_linked_control_in_model` when none of its related controls names an accountable persona in that operating model. The cell still names one persona. The gap is the missing control.

| Risk | Name | Layer | Operating model | Accountable persona |
| --- | --- | --- | --- | --- |
| `devmodelleak` | Direct development-time model leak | L5 | AI-SaaS | `model-provider` |
| `missingoversight` | Missing human oversight | L1 | AI-SaaS | `ai-system-governance` |
| `missingoversight` | Missing human oversight | L1 | AI-PaaS | `ai-system-governance` |
| `missingoversight` | Missing human oversight | L1 | IaaS | `ai-system-governance` |
| `misleadingclaims` | Misleading AI claims to customers | L1 | AI-SaaS | `ai-system-governance` |
| `misleadingclaims` | Misleading AI claims to customers | L1 | AI-PaaS | `ai-system-governance` |
| `misleadingclaims` | Misleading AI claims to customers | L1 | Agent-PaaS | `ai-system-governance` |
| `misleadingclaims` | Misleading AI claims to customers | L1 | IaaS | `ai-system-governance` |
| `highriskuse` | Prohibited or unclassified high-risk use | L1 | IaaS | `ai-system-governance` |
| `uncontestable` | Decisions people cannot contest or get explained | L1 | IaaS | `ai-system-governance` |
| `incompletetechdoc` | Incomplete technical documentation for AI information | L2 | Agent-PaaS | `data-provider` |
| `incompletetechdoc` | Incomplete technical documentation for AI information | L2 | IaaS | `data-provider` |
| `unmappedaidata` | AI data benefits, costs, and dependencies not mapped | L2 | Agent-PaaS | `data-provider` |
| `privacylessacquisition` | Federal AI acquisition without privacy safeguards | L2 | IaaS | `ai-system-governance` |
| `missingato` | AI information service used without authorization to operate | L2 | Agent-PaaS | `ai-system-governance` |
| `missingato` | AI information service used without authorization to operate | L2 | IaaS | `ai-system-governance` |
| `untrustworthyclinicalsources` | Clinical decision support built on untrustworthy source configuration | L2 | AI-PaaS | `data-provider` |
| `unlawfultrainingdata` | Training data without lawful basis or provider security assessment | L2 | AI-SaaS | `ai-system-governance` |
| `unlawfultrainingdata` | Training data without lawful basis or provider security assessment | L2 | AI-PaaS | `ai-system-governance` |
| `unlawfultrainingdata` | Training data without lawful basis or provider security assessment | L2 | Agent-PaaS | `ai-system-governance` |
| `unlawfultrainingdata` | Training data without lawful basis or provider security assessment | L2 | IaaS | `ai-system-governance` |
| `nopremarketconformity` | High-risk AI application lacks conformity assessment | L3 | Agent-PaaS | `application-developer` |
| `weakappaccess` | AI application access not limited to authorized users | L3 | AI-SaaS | `application-developer` |
| `weakappaccess` | AI application access not limited to authorized users | L3 | AI-PaaS | `application-developer` |
| `weakappaccess` | AI application access not limited to authorized users | L3 | IaaS | `application-developer` |
| `incompletevendorai` | Procured AI application lacks required documentation package | L3 | IaaS | `ai-system-governance` |
| `unlabeledsyntheticout` | Synthetic AI output not labeled or watermarked | L3 | AI-SaaS | `ai-system-governance` |
| `unlabeledsyntheticout` | Synthetic AI output not labeled or watermarked | L3 | AI-PaaS | `ai-system-governance` |
| `unlabeledsyntheticout` | Synthetic AI output not labeled or watermarked | L3 | Agent-PaaS | `ai-system-governance` |
| `unlabeledsyntheticout` | Synthetic AI output not labeled or watermarked | L3 | IaaS | `ai-system-governance` |
| `weakplatformaccountability` | AI platform security accountability not enforced | L4 | Agent-PaaS | `ai-platform-provider` |
| `weakplatformmfa` | Privileged access to the AI platform without multifactor authentication | L4 | IaaS | `ai-platform-provider` |
| `unremediatedplatformflaws` | Known vulnerabilities on the AI platform not remediated | L4 | Agent-PaaS | `ai-platform-provider` |
| `unprotectedplatformtraffic` | AI platform traffic and keys not cryptographically protected | L4 | Agent-PaaS | `ai-platform-provider` |
| `incompleteplatformqms` | AI platform quality management system incomplete | L4 | AI-SaaS | `ai-platform-provider` |
| `incompleteplatformqms` | AI platform quality management system incomplete | L4 | AI-PaaS | `ai-platform-provider` |
| `incompleteplatformqms` | AI platform quality management system incomplete | L4 | Agent-PaaS | `ai-platform-provider` |
| `openplatformfacility` | AI platform hosting area without facility access controls | L4 | AI-PaaS | `ai-platform-provider` |
| `openplatformfacility` | AI platform hosting area without facility access controls | L4 | IaaS | `ai-platform-provider` |
| `unregisteredclinicalplatform` | Clinical AI platform interoperability capabilities not registered | L4 | AI-PaaS | `ai-platform-provider` |
| `unscreenedmodelpersonnel` | AI Model Provider personnel without required screening | L5 | AI-SaaS | `model-provider` |
| `unscreenedmodelpersonnel` | AI Model Provider personnel without required screening | L5 | AI-PaaS | `model-provider` |
| `unscreenedmodelpersonnel` | AI Model Provider personnel without required screening | L5 | Agent-PaaS | `model-provider` |
| `noncompliantmodelrelease` | High-risk model offered without provider compliance duties | L5 | AI-SaaS | `model-provider` |
| `noncompliantmodelrelease` | High-risk model offered without provider compliance duties | L5 | AI-PaaS | `model-provider` |
| `noncompliantmodelrelease` | High-risk model offered without provider compliance duties | L5 | Agent-PaaS | `model-provider` |
| `undefinednotifyingauthority` | Model conformity assessment without a competent notifying authority | L5 | AI-PaaS | `model-provider` |
| `opaquefederalmodelacq` | Federal acquisition of AI models lacks required transparency | L5 | Agent-PaaS | `ai-system-governance` |
| `opaquefederalmodelacq` | Federal acquisition of AI models lacks required transparency | L5 | IaaS | `ai-system-governance` |
| `unqualifiedclinicalmodel` | Clinical predictive model without required qualification | L5 | AI-PaaS | `model-provider` |

50 cells. Class: `no_linked_control_in_model`.

## Summary finding

Of 6 threshold controls, 6 resolve to live anchor controls in rev 5; the catalog's breadth is not the problem. The gap is uniformly one of parameter typing: no rev 5 ODP can express a measured objective. The best any binding achieves is `cadence_only`, where a frequency ODP can carry how often something is reviewed or tested but not what value it must hold, over what window, with what tolerated shortfall.

## Proposed feedback

1. **For the AI overlay (SP 800-53 Control Overlays for Securing AI Systems):** where an overlay control governs continuously measurable AI behavior (inventory coverage, guardrail coverage at inference, override responsiveness, attestation currency, drift within declared bounds), define ODPs structured as measured objectives rather than freeform strings: target value, comparison, evaluation window, and tolerated shortfall. The `objective` object of the AI SRF threshold schema is a candidate shape.
2. **For OSCAL:** parameters currently admit labels, guidelines, and fixed selections. A typed parameter constraint (numeric with unit and window semantics) would let profiles carry operational thresholds natively, and would let a resolved threshold emit `set-parameter` values that provably match the live alerting configuration.
3. **For the COSAiS overlay series (NISTIR 8605, 8605A-D):** the sector vertical and common sections above enumerate 260 sector measured thresholds plus 41 common thresholds with no 800-53 binding yet. Where an overlay control covers the same behavior (guardrail coverage, drift bounds, oversight responsiveness), the overlay's ODPs are the natural home for these objectives; typed measured-objective ODPs in 8605B (Generative AI) and 8605D (Agentic AI) would let the vertical OSCAL profiles bind directly as the overlays publish.
4. **For the AI RMF Critical Infrastructure profile:** each prioritized outcome could name the measurable indicator that would make it auditable. The healthcare drift control (AISRF-MODEL-002) is a worked example of a profile-driven addition with a concrete SLI bound to `ca-7`, whose `ca-07_odp.01` (system-level metrics) is exactly the right hook but is untyped today.

---

*Regenerate with `python3 generate-gap-register.py`. Machine-readable form: `gap-register.json`.*
