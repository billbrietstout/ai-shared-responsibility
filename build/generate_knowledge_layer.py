#!/usr/bin/env python3
"""
generate_knowledge_layer.py

Single source-of-truth generator for the machine-readable knowledge layer of
aisharedresponsibility.com. Reads the canonical glossary page and the /data
JSON files, then emits:

  /glossary.json                 full glossary registry
  /api/glossary/index.json       registry index (served at /api/glossary/)
  /api/glossary/<anchor>.json    one self-contained file per term
  /ontology/nodes.json           concept graph nodes
  /ontology/edges.json           typed relationships
  /ids.json                      canonical ID registry + cross-reference
  /export/glossary.json          flattened definitions pack
  /export/ontology.json          flattened nodes + edges pack
  /export/framework.json         combined {concepts, relationships, definitions}

Everything is deterministic. Re-run after editing /glossary/index.html or any
/data file and commit the regenerated output. Do not hand-edit the generated
JSON; edit the source and regenerate.

Usage:
    python3 build/generate_knowledge_layer.py            # write files
    python3 build/generate_knowledge_layer.py --check    # parse only, no write
"""

import html
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SITE = "https://aisharedresponsibility.com"
TODAY = date.today().isoformat()
SRF_VERSION = "1.0"

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as fh:
        return json.load(fh)

def strip_tags(s):
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(re.sub(r"\s+", " ", s)).strip()

