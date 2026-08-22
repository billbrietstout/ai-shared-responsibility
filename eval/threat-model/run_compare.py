#!/usr/bin/env python3
"""Compare two scored runs (typically tradecraft vs zero-shot).

Usage:
  python3 eval/threat-model/run_compare.py \\
      --tradecraft eval/threat-model/runs/tradecraft/eval-report.json \\
      --baseline eval/threat-model/runs/zeroshot/eval-report.json

Does not claim closure. Prints deltas and writes compare-report.json next to
the tradecraft report unless --out is set.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def delta(a, b):
    if a is None or b is None:
        return None
    return round(a - b, 4)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--tradecraft", type=Path, required=True)
    p.add_argument("--baseline", type=Path, required=True)
    p.add_argument("--out", type=Path, default=None)
    args = p.parse_args()

    t = load(args.tradecraft)
    b = load(args.baseline)
    ts, bs = t["summary"], b["summary"]
    report = {
        "tradecraft": str(args.tradecraft),
        "baseline": str(args.baseline),
        "deltas_tradecraft_minus_baseline": {
            "inventory_macro_f1_mean": delta(ts.get("inventory_macro_f1_mean"), bs.get("inventory_macro_f1_mean")),
            "format_inventory_jaccard_mean": delta(ts.get("format_inventory_jaccard_mean"), bs.get("format_inventory_jaccard_mean")),
            "schema_failures": delta(ts.get("schema_failures"), bs.get("schema_failures")),
            "mean_threat_count": delta(ts.get("mean_threat_count"), bs.get("mean_threat_count")),
        },
        "tradecraft_summary": ts,
        "baseline_summary": bs,
        "closure": False,
        "closure_note": "Deltas omit SME Likert, false-positive labels, and Hamming loss on expert-corrected STRIDE and CIA tags. A higher inventory F1 is not a Track A win.",
    }
    out = args.out or args.tradecraft.with_name("compare-report.json")
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
