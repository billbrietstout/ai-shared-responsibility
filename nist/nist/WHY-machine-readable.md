# Making the TACIP profile LLM- and machine-readable

**A proof-of-concept companion to the *Trustworthy AI in Critical Infrastructure Profile* (TACIP) discussion draft.**
This note explains what was restructured, why, and how the accompanying files fit together. It is not official NIST output; it is a demonstration built from the public draft to make a concrete case. It is intended to live in an isolated, unlinked directory (e.g. `/nist/`) so it is not confused with, or integrated into, the rest of the host site.

## The short version

The TACIP draft already states an intent to serve as a *"translator, crosswalk, and index to existing relevant guidance,"* and is already published *"in both PDF (for printing) and HTML (for AI assistants)."* Those are the right instincts. The gap is that the *content* is machine-friendly by structure but the *container* is not: it lives as a Google Doc table exported to PDF/HTML, so the structure a machine needs — stable identifiers, typed fields, addressable anchors, and a queryable reference index — is present visually but not captured in a form software can read.

The fix is a publishing discipline, not new technology, and it changes none of the substance. It is the same pattern the CoSAI Shared Responsibility Framework site uses (plain text, JSON, and a concept graph with stable IDs so "you can point an agent at any of these"). This companion applies that pattern to TACIP.

## Why TACIP is unusually well-suited to this

TACIP's content is already a strict hierarchy with identifiers built in: **Practice `N`** (governance/executive) → **Task `N.M`** (technical management) → **Implementation `N.M.K`** (operational). Each node already carries typed fields — an adoption incentive, *Related Keywords*, *Trustworthiness Characteristics*, *AI RMF Mappings*, *Cyber AI Profile Mappings*, and *References* (often to an exact clause, e.g. "ISA/IEC 62443-4-1, Clause 9, Practice 5"). The prose is dense with cross-references ("see Task 3.4…"), which is a citation graph waiting to be captured. The SSDF-inspired structure the authors chose is, in effect, a ready-made data model.

From the current draft this companion captures **12 practices, 53 tasks, and 144 implementations**, with no change to the underlying text.

## What was actually changed

| From (current draft) | To (companion files) | Why it matters |
|---|---|---|
| IDs visible as text in a table ("3.2.3") | Stable IDs + URL anchors (`#impl-3-2-3`) an agent can cite and deep-link | An assistant points a reader to the exact node, not "somewhere in the PDF" |
| RMF mappings, keywords, characteristics as prose | Typed fields in JSON, validated against a schema | Software can filter ("every Measure-function task") instead of guessing from text |
| References as free text in cells | Structured reference objects: citation + URL + specific sections | Directly realizes the profile's "index" goal |
| "See Task 3.4" as a hyperlink | Typed cross-reference edges | The internal dependency graph becomes traversable |
| Cyber AI Profile fields blank (IR 8596 drafting) | Explicit `status: "pending"` with the framework named | Machines distinguish "no mapping" from "mapping not yet published" |
| No machine-readable-standards layer | OSCAL / SCAP / SBOM references attached per applicable practice | Connects each governance control to how it is expressed and checked by tools |
| `(TBD)` and `Candidates` fields left empty | Reviewer/team proposals attached to each node, tagged **Proposed** | Fills the draft's open fields without blurring official vs. suggested |

## The companion file set

- **`index.html`** — a **static** document (no scripts) that reads like the original Google Doc: sectioned topics, a table of contents, and every Practice/Task/Implementation in flow with a stable, visible anchor for LLM referencing.
- **`tacip-profile.json`** — the entire profile as structured data. One record per node with its typed fields, references, cross-references, and any `proposed` additions. This is the canonical artifact; the HTML and index derive from it.
- **`tacip.llms.txt`** — a concise, linked index following the `llms.txt` convention: the place to start an agent.
- **`tacip-schema.json`** — a JSON Schema defining a node, documenting the ID scheme and field vocabulary.
- **`references.json`** — the cross-sector reference crosswalk, indexed *by reference* and *by practice*, and led by the machine-readable automation standards.
- **`suggestions.json`** — the reviewer/team-proposed additions, keyed by node id (also embedded in the profile JSON and rendered in the HTML).

## Related governance and standards, down to the machine-readable layer

Each applicable practice carries a *Machine-readable & automation standards* block, and the reference index leads with these cross-cutting standards:

- **OSCAL** (catalog, profile, component-definition, SSP, assessment-plan/results, POA&M; XML/JSON/YAML) — the natural format for the control and mapping content this profile assigns.
- **SCAP** — current effective version SCAP 1.3 (SP 800-126 Rev 3); SCAP 1.4 (Rev 4) in draft — with XCCDF, OVAL, CCE, CPE, CVE, CVSS, SWID, for configuration, monitoring, and validation practices.
- **National Checklist Program**, **SBOM/SWID** (SPDX, CycloneDX, CISA SBOM), **MITRE ATLAS + NIST AI 100-2e2025**, and **CSF 2.0** machine-readable references, plus the full cross-sector governance crosswalk (NERC CIP, CMMC/800-171, NYDFS Part 500, FDA, and more) grouped by sector.

## Proposed additions (kept clearly separate)

The draft's 83 `(TBD - suggestions welcome)` fields and 31 `Candidates - suggestions welcome` fields have proposed content attached — **114 proposals** in all — each shown in an amber **Proposed** block under its node and labeled with its source id (`TBD-002`, `CAND-018`, …) and field. They are deliberately *not* merged into the draft text: an editor can accept, revise, or reject each one, and no reader can mistake a suggestion for official NIST content.

## NIST-specific cautions

1. **Pin external versions.** The AI RMF (AI 100-1) and Cyber AI Profile (IR 8596) IDs shift between revisions; every crosswalk entry names the version it targets and marks IR 8596 mappings `pending`.
2. **Treat the IDs as an interface.** Once Practice/Task IDs are citable anchors, downstream profiles and tools depend on them; renumbering later breaks references.
3. **Keep one source of truth.** Author once (structured) and *generate* the PDF/HTML/JSON/`llms.txt` from it — which is how these files were produced — so they cannot drift apart.
4. **This is a demo, not a validation.** Content was extracted programmatically from the public draft; the authors remain the authority on every word. Empty `TBD` fields are represented as absent, not invented; proposals are labeled as such.

## Deployment note (orphan directory)

These files are self-contained and use only relative links. They are meant to be dropped into an isolated directory such as `aisharedresponsibility.com/nist/`, unlinked from the site's navigation and `llms.txt`, and carrying `noindex` so the example is not indexed or treated as part of the site. See `README.md` in that directory for the specifics.
