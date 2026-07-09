# TACIP machine-readable example — orphan directory

Target site: **aisharedresponsibility.com** (GitHub Pages, repo
`billbrietstout/ai-shared-responsibility`, `main` branch, served from the repo root, Jekyll
disabled via `.nojekyll`). Placing this folder at the repo root as `nist/` publishes it at
**https://aisharedresponsibility.com/nist/** with every file served verbatim.

This directory is an **orphan / unlinked example**. It is intentionally NOT integrated with the
rest of the site:

- Nothing in these files links out to the main site, and the main site should not link in.
- Do **not** add it to the site navigation, sitemap, or the site-level `llms.txt`
  (the folder's own `tacip.llms.txt` is the only index for this directory).
- The landing page (`index.html`) carries `<meta name="robots" content="noindex, nofollow">`.
- It is a proof-of-concept built from the public NIST TACIP discussion draft. It is **not**
  official NIST output.

## To publish (choose one)

**Git CLI** — from a local clone of the repo:
```
cp -R nist /path/to/ai-shared-responsibility/nist
cd /path/to/ai-shared-responsibility
git add nist && git commit -m "Add orphan NIST TACIP machine-readable example" && git push
```

**GitHub web UI** — open the repo → Add file → Upload files → drag the contents of this folder,
set the path prefix to `nist/`, and commit to `main`.

GitHub Pages redeploys automatically; the directory is live at `/nist/` within a minute or two.
Because `.nojekyll` is set, `.md`, `.json`, `.txt`, and `.html` are all served as-is.

## Contents (all links are relative; the set is self-contained)

- `index.html` — static, human-readable document (no scripts) with stable heading anchors:
  `#practice-N`, `#task-N-M`, `#impl-N-M-K`.
- `tacip-profile.json` — the whole profile as structured data (canonical source).
- `tacip.llms.txt` — concise index for LLMs/agents.
- `tacip-schema.json` — JSON Schema for a profile node.
- `references.json` — cross-sector reference crosswalk (leads with OSCAL/SCAP/SBOM).
- `suggestions.json` — reviewer/team-proposed additions, keyed by node id.
- `WHY-machine-readable.md` — rationale and design notes.

`index.html`, `tacip-profile.json`, and `suggestions.json` are kept in sync: the HTML and the
`proposed` arrays in the JSON are generated from the same source, so editing one means
regenerating the set rather than hand-editing.

## To deploy

Upload this entire `nist/` folder to the web root so it serves at `/nist/`. No build step,
no server-side code, no dependencies. Serve `.json` as `application/json`, `.txt` as
`text/plain`, and `.md` as `text/markdown` (or `text/plain`).

Generated 2026-07-08.
