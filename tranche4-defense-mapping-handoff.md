# Handoff: Tranche 4, Defense Mapping Resolution

For a fresh Fable session, after tranche 3 (insurance) completes. Read this file first, then execute. Companion docs: `oscal-content-work-scope.md` (program scope), `oscal-vertical-mapping-plan.md` (design), `tranche3-insurance-mapping-handoff.md` (same workflow, insurance specifics). Finance and public-sector are fully resolved exemplars; insurance should be too by the time this runs.

## Mission

Resolve the TBD regulatory mapping IDs in `data/defense-controls.json` against primary DoD sources, then regenerate and verify the OSCAL exports. 162 TBDs across five mapping keys, 53 controls, the largest vertical. This tranche was sequenced last deliberately: it carries the most N/A judgment.

| Key | TBDs | Source | Access notes |
| --- | --- | --- | --- |
| `dodi_5000_90` | 53 | DoDI 5000.90 | esd.whs.mil PDF; see the identity check below |
| `dod_rai_strategy` | 45 | DoD Responsible AI Strategy and Implementation Pathway (June 2022) | free PDF: media.defense.gov/2022/Jun/22/2003022604/-1/-1/0/Department-of-Defense-Responsible-Artificial-Intelligence-Strategy-and-Implementation-Pathway.PDF |
| `cc_srg` | 25 | DoD Cloud Computing Security Requirements Guide | public.cyber.mil/dccs/ |
| `cmmc_2_0` | 24 | CMMC 2.0 (32 CFR Part 170 final rule) | dodcio.defense.gov/cmmc/ and eCFR |
| `dodi_5000_89` | 15 | DoDI 5000.89, Test and Evaluation | esd.whs.mil PDF |

**Source identity check first.** The schema's `dodi_5000_90` hints reference "AI system registration and reporting requirements", but DoDI 5000.90 (Dec 2020) is *Cybersecurity for Acquisition Decision Authorities and Program Managers*. Before resolving anything, fetch the instruction and confirm which document the schema author meant. If the hints actually describe a different issuance (check whether a newer AI-specific DoDI or CDAO directive matches), record the discrepancy, resolve against the correct document, and fix the title and URL in the generator's `FRAMEWORKS` dict rather than forcing citations into the wrong instruction. This is the single highest-risk spot in the tranche.

## Non-negotiable rules

Same as tranche 3 (see that handoff, rules 1 through 6), plus defense-specific discipline:

1. N/A restraint is the core skill here. 27 to 28 of the `cc_srg` and `cmmc_2_0` values are already N/A by design. For the TBDs, do not force an IL-level or CMMC-practice mapping where the SRG or CMMC text is silent on the control's subject; AI is largely absent from both documents, and "this generically covers all systems" is not a mapping. Cite only where the source names the practice or requirement the control operationalizes. Confirmed silence is N/A; unconfirmed is TBD.
2. CMMC citations should use practice IDs (e.g., the 32 CFR 170 / NIST SP 800-171 practice identifiers) consistent with whatever the file's existing two verified `cmmc_2_0` values use; also cross-check the `cmmc_practices` field already on each control, which may pre-name candidate practices.
3. `dod_rai_strategy` hints all say "Implementation Pathway Section TBD"; the Pathway has numbered lines of effort and goals. Cite at the tier the document supports (line of effort / goal), not invented sub-numbering. The RAI principle names already in each control's `dod_rai_principles` field stay untouched.
4. Defense has no `eu_ai_act` key; do not add one. Operating models here are AI-SaaS, AI-PaaS, Agent-Ops, Program-Embedded; NSS and IL applicability fields are data, not mapping targets.
5. `nist_800_171` and `nist_ai_rmf` are already fully resolved; do not touch them.

## Workflow

Identical to tranche 3, steps 1 through 8: read the data file, fetch sources (web_fetch for PDFs, oversized results persist host-side, github.com is git-clonable, /tmp resets), build the resolution table, patch only TBD values, add `dod_rai_strategy_citation_format` / `dodi_5000_90_citation_format` / `dodi_5000_89_citation_format` / `cc_srg_citation_format` / `cmmc_2_0_citation_format` headers, update `mapping_status_note`, add any "; "-joined keys to the generator's split list, regenerate, run `verify_oscal.py`, regenerate the gap register with the sparse-cloned 800-53 catalog, update the scope doc and auto-memory.

## Definition of done

Zero TBDs in `data/defense-controls.json` except explicitly blocked sources with sharpened notes; the DoDI 5000.90 identity question answered on the record; citation format headers added; `verify_oscal.py` passes; gap register regenerated; scope doc and memory updated, with the remaining program items now reduced to COSAiS binding (blocked on NIST), workstream B convergence, and the OCSF evidence pointer pass. Close with the judgment-call list for review, with special attention to every TBD-to-N/A conversion in `cc_srg` and `cmmc_2_0`.

## Why Fable for this one

Defense is where a plausible-but-wrong mapping is most tempting and most costly: two of the five sources barely mention AI, one source's identity is in question, and the output feeds Bill's NIST 800-53 AI overlay feedback. The whole TBD discipline exists to keep invented references out of that artifact.
