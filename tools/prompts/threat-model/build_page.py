#!/usr/bin/env python3
"""Authoring helper: rebuild index.html from prompts.json. Not a site build step.
The committed HTML is the page; re-run this after editing prompts.json."""
from __future__ import annotations

import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PACK = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))


def esc(s: str) -> str:
    return html.escape(s, quote=False)


def shortcut_text(pack: dict) -> str:
    return shortcut_text_a(pack)


def shortcut_text_a(pack: dict) -> str:
    version = pack["version"]
    return f"""Attach this system representation. Load https://aisharedresponsibility.com/tools/prompts/threat-model/prompts.json.

Use pack version {version}, runtime_defaults, chain_execution, and operator_initial_inputs. Run required Track A from P-context through P-report, then P-export-md, P-export-json, P-export-csv, and P-export-diagram. Fill every later template slot from accumulated JSON. Keep the representation attached when a template includes {{{{representation}}}}. Set representation_kind to image, mermaid, or svg. Role: experienced-threat-modeler unless this message names another role.

Treat omitted operator fields as empty and continue. Do not ask for review context, source records, SRF data, or continue. If this message already contains review_context_input, source_manifest, source_records, srf_inputs, or vertical_source_rows, use those values.

Do not skip a step. If a stop_condition fails, record the gap in that step's JSON and continue later steps that can run. When a chain object has repeat_until, rerun that same step with its cumulative prior output until the condition is true, in this same reply.

Do not fetch catalog or SRF data. Use data/threat-sources.json as the named source registry only. An omitted or empty source_manifest makes catalog coverage not_applicable. Track B runs only when this message includes srf_inputs. Track C runs only after Track B when this message includes vertical_ids and vertical_source_rows.

Leave report.reviewer empty.
Do not rephrase Shostack's four questions. Do not put mitigations in P-phantom."""


def shortcut_text_b(pack: dict) -> str:
    version = pack["version"]
    return f"""Attach this system representation. Load https://aisharedresponsibility.com/tools/prompts/threat-model/prompts.json.

Use pack version {version}, runtime_defaults, chain_execution, and operator_initial_inputs. Run required Track A from P-context through P-qa, then Track B from P-srf-join through P-srf-coverage, then P-report, then P-export-md, P-export-json, P-export-csv, and P-export-diagram. Fill every later template slot from accumulated JSON. Keep the representation attached when a template includes {{{{representation}}}}. Set representation_kind to image, mermaid, or svg. Role: experienced-threat-modeler unless this message names another role.

Treat omitted operator fields as empty and continue. Do not ask for review context, source records, SRF data, or continue. Use srf_inputs already in this message. If srf_inputs or operating_model is missing, mark Track B incomplete and continue to P-report. Do not ask.

Do not skip a step. If a stop_condition fails, record the gap in that step's JSON and continue later steps that can run. When a chain object has repeat_until, rerun that same step with its cumulative prior output until the condition is true, in this same reply.

Do not fetch catalog or SRF data. Use data/threat-sources.json as the named source registry only. An omitted or empty source_manifest makes catalog coverage not_applicable. Track C runs only after Track B when this message also includes vertical_ids and vertical_source_rows.

Leave report.reviewer empty.
Do not rephrase Shostack's four questions. Do not put mitigations in P-phantom."""


def shortcut_text_c(pack: dict) -> str:
    version = pack["version"]
    return f"""Attach this system representation. Load https://aisharedresponsibility.com/tools/prompts/threat-model/prompts.json.

Use pack version {version}, runtime_defaults, chain_execution, and operator_initial_inputs. Run required Track A from P-context through P-qa, then Track B from P-srf-join through P-srf-coverage, then Track C from P-vertical-join through P-vertical-route, then P-report, then P-export-md, P-export-json, P-export-csv, and P-export-diagram. Fill every later template slot from accumulated JSON. Keep the representation attached when a template includes {{{{representation}}}}. Set representation_kind to image, mermaid, or svg. Role: experienced-threat-modeler unless this message names another role.

Treat omitted operator fields as empty and continue. Do not ask for review context, source records, SRF data, or continue. Use srf_inputs, vertical_ids, and vertical_source_rows already in this message. If Track B cannot close, skip Track C, record the gap, and continue to P-report. Do not ask.

Do not skip a step. If a stop_condition fails, record the gap in that step's JSON and continue later steps that can run. When a chain object has repeat_until, rerun that same step with its cumulative prior output until the condition is true, in this same reply.

Do not fetch catalog or SRF data. Use data/threat-sources.json as the named source registry only. An omitted or empty source_manifest makes catalog coverage not_applicable.

Leave report.reviewer empty.
Do not rephrase Shostack's four questions. Do not put mitigations in P-phantom."""


def shortcut_paste(
    pre_id: str,
    text: str,
    *,
    label: str,
    aria_label: str,
) -> str:
    return f"""        <div class="shortcut-paste">
          <button type="button" data-shortcut-target="{esc(pre_id)}" data-copy-label="{esc(label)}" aria-label="{esc(aria_label)}">{esc(label)}</button>
          <pre id="{esc(pre_id)}">{esc(text)}</pre>
        </div>"""


def _json_example(obj: dict) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=True)


