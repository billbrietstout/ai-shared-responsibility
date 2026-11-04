# Monitor data to the site

The whitepaper monitor repository is the source of truth for the paper inventory:

https://github.com/billbrietstout/ai-security-whitepaper-monitor

The Google Sheet is retired. The record for a paper is a GitHub issue in that repository, then the file `data/whitepapers.json` on that repository's default branch. The default branch is `master`. The sync script reads `default_branch` from the GitHub API on each run.

## What moves, and who moves it

1. The monitor repository publishes `data/whitepapers.json` on its default branch. Each paper has a `WP-` id and a GitHub issue number. The raw URL is `https://raw.githubusercontent.com/billbrietstout/ai-security-whitepaper-monitor/<default-branch>/data/whitepapers.json`. The script fills `<default-branch>` from `https://api.github.com/repos/billbrietstout/ai-security-whitepaper-monitor`.

2. This site stores a copy at `build/fixtures/whitepapers.json`. Replace the copy with:

   ```bash
   python3 scripts/sync_whitepapers_fixture.py
   ```

   Commit the updated fixture in a pull request. The weekly job in the next section runs this command and commits the fixture on `automation/monitor-fixture-sync`. A person can still run the command locally. The command leaves the fixture unchanged when the monitor file is not on the default branch yet, and it exits with an error so the missing file is visible.

