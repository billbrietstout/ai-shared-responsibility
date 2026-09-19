# Handoff: aisharedresponsibility.com → Cursor Project

**Date:** 17 September 2026
**Live site:** https://aisharedresponsibility.com
**GitHub:** https://github.com/billbrietstout/ai-shared-responsibility
**Local workspace:** `/Users/billstout/Documents/Claude/Projects/AISharedResponsibility.com`
**HEAD:** `62db22c` on `main` (same SHA as `origin/main`, `origin/develop`)
**Working tree:** clean. No stash.

This file is the current-state packet for a Cursor Project coordinator. Read it before planning or delegating. Prefer live data over numbers remembered from older chats.

---

## Goal

Keep the published CoSAI AI Shared Responsibility Framework (SRF) v1.0 reference site accurate, machine-readable, and usable by humans and agents. New work either clarifies v1.0 or is labeled as an independently proposed companion extension. The site answers who is accountable for each activity. It does not invent attack techniques, control catalogs, severity scores, or regulation.

Core rule: exactly one accountable party per activity. "Shared" is a starting point for analysis, not a valid final answer.

---

## What is already done (do not rebuild)

Static site. No bundler. No runtime network for fonts, analytics, or CDN scripts. Serve the repo root. Pages work without JavaScript; JS adds interactivity.

### Framework (CoSAI SRF v1.0)

- Five layers L1 to L5 (`data/layers.json`)
- Eight personas (`data/personas.json`) plus sector specializations
- Four operating models: AI-SaaS, AI-PaaS, Agent-PaaS, IaaS (`data/matrix.json`)
- Autonomy L0 to L5 and override T1 to T5 (paper Appendix A.1.3; site glossary and homepage lede)
- L5 is the model-artifact supply chain (Models, Training, Model Supply Chain). Enterprise TPRM for all vendor categories sits at L1.

### Vertical control schemas (independently proposed; not CoSAI-endorsed)

Live hubs plus controls and how-to pages. Trust `data/index.json` `record_count` over this table if they diverge.

| Vertical | Controls file | Typical count |
|---|---|---|
| Finance | `data/finance-controls.json` | 40 |
| Healthcare | `data/healthcare-controls.json` | 40 |
| Insurance | `data/insurance-controls.json` | 40 |
| Public sector | `data/public-sector-controls.json` | 40 |
| Defense | `data/defense-controls.json` | 53 |
| Manufacturing | `data/manufacturing-controls.json` | 45 |
| Tapestry | `data/tapestry-controls.json` | 26 |

Tapestry adds Federated-Consortium plus personas `sovereign-participant-node` and `consortium-core-coordinator`. Proposed companion; not CoSAI-ratified.

Root files `*-vertical-handoff.md` and `tranche*-handoff.md` are historical build briefs. Verticals they describe are live. Do not restart those programs from those files.

### Companion agentic extensions (shipped 9 September 2026)

Register: `data/srf-vnext-extensions.json`. Page: `/papers/srf-vnext-agentic-extensions/`. Banner on every new surface: independently proposed; not CoSAI SRF v1.0; not CoSAI-endorsed.

Nine asks for a future CoSAI paper: accountability continuity, spawn/replication, fail-closed halt, persistence scope, enforcement-plane declaration, protocol-independent evidence, owner vs halt-authority coverage, spend ceiling as halt, control-plane location. Site copy, glossary terms, vendor-risk questions, threshold schema optional fields, and AI SAFE² on `/compare/` already carry these. Do not re-implement.

Refused brands and scales (do not import): A0 to A6, SAFE² ACT-1 to ACT-4, AISM Chaos-to-Sovereignty, HEAR, Control Envelope as an SRF object.

### Practitioner tools already on the site

