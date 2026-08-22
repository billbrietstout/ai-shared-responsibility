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
    if nxt:
        nxt_p = prompt_by_id(pack, nxt)
        nxt_title = nxt_p["title"] if nxt_p else nxt
        follow = f"Next prompt: {nxt} ({nxt_title})."
    elif optional_next:
        nxt_p = prompt_by_id(pack, optional_next)
        nxt_title = nxt_p["title"] if nxt_p else optional_next
        if pid == "P-export-json":
            follow = (
                f"Export ends here. Paste the assistant output into the download box "
                f"and save the markdown and JSON files. If Track B is not yet applied, "
                f"optional next: {optional_next} ({nxt_title}). If Track B is already "
                f"applied, stop."
            )
        else:
            follow = (
                f"This step ends here. Optional next: {optional_next} ({nxt_title})."
            )
    elif pid == "P-srf-owner":
        follow = (
            "Track B is filled. Next, re-run P-export-md on this JSON so the "
            "downloadable report includes layer, persona, and party."
        )
    else:
        follow = "This prompt is not in the default chain."
    echo = (
        "Do not echo this line in the markdown."
        if pid == "P-export-md"
        else "Do not echo this line in the JSON."
    )
    return f"[chain] This prompt is {pid} ({title}). {follow} {echo}\n\n"


