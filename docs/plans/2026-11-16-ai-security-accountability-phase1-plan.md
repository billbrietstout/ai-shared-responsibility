# Phase 1 plan: AI security and accountability

Inspection date: 2026-11-17. Source: `docs/plans/2026-11-16-ai-security-accountability-handoff.md` (545 lines, sections 1 to 15 and the final principle, copied verbatim from the full handoff). This document is the Phase 1 deliverable in section 12: inspect the repository, record what the data can support, and plan Phases 2 to 5. It does not change the site, the SRF, or any JSON.

Method: read the Relationship Map page, its script header, chain and URL logic, and styles; read the shared nav and the homepage hero; inventory `data/` with a script (counts below). The script counted fields that are already stored. It did not create links. `tools/relationship-map/app.js` is about 2,600 lines. The read covered the data contract at the top, chain construction, provenance wording, and URL state, plus the page and stylesheet. Line-by-line review of all 286 controls was not done.

ROCA means risk, obligation, control, accountable. It is not a RACI chart. The four SRF v1.0 operating models are AI-SaaS, AI-PaaS, Agent-PaaS, and IaaS. The L5 layer name and the L5 persona name stay "AI Model Provider". The ids `model-provider` and `persona-model-provider` stay as they are.

## 1. Current Relationship Map

Public URL, unchanged by later phases: `https://aisharedresponsibility.com/tools/relationship-map/`.

Files:

- `tools/relationship-map/index.html` loads `/shared/styles.css`, `styles.css`, `/shared/components.js`, graphology 0.26.0, sigma 4.0.6, and `app.js`. `<site-nav current="tools">` and `<site-footer>` come from the shared components. The visible title is "Relationship map". The lede already says the chain is risk, obligation, control, and one accountable persona.
- `tools/relationship-map/app.js` fetches JSON in the browser and draws a link only when a file names it. There is no build step and no private API.
- `tools/relationship-map/styles.css` sets `--map-*` kind colors. The comment requires 3:1 contrast against `--surface` in light and dark. At 800px the layout stacks and the chain SVG hides. At 480px the search row stacks. With a node open on a narrow screen, the details panel docks to the bottom.

Data the script loads:

| Kind | File | Field |
|---|---|---|
| Layer | `data/layers.json` | `layers[]` |
| Persona | `data/personas.json` | `personas[]`, `sector_specializations[]` |
| Operating model | `data/matrix.json` | models with `provenance` `cosai-core`; `Federated-Consortium` (`proposed-extension`) draws only while Tapestry is on |
| Risk | `data/threats.json` | `threats[]`, 31 rows |
| Control | `data/{finance,healthcare,insurance,public-sector,defense,manufacturing,tapestry}-controls.json` | `controls[]` |
| Policy level | `tools/policy-pyramid/data.json` | `levels[]` |
| Whitepaper topic | `data/ai-agentic-principles.json` | `sections{}` |
| Obligation text | `data/moral-regulatory-hierarchy.json` | `requirements[]` |
| Instrument class | `data/regulations.json` | `source_kind` |
| Sector name to SRF model | `data/sector-model-map.json` | `srf_model` |

Chain fields the script already uses: `controls[].accountable_by_model` (one persona per SRF model), `threats[].obligations[]` (`basis`, `source`), `threats[].related_controls`, `threats[].accountability`.

Graph edge types, and the field that produces each one:

- `persona-layer` from `personas[].srf_layers` and `sector_specializations[].srf_layers`
- `specializes` from `sector_specializations[].specializes`
- `model-layer` from `layers[].operating_models` for a cosai-core model id
- `control-layer` from `controls[].layer`
- `control-persona` from `controls[].accountable_persona`
- `control-model` from `controls[].operating_models[]`, or from the SRF model named for a sector model
- `control-policy` from `controls[].policy_level` or `controls[].policy` (no control has this field today)
- `risk-control` from `threats[].related_controls`

Chain edges are drawn on the chain board, not as extra graph edges:

- Risk to obligation from `threats[].obligations[]`. Dashed when `basis` is `derived_via_control` or editorial.
- Obligation to control from the source control on that link, or a citation match.
- Instrument to control when a current-obligation citation has no article match. Drawn dotted and marked instrument-level.
- Control to persona from `controls[].accountable_by_model` for the chosen model.

Tapestry records (`provenance` `proposed-extension`, or a control whose every operating model is a proposed-extension model) stay out of an SRF chain. Operating-model strings that are not matrix models and are not in the sector map are not drawn.

The knowledge-layer generator (`build/generate_knowledge_layer.py`) emits the same joins under different names: `mitigated_by`, `triggers_obligation` (carries `basis` and `obligation_source`), `risk_owner`, `implements`, `governed_by` (carries `citation` and, for a current obligation, `obligation_fallback`), `accountable_to`, `applies_to_layer`, `applies_in_operating_model`. `build/verify_knowledge_layer.py` checks those edges. Exports already on the site include `export/srf-oscal-catalog.json`, `export/ontology.json`, and the vertical OSCAL profiles. Later phases should keep those files generated, not hand-edit them.

## 2. Data inventory

Counts from the files on `origin/develop` at `9428747` (2026-11-17).

Risks: 31. Every row has `related_controls` and `obligations`. Obligation links: 314. Basis values stored: `derived_via_control` 309, `official_text` 5. The five `official_text` links are EU AI Act Article 15, on evasion, supply-chain model poisoning, disclosure in output, model inversion and membership inference, and model exfiltration. `named_citation` is allowed by `schemas/threats.schema.json` and is unused. `editorial` and `editorial_mapping` are handled in the map script and are not in the schema enum. Zero links use them.

`related_controls`: 124 refs, 57 unique control ids, 0 dangling ids. 229 of 286 controls are not named by any threat row.

Four accountability cells set `no_linked_control_in_model` and still name one persona: `modelinversionandmembership` and `devmodelleak` and `dsgai05` on AI-SaaS, and `dsgai11` on IaaS. Every other threat cell names one persona. No cell stores a list of personas.

