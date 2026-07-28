#!/usr/bin/env python3
"""Generate OSCAL vertical catalog and profiles from data/*-controls.json.

Implements the plan in oscal-vertical-mapping-plan.md:

  - One expanded OSCAL 1.2.2 catalog holding all industry vertical controls,
    grouped by SRF layer (L1-L5) with one subgroup per vertical. Control IDs
    are namespaced ({vertical-short}-{srf-id-lowercased}) because SRF control
    IDs repeat across verticals; the original ID is kept in prop "srf-id".
  - One OSCAL profile per vertical that imports the catalog, selects that
    vertical's controls, and binds every threshold parameter value.
  - Back-matter resources for every regulatory framework cited by a verified
    mapping. TBD and N/A mappings are never turned into links: they are kept
    verbatim as props (mapping_status_note discipline; no invented IDs).

EU AI Act citations are parsed with the canonical grammar documented in each
vertical file's eu_ai_act_citation_format header: citations split on '; ',
each entry led by an 'Article N' (sub-provisions allowed) or 'Annex X' token
with an optional parenthetical gloss. Entries containing 'TBD' or equal to
'N/A' pass through unresolved as props.

The JSON under data/ stays the source of truth; OSCAL output is a generated
view. Do not hand-edit the emitted files.

Usage: python3 build/generate_oscal_verticals.py [--root PATH]
Writes export/srf-oscal-verticals-catalog.json and
export/srf-{vertical}.profile.json.
"""

import argparse
import copy
import datetime
import json
import pathlib
import re
import sys
import uuid

NS = "https://aisharedresponsibility.com/ns/oscal"
SITE = "https://aisharedresponsibility.com"
OSCAL_VERSION = "1.2.2"
DOC_VERSION = "0.1.0"
CATALOG_FILE = "srf-oscal-verticals-catalog.json"
CATALOG_URL = f"{SITE}/export/{CATALOG_FILE}"
UUID_SEED = uuid.NAMESPACE_URL

DISCLAIMER = (
    "Industry vertical schemas are independently proposed extensions and are "
    "not part of the official CoSAI release. Mapping IDs marked TBD are "
    "unverified and are carried verbatim as props, never as links; do not "
    "substitute invented IDs. Generated from data/*-controls.json."
)

# Core fields consumed explicitly; everything else on a control becomes
# generic props (scalars, lists) or guidance prose (notes, complex values).
CORE_FIELDS = {
    "id", "layer", "component", "title", "description",
    "accountable_persona", "operating_models", "mappings", "threshold",
}

VERTICALS = [
    # slug, short, title, per-vertical stage field
    ("finance", "fin", "Finance", "mrm_stage"),
    ("public-sector", "pubsec", "Public Sector", "public_sector_stage"),
    ("healthcare", "hc", "Healthcare", "clinical_stage"),
    ("insurance", "ins", "Insurance", "insurance_stage"),
    ("defense", "def", "Defense", "lifecycle_stage"),
    ("manufacturing", "mfg", "Manufacturing", "lifecycle_stage"),
]

