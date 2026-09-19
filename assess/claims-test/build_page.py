#!/usr/bin/env python3
"""Authoring helper: rebuild index.html from prompts.json. Not a site build step.
The committed HTML is the page; re-run this after editing prompts.json."""
from __future__ import annotations

import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PACK = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))
OUT = HERE / "index.html"


def esc(s: str) -> str:
    return html.escape(s, quote=False)


PACK_URL = "https://aisharedresponsibility.com/assess/claims-test/prompts.json"


def pack_load_block() -> str:
    return f"""Load the claims-test pack.
If this message already contains prompts.json (paste or attachment), use that copy.
Else fetch {PACK_URL}. That one fetch is required. The pack is not a pinned_source. Empty pinned_sources does not block the chain.
Do not fetch any other URL. Citation, catalog, and SRF URLs stay unread unless they appear in pinned_sources in this message."""


def chain_run_output_block() -> str:
    return """Execute every required step internally. Do not print intermediate JSON or prompt-id headings.
Reply with the markdown report only. Start at the title heading. No JSON wrapper. No fences around the document.
Write every suggestion packet in full in that report (anchor, why it fails, and the replacement or review comment and diff). Save this reply as a .md file.
Emit schema JSON only if this message asks for JSON."""


def shortcut_text_a(pack: dict) -> str:
    version = pack["version"]
    return f"""Paste the draft body in this message.
{pack_load_block()}

Use pack version {version}, runtime_defaults, chain_execution, and operator_initial_inputs. Run required Track A from C-intake through C-report internally. Channel: google-docs unless this message names github-md or published. Mode: full unless this message names map-only or suggest-only.

{chain_run_output_block()}

Treat omitted operator fields as empty and continue. Do not ask for dimension_profile, pinned sources, SRF data, or continue. If this message already contains dimension_profile, pinned_sources, srf_inputs, or vertical_source_rows, use those values.

Do not skip a step. If a stop_condition fails, record the gap in the report QA section and continue later steps that can run. Halt the remaining chain only when C-intake cannot find an anchorable draft_body.

Track B runs only when this message includes srf_inputs. Track C runs only after Track B when this message includes vertical_source_rows.

Leave report.reviewer empty.
Do not merge this run with the whitepaper-assessment catalog grader. Do not write reproduction steps."""


def shortcut_text_b(pack: dict) -> str:
    version = pack["version"]
    return f"""Paste the draft body in this message.
{pack_load_block()}

Use pack version {version}, runtime_defaults, chain_execution, and operator_initial_inputs. Run required Track A from C-intake through C-score internally, then Track B from C-srf-join through C-srf-coverage, then C-qa, C-suggest, and C-report. Channel: google-docs unless this message names github-md or published.

{chain_run_output_block()}

Treat omitted operator fields as empty and continue. Do not ask for dimension_profile, pinned sources, SRF data, or continue. Use srf_inputs already in this message. If srf_inputs or operating_model is missing, mark Track B incomplete and continue to C-qa. Do not ask.

Do not skip a step. If a stop_condition fails, record the gap in the report QA section and continue later steps that can run. Halt the remaining chain only when C-intake cannot find an anchorable draft_body.

Track C runs only after Track B when this message also includes vertical_source_rows.

Leave report.reviewer empty.
Do not merge this run with the whitepaper-assessment catalog grader. Do not write reproduction steps."""


def shortcut_text_c(pack: dict) -> str:
    version = pack["version"]
    return f"""Paste the draft body in this message.
{pack_load_block()}

Use pack version {version}, runtime_defaults, chain_execution, and operator_initial_inputs. Run required Track A from C-intake through C-score internally, then Track B from C-srf-join through C-srf-coverage, then Track C from C-vertical-join through C-vertical-route, then C-qa, C-suggest, and C-report. Channel: google-docs unless this message names github-md or published.

{chain_run_output_block()}

Treat omitted operator fields as empty and continue. Do not ask for dimension_profile, pinned sources, SRF data, or continue. Use srf_inputs and vertical_source_rows already in this message. If Track B cannot close, skip Track C, record the gap, and continue to C-qa. Do not ask.

Do not skip a step. If a stop_condition fails, record the gap in the report QA section and continue later steps that can run. Halt the remaining chain only when C-intake cannot find an anchorable draft_body.

Leave report.reviewer empty.
Do not merge this run with the whitepaper-assessment catalog grader. Do not write reproduction steps."""


