# Department of War Vertical: Handoff Brief

Working brief for completing the Department of War SRF control schema, scoped to DoD components
and the defense industrial base (DIB). Follow CLAUDE.md writing rules (no em dashes, no AI
filler phrases). Read "Lessons from prior builds" before writing anything. This brief documents
what is already done and what remains.

---

## What is already done (do not rebuild)

| File | Status | Notes |
|---|---|---|
| `/defense/index.html` | Complete | Hub page: IL table, context blocks, stat strip, schema design, layer coverage, crosswalk pills |
| `/industries/index.html` | Updated | Card renamed "Department of War," set to Live, links to `/defense/` |

The hub page defines the canonical terminology, layer counts, and regulatory crosswalk. Any
counts stated in sub-pages must match the hub exactly:
- **45 controls** total
- **5 SRF layers** (L1-L5)
- **3 impact levels**: IL4, IL5, IL6
- **2 NSS tiers**: Non-NSS and NSS
- **4 lifecycle stages**: ACQ, TEVV, OPS, OVR
- **5 responsibility_split values**: `dod-component`, `disa`, `contractor`, `csp`, `shared`

---

## Impact Level and NSS terminology (canonical reference)

Use this table as ground truth throughout all deliverables. Do not paraphrase or invent variations.

| Level | NSS tier | Data type | Cloud path |
|---|---|---|---|
| IL4 | Non-NSS | CUI, no NSI | Commercial cloud, DISA IL4 PA required |
| IL5 | Non-NSS | Higher-sensitivity CUI (Privacy Act, law enforcement sensitive, export-controlled research) | Government-only cloud region, DISA IL5 PA |
| IL5 | NSS | Unclassified NSS; systems per 44 USC 3552(b)(6): intelligence, cryptology, command/control of military forces, weapons systems | Government-only cloud region, CNSS Policy 22, CNSSI 1253 |
| IL6 | NSS | Classified up to and including SECRET | Classified cloud only (AWS C2S, Azure Government Secret, Oracle NSR); no commercial path |

Key terms:
- **Non-NSS**: Non-National Security System. Many DoD administrative, logistics, and healthcare
  systems are Non-NSS even at IL5.
- **NSS**: National Security System as defined in 44 USC 3552(b)(6). The deploying component
  makes the NSS boundary determination; it is not automatic.
- **DISA PA**: DISA Provisional Authorization. Required before a DoD component may use a
  commercial cloud service. Separate from FedRAMP.
- **CMMC**: Cybersecurity Maturity Model Certification (32 CFR Part 170, effective December 2024).
  Governs contractor cybersecurity posture for CUI (Level 2, 110 NIST 800-171 practices) and
  higher-value programs (Level 3, NIST 800-172 subset). Does not govern AI; this schema adds
  the AI governance layer CMMC lacks.
- **TEVV**: Test, Evaluation, Verification and Validation per DoDI 5000.89. The DoD-specific
  equivalent of the pre-deployment validation stage in sibling schemas.
- **DoD RAI principles**: Responsible, Equitable, Traceable, Reliable, Governable (RETR-G).
  Published in the DoD Responsible AI Strategy and Implementation Pathway, June 2022.
- **CDAO**: Chief Digital and Artificial Intelligence Office. DoD-level AI governance authority.
- **CC SRG**: Cloud Computing Security Requirements Guide. DISA document defining what a CSP
  must implement to earn a PA at each IL. This schema covers the component side of that split.

---

## Architecture (same three planes as sibling schemas)

1. **Accountability plane**: SRF layers and personas. Reuse the existing six personas
   (`ai-system-governance`, `data-provider`, `application-developer`, `agentic-platform-provider`,
   `ai-platform-provider`, `model-provider`). The how-to guide maps these to DoD roles
   (CDAO, Program Manager, ISSO, Contracting Officer, AO). Do not mint DoD-title personas in the JSON.

2. **Control plane**: IL-parameterized control objects keyed to four DoD AI lifecycle stages:
   - `ACQ` - acquisition and program management
   - `TEVV` - test, evaluation, verification and validation
   - `OPS` - operational deployment and monitoring
   - `OVR` - human oversight, operator control, and remediation
   Each control also carries `responsibility_split`, `nss_applicability`
   (`non-nss`, `nss`, or `both`), `il_applicability` (array: `IL4`, `IL5`, `IL6`), and
   `cmmc_practices` (array of NIST 800-171 practice IDs where applicable, else empty array).

