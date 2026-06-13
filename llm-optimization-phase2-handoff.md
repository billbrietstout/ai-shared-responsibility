# LLM Optimization Phase 2 — Handoff for Sonnet

**Project:** aisharedresponsibility.com  
**Workspace:** `/Users/billstout/Documents/Claude/Projects/AISharedResponsibility.com/`  
**Branch:** `develop` → push to `develop`, then `develop:main`  
**Date:** 2026-06-13  

## What was done in Phase 1 (do not redo)

- `robots.txt` — 12 AI crawlers explicitly allowed
- `sitemap.xml` — 52 URLs
- `llms.txt` — updated with data and full-content sections
- `llms-full.txt` — 319KB single-fetch doc, all 218 controls inline
- `data/index.json` — index of all 10 JSON data files
- JSON-LD — added to 47 HTML pages (TechArticle, Dataset, WebApplication)
- `developers/index.html` — 4 cards, stale badges removed

## What you are building (4 items)

---

### Item 1: Prompt metadata headers

**Files to edit:**
- `/tools/prompts/index.html`
- `/developers/prompts/index.html`

**What to add:** A machine-readable metadata block at the top of each `<pre>` in every `prompt-block` and `variant-card__modifier` and `sector-card__param`. The block goes inside the prompt text itself, as the first lines, in YAML-style comments so it is both human-readable and parseable.

**Format:**

```
# framework: CoSAI AI Shared Responsibility Framework v1.0
# framework_domain: AI Governance / Accountability
# layer: all (L1–L5)
# operating_model: all (AI-SaaS, AI-PaaS, Agent-PaaS, IaaS)
# audience: [executive | auditor | developer | legal | general]
# purpose: [governance-analysis | site-primer | role-variant | sector-context]
# version: 2.0
# canonical_url: https://aisharedresponsibility.com/tools/prompts/
#
```

**Per-prompt values:**

| Block | audience | purpose | layer |
|---|---|---|---|
| Core system instruction (`#core-block`) | general | governance-analysis | all (L1–L5) |
| Site-aware primer (`#primer-block`) | general | site-primer | all (L1–L5) |
| Executive variant | executive | role-variant | L1 |
| Auditor variant | auditor | role-variant | all (L1–L5) |
| Developer variant | developer | role-variant | L3, L4 |
| Legal/Procurement variant | legal | role-variant | all (L1–L5) |
| Finance sector param | general | sector-context | all (L1–L5) |
| Healthcare sector param | general | sector-context | all (L1–L5) |
| Insurance sector param | general | sector-context | all (L1–L5) |
| Public Sector param | general | sector-context | all (L1–L5) |
| Defense param | general | sector-context | all (L1–L5) |
| Manufacturing param | general | sector-context | all (L1–L5) |

**Important:** The sector-card params already have `[Industry: ...]` lines. Add the metadata block above those lines, not below. Keep the existing `[Industry:]` lines intact.

The `tools/prompts/` and `developers/prompts/` pages have identical prompt content. Apply the same changes to both files.

**Token tip:** This is mechanical repetitive work. Use **Haiku** for this item. Pass it one `<pre>` block at a time and tell it exactly which metadata values to insert.

---

### Item 2: Canonical `id` anchors for controls and layers

**Goal:** Every control, layer, and persona must be deep-linkable with a stable URL.

#### 2a. Layer anchors on `/framework/index.html`

The framework page already has `id="l1"` through `id="l5"` (lowercase) on the layer `<div>` elements:

```html
<div id="l1" class="layer-section layer-section--l1">
```

Change these to uppercase to match the canonical IDs used in the JSON data:

```html
<div id="L1" class="layer-section layer-section--l1">
```

Do this for all five: `l1→L1`, `l2→L2`, `l3→L3`, `l4→L4`, `l5→L5`.

This makes `https://aisharedresponsibility.com/framework/#L3` a valid canonical citation URL.

Also add a `<link rel="canonical">` to the `<head>` if not already present (it is not — only a few pages have them). Pattern:
```html
<link rel="canonical" href="https://aisharedresponsibility.com/framework/" />
```

Add canonical link tags to these pages if missing (check first with grep):
- `/framework/index.html` 
- `/personas/index.html`
- `/operating-models/index.html`
- All six vertical index pages
- All six controls pages

#### 2b. Control card `id` attributes — all 6 controls browsers

**Files:**
- `/finance/controls/index.html`
- `/healthcare/controls/index.html`
- `/insurance/controls/index.html`
- `/public-sector/controls/index.html`
- `/defense/controls/index.html`
- `/manufacturing/controls/index.html`