Controls: 286. Finance 41, healthcare 41, insurance 40, public sector 40, defense 53, manufacturing 45, Tapestry 26. Layers: L1 68, L2 57, L3 55, L4 56, L5 50. The 260 vertical controls have `accountable_by_model`. The 26 Tapestry controls do not. They have `accountable_persona` and `provenance` `proposed-extension`. No `accountable_by_model` value is a list. Across the 694 vertical cells the personas are `ai-system-governance` 196, `application-developer` 134, `ai-platform-provider` 134, `data-provider` 127, `model-provider` 89, `agentic-platform-provider` 12, `ai-model-serving` 2. `ai-system-users` is a cosai-core persona and does not appear in those 694 cells.

`mappings` exists on all 286 controls. 775 mapping values are the string `TBD...` or `N/A`. Those are recorded non-mappings. They are not relationships to invent around.

Requirements: 184 in `data/moral-regulatory-hierarchy.json`. 145 have `moral_profile` null. 67 distinct requirement ids are cited by a threat obligation. 117 requirements are not cited by any threat obligation. Instruments in that file include the EU AI Act, NIST AI RMF, NIST SP 800-171, CMMC, OMB M-25-21 and M-25-22, HIPAA, GDPR, and others. `docs/roca-data.md` records how a requirement becomes a current obligation.

Regulations: 61 items. `source_kind`: `voluntary_standard` 27, `binding` 26, `catalog` 8. A catalog is not an obligation. One record sets `current_obligation` false (the NYDFS 2024 AI cyber letter, per `docs/roca-data.md`).

Personas: 8 with `provenance` `cosai-core`, 2 with `proposed-extension` (Sovereign Participant Node, Consortium Core Coordinator), 4 sector specializations with no `provenance` field. Canonical layer names in `data/layers.json`: L1 AI Business & Usage, L2 AI Information, L3 AI Application, L4 AI Platform, L5 AI Model Provider.

Attack inventory: `data/attack-inventory.json`, 58 entries. `srf_crosswalk` is a list of threat ids. 45 entries have at least one id. 13 are empty (listed in section 7). `vertical_controls` is optional and present on 7 entries. `related` links attack ids to attack ids (57 entries). `taxonomy_refs` holds catalog technique ids. There is no `exposure` field.

Evidence: `threshold.evidence` on vertical controls. 158 of those objects contain the string `TBD`. 102 do not. The 26 Tapestry controls have no `evidence` object. An evidence object is a pointer or a description. It is not a test result.

Lifecycle fields that exist, and that are not prevention / detection / response / recovery:

| File | Field | Values |
|---|---|---|
| Finance | `mrm_stage` | development, independent-validation, ongoing-monitoring, effective-challenge |
| Healthcare | `clinical_stage` | design-development, verification-validation, post-market-surveillance, human-oversight-review |
| Insurance | `insurance_stage` | design-development, validation-testing, ongoing-monitoring, third-party-oversight |
| Public sector | `public_sector_stage` | acquisition-integration, pre-deployment-validation, ongoing-monitoring, human-oversight-remedy |
| Defense | `lifecycle_stage` | acquisition, tevv, ops, human-oversight-remedy |
| Manufacturing | `lifecycle_stage` | design, validation, ops, change |

Seven controls carry `cross_layer_controls` or `cross_layer_note`. There is no general `depends on` edge between components.

`framework/security-lifecycle/index.html` groups the site into six categories (threat modeling, adversarial testing, secure development, control implementation, vulnerability management, detection and incident response). Those headings are page sections. They are not fields on a control.

## 3. Provenance as shown today

The chain legend has three line styles:

- Solid: "The record names this link."
- Dashed: the link was reached through a shared control, or it is an editorial judgment. The legend says this does not mean the legal text names the risk.
- Dotted: instrument-level. The control cites the instrument, and no article record matched.

`basisIsDashed` in `app.js` treats `derived_via_control`, `editorial`, and `editorial_mapping` as dashed. `official_text`, `official_legal_text`, `named_citation`, and `named_cite` stay solid. Any other basis, including a missing basis, is dashed, and the sentence names the stored value.

What that means for the three classes in section 2 of the handoff:

| Class the handoff asks to keep | What is stored | How the map shows it |
|---|---|---|
| Directly sourced | `basis` `official_text` on 5 risk-to-obligation links. `source` has `url`, `citation`, `excerpt`, `consolidated_date`. | Solid, with "Taken from the official text." |
| Derived | `basis` `derived_via_control` on 309 links. `source.controls` lists the control id, the mapping key, and the citation string. Knowledge-layer `implements` and `governed_by` edges come from the same citation match. `obligation_fallback` true means the citation matched the instrument and no article record. | Dashed for the risk-to-obligation link. Dotted for the instrument fallback. |
| Editorial or proposed | No stored `basis` uses `editorial`. Tapestry records use `provenance` `proposed-extension` and stay out of the SRF chain unless the visitor turns Tapestry on. | The script can draw an editorial line. The data never asks it to. |

`threats[].related_controls` has no `basis`. The chain draws that join as a solid line because the threat file names the control. That solid line means "this JSON record lists the control." It does not mean an external catalog or a statute named the pair. Later copy must keep that distinction. Do not backfill `basis` on those 124 refs in a later phase unless Bill assigns each value. A blank basis is not an invitation to mark them editorial or direct in bulk.

## 4. Navigation and shared UI

`shared/components.js` renders `<site-nav>` and `<site-footer>`. Styles live in `shared/styles.css`. No shadow DOM. Nav items and hrefs today:

| Label | href |
|---|---|
| Framework | `/framework/` |
| Assess | `/assess/` |
| Controls | `/controls/` |
| Regulations | `/regulations/` |
| Industries | `/industries/` |
| Compare | `/compare/` |
| Data & agents | `/developers/` |
| About | `/about/` |

A separate Tools button points at `/tools/`. The footer repeats those links and adds Presentation, Changelog, llms.txt, and the GitHub source. The map is not in the nav. It is a card on `/tools/` titled "Relationship map".

Homepage `index.html` h1: "Make responsibility clear before you scale AI." The lede says the SRF maps every obligation and control to one accountable party. The primary button goes to `/tools/decision-record/`. Three role links go to the layer matrix or the controls assessment. The URL `/` stays.

