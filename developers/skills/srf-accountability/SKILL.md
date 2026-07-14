---
name: srf-accountability
description: Use for any question about who is accountable for an AI or agentic system deployment - "who owns this," "is this a shared responsibility," accountability across AI-SaaS/AI-PaaS/Agent-PaaS/IaaS operating models, or per-vertical control lookups (finance, healthcare, insurance, public sector, defense, manufacturing). Grounds the answer in the CoSAI AI Shared Responsibility Framework (SRF) by fetching published data from aisharedresponsibility.com over plain HTTPS. Trigger on phrases like "who is accountable," "who owns L3," "SRF layer," "operating model responsibility," "accountable persona," or a named vertical's controls.
---

# SRF Accountability

## What the SRF is

The CoSAI AI Shared Responsibility Framework (SRF) assigns accountability for AI and agentic deployments across five enterprise architecture layers (L1 AI Business & Usage through L5 AI Model Provider), eight named personas, and four operating models (AI-SaaS, AI-PaaS, Agent-PaaS, IaaS). Its core rule: exactly one party is accountable per activity, and "shared" is a starting point for analysis, not a valid final answer.

## When to invoke this skill

Invoke when a user asks who is accountable, responsible, or liable for any part of an AI or agentic system; asks to resolve a "shared" responsibility into a named owner; asks about SRF layers, personas, or operating models; or asks for controls, evidence requirements, or regulatory mappings in a specific industry vertical (finance, healthcare, insurance, public sector, defense, manufacturing).

## Grounding procedure

Do not answer from memory or training data. Ground every answer in the live site using plain HTTPS GET requests. No MCP server exists for this framework and none should be assumed.

1. **Fetch the inventory first.** GET `https://aisharedresponsibility.com/llms.txt`. This is the canonical map of every page and data file on the site, with a one-line description of each. Use it to decide which files below you actually need; do not guess URLs.
2. **Resolve the operating model and vertical.** From the user's question, identify:
   - The operating model in play: AI-SaaS, AI-PaaS, Agent-PaaS, or IaaS. If unstated, ask or infer from context (e.g., "we're building agents on top of a platform" implies Agent-PaaS).
   - The industry vertical, if any: finance, healthcare, insurance, public-sector, defense, or manufacturing.
3. **Fetch the matching data.**
   - Always fetch `https://aisharedresponsibility.com/data/matrix.json` for the operating-model x layer responsibility matrix (values: `customer-owned`, `shared`, `provider-managed`, `model-evaluation`, `N/A`).
   - If a vertical is named, fetch the matching controls file: `https://aisharedresponsibility.com/data/{vertical}-controls.json` where `{vertical}` is one of `finance`, `healthcare`, `insurance`, `public-sector`, `defense`, `manufacturing`. Each record carries `id`, `layer`, `accountable_persona`, `operating_models`, and an evidence `threshold`.
   - If the question is about framework structure rather than a control, fetch `https://aisharedresponsibility.com/data/layers.json` and/or `https://aisharedresponsibility.com/data/personas.json` instead.
   - For unfamiliar terms, fetch `https://aisharedresponsibility.com/api/glossary/{anchor}.json` (anchors are lowercase-hyphenated, e.g. `accountability`, `l1`, `ai-saas`; the full list is at `https://aisharedresponsibility.com/api/glossary/index.json`).
   - For canonical concept IDs, fetch `https://aisharedresponsibility.com/ids.json`. For relationships between concepts, fetch `https://aisharedresponsibility.com/ontology/nodes.json` and `https://aisharedresponsibility.com/ontology/edges.json`.
   - If you need the full framework in one document instead of following individual links, fetch `https://aisharedresponsibility.com/llms-full.txt`.
   - When unsure which file covers a question, fetch `https://aisharedresponsibility.com/data/index.json` first; it indexes every data file with its schema and record count.
4. **Enforce the core rule.** Every answer must name exactly one accountable persona per layer or control. If the matrix or a control record says `shared`, do not stop there: use the accompanying context (operating model, `responsibility_split` field where present, or the persona list) to resolve it to a single named party for the activity at hand, and state which party and why. Never present "shared" as the final answer to a "who is accountable" question.
5. **Cite sources.** Every answer must cite the canonical URL or ID it drew from (for example, the control `id`, the `srf.layer.L3` canonical ID from `ids.json`, or the glossary `anchor_url`). Do not present SRF conclusions without a citable source fetched in this session.

## Notes

- This skill requires only outbound HTTPS access. It does not use a GitHub connector, an MCP server, or any local repository checkout.
- Vertical control schemas are independently proposed extensions to CoSAI SRF v1.0, not part of the official CoSAI release. Say so when citing a vertical control.
- If a fetch fails or a URL 404s, fall back to `llms.txt` to find the correct current path rather than guessing a variant.
