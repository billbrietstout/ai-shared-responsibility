#!/usr/bin/env python3
"""Saturate Track A, optional tracks, and baseline prompts for gold diagrams.

Writes prompt text files a human or an API runner can execute. Does not call a
model unless --call-api is set and OPENAI_API_KEY (or TM_API_KEY) is present.

Usage:
  python3 eval/threat-model/run_generate.py --mode tradecraft
  python3 eval/threat-model/run_generate.py --mode zeroshot
  python3 eval/threat-model/run_generate.py --mode identity
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PROMPTS = ROOT / "tools" / "prompts" / "threat-model" / "prompts.json"
DATA = ROOT / "data"
FORMAT_FILES = {
    "image": "diagram.png",
    "mermaid": "diagram.mmd",
    "svg": "diagram.svg",
}


def load_pack() -> dict:
    return json.loads(PROMPTS.read_text(encoding="utf-8"))


def load_data(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def saturate(template: str, mapping: dict) -> str:
    text = template
    # Longer keys first so {{operating_model}} is not eaten by {{operating}}.
    for key in sorted(mapping, key=len, reverse=True):
        val = mapping[key]
        if isinstance(val, (dict, list)):
            val = json.dumps(val, indent=2)
        text = text.replace("{{" + key + "}}", str(val))
    return text


def representation_payload(gold_dir: Path, kind: str) -> str:
    path = gold_dir / FORMAT_FILES[kind]
    if kind == "image":
        return f"[Attach the image file at {path}. If you cannot attach files, say so and stop.]"
    return path.read_text(encoding="utf-8")


def by_id(pack: dict) -> dict:
    return {p["id"]: p for p in pack["prompts"] + pack["baseline_prompts"]}


def write_tradecraft(pack: dict, gold: dict, gold_dir: Path, dest: Path, role: str) -> None:
    roles = {r["id"]: r for r in pack["roles"]}
    role_row = roles[role]
    role_guidance = "\n".join(
        [
            role_row["tradecraft"],
            "Notice first:",
            *[f"- {item}" for item in role_row.get("notices_first", [])],
            "Decline to infer:",
            *[f"- {item}" for item in role_row.get("declines_to_opine", [])],
        ]
    )
    source_registry = load_data("threat-sources.json")
    source_manifest = {
        "source_set_id": "fixture-no-external-catalogs",
        "entries": [],
    }
    review_profile = gold.get("review_profile_hint", "full-system")
    review_context_input = {
        "profile": review_profile,
        "profile_confirmation": (
            {
                "operator_confirmed": True,
                "evidence": gold.get("workflow_expectations", {}).get(
                    "claim_boundary",
                    "Fixture metadata limits this run to the supplied artifact.",
                ),
            }
            if review_profile == "artifact-only"
            else {"operator_confirmed": False}
        ),
        "perspective": gold["perspective"],
        "vertical_ids": gold.get("vertical_ids", []),
        "jurisdictions": gold.get("jurisdictions", []),
        "operating_model": gold.get("operating_model_hint"),
        "critical_assets": gold.get("critical_assets", []),
        "prohibited_outcomes": gold.get("prohibited_outcomes", []),
        "continuity_safety_constraints": gold.get(
            "continuity_safety_constraints", []
        ),
        "supplied_severity": None,
    }
    mapping_base = {
        "shared_rules": pack["shared_rules"],
        "pack_version": pack["version"],
        "stride_budget": pack["runtime_defaults"]["stride_budget"],
        "cyber_role": role,
        "role_guidance": role_guidance,
        "perspective": gold["perspective"],
        "operating_model": gold.get("operating_model_hint", "AI-PaaS"),
        "review_context_input": review_context_input,
        "review_context": "(fill from P-context output)",
        "inventory": gold,
        "architecture_description": "(fill from P-diag output)",
        "application_details": "(fill from P-app output)",
        "key_features": "(fill from P-feat output)",
        "in_scope": "(fill from P-scope output)",
        "out_of_scope": "(fill from P-scope output)",
        "replica_coverage": "(fill from P-scope output)",
        "solution_description": "(fill from P-sol output)",
        "llm_subset": gold.get("llm_components", []),
        "llm_subset_empty": not gold.get("llm_components", []),
        "llm_subset_decision": "(fill from P-llm-cut output)",
        "prior_stride_considerations": [],
        "stride_scenarios": "(fill from P-stride output)",
        "stride_coverage": "(fill from P-stride output)",
        "phantom_scenarios": "(fill from P-phantom output)",
        "phantom_coverage": "(fill from P-phantom output)",
        "threats": "(fill from prior step)",
        "adversary": "(fill from P-adv output)",
        "existing_controls": "(fill from P-controls output)",
        "control_absences": "(fill from P-controls output)",
        "claim_boundary": "(fill from P-adv output)",
        "traditional_coverage": "(fill from P-stride through P-operational output)",
        "traditional_analysis": "(fill from P-stride through P-operational output)",
        "abuse_scenarios": "(fill from P-abuse output)",
        "abuse_coverage": "(fill from P-abuse output)",
        "operational_scenarios": "(fill from P-operational output)",
        "operational_coverage": "(fill from P-operational output)",
        "composition_scenarios": "(fill from P-compose output)",
        "composition_coverage": "(fill from P-compose output)",
        "catalog_scenarios": "(fill from P-catalog output)",
        "catalog_mappings": "(fill from P-catalog output)",
        "catalog_coverage": "(fill from P-catalog output)",
        "review_order": "(fill from P-importance output)",
        "source_manifest": source_manifest,
        "source_registry": source_registry,
        "threat_crosswalk": load_data("threats.json"),
        "personas": load_data("personas.json"),
        "matrix": load_data("matrix.json"),
        "full_matrix": "(fill with the accumulated matrix)",
    }
    chain = [c["id"] for c in pack["chain"] if c["track"] == "A"]
    prompts = by_id(pack)
    for kind in FORMAT_FILES:
        out_dir = dest / gold["system_id"] / kind
        out_dir.mkdir(parents=True, exist_ok=True)
        mapping = dict(mapping_base)
        mapping["representation_kind"] = kind
        mapping["representation"] = representation_payload(gold_dir, kind)
        for i, pid in enumerate(chain, start=1):
            tmpl = prompts[pid]["template"]
            text = saturate(tmpl, mapping)
            (out_dir / f"{i:02d}-{pid}.txt").write_text(text + "\n", encoding="utf-8")
        optional_ids = [c["id"] for c in pack["chain"] if c["track"] == "optional"]
        for j, pid in enumerate(optional_ids, start=1):
            text = saturate(prompts[pid]["template"], mapping)
            (out_dir / f"O{j:02d}-{pid}.txt").write_text(
                text + "\n", encoding="utf-8"
            )
        # Track B optional
        b_ids = [c["id"] for c in pack["chain"] if c["track"] == "B"]
        for j, pid in enumerate(b_ids, start=1):
            text = saturate(prompts[pid]["template"], mapping)
            (out_dir / f"B{j:02d}-{pid}.txt").write_text(text + "\n", encoding="utf-8")
        c_ids = [c["id"] for c in pack["chain"] if c["track"] == "C"]
        for j, pid in enumerate(c_ids, start=1):
            text = saturate(prompts[pid]["template"], mapping)
            (out_dir / f"C{j:02d}-{pid}.txt").write_text(text + "\n", encoding="utf-8")
        export_ids = [c["id"] for c in pack["chain"] if c["track"] == "export"]
        for k, pid in enumerate(export_ids, start=1):
            text = saturate(prompts[pid]["template"], mapping)
            (out_dir / f"E{k:02d}-{pid}.txt").write_text(text + "\n", encoding="utf-8")
        readme = out_dir / "README.txt"
        readme.write_text(
            "Run Track A prompts in numeric order. Repeat P-llm-cut or P-stride "
            "when its repeat_until condition is false. If you use Track B, stop "
            "after P-qa, run B01 through B04, then run P-report. Track C requires "
            "complete Track B coverage and runs C01 through C02 before P-report. "
            "Otherwise run P-report directly after P-qa. Paste each JSON output "
            "into the next prompt's prior-output slot. After P-report, run E01-P-export-md "
            "(markdown), E02-P-export-json (completed JSON), E03-P-export-csv "
            "(threat database), then E04-P-export-diagram (Mermaid threat-model diagram). "
            "Track B files require an operating_model and injected local SRF data. "
            "Track C also requires vertical_ids. Run exports once, after the final "
            "P-report. Do not call an API from this README.\n",
            encoding="utf-8",
        )


def write_baseline(pack: dict, gold: dict, gold_dir: Path, dest: Path, prompt_id: str) -> None:
    prompts = by_id(pack)
    tmpl = prompts[prompt_id]["template"]
    for kind in FORMAT_FILES:
        out_dir = dest / gold["system_id"] / kind
        out_dir.mkdir(parents=True, exist_ok=True)
        text = saturate(tmpl, {
            "shared_rules": pack["shared_rules"],
            "representation_kind": kind,
            "representation": representation_payload(gold_dir, kind),
            "review_context_input": {
                "profile": gold.get("review_profile_hint", "full-system"),
                "profile_confirmation": (
                    {
                        "operator_confirmed": True,
                        "evidence": gold.get("workflow_expectations", {}).get(
                            "claim_boundary",
                            "Fixture metadata limits this run to the supplied artifact.",
                        ),
                    }
                    if gold.get("review_profile_hint") == "artifact-only"
                    else {"operator_confirmed": False}
                ),
                "perspective": gold["perspective"],
                "operating_model": gold.get("operating_model_hint"),
            },
            "source_manifest": {
                "source_set_id": "fixture-no-external-catalogs",
                "entries": [],
            },
        })
        (out_dir / f"00-{prompt_id}.txt").write_text(text + "\n", encoding="utf-8")


def call_openai(prompt: str, model: str) -> str:
    key = os.environ.get("TM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not key:
        raise SystemExit("Set OPENAI_API_KEY or TM_API_KEY to use --call-api")
    body = json.dumps({
        "model": model,
        "temperature": 0,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        os.environ.get("TM_API_URL", "https://api.openai.com/v1/chat/completions"),
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read().decode())
    return payload["choices"][0]["message"]["content"]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mode", choices=["tradecraft", "zeroshot", "identity"], default="tradecraft")
    p.add_argument("--role", default="experienced-threat-modeler")
    p.add_argument("--gold", type=Path, default=HERE / "gold")
    p.add_argument("--out", type=Path, default=None)
    p.add_argument("--call-api", action="store_true")
    p.add_argument("--model", default="gpt-4o")
    args = p.parse_args()

    pack = load_pack()
    dest = args.out or (HERE / "runs" / args.mode / "prompts")
    dest.mkdir(parents=True, exist_ok=True)
    for inv_path in sorted(args.gold.glob("*/inventory.json")):
        gold = json.loads(inv_path.read_text(encoding="utf-8"))
        gold_dir = inv_path.parent
        if args.mode == "tradecraft":
            write_tradecraft(pack, gold, gold_dir, dest, args.role)
        elif args.mode == "zeroshot":
            write_baseline(pack, gold, gold_dir, dest, "P-zeroshot")
        else:
            write_baseline(pack, gold, gold_dir, dest, "P-identity")
    print(f"wrote saturated prompts under {dest}")
    print("Fill prior-output slots from each model response, save matrices as "
          f"<run>/<system_id>/<format>.json, then run run_eval.py --pred <run>.")
    if args.call_api:
        print("--call-api walks only the first prompt per format; chain saturation still needs a human or a custom loop.")
        for first in sorted(dest.glob("*/*/00-*.txt")) + sorted(dest.glob("*/*/01-*.txt")):
            # zeroshot uses 00-; tradecraft uses 01-
            if args.mode == "tradecraft" and first.name.startswith("00-"):
                continue
            if args.mode != "tradecraft" and not first.name.startswith("00-"):
                continue
            reply = call_openai(first.read_text(encoding="utf-8"), args.model)
            first.with_suffix(".out.json").write_text(reply + "\n", encoding="utf-8")
            print(f"called API for {first}")


if __name__ == "__main__":
    main()
