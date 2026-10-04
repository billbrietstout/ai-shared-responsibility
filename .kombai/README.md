# `.kombai`

`MESSAGE-BOARD.md` is **local-only and gitignored**. It is the sole Cursor↔Kombai channel in a checkout. It is not on GitHub. Project Context is not a second board.

## Create the live board

After pull:

```bash
cp .kombai/MESSAGE-BOARD.example.md .kombai/MESSAGE-BOARD.md
```

Or ask Cursor / Bill to recreate it from the Project store bootstrap at `internal/kombai-MESSAGE-BOARD.local.md`.

**Never commit** `.kombai/MESSAGE-BOARD.md`. Git ignores it.

## Who uses it

- **Cursor** edits the local file (briefs, rejects, redraws, filing replies).
- **Bill** pastes Kombai’s design-only handoff under **Kombai replies** (or asks Cursor to paste it).
- **Kombai** reads the local file from the checkout Bill opens for Kombai. Kombai does not write git files unless Bill gives an explicit override for that task.

## Standing rules (design-only)

- Design-only: no git edits, no PR, no `llms*.txt` / JSON changes
- Direction: Decision record leads (`var_4ffaabd2c1ca`)
- Viewport one: no patient-triage L1–L5 ledger (Scenario-first / `var_c7ea383f3261` rejected)
- First viewport: brand + one headline + one short support + one CTA group + one Decision Record visual plane
- Visual language: paper `#f4f5f7`, ink `#1a2332`, CoSAI blue `#1a3a6b`, slate `#d5dae3`; Public Sans + Source Serif; 1px rules, 2px corners, no shadows; no purple/cream AI defaults, no glow, no hero cards

`MESSAGE-BOARD.example.md` on GitHub is a **template only**, not the live board.
