# Handoff: draft whitepaper claims-test prompt pack

Working brief for Cursor agents and human coordinators in the
`AISharedResponsibility.com` workspace. Follow project writing rules (no em
dashes, no AI filler, SRF nouns where they apply). Do not ship this onto the
live site unless the owner asks.

**Date:** 18 September 2026  
**Workspace:** `/Users/billstout/Documents/Claude/Projects/AISharedResponsibility.com`  
**Live site:** https://aisharedresponsibility.com  
**Lane:** research and assessment method; not a new CoSAI SRF object  
**Status:** v1.0.7 at `/assess/claims-test/`; chain ids in `prompts.json`. Pack load is fetch of canonical `prompts.json` or an attached copy; citation URLs stay pinned. Chain run replies with the markdown report; JSON is optional. C-attacks is required. Typed suggestion packets and known `topics` enum live in `eval/claims-test/schema.json`. `cosai_workstreams` is retired.

Related live tools (cousins, not duplicates):

- `/assess/whitepaper-assessment/` — catalog match, integrity screen, draft mechanics, P1–P4
- `/assess/claims-test/` — this pack: ROCA + draft suggest packets
- `/tools/prompts/threat-model/` — chain-run pattern, Tracks A/B/C, stop conditions, eval harness

---

## Goal

Build a **non-interactive prompt pack** that assesses **draft AI security
whitepapers** and emits **channel-native edit suggestions**. Later, the same
chain can score published papers without suggestion packets.

Primary editorial channels:

| Stage | Where the draft lives | How humans edit | Assessment emit |
| --- | --- | --- | --- |
| Early | Google Docs | Suggestion mode + comments | Anchor + comment (why) + suggested replacement |
| Advanced | GitHub `.md` | PR review + suggested changes | Heading/line anchor + review comment + optional diff |
| Published | URL, PDF, arXiv | Errata / next version | Scorecard + report; suggestions optional |

A claim is testable when the reader can point to:

1. A named **risk** or attack class for the topic
2. An **obligation** (statute, regulation, or contract) that binds mitigation
3. A **control** that implements the obligation (prefer NIST SP 800-53)
4. One **accountable party** (job title or SRF persona)

Chain shape: risk → obligation → control → accountable party. One owner per
activity. "Shared" is analysis input, not a final answer.

Also harvest **axioms**, **invariables**, **principles**, and **references**
(arXiv/DOI when available; provisional on early drafts).

---

## Interaction model (decided)

**One intake packet in the first message, then a non-interactive chain run.**

- Do not pause mid-chain to ask clarifying questions.
- Missing optional fields are empty / `not_applicable`.
- If the draft cannot support a claim yet, score **Blocked** and suggest text.
- Optional **pre-flight helper** (separate prompt) may help fill intake; the
  chain itself stays one-shot.
- Authoring edits happen in Docs or the PR, not in the assessment chat.
- Re-runs pass `prior_assessment_id` and report score deltas only.

This matches `/tools/prompts/threat-model/` chain execution. It differs from a
human peer-review conversation on purpose so the pack can be evaluated.

---

## Dimension profiles (general drafts)

The **chain is fixed**. A **dimension profile** at intake swaps topic vocabulary
and pinned sources. Do not invent a new process per paper type.

Profile fields:

| Field | Purpose |
| --- | --- |
| `topics` | Known enum: agent-identity, multimodal, MCP, model-signing, shared-responsibility, persona-assignment, oversight-tiers, supply-chain, telemetry, tool-calling. Extensions go in `topics_other` (kebab-case). Do not use bare accountability. |
| `stage_vocabulary` | Industry or lifecycle stage labels for inventory rows |
| `industry_pilot` | Optional. Enum: `none`, `streaming`, `advanced-driver-assistance` (ADAS / autonomous driving), `call-center`, `critical-infrastructure`, `healthcare`, `finance`, `insurance`, `manufacturing`, `defense`, `public-sector`, `retail`, `telecom`, `aviation`, `physical-security`, `education`, `legal`. Prefer site vertical slugs when Track C may join later. |
| `pinned_sources` | Injected citation or SRF docs only. Pack load is separate: fetch or attach `prompts.json`. Empty pinned_sources does not block the chain. |

Technology papers (agent identity, multimodal) use the same steps. C-qa flags
claims outside the declared topics as Out of scope or scope creep.

**AI / GenAI / ML / Agent tags** mark model and agent surfaces. Those surfaces
are subsets of supporting infrastructure. Keep stage and layer on the same row.