Each controls page renders cards via a `cardHTML(c)` JavaScript function. The current return template opens with:

```javascript
return `
  <article class="ctrl-card" data-id="${escHtml(c.id)}">
```

Change `data-id` to also include `id`:

```javascript
return `
  <article class="ctrl-card" id="${escHtml(c.id)}" data-id="${escHtml(c.id)}">
```

This makes `https://aisharedresponsibility.com/finance/controls/#SRF-L1-DEV-001` a valid anchor. Adding `id` alongside `data-id` preserves all existing filter/search logic.

**Important:** The `cardHTML` function is slightly different across verticals (different field names: `mrm_stage` in finance, `clinical_stage` in healthcare, `lifecycle_stage` in insurance/public-sector/manufacturing, `il_level`/`nss_tier` in defense). The `id` change is identical across all six — just find `<article class="ctrl-card" data-id=` and add `id="${escHtml(c.id)}" ` before `data-id`.

**Also add:** A "Copy link" button next to each control's ID display. After the expand/collapse header, add:

```javascript
<button class="ctrl-card__permalink" 
  onclick="navigator.clipboard.writeText(location.origin+location.pathname+'#${escHtml(c.id)}');this.textContent='Copied!';setTimeout(()=>this.textContent='#',1200)"
  title="Copy permalink">#</button>
```

Style it as a small monospace button next to the control ID. Add CSS:
```css
.ctrl-card__permalink {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--slate-400);
  background: none;
  border: 1px solid var(--slate-200);
  border-radius: 3px;
  padding: 1px 5px;
  cursor: pointer;
  margin-left: var(--sp-2);
  line-height: 1.4;
}
.ctrl-card__permalink:hover { color: var(--cosai-blue); border-color: var(--cosai-blue); }
```

#### 2c. Persona anchors on `/personas/index.html`

Personas are rendered client-side from `/data/personas.json`. Find the persona card rendering function and add `id="${p.id}"` to each persona card's root element. Persona IDs from the JSON: `agentic-platform-provider`, `application-developer`, `data-provider`, `ai-system-users`, `ai-system-governance`, `model-provider`, `ai-model-serving`, `ai-platform-provider`.

This makes `https://aisharedresponsibility.com/personas/#ai-system-governance` a valid citation URL.

**Token tip:** Items 2a and 2c are small targeted edits — use **Haiku**. Item 2b (the controls browsers) involves 6 similar files; pass all 6 to **Haiku** in a batch with the exact substitution pattern.

---

### Item 3: DefinedTermSet/DefinedTerm JSON-LD upgrade

**Files to edit:**
- `/framework/index.html` — replace existing JSON-LD
- `/personas/index.html` — replace existing JSON-LD

#### 3a. `/framework/index.html`

