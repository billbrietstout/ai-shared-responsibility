#!/usr/bin/env python3
"""
generate_opencre_binding.py

Deterministic generator for the OpenCRE binding of SRF canonical IDs.
Reads /data/layers.json, /data/matrix.json, /data/personas.json and emits:

  /export/opencre-srf.json   OpenCRE document objects (doctype Standard) for
                             every SRF layer, persona, operating model, and
                             accountability matrix relation, plus the proposed
                             CRE links (verified against opencre.org)
  /export/opencre-srf.csv    MyOpenCRE import CSV (see OWASP/OpenCRE
                             docs/my-opencre-user-guide.md for the format)

Every sectionID is an existing canonical ID from /ids.json. Matrix relations
compose existing IDs; they mint nothing new. Re-run after editing any /data
file and commit the regenerated output. Do not hand-edit the generated files.

Usage:
    python3 build/generate_opencre_binding.py            # write files
    python3 build/generate_opencre_binding.py --check    # build only, no write
"""

import csv
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SITE = "https://aisharedresponsibility.com"
# Fixed literal for reproducible output; bump when publishing an update.
UPDATED = "2026-07-12"
SRF_VERSION = "1.0"

STANDARD_NAME = "CoSAI AI Shared Responsibility Framework"

OPMODEL_SLUG = {
    "AI-SaaS": "ai-saas",
    "AI-PaaS": "ai-paas",
    "Agent-PaaS": "agent-paas",
    "IaaS": "iaas",
}

# CRE anchors verified 2026-07-12 against https://opencre.org/rest/v1/root_cres.
# Names are reproduced verbatim from the OpenCRE data, including the spelling
# of 803-457 as published. All three sit one level below a root CRE, so they
# occupy the "CRE 1" column in the MyOpenCRE CSV.
CRE_ANCHORS = {
    "803-457": {
        "name": "Protection against AI-Specfic Threats",
        "parent": {"id": "546-564", "name": "Cross-cutting concerns"},
        "depth": 1,
    },
    "225-553": {
        "name": "Organizational AI security controls",
        "parent": {"id": "567-755", "name": "Governance processes for security"},
        "depth": 1,
    },
    "663-200": {
        "name": "Technical AI security controls",
        "parent": {"id": "636-660", "name": "Technical application security controls"},
        "depth": 1,
    },
}

# Which SRF sections belong under which verified CRE anchor. Sections not
# listed here are exported without a CRE assignment; matching them to CREs is
# a working-session decision with the OpenCRE maintainers, not something to
# guess in a generator.
CRE_ASSIGNMENT = {
    "225-553": [
        "srf.framework.cosai-srf",
        "srf.layer.L1",
        "srf.role.ai-system-governance",
        "srf.role.ai-system-users",
    ],
    "663-200": [
        "srf.layer.L2",
        "srf.layer.L3",
        "srf.layer.L4",
        "srf.layer.L5",
        "srf.role.application-developer",
        "srf.role.data-provider",
        "srf.role.model-provider",
        "srf.role.ai-model-serving",
        "srf.role.ai-platform-provider",
        "srf.role.agentic-platform-provider",
    ],
    "803-457": [
        "srf.opmodel.ai-saas",
        "srf.opmodel.ai-paas",
        "srf.opmodel.agent-paas",
        "srf.opmodel.iaas",
    ],
}


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as fh:
        return json.load(fh)


def write_text(relpath, text):
    path = os.path.join(ROOT, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)
    return path


