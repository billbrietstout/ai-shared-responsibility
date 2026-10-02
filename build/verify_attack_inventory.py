#!/usr/bin/env python3
"""Verify /data/attack-inventory.json.

Four layers, strongest available first:

1. JSON Schema (data/attack-inventory.schema.json) when the jsonschema
   package is installed. Skipped with a warning otherwise, never silently.
2. Structural checks that run without jsonschema: unique atk- ids, enums,
   every ref's catalog pinned in the catalogs block at the same version.
3. Referential integrity: related and merged_into ids resolve, srf_crosswalk
   ids exist in data/threats.json, verification methods are defined, a
   verified ref sits on an entry with a check date and method, changelog ids
   resolve, no entry claims a version newer than the inventory.
4. Staleness (warnings): an entry checked before the release date of a
   catalog it cites, a pinned catalog with a newer release seen, and URL refs
   older than 180 days.

Prose fields are also checked for em and en dashes, which the site's writing
rules forbid.

Exit code 0 = no errors. Warnings do not fail the run unless --strict.

Usage: python3 build/verify_attack_inventory.py [--root PATH] [--strict]
"""

import argparse
import datetime as dt
import json
import pathlib
import re
import sys

ID_RE = re.compile(r"^atk-[a-z0-9]+(-[a-z0-9]+)*$")
SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
QUALITY = {"exact", "closest", "analogy"}
SCOPES = {"ai", "agentic", "classical-reopened"}
STATUSES = {"active", "merged", "withdrawn"}
URL_STALE_DAYS = 180
DASHES = ("\u2014", "\u2013")

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def parse_date(s):
    """Accept YYYY, YYYY-MM, or YYYY-MM-DD; return the first day covered."""
    if not s:
        return None
    parts = [int(p) for p in s.split("-")]
    while len(parts) < 3:
        parts.append(1)
    return dt.date(*parts)


def semver(s):
    m = SEMVER_RE.match(s or "")
    return tuple(int(x) for x in m.groups()) if m else None


def schema_layer(doc, schema_path):
    try:
        import jsonschema
    except ImportError:
        warn("jsonschema not installed; schema layer skipped")
        return
    schema = json.loads(schema_path.read_text())
    v = jsonschema.Draft202012Validator(schema)
    for e in sorted(v.iter_errors(doc), key=lambda e: list(e.path)):
        path = "/".join(str(p) for p in e.path) or "(root)"
        err(f"schema: {path}: {e.message}")