- Whitepaper assessment prompt v2.2 at `/assess/whitepaper-assessment/` (intake first; slim catalogs; Novel is a map result)
- Draft claims-test pack v1.0.1 at `/assess/claims-test/` (ROCA + Docs/PR suggestion packets; cousin of whitepaper assessment, not a merge). Pack load is fetch or attach `prompts.json`; citation URLs stay pinned.
- Threat-model prompt pack v3 at `/tools/prompts/threat-model/` with gold eval under `eval/threat-model/`
- Vendor-risk questionnaire, regulation discovery, controls assessment, IR playbooks, NICE mapping, security-lifecycle page
- [un]prompted October 2026 deck at `/presentation/unprompted-oct2026/`. May 2026 TSC deck removed; `/presentation/` redirects.
- NIST AI RMF static RAG demo at `/nist-ai-rmf/` (not official NIST). SP 800-53 Rev 5 is an opt-in sibling corpus. Isolate from the SRF knowledge graph and from the unlinked TACIP orphan at `/nist/`.
- Agent skills at `/developers/skills/`: `srf-accountability` (fetch live HTTPS data) and optional `openclaw-srf`.

### Knowledge layer and CI

Generated JSON in `glossary.json`, `api/glossary/`, `ontology/`, `ids.json`, `export/`. Sources of truth are HTML glossary anchors and `data/*.json`. CI: `.github/workflows/verify.yml` on push to `main`/`develop` and on PRs. Drift gate regenerates and fails if committed files differ.

OpenCRE export files exist (`export/opencre-srf.json`, `export/opencre-srf.csv`, `opencre-binding-proposal.md`). CRE links are proposals from 12 July 2026, not published OpenCRE mappings.

---

## Recent git history (what changed)

Latest commit on `main`:

```
62db22c Complete SRF accountability skills and correct live-data grounding.
```