# Canonical reference URL and title per mapping key. Used for back-matter
# resources. A resource is only emitted when at least one verified (non-TBD,
# non-N/A) mapping cites it, except in profiles, where every framework the
# vertical maps against is listed as a regulatory driver.
FRAMEWORKS = {
    "finos_aigf": ("FINOS AI Governance Framework",
                   "https://air-governance-framework.finos.org/"),
    "aicm": ("CSA AI Controls Matrix",
             "https://cloudsecurityalliance.org/artifacts/ai-controls-matrix"),
    "sr26_2": ("SR 26-2 — Revised Guidance on Model Risk Management",
               "https://www.federalreserve.gov/supervisionreg/srletters/SR2602.htm"),
    "eu_ai_act": ("EU Artificial Intelligence Act (Regulation (EU) 2024/1689)",
                  "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689"),
    "owasp_llm": ("OWASP Top 10 for Large Language Model Applications",
                  "https://owasp.org/www-project-top-10-for-large-language-model-applications/"),
    "m_25_21": ("OMB M-25-21 — Accelerating Federal Use of AI",
                "https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf"),
    "m_25_22": ("OMB M-25-22 — Driving Efficient Acquisition of AI in Government",
                "https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf"),
    "fedramp_20x_ksi": ("FedRAMP 20x Key Security Indicators (Consolidated Rules for 2026)",
                        "https://www.fedramp.gov/2026/"),
    "nist_ai_rmf": ("NIST AI Risk Management Framework",
                    "https://www.nist.gov/itl/ai-risk-management-framework"),
    "cosais": ("NIST COSAiS — Control Overlays for Securing AI Systems (NISTIR 8605 series)",
               "https://csrc.nist.gov/projects/cosais"),
    "dod_rai_strategy": ("DoD Responsible AI Strategy and Implementation Pathway",
                         "https://media.defense.gov/2022/Jun/22/2003022604/-1/-1/0/Department-of-Defense-Responsible-Artificial-Intelligence-Strategy-and-Implementation-Pathway.PDF"),
    "dodi_5000_90": ("DoDI 5000.90 — Cybersecurity for Acquisition Decision Authorities",
                     "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/500090p.pdf"),
    "dodi_5000_89": ("DoDI 5000.89 — Test and Evaluation",
                     "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/500089p.pdf"),
    "cmmc_2_0": ("Cybersecurity Maturity Model Certification (CMMC) 2.0",
                 "https://dodcio.defense.gov/cmmc/"),
    "nist_800_171": ("NIST SP 800-171 — Protecting Controlled Unclassified Information",
                     "https://csrc.nist.gov/pubs/sp/800/171/r3/final"),
    "cc_srg": ("DoD Cloud Computing SRGs (Mission Owner SRG and CSP SRG V1R2, January 2025)",
               "https://public.cyber.mil/dccs/"),
    "fda_tplc": ("FDA Total Product Lifecycle for AI/ML-Based SaMD",
                 "https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-and-machine-learning-software-medical-device"),
    "fda_pccp": ("FDA Predetermined Change Control Plan Guidance",
                 "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence-enabled-device-software-functions"),
    "onc_hti1": ("ONC HTI-1 Final Rule (45 CFR 170.315)",
                 "https://www.healthit.gov/topic/laws-regulation-and-policy/health-data-technology-and-interoperability"),
    "hipaa": ("HIPAA (Health Insurance Portability and Accountability Act)",
              "https://www.hhs.gov/hipaa/index.html"),
    "iec_62304": ("IEC 62304 — Medical Device Software Lifecycle Processes",
                  "https://webstore.iec.ch/publication/22794"),
    "iso_14971": ("ISO 14971 — Application of Risk Management to Medical Devices",
                  "https://www.iso.org/standard/72704.html"),
    "naic_model_bulletin": ("NAIC Model Bulletin on the Use of AI Systems by Insurers",
                            "https://content.naic.org/sites/default/files/inline-files/2023-12-4%20Model%20Bulletin_Adopted_0.pdf"),
    "naic_eval_tool": ("NAIC AI Systems Evaluation Tool 4.0 (DRAFT, pilot pre-adoption)",
                       "https://content.naic.org/sites/default/files/inline-files/AI%20Systems%20Evaluation%20Tool%204.0%20(Clean).pdf"),
    "co_reg_10_1_1": ("Colorado 3 CCR 702-10, Regulation 10-1-1 (Insurance AI Governance)",
                      "https://doi.colorado.gov/announcements/notice-of-adoption-amended-regulation-10-1-1-governance-and-risk-management-framework"),
    "nydfs_cl7": ("NYDFS Insurance Circular Letter No. 7 (2024)",
                  "https://www.dfs.ny.gov/industry-guidance/circular-letters/cl2024-07"),
    "eu_machinery_reg": ("EU Machinery Regulation (Regulation (EU) 2023/1230)",
                         "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1230"),
    "iec_62443": ("ISA/IEC 62443 — Industrial Automation and Control Systems Security",
                  "https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards"),
    "iso_42001": ("ISO/IEC 42001 — AI Management Systems",
                  "https://www.iso.org/standard/81230.html"),
    "iec_61508": ("IEC 61508 — Functional Safety",
                  "https://www.iec.ch/functional-safety"),
    "nist_cyber_ai": ("NIST Cyber AI Profile (in development)",
                      "https://www.nist.gov/cyberframework"),
}

EU_CITATION_RE = re.compile(
    r"^(Article\s+\d+(?:\(\w+\))*|Annex\s+[IVXLC]+)\s*(\(.*\))?$"
)


def kebab(s):
    return s.replace("_", "-")


def det_uuid(*parts):
    return str(uuid.uuid5(UUID_SEED, "|".join([SITE, DOC_VERSION] + list(parts))))