Replace the existing `TechArticle` JSON-LD with a `@graph` that includes both a `DefinedTermSet` for the SRF and `DefinedTerm` for each layer:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      "@id": "https://aisharedresponsibility.com/framework/",
      "name": "CoSAI AI Shared Responsibility Framework — Five Layers, Eight Personas, Four Operating Models",
      "url": "https://aisharedresponsibility.com/framework/",
      "description": "The CoSAI SRF five-layer enterprise architecture model: L1 AI Business & Usage, L2 AI Information, L3 AI Application, L4 AI Platform, L5 AI Model Provider. Eight personas. Four operating models: AI-SaaS, AI-PaaS, Agent-PaaS, IaaS. One accountable party per activity.",
      "publisher": {
        "@type": "Organization",
        "name": "AI Shared Responsibility",
        "url": "https://aisharedresponsibility.com/"
      },
      "isPartOf": { "@type": "WebSite", "url": "https://aisharedresponsibility.com/" }
    },
    {
      "@type": "DefinedTermSet",
      "@id": "https://aisharedresponsibility.com/framework/#layer-set",
      "name": "CoSAI SRF Architecture Layers",
      "description": "The five enterprise architecture layers of the CoSAI AI Shared Responsibility Framework. Each layer has a named set of personas and accountability assignments that shift across operating models.",
      "url": "https://aisharedresponsibility.com/framework/",
      "hasDefinedTerm": [
        {
          "@type": "DefinedTerm",
          "@id": "https://aisharedresponsibility.com/framework/#L1",
          "termCode": "L1",
          "name": "AI Business & Usage",
          "description": "Governance, strategy, and compliance at the executive and business-unit level. Owns regulatory obligations, acceptable-use policy, and incident governance. Security and governance requirements cascade from L1 down to L2–L5.",
          "url": "https://aisharedresponsibility.com/framework/#L1",
          "inDefinedTermSet": "https://aisharedresponsibility.com/framework/#layer-set"
        },
        {
          "@type": "DefinedTerm",
          "@id": "https://aisharedresponsibility.com/framework/#L2",
          "termCode": "L2",
          "name": "AI Information",
          "description": "Data ownership, quality, and privacy. Accountable for training data provenance, master data management, privacy controls, and data classification decisions.",
          "url": "https://aisharedresponsibility.com/framework/#L2",
          "inDefinedTermSet": "https://aisharedresponsibility.com/framework/#layer-set"
        },
        {
          "@type": "DefinedTerm",
          "@id": "https://aisharedresponsibility.com/framework/#L3",
          "termCode": "L3",
          "name": "AI Application",
          "description": "Development, integration, and testing of AI-powered applications. Responsible for guardrails, input validation, output filtering, prompt engineering, RAG pipelines, and agent orchestration logic.",
          "url": "https://aisharedresponsibility.com/framework/#L3",
          "inDefinedTermSet": "https://aisharedresponsibility.com/framework/#layer-set"
        },
        {
          "@type": "DefinedTerm",
          "@id": "https://aisharedresponsibility.com/framework/#L4",
          "termCode": "L4",
          "name": "AI Platform",
          "description": "Infrastructure, APIs, and runtime services for hosting, training, and serving AI models. Covers LLM gateways, model routers, guardrail infrastructure, and platform-level IAM.",
          "url": "https://aisharedresponsibility.com/framework/#L4",
          "inDefinedTermSet": "https://aisharedresponsibility.com/framework/#layer-set"
        },
        {
          "@type": "DefinedTerm",
          "@id": "https://aisharedresponsibility.com/framework/#L5",
          "termCode": "L5",
          "name": "AI Model Provider",
          "description": "Foundation models, model governance, and supply-chain provenance. Accountable for model architecture security, model cards, vulnerability disclosure, and model distribution governance.",
          "url": "https://aisharedresponsibility.com/framework/#L5",
          "inDefinedTermSet": "https://aisharedresponsibility.com/framework/#layer-set"
        }
      ]
    },
    {
      "@type": "DefinedTermSet",
      "@id": "https://aisharedresponsibility.com/framework/#operating-model-set",
      "name": "CoSAI SRF Operating Models",
      "description": "The four operating models that determine how accountability shifts between customer and provider across the five SRF layers.",
      "url": "https://aisharedresponsibility.com/operating-models/",
      "hasDefinedTerm": [
        {
          "@type": "DefinedTerm",
          "@id": "https://aisharedresponsibility.com/operating-models/#AI-SaaS",
          "termCode": "AI-SaaS",
          "name": "AI-Enabled SaaS",
          "description": "Provider supplies a managed AI application. Customer retains L1 governance and supplies context data; provider assumes technical responsibility for L3 application, L4 platform, and L5 model.",
          "url": "https://aisharedresponsibility.com/operating-models/#AI-SaaS"
        },
        {
          "@type": "DefinedTerm",
          "@id": "https://aisharedresponsibility.com/operating-models/#AI-PaaS",
          "termCode": "AI-PaaS",
          "name": "AI Platform as a Service",
          "description": "Customer builds and operates the L3 application layer on a provider-managed AI platform. Customer owns L1 governance and L3 application; provider manages L4 platform and L5 model.",
          "url": "https://aisharedresponsibility.com/operating-models/#AI-PaaS"
        },
        {
          "@type": "DefinedTerm",
          "@id": "https://aisharedresponsibility.com/operating-models/#Agent-PaaS",
          "termCode": "Agent-PaaS",
          "name": "Agentic Platform as a Service",
          "description": "Customer owns agent definitions and L1 business logic on a provider-managed orchestration runtime. Responsibility at L3 and L5 is shared.",
          "url": "https://aisharedresponsibility.com/operating-models/#Agent-PaaS"
        },
        {
          "@type": "DefinedTerm",
          "@id": "https://aisharedresponsibility.com/operating-models/#IaaS",
          "termCode": "IaaS",
          "name": "Infrastructure as a Service",
          "description": "Maximum customer responsibility. Customer builds and operates L3 application, L4 platform, and L5 model layers. Provider is accountable only for physical and virtual infrastructure within L4.",
          "url": "https://aisharedresponsibility.com/operating-models/#IaaS"
        }
      ]
    }
  ]
}
```

#### 3b. `/personas/index.html`

Replace the existing `TechArticle` JSON-LD with a `DefinedTermSet` for the eight personas. Use the same pattern. Each persona `@id` should match the anchor you add in item 2c: `https://aisharedresponsibility.com/personas/#ai-system-governance`, etc.

