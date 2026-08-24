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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SITE = "https://aisharedresponsibility.com"
# Editorial "last updated" date stamped into every generated artifact.
# Keep this a FIXED literal, NOT date.today(): the CI "regeneration drift gate"
# regenerates these files and diffs them against what is committed, so the value
# must be reproducible from committed source rather than the wall clock (otherwise
# any push validated by CI on a later UTC day fails). Bump it when publishing an update.
UPDATED = "2026-07-28"
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
    "Federated-Consortium": "federated-consortium",
}

# The four cosai-core models resolve a layer to one responsibility value, so a
# single assigns_responsibility edge carries the whole cell. Federated-Consortium
# splits each layer into two governing domains with two accountable parties, so
# its accountability rides on accountable_for_domain edges instead. Keeping it
# out of assigns_responsibility avoids asserting a value that its cells do not
# have.
SPLIT_OPMODELS = {"Federated-Consortium"}

def layer_id(code):       return f"srf.layer.{code}"
def opmodel_id(code):     return f"srf.opmodel.{OPMODEL_SLUG[code]}"
def role_id(pid):         return f"srf.role.{pid}"
def concept_id(anchor):   return f"srf.concept.{anchor}"
def control_id(v, cid):   return f"srf.control.{v}.{cid}"
def ext_id(rid):          return f"ext.framework.{rid}"
def juris_id(jid):        return f"srf.jurisdiction.{jid}"
def moral_id(dim):        return f"srf.moral.{dim}"
def requirement_id(rid):  return f"ext.requirement.{rid}"
def vertical_id(vslug):   return f"srf.vertical.{vslug}"
FRAMEWORK_ID = "srf.framework.cosai-srf"

VERTICALS = [
    "finance", "healthcare", "insurance",
    "public-sector", "defense", "manufacturing",
]

# A control's mappings value is a citation string, or a placeholder meaning the
# mapping has not been established. Placeholders must never become an edge:
# an unresolved mapping is not evidence that the regulation governs the control.
_PLACEHOLDER = re.compile(r"^\s*(TBD|N/?A|None|-)\b", re.I)

def is_placeholder(value):
    return not isinstance(value, str) or not value.strip() or bool(_PLACEHOLDER.match(value))

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
        "updated": UPDATED,
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
        "updated": UPDATED,
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
            "updated": UPDATED,
        }
    return registry, index, per_term

# ─────────────────────────────────────────────────────────────────────────────
# 3. Build ontology graph
# ─────────────────────────────────────────────────────────────────────────────