def shortcut_paste(pre_id: str, text: str, *, label: str, aria_label: str) -> str:
    return f"""        <div class="shortcut-paste">
          <button type="button" data-shortcut-target="{esc(pre_id)}" data-copy-label="{esc(label)}" aria-label="{esc(aria_label)}">{esc(label)}</button>
          <pre id="{esc(pre_id)}">{esc(text)}</pre>
        </div>"""


def chain_entry(pack: dict, pid: str) -> dict | None:
    return next((c for c in pack["chain"] if c["id"] == pid), None)


def _chain_next_cell(c: dict) -> str:
    nxt = c.get("next") or ""
    opt = c.get("optional_next") or ""
    if nxt and opt:
        return f"{nxt} (optional {opt})"
    if nxt:
        return nxt
    if opt:
        return f"end (optional {opt})"
    return "end"


def operator_banner(p: dict, pack: dict) -> str:
    entry = chain_entry(pack, p["id"])
    nxt = (entry or {}).get("next")
    nxt_opt = (entry or {}).get("optional_next")
    title = p["title"]
    if nxt and nxt_opt:
        trail = f" Next prompt: {nxt}. Optional route: {nxt_opt}."
    elif nxt:
        trail = f" Next prompt: {nxt}."
    else:
        trail = " The chain ends after this step."
    return (
        f"[chain] This prompt is {p['id']} ({title}).{trail} "
        "Do not echo this line in the reply.\n\n"
    )


def prompt_block(p: dict, pack: dict, *, collapsed: bool = True) -> str:
    tmpl = p["template"].replace("{{shared_rules}}", pack["shared_rules"])
    tmpl = tmpl.replace("{{pack_version}}", pack["version"])
    tmpl = operator_banner(p, pack) + tmpl
    pid = p["id"]
    entry = chain_entry(pack, pid)
    nxt_req = (entry or {}).get("next")
    nxt_opt = (entry or {}).get("optional_next")
    track = p.get("track", "A")
    if track == "export":
        track_label = "Export"
    elif track == "eval":
        track_label = "Eval"
    else:
        track_label = f"Track {track}"
    if nxt_req and nxt_opt:
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


def js_steps(pack: dict) -> str:
    rows = []
    titles = {}
    for p in pack["prompts"]:
        titles[p["id"]] = p["title"]
        entry = chain_entry(pack, p["id"]) or {}
        rows.append(
            {
                "id": p["id"],
                "title": p["title"],
                "next": entry.get("next"),
                "optional_next": entry.get("optional_next"),
                "track": p.get("track", "A"),
            }
        )
    for h in pack.get("helper_prompts", []):
        titles[h["id"]] = h["title"]
    for b in pack.get("baseline_prompts", []):
        titles[b["id"]] = b["title"]
    return (
        json.dumps(rows, ensure_ascii=True)
        + ";\n      const CT_TITLES = "
        + json.dumps(titles, ensure_ascii=True)
    )