Site color tokens in `shared/styles.css` are navy ink and one blue accent (`--cosai-navy`, `--cosai-blue`), plus layer colors `--l1` through `--l5`. Map kind colors are separate: layer green, persona blue, model orange, control purple, risk brown, policy teal, topic rose.

`build/inject_page_metadata.py` writes the `llm:meta` block on `tools/relationship-map/index.html`. A later edit to that page has to be committed with the injector output, or `.github/workflows/verify.yml` fails the drift gate. This docs-only change does not touch HTML, so the gate should stay quiet.

There is no Relationship Map unit test. Integrity checks for the joins live in `build/verify_knowledge_layer.py`.

## 5. Current UX

Entry is a search box labeled "Find a risk or a control", with suggestion lists for risks and controls. Choosing one opens the chain board. The full graph is behind "Show the full graph". Kind filters (layer, persona, model, risk, control, policy, whitepaper topic) appear in that advanced view. Operating-model radios start at All and list the four SRF v1.0 models. A checkbox reveals Tapestry. The empty state says "Choose a risk or a control to see its chain."

URL query keys already in use, and which later work must keep working: `risk`, `control` (`vertical:id`), `model`, `view=full`, `node`, `wide=1`, `neighbors=1`, `tapestry=1`. There is no `persona` parameter and no path other than `/tools/relationship-map/`.

The chain board columns are Risk, Obligation, Control, Accountable. Gaps the script already writes:

- No obligation linked to this risk.
- An obligation id on this risk does not match a requirement record.
- No linked control in a named model, plus the same cell's missing persona line when `no_linked_control_in_model` is set.
- No risk in the catalog links to this control.
- No obligation is linked to this control.

The "no risk" and "no obligation" sentences describe an absent join. They do not say the absence was confirmed as a security hole. Phase 3 should tighten that wording so a missing join stays a missing mapping.

A preview callout already says risk-to-obligation links run through a control and do not mean the legal text names the risk.

Mobile: chain columns stack under 800px, the connecting SVG is hidden, and the details panel docks while a node is open. Phase 5 has to retest that dock after any layout change. The four entry points will sit above the search box, so the 480px stacked buttons need a check in the same pass.

## 6. Feature assessment

Each feature uses the handoff's rule: where the files do not support it, the gap is named and left for Bill. No control-to-risk, regulation-to-control, or accountability mapping is proposed here.

### 6.1 Rename the map and the homepage

(a) Supported as presentation. The URL, the query keys, the JSON, and the OSCAL exports stay.

(b) Visible strings in `tools/relationship-map/index.html` (title, lede, hero, search label, empty state, JSON-LD `name`), the card title and description in `tools/index.html`, and the homepage h1 and lede in `index.html`. Canonical id `srf.page.tools-relationship-map` stays. Layer and persona records stay.

(c) Bill chose the name "AI Security & Accountability Explorer" on November 16, 2026 (Pacific). The URL stays `/tools/relationship-map/`. The homepage headline stays "AI Security Requires Accountability." Section 9 of the handoff also gives a subheadline, a supporting paragraph, and the closing line "From AI threats to accountable security." Those are copy, and they land in Phase 4. They do not require new data.

(d) Smallest test: change the map h1, the tools card, and the document title to "AI Security & Accountability Explorer", then load `/tools/relationship-map/` and `/tools/relationship-map/?risk=directpromptinjection`. The chain for that existing risk id still renders. Run `build/inject_page_metadata.py` and commit any marker drift. Do this in Phase 2 for the map and Phase 4 for the homepage.

### 6.2 Four entry points

The default is already a chain, and the full graph is already advanced. The missing piece is four ways to start, aimed at the questions in section 4.

**A. Threat or risk.** (a) Partially supported. (b) The 31 rows in `data/threats.json` are the risk records the map already searches. Attack technique ids are on `threats[].mappings` (`owasp_llm_top10`, `mitre_atlas`, `biml_llm24`, `owasp_dsgai`) and on `data/attack-inventory.json` `taxonomy_refs`. `srf_crosswalk` joins 45 attack entries to threat ids. `attack_surface` and `failure_mode` are stored text. The chain from a threat id already continues through obligation, control, and one persona. (c) There is no exposure record and no exposure field. "Security requirement" is not a stored type (see B). Thirteen attack entries have an empty `srf_crosswalk`. The map does not load `attack-inventory.json` today. (d) Add an entry button that opens the existing risk search and, for the selected threat, shows `attack_surface`, `mappings`, and any attack-inventory row whose `srf_crosswalk` contains that threat id. Show an empty crosswalk as a missing mapping. Do not add an Exposure column. Query key stays `risk`.

**B. Security requirement.** (a) The data does not support this entry as its own object. (b) The closest records are `requirements[]` in `data/moral-regulatory-hierarchy.json` and the citation strings on `controls[].mappings`. The map already shows those records as obligations. `data/regulations.json` `source_kind` separates binding instruments, voluntary standards, and catalogs. NIST AI RMF rows are voluntary-standard obligations under the rule in `docs/roca-data.md`. They are not labeled security requirements. (c) Section 3 of the handoff keeps obligation and security requirement as different concepts, and section 15 forbids equating compliance with security. Renaming the obligation column would cross that line. No file stores "security outcome that must be achieved" apart from an obligation or a control description. (d) Ship the entry as a short panel that says a security-requirement catalog is not in the data yet, and link the visitor to the existing obligation column under the name Obligation. Show `source_kind` when the obligation's instrument is known. Do not title that list "Security requirements." Decision 2 is the gate for any later rename.

**C. Security control.** (a) Supported. (b) Control nodes, `related_controls` for the risks that name the control, obligation links whose `source.controls` include that control, `threshold.evidence`, `layer`, and `accountable_by_model`. The control chain already exists. Query key `control`. (c) "Mitigated risks" only exist for the 57 controls a threat names. The other 229 have no risk join. The coverage panel calls that absent join a missing mapping. Evidence is often `TBD` (section 2). The chain does not show design, implementation, operation, monitoring, and effectiveness as separate states. Those words are not fields. (d) Keep the control entry on the current chain. Retitle the columns only where the underlying object is unchanged: Control stays Control, Accountable stays the persona. Add the evidence pointer under the control card, and when the object contains `TBD` or is missing, say the evidence pointer is not recorded. Reword "No risk in the catalog links to this control" to "No threat record names this control." That sentence describes the file, not a confirmed gap.