def _clinical_review_context(
    *,
    operating_model: str | None,
    vertical_ids: list[str],
    jurisdictions: list[str],
) -> dict:
    return {
        "profile": "full-system",
        "profile_confirmation": {
            "operator_confirmed": False,
            "evidence_ref": None,
        },
        "perspective": (
            "Healthcare application team that owns intake, triage workflow, "
            "model integration, and clinician review."
        ),
        "vertical_ids": vertical_ids,
        "jurisdictions": jurisdictions,
        "operating_model": operating_model,
        "critical_assets": [
            {
                "id": "asset-patient-record",
                "name": "patient record",
                "diagram_referents": ["Patient record"],
                "evidence_refs": ["operator-review-context"],
            },
            {
                "id": "asset-triage-priority",
                "name": "triage priority",
                "diagram_referents": ["Triage queue"],
                "evidence_refs": ["operator-review-context"],
            },
        ],
        "prohibited_outcomes": [
            {
                "id": "outcome-no-clinician",
                "statement": (
                    "Model output must not suppress an urgent case without "
                    "clinician review."
                ),
                "evidence_refs": ["operator-review-context"],
            }
        ],
        "continuity_safety_constraints": [
            {
                "id": "constraint-fallback",
                "statement": (
                    "Urgent intake must route to a clinician when the model "
                    "path is unavailable."
                ),
                "evidence_refs": ["operator-review-context"],
            }
        ],
        "supplied_severity": None,
        "scope": {
            "included_labels": [],
            "excluded_labels": ["model-provider training pipeline"],
            "boundary_statement": (
                "Review the drawn clinical application, data stores, and model "
                "API call. Do not review provider training."
            ),
        },
    }


def _srf_input_placeholders() -> dict:
    return {
        "operating_model": "AI-PaaS",
        "personas": (
            "REPLACE_WITH_FULL_OBJECT from "
            "https://aisharedresponsibility.com/data/personas.json"
        ),
        "matrix": (
            "REPLACE_WITH_FULL_OBJECT from "
            "https://aisharedresponsibility.com/data/matrix.json"
        ),
        "threat_crosswalk": (
            "REPLACE_WITH_FULL_OBJECT from "
            "https://aisharedresponsibility.com/data/threats.json"
        ),
    }


def example_addon_a() -> str:
    return _json_example(
        {
            "role": "application-security",
            "if_no_ai_nodes": "continue_without_llm",
            "review_context_input": _clinical_review_context(
                operating_model=None,
                vertical_ids=[],
                jurisdictions=[],
            ),
        }
    )


def example_addon_a_artifact() -> str:
    return _json_example(
        {
            "review_context_input": {
                "profile": "artifact-only",
                "profile_confirmation": {
                    "operator_confirmed": True,
                    "evidence_ref": (
                        "This review covers the model package and model card "
                        "only. Integration, inference, deployment, identity, "
                        "retrieval, and tools are out of scope."
                    ),
                },
                "perspective": (
                    "Assurance team reviewing a model package without a "
                    "runtime claim."
                ),
                "vertical_ids": [],
                "jurisdictions": [],
                "operating_model": None,
                "critical_assets": [],
                "prohibited_outcomes": [],
                "continuity_safety_constraints": [],
                "supplied_severity": None,
                "scope": {
                    "included_labels": ["model package", "model card"],
                    "excluded_labels": [
                        "runtime",
                        "deployment",
                        "identity",
                        "retrieval",
                        "tools",
                    ],
                    "boundary_statement": "Static artifact inspection only.",
                },
            }
        }
    )


def example_addon_b() -> str:
    return _json_example(
        {
            "role": "application-security",
            "if_no_ai_nodes": "continue_without_llm",
            "review_context_input": _clinical_review_context(
                operating_model="AI-PaaS",
                vertical_ids=[],
                jurisdictions=[],
            ),
            "srf_inputs": _srf_input_placeholders(),
        }
    )


def example_addon_c() -> str:
    return _json_example(
        {
            "role": "application-security",
            "if_no_ai_nodes": "continue_without_llm",
            "review_context_input": _clinical_review_context(
                operating_model="AI-PaaS",
                vertical_ids=["healthcare"],
                jurisdictions=["us-federal"],
            ),
            "srf_inputs": _srf_input_placeholders(),
            "vertical_source_rows": [
                {
                    "source_id": "srf-healthcare-controls",
                    "vertical_id": "healthcare",
                    "kind": "obligation",
                    "id": "SRF-L3-DEV-001",
                    "title": "Human-in-the-Loop Gate for High-Stakes Outputs",
                    "statement": (
                        "Clinical AI outputs classified as high-risk "
                        "(diagnosis, treatment selection, medication dosing, "
                        "procedure recommendation) must be surfaced as "
                        "advisory only and require explicit clinician "
                        "confirmation before any downstream action is taken."
                    ),
                    "mandatory": True,
                    "layer": "L3",
                    "accountable_persona": "clinical-application-developer",
                    "canonical_url": (
                        "https://aisharedresponsibility.com/data/"
                        "healthcare-controls.json"
                    ),
                },
                {
                    "source_id": "srf-healthcare-controls",
                    "vertical_id": "healthcare",
                    "kind": "control_candidate",
                    "id": "SRF-L3-VV-002",
                    "title": "Prompt Injection and Input Manipulation Defense",
                    "statement": (
                        "LLM-based clinical AI tools must implement and "
                        "validate defenses against prompt injection, "
                        "jailbreak, and adversarial input manipulation before "
                        "clinical deployment."
                    ),
                    "mandatory": False,
                    "layer": "L3",
                    "accountable_persona": "clinical-application-developer",
                    "canonical_url": (
                        "https://aisharedresponsibility.com/data/"
                        "healthcare-controls.json"
                    ),
                },
            ],
        }
    )


def prompt_by_id(pack: dict, pid: str) -> dict | None:
    for p in pack["prompts"]:
        if p["id"] == pid:
            return p
    for p in pack.get("baseline_prompts", []):
        if p["id"] == pid:
            return p
    return None


def chain_entry(pack: dict, pid: str) -> dict | None:
    for c in pack["chain"]:
        if c["id"] == pid:
            return c
    return None