| Tag | Use when |
| --- | --- |
| GenAI | Generative media or generative multimodal models |
| LLM | Language or video-language model is the scored/steered surface |
| AI | Broader automation, not specifically generative |
| ML | Classical or adversarial ML without GenAI as the primary tool |
| Agent | Tool use, planning, autonomy, or delegated actuation |

---

## Prompt chain (Track A required)

| Step | Purpose | Stop when |
| --- | --- | --- |
| C-intake | Channel, body, profile, prior id | Body anchorable; else halt |
| C-claims | Extract claims with anchors | Claim list with stable ids |
| C-screen | Integrity + draft mechanics | Findings logged; no “AI-written” verdict from style |
| C-foundations | Axioms, invariables, principles | Each entry cited or marked provisional |
| C-attacks | Published topic attacks from ATLAS, OWASP, BIML, and related papers | Failure mode; draft overlap named, implied, or omitted; no reproduction steps |
| C-inventory | Draft-treated risks bound to ATT rows | Id + failure mode; omitted ATT rows stay off inventory |
| C-tag | GenAI / LLM / AI / ML / Agent | AI-surface rows tagged |
| C-roca | Risk → obligation → control → one owner | Obligation ≠ control; if-conditions on row |
| C-score | Supported / Partial / Unsupported / Out of scope / Blocked | Every claim scored with one-line reason |
| C-qa | Orphans, tag rules, absolute coverage language | Gaps listed |
| C-suggest | Docs packets or PR comments/diffs | Every Partial/Unsupported/Blocked (+ P1/P2 screen) has a review item |
| C-report | Readable assessment + scorecard id | Report authored once |
| C-export-md | Markdown report (chain-run reply). JSON export is optional | Exports do not re-author judgment |

**Track B (optional):** SRF persona/layer join when `srf_inputs` present.  
**Track C (optional):** Vertical obligations when `vertical_source_rows` present.  
Run B then C after C-score and before C-suggest, same order as threat-model.

Modes: `full` | `map-only` (skip screen suggest depth as defined in prompts) |
`suggest-only` (reuse prior scorecard anchors when rebuilding packets).

---

## Intake packet shape (example)

```text
[claims-test intake]
channel: [google-docs | github-md | published]
mode: [full | map-only | suggest-only]
tracks: [A]

draft_title: [title as printed]
authors: [Author Name]
draft_status: [early | advanced | published]
industry_pilot: [none | streaming | advanced-driver-assistance | call-center | critical-infrastructure | healthcare | finance | insurance | manufacturing | defense | public-sector | retail | telecom | aviation | physical-security | education | legal]
dimension_profile:
dimension_profile:
  topics: [agent-identity | multimodal | MCP | model-signing | shared-responsibility | persona-assignment | oversight-tiers | supply-chain | telemetry | tool-calling]
  topics_other: []
  stage_vocabulary: [design | runtime | revocation]

prior_assessment_id: [null | ct-...]
pinned_sources: [DOI | arXiv id | URL already in this message]
srf_inputs: [null | operating_model plus personas and matrix]
vertical_source_rows: [none | obligation and control rows]

draft_body: |
  …
```

Then: `Run the claims-test chain.` No further questions.

---

## Score meanings

| Score | Meaning |
| --- | --- |
| Supported | Draft text plus ROCA or foundations backs the claim |
| Partial | Implied; mechanism or owner missing |
| Unsupported | No named actor, artifact, threshold, or failure mode |
| Out of scope | Outside declared profile / subject |
| Blocked | Cannot score until a screen defect (citation, definition) is fixed |

Do not treat “ensures trust,” “addresses the gap,” or “shared responsibility”
as Supported without a mechanism and one owner.

---

## Site constraints

- Accountability mapping stays AI SRF (one owner per activity).
- Threat taxonomies stay ATLAS / OWASP / BIML; do not mint a competing taxonomy
  letter inside the claims object.
- Agent telemetry: check AITF first (`.cursor/rules/aitf.mdc`); propose only
  binding gaps.
- Obligation ≠ control.
- Companion site copy must say independently proposed; not CoSAI SRF v1.0.
- `/assess/whitepaper-assessment/` remains the principle-catalog grader.
  This pack owns ROCA + draft suggest packets. They may call each other later;
  do not merge them into one prompt without an explicit design pass.

---

## What already exists in this workspace