**D. Accountability.** (a) Supported for the stored persona joins. (b) `controls[].accountable_by_model`, `controls[].accountable_persona`, `threats[].accountability[<model>].accountable_persona`, `personas[].id` and `name` and `srf_layers`. One string per model. `Shared` is not a persona id. Sector specializations stay on `accountable_persona`. The per-model field stores the canonical persona that specialization points at. (c) The map cannot start from a persona today. Cross-layer ownership is the persona's `srf_layers` plus each control's `layer`. It is not a separate dependency graph. Third-party ownership is the customer or provider cell on the threat (`accountable_party`, `responsibility`) and the sector-model names on the control. There is no vendor-boundary edge. The six job titles in section 7 of the handoff are not persona ids (section 8 of this plan). (d) Add a persona list limited to the eight cosai-core personas. Choosing one lists controls whose `accountable_by_model` equals that id for the selected model, and threats whose accountability cell equals that id. Put the result in the existing chain columns. Add a query key `persona` without adding a new path. Tapestry personas stay behind the existing checkbox. A control with no `accountable_by_model` (the 26 Tapestry controls) does not appear in an SRF chain.

The differentiator sentence is copy and can sit on entry D and, in Phase 4, on the homepage:

"Authorization establishes what an AI agent is allowed to do. Security ownership establishes who is accountable for what happens next."

Place it as a stated principle. Do not attach it to a specific control or persona.

### 6.3 Security relationship types

See the table in section 7. Summary: four of the ten proposed types can be shown from fields that already exist, if the label stays inside what the field means. Six need a new field or a decision. Provenance stays the `basis` already stored, plus the explicit statement when a join has no `basis`. Do not present an editorial inference as a regulatory requirement. The script already refuses to invent a line the JSON does not name. Later work should keep that rule.

### 6.4 Layers as security domains

(a) Supported as presentation. (b) `data/layers.json` `id`, `name`, `short`, `description`, `personas`, `operating_models`. The map already places L1 to L5 and filters controls by `controls[].layer`. (c) The canonical names differ from the handoff's security framing. Replacing `name` in JSON would rewrite the SRF presentation in the data file. Section 6 of the handoff says the new sentences are presentation descriptions. The examples in that table (prompt injection, poisoning, and the rest) are illustrations. They are not new links. (d) In the map chrome, show the canonical name and, under it, the framing sentence from section 6 of this plan's layer table. Leave `data/layers.json` unchanged. A visitor still sees "L5 AI Model Provider" as the record name, with the security framing as a subtitle.

### 6.5 Gap analysis

(a) Partially supported. The map can classify joins that are already flagged. It cannot answer questions that need a security-requirement object or a prevention / detection / response / recovery field. (b) and (c) are in section 9, one row per question in section 8 of the handoff. (d) Add a read-only note on the chain details panel with three labels only:

- Confirmed coverage gap: a threat cell with `no_linked_control_in_model` true. Say "No linked control is recorded for this risk in this operating model." The persona on that cell stays visible. Do not call the persona missing.
- Missing mapping: a control absent from every `related_controls` array; a requirement id absent from every `obligations[].requirement`; an attack entry with an empty `srf_crosswalk`. Say "No record links these." Do not say the control fails or the threat is unmitigated.
- Unassessed: `threshold.evidence` missing or containing `TBD`; a `related_controls` ref with no `basis`. Say the pointer or the basis is not recorded.

A fourth label, "multiple accountable owners," is a check with an expected empty result: flag a cell only if the value is a list or the string `Shared`. Today that check returns no rows. Shipping the empty result tells the visitor the files were read. It does not invent a shared owner.

Do not label the 229 unlinked controls, the 117 uncited requirements, or the 13 empty attack crosswalks as confirmed security deficiencies.

### 6.6 One accountable persona per activity

(a) Supported for controls and for the 31 risks. (b) `accountable_by_model` and `threats[].accountability`. `docs/roca-data.md` records the rule, including the rejection of `co_accountable_persona` and `accountability_split`. The chain already shows one persona per model, and All shows one persona per model with the model name on the card. (c) "Activity" is not a record type. The stored activities are the control and the risk. The section 7 job titles are not activities in the data. Matrix cells can say `shared` for customer and provider responsibility. The threat file still names one persona when the matrix says shared. The map must keep showing that one persona and may show the matrix word `shared` as context from `responsibility`. It must not draw two owners. (d) On the accountable card, show one name. When the selected model is All, show one name per model. If a future record ever stores two ids, show the record as ambiguous and stop the chain for that cell. Leave the persona unset. No such record exists today.

### 6.7 Prevention, detection, response, and recovery

(a) Not supported. (b) No control, threat, persona, or layer field uses those four words as a closed set. The stage fields in section 2 are vertical lifecycle stages. `framework/security-lifecycle/index.html` has a section titled "Detection, monitoring, and incident response" that points at incident-response playbooks and the threshold schema. That is a page section, not an owner on a control. (c) Mapping `mrm_stage`, `clinical_stage`, `insurance_stage`, `public_sector_stage`, or `lifecycle_stage` onto prevention, detection, response, or recovery would be an invented classification. Section 15 forbids invented accountability mappings. The same block applies to "monitoring," "intervention," and "containment" in section 7 of the handoff. (d) Bill asked for a field proposal on November 16, 2026 (Pacific). The proposal is in section 13. Phase 3 may show four filters only after that shape is accepted. Until a control stores `security_function`, the panel says the function is not classified. Do not render `mrm_stage` or the other stage fields under those headings. Do not fill the field in the same change that adds the key.

### 6.8 Navigation

(a) Partially supported. Labels can change. New destinations that have no page cannot be added without a new URL or a choice among existing URLs. (b) `NAV_LINKS` and `FOOTER_LINKS` in `shared/components.js`. (c) A single "Resources" item would hide Regulations, Industries, Compare, and Data & agents. Those hrefs stay. The header proposal in section 13 moves Assess, Compare, and Data & agents to the footer. (d) Bill asked for destinations on November 16, 2026 (Pacific). The proposal is in section 13. It uses existing hrefs only. It does not add a route. Two labels stay out of the header because no page matches them: a browser of `attack-inventory.json`, and a supply-chain page. `/tools/vendor-risk/` stays a tool. It is not the supply-chain destination.