def prop(name, value, **kw):
    p = {"name": name, "ns": NS, "value": str(value)}
    p.update(kw)
    return p


def is_unresolved(value):
    """TBD anywhere in the string, or an explicit N/A, blocks link creation."""
    if not isinstance(value, str):
        return True
    v = value.strip()
    return v == "" or v == "N/A" or "TBD" in v


def parse_eu_ai_act(value):
    """Split a verified EU AI Act citation string with the canonical grammar.

    Returns (citations, ok). citations is a list of citation strings; ok is
    False when any entry fails the grammar, in which case the caller must
    fall back to an unresolved prop rather than invent a link target.
    """
    citations = []
    for part in value.split("; "):
        part = part.strip()
        if not EU_CITATION_RE.match(part):
            return [], False
        citations.append(part)
    return citations, True


class ResourceRegistry:
    """Lazily-built back-matter resources, one per framework key."""

    def __init__(self):
        self.used = {}

    def ref(self, key):
        if key not in FRAMEWORKS:
            return None
        if key not in self.used:
            title, url = FRAMEWORKS[key]
            self.used[key] = {
                "uuid": det_uuid("resource", key),
                "title": title,
                "props": [prop("framework-key", key)],
                "rlinks": [{"href": url}],
            }
        return self.used[key]["uuid"]

    def resources(self, keys=None):
        if keys is None:
            items = self.used.values()
        else:
            items = [self.used[k] for k in keys if k in self.used]
        return sorted(items, key=lambda r: r["title"])


def convert_control(ctl, vshort, vslug, stage_field, registry):
    cid = f"{vshort}-{ctl['id'].lower()}"
    props = [
        prop("srf-id", ctl["id"]),
        prop("vertical", vslug),
        prop("layer", ctl["layer"]),
        prop("component", ctl["component"]),
        prop("accountable-persona", ctl["accountable_persona"]),
    ]
    for om in ctl.get("operating_models", []):
        props.append(prop("operating-model", om))

    guidance_bits = []

    # Extra vertical-specific fields become generic props or guidance prose.
    for key in ctl:
        if key in CORE_FIELDS or key == stage_field:
            continue
        val = ctl[key]
        if isinstance(val, (str, int, float, bool)):
            if key.endswith(("_note", "_constraint")) and isinstance(val, str):
                guidance_bits.append(f"{kebab(key)}: {val}")
            else:
                props.append(prop(kebab(key), val))
        elif isinstance(val, list) and all(isinstance(x, (str, int, float)) for x in val):
            for x in val:
                props.append(prop(kebab(key), x))
        elif val not in (None, [], {}):
            guidance_bits.append(f"{kebab(key)}: {json.dumps(val)}")
    if stage_field in ctl:
        props.append(prop(kebab(stage_field), ctl[stage_field]))

    # Threshold -> param + objective part + props.
    th = ctl["threshold"]
    pid = f"{cid}-p1"
    param = {
        "id": pid,
        "label": th["metric"],
        "props": [prop("operator", th["operator"]), prop("window", th["window"])],
        "values": [str(th["param"])],
    }
    if th.get("param_type"):
        param["props"].append(prop("param-type", th["param_type"]))
    if th.get("description"):
        param["guidelines"] = [{"prose": th["description"]}]
    props.append(prop("breach-action", th["breach_action"]))

    ev = th.get("evidence", {})
    ev_prefix = "fhir" if "fhir_resource" in ev else "ocsf"
    for ekey, eval_ in ev.items():
        if isinstance(eval_, (str, int, float)):
            name = f"{ev_prefix}-attribute" if ekey == "attribute" else kebab(ekey)
            props.append(prop(name, eval_))

    # Mappings -> links to back-matter for verified values, props for TBD/N-A.
    links = []
    for mkey, mval in ctl.get("mappings", {}).items():
        if mkey == "mapping_status_note":
            if isinstance(mval, str):
                guidance_bits.append(f"mapping-status-note: {mval}")
            continue
        if is_unresolved(mval):
            props.append(prop(f"mapping-{kebab(mkey)}", mval,
                              **{"class": "unresolved"}))
            continue
        if mkey == "eu_ai_act":
            citations, ok = parse_eu_ai_act(mval)
            if not ok:
                props.append(prop(f"mapping-{kebab(mkey)}", mval,
                                  **{"class": "unresolved"}))
                continue
            rid = registry.ref(mkey)
            for c in citations:
                links.append({"href": f"#{rid}", "rel": "reference", "text": c})
            continue
        rid = registry.ref(mkey)
        if rid:
            # finos_aigf and sr26_2 follow the same '; '-separated citation
            # convention as eu_ai_act (documented in the vertical file's
            # *_citation_format headers); one link per citation.
            cites = ([x.strip() for x in mval.split("; ")]
                     if mkey in ("finos_aigf", "sr26_2", "aicm", "m_25_21",
                                 "m_25_22", "fedramp_20x_ksi",
                                 "naic_model_bulletin", "naic_eval_tool",
                                 "co_reg_10_1_1", "nydfs_cl7", "owasp_llm",
                                 "dod_rai_strategy", "dodi_5000_90",
                                 "dodi_5000_89", "cc_srg", "cmmc_2_0")
                     else [str(mval)])
            for cite in cites:
                links.append({"href": f"#{rid}", "rel": "reference", "text": cite})
        else:
            props.append(prop(f"mapping-{kebab(mkey)}", mval))

    parts = [
        {
            "id": f"{cid}_stmt",
            "name": "statement",
            "prose": ctl["description"],
        },
        {
            "id": f"{cid}_obj",
            "name": "objective",
            "prose": (
                f"Maintain {th['metric']} {th['operator']} "
                f"{{{{ insert: param, {pid} }}}} over window {th['window']}. "
                f"Breach action: {th['breach_action']}."
            ),
        },
    ]
    if guidance_bits:
        parts.append({
            "id": f"{cid}_gdn",
            "name": "guidance",
            "prose": " ".join(guidance_bits),
        })

    control = {
        "id": cid,
        "class": "srf-vertical-control",
        "title": ctl["title"],
        "params": [param],
        "props": props,
        "parts": parts,
    }
    if links:
        control["links"] = links
    return control


