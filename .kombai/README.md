# `.kombai`

**Warning: `~/.kombai` (user home app data) is not this folder.**

| Path | What it is |
|------|------------|
| `~/.kombai` or `/Users/<you>/.kombai` | Kombai **application data** (mcp, binaries, workspaces). **Not** the message board. |
| `<git-checkout>/.kombai/` | This repo folder. The board lives **only** here. |

Live board path (Mac checkout example):

```text
/Users/billstout/Documents/Claude/Projects/AISharedResponsibility.com/.kombai/MESSAGE-BOARD.md
```

Wrong path (home app data; do not look for the board here):

```text
/Users/billstout/.kombai/MESSAGE-BOARD.md
```

In Finder, press **⌘⇧.** (Command-Shift-period) to show the `.kombai` dotfolder inside the git checkout.

`MESSAGE-BOARD.md` is **local-only and gitignored**. It is the sole Cursor↔Kombai channel in a checkout. It is not on GitHub. Project Context is not a second board.

## Create the live board

`MESSAGE-BOARD.example.md` is committed seed content. Its body is valid live-board text (same wording Kombai should see). The working channel is the gitignored copy named `MESSAGE-BOARD.md`.

From the **repo root** (the git checkout), after pull:

```bash
cp .kombai/MESSAGE-BOARD.example.md .kombai/MESSAGE-BOARD.md
```

Or paste the Project store copy at `docs/kombai-live-board.md` over that path, or ask Cursor to recreate from `internal/kombai-MESSAGE-BOARD.local.md`.

**Never commit** `.kombai/MESSAGE-BOARD.md`. Git ignores it. Do not create the board under `~/.kombai`.

## Who uses it

- **Cursor** edits the local `MESSAGE-BOARD.md` (briefs, rejects, redraws, filing replies).
- **Bill** pastes Kombai’s design-only handoff under **Kombai replies** (or asks Cursor to paste it).
- **Kombai** reads the local `MESSAGE-BOARD.md` from the checkout Bill opens for Kombai. Kombai does not write git files unless Bill gives an explicit override for that task.

## Standing rules (design-only)

- Design-only: no git edits, no PR, no `llms*.txt` / JSON changes
- Direction: Decision record leads (`var_4ffaabd2c1ca`)
- Viewport one: no patient-triage L1–L5 ledger (Scenario-first / `var_c7ea383f3261` rejected)
- First viewport: brand + one headline + one short support + one CTA group + one Decision Record visual plane
- Visual language: paper `#f4f5f7`, ink `#1a2332`, CoSAI blue `#1a3a6b`, slate `#d5dae3`; Public Sans + Source Serif; 1px rules, 2px corners, no shadows; no purple/cream AI defaults, no glow, no hero cards