Use the persona data from `/data/personas.json` for descriptions and layer assignments. All eight personas:

| id | name | layers |
|---|---|---|
| `ai-system-users` | AI System Users | L1 |
| `ai-system-governance` | AI System Governance | L1 |
| `data-provider` | Data Provider | L2 |
| `application-developer` | Application Developer | L3 |
| `agentic-platform-provider` | Agentic Platform & Framework Providers | L3, L4 |
| `ai-model-serving` | AI Model Serving | L4 |
| `ai-platform-provider` | AI Platform Provider | L4 |
| `model-provider` | Model Provider | L5 |

**Token tip:** Item 3 is structured content writing, not mechanical substitution. Use **Sonnet** for this. The JSON-LD above for the framework is complete — paste it directly. Write the personas DefinedTermSet using the same pattern.

---

### Item 4: Glossary page

**Create:** `/glossary/index.html`

**URL:** `https://aisharedresponsibility.com/glossary/`

**Purpose:** Single authoritative page defining every SRF term with a stable `#anchor`. Becomes the most-cited page by agents doing disambiguation.

#### Page structure

Follow the same HTML shell as other pages: `<!doctype html>`, `<site-nav current="glossary">`, `<site-footer>`, `/shared/styles.css`.

**Sections and terms to define:**

**Section: Framework Architecture**

| Term | Anchor | Definition |
|---|---|---|
| Layer | `#layer` | One of five enterprise architecture tiers in the CoSAI SRF (L1–L5). Each layer represents a distinct accountability domain. Requirements cascade from L1 downward. |
| L1 AI Business & Usage | `#L1` | The governance, strategy, and compliance layer. Owns regulatory obligations, acceptable-use policy, and incident governance. |
| L2 AI Information | `#L2` | The data ownership and privacy layer. Accountable for training data provenance, master data management, and data classification. |
| L3 AI Application | `#L3` | The development and integration layer. Responsible for guardrails, input validation, output filtering, prompt engineering, and agent orchestration. |
| L4 AI Platform | `#L4` | The infrastructure and runtime layer. Covers compute, LLM gateways, model routers, guardrail infrastructure, and platform IAM. |
| L5 AI Model Provider | `#L5` | The foundation model and supply-chain layer. Accountable for model security, model cards, vulnerability disclosure, and distribution governance. |
| Persona | `#persona` | A named stakeholder role in the SRF. There are eight personas, each mapped to one or more layers. Controls assign accountability to exactly one persona. |
| Operating Model | `#operating-model` | One of four deployment archetypes (AI-SaaS, AI-PaaS, Agent-PaaS, IaaS) that determines how L1–L5 accountability shifts between customer and provider. |

**Section: Accountability Rules**

| Term | Anchor | Definition |
|---|---|---|
| Accountability | `#accountability` | The obligation that cannot be delegated. Exactly one party per activity. The SRF's central rule: "shared" is a valid matrix value during analysis but must resolve to a single named persona in every control. |
| Accountable Party | `#accountable-party` | The single persona named as accountable for a given control. If a control shows "shared" in the responsibility matrix, the accountable party is still the one who cannot transfer the obligation. |
| Responsibility Cascade | `#responsibility-cascade` | The principle that security and governance requirements set at L1 propagate downward through L2, L3, L4, and L5. An L1 policy decision constrains every layer below it. |
| Shared Responsibility | `#shared-responsibility` | A state in the responsibility matrix where both customer and provider carry obligations for a control. Not a final answer: each shared control must still name one accountable persona. |
| RACI | `#raci` | Responsible, Accountable, Consulted, Informed. The SRF applies RACI at the control level but enforces exactly one Accountable owner per row. |

**Section: Operating Models**

| Term | Anchor | Definition |
|---|---|---|
| AI-SaaS | `#AI-SaaS` | AI-Enabled SaaS. Provider manages the application (L3), platform (L4), and model (L5). Customer retains L1 governance and L2 data obligations. Lowest customer technical responsibility. |
| AI-PaaS | `#AI-PaaS` | AI Platform as a Service. Customer builds and owns L3. Provider manages L4 and L5. Customer and provider share L2. |
| Agent-PaaS | `#Agent-PaaS` | Agentic Platform as a Service. Customer owns agent definitions and L1 business logic on a provider-managed orchestration runtime. L3 and L5 are shared. |
| IaaS | `#IaaS` | Infrastructure as a Service. Maximum customer responsibility. Customer owns L1–L3 and most of L5. Provider is accountable only for physical infrastructure within L4. |

