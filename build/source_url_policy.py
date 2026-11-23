#!/usr/bin/env python3
"""Offline URL policy checks for data/sources.json (no network)."""

from __future__ import annotations

import json
import os
from collections import defaultdict
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOWLIST_PATH = os.path.join(ROOT, "data", "sources-url-allowlist.json")


def normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    parsed = urlparse(url)
    scheme = (parsed.scheme or "https").lower()
    host = (parsed.hostname or "").lower()
    if not host:
        return url.strip().rstrip("/")
    port = parsed.port
    netloc = host
    if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        netloc = f"{host}:{port}"
    path = (parsed.path or "").rstrip("/")
    query = (parsed.query or "").strip()
    if query:
        return f"{scheme}://{netloc}{path}?{query}"
    return f"{scheme}://{netloc}{path}"


def is_bare_homepage(url: str) -> bool:
    parsed = urlparse((url or "").strip())
    if not parsed.scheme or not parsed.netloc:
        return False
    path = (parsed.path or "").rstrip("/")
    return path == ""


def load_allowlist(path: str | None = None) -> dict:
    path = path or ALLOWLIST_PATH
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _bare_allowed(allowlist: dict) -> dict[str, set[str]]:
    out: dict[str, set[str]] = defaultdict(set)
    for item in allowlist.get("bare_homepage") or []:
        nu = normalize_url(item.get("url") or "")
        if not nu:
            continue
        for anchor in item.get("anchors") or []:
            out[nu].add(anchor)
    return dict(out)


def _shared_allowed(allowlist: dict) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for item in allowlist.get("shared_url") or []:
        nu = normalize_url(item.get("url") or "")
        if not nu:
            continue
        anchors = set(item.get("anchors") or [])
        prev = out.get(nu, set())
        out[nu] = prev | anchors
    return out


def validate_catalog_urls(
    entries: list[dict],
    allowlist: dict | None = None,
) -> list[str]:
    """Return human-readable violation messages (empty if OK)."""
    allowlist = allowlist if allowlist is not None else load_allowlist()
    bare_ok = _bare_allowed(allowlist)
    shared_ok = _shared_allowed(allowlist)
    errors: list[str] = []

    by_url: dict[str, list[str]] = defaultdict(list)

    for entry in entries:
        anchor = entry.get("anchor") or "?"
        url = (entry.get("url") or "").strip()
        if not url:
            errors.append(f"missing url: {anchor}")
            continue
        nu = normalize_url(url)
        by_url[nu].append(anchor)
        if is_bare_homepage(url):
            allowed = bare_ok.get(nu, set())
            if anchor not in allowed:
                errors.append(
                    f"bare homepage url not allowlisted: {anchor} -> {url}"
                )

    for nu, anchors in sorted(by_url.items()):
        if len(anchors) < 2:
            continue
        anchor_set = set(anchors)
        allowed = shared_ok.get(nu)
        if allowed is None:
            errors.append(
                f"duplicate url without allowlist: {nu} ({', '.join(sorted(anchors))})"
            )
        elif anchor_set != allowed:
            extra = sorted(anchor_set - allowed)
            missing = sorted(allowed - anchor_set)
            detail = []
            if extra:
                detail.append(f"not listed: {', '.join(extra)}")
            if missing:
                detail.append(f"allowlist orphan: {', '.join(missing)}")
            errors.append(
                f"duplicate url allowlist mismatch for {nu}: {', '.join(detail)}"
            )

    return errors


def main() -> int:
    catalog_path = os.path.join(ROOT, "data", "sources.json")
    catalog = json.load(open(catalog_path, encoding="utf-8"))
    errors = validate_catalog_urls(catalog.get("entries") or [])
    if errors:
        for msg in errors:
            print("ERROR:", msg)
        return 1
    print("OK: sources URL policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())