3. **Evidence plane**: OCSF v1.8.0 where a machine-readable signal exists. Governance
   documents (TEVV plan, AI impact assessment, ATO package, CMMC evidence folder, NSS boundary
   determination memo) are named explicitly. IL6 evidence notes classified artifact handling
   (documents exist but cannot be linked; the schema records the document type and custodian role).

**ID convention**: `SRF-{layer}-{ACQ|TEVV|OPS|OVR}-{seq}` (three-digit seq, zero-padded).
**Schema metadata**: `schema_version: "0.1"`, `srf_version: "1.0"`, `industry: "defense"`.

---

## Lessons from prior builds (do not repeat)

1. No em dashes anywhere: HTML, JSON strings, xlsx cells. Healthcare shipped 228; all had
   to be swept. Check with `grep -r " -- \|—"`.
2. `param_type` on every threshold: `zero-tolerance`, `verification`, or `tier-configurable`.
   Use exactly these three values; do not invent variations.
3. Any count stated in page copy must be computed from the JSON, not estimated. Run
   `jq '.controls | length'` before hardcoding numbers.
4. Do not invent regulatory citation IDs, section numbers, or dates. Mark unverified
   mappings TBD in the JSON with a `mapping_status_note` field. DoD directives and
   CC SRG section numbering are exactly the kind of thing that gets invented incorrectly.
5. Controls browser requirements: fetch the JSON, filter sidebar, search input, `escHtml`
   on every interpolated field, keyboard operability (Enter/Space) with `aria-expanded` on
   expandable cards, global underscore replace in mapping labels, hide TBD and N/A mappings
   from display.
6. Every page carries the experimental-schema notice (amber callout): proposed extension,
   not part of CoSAI SRF v1.0, not endorsed by CoSAI, DoD, DISA, or any government agency.
   The defense context makes the non-endorsement line critical.
7. Hub page persona and count listings must match the JSON exactly. Run a diff after
   generating the JSON before writing any sub-page copy.
8. All xlsx artifacts must be generated programmatically from the JSON, never hand-coded.
9. IL6 evidence: do not claim classified documents are accessible via URL. Note document
   type, custodian role, and access path (classified network or cleared facility) only.
10. `nss_applicability` and `il_applicability` are new fields not present in sibling schemas.
    Add them to every control. The controls browser must expose both as filter dimensions.

---

## Remaining deliverables

### 1. `data/defense-controls.json`

45 controls distributed across layers matching the hub page (10 / 8 / 9 / 10 / 8 for L1-L5).
Model the JSON structure on `data/public-sector-controls.json` with these additions:

```json
{
  "schema_version": "0.1",
  "srf_version": "1.0",
  "industry": "defense",
  "description": "...",
  "regulatory_context": "...",
  "id_convention": "SRF-{layer}-{ACQ|TEVV|OPS|OVR}-{seq}",
  "lifecycle_stages": ["acquisition", "tevv", "ops", "human-oversight-remedy"],
  "nss_tiers": ["non-nss", "nss"],
  "il_levels": ["IL4", "IL5", "IL6"],
  "responsibility_split_values": {
    "dod-component": "The DoD component is solely responsible.",
    "disa": "DISA owns this control through the PA or authorization process.",
    "contractor": "The defense contractor (DIB member) is solely responsible.",
    "csp": "The cloud service provider is solely responsible.",
    "shared": "Responsibility is split; the accountable party must document the split."
  },
  "controls": [ ... ]
}
```

