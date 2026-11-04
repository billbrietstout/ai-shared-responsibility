#!/usr/bin/env python3
"""Refresh the whitepaper fixture and open or update one draft pull request.

The weekly workflow calls this script. It copies the public monitor export
into build/fixtures/whitepapers.json, writes the site_sync proposal under
reports/, and pushes branch automation/monitor-fixture-sync. The pull
request targets develop and stays a draft.

The script does not edit data/ai-agentic-principles.json. It does not push
develop, main, or master. It does not force-push. It does not merge.

  python3 scripts/monitor_sync_pr.py --dry-run
  python3 scripts/monitor_sync_pr.py --push
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sync_whitepapers_fixture as fixture  # noqa: E402


BOT_BRANCH = "automation/monitor-fixture-sync"
BASE_BRANCH = "develop"
CRON = "0 3 * * 3"
BOT_NAME = "github-actions[bot]"
BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com"
PR_TITLE = "Refresh the whitepaper fixture from the monitor"
PROTECTED_BRANCHES = frozenset({"develop", "main", "master"})
PUBLISHED_PATHS = (
    "build/fixtures/whitepapers.json",
    "reports/whitepapers-changes.json",
    "reports/principles-diff.md",
    "reports/ai-agentic-principles.candidate.json",
    "reports/ai-agentic-principles.slim.candidate.json",
)
CATALOG_PATH = "data/ai-agentic-principles.json"
_SEGMENT = re.compile(r"[A-Za-z0-9._-]+$")
_TOKEN = re.compile(r"(ghp_|github_pat_|gho_)[A-Za-z0-9_]+")

CLOSE_MATCHES = (
    "The monitor export matches the fixture on develop, so this draft "
    "has nothing new to review. The workflow closed it without merging."
)


class Plan:
    def __init__(self, action: str, keep: int | None, close: list[int]) -> None:
        self.action = action
        self.keep = keep
        self.close = close


def redact(text: str) -> str:
    text = re.sub(r"x-access-token:[^\s@]+", "x-access-token:REDACTED", text)
    return _TOKEN.sub(r"\1REDACTED", text)


def destination_ref(branch: str) -> str:
    """Return the only refspec this script is allowed to push."""
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


def plan_pull_request(open_prs: list[dict], fixture_changed: bool) -> Plan:
    numbers = sorted({int(pr["number"]) for pr in open_prs})
    if not fixture_changed:
        if not numbers:
            return Plan("skip", None, [])
        return Plan("close", None, numbers)
    if not numbers:
        return Plan("create", None, [])
    return Plan("update", numbers[0], numbers[1:])


def changed_source_codes(before: object, after: object) -> list[str]:
    if not isinstance(before, dict) or not isinstance(after, dict):
        raise SystemExit("catalog JSON must be an object")
    left = before.get("sources") if isinstance(before.get("sources"), dict) else {}
    right = after.get("sources") if isinstance(after.get("sources"), dict) else {}
    return [
        code
        for code in sorted(set(left) | set(right))
        if left.get(code) != right.get(code)
    ]


def clip_ids(ids: list[str], limit: int = 40) -> str:
    if not ids:
        return "None."
    shown = ", ".join(f"`{item}`" for item in ids[:limit])
    if len(ids) <= limit:
        return shown + "."
    return f"{shown}, and {len(ids) - limit} more."


def render_pull_request_body(
    summary: dict,
    *,
    monitor_repo: str,
    monitor_branch: str,
    checked_on: str,
    sources_changed: list[str],
) -> str:
    lines = [
        "## Summary",
        "",
        "This draft refreshes `build/fixtures/whitepapers.json` from the "
        "public monitor export and commits the catalog proposal under "
        "`reports/`.",
        "",
        "This pull request leaves `data/ai-agentic-principles.json` and "
        "`data/ai-agentic-principles.slim.json` unchanged. To accept a "
        "source change, review `reports/principles-diff.md` and copy "
        "`reports/ai-agentic-principles.candidate.json` into "
        "`data/ai-agentic-principles.json` in a separate pull request.",
        "",
        f"- Monitor repository: `{monitor_repo}`",
        f"- Monitor branch: `{monitor_branch}`",
        f"- Export date: {summary.get('updated') or '(missing)'}",
        f"- Papers on develop: {summary['baseline_count']}",
        f"- Papers in the monitor export: {summary['monitor_count']}",
        f"- Added: {len(summary['added'])}",
        f"- Modified: {len(summary['modified'])}",
        f"- Removed: {len(summary['removed'])}",
        f"- Checked: {checked_on}",
        "",
        "The full id lists are in `reports/whitepapers-changes.json`.",
        "",
        "## Added WP- ids",
        "",
        clip_ids(summary["added"]),
        "",
        "## Modified WP- ids",
        "",
        clip_ids(summary["modified"]),
        "",
        "## Removed WP- ids",
        "",
        clip_ids(summary["removed"]),
        "",
        "## Catalog proposal",
        "",
        "A paper with no site source code stays in the diff. The candidate "
        "gains a changed source row only for a WP- id that already has a "
        "site source code.",
        "",
    ]
    if sources_changed:
        lines.append(
            "Site source rows with a different body in the candidate: "
            + clip_ids(sources_changed)
        )
    else:
        lines.append(
            "No site source row in the candidate differs from "
            "`data/ai-agentic-principles.json` on develop. The candidate "
            "`updated` value is the monitor export date. Copying the "
            "candidate would change that date and would leave the source "
            "rows as they are."
        )
    if summary.get("metadata_only"):
        lines.extend(
            [
                "",
                "No paper id was added, modified, or removed. A top-level "
                "field in the export differs from the fixture on develop.",
            ]
        )
    lines.extend(
        [
            "",
            "## Review",
            "",
            "1. Read `reports/principles-diff.md`.",
            "2. GitHub holds the pull request workflows until someone with "
            "write access selects Approve workflows to run. That click "
            "starts `validate-principles`, `whitepapers-fixture`, and "
            "`verify`.",
            "3. This pull request stays a draft. The workflow does not "
            "merge it, does not enable auto-merge, and does not push to "
            "`develop` or `main`.",
            "4. Merge this draft after those checks pass to clear the "
            "fixture check on `develop`. Copy the candidate in its own "
            "pull request when you accept a source change.",
            "",
        ]
    )
    return "\n".join(lines)


def commit_message(summary: dict) -> str:
    return (
        "Refresh the whitepaper fixture from the monitor.\n"
        "\n"
        f"Papers on develop: {summary['baseline_count']}. "
        f"Papers in the monitor export: {summary['monitor_count']}.\n"
        f"Added: {len(summary['added'])}. "
        f"Modified: {len(summary['modified'])}. "
        f"Removed: {len(summary['removed'])}.\n"
    )


def write_changes(path: Path, summary: dict) -> None:
    payload = {
        "updated": summary["updated"],
        "changed": summary["changed"],
        "added": summary["added"],
        "modified": summary["modified"],
        "removed": summary["removed"],
        "baseline_count": summary["baseline_count"],
        "monitor_count": summary["monitor_count"],
        "metadata_only": summary["metadata_only"],
    }
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
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


def git_show_to(repo: Path, rev: str, path: str, dest: Path) -> None:
    proc = git(repo, ["show", f"{rev}:{path}"])
    dest.write_text(proc.stdout, encoding="utf-8")


def fetch_monitor(dest: Path, timeout: int) -> str:
    branch, err = fixture.resolve_default_branch(fixture.MONITOR_REPO, timeout)
    if branch is None:
        raise SystemExit(
            "could not resolve the monitor default branch: " + err
        )
    url = fixture.export_url(fixture.MONITOR_REPO, branch)
    command = [
        sys.executable,
        str(ROOT / "scripts" / "sync_whitepapers_fixture.py"),
        "--fixture",
        str(dest),
        "--url",
        url,
        "--timeout",
        str(timeout),
    ]
    proc = subprocess.run(command, text=True, capture_output=True)
    if proc.returncode != 0:
        raise SystemExit(redact(proc.stdout + "\n" + proc.stderr))
    check = subprocess.run(
        command[:2] + ["--check", *command[2:]],
        text=True,
        capture_output=True,
    )
    if check.returncode != 0:
        raise SystemExit(
            "refusing to open a pull request because the fixture check failed\n"
            + redact(check.stdout + "\n" + check.stderr)
        )
    return branch


def run_site_sync(
    whitepapers: Path, changes: Path, agentic: Path, out_dir: Path
) -> None:
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "site_sync.py"),
            "--whitepapers",
            str(whitepapers),
            "--changes",
            str(changes),
            "--agentic",
            str(agentic),
            "--out-dir",
            str(out_dir),
        ],
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise SystemExit(redact(proc.stdout + "\n" + proc.stderr))


def place_proposal(
    repo: Path, fixture_path: Path, changes_path: Path, out_dir: Path
) -> None:
    mapping = {
        PUBLISHED_PATHS[0]: fixture_path,
        PUBLISHED_PATHS[1]: changes_path,
        PUBLISHED_PATHS[2]: out_dir / "principles-diff.md",
        PUBLISHED_PATHS[3]: out_dir / "ai-agentic-principles.candidate.json",
        PUBLISHED_PATHS[4]: out_dir
        / "ai-agentic-principles.slim.candidate.json",
    }
    for rel, src in mapping.items():
        if not src.is_file():
            raise SystemExit(f"missing proposal file {src}")
        dest = repo / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)


def resolve_merge_conflicts(repo: Path, base: str, merge: subprocess.CompletedProcess[str]) -> None:
    conflicts = [
        line
        for line in git(
            repo, ["diff", "--name-only", "--diff-filter=U"]
        ).stdout.splitlines()
        if line
    ]
    if not conflicts or any(path not in PUBLISHED_PATHS for path in conflicts):
        git(repo, ["merge", "--abort"], check=False)
        raise SystemExit(
            "merge from develop conflicted outside the fixture and the "
            "proposal files: "
            + ", ".join(conflicts)
            + "\n"
            + redact(merge.stdout + "\n" + merge.stderr)
        )
    git(repo, ["checkout", f"origin/{base}", "--", *conflicts])
    git(repo, ["add", "--", *conflicts])
    git(repo, ["commit", "--no-edit"])


def sync_git_branch(
    repo: Path,
    branch: str,
    base: str,
    fixture_path: Path,
    changes_path: Path,
    out_dir: Path,
    summary: dict,
) -> None:
    status = git(repo, ["status", "--porcelain"])
    if status.stdout.strip():
        raise SystemExit("repository is not clean; refusing to commit")
    configure_identity(repo)
    if remote_branch_exists(repo, branch):
        git(repo, ["fetch", "--no-tags", "origin", branch])
        git(repo, ["checkout", "-B", branch, f"origin/{branch}"])
        merge = git(repo, ["merge", "--no-edit", f"origin/{base}"], check=False)
        if merge.returncode != 0:
            resolve_merge_conflicts(repo, base, merge)
    else:
        git(repo, ["checkout", "-B", branch, f"origin/{base}"])
    place_proposal(repo, fixture_path, changes_path, out_dir)
    git(repo, ["add", "-f", "--", *PUBLISHED_PATHS])
    staged = [
        line
        for line in git(repo, ["diff", "--cached", "--name-only"]).stdout.splitlines()
        if line
    ]
    assert_paths_allowed(staged)
    quiet = git(repo, ["diff", "--cached", "--quiet"], check=False)
    if quiet.returncode == 1:
        message = repo / ".git" / "monitor-sync-message.txt"
        message.write_text(commit_message(summary), encoding="utf-8")
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
    assert_paths_allowed(changed_tree)
    if any(path == CATALOG_PATH or path.startswith("data/") for path in changed_tree):
        raise SystemExit("refusing to publish a data/ change")
    head = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    if head != branch:
        raise SystemExit(f"refusing to push from {head}")
    local = git(repo, ["rev-parse", "HEAD"]).stdout.strip()
    if remote_sha(repo, branch) == local:
        print(f"Branch {branch} already matches the proposal.")
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


def duplicate_comment(keep: int) -> str:
    return (
        f"Closing this extra draft. The open pull request for this branch "
        f"is #{keep}. The workflow keeps a single draft and does not merge."
    )


def apply_plan(repo: Path, plan: Plan, branch: str, base: str, body_file: Path) -> None:
    if plan.action == "create":
        url = create_draft(repo, branch, base, body_file)
        print(f"Opened draft pull request {url}")
        return
    if plan.action == "update" and plan.keep is not None:
        for number in plan.close:
            close_pull_request(repo, number, duplicate_comment(plan.keep))
            print(f"Closed extra draft #{number}")
        update_body(repo, plan.keep, body_file)
        print(f"Updated draft pull request #{plan.keep}")
        return
    raise SystemExit(f"unexpected plan {plan.action}")


def load_json(path: Path) -> object:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def print_counts(summary: dict) -> None:
    print(
        "Papers on develop: "
        f"{summary['baseline_count']}. Monitor papers: "
        f"{summary['monitor_count']}. Added: {len(summary['added'])}. "
        f"Modified: {len(summary['modified'])}. "
        f"Removed: {len(summary['removed'])}."
    )


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
    if (args.baseline_file is None) != (args.monitor_file is None):
        raise SystemExit(
            "pass both --baseline-file and --monitor-file, or neither"
        )
    repo = args.repo_root.resolve()
    with tempfile.TemporaryDirectory(prefix="monitor-sync-") as tmp_name:
        tmp = Path(tmp_name)
        baseline_path = tmp / "baseline.json"
        monitor_path = tmp / "monitor.json"
        git(repo, ["fetch", "--no-tags", "origin", args.base])
        if args.baseline_file is not None:
            shutil.copyfile(args.baseline_file, baseline_path)
            shutil.copyfile(args.monitor_file, monitor_path)
            monitor_branch = args.monitor_branch or "local file"
        else:
            git_show_to(
                repo,
                f"origin/{args.base}",
                PUBLISHED_PATHS[0],
                baseline_path,
            )
            monitor_branch = fetch_monitor(monitor_path, args.timeout)
        try:
            summary = fixture.classify_paper_changes(
                load_json(baseline_path), load_json(monitor_path)
            )
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
        if not summary["updated"]:
            summary["updated"] = date.today().isoformat()
        print_counts(summary)
        if not summary["fixture_changed"]:
            return finish_unchanged(args, repo)
        agentic_path = tmp / "agentic.json"
        git_show_to(repo, f"origin/{args.base}", CATALOG_PATH, agentic_path)
        changes_path = tmp / "whitepapers-changes.json"
        write_changes(changes_path, summary)
        out_dir = tmp / "out"
        run_site_sync(monitor_path, changes_path, agentic_path, out_dir)
        sources_changed = changed_source_codes(
            load_json(agentic_path),
            load_json(out_dir / "ai-agentic-principles.candidate.json"),
        )
        body = render_pull_request_body(
            summary,
            monitor_repo=fixture.MONITOR_REPO,
            monitor_branch=monitor_branch,
            checked_on=date.today().isoformat(),
            sources_changed=sources_changed,
        )
        if args.dry_run:
            print(body)
            print(dry_run_plan(repo, args.branch, args.base, True))
            return 0
        sync_git_branch(
            repo,
            args.branch,
            args.base,
            monitor_path,
            changes_path,
            out_dir,
            summary,
        )
        body_file = tmp / "pr-body.md"
        body_file.write_text(body, encoding="utf-8")
        plan = plan_pull_request(
            list_open_pull_requests(repo, args.branch, args.base), True
        )
        apply_plan(repo, plan, args.branch, args.base, body_file)
    return 0


def finish_unchanged(args: argparse.Namespace, repo: Path) -> int:
    print("The fixture on develop matches the monitor export.")
    if args.dry_run:
        print(dry_run_plan(repo, args.branch, args.base, False))
        return 0
    plan = plan_pull_request(
        list_open_pull_requests(repo, args.branch, args.base), False
    )
    if plan.action == "skip":
        print("No pull request to open.")
        return 0
    for number in plan.close:
        close_pull_request(repo, number, CLOSE_MATCHES)
        print(f"Closed draft #{number}")
    return 0


def dry_run_plan(
    repo: Path, branch: str, base: str, fixture_changed: bool
) -> str:
    try:
        open_prs = list_open_pull_requests(repo, branch, base)
    except SystemExit as exc:
        return f"Dry run could not list pull requests: {exc}"
    plan = plan_pull_request(open_prs, fixture_changed)
    numbers = ", ".join(f"#{number}" for number in plan.close)
    kept = f" #{plan.keep}" if plan.keep is not None else ""
    extra = f" Close {numbers}." if numbers else ""
    return f"Dry run plan: {plan.action}{kept}.{extra}"


def parse_args(argv: list[str] | None) -> argparse.Namespace:
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
    parser.add_argument("--baseline-file", type=Path)
    parser.add_argument("--monitor-file", type=Path)
    parser.add_argument("--monitor-branch", default="")
    parser.add_argument("--timeout", type=int, default=60)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    return run(parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
