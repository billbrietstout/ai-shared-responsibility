#!/usr/bin/env python3
"""Copy or check build/fixtures/whitepapers.json against the monitor export.

The monitor repository is the source of truth:

  https://github.com/billbrietstout/ai-security-whitepaper-monitor

Published file, main branch:

  data/whitepapers.json

Check (used in CI):

  python3 scripts/sync_whitepapers_fixture.py --check

The check fails when the fixture JSON differs from that file, or when the
fixture `updated` date is more than 14 days before the check date. If the
monitor file is not on main yet, the check prints a warning and does not
fail for that absence. The age check still runs.

Refresh (writes the fixture only when the monitor file is present and
different):

  python3 scripts/sync_whitepapers_fixture.py

Exit codes:
  0  check passed, or refresh wrote nothing because the files already match
  1  check failed, fetch failed, or refresh could not update the fixture
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FIXTURE = ROOT / "build" / "fixtures" / "whitepapers.json"
MONITOR_EXPORT_URL = (
    "https://raw.githubusercontent.com/billbrietstout/"
    "ai-security-whitepaper-monitor/main/data/whitepapers.json"
)
# Weekly monitor pass, plus a second week before CI fails.
MAX_FIXTURE_AGE_DAYS = 14


class FetchResult:
    def __init__(self, status: str, body: bytes | None, detail: str) -> None:
        self.status = status  # ok, missing, error
        self.body = body
        self.detail = detail


def parse_as_of(text: str) -> date:
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"expected YYYY-MM-DD, got {text!r}"
        ) from exc


def canonical(data: object) -> str:
    return json.dumps(
        data, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )


def parse_updated(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if len(text) >= 10:
        text = text[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def paper_map(data: object) -> dict[str, dict] | None:
    if not isinstance(data, dict):
        return None
    papers = data.get("papers")
    if not isinstance(papers, list):
        return None
    out: dict[str, dict] = {}
    for paper in papers:
        if isinstance(paper, dict) and isinstance(paper.get("id"), str):
            out[paper["id"]] = paper
    return out


def clip(ids: list[str], limit: int = 12) -> str:
    if len(ids) <= limit:
        return ", ".join(ids)
    return ", ".join(ids[:limit]) + f", and {len(ids) - limit} more"


def summarize_diff(local: object, remote: object) -> str:
    left = paper_map(local)
    right = paper_map(remote)
    if left is None or right is None:
        return "The two JSON documents are not the same shape."
    only_local = sorted(set(left) - set(right))
    only_remote = sorted(set(right) - set(left))
    changed = sorted(
        pid
        for pid in set(left) & set(right)
        if canonical(left[pid]) != canonical(right[pid])
    )
    parts = [f"Local papers: {len(left)}. Monitor papers: {len(right)}."]
    if only_remote:
        parts.append("In the monitor only: " + clip(only_remote) + ".")
    if only_local:
        parts.append("In the fixture only: " + clip(only_local) + ".")
    if changed:
        parts.append("Different paper body: " + clip(changed) + ".")
    if not only_remote and not only_local and not changed:
        parts.append(
            "Paper ids and paper bodies match. "
            "A top-level field other than the paper list differs."
        )
    return " ".join(parts)


def evaluate(
    local: object,
    fetched: FetchResult,
    *,
    today: date,
    max_age_days: int,
    url: str,
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(local, dict):
        errors.append(
            "fixture JSON must be an object with an updated date "
            "and a papers array"
        )
        return errors, warnings

    stamp = parse_updated(local.get("updated"))
    if stamp is None:
        errors.append(
            "fixture has no usable updated date (expected YYYY-MM-DD). "
            "Age cannot be checked."
        )
    else:
        age = (today - stamp).days
        if age > max_age_days:
            errors.append(
                f"fixture updated {stamp.isoformat()} is {age} days old, "
                f"which is more than {max_age_days} days. "
                "Refresh it with python3 scripts/sync_whitepapers_fixture.py "
                "and commit the file."
            )
        elif age < 0:
            warnings.append(
                f"fixture updated {stamp.isoformat()} is after the check date "
                f"{today.isoformat()}"
            )

    if fetched.status == "missing":
        warnings.append(
            "monitor export is not published at "
            f"{url} ({fetched.detail}). "
            "The monitor repository is expected to commit "
            "data/whitepapers.json on main. "
            "Fixture content was not compared to the monitor. "
            "The age check above still applies."
        )
        return errors, warnings
    if fetched.status != "ok" or fetched.body is None:
        errors.append(
            f"could not fetch the monitor export at {url}: {fetched.detail}"
        )
        return errors, warnings
    try:
        remote = json.loads(fetched.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        errors.append(f"monitor export is not JSON: {exc}")
        return errors, warnings
    if canonical(local) != canonical(remote):
        errors.append(
            "fixture differs from the monitor export. "
            + summarize_diff(local, remote)
        )
    return errors, warnings


def fetch_export(url: str, timeout: int) -> FetchResult:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "aisharedresponsibility-fixture-check"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return FetchResult("ok", resp.read(), f"HTTP {resp.status}")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return FetchResult("missing", None, f"HTTP {exc.code}")
        return FetchResult("error", None, f"HTTP {exc.code} {exc.reason}")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        reason = getattr(exc, "reason", exc)
        return FetchResult("error", None, str(reason))


def load_fixture(path: Path) -> tuple[object | None, str | None]:
    if not path.exists():
        return None, f"fixture not found: {path}"
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh), None
    except json.JSONDecodeError as exc:
        return None, f"fixture is not JSON: {path}: {exc}"
    except OSError as exc:
        return None, f"could not read fixture {path}: {exc}"


def emit(kind: str, msg: str) -> None:
    print(f"{kind.upper()}: {msg}")
    if os.environ.get("GITHUB_ACTIONS") == "true":
        safe = msg.replace("\r", " ").replace("\n", " ").replace("%", "%25")
        print(f"::{kind}::{safe}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    ap.add_argument("--url", default=MONITOR_EXPORT_URL)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--as-of", type=parse_as_of, default=None)
    ap.add_argument("--max-age", type=int, default=MAX_FIXTURE_AGE_DAYS)
    ap.add_argument("--timeout", type=int, default=30)
    args = ap.parse_args()
    today = args.as_of or date.today()

    local, load_err = load_fixture(args.fixture)
    if load_err and args.check:
        emit("error", load_err)
        return 1

    fetched = fetch_export(args.url, args.timeout)

    if args.check:
        errors, warnings = evaluate(
            local,
            fetched,
            today=today,
            max_age_days=args.max_age,
            url=args.url,
        )
        for msg in errors:
            emit("error", msg)
        for msg in warnings:
            emit("warning", msg)
        print(
            f"Summary: {len(errors)} error(s), {len(warnings)} warning(s). "
            f"As of {today.isoformat()}. Max age {args.max_age} days."
        )
        return 1 if errors else 0

    if fetched.status == "missing":
        emit(
            "warning",
            "monitor export is not published at "
            f"{args.url} ({fetched.detail}). Fixture left unchanged.",
        )
        return 1
    if fetched.status != "ok" or fetched.body is None:
        emit(
            "error",
            f"could not fetch the monitor export at {args.url}: "
            f"{fetched.detail}",
        )
        return 1
    try:
        remote = json.loads(fetched.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        emit("error", f"monitor export is not JSON: {exc}")
        return 1
    if local is not None and canonical(local) == canonical(remote):
        print(f"Fixture already matches the monitor export: {args.fixture}")
        return 0
    text = json.dumps(remote, indent=2, ensure_ascii=False) + "\n"
    args.fixture.parent.mkdir(parents=True, exist_ok=True)
    args.fixture.write_text(text, encoding="utf-8")
    print(f"Wrote {args.fixture}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
