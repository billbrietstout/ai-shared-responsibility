# AI system diagram threat-model evaluation

Gold diagrams and scoring scripts for the prompt pack at
`/tools/prompts/threat-model/`. The human-readable eval against three published
threat models is `/eval/threat-model/`. A prediction is an image, Mermaid source, or SVG
run through Track A (Shostack's Four Questions, attacker positions, existing
controls, STRIDE on every box, PHANTOM-B on the LLM subset, then a readable
report) or through a short baseline prompt.

Automated scores run without calling a model. A claim that Track A beats
P-zeroshot still needs the SME sheets in `sme/`.

## Gold corpus

Five original architectures, each with `inventory.json`, `diagram.mmd`,
`diagram.svg`, and `diagram.png`:

| id | What it shows | Suggested operating model |
|---|---|---|
| `hf-llama-chat` | Chatbot front end, local Llama, Hugging Face weights | IaaS |
| `rag-app` | Web app, retriever, vector and document stores, provider model API | AI-PaaS |
| `mcp-agent` | Agent runtime, policy gate, MCP host, three tool servers | AI-PaaS |
| `ai-paas-app` | Customer app and prompt gateway on provider guardrails plus model | AI-PaaS |
| `agent-paas-runtime` | Provider orchestration runtime with tenant definitions and tools | Agent-PaaS |

Inventories are the only gold threat-model artifact. There is no gold threat
list. Auspex could not use manual threat models as gold because practice is not
standardized; these gold files follow that limit.

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

Each file must match `eval/threat-model/schema.json`. After Track A or Track B,
run `P-export-md`, `P-export-json`, then `P-export-csv`. The markdown reply is
the readable report. The JSON reply is the completed record. The CSV reply is
one row per threat.

Scores:

- Inventory precision, recall, F1 per component class, plus macro F1
- Format invariance: Jaccard of inventory ids and of threat `diagram_referent` sets across image, Mermaid, and SVG
- PHANTOM-B coverage on gold LLM components
- STRIDE coverage on gold processes
- Crossing-flow coverage
- Schema validity, including `diagram_referent` in inventory
- Optional Hamming loss if `eval/threat-model/labels/expert-corrections.json` is present
- SRF checks when `threats[].srf` is filled (persona in `personas.json`, no `shared` party, slug join against `threats.json`)

## Saturate prompts (no API required)

```
python3 eval/threat-model/run_generate.py --mode tradecraft
python3 eval/threat-model/run_generate.py --mode zeroshot
python3 eval/threat-model/run_generate.py --mode identity
```

Writes filled prompt text under `eval/threat-model/runs/<mode>/prompts/`. Run
the chain in numeric order. After Track A, run `E01-P-export-md`,
`E02-P-export-json`, and `E03-P-export-csv`. Save the JSON as
`<run>/<system_id>/<format>.json`.
Optional `--call-api` needs `OPENAI_API_KEY`
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
