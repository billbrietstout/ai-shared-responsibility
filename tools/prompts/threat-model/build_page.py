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


def prompt_block(p: dict, pack: dict) -> str:
    tmpl = p["template"].replace("{{shared_rules}}", pack["shared_rules"])
    pid = p["id"]
    label = f"{p['id']} · {p['title']} · Track {p.get('track', 'A')}"
    return f"""      <div class="prompt-block is-collapsed" id="{esc(pid)}-block">
        <div class="prompt-block__header">
          <span class="prompt-block__label">{esc(label)}</span>
          <div class="prompt-block__actions">
            <button class="prompt-block__toggle" type="button" onclick="togglePrompt('{esc(pid)}-block', this)" aria-expanded="false">Show</button>
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
    return f"""      <p class="section-label">{esc(qid.upper())}. {esc(q['question'])}</p>
      <p class="section-note">{esc(title)}</p>
{blocks}
"""


def main():
    pack = PACK
    track_b = [p for p in pack["prompts"] if p["track"] == "B"]
    baselines = pack["baseline_prompts"]
    pb = "\n".join(f"<li><strong>{esc(q['letter'])}</strong> {esc(q['name'])}: {esc(q['ask'])}</li>" for q in pack["phantom_b_questions"])
    def role_li(r):
        rest = r["tradecraft"]
        if ". " in rest:
            rest = rest.split(". ", 1)[1]
        return f"<li><strong>{esc(r['label'])}</strong> ({esc(r['id'])}). {esc(rest)}</li>"

    roles = "\n".join(role_li(r) for r in pack["roles"])
    q1 = stage_section("q1", "Read the diagram into a solution description. Each step is filled with the prior JSON.", pack)
    q2 = stage_section("q2", "STRIDE on in-scope elements and crossing flows. PHANTOM-B on the LLM subset. Then merge.", pack)
    q3 = stage_section("q3", "Map CIA, STRIDE, and PHANTOM-B letters. Then choose mitigate, eliminate, transfer, or accept in P-act.", pack)
    q4 = stage_section("q4", "Mechanical self-check before SME review.", pack)
    track_b_html = "\n".join(prompt_block(p, pack) for p in track_b)
    baseline_html = "\n".join(prompt_block(dict(p, track="eval"), pack) for p in baselines)
    role_ids = ", ".join(r["id"] for r in pack["roles"])

    page = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI System Diagram Threat Modeling · AI Shared Responsibility</title>
    <meta
      name="description"
      content="Prompts that read an AI system diagram (image, Mermaid, or SVG) and write a threat matrix. Track A walks Shostack's Four Questions. Track B writes one SRF persona onto each threat. Gold diagrams and scores live in eval/threat-model/."
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
  "name": "AI System Diagram Threat Modeling Prompts",
  "url": "https://aisharedresponsibility.com/tools/prompts/threat-model/",
  "description": "Prompts that read an AI system diagram and write a threat matrix. Track A walks Shostack's Four Questions. Track B writes one SRF persona onto each threat.",
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
          threat matrix. Track A walks Shostack's Four Questions; each step is filled
          with the previous step's JSON (the Auspex chain shape). Track B writes layer,
          persona, and party onto each threat. Templates:
          <a href="/tools/prompts/threat-model/prompts.json">prompts.json</a>.
          Scores and gold diagrams: <code>eval/threat-model/</code>.
        </p>
      </div>
    </header>

    <main id="main" class="page-body" data-llm="threat-model-prompts">

      <p class="section-label">How to run the chain</p>
      <ol class="q-list">
        <li>Paste the shared rules once, or use each step as a standalone copy block (rules are inlined).</li>
        <li>Attach or paste the diagram. Set <code>{{{{representation_kind}}}}</code> to image, mermaid, or svg.</li>
        <li>Pick a role: {esc(role_ids)}. Default is experienced-threat-modeler.</li>
        <li>Run Track A in order from P-norm through P-qa. Each step consumes the prior JSON.</li>
        <li>Optionally run Track B (P-srf-join, P-srf-layer, P-srf-owner) with an operating model.</li>
        <li>Do not rephrase Shostack's four questions. Do not put mitigations in P-phantom.</li>
      </ol>

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
        <li>CoSAI SRF accountability data: <a href="/data/threats.json">threats.json</a>, <a href="/data/personas.json">personas.json</a>, <a href="/data/matrix.json">matrix.json</a>.</li>
      </ul>

      <p class="section-label">Lane</p>
      <p class="section-note">
        Track A elicits threats from the diagram and classifies them. Track B writes one
        SRF persona and one party onto each threat. If matrix.json says shared, still
        name one lead. Cite an OWASP, ATLAS, or AI Exchange id only when it exists in
        that source.
      </p>

{q1}
{q2}
{q3}
{q4}

      <p class="section-label">Track B (optional): SRF accountability</p>
      <p class="section-note">
        Off by default. Consumes the Track A matrix plus an operating model.
        Join published AI Exchange slugs from threats.json instead of re-deriving them.
      </p>
{track_b_html}

      <p class="section-label">Evaluation baselines</p>
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
        navigator.clipboard.writeText(pre.textContent).then(() => {{
          btn.textContent = 'Copied!';
          btn.classList.add('prompt-block__copy--copied');
          setTimeout(() => {{
            btn.textContent = 'Copy';
            btn.classList.remove('prompt-block__copy--copied');
          }}, 2000);
        }});
      }}
    </script>
  </body>
</html>
"""
    (HERE / "index.html").write_text(page, encoding="utf-8")
    print("wrote", HERE / "index.html")


if __name__ == "__main__":
    main()