**Section: Agentic Extensions**

| Term | Anchor | Definition |
|---|---|---|
| Autonomy Level | `#autonomy-level` | A six-point scale (L0–L5) classifying how independently an AI agent acts. L0 = fully human-controlled; L5 = fully autonomous with no human oversight. Every agentic deployment must declare its autonomy level. |
| Human Override Tier | `#human-override-tier` | A five-point scale (T1–T5) specifying the required human intervention capability for an agentic system. T1 = immediate human takeover at any step; T5 = retrospective audit only. Must be declared alongside autonomy level. |
| Agentic System | `#agentic-system` | An AI system that can take multi-step actions, use tools, or operate across sessions with limited human supervision. Agentic systems require autonomy level and human override tier declarations in addition to standard SRF layer assignments. |

**Section: Evidence and Controls**

| Term | Anchor | Definition |
|---|---|---|
| Control | `#control` | A specific accountability assignment within a vertical schema. Each control has an ID (e.g. SRF-L1-DEV-001), a layer, an accountable persona, applicable operating models, and an evidence threshold. |
| Evidence Threshold | `#evidence-threshold` | The measurable criterion that satisfies a control. Specifies a metric, operator, parameter, window, and breach action. Used to determine whether accountability is being exercised. |
| OCSF | `#ocsf` | Open Cybersecurity Schema Framework. The evidence schema used to specify what telemetry or log data satisfies a control's evidence requirement. |
| Control Schema | `#control-schema` | The full set of controls for a vertical. Six are published: Financial Services (40), Healthcare (40), Insurance (40), Public Sector (40), Defense (53), Manufacturing (45). |

**Section: Personas** (link out to `/personas/#anchor` for full definitions — keep these brief)

| Term | Anchor | Definition |
|---|---|---|
| AI System Governance | `#persona-ai-system-governance` | L1 persona. Defines security control objectives, measures implementations, and enforces compliance. Includes AI risk officers, compliance teams, and governance boards. Full definition: /personas/#ai-system-governance |
| Data Provider | `#persona-data-provider` | L2 persona. Supplies training data, evaluation datasets, or inference data. Includes data aggregators and dataset licensors. Full definition: /personas/#data-provider |
| Application Developer | `#persona-application-developer` | L3 persona. Integrates AI models into applications via APIs or embedded models. Accountable for application-level security, input validation, and output filtering. Full definition: /personas/#application-developer |
| Agentic Platform Provider | `#persona-agentic-platform-provider` | L3/L4 persona. Provides development environments, frameworks, and orchestration runtimes for agentic AI. Full definition: /personas/#agentic-platform-provider |
| AI Platform Provider | `#persona-ai-platform-provider` | L4 persona. Provides compute, APIs, and platform services for AI model hosting. Includes cloud providers and MLOps platforms. Full definition: /personas/#ai-platform-provider |
| Model Provider | `#persona-model-provider` | L5 persona. Develops, trains, and tunes foundation models. Accountable for model security, model cards, and vulnerability disclosure. Full definition: /personas/#model-provider |

#### Page design

Match the existing site style. Use a two-column layout on desktop: left nav (alphabetical letter jump links or section nav), right content. Each term is:

```html
<dt id="L1"><a href="#L1" class="gloss-anchor">#</a> L1: AI Business & Usage</dt>
<dd>Governance, strategy, and compliance...</dd>
```

Add a `<meta name="description">` focused on citation: "SRF term definitions with stable anchors for citation. Layers L1–L5, personas, operating models, accountability rules, agentic extensions."

Add JSON-LD as a `DefinedTermSet` referencing all terms on the page.

Add the page to `sitemap.xml` (priority 0.8) and `llms.txt` under Core framework.

#### Update `llms.txt`

Add this line to the Core framework section:
```
- [Glossary](https://aisharedresponsibility.com/glossary/): Canonical definitions for all SRF terms with stable anchor links. Layers (L1–L5), personas, operating models, accountability rules, agentic extensions, controls vocabulary, and evidence terms.
```

**Token tip:** The glossary is a new page requiring content decisions, consistent voice, and HTML structure. Use **Sonnet** for this. Haiku will produce flat output without the judgment calls needed for a reference page people and agents will actually cite.