Immediately before that: metadata-drift clear, Data & agents routing, publication-look CSS (self-hosted type, Claude chrome stripped), companion agentic extensions, whitepaper assessment v2.2 (PR #28), L5 vs L1 TPRM split, MOSAIC spreadsheet inclusion pass, [un]prompted deck, DSGAI identifiers on `data/threats.json`.

Local leftover: branch `cursor/whitepaper-assessment-v2.2` is one checkpoint commit ahead of its remote (`8811e71`). The feature already merged. Ignore that branch unless recovering a discarded edit.

---

## How this state was verified (17 September 2026)

- `git status` empty; `git stash list` empty
- `main`, `origin/main`, `origin/develop` at `62db22c`
- No open GitHub PRs
- One open issue: [#8 ARA source suggestion](https://github.com/billbrietstout/ai-shared-responsibility/issues/8)
- Local agent transcripts surveyed (29 workspace chats). This transfer chat did not change product code.

---

## How to build, serve, and test

Serve (no compile):

```bash
python3 -m http.server 8080
```

Asset paths are root-relative. Open `http://localhost:8080`.

After glossary or `data/*.json` edits that feed the ontology:

```bash
python3 build/generate_knowledge_layer.py
python3 build/verify_knowledge_layer.py
python3 build/inject_page_metadata.py
python3 build/inject_chunk_markers.py
python3 build/verify_pages.py
```

Commit generated JSON in the same change as the source edit. Do not hand-edit generated files.

If a `data/*-controls.json` file changes, also run `python3 build/sync_llms_full.py` and `python3 build/generate_oscal_verticals.py` (UUIDs are uuid5; clean reruns leave the tree clean).

If the agentic principle source table changes: `python3 build/generate_principle_catalogs.py`.

Always hand-update: `changelog/index.html`, `data/index.json` (`updated` and new file entries), `llms.txt`, `sitemap.xml`, and `llm:concepts` meta on edited pages.

UI changes: exercise the changed route in a browser, plus every other route that reads the same JSON or component. A screenshot is not verification.

Threat-model eval (no model required for gold echo):

```
python3 eval/threat-model/run_eval.py --write-gold-echo
python3 eval/threat-model/run_eval.py --pred eval/threat-model/runs/gold-echo
```

Claims-test eval (no model required for gold echo):

```
python3 eval/claims-test/run_eval.py --write-gold-echo
python3 eval/claims-test/run_eval.py --pred eval/claims-test/runs/gold-echo
```

A claim that Track A beats zero-shot stays false until SME sheets in `eval/threat-model/sme/` exist. `run_compare.py` keeps `closure` false until then.

---

## What not to change

- CoSAI SRF v1.0 identity: five layers, eight personas, four operating models, one-party rule, L0 to L5, T1 to T5
- Homepage H1, CoSAI name, and "who is accountable." Do not put AGI, superintelligence, or existential-risk language on `/`
- `data/matrix.json` cell values unless CoSAI publishes a matrix revision. Companion dimensions live in `data/srf-vnext-extensions.json`
- AITF namespaces. Telemetry work proposes only binding gaps. See `.cursor/rules/aitf.mdc` (local-only; contents summarized below)
- Ingesting AI SAFE²'s control text (dual MIT + CC-BY-SA). Cite and paraphrase. Do not add SAFE² as a 53rd corpus source
- Merging AGI Risk / Redwood into this site
- Runtime fetch of third-party scripts or fonts
- A sixth architecture layer
- New top-level product brands (HEAR, Control Envelope, AISM, ACT tiers)
- Invented regulation IDs. TBD is allowed; fake citations are not
- Treating Federated-Consortium or vertical schemas as CoSAI-ratified

Lane: the SRF names who authorizes, who owns the result, and who signs residual risk. BIML / OWASP / ATLAS / NIST own threats. CIS / CSA AICM / AI Exchange own control content. AIVSS owns severity.

---

## Open work (next Project tasks)

Prioritize with the owner. None of these are in-flight in git.

1. **GitHub issue #8: Agent Runtime Assurance (ARA).** CC BY 4.0, DOI 10.5281/zenodo.21571732. Owner comment: plausible L3/application-layer draft reference. Decide include vs decline against the agentic corpus bar (published/adopted vs proposed draft). If included, add to the source table and regenerate principle catalogs; if declined, close the issue with the bar stated.

2. **OpenCRE maintainer session.** Binding files are generated. Three proposed CRE anchors (225-553, 663-200, 803-457) are unverified with OpenCRE maintainers. Principle `related` links still say CRE-ID mapping is not done. This is outreach plus a format check, not more local JSON.

3. **Threat-model SME eval.** Gold fixtures and scorers exist. Closure needs two reviewers per system filling `eval/threat-model/sme/` templates, then Hamming loss via `labels/expert-corrections.json`.

4. **Telemetry draft publish-or-hold.** Local working draft: `papers/what-new-telemetry-agents-need.md` (gitignored with other `papers/*`). Thesis: AITF is the baseline; propose SRF persona/layer attrs, T1 to T5 oversight events, erasure-compatible evidence, feedback spans, actuation events. Protocol-independent evidence is already a vnext ask. Publishing requires a `papers/` gitignore exception like the vnext paper.

5. **Draft whitepaper claims-test pack.** Shipped at `/assess/claims-test/` (prompts.json, page, gold fixture, eval stub). v1.0.1 allows fetch or attach of `prompts.json`; citation URLs stay pinned. Design notes remain in `whitepaper-claims-test-handoff.md`. Do not merge with `/assess/whitepaper-assessment/`. Second industry or WS1–WS4 profile packs are optional follow-on.

6. **Gardening.** Regulation `last_verified` older than 180 days shows Verify on `/regulations/`. Follow PRs and CI on `main`/`develop`.

Do not revive ChatGPT architecture plans that this repo already refused (A0 to A6, homepage rebrand, `/autonomous-ai`, Control Envelope). The executed keep-list is in `~/.cursor/plans/handoff_plan_assessment_a081c39b.plan.md` (local Cursor plan; all todos completed).

---

## Files a cloud clone will miss

`.gitignore` excludes `.cursor/`, `CLAUDE.md`, and `papers/*` except `papers/srf-vnext-agentic-extensions*`. Cloud agents that clone GitHub will not see:

| Path | Why it matters |
|---|---|
| `.cursor/rules/aitf.mdc` | AITF is the telemetry baseline; do not re-propose its namespaces |
| `papers/what-new-telemetry-agents-need.md` | Telemetry draft |
| `papers/netflix-multimodal-*.md`, `papers/streaming-multimodal-*.md`, `papers/taxonomy-claim-test.md` | 13 to 14 Sep 2026 research |
| Local canvases under `~/.cursor/projects/.../canvases/` | Taxonomy scoring, MOSAIC inclusion, whitepaper grades |

Copy this `HANDOFF.md` into the Project's Context tab (or commit it to GitHub) so cloud agents have the constraints.

---

## Writing and labeling

University-freshman grammar. No em dashes. No en dashes as separators. Prefer SRF nouns already on the site: persona, layer, control, obligation, attestation, autonomy level, override tier.

Banned as filler: delve, leverage, robust, seamless, holistic, landscape, ecosystem, end-to-end, foster, empower, "best practices" without a citation.

Companion copy must say independently proposed and not part of CoSAI SRF v1.0. Matrix cells need the concrete obligation, not the status word alone.

Key-takeaway bullets must be testable claims a reader could not predict from the table of contents.

When adding principles, check `security_principles_reference.oscal.json` and `related` links before treating a principle as novel. AI/agentic principles live in the companion catalog, published as `data/ai-agentic-principles.json`.

---

## Agent skills and live grounding

For accountability answers, follow `developers/skills/srf-accountability/SKILL.md`:

1. GET https://aisharedresponsibility.com/llms.txt
2. If needed, GET https://aisharedresponsibility.com/data/index.json and use those `record_count` values
3. Fetch the matching JSON (`matrix.json`, `{vertical}-controls.json`, `vendor-risk.json`, `threats.json`, glossary `api/glossary/{anchor}.json`). Anchors are case-sensitive.

Do not answer SRF lookups from training memory.

---

## Suggested Project setup

- **Workspace:** GitHub repo `billbrietstout/ai-shared-responsibility` (same tree as this folder)
- **Default branch for PRs:** `develop`, then merge to `main` when the owner asks. Both currently match.
- **Context files:** this `HANDOFF.md`; later add `ARCHITECTURE.md` and `build/README.md` if agents keep missing the generate/verify loop
- **Subscriptions to offer the owner:** PRs on this repo; CI on `main` and `develop`; a weekly regulation-staleness check
- **Local agents:** required for browser verification of UI. Cloud agents can edit JSON/HTML and run the Python verifiers.

Coordinator: plan and delegate. Do not rewrite v1.0. Start with issue #8 or the owner's next content ask.

---

## Local chat record (optional deep dive)

Workspace transcripts live under `~/.cursor/projects/Users-billstout-Documents-Claude-Projects-AISharedResponsibility-com/agent-transcripts/`. Useful recent threads:

| Period | Topic |
|---|---|
| 15 Sep 2026 | Whitepaper-assessment prompt grade; multimodal M interoperability |
| 13 to 14 Sep 2026 | Netflix/streaming multimodal inventory and taxonomy claim test |
| 13 Sep 2026 | Publication-look CSS; commit to `main` and `develop` |
| 9 Sep 2026 | ChatGPT handoff assessed; companion extensions shipped instead of a rebrand |
| Aug 2026 | [un]prompted deck, threat-model pack v3, CoSAI PDF URL, DSGAI mapping, MOSAIC inclusion |
| Aug 2026 | NIST AI RMF static RAG demo |

Cite a thread to the owner as a Cursor conversation title plus id, not by dumping JSONL into the Project.
