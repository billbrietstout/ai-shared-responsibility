#!/usr/bin/env python3
"""Score claims-test assessments against gold fixtures.

Usage:
  python3 eval/claims-test/run_eval.py
  python3 eval/claims-test/run_eval.py --write-gold-echo
  python3 eval/claims-test/run_eval.py --pred eval/claims-test/runs/gold-echo

Prediction layout:
  <pred>/<fixture_id>/assessment.json
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
GOLD = HERE / "gold"
SCORES = {"Supported", "Partial", "Unsupported", "Out of scope", "Blocked"}
TAGS = {"GenAI", "LLM", "AI", "ML", "Agent"}
CHANNELS = {"google-docs", "github-md", "published"}
REPRO_RE = re.compile(
    r"\b(exploit|payload|poc|proof of concept|fuzz|repro steps?)\b",
    re.I,
)
SHARED_RE = re.compile(r"^\s*shared\s*$", re.I)
NEED_SUGGEST = {"Partial", "Unsupported", "Blocked"}
P12 = {"P1", "P2"}
REQUIRED = (
    "intake",
    "claims",
    "screen",
    "foundations",
    "inventory",
    "tags",
    "roca",
    "scores",
    "qa",
    "suggestions",
    "report",
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def gold_fixtures(gold_dir: Path) -> dict[str, dict]:
    out = {}
    for d in sorted(p for p in gold_dir.iterdir() if p.is_dir()):
        expected = d / "expected.json"
        if expected.is_file():
            out[d.name] = load_json(expected)
    return out


def write_gold_echo(gold_dir: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for fixture_id, gold in gold_fixtures(gold_dir).items():
        out = dest / fixture_id
        out.mkdir(parents=True, exist_ok=True)
        (out / "assessment.json").write_text(
            json.dumps(gold, indent=2) + "\n", encoding="utf-8"
        )


def collect_predictions(pred_dir: Path) -> dict:
    found = {}
    if not pred_dir.is_dir():
        return found
    for system_dir in sorted(p for p in pred_dir.iterdir() if p.is_dir()):
        path = system_dir / "assessment.json"
        if path.is_file():
            found[system_dir.name] = load_json(path)
    return found


def schema_issues(obj: dict) -> list[str]:
    issues = []
    if not isinstance(obj, dict):
        return ["root is not an object"]
    for key in REQUIRED:
        if key not in obj:
            issues.append(f"missing {key}")
    intake = obj.get("intake") or {}
    if intake.get("channel") not in CHANNELS:
        issues.append("intake.channel invalid")
    if intake.get("mode") not in {"full", "map-only", "suggest-only"}:
        issues.append("intake.mode invalid")
    claims = obj.get("claims") or []
    ids = []
    for c in claims:
        cid = c.get("id")
        if not cid or not re.match(r"^CLM-[0-9]+$", str(cid)):
            issues.append(f"bad claim id {cid}")
        else:
            ids.append(cid)
        if not (c.get("text") or "").strip():
            issues.append(f"{cid} missing text")
        if not (c.get("anchor") or {}).get("heading"):
            issues.append(f"{cid} missing anchor.heading")
    scores = {s.get("claim_id"): s for s in obj.get("scores") or []}
    for cid in ids:
        row = scores.get(cid)
        if not row:
            issues.append(f"{cid} unscored")
        elif row.get("score") not in SCORES:
            issues.append(f"{cid} score not in enum")
        elif not (row.get("reason") or "").strip():
            issues.append(f"{cid} missing reason")
    for row in (obj.get("tags") or {}).get("claims") or []:
        for tag in row.get("ai_tags") or []:
            if tag not in TAGS:
                issues.append(f"illegal tag {tag} on {row.get('id')}")
    for row in (obj.get("tags") or {}).get("risks") or []:
        for tag in row.get("ai_tags") or []:
            if tag not in TAGS:
                issues.append(f"illegal tag {tag} on {row.get('id')}")
    report = (obj.get("report") or {}).get("markdown") or ""
    if not report.strip():
        issues.append("report.markdown empty")
    if (obj.get("report") or {}).get("reviewer") not in (None, ""):
        issues.append("report.reviewer must be null")
    sug = obj.get("suggestions") or {}
    if sug.get("status") not in {"complete", "skipped_map_only"}:
        issues.append("suggestions.status invalid")
    if sug.get("channel") not in CHANNELS:
        issues.append("suggestions.channel invalid")
    return issues


def party_name(row: dict) -> str:
    party = row.get("accountable_party") or {}
    if isinstance(party, dict):
        return str(party.get("name") or "")
    return ""


def roca_issues(obj: dict) -> list[str]:
    issues = []
    by_claim = {r.get("claim_id"): r for r in obj.get("roca") or []}
    score_of = {s.get("claim_id"): s.get("score") for s in obj.get("scores") or []}
    for cid, score in score_of.items():
        if score == "Out of scope":
            continue
        row = by_claim.get(cid)
        if not row:
            issues.append(f"{cid} has no ROCA row")
            continue
        if SHARED_RE.match(party_name(row) or ""):
            issues.append(f"{cid} owner is Shared")
        srf_party = ((row.get("srf") or {}).get("party") or "")
        if SHARED_RE.match(str(srf_party)):
            issues.append(f"{cid} srf.party is Shared")
        if score == "Supported":
            obl = (row.get("obligation") or {}).get("statement") or ""
            ctl = (row.get("control") or {}).get("statement") or ""
            if not row.get("risk_id"):
                issues.append(f"{cid} Supported without risk_id")
            if not obl.strip():
                issues.append(f"{cid} Supported without obligation")
            if not ctl.strip():
                issues.append(f"{cid} Supported without control")
            if not party_name(row).strip():
                issues.append(f"{cid} Supported without owner")
            if obl.strip() and ctl.strip() and obl.strip() == ctl.strip():
                issues.append(f"{cid} obligation equals control")
    return issues


def suggestion_issues(obj: dict) -> list[str]:
    sug = obj.get("suggestions") or {}
    if sug.get("status") == "skipped_map_only":
        return []
    items = sug.get("items") or []
    covered = {i.get("claim_id") for i in items}
    issues = []
    for row in obj.get("scores") or []:
        if row.get("score") in NEED_SUGGEST and row.get("claim_id") not in covered:
            issues.append(f"missing suggestion for {row.get('claim_id')}")
    for finding in (obj.get("screen") or {}).get("findings") or []:
        if finding.get("tier") in P12 and finding.get("id") not in covered:
            issues.append(f"missing suggestion for {finding.get('id')}")
    return issues


def reproduction_issues(obj: dict) -> list[str]:
    issues = []
    for risk in (obj.get("inventory") or {}).get("risks") or []:
        text = risk.get("failure_mode") or ""
        if REPRO_RE.search(text):
            issues.append(f"{risk.get('id')} failure_mode looks like reproduction guidance")
    return issues


def report_id_issues(obj: dict, gold: dict) -> list[str]:
    md = (obj.get("report") or {}).get("markdown") or ""
    issues = []
    for claim in gold.get("claims") or []:
        cid = claim["id"]
        if cid not in md:
            issues.append(f"report missing {cid}")
    return issues


def score_match(pred: dict, gold: dict) -> dict:
    gold_scores = {s["claim_id"]: s["score"] for s in gold.get("scores") or []}
    pred_scores = {s.get("claim_id"): s.get("score") for s in pred.get("scores") or []}
    matched = 0
    missing = []
    mismatched = []
    for cid, score in gold_scores.items():
        if cid not in pred_scores:
            missing.append(cid)
        elif pred_scores[cid] == score:
            matched += 1
        else:
            mismatched.append({"claim_id": cid, "gold": score, "pred": pred_scores[cid]})
    total = len(gold_scores) or 1
    return {
        "gold_claims": len(gold_scores),
        "matched": matched,
        "missing": missing,
        "mismatched": mismatched,
        "accuracy": round(matched / total, 4),
    }


def score_fixture(pred: dict, gold: dict) -> dict:
    schema = schema_issues(pred)
    roca = roca_issues(pred)
    sug = suggestion_issues(pred)
    repro = reproduction_issues(pred)
    report = report_id_issues(pred, gold)
    tags_ok = not any("illegal tag" in i for i in schema)
    return {
        "schema_ok": not schema,
        "schema_issues": schema,
        "roca_ok": not roca,
        "roca_issues": roca,
        "suggestion_ok": not sug,
        "suggestion_issues": sug,
        "no_reproduction_steps": not repro,
        "reproduction_issues": repro,
        "report_ids_ok": not report,
        "report_issues": report,
        "tag_rules_ok": tags_ok,
        "scores": score_match(pred, gold),
        "absolute_coverage_gold": (gold.get("qa") or {}).get("absolute_coverage_ids") or [],
        "absolute_coverage_pred": (pred.get("qa") or {}).get("absolute_coverage_ids") or [],
    }


def summarize(systems: list) -> dict:
    acc, schema_fail, roca_fail, sug_fail = [], 0, 0, 0
    for row in systems:
        scores = row["scores"]
        if scores["accuracy"] is not None:
            acc.append(scores["accuracy"])
        if not row["schema_ok"]:
            schema_fail += 1
        if not row["roca_ok"]:
            roca_fail += 1
        if not row["suggestion_ok"]:
            sug_fail += 1
    return {
        "fixtures": len(systems),
        "score_accuracy_mean": round(sum(acc) / len(acc), 4) if acc else None,
        "schema_fail": schema_fail,
        "roca_fail": roca_fail,
        "suggestion_fail": sug_fail,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gold", type=Path, default=GOLD)
    parser.add_argument("--pred", type=Path, default=None)
    parser.add_argument("--write-gold-echo", action="store_true")
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Write JSON report to this path.",
    )
    args = parser.parse_args()
    echo_dir = HERE / "runs" / "gold-echo"
    if args.write_gold_echo:
        write_gold_echo(args.gold, echo_dir)
        print(f"Wrote gold echo under {echo_dir}")
        if args.pred is None:
            args.pred = echo_dir
    pred_dir = args.pred or echo_dir
    golds = gold_fixtures(args.gold)
    preds = collect_predictions(pred_dir)
    systems = []
    for fixture_id, gold in golds.items():
        pred = preds.get(fixture_id)
        if pred is None:
            systems.append(
                {
                    "fixture_id": fixture_id,
                    "present": False,
                    "schema_ok": False,
                    "schema_issues": ["prediction missing"],
                    "roca_ok": False,
                    "roca_issues": [],
                    "suggestion_ok": False,
                    "suggestion_issues": [],
                    "no_reproduction_steps": False,
                    "reproduction_issues": [],
                    "report_ids_ok": False,
                    "report_issues": [],
                    "tag_rules_ok": False,
                    "scores": {
                        "gold_claims": len(gold.get("scores") or []),
                        "matched": 0,
                        "missing": [s["claim_id"] for s in gold.get("scores") or []],
                        "mismatched": [],
                        "accuracy": 0.0,
                    },
                    "absolute_coverage_gold": (gold.get("qa") or {}).get("absolute_coverage_ids") or [],
                    "absolute_coverage_pred": [],
                }
            )
            continue
        row = score_fixture(pred, gold)
        row["fixture_id"] = fixture_id
        row["present"] = True
        systems.append(row)
    report = {
        "gold_dir": str(args.gold),
        "pred_dir": str(pred_dir),
        "systems": systems,
        "summary": summarize(systems),
        "closure": False,
        "closure_note": (
            "These scores omit a second gold fixture and a human review of "
            "suggestion-packet quality. closure stays false until those exist."
        ),
    }
    text = json.dumps(report, indent=2) + "\n"
    out = args.out or (pred_dir / "eval-report.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(text)
    failed = report["summary"]["schema_fail"] or report["summary"]["roca_fail"]
    failed = failed or report["summary"]["suggestion_fail"]
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
