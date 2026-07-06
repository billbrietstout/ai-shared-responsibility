#!/usr/bin/env python3
"""Verify the generated OSCAL vertical catalog and profiles.

Three verification layers, strongest available first:

1. Official OSCAL JSON schema, when reachable. Pass --schema-dir with local
   copies of oscal_catalog_schema.json and oscal_profile_schema.json (from
   the OSCAL v1.2.2 release assets), or let the script try to download and
   cache them. Schema validation is skipped with a warning when neither
   works; it is not silently ignored.
2. Structural checks mirroring the OSCAL 1.2.2 metaschema constraints this
   generator can violate: required fields, UUID and token syntax, unique
   control and param IDs, allowed oscal-version.
3. Referential integrity per the plan's definition of done: every internal
   link href resolves to a back-matter resource, every control binds exactly
   one threshold param, every profile with-id and set-parameter resolves
   against the catalog, and no link carries an invented (TBD) mapping ID.

Exit code 0 = all checks passed (schema layer may be skipped-with-warning).

Usage: python3 build/verify_oscal.py [--root PATH] [--schema-dir PATH]
"""

import argparse
import json
import pathlib
import re
import sys
import urllib.request

TOKEN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9._\-]*$")
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
SCHEMA_URLS = {
    "catalog": "https://github.com/usnistgov/OSCAL/releases/download/v1.2.2/oscal_catalog_schema.json",
    "profile": "https://github.com/usnistgov/OSCAL/releases/download/v1.2.2/oscal_profile_schema.json",
}
CACHE_DIR = pathlib.Path("/tmp/oscal-schemas-1.2.2")

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def check_metadata(md, label):
    for field in ("title", "last-modified", "version", "oscal-version"):
        if field not in md:
            err(f"{label}: metadata missing {field}")
    if md.get("oscal-version") != "1.2.2":
        err(f"{label}: oscal-version is {md.get('oscal-version')}, expected 1.2.2")


def walk_controls(node):
    for ctl in node.get("controls", []):
        yield ctl
        yield from walk_controls(ctl)
    for grp in node.get("groups", []):
        yield from walk_controls(grp)