def operator_banner(p: dict, pack: dict) -> str:
    pid = p["id"]
    title = p["title"]
    entry = chain_entry(pack, pid)
    nxt = entry.get("next") if entry else None
    optional_next = entry.get("optional_next") if entry else None
    repeat_until = entry.get("repeat_until") if entry else None
    if nxt:
        nxt_p = prompt_by_id(pack, nxt)
        nxt_title = nxt_p["title"] if nxt_p else nxt
        follow = f"Next prompt: {nxt} ({nxt_title})."
        if optional_next:
            opt_p = prompt_by_id(pack, optional_next)
            opt_title = opt_p["title"] if opt_p else optional_next
            follow += (
                f" Optional route before that step: {optional_next} ({opt_title})."
            )
    elif optional_next:
        nxt_p = prompt_by_id(pack, optional_next)
        nxt_title = nxt_p["title"] if nxt_p else optional_next
        follow = f"This step ends here. Optional next: {optional_next} ({nxt_title})."
    elif pid == "P-export-diagram":
        follow = (
            "Export ends here. Save the markdown, JSON, CSV, and this Mermaid "
            "reply as a .mmd file."
        )
    else:
        follow = "This prompt is not in the default chain."
    if repeat_until:
        follow = (
            f"Repeat this prompt until {repeat_until}. "
            f"Only then continue. {follow}"
        )
    if pid == "P-export-md":
        echo = "Do not echo this line in the markdown."
    elif pid == "P-export-csv":
        echo = "Do not echo this line in the CSV."
    elif pid == "P-export-diagram":
        echo = "Do not echo this line in the Mermaid."
    else:
        echo = "Do not echo this line in the JSON."
    return f"[chain] This prompt is {pid} ({title}). {follow} {echo}\n\n"


def prompt_block(p: dict, pack: dict, *, collapsed: bool = True) -> str:
    tmpl = p["template"].replace("{{shared_rules}}", pack["shared_rules"])
    tmpl = tmpl.replace("{{pack_version}}", pack["version"])
    tmpl = tmpl.replace(
        "{{stride_budget}}", str(pack["runtime_defaults"]["stride_budget"])
    )
    tmpl = operator_banner(p, pack) + tmpl
    pid = p["id"]
    entry = chain_entry(pack, pid)
    nxt_req = (entry or {}).get("next")
    nxt_opt = (entry or {}).get("optional_next")
    track = p.get("track", "A")
    track_label = "Export" if track == "export" else f"Track {track}"
    repeat_until = (entry or {}).get("repeat_until")
    if repeat_until:
        label = f"{pid} · {p['title']} · {track_label} · repeat until complete"
    elif nxt_req and nxt_opt:
        label = (
            f"{pid} · {p['title']} · {track_label} · next {nxt_req} "
            f"or optional {nxt_opt}"
        )
    elif nxt_req:
        label = f"{pid} · {p['title']} · {track_label} · next {nxt_req}"
    elif nxt_opt:
        label = f"{pid} · {p['title']} · {track_label} · optional next {nxt_opt}"
    else:
        label = f"{pid} · {p['title']} · {track_label}"
    collapsed_cls = " is-collapsed" if collapsed else ""
    toggle = "Show" if collapsed else "Hide"
    expanded = "false" if collapsed else "true"
    return f"""      <div class="prompt-block{collapsed_cls}" id="{esc(pid)}-block" data-prompt-id="{esc(pid)}">
        <div class="prompt-block__header">
          <span class="prompt-block__label">{esc(label)}</span>
          <div class="prompt-block__actions">
            <button class="prompt-block__toggle" type="button" onclick="togglePrompt('{esc(pid)}-block', this)" aria-expanded="{expanded}">{toggle}</button>
            <button class="prompt-block__copy" type="button" onclick="copyPrompt('{esc(pid)}-block', this)" aria-label="Copy {esc(pid)} prompt">Copy</button>
          </div>
        </div>
        <pre>{esc(tmpl)}</pre>
      </div>"""


def stage_section(qid: str, title: str, pack: dict) -> str:
    q = next(x for x in pack["four_questions"] if x["id"] == qid)
    ids = q["prompts"]
    by = {p["id"]: p for p in pack["prompts"]}
    blocks = "\n".join(prompt_block(by[i], pack) for i in ids)
    return f"""      <h2 class="section-label" id="{esc(qid)}">{esc(qid.upper())}. {esc(q['question'])}</h2>
      <p class="section-note">{esc(title)}</p>
{blocks}
"""


