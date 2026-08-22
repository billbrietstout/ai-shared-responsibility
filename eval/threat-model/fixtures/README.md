Script-check fixtures. These JSON files were not produced by a model.

- `gold-echo-eval-report.json`: `run_eval.py --write-gold-echo` scores (perfect inventory F1, zero threats).
- `zeroshot-stub/`: incomplete inventories plus a threat whose `diagram_referent` is not in the inventory. Schema failures are expected.
- `sample-compare-report.json`: `run_compare.py` over those two reports. `closure` is false.

Replace with real Track A and P-zeroshot matrices before any performance claim.