Regulatory and governance pages stay on their current URLs. Header labels for those pages are in the section 13 table.

### 6.9 Color

(a) Supported as CSS on the map. (b) `--map-risk`, `--map-control`, `--map-persona`, `--map-layer` in `tools/relationship-map/styles.css`, and the swatches in the kind filters. Site-wide tokens are `--cosai-navy` and `--cosai-blue` in `shared/styles.css`. (c) Section 11 assigns amber to security requirements. That object does not exist. Painting the obligation column amber would make obligations look like security requirements. (d) In Phase 2, set map colors to the roles that have an object: threat and risk red, control blue, accountable persona green, layer and operating model neutral. Leave the obligation column on a neutral treatment until decision 2. Keep the 3:1 contrast note, and check light and dark before the CSS change is called done. Do not recolor `shared/styles.css` in this work. A site-wide palette change is a separate decision and would touch every page.

## 7. Relationship types from section 5

| Relationship | Supported now | Files and fields | Gap | Smallest change |
|---|---|---|---|---|
| Mitigates | Yes, as a label for an existing join | `threats[].related_controls`; knowledge-layer `mitigated_by` | The id list has no `basis`. Section 13 proposes an optional sibling object. Existing rows stay unclassified until Bill sets each value. | Label the line "Mitigates". When `related_control_basis` has no entry for that id, say "This threat record names the control. The basis is not classified." |
| Prevents | No | None | Would reclassify controls. Stage fields are not this. | Do not draw it. |
| Detects | No | None | Same. | Do not draw it. |
| Responds to | No | Incident-response content is `/tools/ir-playbooks/` and `export/playbooks.json`. Those playbooks are not edges on a control in the map. | Linking a playbook to a control would be a new mapping. | Do not draw it. A later link needs Bill's assignment per control. |
| Implements | Only for an obligation a citation already matches | `threats[].obligations[].source.controls`; knowledge-layer `implements` with `citation` | The target is a requirement record, which the site treats as an obligation. It is not a security requirement. | Label the existing obligation-to-control line "Implements this obligation" and show `basis`. Do not use the words "security requirement" on that line. |
| Requires | No, as a first-class map edge | `regulations.json` items and `requirements[].instrument` share instrument ids. `governed_by` runs from control to instrument, with `citation`. | "A regulation establishes an obligation" is not an edge the map draws. Building one from shared ids would assert a relationship the map does not store as its own record. | Do not add the edge. The obligation card can keep showing its instrument name and URL from the requirement record, which it already can. |
| Accountable for | Yes | `accountable_by_model`; `threats[].accountability`; `accountable_to` and `risk_owner` in the knowledge layer | One persona per model is already the rule. | Label the existing last column "Accountable for" and show the one persona. |
| Operates at | Yes | `controls[].layer`; `threats[].srf_layer`; `affected_layers` | `affected_layers` can list more than one layer. The primary layer is `srf_layer`. | Show `srf_layer` as the layer of the risk and `layer` as the layer of the control. List `affected_layers` as additional layers named on the record, not as extra owners. |
| Depends on | No general edge | Attack `related` is attack id to attack id. Seven controls have `cross_layer_controls` or `cross_layer_note`. | Component dependency is not in the map graph. | Do not draw a dependency edge from `related` or from the seven notes unless a later phase quotes the stored note on the control card as text. Quoting `cross_layer_note` is display of an existing sentence. It is not a new edge. |
| Evidenced by | Pointer only | `threshold.evidence` | 158 objects contain `TBD`. 26 Tapestry controls have no evidence object. A pointer does not show the control works. | Show the pointer when it has no `TBD`. When it is missing or contains `TBD`, say the evidence pointer is not recorded. |

Provenance block the handoff asks each relationship to expose, and where it comes from today:

| Asked field | Where it exists | Where it does not |
|---|---|---|
| Relationship type | The edge names in section 1 | Prevents, Detects, Responds to, Requires, Depends on |
| Source or reference | Obligation `source`; control `mappings` citation; threat `mappings` and `ai_exchange`; attack `taxonomy_refs` | `related_controls` has the control id and no external citation of its own |
| Provenance classification | `basis` on obligation links; `provenance` on personas, models, and Tapestry | `related_controls` |
| Direct, derived, or editorial | `official_text`, `derived_via_control`; editorial is unimplemented in the data | Risk-control joins; evidence pointers |
| SRF layer | `srf_layer`, `layer`, `affected_layers` | A relationship does not always store a layer of its own. Use the endpoint's layer. |
| Accountable persona | Per model on the control and on the threat | Not on an obligation record. Do not copy a control's persona onto the obligation. |

## 8. Layers from section 6

Show the canonical name. Add the framing sentence as a subtitle in the map UI only.

| Layer | Canonical name in `data/layers.json` | Subtitle from the handoff, presentation only |
|---|---|---|
| L1 | AI Business & Usage | Business and usage security. Business processes, acceptable use, authority, human oversight. |
| L2 | AI Information | Information and data security. Data protection, privacy, provenance, poisoning, exfiltration. |
| L3 | AI Application | AI application security. Agent identity, authorization, tool access, prompt injection, runtime behavior. |
| L4 | AI Platform | AI platform security. Inference, orchestration, infrastructure, isolation, telemetry. |
| L5 | AI Model Provider | AI model and supply-chain security. Model integrity, provenance, vulnerabilities, third-party dependencies. |

The examples in the subtitle are the handoff's words. They do not add threat or control links. L5's canonical name stays "AI Model Provider". The persona at L5 stays "AI Model Provider" (`id` `model-provider`).

Accountability across layers is already visible when one persona's `srf_layers` lists more than one layer, or when a threat's `affected_layers` lists more than one layer. Show those arrays. Do not infer a cross-layer owner who is not in them.

## 9. Illustrative personas from section 7

The handoff table is labeled illustrative. None of these titles are ids in `data/personas.json`.