def build_ontology(terms, layers, personas, matrix, regs, jurisdictions,
                   controls_by_vertical, moral=None, tapestry=None):
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

    # Sector specializations of the eight canonical personas (e.g. healthcare).
    # Declared in personas.json so every accountable_persona value resolves, and
    # so the graph carries an explicit specializes edge back to the parent.
    specialization_ids = set()
    for s in personas.get("sector_specializations", []):
        nid = role_id(s["id"])
        specialization_ids.add(s["id"])
        add_node(nid, s["name"], "role",
                 s.get("url", f"{SITE}/{s['vertical']}/controls/"),
                 subtype="persona")
        nodes[nid]["sector_specialization"] = True
        nodes[nid]["vertical"] = s["vertical"]
        parent = s.get("specializes")
        if parent:
            add_edge(nid, "specializes", role_id(parent))
        for code in s.get("srf_layers", []):
            add_edge(nid, "operates_at_layer", layer_id(code))

    # layer -> persona membership
    for L in layers["layers"]:
        for pname in L.get("personas", []):
            if pname in name_to_role:
                add_edge(layer_id(L["id"]), "has_persona", name_to_role[pname])

    # operating model -> layer responsibility (from layers.json summary values)
    for L in layers["layers"]:
        for code, value in L.get("operating_models", {}).items():
            if code not in OPMODEL_SLUG or code in SPLIT_OPMODELS:
                continue
            add_edge(opmodel_id(code), "assigns_responsibility",
                     layer_id(L["id"]), value=value)

    # Federated-Consortium: one edge per layer per governing domain, naming the
    # party accountable for that domain at that layer. A domain marked N/A has no
    # accountable party at that layer and gets no edge.
    DOMAIN_KEYS = {"shared_commons": "shared-commons",
                   "sovereign_assets": "sovereign-assets"}
    for L in layers["layers"]:
        split = L.get("federated_consortium_split")
        if not split:
            continue
        for field, domain in DOMAIN_KEYS.items():
            persona = split.get(field)
            if not persona or persona == "N/A":
                continue
            add_edge(layer_id(L["id"]), "accountable_for_domain",
                     role_id(persona), domain=domain,
                     operating_model="Federated-Consortium",
                     note=split.get("note", ""))

    # general concept nodes from glossary (only those that are not already
    # a layer / role / operating model)
    structural = set()
    for L in layers["layers"]:
        structural.add(layer_id(L["id"]))
    for m in matrix["models"]:
        structural.add(opmodel_id(m["id"]))
    for p in personas["personas"]:
        structural.add(role_id(p["id"]))
    for s in personas.get("sector_specializations", []):
        structural.add(role_id(s["id"]))

    for t in terms:
        cid = t["canonical_id"]
        if cid in structural:
            continue
        add_node(cid, t["term"], "concept",
                 f"{SITE}/glossary/#{t['anchor']}", subtype="vocabulary")
        add_edge(cid, "defined_in", FRAMEWORK_ID)

    # jurisdictions that issue the external instruments
    for j in jurisdictions["jurisdictions"]:
        nid = juris_id(j["id"])
        add_node(nid, j["name"], "concept", f"{SITE}/regulations/",
                 subtype="jurisdiction")
        nodes[nid]["level"] = j["level"]
    for j in jurisdictions["jurisdictions"]:
        if j.get("parent"):
            add_edge(juris_id(j["id"]), "subordinate_to", juris_id(j["parent"]))

    # Industry verticals (business lines that own control schemas). Must exist
    # before regulation applies_to_vertical edges are emitted.
    for vslug in VERTICALS:
        add_node(vertical_id(vslug), vslug.replace("-", " ").title(),
                 "concept", f"{SITE}/{vslug}/", subtype="vertical")
        add_edge(FRAMEWORK_ID, "has_vertical", vertical_id(vslug))

    # external frameworks / regulations mapped to layers and jurisdictions.
    # mapping_key is how a vertical control's mappings object names this
    # instrument; it is the join key for the governed_by edges below.
    key_to_ext = {}
    for item in regs["items"]:
        nid = ext_id(item["id"])
        add_node(nid, item["name"], "framework", item.get("url", f"{SITE}/regulations/"))
        if item.get("depth"):
            nodes[nid]["depth"] = item["depth"]
        if item.get("verification_status"):
            nodes[nid]["verification_status"] = item["verification_status"]
        # lifecycle is absent for an instrument in force and set to draft or
        # rescinded otherwise, so a consumer can tell a citation it should not
        # rely on from one it can.
        if item.get("lifecycle"):
            nodes[nid]["lifecycle"] = item["lifecycle"]
        for code in item.get("srf_layers", []):
            add_edge(nid, "maps_to_layer", layer_id(code))
        if item.get("superseded_by"):
            add_edge(nid, "superseded_by", ext_id(item["superseded_by"]))
        if item.get("jurisdiction"):
            add_edge(nid, "issued_in_jurisdiction", juris_id(item["jurisdiction"]))
        if item.get("mapping_key"):
            key_to_ext[item["mapping_key"]] = nid
        for vslug in item.get("applicable_verticals") or []:
            if vslug in VERTICALS:
                add_edge(nid, "applies_to_vertical", vertical_id(vslug),
                         source_of_truth=item.get("applicable_verticals_source",
                                                  "declared"))

    # Canonical data catalog resources referenced by page llm:concepts.
    # These are first-class machine-readable artifacts under /data/, not
    # glossary vocabulary; keep the srf.data.* namespace for them.
    data_catalog = [
        {
            "id": "srf.data.threats",
            "label": "Threat-to-accountability crosswalk",
            "url": f"{SITE}/data/threats.json",
            "srf_layers": ["L1", "L2", "L3", "L4", "L5"],
        },
        {
            "id": "srf.data.threat-sources",
            "label": "Threat source registry",
            "url": f"{SITE}/data/threat-sources.json",
            "srf_layers": ["L1", "L2", "L3", "L4", "L5"],
        },
        {
            "id": "srf.data.security-principles",
            "label": "Classic security principles catalog",
            "url": f"{SITE}/data/security-principles.json",
            "srf_layers": ["L1", "L2", "L3", "L4", "L5"],
        },
        {
            "id": "srf.data.ai-agentic-principles",
            "label": "AI and agentic security principles catalog",
            "url": f"{SITE}/data/ai-agentic-principles.json",
            "srf_layers": ["L1", "L2", "L3", "L4", "L5"],
        },
        {
            "id": "srf.data.jurisdictions",
            "label": "Jurisdiction vocabulary for regulations",
            "url": f"{SITE}/data/jurisdictions.json",
            "srf_layers": ["L1"],
        },
        {
            "id": "srf.data.moral-regulatory-hierarchy",
            "label": "Moral orientation tags for regulatory requirements",
            "url": f"{SITE}/data/moral-regulatory-hierarchy.json",
            "srf_layers": ["L1"],
        },
    ]
    for item in data_catalog:
        add_node(item["id"], item["label"], "concept", item["url"],
                 subtype="dataset")
        for code in item.get("srf_layers", []):
            add_edge(item["id"], "maps_to_layer", layer_id(code))

    # Moral orientation dimensions and tagged requirements. Requirements are
    # external duties (ext.requirement.*); dimensions are analytical tags
    # (srf.moral.*). Instrument rollups use max salience per dimension.
    req_matchers = []  # (compiled patterns, requirement node id)
    if moral:
        for dim, meta in moral.get("dimensions", {}).items():
            nid = moral_id(dim)
            add_node(nid, meta["name"], "concept",
                     f"{SITE}/developers/schema/#moral-orientation",
                     subtype="moral-dimension")
            nodes[nid]["focus"] = meta.get("focus")
            add_edge(nid, "defined_in", FRAMEWORK_ID)

        rollup = {}  # instrument_id -> {actor: max, action: max, outcome: max}
        for req in moral.get("requirements", []):
            rid = requirement_id(req["id"])
            instrument = req["instrument"]
            add_node(rid, f'{req["citation"]}: {req["title"]}', "concept",
                     req.get("url", f"{SITE}/regulations/"),
                     subtype="requirement")
            nodes[rid]["instrument"] = instrument
            nodes[rid]["citation"] = req["citation"]
            profile = req.get("moral_profile") or {}
            nodes[rid]["moral_profile"] = {
                "actor": profile.get("actor", 0),
                "action": profile.get("action", 0),
                "outcome": profile.get("outcome", 0),
            }
            if profile.get("rationale"):
                nodes[rid]["moral_rationale"] = profile["rationale"]

            add_edge(rid, "part_of", ext_id(instrument))
            for code in req.get("srf_layers", []):
                add_edge(rid, "maps_to_layer", layer_id(code))
            for dim in ("actor", "action", "outcome"):
                salience = int(profile.get(dim, 0) or 0)
                if salience > 0:
                    add_edge(rid, "emphasizes", moral_id(dim), salience=salience)

            bucket = rollup.setdefault(instrument,
                                       {"actor": 0, "action": 0, "outcome": 0})
            for dim in ("actor", "action", "outcome"):
                bucket[dim] = max(bucket[dim], int(profile.get(dim, 0) or 0))

            patterns = [
                re.compile(re.escape(p) + r"\b", re.I)
                for p in req.get("citation_match") or [req["citation"]]
            ]
            req_matchers.append((patterns, rid, ext_id(instrument)))

        for instrument, scores in rollup.items():
            nid = ext_id(instrument)
            if nid in nodes:
                nodes[nid]["moral_profile_rollup"] = scores
                nodes[nid]["moral_rollup_rule"] = "max-salience-per-dimension"

    # Safety net for accountable_persona values that are neither a canonical
    # persona nor a declared sector specialization. Prefer declaring them in
    # personas.json so the specializes edge is author-controlled.
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
            add_edge(nid, "belongs_to_vertical", vertical_id(vertical))
            add_edge(nid, "applies_to_layer", layer_id(c["layer"]))
            persona = c.get("accountable_persona")
            if persona:
                if persona not in canonical_personas and persona not in specialization_ids:
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
            # Cite each resolved regulation mapping as a governed_by edge.
            # The citation string rides as an edge property; placeholders skip.
            # When a citation names a tagged requirement, also link the
            # control to that requirement (implements). A requirement is only
            # eligible for the instrument this citation is filed under:
            # matching text across instruments produced false links, such as a
            # US ONC citation reading "Training data description" matching a
            # Chinese requirement whose pattern is "training data".
            linked_reqs = set()
            for mkey, citation in (c.get("mappings") or {}).items():
                if mkey == "mapping_status_note" or is_placeholder(citation):
                    continue
                target = key_to_ext.get(mkey)
                if target:
                    add_edge(nid, "governed_by", target, citation=citation)
                for patterns, req_nid, req_ext in req_matchers:
                    if target != req_ext or req_nid in linked_reqs:
                        continue
                    if any(p.search(citation) for p in patterns):
                        add_edge(nid, "implements", req_nid, citation=citation)
                        linked_reqs.add(req_nid)

    # Project Tapestry accountability controls. These are not an industry
    # vertical: they describe one deployment topology, the Federated-Consortium
    # operating model, so they carry no belongs_to_vertical edge. Their
    # regulatory citations point at project ADRs rather than legal instruments,
    # so they produce no governed_by edges either. What they do carry is the
    # domain assignment that makes the two-party split checkable.
    if tapestry:
        scope_id = concept_id("project-tapestry")
        add_node(scope_id, "Project Tapestry (federated consortium extension)",
                 "concept", f"{SITE}/tapestry/controls/",
                 subtype="extension-scope")
        add_edge(scope_id, "extends_operating_model",
                 opmodel_id("Federated-Consortium"))
        for c in tapestry["controls"]:
            nid = control_id("tapestry", c["id"])
            add_node(nid, f'{c["id"]}: {c["title"]}', "control",
                     f"{SITE}/tapestry/controls/#{c['id']}", subtype="tapestry")
            node = nodes[nid]
            node["accountability_domain"] = c["accountability_domain"]
            node["disclosure_tier"] = c["threshold"]["disclosure_tier"]
            node["property_class"] = c["property_class"]
            node["implementation_status"] = c["implementation_status"]
            add_edge(nid, "part_of_extension", scope_id)
            add_edge(nid, "applies_to_layer", layer_id(c["layer"]))
            add_edge(nid, "accountable_to", role_id(c["accountable_persona"]))
            for code in c.get("operating_models", []):
                if code in OPMODEL_SLUG:
                    add_edge(nid, "applies_in_operating_model", opmodel_id(code))
            # A control whose content is set by the node's own law points at the
            # instruments that would resolve it, per jurisdiction. The edge says
            # "this is where the obligation comes from for some participant",
            # not "this instrument governs every participant".
            jb = c.get("jurisdiction_binding") or {}
            for inst in jb.get("example_instruments", []):
                target = ext_id(inst)
                if target in nodes:
                    add_edge(nid, "resolves_against_instrument", target,
                             requirement_class=jb.get("requirement_class", ""),
                             resolves_per=jb.get("resolves_per", "node"))

    # finalise related[] (cap to keep nodes readable)
    for nid, node in nodes.items():
        node["related"] = sorted(related[nid])

    nodes_out = {
        "$schema_version": "1.0",
        "description": "Concept graph nodes for the CoSAI SRF. Node types: "
                       "concept, framework, role, control. Edges are in "
                       "/ontology/edges.json.",
        "srf_version": SRF_VERSION,
        "updated": UPDATED,
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
                       "/ontology/nodes.json. Prefer these edges over "
                       "re-deriving joins from parallel fields in /data/.",
        "srf_version": SRF_VERSION,
        "updated": UPDATED,
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
                       "operating model, jurisdiction, moral dimension, "
                       "requirement, and control has one stable id, a human "
                       "name, and a URL. IDs are namespaced: srf.layer.*, "
                       "srf.opmodel.*, srf.role.*, srf.concept.*, srf.data.*, "
                       "srf.jurisdiction.*, srf.moral.*, srf.vertical.*, "
                       "srf.control.<vertical>.*, ext.framework.*, "
                       "ext.requirement.*.",
        "srf_version": SRF_VERSION,
        "updated": UPDATED,
        "namespaces": {
            "srf.framework": "The framework itself",
            "srf.layer": "One of the five architecture layers L1-L5",
            "srf.opmodel": "One of the four operating models",
            "srf.role": "One of the SRF personas or a declared sector specialization",
            "srf.concept": "A glossary vocabulary concept",
            "srf.data": "A machine-readable data catalog resource under /data/",
            "srf.jurisdiction": "A jurisdiction that issues a regulation or standard",
            "srf.moral": "A moral-orientation dimension (actor, action, outcome)",
            "srf.vertical": "An industry vertical that owns a control schema",
            "srf.control": "A vertical control, srf.control.<vertical>.<control-id>",
            "ext.framework": "An external standard or regulation",
            "ext.requirement": "A concrete requirement inside an external instrument",
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
        "updated": UPDATED,
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
        "updated": UPDATED,
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
        "updated": UPDATED,
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
    jurisdictions = load("jurisdictions.json")
    moral_path = os.path.join(DATA, "moral-regulatory-hierarchy.json")
    moral = json.load(open(moral_path, encoding="utf-8")) if os.path.exists(moral_path) else None

    verticals = ["finance", "healthcare", "insurance",
                 "public-sector", "defense", "manufacturing"]
    controls_by_vertical = {v: load(f"{v}-controls.json") for v in verticals}
    tapestry_path = os.path.join(DATA, "tapestry-controls.json")
    tapestry = (json.load(open(tapestry_path, encoding="utf-8"))
                if os.path.exists(tapestry_path) else None)

    registry, index, per_term = build_glossary_outputs(terms)
    nodes, edges, nodes_out, edges_out = build_ontology(
        terms, layers, personas, matrix, regs, jurisdictions,
        controls_by_vertical, moral=moral, tapestry=tapestry)
    ids = build_ids(nodes, terms)
    exp_g, exp_o, exp_f = build_exports(
        terms, nodes, edges, layers, personas, matrix)

    summary = {
        "glossary_terms": len(terms),
        "ontology_nodes": len(nodes),
        "ontology_edges": len(edges),
        "canonical_ids": ids["count"],
        "controls": sum(len(p["controls"]) for p in controls_by_vertical.values()),
        "tapestry_controls": len((tapestry or {}).get("controls", [])),
        "accountable_for_domain_edges": sum(
            1 for e in edges if e["rel"] == "accountable_for_domain"),
        "jurisdictions": len(jurisdictions["jurisdictions"]),
        "regulations": len(regs["items"]),
        "moral_requirements": len((moral or {}).get("requirements", [])),
        "governed_by_edges": sum(1 for e in edges if e["rel"] == "governed_by"),
        "specializes_edges": sum(1 for e in edges if e["rel"] == "specializes"),
        "emphasizes_edges": sum(1 for e in edges if e["rel"] == "emphasizes"),
        "implements_edges": sum(1 for e in edges if e["rel"] == "implements"),
        "part_of_edges": sum(1 for e in edges if e["rel"] == "part_of"),
        "applies_to_vertical_edges": sum(1 for e in edges if e["rel"] == "applies_to_vertical"),
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
