# Handoff: Tranche 3, Insurance Mapping Resolution

For a fresh session (Sonnet-class is fine; the pattern is established). Read this file first, then execute. Companion docs: `oscal-content-work-scope.md` (program scope), `oscal-vertical-mapping-plan.md` (design). Tranches 1 (finance) and 2 (public-sector) are complete and are your exemplars.

## Mission

Resolve the TBD regulatory mapping IDs in `data/insurance-controls.json` against primary sources, then regenerate and verify the OSCAL exports. 153 TBDs across six mapping keys, 40 controls.

| Key | TBDs | Source | Access notes |
| --- | --- | --- | --- |
| `naic_model_bulletin` | 33 | NAIC Model Bulletin on the Use of AI Systems by Insurers (Dec 2023) | free PDF: content.naic.org/sites/default/files/inline-files/2023-12-4%20Model%20Bulletin_Adopted_0.pdf |
| `naic_eval_tool` | 26 | NAIC AI Systems Evaluation Tool (Big Data and AI WG pilot) | may be gated or unpublished; see rule 4 below |
| `co_reg_10_1_1` | 30 | Colorado 3 CCR 702-10, Regulation 10-1-1 | state register / doi.colorado.gov; find the amended text |
| `nydfs_cl7` | 20 | NYDFS Insurance Circular Letter No. 7 (2024) | free: dfs.ny.gov/industry_guidance/circular_letters/cl2024_07 |
| `eu_ai_act` | 36 | Regulation (EU) 2024/1689 | confirmation pass; see rule 5 |
| `owasp_llm` | 8 | OWASP LLM Top 10 | trivial; match the verified format already used in this file (32 entries are already verified) |

## Non-negotiable rules

1. Never invent an ID, section number, or article number. If the source text does not confirm the reference, the value stays TBD, verbatim discipline per each file's `mapping_status_note`.
2. Only replace values containing "TBD". Do not touch verified values or existing N/A entries.
3. N/A means confirmed no-nexus, not "could not find". Use it only when you have read the source and it does not address the control's subject.
4. If a source is gated or unpublished (likely for `naic_eval_tool`), replace the TBD with a sharpened blocked note modeled on the `cosais` note in `data/public-sector-controls.json`: name what is blocking, where to check, and "Do not substitute invented IDs."
5. EU AI Act: the enacted regulation renumbered draft articles. Known trap already fixed in finance: draft "Article 62" (serious incident reporting) is final Article 73; post-market monitoring is Article 72. Use final numbering and official article titles. Grammar is in the file's `eu_ai_act_citation_format` header.
6. Citations use the source's own IDs with a title gloss in parentheses, multiple citations joined by "; ". Copy the pattern from `data/finance-controls.json` and `data/public-sector-controls.json` headers.

## Workflow

1. Read `data/insurance-controls.json`: headers, then every control's `title`, `description`, and TBD hint strings (the hints name the expected section; your job is to confirm or correct them).
2. Fetch sources. Operational notes from tranches 1 and 2:
   - `web_fetch` handles most sites including PDFs. Oversized results persist to a host-side file; read it with the Read/Grep tools (it is NOT visible in the bash sandbox).
   - Sandbox curl is blocked for most domains (raw.githubusercontent.com, csrc.nist.gov, whitehouse.gov). `git clone` from github.com works, including sparse clones.
   - The bash sandbox `/tmp` resets between sessions.
3. Build one resolution table (control id to per-key value), then patch the JSON with a python script that asserts it only replaces TBD-containing values. Add citation format headers: `naic_model_bulletin_citation_format`, `naic_eval_tool_citation_format`, `co_reg_10_1_1_citation_format`, `nydfs_cl7_citation_format` (grammar mirroring the existing headers), and update `mapping_status_note` with the verification date and what remains blocked.
4. If any newly resolved key uses "; "-joined citations, add that key to the `cites =` split list in `build/generate_oscal_verticals.py` (search for `finos_aigf`, the list is there).
5. Spot-check the `FRAMEWORKS` dict in `build/generate_oscal_verticals.py`: `co_reg_10_1_1` currently points at the doi.colorado.gov root and `naic_eval_tool` at the working-group page. If you find better canonical URLs while reading sources, update them.
6. Regenerate and verify:

```bash
python3 build/generate_oscal_verticals.py
python3 build/verify_oscal.py          # expect: all checks passed
# 800-53 catalog for the gap register (sparse clone; /tmp was wiped):
cd /tmp && git clone --depth 1 --filter=blob:none --sparse https://github.com/usnistgov/oscal-content.git \
  && cd oscal-content && git sparse-checkout set nist.gov/SP800-53/rev5/json \
  && cp nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json /tmp/
python3 thresholds/generate-gap-register.py --catalog /tmp/NIST_SP-800-53_rev5_catalog.json
```

   Optional extra validation layer: `pip install --break-system-packages compliance-trestle`, parse the catalog and profiles with `trestle.oscal.catalog.Catalog` / `trestle.oscal.profile.Profile` (its models pin OSCAL 1.2.1, so set `metadata['oscal-version']='1.2.1'` on a deepcopy before parsing).

7. Update `oscal-content-work-scope.md`: flip the tranche 3 table rows to done (or blocked) and add a short execution paragraph mirroring the tranche 1 and 2 entries.
8. Update auto-memory `project_oscal_vertical_mapping.md`: tranche 3 outcome, anything learned about sources, and the new remaining list.

## Definition of done

Zero TBDs in `data/insurance-controls.json` except explicitly blocked keys with sharpened notes; citation format headers added; `verify_oscal.py` passes; gap register regenerated; scope doc and memory updated; a closing summary that names every judgment call a reviewer should check (conservative N/As, any stretch mappings, corrected hint proposals).

## Context you inherit

Control IDs in the OSCAL catalog are namespaced `ins-srf-l1-dev-001` style; original IDs are in prop `srf-id`. Verified mappings become links to back-matter resources on regeneration; TBD and N/A stay as props with class `unresolved`. The insurance vertical page unhides verified mappings automatically. Decisions on record: never buy paywalled standards; blocked sources get notes, not guesses.