def main():
    pack = PACK
    track_b = [p for p in pack["prompts"] if p["track"] == "B"]
    track_c = [p for p in pack["prompts"] if p["track"] == "C"]
    export_prompts = [p for p in pack["prompts"] if p["track"] == "export"]
    baselines = pack["baseline_prompts"]
    pb = "\n".join(f"<li><strong>{esc(q['letter'])}</strong> {esc(q['name'])}: {esc(q['ask'])}</li>" for q in pack["phantom_b_questions"])
    def role_li(r):
        rest = r["tradecraft"]
        if ". " in rest:
            rest = rest.split(". ", 1)[1]
        notices = "; ".join(r.get("notices_first", []))
        declines = "; ".join(r.get("declines_to_opine", []))
        return (
            f"<li><strong>{esc(r['label'])}</strong> ({esc(r['id'])}). "
            f"{esc(rest)} Notices first: {esc(notices)}. "
            f"Declines to infer: {esc(declines)}.</li>"
        )

    roles = "\n".join(role_li(r) for r in pack["roles"])
    q1 = stage_section("q1", "Set the review profile and claim boundary, then read the whole representation into a structured inventory.", pack)
    q2 = stage_section("q2", "Complete typed STRIDE and conditional abuse and operational passes before PHANTOM-B. Then test AI-to-traditional paths and pinned source mappings.", pack)
    q3 = stage_section("q3", "Map method labels, record evidence-backed importance, and choose one action with a testable control point.", pack)
    q4 = stage_section("q4", "Check phase gates, denominators, evidence, and actions. Optional accountability and vertical joins run here before the report.", pack)
    track_b_html = "\n".join(prompt_block(p, pack) for p in track_b)
    track_c_html = "\n".join(prompt_block(p, pack) for p in track_c)
    export_html = "\n".join(prompt_block(p, pack) for p in export_prompts)
    baseline_html = "\n".join(prompt_block(dict(p, track="eval"), pack) for p in baselines)
    role_ids = ", ".join(r["id"] for r in pack["roles"])
    shortcut_a = shortcut_text_a(pack)
    shortcut_b = shortcut_text_b(pack)
    shortcut_c = shortcut_text_c(pack)
    shortcut_a_html = shortcut_paste(
        "shortcut-text-a",
        shortcut_a,
        label="Copy shortcut",
        aria_label="Copy Track A one-chat shortcut",
    )
    shortcut_b_html = shortcut_paste(
        "shortcut-text-b",
        shortcut_b,
        label="Copy shortcut",
        aria_label="Copy Track B one-chat shortcut",
    )
    shortcut_c_html = shortcut_paste(
        "shortcut-text-c",
        shortcut_c,
        label="Copy shortcut",
        aria_label="Copy Track C one-chat shortcut",
    )
    example_a_html = shortcut_paste(
        "example-text-a",
        example_addon_a(),
        label="Copy example",
        aria_label="Copy Track A review-context example",
    )
    example_a_artifact_html = shortcut_paste(
        "example-text-a-artifact",
        example_addon_a_artifact(),
        label="Copy example",
        aria_label="Copy Track A artifact-only example",
    )
    example_b_html = shortcut_paste(
        "example-text-b",
        example_addon_b(),
        label="Copy example",
        aria_label="Copy Track B SRF-input example",
    )
    example_c_html = shortcut_paste(
        "example-text-c",
        example_addon_c(),
        label="Copy example",
        aria_label="Copy Track C vertical-row example",
    )
    steps = []
    for c in pack["chain"]:
        p = prompt_by_id(pack, c["id"])
        steps.append({
            "id": c["id"],
            "title": p["title"] if p else c["id"],
            "next": c.get("next"),
            "optional_next": c.get("optional_next"),
            "repeat_until": c.get("repeat_until"),
            "track": c.get("track", "A"),
        })
    titles = {p["id"]: p["title"] for p in pack["prompts"]}
    titles.update({p["id"]: p["title"] for p in pack["baseline_prompts"]})
    steps_json = json.dumps(steps)
    titles_json = json.dumps(titles)

    page = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI-Enabled System Threat Modeling · AI Shared Responsibility</title>
    <meta
      name="description"
      content="Version 3 prompts for AI-enabled system threat modeling. Track A combines typed STRIDE, conditional abuse and operational analysis, PHANTOM-B, composition paths, and pinned source references. Optional tracks assign SRF accountability and vertical obligations."
    />
    <meta name="color-scheme" content="light" />
    <link rel="stylesheet" href="/shared/styles.css" />
    <style>
      .prompt-block {{
        background: var(--cosai-navy);
        border-radius: var(--radius-lg);
        overflow: hidden;
        margin-bottom: var(--sp-6);
      }}
      .prompt-block__header {{
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--sp-3) var(--sp-5);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        gap: var(--sp-3);
      }}
      .prompt-block__label {{
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.45);
      }}
      .prompt-block__copy, .prompt-block__toggle {{
        font-size: var(--text-xs);
        font-weight: 600;
        color: rgba(255,255,255,0.55);
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: var(--radius);
        padding: 4px 10px;
        cursor: pointer;
      }}
      .prompt-block__actions {{ display: flex; gap: var(--sp-2); }}
      .prompt-block__copy--copied {{ color: #6ee7b7 !important; border-color: rgba(110,231,183,0.3) !important; }}
      .prompt-block.is-last-copied {{ box-shadow: 0 0 0 2px #6ee7b7; }}
      .prompt-block.is-next {{ box-shadow: 0 0 0 2px var(--cosai-blue); }}
      .chain-status {{
        position: sticky;
        top: 56px;
        z-index: 4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--sp-3);
        max-width: 720px;
        margin: 0 0 var(--sp-8);
        padding: var(--sp-3) var(--sp-4);
        background: #fff;
        border: 1px solid var(--slate-200);
        border-radius: var(--radius);
      }}
      .chain-status__text {{
        margin: 0;
        font-size: var(--text-sm);
        color: var(--slate-700);
        line-height: var(--leading-normal);
      }}
      .chain-status__btn {{
        font-size: var(--text-xs);
        font-weight: 600;
        color: #fff;
        background: var(--cosai-navy);
        border: 0;
        border-radius: var(--radius);
        padding: 6px 12px;
        cursor: pointer;
      }}
      .deliverable {{
        max-width: 720px;
        margin: 0 0 var(--sp-10);
        padding: var(--sp-5);
        border: 1px solid var(--slate-200);
        border-radius: var(--radius);
        background: #fff;
      }}
      .deliverable__title {{
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--slate-400);
        margin: 0 0 var(--sp-3);
        line-height: var(--leading-normal);
      }}
      .deliverable p, .deliverable ul, .deliverable ol, .deliverable h3 {{
        margin: 0 0 var(--sp-3);
        font-size: var(--text-sm);
        color: var(--slate-700);
        line-height: var(--leading-normal);
      }}
      .deliverable h3 {{
        font-weight: 700;
        color: var(--slate-800);
        letter-spacing: 0;
        text-transform: none;
      }}
      .deliverable ul, .deliverable ol {{
        padding-left: 1.2rem;
      }}
      .deliverable :last-child {{
        margin-bottom: 0;
      }}
      .shortcut-paste {{
        position: relative;
        margin: 0 0 var(--sp-6);
      }}
      .shortcut-paste pre {{
        margin: 0;
        padding: var(--sp-4);
        padding-top: 2.8rem;
        background: var(--slate-50);
        border: 1px solid var(--slate-200);
        border-radius: var(--radius);
        font-size: 0.8rem;
        line-height: 1.55;
        color: var(--slate-800);
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;
        max-height: 50vh;
        overflow-y: auto;
        overscroll-behavior: contain;
      }}
      .shortcut-paste button {{
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--slate-600);
        background: #fff;
        border: 1px solid var(--slate-200);
        border-radius: var(--radius);
        padding: 4px 10px;
        cursor: pointer;
      }}
      .shortcut-paste button.is-copied {{
        color: #047857;
        border-color: #6ee7b7;
      }}
      .shortcut-more {{
        margin: 0 0 var(--sp-5);
        padding: var(--sp-3) var(--sp-4);
        border: 1px dashed var(--slate-300);
        border-radius: var(--radius);
        background: #fff;
      }}
      .shortcut-more > summary {{
        cursor: pointer;
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--slate-800);
        line-height: var(--leading-normal);
      }}
      .shortcut-more[open] > summary {{
        margin-bottom: var(--sp-3);
      }}
      .shortcut-more .shortcut-paste {{
        margin-bottom: var(--sp-4);
      }}
      .shortcut-more .shortcut-paste:last-child {{
        margin-bottom: 0;
      }}
      .shortcut-more p:last-of-type {{
        margin-bottom: var(--sp-3);
      }}
      .prompt-block pre {{
        margin: 0;
        padding: var(--sp-6);
        font-size: 0.8rem;
        line-height: 1.65;
        color: #e2e8f0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;
        max-height: 70vh;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-color: rgba(255,255,255,0.35) transparent;
      }}
      .prompt-block.is-collapsed pre {{
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
        opacity: 0;
        overflow: hidden;
      }}
      h2.section-label, h3.section-label {{
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--slate-400);
        margin: var(--sp-10) 0 var(--sp-3);
        line-height: var(--leading-normal);
      }}
      .section-note {{
        font-size: var(--text-sm);
        color: var(--slate-600);
        max-width: 720px;
        margin: 0 0 var(--sp-5);
        line-height: var(--leading-normal);
      }}
      .cite-list, .q-list, .pb-list {{
        max-width: 720px;
        margin: 0 0 var(--sp-8);
        padding-left: 1.2rem;
        color: var(--slate-700);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }}
    </style>
    <script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "name": "AI-Enabled System Threat Modeling Prompts",
  "url": "https://aisharedresponsibility.com/tools/prompts/threat-model/",
  "description": "Version 3 prompts that model a whole AI-enabled system with typed STRIDE, conditional abuse and operational analysis, PHANTOM-B, composition paths, pinned source references, and optional SRF and vertical assignments.",
  "publisher": {{
    "@type": "Organization",
    "name": "AI Shared Responsibility",
    "url": "https://aisharedresponsibility.com/"
  }}
}}
    </script>
    <!-- llm:meta -->
    <!-- /llm:meta -->
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <script type="module" src="/shared/components.js"></script>
    <site-nav current="tools"></site-nav>

    <header class="page-hero" data-llm="summary">
      <div class="page-hero__inner">
        <span class="page-hero__eyebrow"><a href="/tools/">Tools</a> / <a href="/tools/prompts/">System Instructions</a> / Threat modeling / Pack v{esc(pack['version'])}</span>
        <h1 class="page-hero__title">AI-enabled system threat modeling</h1>
        <p class="page-hero__lede">
          Attach a system representation (image, Mermaid, or SVG) and run one chat.
          The pack writes a threat matrix and four export replies:
          <code>.md</code>, <code>.json</code>, <code>.csv</code>, and
          <code>.mmd</code>. Start with Track A. Open Track B to assign one SRF
          layer, persona, and party. Open Track C after Track B to join vertical
          obligations.
          Templates:
          <a href="/tools/prompts/threat-model/prompts.json">prompts.json</a>.
          <a href="/tools/prompts/threat-model/releases/">Release notes</a>.
          <a href="/eval/threat-model/">Evaluation method and fixtures</a>.
        </p>
      </div>
    </header>

    <main id="main" class="page-body" data-llm="threat-model-prompts">

      <h2 class="section-label">On this page</h2>
      <ul class="q-list">
        <li><a href="#shortcut">Start here</a> (<a href="#shortcut-a">Track A</a>, <a href="#shortcut-b">Track B</a>, <a href="#shortcut-c">Track C</a>)</li>
        <li><a href="#copy-one-block">Run one prompt at a time</a></li>
        <li><a href="#q1">Track A: Four Questions</a></li>
        <li><a href="#track-b">Track B (optional)</a></li>
        <li><a href="#track-c">Track C (optional)</a></li>
        <li><a href="#export-report">Export the report, JSON, CSV, and diagram</a></li>
        <li><a href="#baselines">Evaluation baselines</a></li>
      </ul>

      <div class="deliverable" id="shortcut">
        <h2 class="deliverable__title">Start here: one chat</h2>
        <ol>
          <li>Attach the representation and set <code>representation_kind</code> to <code>image</code>, <code>mermaid</code>, or <code>svg</code>.</li>
          <li>Copy the Track A shortcut. Send it once with the representation.</li>
          <li>Save the four export replies as <code>.md</code>, <code>.json</code>, <code>.csv</code>, and <code>.mmd</code>.</li>
        </ol>
        <p>
          The model loads
          <a href="/tools/prompts/threat-model/prompts.json">prompts.json</a>
          and runs Track A through the four exports. Omitted fields stay empty.
          Catalog, SRF, and vertical mapping without injected data are not
          applicable. Optional JSON stays on this page; it is not in the copied
          shortcut. If the chat cannot load that file, use
          <a href="#copy-one-block">Run one prompt at a time</a>.
        </p>
        <h3 id="shortcut-a">Track A</h3>
        <p>
          Default path. Representation and <code>representation_kind</code> are
          enough. Default role is experienced-threat-modeler. Default
          <code>if_no_ai_nodes</code> is <code>continue_without_llm</code>.
        </p>
{shortcut_a_html}
        <details class="shortcut-more" id="example-a">
          <summary>Add review context (optional JSON)</summary>
          <p>
            Paste this JSON in the same first message when you have claims the
            diagram does not show. Omit keys you do not know. Rewrite names and
            labels to match the attached diagram. Role values:
            <code>experienced-threat-modeler</code> (default),
            <code>application-security</code>, <code>llm-caller</code>.
            Profile values: <code>full-system</code>,
            <code>bounded-subsystem</code>, <code>artifact-only</code>.
            A catalog overlay is a <code>source_manifest</code> object with
            pinned entries; omit it to leave catalog coverage not applicable.
          </p>
{example_a_html}
          <p id="example-a-artifact">
            Artifact-only confirmation. Traditional-phase
            <code>not_applicable</code> is allowed only when
            <code>profile_confirmation.operator_confirmed</code> is true and
            <code>evidence_ref</code> states that integration is out of scope.
          </p>
{example_a_artifact_html}
        </details>
        <details class="shortcut-more" id="shortcut-b">
          <summary>Track B: assign SRF accountability</summary>
          <p>
            Use this when the first message already includes an operating model
            plus the full <a href="/data/personas.json">personas</a>,
            <a href="/data/matrix.json">matrix</a>, and
            <a href="/data/threats.json">threat_crosswalk</a> objects.
            Operating model values: <code>AI-SaaS</code>, <code>AI-PaaS</code>,
            <code>Agent-PaaS</code>, <code>IaaS</code>.
          </p>
          <ol>
            <li>Copy the Track B shortcut.</li>
            <li>Open the three files. Copy each file's full JSON object.</li>
            <li>Copy the example below. Replace the three
              <code>REPLACE_WITH_FULL_OBJECT</code> strings with those objects.
              Keep <code>operating_model</code> the same in
              <code>review_context_input</code> and <code>srf_inputs</code>.</li>
            <li>Paste the shortcut, the representation, and the filled JSON in
              the same first message.</li>
          </ol>
{shortcut_b_html}
{example_b_html}
        </details>
        <details class="shortcut-more" id="shortcut-c">
          <summary>Track C: join vertical obligations</summary>
          <p>
            Use this after Track B inputs are in the first message, plus
            <code>vertical_ids</code> and <code>vertical_source_rows</code>.
            The two rows in the example are reshaped from
            <a href="/data/healthcare-controls.json">healthcare-controls.json</a>.
            Copy more rows from that file or the matching vertical file and keep
            this object shape. A control candidate is a proposed control.
            Vertical ids on this site: <code>healthcare</code>,
            <code>finance</code>, <code>public-sector</code>,
            <code>insurance</code>, <code>defense</code>,
            <code>manufacturing</code>. Jurisdiction ids include
            <code>us-federal</code> and <code>eu</code> from
            <a href="/data/jurisdictions.json">jurisdictions.json</a>.
          </p>
          <ol>
            <li>Complete the Track B packing steps.</li>
            <li>Set <code>vertical_ids</code> and <code>jurisdictions</code> on
              <code>review_context_input</code>.</li>
            <li>Add obligation and control-candidate rows. Paste shortcut,
              representation, and the filled JSON in the same first message.</li>
          </ol>
{shortcut_c_html}
{example_c_html}
        </details>
      </div>

      <h2 class="section-label" id="copy-one-block">Run one prompt at a time</h2>
      <p class="section-note">
        Use this when the chat cannot load
        <a href="/tools/prompts/threat-model/prompts.json">prompts.json</a>.
        Copy P-context first, then use Copy next. Optional review context, SRF
        data, and vertical rows still belong in the first message.
        Role values: {esc(role_ids)}. Default is experienced-threat-modeler.
        Copy-one-block text starts with a <code>[chain]</code> line. A chain
        run of P-stride repeats in the same reply until its typed denominator
        closes. P-importance is required before P-act. After P-report, run the
        <a href="#export-report">export steps</a>.
      </p>

      <div class="chain-status" id="chain-status">
        <p class="chain-status__text" aria-live="polite">
          Last copied: <strong id="chain-last">none</strong>.
          Next: <strong id="chain-next">P-context (Establish review context)</strong>.
        </p>
        <button type="button" class="chain-status__btn" id="chain-copy-next">Copy next</button>
      </div>

      <h2 class="section-label">Shostack's Four Questions</h2>
      <ol class="q-list">
        <li>What are we working on?</li>
        <li>What can go wrong?</li>
        <li>What are we going to do about it?</li>
        <li>Did we do a good job?</li>
      </ol>
      <p class="section-note">
        Wording is from the Four Question Framework (CC-BY). Use those four sentences as written.
        State the team view and what we are working on right now.
      </p>

      <h2 class="section-label">PHANTOM-B questions (LLM subset)</h2>
      <ul class="pb-list">
        {pb}
      </ul>
      <p class="section-note">
        Ask these eight questions for each eligible AI node after traditional
        applicability closes. Write mitigations in P-act.
      </p>

      <h2 class="section-label">Roles</h2>
      <ul class="cite-list">
        {roles}
      </ul>

      <h2 class="section-label">Sources</h2>
      <ul class="cite-list">
        <li>Adam Shostack, <a href="https://shostack.org/files/papers/The_Four_Question_Framework.pdf">The Four Question Framework for Threat Modeling</a> (CC-BY).</li>
        <li>Adam Shostack, <a href="https://shostack.org/files/papers/PHANTOM-B_Whitepaper_Shostack.pdf">PHANTOM-B: A STRIDE Analog for LLMs</a> (CC-BY).</li>
        <li>Crossman et al., <a href="https://arxiv.org/abs/2503.09586">Auspex</a> (arXiv:2503.09586). Two-stage chain, cumulative prompt fill, threat matrix, SME evaluation. The prompts here are rebuilt from the paper's published figures. JPMC's withheld tradecraft text is not in this pack.</li>
        <li>IETF <a href="https://datatracker.ietf.org/doc/html/rfc6819">RFC 6819</a>. Attack assumptions and existing features are stated before new threats. Do not copy its OAuth threat list onto an unrelated diagram.</li>
        <li>CoSAI SRF accountability data: <a href="/data/threats.json">threats.json</a>, <a href="/data/personas.json">personas.json</a>, <a href="/data/matrix.json">matrix.json</a>.</li>
        <li>External source registry: <a href="/data/threat-sources.json">threat-sources.json</a>. A run records the exact source versions and hashes in <code>source_manifest</code>.</li>
      </ul>

      <h2 class="section-label">What each track records</h2>
      <p class="section-note">
        Track A records review context, the full inventory, traditional and AI
        applicability, composition paths, threats, actions, and source provenance.
        Track B assigns one SRF layer, persona, and party. Track C adds source-bound
        obligations, control candidates, and acceptance authority. A catalog entry
        needs an inventory referent and evidence before it can attach to a threat.
      </p>

