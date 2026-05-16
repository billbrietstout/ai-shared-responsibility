# AISharedResponsibility.com — Architecture

## Guiding constraints

- No build step. No bundler. No framework.
- No external network requests at runtime (fonts, analytics, CDN scripts).
- Pages work without JavaScript. JS adds interactivity progressively.
- One accountable file per concern. No magic.
- Coherent design language with `cosai-wizards` — same CSS token names.

---

## Directory layout

```
/
├── index.html                    # Home
├── framework/
│   └── index.html                # 5-layer model, interactive diagram
├── personas/
│   └── index.html                # 8 CoSAI personas and their responsibilities
├── operating-models/
│   └── index.html                # IaaS / PaaS / SaaS responsibility matrix
├── regulations/
│   └── index.html                # Living reference page, staleness badges
├── about/
│   └── index.html                # CoSAI attribution, license, open source
├── shared/
│   ├── styles.css                # All design tokens and base styles
│   └── components.js             # Web Components: <site-nav>, <site-footer>
├── data/
│   ├── regulations.json          # Regulation/standard references
│   ├── layers.json               # 5-layer definitions
│   ├── personas.json             # 8 persona definitions
│   └── matrix.json               # Operating model × layer responsibility matrix
└── assets/
    └── logo.svg
```

### Why directory-per-page

`/framework/index.html` gives a clean URL (`/framework/`) without server config.
All asset paths are root-relative (`/shared/styles.css`) so they work identically
in dev (any static server) and production.

---

## Shared components — Web Components

`shared/components.js` defines two custom elements using the native
Custom Elements API. No shadow DOM (styles come from the shared stylesheet),
no polyfill, no build step.

```html
<!-- Every page includes this pair -->
<script type="module" src="/shared/components.js"></script>

<site-nav current="framework"></site-nav>
<!-- page content -->
<site-footer></site-footer>
```

The `current` attribute highlights the active nav item. The component reads it
in `connectedCallback` and applies an `aria-current="page"` attribute plus a CSS
class to the matching link.

### Adding a page

1. Create `/new-page/index.html`.
2. Add `<site-nav current="new-page">`.
3. Add one `<a>` entry to the `NAV_LINKS` array in `components.js`.
4. Add one entry to `<site-footer>`'s link list.

No other files change.

---

## CSS architecture

`shared/styles.css` is the single source of truth for all tokens.

```
:root
  Brand tokens         --cosai-navy, --cosai-blue, --cosai-blue-light
  Layer tokens         --l1 … --l5 (color, bg, border, text)
  Neutral scale        --slate-50 … --slate-900
  Status tokens        --status-good/warn/bad/na (text + bg + border)
  Typography           --font-sans, --font-mono, scale --text-sm … --text-4xl
  Layout               --radius, --radius-lg, --shadow, --shadow-md
  Content width        --max-w (960px), --max-w-wide (1200px)
```

Token names match `cosai-wizards/shared/styles.css` so both repos share a
coherent visual identity. Any future design update touches one file in each repo.

Component classes follow a flat BEM-lite convention:
- `.nav`, `.nav__link`, `.nav__link--active`
- `.section`, `.section--alt`
- `.card`, `.card__title`, `.card__body`
- `.layer-pill`, `.layer-pill--l1` … `--l5`
- `.badge`, `.badge--stale`, `.badge--fresh`

No utility classes. No Tailwind. Selectors are readable without tooling.

---

## Data layer

Pages fetch JSON from `/data/` on load. The fetch is non-blocking: the page
renders its skeleton immediately, then populates dynamic content.

### regulations.json schema

```json
{
  "updated": "2026-05-15",
  "items": [
    {
      "id": "nist-ai-rmf",
      "name": "NIST AI Risk Management Framework",
      "short": "NIST AI RMF",
      "body": "NIST",
      "url": "https://airc.nist.gov/RMF/",
      "version": "1.0",
      "published": "2023-01-26",
      "last_verified": "2026-05-15",
      "srf_layers": ["L1", "L2", "L3", "L4", "L5"],
      "tags": ["governance", "risk", "us"]
    }
  ]
}
```

`last_verified` drives the staleness badge on the Regulations page. Any entry
older than 180 days gets a visible `Verify` badge. Contributors update this field
via pull request — no server, no admin panel.

### layers.json schema

```json
{
  "layers": [
    {
      "id": "L1",
      "name": "AI Business & Usage",
      "short": "Business",
      "personas": ["AI System Users", "AI System Governance"],
      "description": "...",
      "components": ["Capabilities & Business Strategy", "Processes & Governance", "Business Units & Accountability"]
    }
  ]
}
```

### personas.json schema

```json
{
  "personas": [
    {
      "id": "application-developer",
      "name": "Application Developer",
      "srf_layers": ["L3"],
      "audiences": ["vendor", "consultant"],
      "standard_ref": "ISO/IEC 22989:2022 §5.19.2",
      "responsibilities": ["..."],
      "description": "..."
    }
  ]
}
```

### matrix.json schema

```json
{
  "models": ["AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS"],
  "layers": ["L1", "L2", "L3", "L4", "L5"],
  "cells": {
    "L1": {
      "AI-SaaS":     { "customer": "shared",        "provider": "provider-managed" },
      "AI-PaaS":     { "customer": "customer-owned", "provider": "provider-managed" },
      "Agent-PaaS":  { "customer": "customer-owned", "provider": "provider-managed" },
      "IaaS":        { "customer": "customer-owned", "provider": "provider-managed" }
    }
  }
}
```

---

## Hosting and deployment

The site is static files. Any host works:

| Option            | Notes |
|-------------------|-------|
| GitHub Pages      | Free, serves from repo root or `/docs`. Used by `cosai-wizards`. |
| Cloudflare Pages  | Free tier, global CDN, automatic HTTPS. Recommended for production. |
| Netlify           | Free tier, good redirect support. |
| Self-hosted nginx | One config block. |

Clean URLs (`/framework/` not `/framework/index.html`) work automatically with
directory-index-based hosts. For Cloudflare Pages or Netlify, no config needed.

---

## Relationship to cosai-wizards

`cosai-wizards` is a separate repo and lives at its own URL
(currently `billbrietstout.github.io/cosai-wizards/`, eventually a CoSAI domain).

`AISharedResponsibility.com` links to the wizards — it does not embed or host them.
The shared CSS token names mean both sites look like the same system even when
hosted independently.

If a wizard is eventually hosted at `tools.AISharedResponsibility.com`, the
wizard HTML files can be copied verbatim — they are self-contained and path-independent.

---

## Extending the site

To add a content page:
1. `mkdir /new-topic && cp /about/index.html /new-topic/index.html`
2. Update the page content.
3. Add the nav entry in `components.js` (one array item).
4. Add a data file to `/data/` if the page is data-driven.

To add a data-driven page:
1. Define a JSON schema in this document.
2. Create `/data/new-thing.json`.
3. In the page's `<script>`, `fetch('/data/new-thing.json')` and render.

No rebuild. No deploy pipeline change. The file is the source of truth.