def write_json(relpath, obj):
    path = os.path.join(ROOT, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return path

# ─────────────────────────────────────────────────────────────────────────────
# Canonical ID scheme
# ─────────────────────────────────────────────────────────────────────────────

OPMODEL_SLUG = {
    "AI-SaaS": "ai-saas",
    "AI-PaaS": "ai-paas",
    "Agent-PaaS": "agent-paas",
    "IaaS": "iaas",
}

def layer_id(code):       return f"srf.layer.{code}"
def opmodel_id(code):     return f"srf.opmodel.{OPMODEL_SLUG[code]}"
def role_id(pid):         return f"srf.role.{pid}"
def concept_id(anchor):   return f"srf.concept.{anchor}"
def control_id(v, cid):   return f"srf.control.{v}.{cid}"
def ext_id(rid):          return f"ext.framework.{rid}"
FRAMEWORK_ID = "srf.framework.cosai-srf"

# Map a glossary anchor to its canonical node id so the registry never
# redefines a concept that already exists as a layer / role / operating model.
def anchor_to_canonical(anchor):
    if re.fullmatch(r"L[1-5]", anchor):
        return layer_id(anchor)
    if anchor in OPMODEL_SLUG:
        return opmodel_id(anchor)
    if anchor.startswith("persona-"):
        return role_id(anchor[len("persona-"):])
    return concept_id(anchor)

# ─────────────────────────────────────────────────────────────────────────────
# 1. Parse the canonical glossary page
# ─────────────────────────────────────────────────────────────────────────────

def parse_glossary():
    with open(os.path.join(ROOT, "glossary", "index.html"), encoding="utf-8") as fh:
        doc = fh.read()

    terms = []
    seen = set()
    # Tolerate extra attributes on the section tag (e.g. data-llm chunk markers
    # added by build/inject_chunk_markers.py). Match by id + the gloss-section
    # class regardless of attribute order or additions.
    section_re = re.compile(
        r'<section\b(?=[^>]*\bid="([^"]+)")(?=[^>]*\bclass="[^"]*gloss-section)[^>]*>(.*?)</section>',
        re.S)
    term_re = re.compile(
        r'<dt id="([^"]+)">(.*?)</dt>\s*<dd>(.*?)</dd>', re.S)

    for sec_id, body in section_re.findall(doc):
        h2 = re.search(r"<h2[^>]*>(.*?)</h2>", body, re.S)
        section = strip_tags(h2.group(1)) if h2 else sec_id
        for anchor, dt_inner, dd_inner in term_re.findall(body):
            if anchor in seen:
                raise SystemExit(f"Duplicate glossary anchor: {anchor}")
            seen.add(anchor)

            # name: dt inner minus the "#" anchor link and the badge spans
            name = re.sub(r'<a[^>]*class="gloss-anchor"[^>]*>.*?</a>', "", dt_inner, flags=re.S)
            name = re.sub(r"<span[^>]*>.*?</span>", "", name, flags=re.S)
            name = strip_tags(name)

            # layers from badge classes
            layers = sorted({f"L{n}" for n in re.findall(r"gloss-badge--l(\d)", dt_inner)})

            # crosslink target (primary page where the term is defined in full)
            cross = re.search(
                r'<p class="gloss-crosslink">.*?<a href="([^"]+)"', dd_inner, re.S)
            see_also = cross.group(1) if cross else None

            # definition: dd minus the crosslink paragraph
            definition = re.sub(
                r'<p class="gloss-crosslink">.*?</p>', "", dd_inner, flags=re.S)
            definition = strip_tags(definition)

            terms.append({
                "anchor": anchor,
                "canonical_id": anchor_to_canonical(anchor),
                "term": name,
                "section": section,
                "layers": layers,
                "definition": definition,
                "anchor_url": f"{SITE}/glossary/#{anchor}",
                "see_also": (SITE + see_also) if see_also and see_also.startswith("/") else see_also,
                "api_url": f"{SITE}/api/glossary/{anchor}.json",
            })
    if not terms:
        raise SystemExit("No glossary terms parsed; check glossary/index.html structure.")
    return terms

# ─────────────────────────────────────────────────────────────────────────────
# 2. Build registry + per-term API
# ─────────────────────────────────────────────────────────────────────────────

def build_glossary_outputs(terms):
    registry = {
        "$schema_version": "1.0",
        "name": "CoSAI AI Shared Responsibility Framework Glossary Registry",
        "description": "Canonical, deduplicated definitions for every SRF term. "
                       "Each term is independently retrievable at "
                       "/api/glossary/<anchor>.json and carries a canonical_id "
                       "that resolves to a single ontology node.",
        "srf_version": SRF_VERSION,
        "updated": TODAY,
        "canonical_page": f"{SITE}/glossary/",
        "api": {
            "index": f"{SITE}/api/glossary/index.json",
            "term_template": f"{SITE}/api/glossary/{{anchor}}.json",
        },
        "count": len(terms),
        "terms": terms,
    }

    index = {
        "$schema_version": "1.0",
        "description": "Index of all glossary terms. Fetch any single term at its api_url.",
        "updated": TODAY,
        "count": len(terms),
        "terms": [
            {
                "anchor": t["anchor"],
                "term": t["term"],
                "canonical_id": t["canonical_id"],
                "section": t["section"],
                "api_url": t["api_url"],
                "anchor_url": t["anchor_url"],
            }
            for t in terms
        ],
    }

    per_term = {}
    for t in terms:
        per_term[t["anchor"]] = {
            "$schema_version": "1.0",
            "anchor": t["anchor"],
            "canonical_id": t["canonical_id"],
            "term": t["term"],
            "section": t["section"],
            "layers": t["layers"],
            "definition": t["definition"],
            "anchor_url": t["anchor_url"],
            "see_also": t["see_also"],
            "ontology_node": f"{SITE}/ontology/nodes.json#{t['canonical_id']}",
            "srf_version": SRF_VERSION,
            "updated": TODAY,
        }
    return registry, index, per_term

# ─────────────────────────────────────────────────────────────────────────────
# 3. Build ontology graph
# ─────────────────────────────────────────────────────────────────────────────

def build_ontology(terms, layers, personas, matrix, regs, controls_by_vertical):
    nodes = {}   # id -> node
    edges = []
    related = {} # id -> set of neighbour ids

    def add_node(nid, label, ntype, url, subtype=None):
        if nid not in nodes:
            node = {"id": nid, "label": label, "type": ntype, "url": url, "related": []}
            if subtype:
                node["subtype"] = subtype
            nodes[nid] = node
            related[nid] = set()
        return nodes[nid]

    def add_edge(src, rel, dst, **props):
        e = {"source": src, "rel": rel, "target": dst}
        e.update(props)
        edges.append(e)
        if src in related and dst in related:
            related[src].add(dst)
            related[dst].add(src)

    # framework root
    add_node(FRAMEWORK_ID, "CoSAI AI Shared Responsibility Framework",
             "framework", f"{SITE}/framework/")

    # layers
    for L in layers["layers"]:
        nid = layer_id(L["id"])
        add_node(nid, f'{L["id"]} {L["name"]}', "concept",
                 f"{SITE}/framework/#{L['id']}", subtype="layer")
        add_edge(FRAMEWORK_ID, "contains_layer", nid)

    # operating models
    for m in matrix["models"]:
        nid = opmodel_id(m["id"])
        add_node(nid, m["name"], "concept",
                 f"{SITE}/operating-models/#{m['id']}", subtype="operating-model")
        add_edge(FRAMEWORK_ID, "has_operating_model", nid)

    # personas (roles)
    name_to_role = {}
    for p in personas["personas"]:
        nid = role_id(p["id"])
        add_node(nid, p["name"], "role", f"{SITE}/personas/#{p['id']}",
                 subtype="persona")
        name_to_role[p["name"]] = nid
        for code in p.get("srf_layers", []):
            add_edge(nid, "operates_at_layer", layer_id(code))

    # layer -> persona membership
    for L in layers["layers"]:
        for pname in L.get("personas", []):
            if pname in name_to_role:
                add_edge(layer_id(L["id"]), "has_persona", name_to_role[pname])

    # operating model -> layer responsibility (from layers.json summary values)
    for L in layers["layers"]:
        for code, value in L.get("operating_models", {}).items():
            add_edge(opmodel_id(code), "assigns_responsibility",
                     layer_id(L["id"]), value=value)

    # general concept nodes from glossary (only those that are not already
    # a layer / role / operating model)
    structural = set()
    for L in layers["layers"]:
        structural.add(layer_id(L["id"]))
    for m in matrix["models"]:
        structural.add(opmodel_id(m["id"]))
    for p in personas["personas"]:
        structural.add(role_id(p["id"]))

    for t in terms:
        cid = t["canonical_id"]
        if cid in structural:
            continue
        add_node(cid, t["term"], "concept",
                 f"{SITE}/glossary/#{t['anchor']}", subtype="vocabulary")
        add_edge(cid, "defined_in", FRAMEWORK_ID)

    # external frameworks / regulations mapped to layers
    for item in regs["items"]:
        nid = ext_id(item["id"])
        add_node(nid, item["name"], "framework", item.get("url", f"{SITE}/regulations/"))
        for code in item.get("srf_layers", []):
            add_edge(nid, "maps_to_layer", layer_id(code))

    # Some verticals (notably healthcare) assign accountability to a
    # sector-specific specialization of a canonical persona. Register those as
    # role nodes too so every accountable_to edge resolves.
    canonical_personas = {p["id"] for p in personas["personas"]}

    def ensure_role(pid, vertical):
        nid = role_id(pid)
        if nid not in nodes:
            label = pid.replace("-", " ").title()
            add_node(nid, label, "role",
                     f"{SITE}/{vertical}/controls/", subtype="persona")
            nodes[nid]["sector_specialization"] = True
            nodes[nid]["vertical"] = vertical
        return nid

    # controls
    for vertical, payload in controls_by_vertical.items():
        for c in payload["controls"]:
            nid = control_id(vertical, c["id"])
            add_node(nid, f'{c["id"]}: {c["title"]}', "control",
                     f"{SITE}/{vertical}/controls/#{c['id']}",
                     subtype=vertical)
            add_edge(nid, "applies_to_layer", layer_id(c["layer"]))
            persona = c.get("accountable_persona")
            if persona:
                if persona not in canonical_personas:
                    ensure_role(persona, vertical)
                add_edge(nid, "accountable_to", role_id(persona))
            # Controls may list canonical operating models and/or vertical-specific
            # deployment archetypes. Only the four canonical ones become edges; the
            # rest are kept as a node attribute so nothing is lost.
            extra = []
            for code in c.get("operating_models", []):
                if code in OPMODEL_SLUG:
                    add_edge(nid, "applies_in_operating_model", opmodel_id(code))
                else:
                    extra.append(code)
            if extra:
                nodes[nid]["deployment_models"] = extra

    # finalise related[] (cap to keep nodes readable)
    for nid, node in nodes.items():
        node["related"] = sorted(related[nid])

    nodes_out = {
        "$schema_version": "1.0",
        "description": "Concept graph nodes for the CoSAI SRF. Node types: "
                       "concept, framework, role, control. Edges are in "
                       "/ontology/edges.json.",
        "srf_version": SRF_VERSION,
        "updated": TODAY,
        "node_schema": {"id": "string", "label": "string",
                        "type": "concept|framework|role|control",
                        "url": "string", "related": "[id]",
                        "subtype": "string (optional)"},
        "count": len(nodes),
        "nodes": list(nodes.values()),
    }
    edges_out = {
        "$schema_version": "1.0",
        "description": "Typed, directed relationships between ontology nodes. "
                       "Every source and target is a node id in "
                       "/ontology/nodes.json.",
        "srf_version": SRF_VERSION,
        "updated": TODAY,
        "relations": sorted({e["rel"] for e in edges}),
        "count": len(edges),
        "edges": edges,
    }
    return nodes, edges, nodes_out, edges_out

# ─────────────────────────────────────────────────────────────────────────────
# 4. Canonical ID registry
# ─────────────────────────────────────────────────────────────────────────────

def build_ids(nodes, terms):
    entries = []
    for nid, node in nodes.items():
        entries.append({
            "id": nid,
            "name": node["label"],
            "type": node["type"],
            "subtype": node.get("subtype"),
            "url": node["url"],
        })
    entries.sort(key=lambda e: e["id"])

    # glossary anchor -> canonical id cross reference
    xref = [
        {"anchor": t["anchor"],
         "anchor_url": t["anchor_url"],
         "canonical_id": t["canonical_id"]}
        for t in terms
    ]
    return {
        "$schema_version": "1.0",
        "description": "Canonical ID registry. Every concept, layer, role, "
                       "operating model, and control has one stable id, a "
                       "human name, and a URL. IDs are namespaced: srf.layer.*, "
                       "srf.opmodel.*, srf.role.*, srf.concept.*, "
                       "srf.control.<vertical>.*, ext.framework.*.",
        "srf_version": SRF_VERSION,
        "updated": TODAY,
        "namespaces": {
            "srf.framework": "The framework itself",
            "srf.layer": "One of the five architecture layers L1-L5",
            "srf.opmodel": "One of the four operating models",
            "srf.role": "One of the SRF personas",
            "srf.concept": "A glossary vocabulary concept",
            "srf.control": "A vertical control, srf.control.<vertical>.<control-id>",
            "ext.framework": "An external standard or regulation",
        },
        "count": len(entries),
        "ids": entries,
        "glossary_xref": xref,
    }

# ─────────────────────────────────────────────────────────────────────────────
# 5. Exportable knowledge pack
# ─────────────────────────────────────────────────────────────────────────────

def build_exports(terms, nodes, edges, layers, personas, matrix):
    # export/glossary.json — definitions, flattened
    export_glossary = {
        "$schema_version": "1.0",
        "description": "Flattened glossary definitions for bulk agent ingestion.",
        "updated": TODAY,
        "definitions": [
            {
                "id": t["canonical_id"],
                "anchor": t["anchor"],
                "term": t["term"],
                "definition": t["definition"],
                "url": t["anchor_url"],
            }
            for t in terms
        ],
    }

    # export/ontology.json — nodes + edges, flattened
    export_ontology = {
        "$schema_version": "1.0",
        "description": "Flattened ontology: nodes and typed relationships.",
        "updated": TODAY,
        "nodes": list(nodes.values()),
        "edges": edges,
    }

    # export/framework.json — combined pack { concepts, relationships, definitions }
    concepts = [
        {"id": n["id"], "label": n["label"], "type": n["type"],
         "subtype": n.get("subtype"), "url": n["url"]}
        for n in nodes.values()
    ]
    relationships = [
        {"source": e["source"], "rel": e["rel"], "target": e["target"],
         **{k: v for k, v in e.items() if k not in ("source", "rel", "target")}}
        for e in edges
    ]
    definitions = export_glossary["definitions"]
    export_framework = {
        "$schema_version": "1.0",
        "name": "CoSAI AI Shared Responsibility Framework — Knowledge Pack",
        "description": "Single flattened, linked representation of the whole "
                       "framework for agent consumption: concepts, relationships, "
                       "and definitions. IDs resolve via /ids.json.",
        "srf_version": SRF_VERSION,
        "updated": TODAY,
        "counts": {
            "concepts": len(concepts),
            "relationships": len(relationships),
            "definitions": len(definitions),
        },
        "concepts": concepts,
        "relationships": relationships,
        "definitions": definitions,
    }
    return export_glossary, export_ontology, export_framework

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    check = "--check" in sys.argv

    terms = parse_glossary()
    layers = load("layers.json")
    personas = load("personas.json")
    matrix = load("matrix.json")
    regs = load("regulations.json")

    verticals = ["finance", "healthcare", "insurance",
                 "public-sector", "defense", "manufacturing"]
    controls_by_vertical = {v: load(f"{v}-controls.json") for v in verticals}

    registry, index, per_term = build_glossary_outputs(terms)
    nodes, edges, nodes_out, edges_out = build_ontology(
        terms, layers, personas, matrix, regs, controls_by_vertical)
    ids = build_ids(nodes, terms)
    exp_g, exp_o, exp_f = build_exports(
        terms, nodes, edges, layers, personas, matrix)

    summary = {
        "glossary_terms": len(terms),
        "ontology_nodes": len(nodes),
        "ontology_edges": len(edges),
        "canonical_ids": ids["count"],
        "controls": sum(len(p["controls"]) for p in controls_by_vertical.values()),
    }

    if check:
        print("CHECK OK:", json.dumps(summary))
        return

    written = []
    written.append(write_json("glossary.json", registry))
    written.append(write_json("api/glossary/index.json", index))
    for anchor, obj in per_term.items():
        written.append(write_json(f"api/glossary/{anchor}.json", obj))
    written.append(write_json("ontology/nodes.json", nodes_out))
    written.append(write_json("ontology/edges.json", edges_out))
    written.append(write_json("ids.json", ids))
    written.append(write_json("export/glossary.json", exp_g))
    written.append(write_json("export/ontology.json", exp_o))
    written.append(write_json("export/framework.json", exp_f))

    print(f"Wrote {len(written)} files.")
    print("Summary:", json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
