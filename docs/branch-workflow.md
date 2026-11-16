# Branch workflow

GitHub Pages for [aisharedresponsibility.com](https://aisharedresponsibility.com/) deploys from **`main`** (repository root). Deleting `main` takes the live site down. That happened on 16 Nov 2026 after a merge into `develop` removed `main`; the site stayed offline until Pages was pointed at a restored `main` again.

## Day to day

1. Cut work from current `develop` (`cursor/…` or `feature/…`).
2. Open pull requests into **`develop`**.
3. Do not commit or push on `main`. Do not delete `main`.

## Production publish

When Bill asks to publish, open a pull request **`develop` → `main`** and merge it. Do not push commits straight to `main`.

## Branch protection (owner)

In the GitHub UI, protect both branches:

| Setting | `develop` | `main` |
|---|---|---|
| Require a pull request before merging | yes | yes |
| Restrict who can push | yes | yes |
| Allow deletions | **no** | **no** |
| Allow force pushes | no | no |
| Required status checks (when configured) | `verify`, `validate-principles`, `whitepapers-fixture` | same |

Leave automation branches such as `automation/monitor-fixture-sync` and `automation/regulations-stale-check` off the protected list so Actions can push them.