def write_json(relpath, obj):
    path = os.path.join(ROOT, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return path


def build_documents(layers, matrix, personas):
    docs = []

    def doc(section, section_id, hyperlink, description, tags):
        docs.append({
            "doctype": "Standard",
            "name": STANDARD_NAME,
            "section": section,
            "sectionID": section_id,
            "hyperlink": hyperlink,
            "description": description,
            "tags": tags,
        })

    doc("CoSAI AI Shared Responsibility Framework",
        "srf.framework.cosai-srf",
        f"{SITE}/framework/",
        "Accountability framework for AI systems: five layers, four operating "
        "models, and named personas. For any AI security activity it answers "
        "who must authorize it, who owns each result, and who signs the "
        "residual risk.",
        ["subtype:framework", "source:cosai-srf"])

    for L in layers["layers"]:
        doc(f'{L["id"]} {L["name"]}',
            f'srf.layer.{L["id"]}',
            f'{SITE}/framework/#{L["id"]}',
            L["description"],
            ["subtype:layer", "source:cosai-srf"])

    # Only the cosai-core models are offered to OpenCRE. This binding proposes
    # CoSAI's published framework, so a proposed-extension model defined on this
    # site does not belong in it under a source:cosai-srf tag. Take the extension
    # upstream to CoSAI first if it is to be mapped.
    for m in matrix["models"]:
        if m.get("provenance", "cosai-core") != "cosai-core":
            continue
        doc(m["name"],
            f'srf.opmodel.{OPMODEL_SLUG[m["id"]]}',
            f'{SITE}/operating-models/#{m["id"]}',
            m["description"],
            ["subtype:operating-model", "source:cosai-srf"])

    for p in personas["personas"]:
        doc(p["name"],
            f'srf.role.{p["id"]}',
            f'{SITE}/personas/#{p["id"]}',
            p["description"],
            ["subtype:persona", "source:cosai-srf"])

    # Accountability matrix relations. sectionID composes existing canonical
    # IDs with the assigns_responsibility relation already used in
    # /ontology/edges.json; nothing new is minted.
    layer_names = {L["id"]: L["name"] for L in layers["layers"]}
    model_names = {m["id"]: m["name"] for m in matrix["models"]}
    for lcode in sorted(matrix["cells"]):
        for mcode in ["AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS"]:
            cell = matrix["cells"][lcode][mcode]
            opm = f"srf.opmodel.{OPMODEL_SLUG[mcode]}"
            lay = f"srf.layer.{lcode}"
            desc = (f'Responsibility for {lcode} {layer_names[lcode]} under '
                    f'{model_names[mcode]}: customer "{cell["customer"]}", '
                    f'provider "{cell["provider"]}".')
            doc(f'{model_names[mcode]} responsibility for {lcode} {layer_names[lcode]}',
                f'{opm}/assigns_responsibility/{lay}',
                f'{SITE}/operating-models/#{mcode}',
                desc,
                ["subtype:matrix-relation", "source:cosai-srf"])

    return docs


def build_proposed_links(docs):
    by_id = {d["sectionID"]: d for d in docs}
    links = []
    for cre_id, section_ids in CRE_ASSIGNMENT.items():
        anchor = CRE_ANCHORS[cre_id]
        missing = [s for s in section_ids if s not in by_id]
        if missing:
            raise SystemExit(f"CRE assignment references unknown sections: {missing}")
        links.append({
            "cre_id": cre_id,
            "cre_name": anchor["name"],
            "cre_parent": anchor["parent"],
            "ltype": "Linked To",
            "status": "proposed",
            "sections": section_ids,
        })
    return links


def build_csv(docs, links):
    # MyOpenCRE CSV: CRE 0..CRE 5 columns, then name / id / hyperlink columns
    # for the standard. Rows with a CRE assignment place "cre-id|CRE Name" at
    # the CRE's depth. Sections without an assignment follow with the CRE
    # columns empty; they import as resources pending CRE mapping.
    header = ["CRE 0", "CRE 1", "CRE 2", "CRE 3", "CRE 4", "CRE 5",
              f"{STANDARD_NAME}|name", f"{STANDARD_NAME}|id",
              f"{STANDARD_NAME}|hyperlink"]
    assigned = {}
    for link in links:
        for sid in link["sections"]:
            assigned[sid] = link
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    for d in docs:
        row = ["", "", "", "", "", "",
               d["section"], d["sectionID"], d["hyperlink"]]
        link = assigned.get(d["sectionID"])
        if link:
            depth = CRE_ANCHORS[link["cre_id"]]["depth"]
            row[depth] = f'{link["cre_id"]}|{link["cre_name"]}'
        w.writerow(row)
    return buf.getvalue()


def main():
    check = "--check" in sys.argv

    layers = load("layers.json")
    matrix = load("matrix.json")
    personas = load("personas.json")

    docs = build_documents(layers, matrix, personas)
    links = build_proposed_links(docs)

    out = {
        "$schema_version": "0.1",
        "name": "CoSAI AI Shared Responsibility Framework, OpenCRE resource binding",
        "description": "OpenCRE-conformant resource set for the SRF's canonical "
                       "accountability constructs: layers, personas, operating "
                       "models, and the accountability matrix relations. Each "
                       "document follows the OpenCRE Standard document shape "
                       "(name, section, sectionID, hyperlink). Purpose: let the "
                       "MOSAIC shared taxonomy link any threat or control node "
                       "to an accountable persona. The SRF defines no threats, "
                       "controls, methodology, or severity; it supplies the "
                       "accountability axis only.",
        "srf_version": SRF_VERSION,
        "updated": UPDATED,
        "standard_name": STANDARD_NAME,
        "id_registry": f"{SITE}/ids.json",
        "generator": "build/generate_opencre_binding.py",
        "conventions": {
            "sectionID": "Canonical ID from /ids.json. Matrix relation IDs "
                         "compose two canonical IDs with the "
                         "assigns_responsibility relation from "
                         "/ontology/edges.json.",
            "proposed_cre_links": "CRE IDs and names verified against "
                                  "https://opencre.org/rest/v1/root_cres on "
                                  "2026-07-12, reproduced verbatim. Links are "
                                  "proposals for review with the OpenCRE "
                                  "maintainers, not published mappings. "
                                  "Sections without an assignment await a "
                                  "working session; none carry guessed CREs.",
        },
        "counts": {
            "documents": len(docs),
            "proposed_cre_links": len(links),
        },
        "documents": docs,
        "proposed_cre_links": links,
    }

    csv_text = build_csv(docs, links)

    summary = {"documents": len(docs), "proposed_cre_links": len(links),
               "csv_rows": csv_text.count("\n") - 1}
    if check:
        print("CHECK OK:", json.dumps(summary))
        return

    written = [
        write_json("export/opencre-srf.json", out),
        write_text("export/opencre-srf.csv", csv_text),
    ]
    print(f"Wrote {len(written)} files.")
    print("Summary:", json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