Each control object:
```json
{
  "id": "SRF-L1-ACQ-001",
  "layer": "L1",
  "component": "Governance and Processes",
  "title": "...",
  "description": "...",
  "accountable_persona": "ai-system-governance",
  "dod_rai_principles": ["Responsible", "Governable"],
  "operating_models": ["AI-SaaS", "AI-PaaS", "Agent-Ops", "Program-Embedded"],
  "lifecycle_stage": "acquisition",
  "responsibility_split": "dod-component",
  "nss_applicability": "both",
  "il_applicability": ["IL4", "IL5", "IL6"],
  "cmmc_practices": ["3.12.1", "3.12.4"],
  "mappings": {
    "dod_rai_strategy": "Governable principle, Section TBD",
    "dodi_5000_90": "TBD",
    "dodi_5000_89": "N/A",
    "cmmc_2_0": "TBD",
    "nist_800_171": "3.12.1",
    "nist_ai_rmf": "GOVERN 1.1",
    "cc_srg": "TBD",
    "owasp_llm": "N/A"
  },
  "threshold": {
    "metric": "...",
    "description": "...",
    "evidence": {
      "ocsf_class": "...",
      "attribute": "TBD",
      "ocsf_version": "1.8.0"
    },
    "operator": ">=",
    "param": "TIER_...",
    "param_type": "tier-configurable",
    "window": "quarterly",
    "breach_action": "..."
  }
}
```

**Operating models for defense** (four, parallel to siblings):
- `AI-SaaS` - commercial AI service, DISA PA required
- `AI-PaaS` - platform (e.g., Azure Government, AWS GovCloud) with component-built application
- `Agent-Ops` - agentic AI in operational workflows (logistics, ISR data triage, administrative)
- `Program-Embedded` - AI embedded directly in a weapon system or C2 program (ACAT program)

**Planned controls per layer** (starting points; expand to reach target counts):

L1 - Governance (10):
1. AI use case registry and CDAO reporting (ACQ)
2. Responsible AI Officer designation (ACQ)
3. AI Governance Board with CDAO oversight link (ACQ)
4. DoD RAI compliance plan (five-principle assessment) (ACQ)
5. AI acquisition requirements documented per DoDI 5000.90 (ACQ)
6. Supply chain AI risk assessment (AI component provenance) (ACQ)
7. Operator and commander AI training program (ACQ)
8. Incident reporting to CDAO (OPS)
9. NSS boundary classification determination and documentation (ACQ)
10. TEVV plan existence and approval before operational deployment (TEVV)

L2 - Data (8):
1. CUI classification and marking on AI inputs and outputs (ACQ)
2. IL-level data boundary enforcement and tenant isolation (OPS)
3. Training data authority-to-use documentation (ACQ)
4. Data egress controls per classification level (OPS)
5. Adversarial input detection (prompt injection and data poisoning) (OPS)
6. Bias and disparate impact monitoring on consequential decisions (OPS)
7. AI decision log retention per NARA requirements (OPS)
8. Contractor data isolation from DoD data planes (ACQ)

L3 - Application (9):
1. TEVV plan execution per DoDI 5000.89 (TEVV)
2. AI impact assessment before operational deployment (TEVV)
3. Human oversight gate for use-of-force-adjacent decisions (OVR)
4. Operator interface override capability (OVR)
5. Remedy and appeal mechanism for adverse administrative decisions (OVR)
6. Agentic task boundary enforcement (OPS)
7. Prompt injection detection at application layer (OPS)
8. Shared service inheritance chain documentation (ACQ)
9. Plain-language output explanation for operators (OPS)

L4 - Platform (10):
1. DISA PA at required IL before deployment (ACQ)
2. STIG baseline configuration enforcement (ACQ)
3. IL-appropriate cloud region enforcement (ACQ)
4. CUI and classified data encryption to NSA-approved standards (OPS)
5. Audit log completeness per DISA requirements (OPS)
6. API gateway authentication and authorization (OPS)
7. CMMC Level 2 assessment for contractor-owned CUI platforms (ACQ)
8. CMMC Level 3 assessment for higher-value contractor platforms (ACQ)
9. Continuous vulnerability scanning via DISA ACAS (OPS)
10. Mission-critical AI availability SLA (OPS)

L5 - Model (8):
1. Model transparency card per DoDI 5000.90 and M-25-22 terms (ACQ)
2. Vendor drift disclosure SLA (OPS)
3. Model artifact signing and bill of AI materials (BoAIM) (ACQ)
4. Vulnerability disclosure SLA and patch cadence (OPS)
5. Model portability to avoid vendor lock-in (ACQ)
6. Re-validation trigger on model version change (OPS)
7. Personnel security clearance requirement for IL6 model infrastructure access (ACQ)
8. Supply chain risk assessment for AI components and foundation model providers (ACQ)

