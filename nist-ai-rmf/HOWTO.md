# HOWTO: Query the NIST AI RMF static demo with an LLM

Demo home: https://aisharedresponsibility.com/nist-ai-rmf/  
Discovery index: https://aisharedresponsibility.com/nist-ai-rmf/llms.txt  

**Not official NIST output.** Cite https://doi.org/10.6028/NIST.AI.100-1 and https://doi.org/10.6028/NIST.AI.600-1 for normative use. NIST.AI.600-1 supplements NIST.AI.100-1; it does not replace it.

## What this demonstrates

The demo is a working package for NIST collaboration discussions: how AI RMF / GenAI Profile text can be published for both people and HTTP-only agents, with section-level citations, without standing up a ranking API.

- **Dual-readable sources.** Clean Markdown under `sources/` keeps heading hierarchy and stable anchors so a human or model can quote a subcategory by path, then confirm against the official DOI/PDF.
- **Static hybrid retrieval.** Chunks, BM25 stats, and dense vectors ship as files under `data/`. The browser loads them and ranks with BM25 + dense fusion (reciprocal rank fusion). No server-side ranker and no API keys.
- **Citation-first answers.** Hits expose `doc_id`, `section_path`, and a link into the source Markdown. Open the cited section and check it; fused scores are ranking hints only.
- **Two consumer paths.** Humans use the page form. Agents that only HTTP-fetch use `llms.txt` for discovery, `retrieve/*.json` for fixed demo scenarios, or `data/chunks.json` to rank locally. Ranking and discovery stay separate artifacts.
- **Corpus isolation.** IDs and files for the AI RMF demo do not merge into the CoSAI SRF graph. SP 800-53 Rev 5 lives under `sp800-53/` as a separate opt-in corpus and is not blended into default AI RMF ranking.

