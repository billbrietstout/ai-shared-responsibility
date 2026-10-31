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

   Commit the updated fixture in a pull request. The command leaves the fixture unchanged when the monitor file is not on the default branch yet, and it exits with an error so the missing file is visible.

3. CI resolves the monitor default branch and fetches that file on every push and pull request to `develop` and `main`. The `whitepapers-fixture` job fails when the committed fixture is not the same JSON, or when the fixture `updated` date is more than 14 days before the run date. Fourteen days covers the weekly monitor pass plus one missed week. If the monitor file is not on the default branch yet, the job prints a warning and does not fail for that absence. The age check still runs. [Monitor pull request 173](https://github.com/billbrietstout/ai-security-whitepaper-monitor/pull/173) adds `data/whitepapers.json` on `master`. Until that pull request merges, the warning is the expected result, and this site cannot prove the fixture matches the monitor.

4. `build/source-wp-ids.json` maps each site source code to a `WP-` id. `build/generate_principle_catalogs.py` writes that id onto the source in `data/ai-agentic-principles.json`. When the map includes `monitor_issue`, the generator copies it. The generator does not invent issue numbers.

5. `scripts/site_sync.py` reads a monitor change list and writes a proposed catalog under `reports/`. It does not write `data/`. When the monitor paper has an issue number, the proposal sets `monitor_issue` on that source. A person reviews `reports/principles-diff.md` and, if they accept it, copies the candidate into `data/` in a pull request.

6. The pages read `data/ai-agentic-principles.json`. `scripts/validate_principles.py` checks that file. The `validate-principles` job runs on every push and pull request to `develop` and `main`. There is no path filter.

## What each source and principle must carry

A source traces to the monitor when `monitor_issue` is the GitHub issue number for that paper. Matched sources also keep `wp_id` (`WP-` plus four digits). That id must be in the fixture with decision `Include`. If both numbers are set, they must name the same paper: `monitor_issue` equals the fixture `issue` for that `wp_id`.

`inventory_status: unmatched` means the source has no monitor `WP-` id. That is a warning through 2026-11-30. Starting 2026-12-01 it is an error. `pending_add` stays allowed when `wp_id` is empty and `inventory_note` says why. Sources with no `monitor_issue` produce one summary warning. That summary stays a warning after 2026-11-30.

An agentic principle traces to a risk, an obligation, and a source when `risks` and `obligations` are non-empty arrays of strings and `src` names sources that resolve. Empty `risks` or `obligations` is a warning through 2026-11-30. Starting 2026-12-01 it is an error. The catalog on `develop` does not fill those arrays yet. Fill them in a later pull request before 2026-12-01, or the check fails on that date. The risks and obligations check applies to the agentic catalog. The classic catalog (`security-principles.json`) cites frameworks.

A principle id that is not in the base catalog fails the check when its statement support score prints as `0.00` and at least one cited paper has extracted text in the fixture. Support is the overlap between the statement and that paper's axioms, invariables, and principles. A `0.00` score with no extracted text stays a warning. Ids already in the base catalog also stay warnings at `0.00`. In CI, a pull request uses the target branch as the base catalog, and a push uses the commit before the push. Locally, with no flag set, the script tries `origin/develop` and then `develop`. If that baseline cannot be read, the check warns and leaves a `0.00` score as a warning.

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
