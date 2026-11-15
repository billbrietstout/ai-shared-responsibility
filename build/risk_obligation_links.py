"""Traceable joins from a threat to an obligation.

A derived_via_control link exists only when one of the threat's related
controls cites a requirement, under that requirement's instrument, and the
instrument is a current obligation. The function returns the citation rows
that make the link traceable. It does not decide that the law requires the
control.
"""
import os
import re

from obligation_kind import citation_pattern, current_obligation

BASIS_VALUES = ("official_text", "named_citation", "derived_via_control")
PLACEHOLDER = re.compile(r"^\s*(TBD|N/?A|None|-)\b", re.I)
VERTICALS = (
    "finance", "healthcare", "insurance",
    "public-sector", "defense", "manufacturing",
)


def _load(root, rel):
    import json
    with open(os.path.join(root, rel), encoding="utf-8") as fh:
        return json.load(fh)


def derived_control_rows(root):
    """Map (threat id, requirement id) to the control citations that reach it."""
    regs = _load(root, "data/regulations.json")
    moral = _load(root, "data/moral-regulatory-hierarchy.json")
    threats = _load(root, "data/threats.json")
    by_id = {i["id"]: i for i in regs["items"]}
    key_to_inst = {i["mapping_key"]: i["id"] for i in regs["items"] if i.get("mapping_key")}
    matchers = []
    for req in moral.get("requirements", []):
        patterns = [
            citation_pattern(p)
            for p in (req.get("citation_match") or [req["citation"]])
        ]
        matchers.append((req, patterns))
    controls = {}
    for vertical in VERTICALS:
        doc = _load(root, f"data/{vertical}-controls.json")
        for control in doc["controls"]:
            controls[f"srf.control.{vertical}.{control['id']}"] = control

    found = {}
    for threat in threats["threats"]:
        for cid in threat.get("related_controls") or []:
            control = controls.get(cid)
            if not control:
                continue
            for mkey, citation in (control.get("mappings") or {}).items():
                if mkey == "mapping_status_note" or not isinstance(citation, str):
                    continue
                if not citation.strip() or PLACEHOLDER.match(citation):
                    continue
                inst_id = key_to_inst.get(mkey)
                item = by_id.get(inst_id) if inst_id else None
                if not item or not current_obligation(item):
                    continue
                for req, patterns in matchers:
                    if req["instrument"] != inst_id:
                        continue
                    if not any(p.search(citation) for p in patterns):
                        continue
                    row = {
                        "control": cid,
                        "mapping_key": mkey,
                        "citation": citation,
                    }
                    bucket = found.setdefault((threat["id"], req["id"]), [])
                    if row not in bucket:
                        bucket.append(row)
    for rows in found.values():
        rows.sort(key=lambda r: (r["control"], r["mapping_key"], r["citation"]))
    return found


def link_problem(link, threat, allowed):
    """Return a short problem string, or None when the link is traceable."""
    if not isinstance(link, dict):
        return "not-an-object"
    basis = link.get("basis")
    source = link.get("source")
    req = link.get("requirement")
    if basis not in BASIS_VALUES:
        return f"{req}:basis"
    if not isinstance(source, dict) or not source:
        return f"{req}:source"
    if basis == "derived_via_control":
        rows = source.get("controls")
        if not isinstance(rows, list) or not rows:
            return f"{req}:no-controls"
        allowed_rows = allowed.get((threat["id"], req), [])
        for row in rows:
            if not isinstance(row, dict):
                return f"{req}:bad-row"
            if row.get("control") not in (threat.get("related_controls") or []):
                return f"{req}:control-not-related"
            if row not in allowed_rows:
                return f"{req}:citation-does-not-match"
        return None
    if basis == "official_text":
        if not source.get("url") or not source.get("citation"):
            return f"{req}:official-text-needs-url-and-citation"
        return None
    if basis == "named_citation":
        if not source.get("citation"):
            return f"{req}:named-citation-needs-citation"
        if not (source.get("url") or source.get("document")):
            return f"{req}:named-citation-needs-document"
        return None
    return f"{req}:basis"
