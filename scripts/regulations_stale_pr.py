#!/usr/bin/env python3
"""Flag stale regulation last_verified dates and open one draft pull request.

The weekly workflow calls this script. It reads data/regulations.json, writes
reports/regulations-stale.json and reports/regulations-stale.md, and pushes
branch automation/regulations-stale-check. The pull request targets develop
and stays a draft. The body and a follow-up comment mention @cursor so a
Cursor agent can re-verify the listed sources.

This script does not bump last_verified. It does not push develop, main, or
master. It does not force-push. It does not merge.

  python3 scripts/regulations_stale_pr.py --dry-run
  python3 scripts/regulations_stale_pr.py --push
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

BOT_BRANCH = "automation/regulations-stale-check"
BASE_BRANCH = "develop"
CRON = "0 4 * * 4"
BOT_NAME = "github-actions[bot]"
BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com"
PR_TITLE = "Flag stale regulation last_verified dates"
PROTECTED_BRANCHES = frozenset({"develop", "main", "master"})
REGULATIONS_PATH = "data/regulations.json"
REPORT_JSON = "reports/regulations-stale.json"
REPORT_MD = "reports/regulations-stale.md"
PUBLISHED_PATHS = (REPORT_JSON, REPORT_MD)
CURSOR_MENTION = "@cursor"
DOCS_PATH = "docs/regulations-verification.md"

_SEGMENT = re.compile(r"[A-Za-z0-9._-]+$")
_TOKEN = re.compile(r"(ghp_|github_pat_|gho_)[A-Za-z0-9_]+")

CLOSE_CLEAN = (
    "No regulation entry on develop is past the staleness threshold, so "
    "this draft has nothing left to review. The workflow closed it without "
    "merging."
)


@dataclass(frozen=True)
class Plan:
    action: str
    keep: int | None
    close: list[int]


@dataclass(frozen=True)
class StaleEntry:
    id: str
    name: str
    url: str
    version: str
    last_verified: str
    age_days: int
    depth: str
    body: str


def redact(text: str) -> str:
    text = re.sub(r"x-access-token:[^\s@]+", "x-access-token:REDACTED", text)
    return _TOKEN.sub(r"\1REDACTED", text)


def destination_ref(branch: str) -> str:
    parts = branch.split("/")
    blocked = (
        len(parts) < 2
        or parts[0] != "automation"
        or any(
            part in PROTECTED_BRANCHES or part in {"", ".", ".."} for part in parts
        )
        or any(_SEGMENT.fullmatch(part) is None for part in parts[1:])
    )
    if blocked:
        raise SystemExit(f"refusing to push {branch}")
    return "refs/heads/" + branch


def assert_paths_allowed(paths: list[str]) -> None:
    bad = [path for path in paths if path not in PUBLISHED_PATHS]
    if bad:
        raise SystemExit(
            "refusing to publish unexpected paths: " + ", ".join(bad)
        )


def plan_pull_request(open_prs: list[dict], open_draft: bool) -> Plan:
    numbers = sorted({int(pr["number"]) for pr in open_prs})
    if not open_draft:
        if not numbers:
            return Plan("skip", None, [])
        return Plan("close", None, numbers)
    if not numbers:
        return Plan("create", None, [])
    return Plan("update", numbers[0], numbers[1:])


def parse_day(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise SystemExit(f"bad date {value!r}: {exc}") from exc


def find_stale(
    payload: dict[str, Any],
    *,
    today: date | None = None,
) -> tuple[int, list[StaleEntry]]:
    if not isinstance(payload, dict):
        raise SystemExit("regulations.json must be an object")
    threshold = payload.get("stale_threshold_days", 180)
    if not isinstance(threshold, int) or threshold < 1:
        raise SystemExit("stale_threshold_days must be a positive integer")
    items = payload.get("items")
    if not isinstance(items, list):
        raise SystemExit("regulations.json items must be an array")
    as_of = today or datetime.now(timezone.utc).date()
    stale: list[StaleEntry] = []
    for item in items:
        if not isinstance(item, dict):
            raise SystemExit("each regulations item must be an object")
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id:
            raise SystemExit("each regulations item needs a string id")
        last_verified = item.get("last_verified")
        if not isinstance(last_verified, str) or not last_verified:
            continue
        verified_on = parse_day(last_verified)
        age = (as_of - verified_on).days
        if age <= threshold:
            continue
        stale.append(
            StaleEntry(
                id=item_id,
                name=str(item.get("name") or item_id),
                url=str(item.get("url") or ""),
                version=str(item.get("version") or ""),
                last_verified=last_verified,
                age_days=age,
                depth=str(item.get("depth") or ""),
                body=str(item.get("body") or ""),
            )
        )
    stale.sort(key=lambda row: (-row.age_days, row.id))
    return threshold, stale


def ids_with_newer_verification(
    develop: dict[str, Any], branch: dict[str, Any]
) -> list[str]:
    left = {
        item["id"]: item.get("last_verified")
        for item in develop.get("items", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    newer: list[str] = []
    for item in branch.get("items", []):
        if not isinstance(item, dict):
            continue
        item_id = item.get("id")
        branch_day = item.get("last_verified")
        if not isinstance(item_id, str) or not isinstance(branch_day, str):
            continue
        base_day = left.get(item_id)
        if not isinstance(base_day, str):
            continue
        if parse_day(branch_day) > parse_day(base_day):
            newer.append(item_id)
    return sorted(newer)


def report_payload(
    *,
    threshold: int,
    checked_on: str,
    stale: list[StaleEntry],
    newer_on_branch: list[str],
) -> dict[str, Any]:
    return {
        "checked_on": checked_on,
        "stale_threshold_days": threshold,
        "stale_count": len(stale),
        "stale": [
            {
                "id": row.id,
                "name": row.name,
                "body": row.body,
                "url": row.url,
                "version": row.version,
                "last_verified": row.last_verified,
                "age_days": row.age_days,
                "depth": row.depth,
            }
            for row in stale
        ],
        "newer_last_verified_on_branch": newer_on_branch,
    }


def render_report_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# Stale regulation verification dates",
        "",
        f"Checked on {payload['checked_on']}.",
        f"Threshold: {payload['stale_threshold_days']} days.",
        f"Stale entries: {payload['stale_count']}.",
        "",
    ]
    if payload["stale"]:
        lines.extend(
            [
                "| id | last_verified | age_days | source |",
                "| --- | --- | ---: | --- |",
            ]
        )
        for row in payload["stale"]:
            lines.append(
                f"| `{row['id']}` | {row['last_verified']} | "
                f"{row['age_days']} | {row['url']} |"
            )
        lines.append("")
    else:
        lines.append("No stale entries on this tree.")
        lines.append("")
    newer = payload.get("newer_last_verified_on_branch") or []
    if newer:
        lines.append("Branch already has a newer `last_verified` than develop:")
        lines.append("")
        for item_id in newer:
            lines.append(f"- `{item_id}`")
        lines.append("")
    return "\n".join(lines)


def clip_ids(ids: list[str], limit: int = 40) -> str:
    if not ids:
        return "None."
    shown = ", ".join(f"`{item}`" for item in ids[:limit])
    if len(ids) <= limit:
        return shown + "."
    return f"{shown}, and {len(ids) - limit} more."


def render_pull_request_body(payload: dict[str, Any]) -> str:
    stale_ids = [row["id"] for row in payload["stale"]]
    newer = payload.get("newer_last_verified_on_branch") or []
    lines = [
        CURSOR_MENTION,
        "",
        "## Summary",
        "",
        "This draft lists regulation entries whose `last_verified` date on "
        f"`develop` is older than {payload['stale_threshold_days']} days.",
        "",
        f"- Checked: {payload['checked_on']}",
        f"- Stale in this report: {payload['stale_count']}",
        f"- Report: `{REPORT_JSON}`",
        f"- Agent instructions: `{DOCS_PATH}`",
        "",
        "## Stale ids",
        "",
        clip_ids(stale_ids),
        "",
    ]
    if newer:
        lines.extend(
            [
                "## Already refreshed on this branch",
                "",
                clip_ids(newer),
                "",
                "Those ids already have a newer `last_verified` on this "
                "branch than on develop. Keep those commits. Do not roll "
                "them back.",
                "",
            ]
        )
    if stale_ids:
        lines.extend(
            [
                "## Cursor task",
                "",
                f"{CURSOR_MENTION} Follow `{DOCS_PATH}`.",
                "",
                "1. Open each stale source URL in the report.",
                "2. Confirm the entry still matches the live instrument.",
                "3. When confirmed, set `last_verified` to today's UTC date "
                f"in `{REGULATIONS_PATH}` on this branch.",
                "4. If the source moved or changed, update `url`, `version`, "
                "`name`, or `scope` in the same commit and say what changed "
                "in the pull request comment.",
                "5. If you cannot verify an entry, leave its date alone and "
                "comment why.",
                "6. Do not bump a date without opening the source. Do not "
                "merge. Do not mark the draft ready.",
                "",
            ]
        )
    else:
        lines.extend(
            [
                "## Cursor task",
                "",
                "No stale ids remain on this branch. Leave the draft for a "
                "person to merge the `last_verified` updates into develop.",
                "",
            ]
        )
    lines.extend(
        [
            "## Review",
            "",
            "1. Read the report and any Cursor comments.",
            "2. GitHub may hold pull request workflows until someone with "
            "write access selects Approve workflows to run.",
            "3. This pull request stays a draft. The workflow does not "
            "merge it and does not push to `develop` or `main`.",
            "4. Merge after the date bumps look right.",
            "",
        ]
    )
    return "\n".join(lines)


def cursor_comment(payload: dict[str, Any]) -> str:
    stale_ids = [row["id"] for row in payload["stale"]]
    return (
        f"{CURSOR_MENTION} Stale regulation verification pass for "
        f"{payload['checked_on']}.\n"
        f"\n"
        f"Please follow `{DOCS_PATH}` and re-verify: "
        f"{clip_ids(stale_ids)}\n"
        f"\n"
        f"Update `{REGULATIONS_PATH}` on this branch only. Leave the pull "
        f"request as a draft."
    )


def commit_message(payload: dict[str, Any]) -> str:
    return (
        "Flag stale regulation last_verified dates.\n"
        "\n"
        f"Checked on {payload['checked_on']}. "
        f"Stale entries: {payload['stale_count']}.\n"
    )


def git(
    repo: Path, args: list[str], check: bool = True
) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(
        ["git", "-C", str(repo), *args],
        text=True,
        capture_output=True,
    )
    if check and proc.returncode != 0:
        raise SystemExit(
            redact(
                f"git {' '.join(args)} failed ({proc.returncode})\n"
                f"{proc.stdout}\n{proc.stderr}"
            )
        )
    return proc


def configure_identity(repo: Path) -> None:
    git(repo, ["config", "user.name", BOT_NAME])
    git(repo, ["config", "user.email", BOT_EMAIL])
    git(repo, ["config", "commit.gpgsign", "false"])


def remote_branch_exists(repo: Path, branch: str) -> bool:
    proc = git(repo, ["ls-remote", "--heads", "origin", branch])
    return bool(proc.stdout.strip())


def remote_sha(repo: Path, branch: str) -> str | None:
    proc = git(
        repo,
        ["rev-parse", "--verify", f"refs/remotes/origin/{branch}"],
        check=False,
    )
    if proc.returncode != 0:
        return None
    return proc.stdout.strip()


def git_show_json(repo: Path, rev: str, path: str) -> dict[str, Any]:
    proc = git(repo, ["show", f"{rev}:{path}"])
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{rev}:{path} is not JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise SystemExit(f"{rev}:{path} must be a JSON object")
    return data


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise SystemExit(f"{path} must be a JSON object")
    return data


def write_reports(repo: Path, payload: dict[str, Any]) -> None:
    json_path = repo / REPORT_JSON
    md_path = repo / REPORT_MD
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    md_path.write_text(render_report_markdown(payload), encoding="utf-8")


def sync_git_branch(repo: Path, branch: str, base: str, payload: dict[str, Any]) -> None:
    status = git(repo, ["status", "--porcelain"])
    if status.stdout.strip():
        raise SystemExit("repository is not clean; refusing to commit")
    configure_identity(repo)
    if remote_branch_exists(repo, branch):
        git(repo, ["fetch", "--no-tags", "origin", branch])
        git(repo, ["checkout", "-B", branch, f"origin/{branch}"])
        merge = git(repo, ["merge", "--no-edit", f"origin/{base}"], check=False)
        if merge.returncode != 0:
            raise SystemExit(
                "merge from develop conflicted on the regulations stale "
                "branch:\n"
                + redact(merge.stdout + "\n" + merge.stderr)
            )
    else:
        git(repo, ["checkout", "-B", branch, f"origin/{base}"])
    write_reports(repo, payload)
    git(repo, ["add", "--", *PUBLISHED_PATHS])
    staged = [
        line
        for line in git(repo, ["diff", "--cached", "--name-only"]).stdout.splitlines()
        if line
    ]
    assert_paths_allowed(staged)
    quiet = git(repo, ["diff", "--cached", "--quiet"], check=False)
    if quiet.returncode == 1:
        message = repo / ".git" / "regulations-stale-message.txt"
        message.write_text(commit_message(payload), encoding="utf-8")
        git(repo, ["commit", "-F", str(message)])
    elif quiet.returncode != 0:
        raise SystemExit(redact(quiet.stdout + "\n" + quiet.stderr))
    changed_tree = [
        line
        for line in git(
            repo, ["diff", "--name-only", f"origin/{base}", "HEAD"]
        ).stdout.splitlines()
        if line
    ]
    # Cursor may already have edited regulations.json on this branch. The
    # workflow itself may only add the report files.
    unexpected = [
        path
        for path in changed_tree
        if path not in PUBLISHED_PATHS and path != REGULATIONS_PATH
    ]
    if unexpected:
        raise SystemExit(
            "refusing to publish unexpected branch changes: "
            + ", ".join(unexpected)
        )
    head = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    if head != branch:
        raise SystemExit(f"refusing to push from {head}")
    local = git(repo, ["rev-parse", "HEAD"]).stdout.strip()
    if remote_sha(repo, branch) == local:
        print(f"Branch {branch} already matches the report.")
        return
    ref = destination_ref(branch)
    git(repo, ["push", "origin", f"HEAD:{ref}"])
    print(f"Pushed {ref}")


def gh(repo: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["GH_PROMPT_DISABLED"] = "1"
    env.setdefault("GH_NO_UPDATE_NOTIFIER", "1")
    return subprocess.run(
        ["gh", *args],
        cwd=repo,
        text=True,
        capture_output=True,
        env=env,
    )


def repo_flag() -> list[str]:
    name = os.environ.get("GITHUB_REPOSITORY", "").strip()
    if name:
        return ["--repo", name]
    return []


def list_open_pull_requests(repo: Path, branch: str, base: str) -> list[dict]:
    proc = gh(
        repo,
        [
            "pr",
            "list",
            *repo_flag(),
            "--head",
            branch,
            "--base",
            base,
            "--state",
            "open",
            "--limit",
            "50",
            "--json",
            "number,url,isDraft",
        ],
    )
    if proc.returncode != 0:
        raise SystemExit(
            "could not list pull requests: " + redact(proc.stderr or proc.stdout)
        )
    try:
        data = json.loads(proc.stdout or "[]")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"pull request list was not JSON: {exc}") from exc
    if not isinstance(data, list):
        raise SystemExit("pull request list was not a JSON array")
    return data


def create_draft(repo: Path, branch: str, base: str, body_file: Path) -> str:
    proc = gh(
        repo,
        [
            "pr",
            "create",
            *repo_flag(),
            "--draft",
            "--base",
            base,
            "--head",
            branch,
            "--title",
            PR_TITLE,
            "--body-file",
            str(body_file),
        ],
    )
    if proc.returncode != 0:
        detail = redact(proc.stderr or proc.stdout)
        hint = ""
        lowered = detail.lower()
        if "not permitted" in lowered or "create or approve" in lowered:
            hint = (
                "\nA person with admin rights needs to open Settings, "
                "Actions, General, Workflow permissions, and check "
                "Allow GitHub Actions to create and approve pull requests."
            )
        raise SystemExit(
            "could not open the draft pull request: " + detail + hint
        )
    return (proc.stdout or "").strip()


def update_body(repo: Path, number: int, body_file: Path) -> None:
    proc = gh(
        repo,
        [
            "pr",
            "edit",
            str(number),
            *repo_flag(),
            "--body-file",
            str(body_file),
        ],
    )
    if proc.returncode != 0:
        raise SystemExit(
            f"could not update pull request {number}: "
            + redact(proc.stderr or proc.stdout)
        )


def close_pull_request(repo: Path, number: int, comment: str) -> None:
    proc = gh(
        repo,
        [
            "pr",
            "close",
            str(number),
            *repo_flag(),
            "--comment",
            comment,
        ],
    )
    if proc.returncode != 0:
        raise SystemExit(
            f"could not close pull request {number}: "
            + redact(proc.stderr or proc.stdout)
        )


def comment_on_pull_request(repo: Path, number: int, body: str) -> None:
    proc = gh(
        repo,
        [
            "pr",
            "comment",
            str(number),
            *repo_flag(),
            "--body",
            body,
        ],
    )
    if proc.returncode != 0:
        raise SystemExit(
            f"could not comment on pull request {number}: "
            + redact(proc.stderr or proc.stdout)
        )


def duplicate_comment(keep: int) -> str:
    return (
        f"Closing this extra draft. The open pull request for this branch "
        f"is #{keep}. The workflow keeps a single draft and does not merge."
    )


def apply_plan(
    repo: Path,
    plan: Plan,
    branch: str,
    base: str,
    body_file: Path,
    *,
    mention_cursor: bool,
    cursor_body: str,
) -> None:
    if plan.action == "create":
        url = create_draft(repo, branch, base, body_file)
        print(f"Opened draft pull request {url}")
        open_prs = list_open_pull_requests(repo, branch, base)
        if mention_cursor and open_prs:
            comment_on_pull_request(repo, int(open_prs[0]["number"]), cursor_body)
            print(f"Commented {CURSOR_MENTION} on #{open_prs[0]['number']}")
        return
    if plan.action == "update" and plan.keep is not None:
        for number in plan.close:
            close_pull_request(repo, number, duplicate_comment(plan.keep))
            print(f"Closed extra draft #{number}")
        update_body(repo, plan.keep, body_file)
        print(f"Updated draft pull request #{plan.keep}")
        if mention_cursor:
            comment_on_pull_request(repo, plan.keep, cursor_body)
            print(f"Commented {CURSOR_MENTION} on #{plan.keep}")
        return
    raise SystemExit(f"unexpected plan {plan.action}")


def print_counts(threshold: int, stale: list[StaleEntry], newer: list[str]) -> None:
    print(
        f"Threshold: {threshold} days. Stale on develop: {len(stale)}. "
        f"Newer on branch: {len(newer)}."
    )


def previous_stale_ids(repo: Path, branch: str) -> set[str] | None:
    if not remote_branch_exists(repo, branch):
        return None
    try:
        previous = git_show_json(repo, f"origin/{branch}", REPORT_JSON)
    except SystemExit:
        return None
    return {
        row.get("id")
        for row in previous.get("stale", [])
        if isinstance(row, dict) and isinstance(row.get("id"), str)
    }


def run(args: argparse.Namespace) -> int:
    if args.dry_run and args.push:
        raise SystemExit("pass only one of --dry-run and --push")
    if not args.dry_run and not args.push:
        raise SystemExit(
            "Refusing to push. Pass --push to update the draft, "
            "or --dry-run to print the plan."
        )
    if args.base != BASE_BRANCH:
        raise SystemExit(
            "refusing to open a pull request against anything but develop"
        )
    destination_ref(args.branch)
    repo = args.repo_root.resolve()
    checked_on = date.today().isoformat()
    git(repo, ["fetch", "--no-tags", "origin", args.base])
    if args.regulations_file is not None:
        develop = load_json(args.regulations_file)
    else:
        develop = git_show_json(repo, f"origin/{args.base}", REGULATIONS_PATH)

    threshold, develop_stale = find_stale(develop)
    print_counts(threshold, develop_stale, [])
    if not develop_stale:
        body_preview = render_pull_request_body(
            report_payload(
                threshold=threshold,
                checked_on=checked_on,
                stale=[],
                newer_on_branch=[],
            )
        )
        if args.dry_run:
            print(body_preview)
            print(dry_run_plan(repo, args.branch, args.base, False))
            return 0
        return finish_clean(repo, args.branch, args.base)

    branch_regs: dict[str, Any] | None = None
    if remote_branch_exists(repo, args.branch):
        git(repo, ["fetch", "--no-tags", "origin", args.branch])
        try:
            branch_regs = git_show_json(
                repo, f"origin/{args.branch}", REGULATIONS_PATH
            )
        except SystemExit:
            branch_regs = None

    # Report remaining work on the automation branch when Cursor already
    # refreshed some dates there. Fall back to develop when the branch is new.
    source_for_report = branch_regs or develop
    _, remaining = find_stale(source_for_report)
    newer = ids_with_newer_verification(develop, source_for_report)
    payload = report_payload(
        threshold=threshold,
        checked_on=checked_on,
        stale=remaining,
        newer_on_branch=newer,
    )
    print(
        f"Remaining on branch view: {payload['stale_count']}. "
        f"Newer than develop: {len(newer)}."
    )

    body = render_pull_request_body(payload)
    if args.dry_run:
        print(body)
        print(dry_run_plan(repo, args.branch, args.base, True))
        return 0

    old_ids = previous_stale_ids(repo, args.branch)
    sync_git_branch(repo, args.branch, args.base, payload)
    with tempfile.TemporaryDirectory(prefix="regulations-stale-") as tmp_name:
        body_file = Path(tmp_name) / "pr-body.md"
        body_file.write_text(body, encoding="utf-8")
        open_prs = list_open_pull_requests(repo, args.branch, args.base)
        plan = plan_pull_request(open_prs, True)
        new_ids = {row["id"] for row in payload["stale"]}
        mention = payload["stale_count"] > 0 and (
            plan.action == "create" or old_ids != new_ids
        )
        apply_plan(
            repo,
            plan,
            args.branch,
            args.base,
            body_file,
            mention_cursor=mention,
            cursor_body=cursor_comment(payload),
        )
    return 0


def finish_clean(repo: Path, branch: str, base: str) -> int:
    print("No stale last_verified dates on develop.")
    plan = plan_pull_request(list_open_pull_requests(repo, branch, base), False)
    if plan.action == "skip":
        print("No pull request to open.")
        return 0
    for number in plan.close:
        close_pull_request(repo, number, CLOSE_CLEAN)
        print(f"Closed draft #{number}")
    return 0


def dry_run_plan(
    repo: Path, branch: str, base: str, open_draft: bool
) -> str:
    try:
        open_prs = list_open_pull_requests(repo, branch, base)
    except SystemExit as exc:
        return f"Dry run could not list pull requests: {exc}"
    plan = plan_pull_request(open_prs, open_draft)
    numbers = ", ".join(f"#{number}" for number in plan.close)
    kept = f" #{plan.keep}" if plan.keep is not None else ""
    extra = f" Close {numbers}." if numbers else ""
    return f"Dry run plan: {plan.action}{kept}.{extra}"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the summary and the plan. Do not push or edit a pull request.",
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="Push the automation branch and open or update the draft.",
    )
    parser.add_argument("--repo-root", type=Path, default=ROOT)
    parser.add_argument("--base", default=BASE_BRANCH)
    parser.add_argument("--branch", default=BOT_BRANCH)
    parser.add_argument(
        "--regulations-file",
        type=Path,
        help="Read this regulations.json instead of origin/develop.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    return run(parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