def build_catalog(root, now):
    registry = ResourceRegistry()
    layers = {}
    layer_meta = json.load(open(root / "data/layers.json"))
    layer_list = layer_meta["layers"] if isinstance(layer_meta, dict) else layer_meta
    layer_titles = {l["id"]: l.get("name") or l.get("title") for l in layer_list}

    vertical_docs = {}
    control_index = {}  # vslug -> [(catalog control id, param id, values)]

    for vslug, vshort, vtitle, stage_field in VERTICALS:
        data = json.load(open(root / f"data/{vslug}-controls.json"))
        vertical_docs[vslug] = data
        control_index[vslug] = []
        for ctl in data["controls"]:
            oscal_ctl = convert_control(ctl, vshort, vslug, stage_field, registry)
            layer = ctl["layer"].lower()
            layers.setdefault(layer, {}).setdefault(vslug, []).append(oscal_ctl)
            control_index[vslug].append(
                (oscal_ctl["id"], oscal_ctl["params"][0]["id"],
                 oscal_ctl["params"][0]["values"])
            )

    groups = []
    for lid in sorted(layers):
        subgroups = []
        for vslug, vshort, vtitle, _ in VERTICALS:
            if vslug in layers[lid]:
                subgroups.append({
                    "id": f"{lid}-{vslug}",
                    "class": "srf-vertical",
                    "title": f"{lid.upper()} — {vtitle}",
                    "props": [prop("vertical", vslug)],
                    "links": [{
                        "href": f"{SITE}/data/{vslug}-controls.json",
                        "rel": "source",
                    }],
                    "controls": layers[lid][vslug],
                })
        groups.append({
            "id": lid,
            "class": "srf-layer",
            "title": f"{lid.upper()}: {layer_titles.get(lid.upper(), lid.upper())}",
            "groups": subgroups,
        })

    n_controls = sum(len(v) for l in layers.values() for v in l.values())
    catalog = {
        "catalog": {
            "uuid": det_uuid("catalog", CATALOG_FILE),
            "metadata": {
                "title": ("CoSAI AI Shared Responsibility Framework — "
                          "Industry Vertical Controls (Proposed Extension)"),
                "last-modified": now,
                "version": DOC_VERSION,
                "oscal-version": OSCAL_VERSION,
                "props": [
                    prop("keywords", ("AI, shared responsibility, CoSAI, SRF, "
                                      "OSCAL, industry verticals")),
                    prop("control-count", n_controls),
                ] + [prop("source", f"{SITE}/data/{v}-controls.json")
                     for v, _, _, _ in VERTICALS],
                "links": [
                    {"href": f"{SITE}/", "rel": "canonical"},
                    {"href": f"{SITE}/framework/", "rel": "reference",
                     "text": "SRF framework reference"},
                    {"href": f"{SITE}/export/srf-oscal-catalog.json",
                     "rel": "related",
                     "text": "SRF accountability matrix overlay catalog"},
                ],
                "remarks": (
                    "Each control operationalizes one SRF vertical control: "
                    "accountability assignment, measured threshold objective "
                    "(as an OSCAL parameter), regulatory mappings, and "
                    "evidence pointers. Groups are SRF layers (L1-L5) with "
                    "one subgroup per industry vertical. " + DISCLAIMER
                ),
            },
            "groups": groups,
            "back-matter": {"resources": registry.resources()},
        }
    }
    return catalog, vertical_docs, control_index, registry


