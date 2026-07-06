# Plan: Map OSCAL to SRF by Industry Vertical

Status: executed, 2026-07-05. Owner: Bill. Scope: extend the OSCAL representation of the SRF from the core accountability matrix to the six industry verticals, sequencing finance and public-sector first.

## Execution status (2026-07-05)

Workstreams A, C, D, and E are done; B is cross-linked but not converged.

Built: `build/generate_oscal_verticals.py` emits `export/srf-oscal-verticals-catalog.json` (OSCAL 1.2.2, 258 controls, layer groups with one subgroup per vertical) and six `export/srf-{vertical}.profile.json` files, each importing the catalog, selecting its controls, and binding all threshold parameters. Control IDs are namespaced (`fin-srf-l1-dev-001`) because SRF IDs repeat across verticals; the original ID rides in prop `srf-id`. TBD and N/A mappings stay verbatim as props with class `unresolved`; verified mappings become links into 13 back-matter framework resources; EU AI Act citations are parsed with the canonical grammar. `build/verify_oscal.py` checks referential integrity offline (every internal href resolves, every param bound, profiles resolve against the catalog, no TBD in link text) and applies the official schemas when reachable. All seven documents also validate against compliance-trestle's metaschema-derived OSCAL models. `thresholds/generate-gap-register.py` now emits one gap section per vertical (258 thresholds, all currently `no_binding`) and names COSAiS 8605B/8605D as binding targets as they publish. Profiles are listed in `data/index.json` exports and linked from each `/{vertical}/controls/` page.

All seven documents pass the official OSCAL 1.2.2 JSON schemas (verified 2026-07-05 with `verify_oscal.py`, zero warnings).

Remaining: resolve TBD FINOS AIGF and SR 26-2 IDs against live sources so finance links replace props (same later for NAIC, Colorado, NYDFS, M-25-21 section numbers); the workstream B convergence pass onto the `thresholds/` schema; spot-check the handful of back-matter URLs added for frameworks not in `data/regulations.json` (M-25-21/22 PDFs, NAIC bulletin, NYDFS CL 7); optional OSCAL validation badge per vertical page. The remaining content work is sized and sequenced in `oscal-content-work-scope.md`.

## 1. Where we are today

The OSCAL surface stops at the core framework. `export/srf-oscal-catalog.json` is an OSCAL 1.1.2 catalog holding exactly 20 controls: 5 groups (L1 to L5) times 4 operating models (AI-SaaS, AI-PaaS, Agent-PaaS, IaaS). Each control encodes one accountability cell and nothing more. Its own metadata says so: "Industry vertical schemas are independently proposed extensions and are not part of the official CoSAI release."

The vertical content lives outside OSCAL. Six files under `data/` carry 258 controls total in a bespoke schema:

| File | Controls | Regulatory anchor |
| --- | --- | --- |
| finance-controls.json | 40 | SR 26-2, FINOS AIGF, GLBA |
| public-sector-controls.json | 40 | FedRAMP, M-25-21, FISMA |
| healthcare-controls.json | 40 | HIPAA, FDA |
| insurance-controls.json | 40 | NAIC, state exam |
| defense-controls.json | 53 | CMMC, DoD |
| manufacturing-controls.json | 45 | sector-specific |

Each control already carries the fields OSCAL needs: `id` (SRF-{layer}-{stage}-{seq}), `layer`, `component`, `accountable_persona`, `operating_models`, `mrm_stage`, a `mappings` block (finos_aigf, aicm, sr26_2, eu_ai_act), and a `threshold` block with `metric`, `operator`, `param`, `window`, `breach_action`, and an `evidence` pointer (`ocsf_class`, `attribute`, `ocsf_version`).

A parallel OSCAL-style track already exists in `thresholds/`. `baseline-catalog.yaml` plus `financial-services.profile.yaml` and `healthcare.profile.yaml` follow the OSCAL profile pattern (import a baseline, apply overrides). `gap-register.md` binds threshold controls to NIST SP 800-53 rev 5 ODPs and classifies where the catalog cannot carry a measured objective. That register is the NIST feedback artifact.