3. CI resolves the monitor default branch and fetches that file on every push and pull request to `develop` and `main`. The `whitepapers-fixture` job fails when the committed fixture is not the same JSON, or when the fixture `updated` date is more than 14 days before the run date. Fourteen days covers the weekly monitor pass plus one missed week. If the monitor file is not on the default branch yet, the job prints a warning and does not fail for that absence. The age check still runs. [Monitor pull request 173](https://github.com/billbrietstout/ai-security-whitepaper-monitor/pull/173) merged on 2026-11-01 and published `data/whitepapers.json` on `master`. Each paper uses `wp_id`, `issue_number`, `source_org`, and a lowercase decision (`include`, `delete_candidate`, or `duplicate`). The site fixture is a copy of that file. Readers also accept the older names `id`, `issue`, `org`, and `Include`. The check counts `id` or `wp_id`. A parsed export with neither key is an error, not a content diff, and the refresh command does not write the fixture. Extracted rules are the `invariants` list. A fixture with no `invariants` key is read from `invariables`. When both keys are present, only `invariants` is read.

4. `build/source-wp-ids.json` maps each site source code to a `WP-` id. `build/generate_principle_catalogs.py` writes that id onto the source in `data/ai-agentic-principles.json`. When the map includes `monitor_issue`, the generator copies it. The generator does not invent issue numbers.

5. `scripts/site_sync.py` reads a monitor change list and writes a proposed catalog under `reports/`. It does not write `data/`. When the monitor paper has an issue number, the proposal sets `monitor_issue` on that source. A person reviews `reports/principles-diff.md` and, if they accept it, copies the candidate into `data/` in a pull request. The weekly job commits that proposal on the same draft as the fixture. The copy into `data/` stays a separate pull request.

6. The pages read `data/ai-agentic-principles.json`. `scripts/validate_principles.py` checks that file. The `validate-principles` job runs on every push and pull request to `develop` and `main`. There is no path filter.

7. `build/generate_whitepaper_inventory.py` reads the fixture and the agentic catalog, then writes `data/whitepaper-inventory.slim.json`. The agentic AI security page and the whitepaper assessment page use that file for the scope control. The default scope is the papers the catalog cites. Cited research is a separate count and is not part of that default. A metadata-only row, a duplicate, or a row marked for removal is not a source of principles. The script does not write the principle catalogs. The weekly draft regenerates the slim file when it refreshes the fixture. `verify.yml` regenerates it again and fails if the committed file differs.

## Weekly draft pull request

`.github/workflows/monitor-fixture-sync.yml` runs `scripts/monitor_sync_pr.py`. The workflow name in the Actions tab is "Refresh the whitepaper fixture".

The schedule is `0 3 * * 3`, which is 03:00 UTC on Wednesday. That clock time is 7:00 PM Pacific Standard Time on Tuesday, and 8:00 PM Pacific Daylight Time on Tuesday. GitHub starts the job from the default branch, `develop`, and the job can start later than the schedule.

The monitor weekly pass writes `data/whitepapers.json` on `master`. The pass dated November 3, 2026 committed that file at 00:20 UTC on November 4, which is 4:20 PM Pacific Standard Time. The site job is later than that commit, and later than a 9:00 AM Pacific start. If a pass lands after the job has already read the export, run the workflow by hand. The next scheduled run would otherwise read the previous export.

The raw export is public. A request with no token returns HTTP 200 for `https://raw.githubusercontent.com/billbrietstout/ai-security-whitepaper-monitor/master/data/whitepapers.json`. The job uses the built-in `GITHUB_TOKEN` and no other secret. The token is sent only to `api.github.com`, for the default-branch lookup. The raw download does not receive the token. `scripts/sync_whitepapers_fixture.py` already works that way.

The job does four things:

1. It resolves the monitor default branch and runs `python3 scripts/sync_whitepapers_fixture.py`.
2. It compares that export to the fixture on `develop` and writes `reports/whitepapers-changes.json` with the added, modified, and removed `WP-` ids.
3. It runs `python3 scripts/site_sync.py`. That writes `reports/principles-diff.md`, `reports/ai-agentic-principles.candidate.json`, and `reports/ai-agentic-principles.slim.candidate.json`.
4. It commits those files on `automation/monitor-fixture-sync` and pushes `HEAD:refs/heads/automation/monitor-fixture-sync`. The script refuses a destination of `develop`, `main`, or `master`. The push is a normal push. The script has no force-push flag.

`.gitignore` still lists the three `site_sync.py` outputs, so a normal `git add` leaves them out. The job stages them with `git add -f`. That is how the proposal gets onto the draft. A local `site_sync.py` run still stays out of a normal commit.

The pull request targets `develop` and is created as a draft. If that draft is already open, the job updates its body and pushes new commits onto the same branch. It keeps one open pull request. Extra open pull requests from that branch are closed with a pointer to the one that remains. The job does not mark the draft ready, does not merge, and does not enable auto-merge.

The draft body lists the added, modified, and removed `WP-` ids. The full lists are in `reports/whitepapers-changes.json`.

The job leaves `data/ai-agentic-principles.json` and `data/ai-agentic-principles.slim.json` unchanged. `scripts/site_sync.py` writes under `reports/` and stops there. The copy into `data/` stays a review step: a person reads the diff and, to accept a source change, copies the candidate in a separate pull request. A paper that has no site source code is listed in the diff. The candidate changes a source row only when that `WP-` id is already a source on the site.

If the export matches the fixture on `develop`, the job opens nothing. If a draft is already open and the export now matches, the job closes that draft and does not merge it.

The token for this job is:

```yaml
permissions:
  contents: write
  pull-requests: write
```

No other scope is granted on this job. The other workflows keep their own permissions.

A person with admin rights on `billbrietstout/ai-shared-responsibility` has to save one setting. The workflow cannot turn it on. Personal repositories start with the box unchecked.

1. Open Settings, then Actions, then General.
2. Under Workflow permissions, check Allow GitHub Actions to create and approve pull requests.
3. Save.

GitHub puts create and approve on that one checkbox. This job creates a pull request. It does not submit a review, and it does not merge. On a personal repository, the `permissions` block above is the write grant for this job. You can leave the default token for other workflows on read-only contents and packages. If a push returns HTTP 403 because an organization policy caps every token at read-only, an organization owner has to allow a workflow to request write.

Leave `automation/monitor-fixture-sync` off the protected-branch list, so `github-actions[bot]` can push it. Do not require the job `open-draft` as a status check. The checks to require stay `validate-principles`, `whitepapers-fixture`, and `verify`.

### How to run it by hand

The workflow file has to be on `develop` before the schedule or a manual run can use it. `develop` is the default branch.

1. Open the Actions tab.
2. Choose "Refresh the whitepaper fixture".
3. Choose Run workflow.
4. Leave the branch set to `develop`. The job checks out `develop` for the fixture it compares. The workflow file that runs is the file on the branch you select in that menu.
5. Leave "Write the proposal and print the plan" off to open or update the draft. Turn it on to print the summary and skip the push. That input calls `python3 scripts/monitor_sync_pr.py --dry-run`.

A local checkout can print the same plan without pushing:

```bash
python3 scripts/monitor_sync_pr.py --dry-run
```

### Checks on the draft

A pull request opened with `GITHUB_TOKEN` does not start `pull_request` workflows on its own. GitHub creates those runs in an approval-required state. A person with write access selects Approve workflows to run on the pull request. That click starts `validate-principles`, `whitepapers-fixture`, and `verify`. The job does not bypass those checks. Merge the draft after they pass.

The fixture check on `develop` keeps failing until that draft is merged. The committed fixture is the 2026-10-31 export. The monitor file has moved since that date, so the content check fails before the age rule does. With `updated` still set to 2026-10-31, the age rule fails starting 2026-11-15, because the limit is more than 14 days.

## What each source and principle must carry

A source traces to the monitor when `monitor_issue` is the GitHub issue number for that paper. Matched sources also keep `wp_id` (`WP-` plus four digits). That id must be in the fixture with decision `include`. If both numbers are set, they must name the same paper: `monitor_issue` equals the fixture `issue_number` for that `wp_id`. Older fixture copies used `issue` and `Include`. Those names still match.

`inventory_status: unmatched` means the source has no monitor `WP-` id. For every source other than a conference talk, that is a warning through 2026-11-30 and an error starting 2026-12-01. `pending_add` stays allowed when `wp_id` is empty and `inventory_note` says why. Sources with no `monitor_issue`, other than conference talks, produce one summary warning. That summary stays a warning after 2026-11-30.

A source with `type` set to `conference-talk` is exempt from the monitor check. Examples are the `UNPROMPTED1-*` and `UNPROMPTED2-*` rows. Unmatched stays allowed after 2026-11-30, with no `WP-` id and no `monitor_issue`. The check prints one info line for the group. The run still passes. The source still has to name a speaker, the talk title in `title`, the event name in `org`, a URL, and an `inventory_note` that says why the talk is outside the monitor. Every other source type keeps the unmatched rule above.

An agentic principle traces to a risk, an obligation, and a source when `risks` and `obligations` are non-empty arrays of strings and `src` names sources that resolve. Empty `risks` or `obligations` is a warning through 2026-11-30. Starting 2026-12-01 it is an error. The catalog on `develop` does not fill those arrays yet. Fill them in a later pull request before 2026-12-01, or the check fails on that date. The risks and obligations check applies to the agentic catalog. The classic catalog (`security-principles.json`) cites frameworks.

A principle id that is not in the base catalog fails the check when its statement support score prints as `0.00` and at least one cited paper has extracted text in the fixture. Support is the overlap between the statement and that paper's axioms, invariants, and principles. The check reads `invariants`. It reads `invariables` only when the paper has no `invariants` key. A `0.00` score with no extracted text stays a warning. Ids already in the base catalog also stay warnings at `0.00`. In CI, a pull request uses the target branch as the base catalog, and a push uses the commit before the push. Locally, with no flag set, the script tries `origin/develop` and then `develop`. If that baseline cannot be read, the check warns and leaves a `0.00` score as a warning.

The check date is the UTC date on the GitHub runner.

## Branch protection

A workflow cannot turn on branch protection. A person with admin rights on `billbrietstout/ai-shared-responsibility` has to save the rules. Set the same rule on `develop` and on `main`.

Use a ruleset or a classic branch protection rule. The settings that matter:

- Pull requests are required to update the branch. Direct pushes are rejected.
- These status checks must pass: `validate-principles`, `whitepapers-fixture`, and `verify`.
- The branch must be up to date before merge, so the checks run on the commit that lands.
- Administrators are not exempt. A bypass role lets that person skip the rule.
- Force pushes to these two branches stay off.

`validate-principles` and `whitepapers-fixture` come from `.github/workflows/validate-principles.yml`. `verify` comes from `.github/workflows/verify.yml` and checks the knowledge layer and page markers.

GitHub lists a check in the picker only after that check has run on the repository at least once. Run the workflows, then add the three checks.

## What this repo does not show

No workflow in this repository deploys `develop` or `main`. The host that publishes aisharedresponsibility.com is not recorded here.