def build_profile(vslug, vtitle, data, index, now):
    registry = ResourceRegistry()
    mapping_keys = set()
    for ctl in data["controls"]:
        mapping_keys.update(k for k in ctl.get("mappings", {})
                            if k != "mapping_status_note")
    driver_uuids = {}
    for k in sorted(mapping_keys):
        rid = registry.ref(k)
        if rid:
            driver_uuids[k] = rid

    with_ids = [cid for cid, _, _ in index]
    set_params = [{"param-id": pid, "values": values}
                  for _, pid, values in index]

    remarks = DISCLAIMER
    if data.get("regulatory_context"):
        remarks = data["regulatory_context"] + " " + DISCLAIMER

    profile = {
        "profile": {
            "uuid": det_uuid("profile", vslug),
            "metadata": {
                "title": (f"CoSAI AI SRF — {vtitle} Vertical Profile "
                          "(Proposed Extension)"),
                "last-modified": now,
                "version": DOC_VERSION,
                "oscal-version": OSCAL_VERSION,
                "props": [
                    prop("vertical", vslug),
                    prop("source", f"{SITE}/data/{vslug}-controls.json"),
                    prop("control-count", len(with_ids)),
                ] + [prop("regulatory-driver", k) for k in sorted(driver_uuids)],
                "links": [
                    {"href": f"{SITE}/{vslug}/", "rel": "canonical"},
                    {"href": f"{SITE}/{vslug}/controls/", "rel": "reference",
                     "text": f"{vtitle} controls page"},
                ] + [{"href": f"#{rid}", "rel": "reference",
                      "text": FRAMEWORKS[k][0]}
                     for k, rid in sorted(driver_uuids.items())],
                "remarks": remarks,
            },
            "imports": [{
                "href": CATALOG_URL,
                "include-controls": [{"with-ids": with_ids}],
            }],
            "merge": {"as-is": True},
            "modify": {"set-parameters": set_params},
            "back-matter": {"resources": registry.resources()},
        }
    }
    return profile


def write_stable(path, doc):
    """Write an OSCAL document, keeping the stored last-modified when nothing
    else changed.

    Every UUID here is derived with uuid5, so the only field that moves on a
    rerun is last-modified. Stamping it with wall-clock time unconditionally
    made each run rewrite all seven files and assert a modification that did not
    happen, which buries real changes in diff noise.
    """
    key = next(iter(doc))
    if path.exists():
        try:
            prev = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            prev = None
        if prev:
            fresh, stored = copy.deepcopy(doc), copy.deepcopy(prev)
            for candidate in (fresh, stored):
                candidate[next(iter(candidate))].get("metadata", {}) \
                    .pop("last-modified", None)
            if fresh == stored:
                keep = prev[next(iter(prev))]["metadata"].get("last-modified")
                if keep:
                    doc[key]["metadata"]["last-modified"] = keep
    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=None,
                    help="repo root (default: parent of this script's dir)")
    args = ap.parse_args()
    root = pathlib.Path(args.root) if args.root else \
        pathlib.Path(__file__).resolve().parent.parent
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")

    catalog, docs, index, _ = build_catalog(root, now)
    out = root / "export" / CATALOG_FILE
    write_stable(out, catalog)
    print(f"wrote {out.relative_to(root)} "
          f"({sum(len(v) for v in index.values())} controls)")

    for vslug, vshort, vtitle, _ in VERTICALS:
        profile = build_profile(vslug, vtitle, docs[vslug], index[vslug], now)
        pout = root / "export" / f"srf-{vslug}.profile.json"
        write_stable(pout, profile)
        print(f"wrote {pout.relative_to(root)} ({len(index[vslug])} controls)")


if __name__ == "__main__":
    sys.exit(main())