The gap: the 258 vertical controls are not expressed in OSCAL, no generator produces them, and the two tracks (the JSON matrix catalog and the YAML threshold profiles) are not unified.

## 2. Target model

Each vertical becomes an OSCAL **profile** that imports the canonical SRF catalog and tailors it. This matches the pattern already in `thresholds/`, keeps one authoritative catalog, and lets a vertical add or constrain controls without forking the base. The decision is deliberate over the two alternatives: standalone extension catalogs duplicate the layer structure six times, and a single merged catalog becomes unversionable once six regulators revise on independent cadences.

Concretely, the target set of OSCAL documents:

1. **One expanded SRF catalog.** Promote the vertical controls into an OSCAL catalog keyed by SRF layer group, with each vertical control expressed once as a catalog control. Thresholds become OSCAL `param` elements; regulatory mappings and OCSF evidence become `props` and back-matter `resources`. This supersedes the 20-cell catalog, which is retained as the accountability overlay.
2. **One profile per vertical.** `srf-finance.profile.json`, `srf-public-sector.profile.json`, and so on. Each imports the catalog, selects the controls in scope for that sector, and sets vertical parameter values (target, window, error budget, breach action) plus vertical `regulatory_drivers`.
3. **Back-matter resource set.** Every regulatory citation (SR 26-2 letter, FINOS AIGF, M-25-21, HIPAA, FedRAMP baselines) becomes a resolvable OSCAL `resource` with a URL, cited from controls by `rel="reference"`.

Field mapping from the bespoke schema to OSCAL:

| Bespoke field | OSCAL target |
| --- | --- |
| `id` | control `id` |
| `layer` | enclosing `group` (l1 to l5) |
| `accountable_persona` | `prop name="accountable-persona"` |
| `operating_models` | `prop name="operating-model"` (repeated) |
| `mrm_stage` | `prop name="mrm-stage"` |
| `mappings.*` | control `links` rel="reference" into back-matter |
| `mappings.eu_ai_act` | one `link` per citation, parsed from the canonical grammar (see A) |
| `threshold.metric/operator/param/window` | `param` + `part name="objective"` |
| `threshold.breach_action` | `prop name="breach-action"` |
| `threshold.evidence.ocsf_class/attribute` | `prop name="ocsf-class"` / `prop name="ocsf-attribute"` |
| `threshold.evidence.oscal_bindings` | control `links` rel="related" to 800-53 controls |

## 3. Workstreams

### A. Generator

Build `build/generate_oscal_verticals.py` that reads `data/*-controls.json` and emits the expanded catalog plus one profile per vertical into `export/`. No hand-authored OSCAL: the JSON stays the source of truth, OSCAL is a generated view, same as the existing catalog was generated from `data/matrix.json`. Add a companion `build/verify_oscal.py` that validates output against the OSCAL 1.1.2 (or 1.2.2, see D) JSON schema and checks referential integrity (every `link` href resolves to a back-matter resource, every param is bound).

The generator can now assume a deterministic EU AI Act citation grammar, since the vertical files were normalized to one form and each carries an `eu_ai_act_citation_format` header documenting it: split the string on `; `, take the leading `Article N` (with sub-provisions such as `Article 10(2)(f)`) or `Annex X` token as the link target, keep the trailing parenthetical as the link text, and pass an entry through unresolved when it is `TBD:`-prefixed or `N/A`. No fuzzy parsing and no invented targets. The same header convention should be added to the other framework mapping keys (`finos_aigf`, `aicm`, `sr26_2`) before the generator relies on them.

### B. Threshold and parameter binding

Reconcile the two threshold representations. The `data/*-controls.json` thresholds and the `thresholds/*.profile.yaml` overrides describe the same objectives in different shapes. Decide one canonical form (recommend the `thresholds/` schema, which already has error budgets and burn-rate alerting) and have the generator pull objective values from there, or converge the two. Carry the `mapping_status_note` discipline forward: any `TBD` mapping id stays `TBD` in OSCAL rather than being invented.