---

## Model selection guide for this work

| Task | Model | Reason |
|---|---|---|
| Item 1 — prompt metadata headers | **Haiku** | Identical pattern repeated 12 times. Give it one `<pre>` block and the metadata values. Batch by file. |
| Item 2a — `l1`→`L1` case fix (5 replacements) | **Haiku** | Trivial find-and-replace. One call, one file. |
| Item 2b — `id=` in `cardHTML()` (6 files) | **Haiku** | Identical one-line change in 6 files. Give it the exact before/after strings. |
| Item 2c — persona card `id=` | **Haiku** | Small targeted JS edit. One file. |
| Item 2 — canonical `<link>` tags | **Haiku** | Same `<link rel="canonical">` pattern repeated across ~15 files. |
| Item 3a — framework DefinedTermSet JSON-LD | **Sonnet** | The full JSON-LD for item 3a is written out above — paste it directly, Sonnet just needs to replace the existing script block. |
| Item 3b — personas DefinedTermSet JSON-LD | **Sonnet** | Content writing from the persona data. Judgment needed for descriptions. |
| Item 4 — glossary page | **Sonnet** | New page with content decisions, voice consistency, cross-links. |
| Verification | **Sonnet** | Run the python3 verification script pattern from Phase 1 to confirm JSON-LD parses, anchors exist, and llms.txt/sitemap.xml are updated. |
| Git commit/push | Run from Mac Terminal | The sandbox can't delete `.git/index.lock` on the macOS FUSE mount. After all edits, run `git add -A && git commit -m "..." && git push origin develop && git push origin develop:main` from your Mac terminal. |

## Key file paths (all relative to project root)

```
/framework/index.html           — Item 2a, 3a
/personas/index.html            — Item 2c, 3b
/operating-models/index.html    — Item 3a (operating model DefinedTerms live here)
/tools/prompts/index.html       — Item 1
/developers/prompts/index.html  — Item 1 (same prompts, different nav context)
/finance/controls/index.html    — Item 2b
/healthcare/controls/index.html — Item 2b
/insurance/controls/index.html  — Item 2b
/public-sector/controls/index.html — Item 2b
/defense/controls/index.html    — Item 2b
/manufacturing/controls/index.html — Item 2b
/glossary/index.html            — Item 4 (create new)
/llms.txt                       — Item 4 (add glossary link)
/sitemap.xml                    — Item 4 (add glossary URL)
/data/personas.json             — Reference for item 3b and 4
/data/layers.json               — Reference for item 3a and 4
/data/matrix.json               — Reference for item 3a
```

## Style rules (from CLAUDE.md — must follow)

- No em dashes (—). Use comma, semicolon, colon, or rewrite.
- No filler phrases: "it is worth noting," "in order to," "at the end of the day."
- No hedging openers: "certainly," "absolutely," "of course."
- Prefer concrete, direct sentences.
- No Oxford-comma abuse as a stylistic tic.
- These apply to all visible page copy, callout text, and table content.

## Verification script pattern

After all changes, run this from bash to verify:

```python
import re, json, os

base = '/sessions/<your-session>/mnt/AISharedResponsibility.com'

# 1. Check glossary exists and has JSON-LD
gloss = open(f'{base}/glossary/index.html').read()
assert 'id="L1"' in gloss
assert 'DefinedTermSet' in gloss

# 2. Check framework layer IDs are uppercase
fw = open(f'{base}/framework/index.html').read()
assert 'id="L1"' in fw and 'id="l1"' not in fw

# 3. Check controls browsers have id= on articles
for v in ['finance','healthcare','insurance','public-sector','defense','manufacturing']:
    ctrl = open(f'{base}/{v}/controls/index.html').read()
    assert 'id="${escHtml(c.id)}"' in ctrl, f'{v} missing control id'

# 4. Check llms.txt has glossary
llms = open(f'{base}/llms.txt').read()
assert '/glossary/' in llms

# 5. Check sitemap has glossary
sitemap = open(f'{base}/sitemap.xml').read()
assert 'glossary' in sitemap

# 6. All JSON-LD still valid
for root, dirs, files in os.walk(base):
    for f in files:
        if f == 'index.html':
            content = open(os.path.join(root, f)).read()
            m = re.search(r'<script type=["\']application/ld\+json["\']>([\s\S]*?)</script>', content)
            if m:
                json.loads(m.group(1))  # will throw if invalid

print('All checks passed.')
```
