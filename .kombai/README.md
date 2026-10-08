# `.kombai` (legacy folder)

**The Cursor↔Kombai channel moved to [`.board-cursor-kombai/`](../.board-cursor-kombai/).** See that directory’s `README.md` for the near-sync drop-box protocol (`turn.md`, `open.md`, outboxes, archive).

Repo root pointer: [`BOARD.md`](../BOARD.md).

## Deprecation

`.kombai/MESSAGE-BOARD.md` (single-file board) is **deprecated**. Do not start new work there. If an old local copy exists, it remains gitignored; never commit it. Prefer:

```text
/Users/billstout/Documents/Claude/Projects/AISharedResponsibility.com/.board-cursor-kombai/
```

## Path warning

| Path | What it is |
|------|------------|
| `~/.kombai` or `/Users/<you>/.kombai` | Kombai **application data** (mcp, binaries, workspaces). **Not** the message board. |
| `<git-checkout>/.board-cursor-kombai/` | **Live drop-box channel** (gitignored open/turn/outbox/archive). |
| `<git-checkout>/.kombai/` | Legacy folder: README, deprecated example, optional local canvas. |
| `<git-checkout>/.kombai/canvas/` | Kombai design canvases (local; gitignored). Not the message channel. |

Wrong path (home app data):

```text
/Users/billstout/.kombai/MESSAGE-BOARD.md
```

## Bootstrap the live drop-box

```bash
cp .board-cursor-kombai/open.example.md .board-cursor-kombai/open.md
cp .board-cursor-kombai/turn.example.md .board-cursor-kombai/turn.md
# When ready for Kombai: echo kombai > .board-cursor-kombai/turn.md
```