### C. Regulatory back-matter and gap-register extension

Extend `generate-gap-register.py` so every vertical's `oscal_bindings` are checked against the 800-53 rev 5 catalog, not just the baseline set. Output one gap section per vertical. This directly feeds the NIST 800-53 AI overlay and AI RMF profile discussions and is the highest-leverage external deliverable.

Two back-matter resources are now correctly available and should anchor this work. `data/regulations.json` entry `nist-ai-600-1` is now the Generative AI Profile (not a duplicate of the base RMF), so genAI and agentic controls have a valid NIST resource for the RMF-level mapping. Its security-control counterpart is the COSAiS overlay series (`nistir-8605a`): 8605 (methodology), 8605A (Predictive AI), 8605B (Generative AI), 8605C (AI Developers), 8605D (Agentic AI). Because 8605B and 8605D are 800-53 overlays that carry organization-defined parameters, they are the natural gap-register targets for genAI and agentic thresholds, and the register should bind against them as they publish (8605 and 8605A initial drafts expected Q3 FY2026) rather than only against the base 800-53 catalog.

### D. OSCAL version decision

The existing catalog is OSCAL 1.1.2; the gap-register works against the 800-53 rev 5.2.0 catalog published in OSCAL 1.2.2. Pick 1.2.2 for all new output so vertical profiles and 800-53 bindings share one OSCAL version, and note the base-catalog upgrade as a one-line migration.

### E. Site and export surfacing

Add the vertical profiles to the `export/` pack alongside `srf-oscal-catalog.json`, list them in `data/index.json`, and expose a download per vertical from each `/{vertical}/controls/` page. Optional follow-on: an OSCAL validation badge on each vertical page.

## 4. Sequence

Beachheads first, then fan out. Each vertical is the same template once finance proves it.

1. **Finance (reference implementation).** Generator + expanded catalog + `srf-finance.profile.json` + finance gap-register section. Anchor on SR 26-2 and FINOS AIGF; resolve the `TBD` FINOS/SR 26-2 ids against the live sources before publishing. This validates the whole toolchain end to end.
2. **Public-sector.** `srf-public-sector.profile.json` with FedRAMP baseline and M-25-21 drivers. Time this against the M-25-21 September 22 2026 deadline so the OSCAL profile is citable in that window.
3. **Healthcare, insurance, defense, manufacturing.** Run the same generator; each is a data + mapping-verification pass, not new engineering. Defense (53 controls, CMMC) is the largest and should go last of the batch.
4. **Convergence pass.** Retire or cross-link the standalone `thresholds/*.profile.yaml` once the generated OSCAL profiles carry the same objectives, so there is one place to change a threshold.

## 5. Definition of done

For each vertical: a profile that validates against the chosen OSCAL schema, imports the canonical catalog, binds every threshold to a param, resolves every regulatory link to back-matter, carries no invented mapping ids, and has a gap-register section against 800-53. For the program: a generator and verifier in `build/`, the profiles in the `export/` pack and `data/index.json`, and a single canonical source for thresholds.

## 6. Open questions

- Converge the `data/*-controls.json` thresholds with `thresholds/*.profile.yaml`, or keep the controls JSON as the OSCAL source and treat the YAML as human-facing? Recommend converging on the `thresholds/` schema.
- Publish vertical profiles under the same `aisharedresponsibility.com/ns/oscal` namespace, and how to signal clearly that they are proposed extensions, not CoSAI-released, as the base catalog already flags.
- Whether to model the 20-cell accountability matrix as a `part` inside each vertical control or keep it as a separate overlay catalog.

Resolved since first draft: how to represent generative and agentic AI in OSCAL. Use `nist-ai-600-1` (Generative AI Profile) for the RMF-level mapping and COSAiS 8605B / 8605D for the security-control overlay, now that the regulation entries are corrected.
