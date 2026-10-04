This is the live channel open brief when copied to open.md.

Read `turn.md`: only act when it says `kombai`. Reply in `outbox-kombai/`, then set `turn.md` to `cursor`. Do not edit `outbox-cursor/`. Path: `<checkout>/.board-cursor-kombai/`. Design-only: no git edits, no PR, no `llms*.txt` / JSON.

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

When finished: write `outbox-kombai/YYYYMMDD-HHMMSS-<slug>.md` with the handoff, then set `turn.md` to exactly `cursor`. Do not rely on Project Context as a board.