{q1}
{q2}
{q3}
{q4}

      <div class="deliverable" id="track-a-output">
        <h2 class="deliverable__title">What Track A has filled</h2>
        <p>
          P-qa produces the checked Track A matrix. Run optional
          <a href="#track-b">Track B</a> and <a href="#track-c">Track C</a>
          before P-report, or run P-report
          immediately. Then run the <a href="#export-report">export steps</a> and save the
          <code>.md</code>, <code>.json</code>, <code>.csv</code>, and
          <code>.mmd</code> replies.
          Schema:
          <a href="/eval/threat-model/schema.json">eval/threat-model/schema.json</a>.
          Eval path: <code>&lt;system-id&gt;/image.json</code> (or
          <code>mermaid.json</code> / <code>svg.json</code>).
        </p>
        <ul>
          <li><code>review_context</code>, <code>inventory</code>, <code>solution_description</code>, <code>replica_coverage</code>, and <code>llm_subset_empty</code>.</li>
          <li><code>adversary</code>: assumptions and positions (who already sits in which zone).</li>
          <li><code>existing_controls</code> with shown coverage, plus <code>control_absences</code> for expected controls not shown at a named referent.</li>
          <li><code>claim_boundary</code>: what this review does not claim, plus the time or component box.</li>
          <li><code>traditional_coverage</code>, typed <code>stride_coverage</code>, <code>phantom_coverage</code>, and <code>composition_coverage</code> record method denominators and gaps.</li>
          <li><code>source_manifest</code> pins every external source used by a mapping.</li>
          <li><code>threats</code>: stable ids with referents, method sources, evidence, external references, importance factors, one action, and validation on mitigate or eliminate.</li>
          <li><code>review_order</code> records the review sequence without claiming likelihood, impact, or residual risk.</li>
          <li><code>qa</code> records failed checks. P-report later fills <code>report.markdown</code> as a full projection of the matrix: grouped threat tables, every threat/position/control id, architecture prose, and coverage counts. Leave <code>report.reviewer</code> empty.</li>
        </ul>
        <p>
          Track B and Track C are optional. After the selected tracks, return to
          P-report. Then run the <a href="#export-report">export steps</a> and save the
          <code>.md</code>, <code>.json</code>, <code>.csv</code>, and
          <code>.mmd</code> replies.
        </p>
      </div>

      <h2 class="section-label" id="track-b">Track B (optional): SRF accountability</h2>
      <p class="section-note">
        Use the <a href="#shortcut-b">Track B one-chat shortcut</a> when SRF
        inputs are in the first message, or copy the blocks below after P-qa.
        Track B consumes the checked Track A matrix, a supplied operating model,
        and injected local SRF data. It checks expected L1 to L5 coverage before
        returning to P-report or Track C.
      </p>
{track_b_html}

      <div class="deliverable" id="track-b-output">
        <h2 class="deliverable__title">What Track B has filled</h2>
        <p>
          The assistant JSON after P-srf-coverage is the Track A matrix with
          <code>srf</code> on every threat and a <code>layer_coverage</code> audit.
          <code>chain_meta.track_b_applied</code> is true only when that audit closes.
        </p>
        <ul>
          <li><code>srf.layer</code>: L1 to L5, the layer where the control point lives.</li>
          <li><code>srf.persona</code>: one id from <a href="/data/personas.json">personas.json</a>.</li>
          <li><code>srf.party</code>: <code>customer</code> or <code>provider</code>. Never <code>shared</code>.</li>
          <li><code>srf.join.ai_exchange_slug</code>: a published slug from <a href="/data/threats.json">threats.json</a>, or null.</li>
          <li><code>layer_coverage</code>: expected, considered, and remaining SRF layers.</li>
        </ul>
        <p>
          Track B does not add threats. A threat with no matching crosswalk row still
          needs a source-backed layer, persona, and party. Run Track C when vertical
          context is supplied, or run P-report next.
        </p>
      </div>

      <h2 class="section-label" id="track-c">Track C (optional): vertical obligations and routing</h2>
      <p class="section-note">
        Use the <a href="#shortcut-c">Track C one-chat shortcut</a> when Track B
        inputs plus vertical ids and vertical source rows are in the first
        message, or copy the blocks below after Track B closes. It joins
        supported vertical and jurisdiction rows to existing threat ids. It
        cannot add a threat or treat a candidate control as an existing control.
      </p>
{track_c_html}

      <div class="deliverable" id="track-c-output">
        <h2 class="deliverable__title">What Track C has filled</h2>
        <ul>
          <li>Applicable obligation citations from injected regulation or crosswalk rows.</li>
          <li>Candidate controls kept separate from diagram-visible existing controls.</li>
          <li>One accountable persona and acceptance authority when the source data identifies them.</li>
          <li>Unresolved authority or applicability gaps instead of guessed assignments.</li>
        </ul>
      </div>

      <h2 class="section-label" id="export-report">Export the report, JSON, CSV, and diagram</h2>
      <p class="section-note">
        These four prompts run once after P-report.
        P-export-md emits the stored report without rewriting it (<code>.md</code>).
        That stored report projects the matrix: every threat id appears as a
        table row grouped by diagram referent.
        P-export-json writes the completed record (<code>.json</code>).
        P-export-csv writes one row per threat with stable SRF columns. Track A leaves
        those cells empty (<code>.csv</code>).
        P-export-diagram writes a Mermaid data-flow of the inventory with threat
        ids on their referents (<code>.mmd</code>). It uses only inventory ids.
        Leave the reviewer line empty.
      </p>
{export_html}

      <h2 class="section-label" id="baselines">Evaluation baselines</h2>
      <p class="section-note">
        P-zeroshot and P-identity are the two short baselines scored in
        <code>eval/threat-model/</code>. Machine scores stay open until the SME sheets
        in that directory are filled.
      </p>
{baseline_html}

      <h2 class="section-label">Output schema</h2>
      <p class="section-note">
        Full JSON Schema: <a href="/eval/threat-model/schema.json">eval/threat-model/schema.json</a>.
        Gold diagrams and bounded workflow fixtures are in
        <code>eval/threat-model/</code> of the site repository.
      </p>
    </main>
    <site-footer></site-footer>
    <script>
      const TM_STORAGE = 'srf.tm.lastPrompt';
      const TM_STEPS = {steps_json};
      const TM_TITLES = {titles_json};

      function stepById(id) {{
        return TM_STEPS.find((s) => s.id === id) || null;
      }}
      function titleOf(id) {{
        const s = stepById(id);
        if (s) return s.title;
        return TM_TITLES[id] || id;
      }}
      function nextId(id) {{
        if (!id) return 'P-context';
        const s = stepById(id);
        if (!s) return null;
        if (s.repeat_until) return id;
        return s.next || s.optional_next || null;
      }}
      function markChain(lastId) {{
        document.querySelectorAll('.prompt-block').forEach((el) => {{
          el.classList.remove('is-last-copied', 'is-next');
        }});
        const lastLabel = document.getElementById('chain-last');
        const nextLabel = document.getElementById('chain-next');
        const copyNextBtn = document.getElementById('chain-copy-next');
        if (!lastLabel || !nextLabel || !copyNextBtn) return;
        const nxt = nextId(lastId);
        if (lastId) {{
          const lastEl = document.getElementById(lastId + '-block');
          if (lastEl) lastEl.classList.add('is-last-copied');
          lastLabel.textContent = lastId + ' (' + titleOf(lastId) + ')';
        }} else {{
          lastLabel.textContent = 'none';
        }}
        if (nxt) {{
          const nextEl = document.getElementById(nxt + '-block');
          if (nextEl) nextEl.classList.add('is-next');
          const step = lastId && stepById(lastId);
          const repeat = step && step.repeat_until;
          const optional = step && step.optional_next;
          let suffix = repeat ? ', repeat until ' + repeat : '';
          if (optional) {{
            suffix += ', optional route ' + optional + ' (' + titleOf(optional) + ')';
          }}
          nextLabel.textContent = nxt + ' (' + titleOf(nxt) + ')' + suffix;
          copyNextBtn.hidden = false;
        }} else {{
          nextLabel.textContent = 'none; the chain ends here';
          copyNextBtn.hidden = true;
        }}
      }}
      function togglePrompt(blockId, btn) {{
        const block = document.getElementById(blockId);
        if (!block) return;
        const collapsed = block.classList.toggle('is-collapsed');
        btn.textContent = collapsed ? 'Show' : 'Hide';
        btn.setAttribute('aria-expanded', String(!collapsed));
      }}
      function copyPrompt(blockId, btn) {{
        const pre = document.querySelector('#' + blockId + ' pre');
        if (!pre) return;
        const id = blockId.replace(/-block$/, '');
        navigator.clipboard.writeText(pre.textContent).then(() => {{
          try {{ localStorage.setItem(TM_STORAGE, id); }} catch (err) {{}}
          markChain(id);
          btn.textContent = 'Copied';
          btn.classList.add('prompt-block__copy--copied');
          setTimeout(() => {{
            btn.textContent = 'Copy';
            btn.classList.remove('prompt-block__copy--copied');
          }}, 2000);
        }});
      }}
      function copyNext() {{
        let last = null;
        try {{ last = localStorage.getItem(TM_STORAGE); }} catch (err) {{}}
        const nxt = nextId(last);
        if (!nxt) return;
        const block = document.getElementById(nxt + '-block');
        const btn = block && block.querySelector('.prompt-block__copy');
        if (!block || !btn) return;
        if (block.classList.contains('is-collapsed')) {{
          const tog = block.querySelector('.prompt-block__toggle');
          if (tog) togglePrompt(nxt + '-block', tog);
        }}
        copyPrompt(nxt + '-block', btn);
        block.scrollIntoView({{ block: 'center' }});
      }}
      function copyShortcut(btn) {{
        const preId = btn.getAttribute('data-shortcut-target');
        const pre = preId && document.getElementById(preId);
        if (!pre || !btn) return;
        const original = btn.getAttribute('data-copy-label') || btn.textContent;
        navigator.clipboard.writeText(pre.textContent).then(() => {{
          btn.textContent = 'Copied';
          btn.classList.add('is-copied');
          setTimeout(() => {{
            btn.textContent = original;
            btn.classList.remove('is-copied');
          }}, 2000);
        }});
      }}
      function openHashDetails() {{
        const id = (location.hash || '').replace(/^#/, '');
        if (!id) return;
        const el = document.getElementById(id);
        if (!el) return;
        const details = el.closest('details');
        if (details) details.open = true;
      }}
      document.addEventListener('DOMContentLoaded', () => {{
        const copyNextBtn = document.getElementById('chain-copy-next');
        if (copyNextBtn) copyNextBtn.addEventListener('click', copyNext);
        document.querySelectorAll('[data-shortcut-target]').forEach((btn) => {{
          btn.addEventListener('click', () => copyShortcut(btn));
        }});
        window.addEventListener('hashchange', openHashDetails);
        openHashDetails();
        let last = null;
        try {{ last = localStorage.getItem(TM_STORAGE); }} catch (err) {{}}
        markChain(last);
      }});
    </script>
  </body>
</html>
"""
    (HERE / "index.html").write_text(page, encoding="utf-8")
    print("wrote", HERE / "index.html")


if __name__ == "__main__":
    main()