It does not demonstrate official NIST packaging, a complete NIST corpus (full PDFs, sector profiles, or COSAiS overlays), production retrieval quality for every question, or safe use of assistant output on operational or OT systems. Before any operational use, verify citations and read [Assistant and OT risks](https://aisharedresponsibility.com/nist-ai-rmf/#assistant-ot-risks).

Page section: https://aisharedresponsibility.com/nist-ai-rmf/#what-this-demonstrates

## llms.txt vs RAG

| Artifact | Role |
|----------|------|
| `llms.txt` | Map of URLs and rules. Start here. |
| `sources/*.md` / `llms-full.txt` | Authoritative demo text for quotes. |
| Browser form on `/nist-ai-rmf/` | Human RAG UI (JS ranking in the browser). |
| `retrieve/*.json` | Precomputed ranked JSON for demo scenarios (plain HTTP). |
| `data/chunks.json` | Full corpus for local ranking of arbitrary queries. |

`?format=json` on the HTML page is browser debug only. A plain GET returns HTML until JavaScript runs. Prefer `retrieve/*.json` or `data/chunks.json`.

## Architecture (short)

1. Markdown sources with stable section anchors.  
2. Offline chunking + BM25 + dense vectors into `data/`.  
3. Browser loads `data/` and ranks (BM25 + dense, RRF).  
4. `export_scenarios.py` writes the same ranked-result JSON fields as the browser UI to `retrieve/<slug>.json` for agents.
5. Opt-in SP 800-53 corpus: `ingest_sp80053.py` + `build_index.py --data-dir nist-ai-rmf/sp800-53/data` (loaded only when Document = SP 800-53).

## Example prompts

### A. Scenario with discovery + retrieve JSON

```
You are answering from the NIST AI RMF static demo at https://aisharedresponsibility.com/nist-ai-rmf/.
Not official NIST output. Cite section_path and official DOIs for normative claims.
NIST.AI.600-1 supplements NIST.AI.100-1; it does not replace it.

1. Fetch https://aisharedresponsibility.com/nist-ai-rmf/llms.txt
2. For this scenario, fetch the matching retrieve JSON if listed; otherwise fetch data/chunks.json and select the best sections.
3. Answer only from cited sections. Quote sparingly. Name doc_id, section_path, and anchor.
4. If base RMF and GenAI Profile both apply, say so.

Scenario: What policies cover human-AI configurations and oversight of AI systems?
```

### B. Confabulation (fixed scenario file)

```
Fetch https://aisharedresponsibility.com/nist-ai-rmf/retrieve/confabulation.json
Summarize the top three matched_chunks with their section_path and scores.
Then open the top citation's source Markdown and confirm the definition of confabulation in your own words.
```

### C. Supply chain from chunks

```
Fetch https://aisharedresponsibility.com/nist-ai-rmf/llms.txt and https://aisharedresponsibility.com/nist-ai-rmf/data/chunks.json
Find chunks about third-party / supply-chain AI risk (GOVERN 6 or related GenAI actions).
Return a short checklist of obligations with citations. Prefer base RMF for general third-party policy; add GenAI Profile actions only when they add GAI-specific steps.
```

### D. Authoritative Markdown only

```
Using only https://aisharedresponsibility.com/nist-ai-rmf/sources/nist-ai-100-1.md
(and llms.txt if you need navigation), explain MEASURE 2.7 (security and resilience).
Do not invent control IDs. If the section is missing, say so.
```

## Precomputed scenario URLs

- https://aisharedresponsibility.com/nist-ai-rmf/retrieve/index.json
- https://aisharedresponsibility.com/nist-ai-rmf/retrieve/human-oversight.json
- https://aisharedresponsibility.com/nist-ai-rmf/retrieve/confabulation.json
- https://aisharedresponsibility.com/nist-ai-rmf/retrieve/govern-inventory.json
- https://aisharedresponsibility.com/nist-ai-rmf/retrieve/supply-chain.json
- https://aisharedresponsibility.com/nist-ai-rmf/retrieve/prompt-injection.json

## Risks: general-purpose assistants and operational impact

A chat assistant that “only reads documentation” is often treated as lower risk than a model wired into an OT controller, PLC, SCADA setpoints, or plant safety system. The low-risk label fails when assistant output drives what a human or another automation path actually deploys.

An error in assistant output can have the same operational impact as connecting an assistant to OT control if that output becomes configuration, code, a procedure, or a diagnosis that changes how a system runs. The assistant answered in text; a person or pipeline still applied the change.

### Direct paths into operations

- Generating configuration files, firewall rules, historian queries, or deployment manifests “from” AI RMF or GenAI Profile language.
- Generating automation scripts, runbooks, or infrastructure-as-code that someone applies to AI platforms that touch plant or field systems.
- Drafting allow-lists, kill-switch logic, or human-override policies that get pasted into production without independent review.

### Second-order paths (still operational)

- Helping someone select, size, or configure an OT-adjacent AI product (vendor choice, autonomy tier, data paths, network placement).
- Diagnosing an incident or performance issue and recommending parameter changes, model swaps, or sensor overrides.
- Summarizing “OT-actionable” documentation into steps a technician executes under time pressure.
- Producing evidence or attestation language that makes a risky deployment look reviewed when the citation was wrong or incomplete.

These paths do not require tool calling into the control network. They require only that a trusted person or pipeline treats the assistant as authoritative enough to act.

### What this demo mitigates

- **No actuation surface here.** The demo does not write configs, open OT sessions, or call plant APIs. It serves static text and ranked citations.
- **Checkable citations.** Results carry `doc_id`, `section_path`, and source links so a reviewer can check the claim against Markdown or the official NIST PDF.
- **Explicit agent rules.** `llms.txt` and the page guide tell agents not to treat fused scores or `?format=json` as normative, and to prefer cited sections over free invention.
- **Document and disclaimer labels.** Clear separation of base AI RMF vs GenAI Profile, and a stated “not official NIST output” banner, reduce mistaken authority. They do not remove it.
- **No hidden live ranking API.** Agents that only HTTP-fetch get explicit static files; there is no silent server-side model rewriting answers for OT use.

### What this demo does not mitigate

- **Wrong section, right-looking citation.** Retrieval can surface a plausible GOVERN/MAP/MEASURE/MANAGE chunk that does not fit the plant context. A citation is not a fit check.
- **Confabulation after retrieval.** An assistant can fetch correct chunks and still invent parameters, control IDs, or “recommended” setpoints not in the source.
- **Conversion of guidance into config or code.** Nothing here blocks export of assistant output into PLC logic, MES workflows, SIEM rules, or AI gateway policies.
- **Second-order OT decisions.** Vendor selection, diagnostic steps, and summarized procedures remain human/process risks. This site does not enforce TEVV, change control, or two-person review.
- **Incomplete corpus.** AI RMF demo extracts omit full NIST PDFs, sector profiles, and COSAiS overlays. The SP 800-53 sibling omits 800-53A assessment procedures, 800-53B baselines, and resolved ODPs. Silence in either corpus is not “no risk.”
- **Curated AI RMF ↔ 800-53 edges.** Related-control chips on AI RMF hits are theme hints that may link into the sibling catalog. They are not a validated overlay baseline for any facility.

### Practical boundary for operators

Use this demo to find and check NIST sections. Do not use assistant output from this corpus as the sole basis for OT configuration, automation code, commissioning, or incident response without the same change-control and independent review you would require if a model were attached to the control path. If the downstream action can change process state, treat the assistant as safety-relevant regardless of whether it had a network route to the PLC.

Full section on the demo page: https://aisharedresponsibility.com/nist-ai-rmf/#assistant-ot-risks
