#!/usr/bin/env python3
"""Score threat-model matrices against gold inventories.

Usage:
  python3 eval/threat-model/run_eval.py
  python3 eval/threat-model/run_eval.py --pred eval/threat-model/runs/tradecraft
  python3 eval/threat-model/run_eval.py --write-gold-echo

Prediction layout:
  <pred>/<system_id>/<format>.json
  where format is image, mermaid, or svg.

Without --pred, scores the gold-echo fixture (inventory copied into the output
schema, no threats). That checks the harness, not a model.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from metrics import (  # noqa: E402
    FORMATS,
    coverage,
    gold_systems,
    hamming_multilabel,
    inventory_fidelity,
    jaccard,
    load_json,
    matrix_from_gold_inventory,
    referent_set,
    schema_issues,
    srf_checks,
    STRIDE,
    CIA,
)


def write_gold_echo(gold_dir: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for system_id, gold in gold_systems(gold_dir).items():
        out = dest / system_id
        out.mkdir(parents=True, exist_ok=True)
        for kind in FORMATS:
            path = out / f"{kind}.json"
            path.write_text(json.dumps(matrix_from_gold_inventory(gold, kind), indent=2) + "\n", encoding="utf-8")


def load_personas(path: Path) -> set[str]:
    data = load_json(path)
    ids = {p["id"] for p in data.get("personas", [])}
    ids |= {s["id"] for s in data.get("sector_specializations", [])}
    return ids


def collect_predictions(pred_dir: Path) -> dict:
    found = {}
    for system_dir in sorted(p for p in pred_dir.iterdir() if p.is_dir()):
        system_id = system_dir.name
        found[system_id] = {}
        for kind in FORMATS:
            path = system_dir / f"{kind}.json"
            if path.is_file():
                found[system_id][kind] = load_json(path)
    return found


def score_run(gold_dir: Path, pred_dir: Path, labels_path: Path | None, personas_path: Path, threats_path: Path) -> dict:
    golds = gold_systems(gold_dir)
    preds = collect_predictions(pred_dir)
    personas = load_personas(personas_path) if personas_path.is_file() else set()
    threats_json = load_json(threats_path) if threats_path.is_file() else None
    labels = load_json(labels_path) if labels_path and labels_path.is_file() else {}

    systems = []
    for system_id, gold in golds.items():
        per_format = preds.get(system_id, {})
        format_scores = {}
        inv_sets = {}
        ref_sets = {}
        for kind, matrix in per_format.items():
            issues = schema_issues(matrix)
            inv = matrix.get("inventory") or {}
            fid = inventory_fidelity(inv, gold)
            cov = coverage(matrix, gold)
            op_model = matrix.get("chain_meta", {}).get("operating_model") or gold.get("operating_model_hint")
            srf = srf_checks(matrix, personas, threats_json, op_model)
            ham = []
            sys_labels = (labels.get(system_id) or {}).get(kind) or labels.get(system_id) or []
            if sys_labels:
                by_id = {t.get("id"): t for t in matrix.get("threats", [])}
                for row in sys_labels:
                    pred_t = by_id.get(row["id"], {})
                    if "stride" in row:
                        ham.append(hamming_multilabel(pred_t.get("stride"), row["stride"], STRIDE))
                    if "cia" in row:
                        ham.append(hamming_multilabel(pred_t.get("cia"), row["cia"], CIA))
            format_scores[kind] = {
                "schema_ok": not issues,
                "schema_issues": issues,
                "inventory": fid,
                "coverage": cov,
                "srf": srf,
                "hamming_loss_mean": round(sum(ham) / len(ham), 4) if ham else None,
                "threat_count": len(matrix.get("threats") or []),
            }
            inv_sets[kind] = set()
            for key in ("components", "external_actors", "data_stores", "data_flows", "trust_boundaries"):
                inv_sets[kind] |= {item["id"] if isinstance(item, dict) else item for item in inv.get(key, [])}
            ref_sets[kind] = referent_set(matrix)

        pairs = list(per_format.keys())
        inv_j, ref_j = [], []
        for i, a in enumerate(pairs):
            for b in pairs[i + 1 :]:
                inv_j.append(jaccard({x.lower() for x in inv_sets[a]}, {x.lower() for x in inv_sets[b]}))
                ref_j.append(jaccard(ref_sets[a], ref_sets[b]))
        systems.append({
            "system_id": system_id,
            "formats_present": sorted(per_format),
            "per_format": format_scores,
            "format_invariance": {
                "inventory_jaccard_mean": round(sum(inv_j) / len(inv_j), 4) if inv_j else None,
                "referent_jaccard_mean": round(sum(ref_j) / len(ref_j), 4) if ref_j else None,
                "pairs": len(inv_j),
            },
        })

    return {
        "gold_dir": str(gold_dir),
        "pred_dir": str(pred_dir),
        "systems": systems,
        "summary": summarize(systems),
        "closure": False,
        "closure_note": "These scores omit SME Likert, false-positive labels, and Hamming loss on expert-corrected STRIDE and CIA tags. closure stays false until those sheets exist.",
    }


def summarize(systems: list) -> dict:
    f1s, inv_j, schema_fail, threat_n = [], [], 0, []
    for sys in systems:
        for fmt, row in sys["per_format"].items():
            f1s.append(row["inventory"]["macro_f1"])
            threat_n.append(row["threat_count"])
            if not row["schema_ok"]:
                schema_fail += 1
        if sys["format_invariance"]["inventory_jaccard_mean"] is not None:
            inv_j.append(sys["format_invariance"]["inventory_jaccard_mean"])
    return {
        "systems": len(systems),
        "inventory_macro_f1_mean": round(sum(f1s) / len(f1s), 4) if f1s else None,
        "format_inventory_jaccard_mean": round(sum(inv_j) / len(inv_j), 4) if inv_j else None,
        "schema_failures": schema_fail,
        "mean_threat_count": round(sum(threat_n) / len(threat_n), 2) if threat_n else 0,
    }


def write_csv(report: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["system_id", "format", "inventory_macro_f1", "schema_ok", "threat_count", "phantom_b_fraction", "stride_fraction", "crossing_fraction"])
        for sys in report["systems"]:
            for fmt, row in sys["per_format"].items():
                w.writerow([
                    sys["system_id"],
                    fmt,
                    row["inventory"]["macro_f1"],
                    row["schema_ok"],
                    row["threat_count"],
                    row["coverage"]["phantom_b_fraction"],
                    row["coverage"]["stride_fraction"],
                    row["coverage"]["crossing_fraction"],
                ])


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--gold", type=Path, default=HERE / "gold")
    p.add_argument("--pred", type=Path, default=HERE / "runs" / "gold-echo")
    p.add_argument("--labels", type=Path, default=HERE / "labels" / "expert-corrections.json")
    p.add_argument("--out", type=Path, default=None)
    p.add_argument("--write-gold-echo", action="store_true")
    args = p.parse_args()

    if args.write_gold_echo or not args.pred.exists():
        write_gold_echo(args.gold, HERE / "runs" / "gold-echo")
        if args.write_gold_echo and args.pred == HERE / "runs" / "gold-echo":
            args.pred = HERE / "runs" / "gold-echo"

    report = score_run(
        args.gold,
        args.pred,
        args.labels if args.labels.is_file() else None,
        ROOT / "data" / "personas.json",
        ROOT / "data" / "threats.json",
    )
    out = args.out or (args.pred / "eval-report.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    write_csv(report, out.with_suffix(".csv"))
    print(json.dumps(report["summary"], indent=2))
    print(f"wrote {out}")
    print(report["closure_note"])


if __name__ == "__main__":
    main()
