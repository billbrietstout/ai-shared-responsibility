# EXAMPLE / template — not the live board

Copy this file to create the gitignored live board:

```bash
cp .kombai/MESSAGE-BOARD.example.md .kombai/MESSAGE-BOARD.md
```

Then edit `.kombai/MESSAGE-BOARD.md` only. Never commit the live file.

---

# Kombai ↔ Cursor message board

**This file is the only message board.** Path: `.kombai/MESSAGE-BOARD.md` in the local checkout (gitignored; not on GitHub). Project Context is not a second board; Context holds a pointer to this path only.

**Who reads/writes**
- **Cursor** edits this file (briefs, rejects, redraws, filing replies).
- **Bill** pastes Kombai’s design-only handoff into **Kombai replies** below (or asks Cursor to paste it).
- **Kombai** reads this file from the checkout Bill opens for Kombai. Kombai does not write git files unless Bill gives an explicit override for that task. Kombai cannot read Cursor Project Context / Agent Store.

**Standing rules**
- Design-only: no git edits, no PR, no `llms*.txt` / JSON changes
- Direction: Decision record leads (`var_4ffaabd2c1ca`)
- Viewport one: no patient-triage L1–L5 ledger (that is Scenario-first / `var_c7ea383f3261`, rejected)
- First viewport: brand + one headline + one short support + one CTA group + one Decision Record visual plane
- Visual language: paper `#f4f5f7`, ink `#1a2332`, CoSAI blue `#1a3a6b`, slate `#d5dae3`; Public Sans + Source Serif; 1px rules, 2px corners, no shadows; no purple/cream AI defaults, no glow, no hero cards

---

## Open for Kombai (paste this)

Copy everything inside the fence into Kombai.

```text
Read and follow the brief in .kombai/MESSAGE-BOARD.md. You are design-only: do not edit any git repo files, do not open a PR, do not change llms*.txt or JSON.

STATUS: Your Cursor review plan for the homepage was REJECTED.
Reason: It cited Decision record leads (var_4ffaabd2c1ca) but put the full patient-triage L1–L5 ledger in the first viewport. That is Scenario-first (var_c7ea383f3261), already rejected.

REQUIRED REDRAW — Decision record leads only (var_4ffaabd2c1ca)

Primary page: homepage first viewport (index.html mocks only; Cursor will implement later).

Goal (one sentence): Shorten the hero so brand + one claim + one Decision Record CTA + one Decision Record visual plane fill viewport one.

First viewport MUST contain only:
- Brand at hero level (CoSAI / AI Shared Responsibility), not only in nav
- One headline (prefer live lead: “Make responsibility clear before you scale AI”)
- One short supporting sentence (maps obligation/control to an owner; do not let this overpower brand as sole H1)
- One CTA group: primary Create a Decision Record → /tools/decision-record/
- One dominant visual: Decision Record preview or form plane (layers, residual gaps, attestation/sign-off)

First viewport MUST NOT contain:
- Patient-triage scenario text
- Complete L1–L5 owner mapping / ledger / matrix
- Flags band for the triage example
- Scenario | analysis split as the hero’s second composition
- Secondary “Open the SRF Stress Test” as a competing hero CTA (Stress Test stays in its own later section)

Keep elsewhere (not viewport one):
- Patient-triage example and L1–L5 assignments stay in the SRF Stress Test section (restyle in place if needed; if fixing aria-hidden, fix there, do not migrate into the hero)
- Role links, announcement/PDF, full lede, comparison, five-layer reference, tools, machine-readable resources, footer order unchanged

File boundaries for the eventual Cursor implement (state these as non-changes in your handoff):
- Cursor may edit index.html page-local hero only
- No shared/styles.css, shared/components.js, JSON, llms.txt, llms-full.txt, other routes

Visual language: reuse existing tokens (paper #f4f5f7, ink #1a2332, CoSAI blue #1a3a6b, slate #d5dae3). Public Sans + Source Serif. 1px rules, 2px corners, no shadows. No purple/cream AI defaults, no glow, no hero cards.

Return format (design-only handoff back to Cursor):
1. Task restated
2. Chosen direction (must be Decision record leads / var_4ffaabd2c1ca)
3. First viewport (brand, headline, support, CTA, Decision Record visual plane)
4. Tokens to change (or “unchanged”)
5. Section plan after the hero (Stress Test keeps triage evidence)
6. Motion (2–3 max, or none)
7. Explicit non-changes (nav, footer, triage stays out of viewport one, JSON, llms*)
8. Assets (describe only)
9. Open questions for Bill

Do not produce another Cursor implementation plan that puts triage L1–L5 in the hero.

When finished, Bill pastes your handoff into .kombai/MESSAGE-BOARD.md under Kombai replies (or Cursor pastes it). Do not rely on Project Context as a board.
```

---

## Kombai replies

_(None yet. Bill or Cursor pastes Kombai’s structured handoff below as a new dated entry.)_

<!--
### YYYY-MM-DD — Kombai: <title>

- **From:** Kombai
- **To:** Cursor
- **Status:** awaiting Cursor review

(paste handoff body)
-->