def walk_strings(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{path}/{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, f"{path}/{i}")
    elif isinstance(obj, str):
        yield path, obj


def check(doc, threats_ids, today):
    catalogs = doc.get("catalogs", {})
    methods = set(doc.get("verification_methods", {}))
    inv_ver = semver(doc.get("inventory_version"))
    if not inv_ver:
        err("inventory_version is not semver")

    entries = doc.get("entries", [])
    ids = [e.get("id") for e in entries]
    seen = set()
    for i in ids:
        if i in seen:
            err(f"duplicate id {i}")
        seen.add(i)

    for e in entries:
        eid = e.get("id", "?")
        if not ID_RE.match(eid):
            err(f"{eid}: id does not match atk- slug form")
        if e.get("scope") not in SCOPES:
            err(f"{eid}: scope {e.get('scope')!r} not in {sorted(SCOPES)}")
        if e.get("status") not in STATUSES:
            err(f"{eid}: status {e.get('status')!r} not in {sorted(STATUSES)}")
        if not e.get("failure_mode"):
            err(f"{eid}: failure_mode is empty")

        if e.get("status") == "merged":
            if e.get("merged_into") not in seen:
                err(f"{eid}: merged_into {e.get('merged_into')!r} does not resolve")
        elif e.get("merged_into") is not None:
            err(f"{eid}: merged_into set but status is {e.get('status')}")

        for r in e.get("related", []):
            if r == eid:
                err(f"{eid}: related lists itself")
            elif r not in seen:
                err(f"{eid}: related id {r} does not resolve")

        for x in e.get("srf_crosswalk", []):
            if x not in threats_ids:
                err(f"{eid}: srf_crosswalk id {x} not in data/threats.json")

        refs = []
        for t in e.get("taxonomy_refs", []):
            refs.append(t)
            cat = catalogs.get(t.get("catalog"))
            if not cat:
                err(f"{eid}: taxonomy ref {t.get('id')} uses unpinned catalog {t.get('catalog')}")
                continue
            if t.get("catalog_version") != cat.get("version"):
                err(f"{eid}: {t.get('id')} records {t.get('catalog')} {t.get('catalog_version')}, "
                    f"catalogs block pins {cat.get('version')}")
            if t.get("mapping_quality") not in QUALITY:
                err(f"{eid}: {t.get('id')} mapping_quality {t.get('mapping_quality')!r}")
            if t.get("verified") and not t.get("title_in_catalog"):
                err(f"{eid}: {t.get('id')} is verified but title_in_catalog is empty")
        for p in e.get("paper_refs", []):
            refs.append(p)
            if p.get("verified") and not (p.get("title") and p.get("first_author")):
                err(f"{eid}: paper {p.get('id')} is verified but title or first_author is empty")
        for x in e.get("incident_refs", []):
            refs.append(x)
            if x.get("type") == "atlas-case-study":
                atlas = catalogs.get("mitre-atlas", {}).get("version")
                if x.get("catalog_version") != atlas:
                    err(f"{eid}: case study {x.get('id')} records {x.get('catalog_version')}, ATLAS pin is {atlas}")
            if x.get("type") == "url":
                acc = parse_date(x.get("accessed"))
                if not acc:
                    err(f"{eid}: url ref {x.get('id')} has no access date")
                elif (today - acc).days > URL_STALE_DAYS:
                    warn(f"{eid}: url ref {x.get('id')} last accessed {x.get('accessed')}, older than "
                         f"{URL_STALE_DAYS} days")

        v = e.get("verification", {})
        if any(r.get("verified") for r in refs):
            if not v.get("checked_on") or not v.get("checked_by"):
                err(f"{eid}: has verified refs but verification.checked_on or checked_by is empty")
            if not v.get("methods"):
                err(f"{eid}: has verified refs but no verification method")
        for m in v.get("methods", []):
            if m not in methods:
                err(f"{eid}: verification method {m} not defined in verification_methods")

        for field in ("added_in", "last_changed_in"):
            sv = semver(e.get(field))
            if not sv:
                err(f"{eid}: {field} is not semver")
            elif inv_ver and sv > inv_ver:
                err(f"{eid}: {field} {e.get(field)} is newer than inventory_version")

        checked = parse_date(v.get("checked_on"))
        if checked:
            cited = {t.get("catalog") for t in e.get("taxonomy_refs", [])}
            if any(x.get("type") == "atlas-case-study" for x in e.get("incident_refs", [])):
                cited.add("mitre-atlas")
            for c in sorted(cited):
                rel = parse_date(catalogs.get(c, {}).get("released"))
                if rel and checked < rel:
                    warn(f"{eid}: checked {v.get('checked_on')}, before {c} release {catalogs[c]['released']}")

    for key, cat in catalogs.items():
        newer = cat.get("newer_release_seen")
        if newer and newer.get("version") != cat.get("version"):
            warn(f"catalog {key}: pinned {cat.get('version')}, newer release {newer['version']} seen on "
                 f"{newer.get('checked_on')} ({newer.get('cited_ids_changed')} cited ids changed)")

    for c in doc.get("changelog", []):
        if c.get("id") != "*" and c.get("id") not in seen:
            err(f"changelog line for unknown id {c.get('id')}")
        cv = semver(c.get("version"))
        if inv_ver and cv and cv > inv_ver:
            err(f"changelog version {c.get('version')} is newer than inventory_version")
    if inv_ver and not any(semver(c.get("version")) == inv_ver for c in doc.get("changelog", [])):
        err(f"no changelog line for inventory_version {doc.get('inventory_version')}")

    for path, s in walk_strings(doc):
        if any(d in s for d in DASHES):
            err(f"prose: em or en dash at {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=pathlib.Path(__file__).resolve().parent.parent, type=pathlib.Path)
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    ap.add_argument("--today", help="override today's date (YYYY-MM-DD) for staleness checks")
    a = ap.parse_args()

    inv_path = a.root / "data" / "attack-inventory.json"
    doc = json.loads(inv_path.read_text())
    threats = json.loads((a.root / "data" / "threats.json").read_text())
    threats_ids = {t["id"] for t in threats.get("threats", [])}
    today = parse_date(a.today) if a.today else dt.date.today()

    schema_layer(doc, a.root / "data" / "attack-inventory.schema.json")
    check(doc, threats_ids, today)

    entries = doc.get("entries", [])
    n_refs = sum(len(e["taxonomy_refs"]) + len(e["paper_refs"]) + len(e["incident_refs"]) for e in entries)
    n_ver = sum(1 for e in entries for k in ("taxonomy_refs", "paper_refs", "incident_refs")
                for r in e[k] if r.get("verified"))
    print(f"attack-inventory {doc.get('inventory_version')}: {len(entries)} entries, "
          f"{n_ver} of {n_refs} refs verified")
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"FAIL  {e}")
    if errors or (a.strict and warnings):
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