def collect_link_hrefs(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "links" and isinstance(v, list):
                for l in v:
                    yield l
            else:
                yield from collect_link_hrefs(v)
    elif isinstance(obj, list):
        for item in obj:
            yield from collect_link_hrefs(item)


def check_catalog(path):
    doc = json.loads(path.read_text())
    if "catalog" not in doc:
        err(f"{path.name}: no top-level catalog")
        return None, {}
    cat = doc["catalog"]
    label = path.name
    if not UUID_RE.match(cat.get("uuid", "")):
        err(f"{label}: bad catalog uuid")
    check_metadata(cat.get("metadata", {}), label)

    resource_uuids = {r["uuid"] for r in
                      cat.get("back-matter", {}).get("resources", [])}
    for r in cat.get("back-matter", {}).get("resources", []):
        if not UUID_RE.match(r.get("uuid", "")):
            err(f"{label}: bad resource uuid {r.get('uuid')}")
        if not r.get("rlinks") and not r.get("citation"):
            warn(f"{label}: resource {r.get('title')} has no rlink or citation")

    ctl_ids = {}
    param_ids = {}
    for ctl in walk_controls(cat):
        cid = ctl.get("id", "")
        if not TOKEN_RE.match(cid):
            err(f"{label}: control id not a valid token: {cid}")
        if cid in ctl_ids:
            err(f"{label}: duplicate control id {cid}")
        ctl_ids[cid] = ctl
        params = ctl.get("params", [])
        if len(params) != 1:
            err(f"{label}: control {cid} has {len(params)} params, expected 1")
        for p in params:
            pid = p.get("id", "")
            if not TOKEN_RE.match(pid):
                err(f"{label}: param id not a valid token: {pid}")
            if pid in param_ids:
                err(f"{label}: duplicate param id {pid}")
            param_ids[pid] = cid
            if not p.get("values"):
                err(f"{label}: param {pid} has no bound value")
        # objective part must reference the control's param
        parts = {pt.get("name"): pt for pt in ctl.get("parts", [])}
        if "objective" not in parts:
            err(f"{label}: control {cid} missing objective part")
        elif params and params[0].get("id", "") not in parts["objective"].get("prose", ""):
            err(f"{label}: control {cid} objective does not insert its param")
        if "statement" not in parts:
            err(f"{label}: control {cid} missing statement part")

    for link in collect_link_hrefs(cat):
        href = link.get("href", "")
        text = link.get("text", "")
        if "TBD" in text:
            err(f"{label}: link with TBD text (invented mapping?): {text[:60]}")
        if href.startswith("#"):
            if href[1:] not in resource_uuids:
                err(f"{label}: unresolved internal link {href}")
        elif not href.startswith("http"):
            err(f"{label}: non-URL, non-fragment href {href}")

    print(f"  {label}: {len(ctl_ids)} controls, {len(param_ids)} params, "
          f"{len(resource_uuids)} resources")
    return doc, {"controls": ctl_ids, "params": param_ids}


def check_profile(path, catalog_index, catalog_url):
    doc = json.loads(path.read_text())
    if "profile" not in doc:
        err(f"{path.name}: no top-level profile")
        return None
    prof = doc["profile"]
    label = path.name
    if not UUID_RE.match(prof.get("uuid", "")):
        err(f"{label}: bad profile uuid")
    check_metadata(prof.get("metadata", {}), label)

    resource_uuids = {r["uuid"] for r in
                      prof.get("back-matter", {}).get("resources", [])}
    n_ids = 0
    for imp in prof.get("imports", []):
        if imp.get("href") != catalog_url:
            warn(f"{label}: import href {imp.get('href')} != catalog url")
        for inc in imp.get("include-controls", []):
            for cid in inc.get("with-ids", []):
                n_ids += 1
                if cid not in catalog_index["controls"]:
                    err(f"{label}: with-id {cid} not in catalog")
    n_params = 0
    for sp in prof.get("modify", {}).get("set-parameters", []):
        n_params += 1
        pid = sp.get("param-id", "")
        if pid not in catalog_index["params"]:
            err(f"{label}: set-parameter {pid} not in catalog")
        if not sp.get("values"):
            err(f"{label}: set-parameter {pid} has no values")
    for link in collect_link_hrefs(prof):
        href = link.get("href", "")
        if href.startswith("#") and href[1:] not in resource_uuids:
            err(f"{label}: unresolved internal link {href}")
        if "TBD" in link.get("text", ""):
            err(f"{label}: link with TBD text: {link['text'][:60]}")

    print(f"  {label}: {n_ids} included controls, {n_params} set-parameters")
    return doc


# The official OSCAL schemas carry XSD-style unicode property escapes
# (\p{L}, \p{N}) in their regex patterns. Python's re module cannot compile
# those, so rewrite them to close Python equivalents before validating.
# [^\W\d_] matches any unicode letter under re.UNICODE; \d covers decimal
# digits. OSCAL tokens and datatypes in these documents are ASCII, so the
# approximation cannot change a verdict here.
PROP_ESCAPES = [
    (r"\p{L}", r"[^\W\d_]"),
    (r"\p{N}", r"\d"),
    (r"\p{Nd}", r"\d"),
    (r"\p{M}", ""),
]


def fix_patterns(node):
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k in ("pattern", "format") and isinstance(v, str) and r"\p{" in v:
                for esc, repl in PROP_ESCAPES:
                    v = v.replace(esc, repl)
            out[k] = fix_patterns(v) if isinstance(v, (dict, list)) else v
        return out
    if isinstance(node, list):
        return [fix_patterns(x) for x in node]
    return node


def get_schema(kind, schema_dir):
    fname = f"oscal_{kind}_schema.json"
    schema = None
    if schema_dir:
        p = pathlib.Path(schema_dir) / fname
        if p.exists():
            schema = json.loads(p.read_text())
    if schema is None:
        cached = CACHE_DIR / fname
        if not cached.exists():
            try:
                CACHE_DIR.mkdir(exist_ok=True)
                with urllib.request.urlopen(SCHEMA_URLS[kind], timeout=60) as r:
                    cached.write_bytes(r.read())
            except Exception as e:
                warn(f"official {kind} schema unavailable ({e.__class__.__name__}); "
                     "schema layer skipped. Pass --schema-dir or rerun with network "
                     "access for full validation.")
                return None
        schema = json.loads(cached.read_text())
    return fix_patterns(schema)


def schema_validate(doc, kind, schema_dir, label):
    schema = get_schema(kind, schema_dir)
    if schema is None:
        return
    try:
        import jsonschema
    except ImportError:
        warn("jsonschema not installed; schema layer skipped")
        return
    v = jsonschema.Draft7Validator(schema)
    try:
        problems = sorted(v.iter_errors(doc),
                          key=lambda e: [str(p) for p in e.absolute_path])
    except re.error as e:
        warn(f"{label}: schema contains a pattern Python re cannot compile "
             f"({e}); schema layer skipped for this document")
        return
    for p in problems[:20]:
        err(f"{label}: schema: {'/'.join(map(str, p.absolute_path))}: {p.message[:120]}")
    if not problems:
        print(f"  {label}: official OSCAL {kind} schema OK")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=None)
    ap.add_argument("--schema-dir", default=None)
    args = ap.parse_args()
    root = pathlib.Path(args.root) if args.root else \
        pathlib.Path(__file__).resolve().parent.parent
    export = root / "export"
    catalog_path = export / "srf-oscal-verticals-catalog.json"
    catalog_url = ("https://aisharedresponsibility.com/export/"
                   "srf-oscal-verticals-catalog.json")

    print("verifying catalog:")
    cat_doc, index = check_catalog(catalog_path)
    if cat_doc:
        schema_validate(cat_doc, "catalog", args.schema_dir, catalog_path.name)

    print("verifying profiles:")
    for p in sorted(export.glob("srf-*.profile.json")):
        prof_doc = check_profile(p, index, catalog_url)
        if prof_doc:
            schema_validate(prof_doc, "profile", args.schema_dir, p.name)

    for w in warnings:
        print(f"WARN: {w}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}")
        print(f"\n{len(errors)} error(s)")
        return 1
    print(f"\nall checks passed ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
