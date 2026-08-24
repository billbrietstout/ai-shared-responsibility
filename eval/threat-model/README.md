# AI-enabled system threat-model evaluation

Gold diagrams and scoring scripts for the prompt pack at
`/tools/prompts/threat-model/`. The human-readable eval against three published
threat models is `/eval/threat-model/`. A prediction is an image, Mermaid
source, or SVG run through Track A. Version 3 records review context, completes
typed traditional analysis, runs PHANTOM-B on the AI subset, checks
AI-to-traditional paths, maps pinned source records, records importance,
chooses actions, runs QA, and writes a readable report.

Automated scores run without calling a model. A claim that Track A beats
P-zeroshot still needs the SME sheets in `sme/`.

## Gold corpus

Ten bounded architectures, each with `inventory.json`, `diagram.mmd`,
`diagram.svg`, and `diagram.png`:

| id | What it shows | Suggested operating model |
|---|---|---|
| `hf-llama-chat` | Chatbot front end, local Llama, Hugging Face weights | IaaS |
| `rag-app` | Web app, retriever, vector and document stores, provider model API | AI-PaaS |
| `mcp-agent` | Agent runtime, policy gate, MCP host, three tool servers | AI-PaaS |
| `ai-paas-app` | Customer app and prompt gateway on provider guardrails plus model | AI-PaaS |
| `agent-paas-runtime` | Provider orchestration runtime with tenant definitions and tools | Agent-PaaS |
| `traditional-web-service` | Account API, stores, and external notification provider with no AI component | none |
| `mixed-ai-case-assistant` | Model output enters a public-sector case workflow after worker review | AI-PaaS |
| `agent-change-control` | Agent proposes an action that crosses approval into a deployment API | Agent-PaaS |
| `artifact-only-model-package` | Static model package and model card with no runtime claim | none |
| `clinical-triage-assistant` | Healthcare triage path with clinician review and continuity constraints | AI-PaaS |

Inventories are the only gold threat-model artifact. There is no gold threat
list. Auspex could not use manual threat models as gold because practice is not
standardized; these gold files follow that limit.

The five added v3 fixtures include `workflow_expectations`. The evaluator
checks the fixture contracts: traditional-only AI exclusion, required
traditional analysis for full AI systems, artifact-only claim narrowing,
mixed-system composition, and the ban on affected-CVE claims when component
versions are unknown.

Regenerate SVG and PNG after editing an inventory:

```
python3 eval/threat-model/render_diagrams.py
```

## Run automated scores

```
python3 eval/threat-model/run_eval.py --write-gold-echo
python3 eval/threat-model/run_eval.py --pred eval/threat-model/runs/gold-echo
```

Prediction layout:

```
<pred>/<system_id>/image.json
<pred>/<system_id>/mermaid.json
<pred>/<system_id>/svg.json
```

Each file must match `eval/threat-model/schema.json`. If Track B is selected,
run its four steps after `P-qa`. Track C may follow when vertical source rows
are supplied. Return to `P-report` after the selected optional tracks. After
the final `P-report`, run
`P-export-md`, `P-export-json`, `P-export-csv`, then `P-export-diagram`.
The markdown reply is the readable report. The JSON reply is the completed
record. The CSV reply is one row per threat. The Mermaid reply is the
threat-model diagram.

Scores:

- Inventory precision, recall, F1 per component class, plus macro F1
- Format invariance: Jaccard of inventory ids and of threat `diagram_referent` sets across image, Mermaid, and SVG
- Review profile and phase applicability
- PHANTOM-B coverage on gold LLM components
- Typed STRIDE element-letter coverage
- Abuse-case and operational coverage states
- AI-to-traditional composition path coverage
- Crossing-flow coverage
- Source manifest and external-reference binding, including CVE applicability
- Evidence-backed importance and review-order integrity
- Schema validity, including phase gates, diagram-bound controls, evidence
  references, and `diagram_referent`
- Optional Hamming loss if `eval/threat-model/labels/expert-corrections.json` is present
- SRF checks when `threats[].srf` is filled, plus L1 to L5 coverage
- Vertical join checks when Track C is filled

## Saturate prompts (no API required)

```
python3 eval/threat-model/run_generate.py --mode tradecraft
python3 eval/threat-model/run_generate.py --mode zeroshot
python3 eval/threat-model/run_generate.py --mode identity
```

Writes filled prompt text under `eval/threat-model/runs/<mode>/prompts/`. Run
the required chain in numeric order. Repeat P-llm-cut or P-stride when its
`repeat_until` condition is false. P-importance is required. If Track B is
used, stop after P-qa and run B01 through B04. Track C uses C01 and C02 after
Track B. Run P-report after the selected optional tracks. After the final
P-report, run `E01-P-export-md`,
`E02-P-export-json`, `E03-P-export-csv`, and `E04-P-export-diagram`.
Save the JSON as `<run>/<system_id>/<format>.json`.
The generator injects the local threat-source registry and SRF files. Its
fixture source manifest is empty, so a run cannot claim external catalog
coverage until pinned records are supplied. Optional `--call-api` needs `OPENAI_API_KEY`
or `TM_API_KEY` and only fires the first prompt per format; later steps still
need prior JSON pasted in.

## Compare tradecraft vs zero-shot

```
python3 eval/threat-model/run_eval.py --pred eval/threat-model/runs/tradecraft --out eval/threat-model/runs/tradecraft/eval-report.json
python3 eval/threat-model/run_eval.py --pred eval/threat-model/runs/zeroshot --out eval/threat-model/runs/zeroshot/eval-report.json
python3 eval/threat-model/run_compare.py \
  --tradecraft eval/threat-model/runs/tradecraft/eval-report.json \
  --baseline eval/threat-model/runs/zeroshot/eval-report.json
```

`run_compare.py` prints deltas and keeps `closure` false until the SME sheets exist.

`eval/threat-model/fixtures/sample-compare-report.json` is a script check: gold inventory echo versus an intentionally degraded stub. It is not a model comparison.

## SME protocol

Templates in `eval/threat-model/sme/`. Two reviewers per system, not the prompt
author. Mix AI application security and a general threat modeler.

1. `overall.csv`: 5-point Likert on scenario clarity and whether the copilot
   enhances threat modeling. Plus Shostack's "Would you threat model this way
   again?"
2. `threats.csv`: per scenario, Likert on realism and yes/no false positive.
   Cross-tab as in Auspex Table 1.
3. `labels.csv`: expert add/remove of STRIDE and CIA letters. Feed the
   corrections into `labels/expert-corrections.json` and re-run `run_eval.py`
   for Hamming loss.

Likert: 1 Strongly disagree, 2 Disagree, 3 Neutral, 4 Agree, 5 Strongly agree.

## Citations

- Shostack, Four Question Framework (CC-BY)
- Shostack, PHANTOM-B (CC-BY)
- Crossman et al., Auspex, arXiv:2503.09586