def main() -> None:
    pack = PACK
    by_id = {p["id"]: p for p in pack["prompts"]}
    track_a_ids = [
        "C-intake",
        "C-claims",
        "C-screen",
        "C-foundations",
        "C-inventory",
        "C-tag",
        "C-roca",
        "C-score",
        "C-qa",
        "C-suggest",
        "C-report",
    ]
    track_a_html = "\n".join(prompt_block(by_id[i], pack) for i in track_a_ids)
    track_b_html = "\n".join(
        prompt_block(p, pack) for p in pack["prompts"] if p["track"] == "B"
    )
    track_c_html = "\n".join(
        prompt_block(p, pack) for p in pack["prompts"] if p["track"] == "C"
    )
    export_html = "\n".join(
        prompt_block(p, pack) for p in pack["prompts"] if p["track"] == "export"
    )
    helper_html = "\n".join(
        prompt_block(dict(h, track="A"), pack)
        for h in pack.get("helper_prompts", [])
    )
    baseline_html = "\n".join(
        prompt_block(dict(b, track="eval"), pack)
        for b in pack.get("baseline_prompts", [])
    )
    score_rows = "".join(
        f"<tr><td class=\"tier\">{esc(s['id'])}</td><td>{esc(s['meaning'])}</td></tr>"
        for s in pack["scoring"]["scores"]
    )
    tag_rows = "".join(
        f"<tr><td class=\"tier\">{esc(t['id'])}</td><td>{esc(t['use_when'])}</td></tr>"
        for t in pack["ai_tags"]
    )
    channel_rows = "".join(
        (
            f"<tr><td class=\"tier\">{esc(c['id'])}</td>"
            f"<td>{esc(c['edit_surface'])}</td>"
            f"<td>{esc(c['emit'])}</td></tr>"
        )
        for c in pack["channels"]
    )
    chain_rows = "".join(
        (
            f"<tr><td class=\"tier\">{esc(c['id'])}</td>"
            f"<td>{esc(by_id[c['id']]['title'])}</td>"
            f"<td>{esc(c['track'])}</td>"
            f"<td>{esc(_chain_next_cell(c))}</td></tr>"
        )
        for c in pack["chain"]
        if c["id"] in by_id
    )
    intake_example = pack["intake_example"]
    version = pack["version"]
    html_out = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Draft claims test · AI Shared Responsibility</title>
    <meta
      name="description"
      content="Non-interactive prompt pack that scores draft AI security whitepaper claims on risk, obligation, control, and one accountable party, then emits Google Docs or GitHub suggestion packets."
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
      .deliverable ul, .deliverable ol {{ padding-left: 1.2rem; }}
      .deliverable :last-child {{ margin-bottom: 0; }}
      .shortcut-paste {{ position: relative; margin: 0 0 var(--sp-6); }}
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
      .shortcut-more[open] > summary {{ margin-bottom: var(--sp-3); }}
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
      .q-list {{
        max-width: 720px;
        margin: 0 0 var(--sp-8);
        padding-left: 1.2rem;
        color: var(--slate-700);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }}
      .table-scroll {{ overflow-x: auto; margin-bottom: var(--sp-8); max-width: 960px; }}
      .tier-table {{ width: 100%; border-collapse: collapse; font-size: var(--text-sm); }}
      .tier-table th {{
        text-align: left;
        font-size: var(--text-xs);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--slate-500);
        font-weight: 700;
        padding: var(--sp-2) var(--sp-3);
        border-bottom: 2px solid var(--slate-200);
      }}
      .tier-table td {{
        padding: var(--sp-3);
        border-bottom: 1px solid var(--slate-100);
        color: var(--slate-700);
        vertical-align: top;
        line-height: var(--leading-snug);
      }}
      .tier-table tr:last-child td {{ border-bottom: none; }}
      .tier-table .tier {{ font-weight: 700; color: var(--slate-800); white-space: nowrap; }}
    </style>
    <script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "name": "Draft whitepaper claims test",
  "url": "https://aisharedresponsibility.com/assess/claims-test/",
  "description": "Non-interactive prompt pack that scores draft AI security whitepaper claims and emits Google Docs or GitHub suggestion packets.",
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
    <site-nav current="assess"></site-nav>

    <header class="page-hero" data-llm="summary">
      <div class="page-hero__inner">
        <span class="page-hero__eyebrow"><a href="/assess/">Assess</a> / Draft claims test / Pack v{esc(version)}</span>
        <h1 class="page-hero__title">Test draft paper claims</h1>
        <p class="page-hero__lede">
          Paste a draft once. The pack extracts claims, binds each one to a
          risk, an obligation, a control, and one accountable party, then
          replies with a markdown report that includes Google Docs or GitHub
          suggestion packets. Independently proposed; not part of CoSAI SRF v1.0.
          Templates:
          <a href="/assess/claims-test/prompts.json">prompts.json</a>.
          Schema:
          <a href="/eval/claims-test/schema.json">eval/claims-test/schema.json</a>.
        </p>
      </div>
    </header>

    <main id="main" class="page-body" data-llm="claims-test-prompts">

      <div class="callout callout--warn prompt-injection-warning" role="note">
        <strong>Prompt injection warning</strong>
        Always review prompts before referencing or copying them into an assistant, agent, or production system.
      </div>

      <div class="callout" role="note">
        <strong>Cousin, not a merge.</strong>
        <a href="/assess/whitepaper-assessment/">Whitepaper assessment</a>
        grades a paper against the principle catalogs. This pack scores draft
        claims on ROCA and writes suggestion packets. Keep them as two prompts.
      </div>

      <h2 class="section-label">On this page</h2>
      <ul class="q-list">
        <li><a href="#shortcut">Start here</a> (<a href="#shortcut-a">Track A</a>, <a href="#shortcut-b">Track B</a>, <a href="#shortcut-c">Track C</a>)</li>
        <li><a href="#intake">Intake packet</a></li>
        <li><a href="#preflight">Pre-flight helper</a></li>
        <li><a href="#copy-one-block">Run one prompt at a time</a></li>
        <li><a href="#track-a">Track A</a></li>
        <li><a href="#track-b">Track B (optional)</a></li>
        <li><a href="#track-c">Track C (optional)</a></li>
        <li><a href="#export-report">Export the report</a></li>
      </ul>

      <div class="deliverable" id="shortcut">
        <h2 class="deliverable__title">Start here: one chat</h2>
        <ol>
          <li>Paste the draft body. Set <code>channel</code> to <code>google-docs</code>, <code>github-md</code>, or <code>published</code>. For ChatGPT, also attach <a href="/assess/claims-test/prompts.json">prompts.json</a>.</li>
          <li>Copy the Track A shortcut. Send it once with the draft, the pack file if attached, and the intake fields you have.</li>
          <li>Save the reply as a <code>.md</code> file. Apply the suggestion packets in Docs or the PR, not in the chat. Ask for JSON only if a machine eval needs it.</li>
        </ol>
        <p>
          The model loads
          <a href="/assess/claims-test/prompts.json">prompts.json</a>
          (fetch or attach that file), runs Track A internally, and replies
          with the markdown report. Intermediate JSON stays internal.
          ChatGPT file upload cannot fetch the pack URL; attach
          <code>prompts.json</code> as a second file with the draft. The pack is
          not a pinned source. Omitted fields stay empty.
          SRF and vertical mapping without injected data are not applicable.
          If neither fetch nor attach is possible, use
          <a href="#copy-one-block">Run one prompt at a time</a>.
        </p>
        <h3 id="shortcut-a">Track A</h3>
        <p>
          Default path. <code>draft_body</code> and <code>channel</code> are
          enough. Default mode is <code>full</code>.
        </p>
{shortcut_paste("shortcut-text-a", shortcut_text_a(pack), label="Copy shortcut", aria_label="Copy Track A one-chat shortcut")}
        <details class="shortcut-more" id="shortcut-b">
          <summary>Track B: join SRF persona and layer</summary>
          <p>
            Use this when the first message already includes an operating model
            plus the full <a href="/data/personas.json">personas</a> and
            <a href="/data/matrix.json">matrix</a> objects. The pack does not
            fetch those files.
          </p>
{shortcut_paste("shortcut-text-b", shortcut_text_b(pack), label="Copy shortcut", aria_label="Copy Track B one-chat shortcut")}
        </details>
        <details class="shortcut-more" id="shortcut-c">
          <summary>Track C: join vertical obligations</summary>
          <p>
            Use this after Track B inputs are in the first message, plus
            <code>vertical_source_rows</code>. Vertical schemas are
            independently proposed and not CoSAI-ratified.
          </p>
{shortcut_paste("shortcut-text-c", shortcut_text_c(pack), label="Copy shortcut", aria_label="Copy Track C one-chat shortcut")}
        </details>
      </div>

      <h2 class="section-label" id="intake">Intake packet</h2>
      <p class="section-note">
        Put every answer in the first message. The chain does not pause to
        ask. Missing optional fields stay empty. Then write
        <code>Run the claims-test chain.</code>
      </p>
{shortcut_paste("intake-example", intake_example, label="Copy packet", aria_label="Copy intake packet example")}

      <h2 class="section-label">What a testable claim needs</h2>
      <p class="section-note">
        A claim is testable when the reader can point to a named risk or
        attack class, an obligation (statute, regulation, or contract), a
        control that implements the obligation (prefer NIST SP 800-53), and
        one accountable party (job title or SRF persona). Shared is analysis
        input, not a final owner. Obligation is not a control.
      </p>
      <div class="table-scroll">
        <table class="tier-table">
          <thead>
            <tr><th>Score</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            {score_rows}
          </tbody>
        </table>
      </div>

      <h2 class="section-label">Channels</h2>
      <div class="table-scroll">
        <table class="tier-table">
          <thead>
            <tr><th>Channel</th><th>How humans edit</th><th>What this pack emits</th></tr>
          </thead>
          <tbody>
            {channel_rows}
          </tbody>
        </table>
      </div>

      <h2 class="section-label">AI surface tags</h2>
      <p class="section-note">
        Model and agent surfaces are subsets of supporting infrastructure.
        Keep stage and layer on the same row when the draft names them.
      </p>
      <div class="table-scroll">
        <table class="tier-table">
          <thead>
            <tr><th>Tag</th><th>Use when</th></tr>
          </thead>
          <tbody>
            {tag_rows}
          </tbody>
        </table>
      </div>

      <h2 class="section-label" id="preflight">Pre-flight helper</h2>
      <p class="section-note">
        Optional and separate from the chain. Paste a messy draft into its
        own chat, copy the packet it emits, then start a chain run. The helper
        does not score claims.
      </p>
{helper_html}

      <h2 class="section-label" id="copy-one-block">Run one prompt at a time</h2>
      <p class="section-note">
        Use this when the chat cannot fetch or attach
        <a href="/assess/claims-test/prompts.json">prompts.json</a>.
        Copy C-intake first, then use Copy next. Intake fields still belong
        in the first message. Copy-one-block JSON steps still return JSON.
        Copy-one-block text starts with a <code>[chain]</code> line. After
        C-report, copy <a href="#export-report">C-export-md</a> to get the
        readable file. C-export-json is optional.
      </p>

      <div class="chain-status" id="chain-status">
        <p class="chain-status__text" aria-live="polite">
          Last copied: <strong id="chain-last">none</strong>.
          Next: <strong id="chain-next">C-intake (Record intake and halt if the body is not anchorable)</strong>.
        </p>
        <button type="button" class="chain-status__btn" id="chain-copy-next">Copy next</button>
      </div>

      <h2 class="section-label">Chain</h2>
      <div class="table-scroll">
        <table class="tier-table">
          <thead>
            <tr><th>Step</th><th>Purpose</th><th>Track</th><th>Next</th></tr>
          </thead>
          <tbody>
            {chain_rows}
          </tbody>
        </table>
      </div>

      <h2 class="section-label" id="track-a">Track A</h2>
      <p class="section-note">
        Required. Dimension profile swaps topic vocabulary; it does not fork
        the process. Multi-workstream drafts are allowed. C-qa flags claims
        outside the declared set as Out of scope or scope creep.
      </p>
{track_a_html}

      <h2 class="section-label" id="track-b">Track B (optional)</h2>
      <p class="section-note">
        Runs after C-score and before C-qa when <code>srf_inputs</code> is in
        the first message. Assigns layer and one persona from injected
        registries. Shared is not a final answer.
      </p>
{track_b_html}

      <h2 class="section-label" id="track-c">Track C (optional)</h2>
      <p class="section-note">
        Runs after Track B when <code>vertical_source_rows</code> is in the
        first message. Joins injected vertical obligations. Those schemas are
        independently proposed extensions to CoSAI SRF v1.0.
      </p>
{track_c_html}

      <h2 class="section-label" id="export-report">Export the report</h2>
      <p class="section-note">
        A chain run replies with the markdown report only. Save that reply as
        a <code>.md</code> file. C-report authors the document once. C-export-md
        copies it. C-export-json is optional for machine eval. Exports do not
        re-author judgment.
      </p>
{export_html}

      <h2 class="section-label">Evaluation baseline</h2>
      <p class="section-note">
        Gold fixture and schema checks live in
        <code>eval/claims-test/</code>. A claim that Track A beats zero-shot
        stays open until a second fixture and a human review of suggestion
        packets exist. Machine scores:
        <code>python3 eval/claims-test/run_eval.py --write-gold-echo</code>
        then
        <code>python3 eval/claims-test/run_eval.py --pred eval/claims-test/runs/gold-echo</code>.
      </p>
{baseline_html}

      <h2 class="section-label">Output schema</h2>
      <p class="section-note">
        Full JSON Schema:
        <a href="/eval/claims-test/schema.json">eval/claims-test/schema.json</a>.
        The gold draft is an agent-identity fixture under
        <code>eval/claims-test/gold/agent-identity-draft/</code>.
      </p>
    </main>
    <site-footer></site-footer>
    <script>
      const CT_STORAGE = 'srf.ct.lastPrompt';
      const CT_STEPS = {js_steps(pack)};

      function stepById(id) {{
        return CT_STEPS.find((s) => s.id === id) || null;
      }}
      function titleOf(id) {{
        const s = stepById(id);
        if (s) return s.title;
        return CT_TITLES[id] || id;
      }}
      function nextId(id) {{
        if (!id) return 'C-intake';
        const s = stepById(id);
        if (!s) return null;
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
          const optional = step && step.optional_next;
          let suffix = '';
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
          try {{ localStorage.setItem(CT_STORAGE, id); }} catch (err) {{}}
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
        try {{ last = localStorage.getItem(CT_STORAGE); }} catch (err) {{}}
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
        let last = null;
        try {{ last = localStorage.getItem(CT_STORAGE); }} catch (err) {{}}
        markChain(last);
        openHashDetails();
      }});
      window.addEventListener('hashchange', openHashDetails);
    </script>
  </body>
</html>
"""
    OUT.write_text(html_out, encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