def prompt_block(p: dict, pack: dict, *, collapsed: bool = True) -> str:
    tmpl = operator_banner(p, pack) + p["template"].replace(
        "{{shared_rules}}", pack["shared_rules"]
    )
    pid = p["id"]
    entry = chain_entry(pack, pid)
    nxt_req = (entry or {}).get("next")
    nxt_opt = (entry or {}).get("optional_next")
    nxt = nxt_req or nxt_opt
    track = p.get("track", "A")
    track_label = "Export" if track == "export" else f"Track {track}"
    if nxt_req:
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
    export_prompts = [p for p in pack["prompts"] if p["track"] == "export"]
    baselines = pack["baseline_prompts"]
    pb = "\n".join(f"<li><strong>{esc(q['letter'])}</strong> {esc(q['name'])}: {esc(q['ask'])}</li>" for q in pack["phantom_b_questions"])
    def role_li(r):
        rest = r["tradecraft"]
        if ". " in rest:
            rest = rest.split(". ", 1)[1]
        return f"<li><strong>{esc(r['label'])}</strong> ({esc(r['id'])}). {esc(rest)}</li>"

    roles = "\n".join(role_li(r) for r in pack["roles"])
    q1 = stage_section("q1", "Read the diagram into a solution description. Then state attackers and existing controls. Each step is filled with the prior JSON.", pack)
    q2 = stage_section("q2", "STRIDE on in-scope elements and crossing flows. PHANTOM-B on the LLM subset. Then merge.", pack)
    q3 = stage_section("q3", "Map CIA, STRIDE, and PHANTOM-B letters. Then choose mitigate, eliminate, transfer, or accept in P-act, with a validation on mitigate and eliminate.", pack)
    q4 = stage_section("q4", "Mechanical self-check, then write the readable report. Leave the reviewer line empty.", pack)
    track_b_html = "\n".join(prompt_block(p, pack) for p in track_b)
    export_html = "\n".join(
        prompt_block(p, pack, collapsed=False) for p in export_prompts
    )
    baseline_html = "\n".join(prompt_block(dict(p, track="eval"), pack) for p in baselines)
    role_ids = ", ".join(r["id"] for r in pack["roles"])
    steps = []
    for c in pack["chain"]:
        p = prompt_by_id(pack, c["id"])
        steps.append({
            "id": c["id"],
            "title": p["title"] if p else c["id"],
            "next": c.get("next"),
            "optional_next": c.get("optional_next"),
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
    <title>AI System Diagram Threat Modeling · AI Shared Responsibility</title>
    <meta
      name="description"
      content="Prompts that read an AI system diagram (image, Mermaid, or SVG) and write a threat matrix plus a downloadable markdown report and completed JSON. Track A walks Shostack's Four Questions. Track B writes one SRF persona onto each threat. Eval report at /eval/threat-model/."
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
      .deliverable p, .deliverable ul {{
        margin: 0 0 var(--sp-3);
        font-size: var(--text-sm);
        color: var(--slate-700);
        line-height: var(--leading-normal);
      }}
      .deliverable ul {{
        padding-left: 1.2rem;
      }}
      .deliverable :last-child {{
        margin-bottom: 0;
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
      .export-dock label {{
        display: block;
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--slate-400);
        margin: var(--sp-4) 0 var(--sp-2);
      }}
      .export-dock textarea {{
        display: block;
        width: 100%;
        min-height: 14rem;
        box-sizing: border-box;
        padding: var(--sp-3);
        border: 1px solid var(--slate-200);
        border-radius: var(--radius);
        font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;
        font-size: 0.8rem;
        line-height: 1.5;
        color: var(--slate-800);
        resize: vertical;
      }}
      .export-dock__actions {{
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-3);
        margin-top: var(--sp-4);
      }}
      .export-dock__actions button {{
        font-size: var(--text-xs);
        font-weight: 600;
        color: #fff;
        background: var(--cosai-navy);
        border: 0;
        border-radius: var(--radius);
        padding: 8px 14px;
        cursor: pointer;
      }}
      .export-dock__status {{
        margin: var(--sp-3) 0 0;
        font-size: var(--text-sm);
        color: var(--slate-600);
      }}
    </style>
    <script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "name": "AI System Diagram Threat Modeling Prompts",
  "url": "https://aisharedresponsibility.com/tools/prompts/threat-model/",
  "description": "Prompts that read an AI system diagram and write a threat matrix plus a downloadable markdown report and completed JSON. Track A walks Shostack's Four Questions. Track B writes one SRF persona onto each threat.",
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
        <span class="page-hero__eyebrow"><a href="/tools/">Tools</a> / <a href="/tools/prompts/">System Instructions</a> / Threat modeling</span>
        <h1 class="page-hero__title">AI system diagram threat modeling</h1>
        <p class="page-hero__lede">
          Prompts that read an AI system diagram (image, Mermaid, or SVG) and write a
          threat matrix plus a downloadable markdown report and completed JSON.
          Track A walks Shostack's Four Questions; each step is filled with the previous
          step's JSON (the Auspex chain shape). Track B writes layer, persona, and party
          onto each threat. After either track, run the export pair and save both files
          from the download box. Templates:
          <a href="/tools/prompts/threat-model/prompts.json">prompts.json</a>.
          <a href="/eval/threat-model/">How this pack scores against three published threat models</a>.
        </p>
      </div>
    </header>

    <main id="main" class="page-body" data-llm="threat-model-prompts">

      <p class="section-label">How to run the chain</p>
      <ol class="q-list">
        <li>Paste the shared rules once, or use each step as a standalone copy block (rules are inlined).</li>
        <li>Attach or paste the diagram. Set <code>{{{{representation_kind}}}}</code> to image, mermaid, or svg.</li>
        <li>Pick a role: {esc(role_ids)}. Default is experienced-threat-modeler.</li>
        <li>Copy one block at a time. The copied text starts with a <code>[chain]</code> line that names this step and the next. The strip below this list remembers the last Copy click.</li>
        <li>Run Track A in order from P-norm through P-report. After P-sol, run P-adv and P-controls before STRIDE. After P-qa, run P-report.</li>
        <li>Optionally run <a href="#track-b">Track B</a> (P-srf-join, P-srf-layer, P-srf-owner) with an operating model.</li>
        <li>After the track you used, run <a href="#export-report">P-export-md</a> then P-export-json. Paste each assistant reply into the download box and save the <code>.md</code> and <code>.json</code> files.</li>
        <li>Do not rephrase Shostack's four questions. Do not put mitigations in P-phantom.</li>
      </ol>

      <p class="section-label">On this page</p>
      <ul class="q-list">
        <li><a href="#q1">Track A: Four Questions</a></li>
        <li><a href="#track-b">Track B (optional)</a></li>
        <li><a href="#export-report">Export the report and JSON</a></li>
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
        Ask these eight questions for each chatbot or model-runtime node. STRIDE still
        applies to every component. Write mitigations in P-act.
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
      </ul>

      <p class="section-label">Lane</p>
      <p class="section-note">
        Track A elicits threats from the diagram and classifies them. Track B writes one
        SRF persona and one party onto each threat. If matrix.json says shared, still
        name one lead. Cite an OWASP, ATLAS, or AI Exchange id only when it exists in
        that source. After either track, the export pair writes the files a reviewer
        can keep: a markdown report and the completed JSON.
      </p>

{q1}
{q2}
{q3}
{q4}

      <div class="deliverable" id="track-a-output">
        <p class="deliverable__title">What Track A has filled</p>
        <p>
          The assistant JSON after P-report is the Track A matrix. Optional
          <a href="#track-b">Track B</a> is next. Then run the
          <a href="#export-report">export pair</a> to produce the downloadable files.
          Schema:
          <a href="/eval/threat-model/schema.json">eval/threat-model/schema.json</a>.
          Eval path: <code>&lt;system-id&gt;/image.json</code> (or
          <code>mermaid.json</code> / <code>svg.json</code>).
        </p>
        <ul>
          <li><code>inventory</code>, <code>solution_description</code>, <code>llm_subset</code>.</li>
          <li><code>adversary</code>: assumptions and positions (who already sits in which zone).</li>
          <li><code>existing_controls</code>: only features drawn on the diagram.</li>
          <li><code>claim_boundary</code>: what this review does not claim, plus the time or component box.</li>
          <li><code>threats</code>: ids T1, T2, and so on. Each row has <code>scenario</code>, <code>diagram_referent</code>, <code>attacker_position</code>, STRIDE letters, PHANTOM-B letters when the referent is an LLM node, CIA, one <code>action</code>, and <code>validation</code> on mitigate or eliminate.</li>
          <li><code>qa</code> and <code>report.markdown</code>. Leave <code>report.reviewer</code> empty.</li>
        </ul>
        <p>
          Track B is optional and reads the same JSON. After the track you used,
          save files from the <a href="#export-report">export section</a>.
        </p>
      </div>

      <p class="section-label" id="track-b">Track B (optional): SRF accountability</p>
      <p class="section-note">
        Off by default. Consumes the Track A JSON plus an operating model.
        Join published AI Exchange slugs from threats.json instead of re-deriving them.
      </p>
{track_b_html}

      <div class="deliverable" id="track-b-output">
        <p class="deliverable__title">What Track B has filled</p>
        <p>
          The assistant JSON after P-srf-owner is the Track A matrix with
          <code>srf</code> on every threat. Same schema;
          <code>chain_meta.track_b_applied</code> is true. Re-run the export pair
          on this JSON so the markdown report includes layer, persona, and party.
        </p>
        <ul>
          <li><code>srf.layer</code>: L1 to L5, the layer where the control point lives.</li>
          <li><code>srf.persona</code>: one id from <a href="/data/personas.json">personas.json</a>.</li>
          <li><code>srf.party</code>: <code>customer</code> or <code>provider</code>. Never <code>shared</code>.</li>
          <li><code>srf.join.ai_exchange_slug</code>: a published slug from <a href="/data/threats.json">threats.json</a>, or null.</li>
        </ul>
        <p>
          Track B does not add threats. A threat with no matching slug still needs
          layer, persona, and party from P-srf-layer and P-srf-owner. Next, run
          <a href="#export-report">Export the report and JSON</a> on this JSON.
        </p>
      </div>

      <p class="section-label" id="export-report">Export the report and JSON</p>
      <p class="section-note">
        These two prompts run after Track A, and again after Track B if you used it.
        P-export-md writes the readable report. P-export-json writes the completed
        record. Paste each assistant reply into the box below and download both
        files. Leave the reviewer line empty.
      </p>
{export_html}

      <div class="deliverable export-dock" id="export-dock">
        <p class="deliverable__title">Download the files</p>
        <p>
          Paste the P-export-md reply and click Download markdown. Paste the
          P-export-json reply and click both buttons: markdown comes from
          <code>report.markdown</code>, and JSON is pretty-printed. Filenames use
          <code>system_name</code> when the paste is JSON.
        </p>
        <label for="export-paste">Assistant output</label>
        <textarea id="export-paste" spellcheck="false" placeholder="Paste the markdown report or the completed JSON here."></textarea>
        <div class="export-dock__actions">
          <button type="button" id="export-md">Download markdown</button>
          <button type="button" id="export-json">Download JSON</button>
        </div>
        <p class="export-dock__status" id="export-status" aria-live="polite"></p>
      </div>

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
        Gold diagrams (five systems, three formats) and the scoring scripts are in
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
        return s.next || s.optional_next || null;
      }}
      function nextIsOptional(id) {{
        const s = stepById(id);
        return Boolean(s && !s.next && s.optional_next);
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
          const optional = lastId && nextIsOptional(lastId);
          nextLabel.textContent = nxt + ' (' + titleOf(nxt) + ')' + (optional ? ', optional Track B' : '');
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
      function slugifyName(name) {{
        const slug = String(name || 'threat-model')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        return slug || 'threat-model';
      }}
      function stripFences(text) {{
        const trimmed = String(text || '').trim();
        const m = trimmed.match(/^```(?:json|markdown|md)?\\s*\\n([\\s\\S]*?)\\n```\\s*$/i);
        return m ? m[1] : trimmed;
      }}
      function firstHeading(md) {{
        const m = String(md || '').match(/^#\\s+(?:Threat model:\\s*)?(.+)$/m);
        return m ? m[1].trim() : '';
      }}
      function parseExportPaste(raw) {{
        const text = stripFences(raw);
        if (!text) return {{ kind: 'empty' }};
        if (text.charAt(0) === '{{' || text.charAt(0) === '[') {{
          try {{
            return {{ kind: 'json', obj: JSON.parse(text) }};
          }} catch (err) {{
            return {{ kind: 'text', text: text, error: 'JSON parse failed' }};
          }}
        }}
        return {{ kind: 'markdown', text: text }};
      }}
      function downloadBlob(filename, content, mime) {{
        const blob = new Blob([content], {{ type: mime }});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }}
      function setExportStatus(msg) {{
        const el = document.getElementById('export-status');
        if (el) el.textContent = msg;
      }}
      function downloadMarkdown() {{
        const parsed = parseExportPaste((document.getElementById('export-paste') || {{}}).value);
        if (parsed.kind === 'empty') {{
          setExportStatus('Paste the markdown report or the completed JSON first.');
          return;
        }}
        let md = '';
        let slug = 'threat-model';
        if (parsed.kind === 'json') {{
          md = parsed.obj && parsed.obj.report && parsed.obj.report.markdown;
          if (!md) {{
            setExportStatus('That JSON has no report.markdown. Paste the P-export-md reply, or run P-export-json.');
            return;
          }}
          slug = slugifyName(parsed.obj.system_name);
        }} else {{
          md = parsed.text;
          slug = slugifyName(firstHeading(md) || 'threat-model');
        }}
        const name = slug + '-threat-model.md';
        downloadBlob(name, md, 'text/markdown;charset=utf-8');
        setExportStatus('Saved ' + name + '.');
      }}
      function downloadJsonFile() {{
        const parsed = parseExportPaste((document.getElementById('export-paste') || {{}}).value);
        if (parsed.kind === 'empty') {{
          setExportStatus('Paste the completed JSON first.');
          return;
        }}
        if (parsed.kind !== 'json') {{
          setExportStatus('That paste is markdown. Paste the P-export-json reply to save the JSON file.');
          return;
        }}
        const slug = slugifyName(parsed.obj.system_name);
        const name = slug + '-threat-model.json';
        downloadBlob(name, JSON.stringify(parsed.obj, null, 2) + '\\n', 'application/json;charset=utf-8');
        setExportStatus('Saved ' + name + '.');
      }}
      document.addEventListener('DOMContentLoaded', () => {{
        const copyNextBtn = document.getElementById('chain-copy-next');
        if (copyNextBtn) copyNextBtn.addEventListener('click', copyNext);
        const mdBtn = document.getElementById('export-md');
        const jsonBtn = document.getElementById('export-json');
        if (mdBtn) mdBtn.addEventListener('click', downloadMarkdown);
        if (jsonBtn) jsonBtn.addEventListener('click', downloadJsonFile);
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