| Artifact | Location | Notes |
| --- | --- | --- |
| This handoff | `whitepaper-claims-test-handoff.md` | Design notes; `prompts.json` is the chain source of truth |
| Prompt pack v1.0.5 | `assess/claims-test/prompts.json` | C-attacks is required. Intake packet uses bracketed examples; no `cosai_workstreams` field. Citations stay pinned. Chain run replies with markdown. |
| Site page | `/assess/claims-test/` | Owner asked 18 Sep 2026; independently proposed |
| Gold fixture | `eval/claims-test/gold/agent-identity-draft/` | Seven claims; Docs packets in `expected.json`; GitHub sample beside it |
| Eval stub | `eval/claims-test/run_eval.py` | Schema, scores, ROCA columns, tags, suggestion coverage |
| Streaming attack inventory canvas | Cursor canvases: `streaming-multimodal-attack-inventory.canvas.tsx` | Industry-generic; AI tags present |
| Streaming ROCA canvas | `streaming-multimodal-risk-mapping.canvas.tsx` | Filter by stage, layer, AI tag |
| Markdown exports | Often under `papers/` (gitignored) | `streaming-multimodal-*.md` |
| Corpus-build history | Local chat / canvases | Discovery order differed from draft chain; do not restart inventory from zero |
| Main site handoff | `HANDOFF.md` | Points at this pack as shipped under `/assess/claims-test/` |

First subject pilot was multimodal / streaming. Treat it as a **dimension
profile example** and optional gold fixture, not as the only scope of the pack.

---

## Explicit non-goals

- Mid-chain interactive Q&A as the default run mode
- Reproduction steps, exploit PoCs, fuzzing playbooks
- A new severity score or ATLAS/OWASP replacement
- Absolute coverage language without a count method
- Brand-specific marketing titles; use role names
- Merging this pack with `/assess/whitepaper-assessment/` without an explicit design pass

---

## Next work (ordered)

1. Done: `assess/claims-test/prompts.json` with chain ids, `operator_initial_inputs`, shared_rules, stop conditions, two C-suggest serializers (`google-docs`, `github-md`).
2. Done: pre-flight intake helper prompt (`C-preflight`), separate from the chain.
3. Done: gold draft fixture `eval/claims-test/gold/agent-identity-draft/` with expected claim scores and sample suggestion packets.
4. Done: eval stub after `eval/threat-model/` (`schema.json`, `run_eval.py`). Closure stays false until a second fixture and a human review of packets.
5. Done: public page at `/assess/claims-test/` (owner ask, 18 Sep 2026).
6. Done: v1.0.4. A Track A shortcut that said "C-intake through C-report" plus a fetched 1.0.2 pack produced a draft-only Topic-Risk Inventory with no ATT ids. The shortcut now names C-attacks and requires a Published attack classes table even when the fetched pack is older or topics is empty.
7. Done: v1.0.5. Intake packet uses bracketed examples, lists github-md, and drops cosai_workstreams.
8. Optional: second industry or WS1–WS4 profile packs as pinned source sets.
9. Optional: streaming multimodal gold fixture from local `papers/streaming-multimodal-*.md` (gitignored).

---

## Writing bar

- University freshman grammar; no em dashes; no en dashes as separators.
- Prefer persona, layer, control, obligation, attestation.
- Name who does what, to which object, under what condition, with what evidence.
- Key takeaways must be non-obvious and testable.
- Future-work names concrete open problems, not generic emerging-tech language.

---

## Checklist for the next agent

- [x] Read this file, skim `/tools/prompts/threat-model/prompts.json` chain
      pattern, and `/assess/whitepaper-assessment/` for screen overlap.
- [x] Confirm task: (a) build `prompts.json`, (b) gold fixture, (c) site page.
- [x] Keep chain non-interactive; put all answers in intake.
- [x] Parameterize with dimension profile; do not fork the process per WS.
- [x] Emit Docs or PR suggestion packets from C-suggest, not only tables.
- [x] Tag GenAI / LLM / AI / ML / Agent; one accountable party per ROCA row.
- [ ] Do not commit gitignored `papers/*` unless asked.
- [x] Update this handoff when chain ids or intake fields change.

Chain ids: C-intake, C-claims, C-screen, C-foundations, C-attacks, C-inventory, C-tag,
C-roca, C-score, C-srf-join, C-srf-owner, C-srf-coverage, C-vertical-join,
C-vertical-route, C-qa, C-suggest, C-report, C-export-md, C-export-json.
Helpers: C-preflight. Baseline: C-zeroshot.
Path: `assess/claims-test/`, not `tools/prompts/claims-test/`.
