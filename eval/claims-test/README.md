# Draft whitepaper claims-test evaluation

Gold fixture and scoring scripts for the prompt pack at
`/assess/claims-test/`. A prediction is a draft plus intake packet run
through Track A (and optional Tracks B and C). Version 1 records claims,
screen findings, foundations, published topic attacks, inventory, AI tags, ROCA rows, scores,
suggestion packets, and a readable report.

Automated scores run without calling a model. A claim that Track A beats
C-zeroshot stays open until a second fixture and a human review of
suggestion packets exist.

## Gold corpus

One synthetic early draft:

| id | What it shows |
|---|---|
| `agent-identity-draft` | Seven claims covering Supported, Partial, Unsupported, Out of scope, and Blocked, plus a P2 placeholder DOI |

The gold files are `draft.md`, `intake.json`, `expected.json`, and a
GitHub review sample `suggestions-github-md.json`. `expected.json` is the
only scored artifact.

Streaming multimodal papers under `papers/` are a later optional profile,
not this fixture.

## Run automated scores

```
python3 eval/claims-test/run_eval.py --write-gold-echo
python3 eval/claims-test/run_eval.py --pred eval/claims-test/runs/gold-echo
```

Prediction layout:

```
<pred>/<fixture_id>/assessment.json
```

Each file must match `eval/claims-test/schema.json`. After Track A,
optional Track B and Track C run only when those inputs were in the first
message. A chain run replies with the markdown report. C-export-json is
optional for machine eval.

Checks:

- Schema validity, including score enum and closed AI tags
- Every gold claim id scored, with score match against gold
- ROCA columns on Supported rows: risk, obligation, control, one owner
- Obligation statement is not identical to the control statement
- Shared is not a final owner
- Suggestion packets for every Partial, Unsupported, Blocked, and P1/P2 screen finding
- Inventory failure modes do not contain reproduction-step language
- Report markdown contains the heading Published attack classes, every gold claim id, every ATT id, and the full suggestion packet text

`closure` stays false until a second gold fixture and a human review of
suggestion-packet quality exist.
