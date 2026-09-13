---
name: srf-accountability
description: Grounds answers in the CoSAI SRF using live JSON from aisharedresponsibility.com. Enforces one accountable party per activity; "shared" is not final. Covers core operating models plus proposed Federated-Consortium/Tapestry, vertical controls, vendor risk, threats, and finding routing.
version: 1.1.0
homepage: https://aisharedresponsibility.com/developers/skills/
metadata:
  openclaw:
    homepage: https://aisharedresponsibility.com/developers/skills/
---

# SRF Accountability Grounding

This skill grounds your answers in the CoSAI AI Shared Responsibility Framework
(SRF), published at aisharedresponsibility.com. The SRF assigns exactly one
accountable party to every activity across five architecture layers, eight
personas, and four CoSAI-core operating models (AI-SaaS, AI-PaaS, Agent-PaaS,
IaaS). Use it whenever a question touches AI governance, accountability, RACI
assignment, vendor risk, threat or finding ownership, incident response
ownership, or regulatory control mapping for a specific industry.

A fifth operating model, Federated-Consortium, and the Tapestry control schema
are proposed companion-site extensions. Use them when the user asks about
federated consortium / Project Tapestry deployments, and say they are not
CoSAI-ratified.

The site publishes the framework as static JSON and Markdown. This skill uses
the `web_fetch` tool only: a plain HTTPS GET against published files. There is
no MCP server, no repository access, and no authentication. Everything it reads
is public.

This skill is opt-in. Load it when the question matches the triggers below; do
not inject it into unrelated turns.

## When to use this skill

Trigger on questions like:
- "Who is accountable for [X] in an AI-SaaS deployment?"
- "Map this AI system to the SRF layers."
- "What controls apply to [finance/healthcare/insurance/public sector/defense/manufacturing] AI systems?"
- "Who owns this under a Federated-Consortium / Tapestry model?"
- "Is this RACI assignment valid under the SRF?"
- "What autonomy tier and human override level does this agentic system need?"
- "Which persona owns this threat / vendor category / scored finding?"
- Any request to cite the CoSAI SRF, its layers, personas, operating models, or vertical controls.

## Core rule (never violate)

There must be exactly one accountable party per activity or control. "Shared"
is not a valid final answer. Where a control's raw data shows a split (for
example, agency-vs-vendor in the public sector schema), resolve it to the
single party accountable for that specific activity before you answer, and say
which party you picked and why.

Accountability cascades top-down: L1 (AI Business & Usage) -> L2 (AI
Information) -> L3 (AI Application) -> L4 (AI Platform) -> L5 (AI Model
Provider). For agentic systems, state the autonomy level (L0-L5) and the
required human override tier (T1-T5) alongside the accountability call.

## How to fetch

1. **Start with the index.** Fetch `https://aisharedresponsibility.com/llms.txt`
   first. Confirm a URL exists before you fetch it, and catch new data files
   this skill does not list.
2. **Pull the specific data you need**, not the whole site. See
   `{baseDir}/reference/data-sources.md` for the catalog, or fetch
   `https://aisharedresponsibility.com/data/index.json` for the live
   authoritative catalog and record counts. If this skill and the live index
   disagree, the live site wins.
3. **Always fetch the matrix** when answering accountability questions:
   `https://aisharedresponsibility.com/data/matrix.json`. Read each model's
   `parties` and cell values. CoSAI-core values include `customer-owned`,
   `shared`, `provider-managed`, `model-evaluation`, and `N/A`.
   Federated-Consortium uses `participant-owned` and `commons-governed`.
4. **For a vertical question**, fetch
   `https://aisharedresponsibility.com/data/{vertical}-controls.json` where
   `{vertical}` is one of `finance`, `healthcare`, `insurance`,
   `public-sector`, `defense`, `manufacturing`. For Tapestry / federated
   consortium controls, fetch `data/tapestry-controls.json`.
5. **For cross-cutting questions**, fetch as needed:
   `data/vendor-risk.json`, `data/threats.json`, `data/finding-routing.json`,
   `data/threat-sources.json`, `data/regulations.json`,
   `data/jurisdictions.json`, `data/layers.json`, `data/personas.json`,
   root `ids.json`, `ontology/nodes.json`, `ontology/edges.json`.
6. **Glossary lookups** use case-sensitive anchors that match published
   filenames, for example
   `https://aisharedresponsibility.com/api/glossary/L1.json` and
   `.../AI-SaaS.json`. List anchors at
   `https://aisharedresponsibility.com/api/glossary/index.json`.
7. **Join rules** live at
   `https://aisharedresponsibility.com/developers/schema/`. Prefer ontology
   edges over re-deriving associations. Control short IDs collide across
   verticals; cite `srf.control.<vertical>.<id>`.
8. **If a single fetch cannot answer the question**, fetch
   `https://aisharedresponsibility.com/llms-full.txt`.
9. **Never guess a URL.** If `llms.txt` does not list a path you expect, say
   the data is not published rather than inventing a URL or a control ID.

## Answering

- State the SRF layer(s) involved and the operating model, if the user gave
  enough context to identify one. If they did not, ask or state your
  assumption plainly.
- Name the single accountable persona (or Federated-Consortium party). Use
  names from `data/personas.json` or the matrix `parties` field, not
  paraphrases.
- Cite the canonical URL for every claim: the page URL from `llms.txt` for
  narrative claims, the `/data/*.json` file and record `id` for control-level
  claims, or the `srf.*` canonical ID from `ids.json` when precision matters.
- Note plainly when material is a companion-site extension: six industry
  vertical schemas, Federated-Consortium / Tapestry, and related proposed
  asks are not CoSAI SRF v1.0. Do not present them as CoSAI-ratified.
- If the framework does not resolve a question, say so. Do not invent an
  accountability assignment the data does not support.

## Limits

- Read-only. This skill never writes to the site, opens a pull request, or
  authenticates against anything. It has no path to the source repository.
- Static snapshot. Fetched JSON reflects whatever is published at fetch time;
  re-fetch rather than relying on a cached answer from earlier in a long
  session.
- No MCP server is involved. Every reference above is a direct HTTPS URL any
  OpenClaw agent with `web_fetch` enabled (the default) can retrieve.
