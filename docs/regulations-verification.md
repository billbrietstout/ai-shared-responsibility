# Regulation last_verified gardening

The Regulations page flags an entry in `data/regulations.json` when:

- it has no `last_verified` date,
- its `last_verified` date is older than `stale_threshold_days` (180), or
- `verification_status` is `unverified`.

The weekly GitHub Action lists those entries. A Cursor agent re-checks the
primary sources and updates dates only after that check.

## Weekly draft pull request

Workflow: `.github/workflows/regulations-stale-check.yml`

Schedule: `0 4 * * 4` (04:00 UTC Thursday).

The job:

1. Reads `data/regulations.json` on `develop`.
2. Writes `reports/regulations-stale.json` and `reports/regulations-stale.md`.
3. Pushes branch `automation/regulations-stale-check`.
4. Opens or updates one draft pull request into `develop`.
5. Mentions `@cursor` in the pull request body and, when the stale set is
   new or changed, in a pull request comment.

The job does not bump `last_verified`. It does not merge. It does not push
`develop` or `main`. Leave `automation/regulations-stale-check` off the
protected-branch list so `github-actions[bot]` can push it.

If `develop` has no entries that still need verification, the job closes
the open draft without merging.

Manual run:

```bash
python3 scripts/regulations_stale_pr.py --dry-run
python3 scripts/regulations_stale_pr.py --push
```

## Cursor agent instructions

When `@cursor` is mentioned on the stale-regulation draft, or when the
Cursor Automation for this draft fires:

1. Read `reports/regulations-stale.json` on the pull request branch.
2. For each listed id, open the entry's `url`.
3. Confirm the live instrument still matches `name`, `version`, `url`, and
   `scope` in `data/regulations.json`.
4. When the entry is still correct, set `last_verified` to today's UTC date
   (`YYYY-MM-DD`) for that id only. For a reference entry that was
   `unverified`, set `verification_status` to `verified` in the same edit.
5. When the source moved or the metadata changed, update the changed fields
   in the same commit and comment what changed.
6. When you cannot verify an entry, leave `last_verified` and
   `verification_status` alone and comment why.
7. Commit on `automation/regulations-stale-check` only. Do not merge. Do not
   mark the draft ready. Do not edit unrelated files.
8. Do not bump a date because the HTTP status was 200 alone. Open the
   source page or document and read enough to confirm the entry.

After Cursor finishes, a person reviews the updates and merges the draft
into `develop`.

## Local check

```bash
python3 scripts/test_regulations_stale_pr.py
```
