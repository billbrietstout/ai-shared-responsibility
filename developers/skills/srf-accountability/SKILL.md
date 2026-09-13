---
name: srf-accountability
description: Use for any question about who is accountable for an AI or agentic system deployment - "who owns this," "is this a shared responsibility," accountability across AI-SaaS/AI-PaaS/Agent-PaaS/IaaS (and the proposed Federated-Consortium model), or per-vertical control lookups (finance, healthcare, insurance, public sector, defense, manufacturing, Tapestry). Also trigger for vendor-risk splits, threat-to-layer mapping, finding routing, and SRF glossary or canonical-ID lookups. Grounds the answer in the CoSAI AI Shared Responsibility Framework (SRF) by fetching published data from aisharedresponsibility.com over plain HTTPS.
---

# SRF Accountability

## What the SRF is

The CoSAI AI Shared Responsibility Framework (SRF) assigns accountability for AI
and agentic deployments across five enterprise architecture layers (L1 AI
Business & Usage through L5 AI Model Provider), eight named personas, and four
CoSAI-core operating models (AI-SaaS, AI-PaaS, Agent-PaaS, IaaS).

A fifth operating model, Federated-Consortium, appears in `data/matrix.json` as a
proposed companion-site extension (Project Tapestry). It uses peer parties
(`participant-owned`, `commons-governed`) rather than customer/provider. Do not
treat it as CoSAI-ratified.

Core rule: exactly one party is accountable per activity. "Shared" is a starting
point for analysis, not a valid final answer.

## When to invoke this skill

Invoke when a user asks who is accountable, responsible, or liable for any part
of an AI or agentic system; asks to resolve a "shared" responsibility into a
named owner; asks about SRF layers, personas, or operating models; asks for
controls, evidence requirements, or regulatory mappings in a named industry
vertical; asks about vendor-vs-customer risk splits; asks which layer or persona
owns a threat or scored finding; or asks for an SRF glossary definition or
canonical ID.

## Grounding procedure

Do not answer from memory or training data. Ground every answer in the live site
using plain HTTPS GET requests. No MCP server exists for this framework and none
should be assumed.

1. **Fetch the inventory first.** GET
   `https://aisharedresponsibility.com/llms.txt`. This is the canonical map of
   every page and data file on the site. Use it to decide which files you need;
   do not guess URLs.
2. **When unsure which data file applies**, fetch
   `https://aisharedresponsibility.com/data/index.json`. It indexes every data
   file with schema notes and record counts. Prefer those counts over any number
   remembered from this skill.
3. **Resolve the operating model and vertical.** From the user's question,
   identify:
   - Operating model: AI-SaaS, AI-PaaS, Agent-PaaS, IaaS, or Federated-Consortium
     (proposed). If unstated, ask or infer from context and state the assumption.
   - Industry vertical, if any: `finance`, `healthcare`, `insurance`,
     `public-sector`, `defense`, `manufacturing`. For Project Tapestry /
     federated consortium controls, use `tapestry-controls.json`.
4. **Fetch the matching data.**
   - Always fetch `https://aisharedresponsibility.com/data/matrix.json` for the
     operating-model × layer responsibility matrix. CoSAI-core cell values include
     `customer-owned`, `shared`, `provider-managed`, `model-evaluation`, and
     `N/A`. Federated-Consortium cells use `participant-owned` and
     `commons-governed`. Read party labels from each model's `parties` field.
   - Vertical controls:
     `https://aisharedresponsibility.com/data/{vertical}-controls.json` where
     `{vertical}` is one of `finance`, `healthcare`, `insurance`,
     `public-sector`, `defense`, `manufacturing`. Each record carries `id`,
     `layer`, `accountable_persona`, operating-model applicability, and evidence
     threshold fields. Public-sector and defense records may include a
     `responsibility_split`; resolve it to one accountable party before answering.
   - Tapestry / Federated-Consortium controls:
     `https://aisharedresponsibility.com/data/tapestry-controls.json`.
   - Framework structure: `data/layers.json` and `data/personas.json`.
   - Vendor risk: `https://aisharedresponsibility.com/data/vendor-risk.json`.
   - Threat-to-accountability crosswalk:
     `https://aisharedresponsibility.com/data/threats.json`.
   - Finding routing after a scored finding:
     `https://aisharedresponsibility.com/data/finding-routing.json`.
   - Regulations and jurisdictions: `data/regulations.json`,
     `data/jurisdictions.json`. Before citing an instrument, read `lifecycle`
     and follow `superseded_by` when present.
   - Glossary terms: fetch
     `https://aisharedresponsibility.com/api/glossary/{anchor}.json`. Anchors are
     **case-sensitive** and match the published filenames. Examples:
     `accountability`, `L1`, `L3`, `AI-SaaS`, `Agent-PaaS`, `IaaS`,
     `operating-model`, `human-override-tier`. List every anchor via
     `https://aisharedresponsibility.com/api/glossary/index.json`. Do not
     lowercase layer or operating-model anchors.
   - Canonical IDs and graph: `https://aisharedresponsibility.com/ids.json`,
     `ontology/nodes.json`, `ontology/edges.json`. Prefer edges over re-deriving
     joins. Join conventions:
     `https://aisharedresponsibility.com/developers/schema/`.
   - Control short IDs such as `SRF-L1-ACQ-001` collide across verticals. Cite
     `srf.control.<vertical>.<id>`.
   - One-shot dump when many files are required:
     `https://aisharedresponsibility.com/llms-full.txt`.
5. **Enforce the core rule.** Every answer must name exactly one accountable
   persona (or one Federated-Consortium party) per activity. If the matrix or a
   control record says `shared`, resolve it using operating model,
   `responsibility_split` when present, and the persona list; state which party
   and why. Never present "shared" as the final answer to a "who is accountable"
   question.
6. **Cite sources.** Cite the canonical URL or ID used in this session (control
   `id`, `srf.layer.L3` from `ids.json`, glossary `anchor_url`, and so on). Do
   not present SRF conclusions without a citable fetch from this session.

## Notes

- Outbound HTTPS only. No GitHub connector, MCP server, or local repository.
- Vertical control schemas and Federated-Consortium / Tapestry material are
  independently proposed companion-site extensions, not part of official CoSAI
  SRF v1.0. Say so when citing them.
- If a fetch fails or 404s, return to `llms.txt` (then `data/index.json`) rather
  than guessing a variant URL.
- For agentic systems, state autonomy level (L0-L5) and human override tier
  (T1-T5) alongside the accountability call when the question involves agents.
