# Cursor ↔ Kombai directory drop-box

Near-synchronous messaging between Cursor and Kombai uses this directory in a **git checkout**, not Project Context and not `~/.kombai`.

**Absolute path (Bill’s Mac checkout):**

```text
/Users/billstout/Documents/Claude/Projects/AISharedResponsibility.com/.board-cursor-kombai/
```

Wrong path (home app data; never the board):

```text
/Users/billstout/.kombai/
```

In Finder, press **⌘⇧.** to show the `.board-cursor-kombai` dotfolder inside the checkout.

## Layout

| Path | Tracked? | Role |
|------|----------|------|
| `README.md` | yes | This protocol |
| `open.example.md` | yes | Template for the current brief |
| `turn.example.md` | yes | Template for whose turn |
| `outbox-cursor/.gitkeep` | yes | Cursor → Kombai dated messages |
| `outbox-kombai/.gitkeep` | yes | Kombai → Cursor dated messages |
| `archive/.gitkeep` | yes | Completed message pairs |
| `open.md` | **no** (gitignored) | Current brief Kombai should read |
| `turn.md` | **no** (gitignored) | Exactly one of: `cursor` \| `kombai` \| `idle` |
| `outbox-cursor/*` | **no** (except `.gitkeep`) | Cursor-authored dated files |
| `outbox-kombai/*` | **no** (except `.gitkeep`) | Kombai-authored dated files |
| `archive/*` | **no** (except `.gitkeep`) | Archived done files |

## Near-sync protocol

1. `turn.md` contains exactly one of: `cursor` | `kombai` | `idle` (plus an optional trailing newline). No other text.
2. **When Cursor needs Kombai:** write a dated file to `outbox-cursor/YYYYMMDD-HHMMSS-<slug>.md`, copy or update `open.md` to that brief, set `turn.md` to `kombai`.
3. **Kombai polls:** if `turn.md` is `kombai`, read `open.md` and the latest file in `outbox-cursor/`, do **design-only** work, write `outbox-kombai/YYYYMMDD-HHMMSS-<slug>.md`, set `turn.md` to `cursor`.
4. **Cursor reads** the new file in `outbox-kombai/`, archives both sides’ done files into `archive/`, sets `turn.md` to `idle` or starts the next task.
5. **Never** edit the other side’s outbox files. **Never** commit live `open.md`, `turn.md`, outbox contents, or archive contents.
6. Path is always `<checkout>/.board-cursor-kombai/`. Not under `~/.kombai`.

## Bootstrap (local only)

From the repo root after `git pull`:

```bash
cp .board-cursor-kombai/open.example.md .board-cursor-kombai/open.md
cp .board-cursor-kombai/turn.example.md .board-cursor-kombai/turn.md
# When ready for Kombai: echo kombai > .board-cursor-kombai/turn.md
```

## Standing rules (design-only)

- Design-only: no git edits, no PR, no `llms*.txt` / JSON changes
- Direction: Decision record leads (`var_4ffaabd2c1ca`)
- Viewport one: no patient-triage L1–L5 ledger (Scenario-first / `var_c7ea383f3261` rejected)
- First viewport: brand + one headline + one short support + one CTA group + one Decision Record visual plane
- Visual language: paper `#f4f5f7`, ink `#1a2332`, CoSAI blue `#1a3a6b`, slate `#d5dae3`; Public Sans + Source Serif; 1px rules, 2px corners, no shadows; no purple/cream AI defaults, no glow, no hero cards

## Deprecated

`.kombai/MESSAGE-BOARD.md` (single-file board) is deprecated. Prefer this directory. Keep ignoring any leftover `.kombai/MESSAGE-BOARD.md`; do not commit it.
