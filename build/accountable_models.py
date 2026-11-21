"""One accountable SRF persona per control per SRF v1.0 model.

Applicable models are the four ids named on the control, plus the SRF model
each sector name maps to in data/sector-model-map.json. Shared is not a
persona and not a model id. A sector specialization stored on
accountable_persona resolves to its canonical persona for the per-model field.
"""
import json
import os

SRF_MODELS = ("AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS")
VERTICALS = (
    "finance", "healthcare", "insurance",
    "public-sector", "defense", "manufacturing",
)
COMMON = "common"
CONTROL_SOURCES = VERTICALS + (COMMON,)
FORBIDDEN_OWNER_FIELDS = ("co_accountable_persona", "accountability_split")


def load_json(root, rel):
    with open(os.path.join(root, rel), encoding="utf-8") as fh:
        return json.load(fh)


def sector_to_srf(root):
    doc = load_json(root, "data/sector-model-map.json")
    return {row["sector_model"]: row["srf_model"] for row in doc["mappings"]}


def applicable_models(operating_models, sector_map):
    named = set(operating_models or [])
    found = []
    for model in SRF_MODELS:
        if model in named:
            found.append(model)
            continue
        if any(sector_map.get(code) == model for code in named):
            found.append(model)
    return found


def canonical_ids(personas_doc):
    return {
        p["id"] for p in personas_doc["personas"]
        if p.get("provenance") == "cosai-core"
    }


def specialization_map(personas_doc):
    return {
        s["id"]: s["specializes"]
        for s in personas_doc.get("sector_specializations", [])
    }


def to_canonical(persona_id, specs):
    return specs.get(persona_id, persona_id)