| Security activity in the handoff | Illustrative title | SRF persona id |
|---|---|---|
| Agent identity provisioning | Identity owner | Not in the persona file. Do not assign one. |
| Tool authorization | Application security owner | Not in the persona file. `application-developer` is a different record. Do not substitute it. |
| Runtime policy enforcement | AI platform security owner | Not in the persona file. `ai-platform-provider` is a different record. Do not substitute it. |
| Detection of unauthorized actions | Security operations owner | Not in the persona file. |
| Incident containment | Incident response owner | Not in the persona file. |
| Model supply-chain assurance | AI supply-chain security owner | Not in the persona file. `model-provider` is the L5 persona and is a different record. Do not substitute it. |

Phase 2 and Phase 3 do not render this table as owners. If Bill wants the sentence about authorization on the page, it stands alone. If he later wants the six rows on the page, each row stays marked illustrative and is not clickable as a persona.

Cosai-core persona ids the accountability entry may list, because they are the records: `ai-system-users`, `ai-system-governance`, `data-provider`, `application-developer`, `agentic-platform-provider`, `ai-platform-provider`, `ai-model-serving`, `model-provider`. Display names come from `personas[].name`. `ai-system-users` will show an empty control list for `accountable_by_model` with the current files. An empty list is a missing assignment in the control field, shown as "No control records this persona in `accountable_by_model`." The persona text in `data/personas.json` stays as written.

## 10. Gap questions from section 8

| Question | Answer from current files | Class |
|---|---|---|
| Which threats have no mapped security requirements? | Cannot be answered. Security requirements are not stored. All 31 threats have at least one obligation link. | Blocked. Decision 2. |
| Which risks have no mapped mitigating controls? | No threat has an empty `related_controls`. Four cells have `no_linked_control_in_model` for one model. | Those four cells are the confirmed coverage gaps. |
| Which requirements have no implementing controls? | 117 of 184 requirement ids are not cited by a threat obligation. Citation match from controls is a different join (`implements` / `governed_by`) and was not re-counted in this pass. `docs/roca-data.md` says 366 current-obligation edges still have `obligation_fallback` true. | Missing mapping or instrument-level citation. Not a confirmed absence of a control. Phase 3 may list requirement ids with no `implements` edge by reading the generated graph, and must label them "no article match" or "not cited by a threat record." |
| Which controls have no accountable persona? | None of the 286 lack `accountable_persona`. The 26 Tapestry controls lack `accountable_by_model` and are outside the SRF chain. | No confirmed gap inside the SRF chain. |
| Which activities have multiple purported accountable owners? | None in `accountable_by_model` or in threat accountability. | Check returns no rows. |
| Which controls have no supporting evidence? | 158 vertical evidence objects contain `TBD`. 26 Tapestry controls have no evidence object. | Unassessed pointer. Not a failed control. |
| Which security activities lack detection or response ownership? | Cannot be answered until `security_function` values exist. Section 13.3 says how the question is answered after that, and that unclassified controls stay out of the set. | Blocked until Bill assigns values. |
| Which dependencies cross organizational or vendor boundaries without clear accountability? | No dependency edge stores a vendor boundary. Threat cells do store `accountable_party` and a customer/provider `responsibility` pair, and they still name one persona. | Show the stored party as context. Do not invent a boundary gap. The seven `cross_layer_note` strings can be quoted on those control cards. |

## 11. Phases 2 to 5

Section 12 of the handoff assigns these phases to implementation. This pull request stops at the plan. Each later phase is one increment that can be loaded and checked before the next starts. No phase rewrites the SRF, replaces a JSON shape, deletes a regulatory mapping, or adds a relationship that is not already in a file.

HTML edits in Phases 2 and 4 run `build/inject_page_metadata.py` and `build/inject_chunk_markers.py` when those scripts touch the page, then commit the result so `verify.yml` stays green. JSON and OSCAL stay generated.

### Phase 2: Experience redesign

Map and tools card only. Homepage waits for Phase 4.

Implement:

- Map title "AI Security & Accountability Explorer", lede from section 10 of the handoff, tools-card text, and the document title. URL unchanged.
- Four entry buttons. A and C open the existing risk and control search. B is the gap panel from section 6.2. D opens the persona list from section 6.2.
- Chain as the default after a choice. Full graph stays on the existing button, with the existing kind filters.
- Relationship labels from section 7 for Mitigates, Implements this obligation, Accountable for, and Operates at. Each label shows `basis` when present and the no-basis sentence when absent.
- Evidence pointer on the control card, including the not-recorded sentence.
- One persona on the accountable card, and the authorization sentence as a principle on entry D.
- Layer subtitles from section 8.
- Map colors from section 6.9, with a contrast check in light and dark.

Preserve: query keys, Tapestry checkbox, operating-model filter, sector-model join, preview callout about indirect obligation links, dotted instrument fallback, and the rule that a line is drawn only when JSON names it.

