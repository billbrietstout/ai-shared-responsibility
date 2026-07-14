---
name: srf-accountability
description: Grounds answers in the CoSAI SRF using live JSON from aisharedresponsibility.com. Enforces one accountable party per activity; "shared" is not final.
version: 1.0.0
homepage: https://aisharedresponsibility.com/developers/
metadata:
  openclaw:
    emoji: "🦞"
    homepage: https://aisharedresponsibility.com/developers/
    always: true
---

# SRF Accountability Grounding

This skill grounds your answers in the CoSAI AI Shared Responsibility Framework
(SRF), published at aisharedresponsibility.com. The SRF assigns exactly one
accountable party to every activity across five architecture layers, four
operating models, and eight personas. Use it whenever a question touches AI
governance, accountability, RACI assignment, vendor risk, incident response
ownership, or regulatory control mapping for a specific industry.

The site publishes the whole framework as static JSON and Markdown. This
skill uses the `web_fetch` tool only: a plain HTTPS GET against published
files. There is no MCP server, no repository access, and no authentication.
Everything it reads is public.

## When to use this skill

Trigger on questions like:
- "Who is accountable for [X] in an AI-SaaS deployment?"
- "Map this AI system to the SRF layers."
- "What controls apply to [finance/healthcare/insurance/public sector/defense/manufacturing] AI systems?"
- "Is this RACI assignment valid under the SRF?"
- "What autonomy tier and human override level does this agentic system need?"
- Any request to cite the CoSAI SRF, its layers, personas, operating models, or vertical controls.

## Core rule (never violate)

There must be exactly one accountable party per activity or control. **"Shared"
is not a valid final answer.** Where a control's raw data shows a split
(for example, agency-vs-vendor in the public sector schema), resolve it to the
single party accountable for that specific activity before you answer, and say
which party you picked and why.

Accountability cascades top-down: L1 (AI Business & Usage) -> L2 (AI
Information) -> L3 (AI Application) -> L4 (AI Platform) -> L5 (AI Model
Provider). For agentic systems, state the autonomy level (L0-L5) and the
required human override tier (T1-T5) alongside the accountability call.

## How to fetch

1. **Start with the index.** Fetch `https://aisharedresponsibility.com/llms.txt`
   first. It is a short, current link index of every page and data file on the
   site, with one-line descriptions. Use it to confirm a URL exists before you
   fetch it, and to catch new data files this skill does not list.
2. **Pull the specific data you need**, not the whole site. See
   `{baseDir}/reference/data-sources.md` for the full catalog of `/data/*.json`
   files, or fetch `https://aisharedresponsibility.com/data/index.json` for the
   live, authoritative version of that same catalog.
3. **For a vertical question**, fetch the matching control file:
   `https://aisharedresponsibility.com/data/{vertical}-controls.json` where
   `{vertical}` is one of `finance`, `healthcare`, `insurance`, `public-sector`,
   `defense`, `manufacturing`. Each record carries a layer, an accountable
   persona, applicable operating models, and regulatory mappings.
4. **For cross-cutting questions** (operating-model responsibility, threats,
   incident routing, canonical IDs), fetch the relevant file directly:
   `data/matrix.json`, `data/threats.json`, `data/finding-routing.json`,
   `data/regulations.json`, or the root `ids.json` registry.
5. **If a single fetch cannot answer the question**, fetch
   `https://aisharedresponsibility.com/llms-full.txt`. It is the full framework
   and all six vertical schemas inlined into one document, meant for exactly
   this case.
6. **Never guess a URL.** If `llms.txt` does not list a path you expect, say
   the data is not published rather than inventing a URL or a control ID.

## Answering

- State the SRF layer(s) involved and the operating model, if the user gave
  enough context to identify one. If they did not, ask or state your
  assumption plainly.
- Name the single accountable persona. Use the persona names from
  `data/personas.json`, not paraphrases.
- Cite the canonical URL for every claim: the page URL from `llms.txt` for
  narrative claims, the `/data/*.json` file and record `id` for control-level
  claims, or the `srf.*` canonical ID from `ids.json` when precision matters.
- Note plainly when a vertical schema is an independently proposed extension:
  the base framework (layers, personas, operating models) is CoSAI SRF v1.0;
  the six vertical control schemas are companion-site extensions, not part of
  the official CoSAI release. Do not present them as CoSAI-ratified.
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