---

### 2. `/defense/how-to/index.html`

Audience: Program Managers, ISSOs, and Contracting Officers preparing an AI system for
operational deployment in a DoD component or contractor environment.

**Five steps (mirror public-sector/how-to/ structure):**

1. Determine the NSS boundary and select the IL. Document the determination memo.
2. Select the operating model and trace CC SRG inheritance from the DISA PA.
3. Map SRF personas to DoD roles (PM, ISSO, AO, CO, CDAO).
4. Set tier parameters by IL and operating model. Note IL6 classified-environment exceptions.
5. Assemble the evidence package: TEVV artifacts, impact assessment, ATO file, CMMC evidence
   folder, and CDAO incident reporting records.

Include a roles-to-personas mapping table and an IL-to-tier-parameter table. Reference the
controls JSON as the source of truth.

---

### 3. `/defense/controls/index.html`

Controls browser modeled on `/public-sector/controls/index.html`.

Filter dimensions:
- SRF layer (L1-L5)
- Lifecycle stage (ACQ / TEVV / OPS / OVR)
- Impact level (IL4 / IL5 / IL6)
- NSS tier (Non-NSS / NSS / Both)
- Responsibility split (dod-component / disa / contractor / csp / shared)
- Operating model (AI-SaaS / AI-PaaS / Agent-Ops / Program-Embedded)
- DoD RAI principle (Responsible / Equitable / Traceable / Reliable / Governable)
- Accountable persona

Fetch `/data/defense-controls.json` at runtime. Escape all interpolated fields with `escHtml`.
Keyboard operability required (Enter/Space on expandable cards, `aria-expanded`).
Hide TBD and N/A values from the rendered mapping list.
Show `nss_applicability` and `il_applicability` badges on each card.

---

### 4. CMMC/TEVV workpaper (xlsx)

Generate programmatically from `data/defense-controls.json` using the xlsx skill.
Four sheets:
- **Instructions**: how to use, IL and NSS scope selection
- **Tier Parameters**: IL4 / IL5 / IL6 columns, one row per `TIER_*` param
- **Persona Mapping**: SRF persona to DoD role to office (PM, ISSO, AO, CO, CDAO)
- **CMMC Evidence Log**: one row per control with cmmc_practices, threshold metric,
  evidence document or OCSF class, status (blank for operator completion)

File: `defense-cmmc-tevv-workpaper.xlsx`. Generate from JSON; do not hand-code.

---

## Build sequence

1. Generate `data/defense-controls.json` first. Verify with `jq '.controls | length'` (must be 45).
   Run `grep -c "—"` on the JSON (must be 0).
2. Build `/defense/how-to/index.html` using the JSON as source. No counts in prose; pull from JSON.
3. Build `/defense/controls/index.html`. Test filter interactions manually against the JSON.
4. Generate the xlsx workpaper from the JSON.
5. Verify all page counts match `jq '.controls | length'` before committing.

---

## Sources (verify before citing)

- DoD RAI Strategy and Implementation Pathway (June 2022):
  https://www.ai.mil/docs/RAI_Strategy.pdf
- DoDI 5000.90 (AI Acquisition, December 2020):
  https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/500090p.pdf
- DoDI 5000.89 (TEVV, November 2021):
  https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/500089p.pdf
- DoD Directive 3000.09 (Autonomous Weapon Systems, November 2023 update):
  https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/300009p.pdf
- DISA CC SRG (IL definitions, current version):
  https://public.cyber.mil/dccs/
- CMMC 2.0 Final Rule (32 CFR Part 170):
  https://www.federalregister.gov/documents/2024/10/15/2024-21449/cybersecurity-maturity-model-certification-cmmc-program
- NIST SP 800-171 Rev 3:
  https://csrc.nist.gov/pubs/sp/800/171/r3/final
- NIST SP 800-172 (Enhanced CUI):
  https://csrc.nist.gov/pubs/sp/800/172/final
- CNSSI 1253 (NSS security control baseline):
  https://www.cnss.gov/CNSS/issuances/Instructions.cfm
- Sibling schemas for structural reference:
  `data/public-sector-controls.json`, `data/finance-controls.json`
- Sibling handoff for lessons-learned lineage:
  `public-sector-vertical-handoff.md`