Test in this phase: open the map, start from `directpromptinjection` and from one control id that a threat names (for example `finance:SRF-L3-DEV-001`, which is already in that threat's `related_controls`), confirm the chain, the dashed obligation links, and one persona per model. Open `?view=full`. Open the same URLs at 800px and 480px. Confirm entry B does not list obligations under the name security requirement.

### Phase 3: Security accountability

Where the files support it:

- Persona entry lists controls and threats for the selected model.
- Cross-layer: show `srf_layers` and `affected_layers` as stored arrays.
- Coverage panel with the three labels in section 6.5, plus the empty multiple-owner check.
- Attack-inventory rows joined only by `srf_crosswalk`. Empty crosswalks listed as missing mappings. The 13 empty ids are `atk-agent-memory-poisoning`, `atk-hallucinated-package-squatting`, `atk-sandbox-escape`, `atk-deceptive-agent-self-report`, `atk-repudiation-log-tampering`, `atk-observability-plane-evasion`, `atk-approval-fatigue`, `atk-token-length-side-channel`, `atk-approval-gate-bypass`, `atk-deceptive-process-reporting`, `atk-deepfake-approver-impersonation`, `atk-malicious-llm-api-router`, `atk-computer-use-stale-action`.
- Prevention, detection, response, and recovery filters from section 13. A control with no `security_function` is "not classified." Stage fields stay on the control record and do not appear under those four headings. No second owner.

Do not mark a control effective because a threat names it. Do not assign the illustrative titles in section 9.

Test in this phase: pick `model-provider` and AI-SaaS and confirm the four `no_linked_control_in_model` cells that name that persona still show the persona and the confirmed-gap sentence. Pick `ai-system-users` and confirm the empty `accountable_by_model` message. Confirm the coverage panel does not call the 229 unlinked controls deficiencies.

### Phase 4: Homepage and navigation

The map name is settled. The header hrefs are the proposal in section 13. Confirm that proposal before editing `shared/components.js`. Homepage buttons stay as in decision 7 until Bill picks one primary button.

- Homepage h1 "AI Security Requires Accountability."
- Subheadline: "Secure AI systems. Defend against emerging threats. Establish clear security ownership."
- Supporting text from section 9 of the handoff, in the hero lede.
- Closing line: "From AI threats to accountable security."
- The authorization sentence in the hero or directly under it.
- A link to `/tools/relationship-map/`. Keep the Decision Record link. Both destinations stay until decision 7 is a yes or a no.
- Header and footer labels from the section 13 nav table. Every href in that table already exists. Do not add a supply-chain item. Do not point Threats at `/data/attack-inventory.json`.

Governance, regulation, and industry pages stay linked. Their copy is supporting context. This phase does not rewrite those pages.

Test: `/` still returns the homepage, the old nav hrefs still resolve, and the map URL still resolves. Check the hero at desktop width and at 480px.

### Phase 5: Validation

Run the existing gate: `python3 build/generate_knowledge_layer.py --check`, `build/verify_knowledge_layer.py`, `build/verify_pages.py`, `build/verify_attack_inventory.py`, and the drift steps in `.github/workflows/verify.yml`.

Then check the map by hand:

- Existing URLs and query keys in section 5 of this plan, including a `tapestry=1` URL and a `model=AI-SaaS` URL.
- Search still finds a risk and a control.
- Graph direction: risk to obligation uses `basis`; control to persona uses `accountable_by_model` for the selected model only.
- Source text: an `official_text` card shows the excerpt and URL; a `derived_via_control` card shows the control id and citation and says the legal text is not the source of the risk link.
- Desktop, 800px, and 480px, including the docked details panel.
- Keyboard: skip link, search, operating-model radios, chain cards, clear selection.
- Contrast of the new map colors on white and on the dark surface.
- No JSON diff in `data/` or `export/` unless a generator produced it and the diff is unrelated to copy. This redesign should produce none.

Do not remove the full graph, the policy and topic nodes, or the regulatory mappings while validating.

## 12. Section 13, Grok review

Section 13 asks Grok to review the direction as a product and security reviewer. That review is not a code phase and is not part of this pull request. Section 15 places it before implementation and again after the implementation exists.

Recommended gate: Bill sends this plan and the handoff to that review before Phase 2. The eight questions in section 13 are the review brief. Two facts from this inspection should be in that brief so the review does not assume the data is richer than it is:

- Security requirement, exposure, prevents, detects, and responds-to are not stored relationships.
- One accountable persona per model is already stored for SRF controls and for the 31 risks. The six illustrative job titles are not persona ids.

After Phases 2 to 4, the same review looks at the running pages. Phase 5 can run before that second review so the reviewer sees a checked build. A fix pass after the review is separate work and needs its own change. This plan does not pre-write those fixes.

## 13. Decisions from November 16, 2026 (Pacific)

Bill answered the open list. This section records the answers. It does not write JSON.

### 13.1 Map name

Settled. The visible name is "AI Security & Accountability Explorer." The path stays `/tools/relationship-map/`.

### 13.2 Security requirements

Still open. Bill asked for context before choosing. The handoff defines a security requirement as the security outcome that must be achieved. It defines an obligation as what the organization or the responsible party must do. The site has the second record. It does not have the first.

What exists today:

| Record | File | What it is | Count |
|---|---|---|---|
| Obligation text | `data/moral-regulatory-hierarchy.json` `requirements[]` | Article or subcategory text. The map calls these obligations. | 184. 67 are cited by a threat obligation link. |
| Instrument class | `data/regulations.json` `source_kind` | `binding` 26, `voluntary_standard` 27, `catalog` 8. A catalog is not an obligation. NIST AI RMF is a voluntary standard, so the site treats its subcategories as current obligations under `docs/roca-data.md`. | 61 instruments |
| Control citation | `controls[].mappings` | A string on a control. 775 values are `TBD...` or `N/A`. | On all 286 controls |
| Control prose | `controls[].title` and `description` | What the control does. No separate requirement id. | 286 |

None of these rows is stored as "the security outcome that must be achieved." Calling the NIST, CIS, or ISO strings security requirements would treat a standard or a citation as that outcome. This plan does not do that.

Three rules Bill can pick. Entry B stays a gap panel until he picks one.

- Rule A. No current record uses the name. The UI keeps the word Obligation.
- Rule B. A new list, `security_requirements`, that Bill writes. Controls point at those ids only where he sets the pointer. The list starts empty. An empty list is not a coverage gap.
- Rule C. He names specific instrument ids that the UI may show as security objectives while the stored type stays obligation. He has to name the ids. The plan will not default that list to NIST AI RMF, CIS, or ISO.

### 13.3 Prevention, detection, response, and recovery

Bill asked for a proposal. This is the shape. It is not applied to the control files in this change.

Add an optional string on a vertical control:

```json
"security_function": "prevent"
```

Allowed values: `prevent`, `detect`, `respond`, `recover`. One value. The owner of that function is the persona already in `accountable_by_model` for the selected operating model. The function does not store a second persona. A control that does two of these jobs needs a later decision: Bill picks one primary value, or he splits the control. This change does not split any control.

Absence of the key means the function is not classified. It does not mean the control fails at detection or response. `mrm_stage`, `clinical_stage`, `insurance_stage`, `public_sector_stage`, and `lifecycle_stage` stay as they are. They are not a source for `security_function`.

Tapestry controls stay out of the SRF chain and do not get the key in this proposal.

The map, once the key is allowed, shows four filters. Each filter lists controls whose stored value matches. A count of controls with no value is labeled "not classified." No value is written until Bill assigns it per control. Adding the key to the verifier, so a present value must be one of the four words, can land before any control carries the key.

The question "which activities lack detection or response ownership" stays blocked until those values exist. After they exist, the answer is the set of controls with `detect` or `respond`, grouped by the persona already on `accountable_by_model`. Unclassified controls stay out of that set.

### 13.4 Navigation

Bill asked for hrefs. Every row below is an existing URL. Header text changes. Paths do not.

| Header label | href | What the page is |
|---|---|---|
| AI Security Framework | `/framework/` | Framework overview. |
| Threats | `/framework/security-lifecycle/` | Lifecycle essay and a sample of the 31-threat crosswalk. It links `/data/threats.json`. It does not list the 58 rows in `attack-inventory.json`. The header does not say "Attack Inventory" for that reason. |
| Security Controls | `/controls/` | Control schemas. |
| Security Accountability | `/tools/relationship-map/` | The explorer. `/personas/` stays available and moves to the footer. |
| Architecture | `/tools/layer-matrix/` | Layer handoffs. |
| Industries | `/industries/` | Unchanged destination. |
| Regulations | `/regulations/` | Supporting material. The destination stays. |
| About | `/about/` | Unchanged destination. |

The Tools button becomes "Tools & Explorers" and still points at `/tools/`.

Footer, hrefs unchanged: Personas `/personas/`, Assess `/assess/`, Compare `/compare/`, Data & agents `/developers/`, Presentation, Changelog, llms.txt, Source. Regulations and About can stay in the footer as well as the header.

Left out of the header:

- Attack inventory as its own browser. The file is `/data/attack-inventory.json`. Building a page for it is a new route. This proposal does not add one.
- AI Supply Chain. No page is that subject. `/tools/vendor-risk/` stays on `/tools/`. The L5 subtitle on the map is the supply-chain sentence from section 8. It is not a nav item.
- A single Resources item. The footer keeps the links that item would have hidden.

Confirm this table before Phase 4 edits `shared/components.js`.

### 13.5 Basis on risk-to-control links

Bill said yes to a basis field. The 124 current refs stay unclassified. This proposal does not write a basis on any of them.

Keep `related_controls` as an array of id strings. Readers already use that shape: the map, `build/generate_knowledge_layer.py`, and `build/verify_knowledge_layer.py`. Replacing the strings with objects would break those readers. Necessity for a new structure is not met if a sibling object can hold the basis.

Optional sibling on the threat:

```json
"related_control_basis": {
  "srf.control.finance.SRF-L3-DEV-001": {
    "basis": "editorial",
    "note": "Short reason Bill wrote for this pair."
  }
}
```

The id in the example is already in the `directpromptinjection` row. The `editorial` value in the example is a shape sample. It is not an assignment. Do not copy it onto the row.

Allowed `basis` values, the same set the obligation links use where they apply: `official_text`, `derived_via_control`, `editorial`. `official_text` requires `url` and `citation`. `derived_via_control` requires the control id and the citation the derivation used. `editorial` requires `note` in Bill's words. A key that is not in `related_controls` is an error. A missing key means the basis is not classified. The map sentence for a missing key is "This threat record names the control. The basis is not classified."

`schemas/threats.schema.json` can allow the object. The verifier can reject a bad key or a bad enum. Neither change fills the 124 refs.

### 13.6 Illustrative persona rows

Maybe. They stay off the site until Bill says to show them. The authorization sentence can ship without the table. If he later says yes, the six rows from section 9 render as a static note titled "Illustrative only." The titles are not links, and they are not persona ids. `application-developer`, `ai-platform-provider`, and `model-provider` are not substitutes for those titles.

### 13.7 Homepage buttons

Maybe. Until that is a yes or a no, Phase 4 keeps the Decision Record button and adds a map link. The map does not replace the Decision Record button.

### 13.8 Still open

When the Grok review in section 12 of this plan runs. The recommendation is still before Phase 2, and again after the pages exist. Bill has not set that time.

## 14. Files later phases may edit

Phase 2: `tools/relationship-map/index.html`, `tools/relationship-map/app.js`, `tools/relationship-map/styles.css`, `tools/index.html`, and injector output if the drift gate rewrites markers.

Phase 3: `tools/relationship-map/app.js` and `styles.css`. Read-only use of `data/attack-inventory.json`. No new keys in that file. `schemas/threats.schema.json` and `build/verify_knowledge_layer.py` may allow `related_control_basis` and `security_function` and reject a bad value. They do not write basis values or function values.

Phase 4: `index.html`, `shared/components.js`, and injector output, after the section 13 nav table is confirmed. `shared/styles.css` stays on the current navy and blue tokens.

Phase 5: no planned source edits. Failures get their own fix, still without new mappings.

Later phases still do not edit `data/layers.json`, `data/personas.json`, or `export/*` by hand. They do not add `security_function` or `related_control_basis` entries to `data/*.json` until Bill assigns each value. `data/threats.json` `related_controls` strings stay as they are.

## 15. Rules that bind Phases 2 to 5

From section 15 of the handoff:

1. Do not rewrite the SRF.
2. Do not replace existing data structures. `related_controls` stays an array of strings. A basis, if stored, sits in the sibling object in section 13.5. `security_function` is an optional string on a control, added only when Bill assigns that control.
3. Do not remove regulatory mappings.
4. Do not turn the site into a GRC dashboard. The coverage panel lists record gaps and the field each gap came from.
5. Do not equate compliance with security. Obligations keep their name.
6. Do not assume authorization guarantees safe agent behavior. The authorization sentence stays a principle, not a control status.
7. Do not assign multiple accountable owners to one activity.
8. Do not invent control-to-risk or regulation-to-control relationships.
9. Do not break existing URLs, query keys, or exports.
10. Prefer one testable change at a time. Phases 2, 3, and 4 are separate increments.

American English on the pages those phases edit. Short sentences. The words threat, control, obligation, persona, layer, and operating model stay stable. Machine-readable JSON, OSCAL, and `llms.txt` are out of the plain-language pass.
