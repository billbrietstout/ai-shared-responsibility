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
    version = pack["version"]
    return f"""Attach this system representation. Load https://aisharedresponsibility.com/tools/prompts/threat-model/prompts.json.

Use pack version {version}, runtime_defaults, chain_execution, and operator_initial_inputs. Run required Track A from P-context through P-report, then P-export-md, P-export-json, P-export-csv, and P-export-diagram. Fill every later template slot from accumulated JSON. Keep the representation attached when a template includes {{{{representation}}}}. Set representation_kind to image, mermaid, or svg. Role: experienced-threat-modeler unless this message names another role.

Treat omitted operator fields as empty and continue. Do not ask for review context, source records, SRF data, or continue. If this message already contains review_context_input, source_manifest, source_records, srf_inputs, or vertical_source_rows, use those values.

Do not skip a step. If a stop_condition fails, record the gap in that step's JSON and continue later steps that can run. When a chain object has repeat_until, rerun that same step with its cumulative prior output until the condition is true, in this same reply.

Do not fetch catalog or SRF data. Use data/threat-sources.json as the named source registry only. An omitted or empty source_manifest makes catalog coverage not_applicable. Track B runs only when this message includes srf_inputs. Track C runs only after Track B when this message includes vertical_ids and vertical_source_rows.

Leave report.reviewer empty.
Do not rephrase Shostack's four questions. Do not put mitigations in P-phantom."""


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
            <button class="prompt-block__copy" type="button" onclick="copyPrompt('{esc(pid)}-block', this)">Copy</button>
          </div>
        </div>
        <pre>{esc(tmpl)}</pre>
      </div>"""


def stage_section(qid: str, title: str, pack: dict) -> str:
    q = next(x for x in pack["four_questions"] if x["id"] == qid)
    ids = q["prompts"]
    by = {p["id"]: p for p in pack["prompts"]}
    blocks = "\n".join(prompt_block(by[i], pack) for i in ids)
    return f"""      <p class="section-label" id="{esc(qid)}">{esc(qid.upper())}. {esc(q['question'])}</p>
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
    shortcut = shortcut_text(pack)
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
      }}
      .deliverable p, .deliverable ul, .deliverable ol {{
        margin: 0 0 var(--sp-3);
        font-size: var(--text-sm);
        color: var(--slate-700);
        line-height: var(--leading-normal);
      }}
      .deliverable ul, .deliverable ol {{
        padding-left: 1.2rem;
      }}
      .deliverable :last-child {{
        margin-bottom: 0;
      }}
      .shortcut-paste {{
        position: relative;
        margin: 0;
      }}
      .shortcut-paste pre {{
        margin: 0;
        padding: var(--sp-4);
        padding-top: 2.4rem;
        background: var(--slate-50);
        border: 1px solid var(--slate-200);
        border-radius: var(--radius);
        font-size: 0.8rem;
        line-height: 1.55;
        color: var(--slate-800);
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;
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
      .prompt-block pre {{
        margin: 0;
        padding: var(--sp-6);
        font-size: 0.8rem;
        line-height: 1.65;
        color: #e2e8f0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;
        max-height: 2400px;
      }}
      .prompt-block.is-collapsed pre {{
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
        opacity: 0;
        overflow: hidden;
      }}
      .section-label {{
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--slate-400);
        margin: var(--sp-10) 0 var(--sp-3);
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
          Prompts that read a system representation (image, Mermaid, or SVG) and write a
          threat matrix, a markdown report, completed JSON, a threat-database CSV,
          and a Mermaid threat-model diagram.
          Track A requires a traditional-security applicability decision, typed STRIDE,
          conditional abuse and operational passes, PHANTOM-B for the AI subset, and
          AI-to-traditional composition coverage. Optional Track B assigns SRF
          accountability. Optional Track C joins vertical obligations and controls.
          Then run the export steps once and save the
          <code>.md</code>, <code>.json</code>, <code>.csv</code>, and <code>.mmd</code> replies.
          The one-chat shortcut lists optional first-message fields on the page, not in the copied text.
          Templates:
          <a href="/tools/prompts/threat-model/prompts.json">prompts.json</a>.
          <a href="/tools/prompts/threat-model/releases/">Release notes</a>.
          <a href="/eval/threat-model/">Evaluation method and fixtures</a>.
        </p>
      </div>
    </header>

    <main id="main" class="page-body" data-llm="threat-model-prompts">

      <div class="deliverable" id="shortcut">
        <p class="deliverable__title">Shortcut: one chat</p>
        <p>
          Copy the block below and send it once with the representation.
          Optional fields you may add in that same message are listed here;
          they are not in the copied text. The model loads
          <a href="/tools/prompts/threat-model/prompts.json">prompts.json</a>
          and runs Track A through the four exports without asking for more
          input and without waiting for continue. Omitted fields stay empty.
          Catalog, SRF, and vertical mapping without injected data are not
          applicable.
        </p>
        <ol>
          <li>Required in the first message: the representation and <code>representation_kind</code> (<code>image</code>, <code>mermaid</code>, or <code>svg</code>).</li>
          <li>Optional in that same message: role, <code>review_context_input</code> (profile, confirmation for artifact-only, perspective, verticals, jurisdictions, operating model, assets, prohibited outcomes, continuity or safety constraints, supplied severity, scope), <code>if_no_ai_nodes</code>, <code>source_manifest</code> and pinned source records, SRF rows for Track B, vertical source rows for Track C.</li>
          <li>Default role is experienced-threat-modeler. Default <code>if_no_ai_nodes</code> is <code>continue_without_llm</code>.</li>
          <li>The model fills later templates from accumulated JSON. Repeat_until steps rerun in the same reply. A failed stop_condition is recorded as a JSON gap, not a question.</li>
          <li>Save the four export replies as <code>.md</code>, <code>.json</code>, <code>.csv</code>, and <code>.mmd</code>.</li>
        </ol>
        <p>
          If the chat cannot load that file, use the copy-one-block steps under
          How to run the chain. Those blocks still do not ask for fields that
          belong in the first message.
        </p>
        <div class="shortcut-paste">
          <button type="button" id="shortcut-copy">Copy</button>
          <pre id="shortcut-text">{esc(shortcut)}</pre>
        </div>
      </div>

      <p class="section-label">How to run the chain</p>
      <ol class="q-list">
        <li>Prefer the one-chat shortcut. Optional fields stay on this page; add any you have in the same first message. The model runs the required chain without a later prompt from you.</li>
        <li>If you copy one block at a time, paste the shared rules once or use a standalone copy block (rules are inlined). Attach or paste the diagram. Set <code>{{{{representation_kind}}}}</code> to image, mermaid, or svg.</li>
        <li>Pick a role: {esc(role_ids)}. Default is experienced-threat-modeler.</li>
        <li>Copy-one-block text starts with a <code>[chain]</code> line that names this step and the next. The strip below this list remembers the last Copy click. Still do not send a later message to supply optional fields; add those in the first message if you have them.</li>
        <li>Run Track A in order. A chain run repeats P-stride in the same reply until its typed denominator closes. P-importance is required before P-act.</li>
        <li>Track B runs only when the first message includes B and SRF inputs. Track C runs only after Track B when that message also includes vertical ids and vertical source rows. Otherwise skip those tracks and go to P-report.</li>
        <li>After P-report, run <a href="#export-report">P-export-md</a>, P-export-json, P-export-csv, then P-export-diagram. Save those replies as <code>.md</code>, <code>.json</code>, <code>.csv</code>, and <code>.mmd</code>.</li>
        <li>Do not rephrase Shostack's four questions. Do not put mitigations in P-phantom.</li>
      </ol>

      <p class="section-label">On this page</p>
      <ul class="q-list">
        <li><a href="#shortcut">Shortcut: one chat</a></li>
        <li><a href="#q1">Track A: Four Questions</a></li>
        <li><a href="#track-b">Track B (optional)</a></li>
        <li><a href="#track-c">Track C (optional)</a></li>
        <li><a href="#export-report">Export the report, JSON, CSV, and diagram</a></li>
        <li><a href="#baselines">Evaluation baselines</a></li>
      </ul>

      <div class="chain-status" id="chain-status">
        <p class="chain-status__text" aria-live="polite">
          Last copied: <strong id="chain-last">none</strong>.
          Next: <strong id="chain-next">P-norm (Normalize representation)</strong>.
        </p>
        <button type="button" class="chain-status__btn" id="chain-copy-next">Copy next</button>
      </div>

      <p class="section-label">Shostack's Four Questions</p>
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

      <p class="section-label">PHANTOM-B questions (LLM subset)</p>
      <ul class="pb-list">
        {pb}
      </ul>
      <p class="section-note">
        Ask these eight questions for each eligible AI node after traditional
        applicability closes. Write mitigations in P-act.
      </p>

      <p class="section-label">Roles</p>
      <ul class="cite-list">
        {roles}
      </ul>

      <p class="section-label">Sources</p>
      <ul class="cite-list">
        <li>Adam Shostack, <a href="https://shostack.org/files/papers/The_Four_Question_Framework.pdf">The Four Question Framework for Threat Modeling</a> (CC-BY).</li>
        <li>Adam Shostack, <a href="https://shostack.org/files/papers/PHANTOM-B_Whitepaper_Shostack.pdf">PHANTOM-B: A STRIDE Analog for LLMs</a> (CC-BY).</li>
        <li>Crossman et al., <a href="https://arxiv.org/abs/2503.09586">Auspex</a> (arXiv:2503.09586). Two-stage chain, cumulative prompt fill, threat matrix, SME evaluation. The prompts here are rebuilt from the paper's published figures. JPMC's withheld tradecraft text is not in this pack.</li>
        <li>IETF <a href="https://datatracker.ietf.org/doc/html/rfc6819">RFC 6819</a>. Attack assumptions and existing features are stated before new threats. Do not copy its OAuth threat list onto an unrelated diagram.</li>
        <li>CoSAI SRF accountability data: <a href="/data/threats.json">threats.json</a>, <a href="/data/personas.json">personas.json</a>, <a href="/data/matrix.json">matrix.json</a>.</li>
        <li>External source registry: <a href="/data/threat-sources.json">threat-sources.json</a>. A run records the exact source versions and hashes in <code>source_manifest</code>.</li>
      </ul>

      <p class="section-label">Lane</p>
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
        <p class="deliverable__title">What Track A has filled</p>
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
          <li><code>qa</code> records failed checks. P-report later fills <code>report.markdown</code>. Leave <code>report.reviewer</code> empty.</li>
        </ul>
        <p>
          Track B and Track C are optional. After the selected tracks, return to
          P-report. Then run the <a href="#export-report">export steps</a> and save the
          <code>.md</code>, <code>.json</code>, <code>.csv</code>, and
          <code>.mmd</code> replies.
        </p>
      </div>

      <p class="section-label" id="track-b">Track B (optional): SRF accountability</p>
      <p class="section-note">
        Branch here after P-qa when an SRF report, operating-model assignment, or
        vertical join is requested. Track B consumes the checked Track A matrix,
        a supplied operating model, and injected local SRF data. It checks expected
        L1 to L5 coverage before returning to P-report or Track C.
      </p>
{track_b_html}

      <div class="deliverable" id="track-b-output">
        <p class="deliverable__title">What Track B has filled</p>
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

      <p class="section-label" id="track-c">Track C (optional): vertical obligations and routing</p>
      <p class="section-note">
        Run Track C only after Track B closes. It joins supported vertical and
        jurisdiction rows to existing threat ids. It cannot add a threat or treat a
        candidate control as an existing control.
      </p>
{track_c_html}

      <div class="deliverable" id="track-c-output">
        <p class="deliverable__title">What Track C has filled</p>
        <ul>
          <li>Applicable obligation citations from injected regulation or crosswalk rows.</li>
          <li>Candidate controls kept separate from diagram-visible existing controls.</li>
          <li>One accountable persona and acceptance authority when the source data identifies them.</li>
          <li>Unresolved authority or applicability gaps instead of guessed assignments.</li>
        </ul>
      </div>

      <p class="section-label" id="export-report">Export the report, JSON, CSV, and diagram</p>
      <p class="section-note">
        These four prompts run once after P-report.
        P-export-md emits the stored report without rewriting it (<code>.md</code>).
        P-export-json writes the completed record (<code>.json</code>).
        P-export-csv writes one row per threat with stable SRF columns. Track A leaves
        those cells empty (<code>.csv</code>).
        P-export-diagram writes a Mermaid data-flow of the inventory with threat
        ids on their referents (<code>.mmd</code>). It uses only inventory ids.
        Leave the reviewer line empty.
      </p>
{export_html}

      <p class="section-label" id="baselines">Evaluation baselines</p>
      <p class="section-note">
        P-zeroshot and P-identity are the two short baselines scored in
        <code>eval/threat-model/</code>. Machine scores stay open until the SME sheets
        in that directory are filled.
      </p>
{baseline_html}

      <p class="section-label">Output schema</p>
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
        if (!id) return 'P-norm';
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
      function copyShortcut() {{
        const pre = document.getElementById('shortcut-text');
        const btn = document.getElementById('shortcut-copy');
        if (!pre || !btn) return;
        navigator.clipboard.writeText(pre.textContent).then(() => {{
          btn.textContent = 'Copied';
          btn.classList.add('is-copied');
          setTimeout(() => {{
            btn.textContent = 'Copy';
            btn.classList.remove('is-copied');
          }}, 2000);
        }});
      }}
      document.addEventListener('DOMContentLoaded', () => {{
        const copyNextBtn = document.getElementById('chain-copy-next');
        if (copyNextBtn) copyNextBtn.addEventListener('click', copyNext);
        const shortcutBtn = document.getElementById('shortcut-copy');
        if (shortcutBtn) shortcutBtn.addEventListener('click', copyShortcut);
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
