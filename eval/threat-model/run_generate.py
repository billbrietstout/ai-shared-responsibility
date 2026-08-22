#!/usr/bin/env python3
"""Saturate the Track A / Track B / baseline prompt templates for gold diagrams.

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
FORMAT_FILES = {
    "image": "diagram.png",
    "mermaid": "diagram.mmd",
    "svg": "diagram.svg",
}


def load_pack() -> dict:
    return json.loads(PROMPTS.read_text(encoding="utf-8"))


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
    mapping_base = {
        "shared_rules": pack["shared_rules"],
        "cyber_role": role,
        "role_tradecraft": role_row["tradecraft"],
        "perspective": gold["perspective"],
        "operating_model": gold.get("operating_model_hint", "AI-PaaS"),
        "inventory": gold,
        "architecture_description": "(fill from P-diag output)",
        "application_details": "(fill from P-app output)",
        "key_features": "(fill from P-feat output)",
        "in_scope": "(fill from P-scope output)",
        "out_of_scope": "(fill from P-scope output)",
        "solution_description": "(fill from P-sol output)",
        "llm_subset": gold.get("llm_components", []),
        "stride_scenarios": "(fill from P-stride output)",
        "phantom_scenarios": "(fill from P-phantom output)",
        "threats": "(fill from prior step)",
        "adversary": "(fill from P-adv output)",
        "existing_controls": "(fill from P-controls output)",
        "claim_boundary": "(fill from P-adv output)",
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
        # Track B optional
        b_ids = [c["id"] for c in pack["chain"] if c["track"] == "B"]
        for j, pid in enumerate(b_ids, start=1):
            text = saturate(prompts[pid]["template"], mapping)
            (out_dir / f"B{j:02d}-{pid}.txt").write_text(text + "\n", encoding="utf-8")
        export_ids = [c["id"] for c in pack["chain"] if c["track"] == "export"]
        for k, pid in enumerate(export_ids, start=1):
            text = saturate(prompts[pid]["template"], mapping)
            (out_dir / f"E{k:02d}-{pid}.txt").write_text(text + "\n", encoding="utf-8")
        readme = out_dir / "README.txt"
        readme.write_text(
            "Run Track A prompts in numeric order. Paste each JSON output into the "
            "next prompt's prior-output slot. After P-report, run E01-P-export-md "
            "(markdown), E02-P-export-json (completed JSON), then E03-P-export-csv "
            "(threat database). Track B files (B01+) are optional and require an "
            "operating_model; if you run them, re-run E01 through E03 on the Track B "
            "JSON. Do not call an API from this README.\n",
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
