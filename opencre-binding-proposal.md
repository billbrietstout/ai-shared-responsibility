# Proposal: SRF Canonical IDs as OpenCRE Resources

Contribution proposal for the MOSAIC shared taxonomy, to be socialized through the CoSAI channel and submitted to the MOSAIC GitHub (github.com/OWASP/MOSAIC). Drafted July 12, 2026.

## One-paragraph summary

The MOSAIC shared taxonomy, built on OpenCRE by the OWASP AI Exchange, links what participating standards say: threats, controls, terms, and concepts. None of the linked nodes carry who is accountable. This proposal binds the CoSAI AI Shared Responsibility Framework's canonical IDs (five layers, eight personas, four operating models, and the twenty accountability matrix relations) into OpenCRE as linkable resources, so that any threat or control node in the taxonomy can resolve to an accountable persona under a stated operating model. It operationalizes CoSAI's own published framework inside MOSAIC's taxonomy. It creates no new standard and no new committee.

## What the SRF contributes

Each MOSAIC participant covers different ground. BIML, the AI Exchange, and ATLAS document what can go wrong. CIS, CSA, and the AI Exchange controls document what good looks like. AIVSS rates how bad a finding is. None of them record accountability. The SRF adds that, for every activity in the AI security lifecycle:

1. Who must authorize the activity.
2. Who owns each result.
3. Who signs the residual risk.

One accountable party per activity; "shared" is not a valid final answer. The framework is published by CoSAI, a MOSAIC founding participant, and is operationalized with machine-readable artifacts at aisharedresponsibility.com.

## What the binding contains

Two generated files, kept current by `build/generate_opencre_binding.py` in the site repository:

- `export/opencre-srf.json`: 38 OpenCRE Standard document objects. Each carries the SRF canonical ID as `sectionID` (from the site's `/ids.json` registry), the human name as `section`, and a resolvable `hyperlink`. Matrix relations compose existing IDs with the `assigns_responsibility` relation already published in the site ontology; the binding mints no new identifiers.
- `export/opencre-srf.csv`: the same resource set in the MyOpenCRE import format (per `docs/my-opencre-user-guide.md` in OWASP/OpenCRE), ready for a local OpenCRE instance with `CRE_ALLOW_IMPORT=1`.

## Proposed CRE anchors

Three CREs verified against the live OpenCRE graph on July 12, 2026 already describe where the SRF's constructs belong. Names below are verbatim from the OpenCRE data.

| CRE | Name | SRF sections proposed |
|---|---|---|
| 225-553 | Organizational AI security controls | Framework root, L1, governance and user personas |
| 663-200 | Technical AI security controls | L2 through L5, technical personas |
| 803-457 | Protection against AI-Specfic Threats | The four operating models |

These are proposals for a working session with the OpenCRE maintainers, not published mappings. Sections without an anchor import as unmapped resources; nothing in the binding guesses a CRE.

## What this is not

The SRF stays in its accountability lane. Attack techniques, threats, and test methodology belong to BIML, the AI Exchange, ATLAS, and NIST AI 100-2. Control content and benchmarks belong to CIS, CSA AICM, and the AI Exchange controls. Severity scoring belongs to AIVSS. The SRF creates no regulatory obligations. The binding adds accountability data to the taxonomy and nothing else.

## Worked example

The AI Exchange page for direct prompt injection links to controls and related standards through the taxonomy today. With the binding it can also resolve the accountability data. The threat lands at SRF layer L3. Under AI-PaaS the accountable persona is the application developer on the customer side. Under AI-SaaS the layer is provider-managed, so customer testing requires provider authorization. The companion crosswalk (`data/threats.json` on the site) publishes this resolution for the sixteen threats in the AI Exchange security matrix, with mappings to the LLM Top 10, ATLAS techniques, and BIML risk IDs.

## Ask

1. Review of the resource set format against current OpenCRE import expectations.
2. A working session to confirm or correct the three proposed CRE anchors and to map the currently unmapped sections.
3. Inclusion of the binding in the MOSAIC shared taxonomy discussion as the accountability axis contribution from CoSAI's framework.

## References

- Binding artifacts: https://aisharedresponsibility.com/export/opencre-srf.json and /export/opencre-srf.csv
- Canonical ID registry: https://aisharedresponsibility.com/ids.json
- Threat crosswalk: https://aisharedresponsibility.com/data/threats.json
- CoSAI AI Shared Responsibility Framework: https://aisharedresponsibility.com/framework/
- OpenCRE: https://opencre.org/ and https://github.com/OWASP/OpenCRE
- MOSAIC: https://mosaicstandards.org/ and https://github.com/OWASP/MOSAIC/
