# AISharedResponsibility.com

An open reference site for the [CoSAI AI Shared Responsibility Framework](https://www.coalitionforsecureai.org/) — interactive tools, layer definitions, persona guides, regulation mappings, and operating model matrices, all running as a static site with no build step and no server.

Live at **[aisharedresponsibility.com](https://aisharedresponsibility.com)**

---

## What's here

| Page | Purpose |
|------|---------|
| `/framework/` | Interactive 5-layer model with per-layer accountability detail |
| `/personas/` | The 8 CoSAI personas and their layer-by-layer responsibilities |
| `/operating-models/` | Layer × operating model responsibility matrix (IaaS, AI-PaaS, Agent-PaaS, AI-SaaS) |
| `/regulations/` | Living reference covering EU AI Act, NIST AI RMF, ISO 42001, and others, with staleness indicators |
| `/tools/` | Interactive governance tools (regulation discovery, controls assessment, policy pyramid, SRF stress test) |
| `/about/` | Project background and attribution |

---

## Running locally

No build step required. Serve the root directory with any static file server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# Caddy
caddy file-server --listen :8080
```

Then open `http://localhost:8080`.

All asset paths are root-relative (`/shared/styles.css`, `/data/layers.json`) so the site works correctly from any static server pointed at the project root.

---

## Contributing

### Updating regulation references

Edit `data/regulations.json`. Update the `last_verified` date for any entry you confirm is current — this clears the staleness badge on the Regulations page. Entries older than 180 days display a visible **Verify** indicator.

### Updating framework content

Layer definitions live in `data/layers.json`. Persona definitions live in `data/personas.json`. The operating model matrix lives in `data/matrix.json`. Schemas for all three are documented in `ARCHITECTURE.md`.

### Updating the knowledge layer

Edit order, taxonomy checks for new terms, and competency questions that
`verify_knowledge_layer.py` enforces are documented in
[`build/README.md`](build/README.md) under **How the knowledge layer is built**.
Public pages keep SRF nouns (**persona**, **layer**, **control**,
**obligation**, **attestation**); do not rename site IA around library-science
stage labels.

### Validating and updating whitepaper-derived principles

The whitepaper assessment page loads:

- `data/ai-agentic-principles.json` (and `.slim.json`): 145 agentic principles
  from 52 papers and 14 conference talks. Each source row carries a monitor
  `wp_id` when matched.
- `data/security-principles.json` (and `.slim.json`): 87 classic axioms from
  the OSCAL catalog. These cite frameworks, not whitepapers.

Do not hand-edit the generated JSON. Edit
`agentic-ai-security/agentic-security.md` and `build/source-wp-ids.json`, then
run `python3 build/generate_principle_catalogs.py`.

**Validate** (fails the check on errors; warnings are listed for review):

```bash
python3 scripts/validate_principles.py
python3 scripts/sync_whitepapers_fixture.py --check
```

`validate-principles` and `whitepapers-fixture` run on every push and pull
request to `develop` and `main`. The validator checks schema shape, unique
ids, section membership, that every `src` code resolves, that every matched
source has a `wp_id` found in `build/fixtures/whitepapers.json` with decision
Include, `monitor_issue` when it is set, statement support against that
paper's axioms, invariables, and principles, unused sources, Include-paper
gaps, near-duplicates, and duplicate URLs. Unmatched sources, and empty
`risks` or `obligations`, warn through 2026-11-30 and fail starting
2026-12-01. A principle id that is not on the base branch fails when its
support score prints as 0.00 and a cited paper has extracted text in the
fixture. A 0.00 score with no extracted text stays a warning.

The fixture check fails when `build/fixtures/whitepapers.json` differs from
the monitor repository's `data/whitepapers.json` on its default branch, or
when the fixture `updated` date is more than 14 days old. The script asks
the GitHub API for that branch. Today it is `master`. If the monitor file
is not on the default branch yet, the check warns and does not fail for the
absence. That is the expected result until
[monitor pull request 173](https://github.com/billbrietstout/ai-security-whitepaper-monitor/pull/173)
merges.

How the data moves, and the branch protection settings to require these
checks, are in [`docs/monitor-data-flow.md`](docs/monitor-data-flow.md).

**Weekly update** (after the monitor publishes changed WP- IDs):

```bash
python3 scripts/site_sync.py \
  --whitepapers path/to/whitepapers.json \
  --changes path/to/whitepapers_changes.json
python3 scripts/validate_principles.py \
  --agentic reports/ai-agentic-principles.candidate.json
```

Review `reports/principles-diff.md`. With approval, copy the candidate into
`data/`, open a pull request against `develop`, and merge. Do not push
straight to `develop` or `main`. Refresh the fixture when the monitor export
changes:

```bash
python3 scripts/sync_whitepapers_fixture.py
```

Sources still missing from the monitor keep `inventory_status: pending_add`
and an `inventory_note` until they have a `WP-` id. `unmatched` is a warning
through 2026-11-30 and an error starting 2026-12-01.

### Adding a page

1. Create a directory and `index.html` (copy `about/index.html` as a starting point).
2. Add one entry to the `NAV_LINKS` array in `shared/components.js`.
3. Add the nav entry to the footer link list in `components.js`.

No other files change. See `ARCHITECTURE.md` for the full walkthrough.

### Design system

All tokens are in `shared/styles.css`. Token names are intentionally aligned with the companion `cosai-wizards` repository so both projects share a coherent visual identity.

---

## Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for a full description of the directory layout, shared component system, data schemas, and hosting options.

---

## Security

See [`security-audit.md`](security-audit.md) for the most recent security review. To report a vulnerability, open an issue or email the maintainer directly.

---

## License

This repository is dual-licensed by component. See [`NOTICE`](NOTICE) for full attribution.

| Component | License |
|-----------|---------|
| Code (HTML, CSS, JavaScript, `build/` scripts) | [Apache License 2.0](LICENSE) |
| Original site content (page copy, glossary definitions, vertical control schemas) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `shared/vendor/jspdf-2.5.1.umd.min.js` | MIT (jsPDF, © James Hall and contributors) |

The CoSAI AI Shared Responsibility Framework content referenced and displayed by this site (the five layers, eight personas, four operating models, and accountability rules) is a publication of the [Coalition for Secure AI (CoSAI)](https://www.coalitionforsecureai.org/), a project of OASIS Open. Framework text, layer definitions, and persona descriptions are reproduced here for educational and reference purposes consistent with CoSAI's open publication goals; source and version attribution is retained in the `source` field of the relevant `data/*.json` files.

The industry vertical control schemas (finance, healthcare, insurance, public sector, defense, manufacturing) are independently proposed extensions authored for this site and are not part of an official CoSAI release. Review the framework's own copyright and attribution terms before redistributing or commercializing derived work.
