# Principles sync reports

`scripts/site_sync.py` writes three files here:

- `principles-diff.md`
- `ai-agentic-principles.candidate.json`
- `ai-agentic-principles.slim.candidate.json`

`.gitignore` lists those paths. A normal `git add` leaves them out. The weekly workflow stages them with `git add -f` on `automation/monitor-fixture-sync`, so the draft pull request carries the proposal.

`whitepapers-changes.json` is the id list that same job writes for `site_sync.py`. The draft commit includes it.

These files are the proposal. The live catalog stays `data/ai-agentic-principles.json` until a person copies a candidate in a separate pull request.

See [`docs/monitor-data-flow.md`](../docs/monitor-data-flow.md).
