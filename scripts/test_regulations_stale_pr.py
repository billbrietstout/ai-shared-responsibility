#!/usr/bin/env python3
"""Unit tests for scripts/regulations_stale_pr.py.

Run from the repo root:

  python3 scripts/test_regulations_stale_pr.py
"""

from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import regulations_stale_pr as rsp  # noqa: E402


class RegulationsStalePrTests(unittest.TestCase):
    def test_find_stale_uses_threshold(self):
        payload = {
            "stale_threshold_days": 180,
            "items": [
                {
                    "id": "fresh",
                    "name": "Fresh",
                    "url": "https://example.com/fresh",
                    "version": "1",
                    "last_verified": "2026-10-01",
                    "depth": "full",
                    "body": "X",
                },
                {
                    "id": "stale",
                    "name": "Stale",
                    "url": "https://example.com/stale",
                    "version": "1",
                    "last_verified": "2026-01-01",
                    "depth": "full",
                    "body": "Y",
                },
                {
                    "id": "reference-only",
                    "name": "Reference",
                    "url": "https://example.com/ref",
                    "version": "1",
                    "depth": "reference",
                    "verification_status": "unverified",
                },
            ],
        }
        threshold, stale = rsp.find_stale(payload, today=date(2026, 11, 12))
        self.assertEqual(threshold, 180)
        self.assertEqual([row.id for row in stale], ["stale"])
        self.assertEqual(stale[0].age_days, 315)

    def test_ids_with_newer_verification(self):
        develop = {
            "items": [
                {"id": "a", "last_verified": "2026-01-01"},
                {"id": "b", "last_verified": "2026-05-01"},
            ]
        }
        branch = {
            "items": [
                {"id": "a", "last_verified": "2026-11-12"},
                {"id": "b", "last_verified": "2026-05-01"},
            ]
        }
        self.assertEqual(
            rsp.ids_with_newer_verification(develop, branch), ["a"]
        )

    def test_plan_reuses_one_pull_request(self):
        def prs(*numbers):
            return [{"number": number} for number in numbers]

        self.assertEqual(rsp.plan_pull_request([], False).action, "skip")
        closed = rsp.plan_pull_request(prs(4, 2), False)
        self.assertEqual(closed.action, "close")
        self.assertEqual(closed.close, [2, 4])
        created = rsp.plan_pull_request([], True)
        self.assertEqual(created.action, "create")
        updated = rsp.plan_pull_request(prs(9, 3), True)
        self.assertEqual(updated.action, "update")
        self.assertEqual(updated.keep, 3)
        self.assertEqual(updated.close, [9])

    def test_destination_ref_blocks_protected_branches(self):
        self.assertEqual(
            rsp.destination_ref("automation/regulations-stale-check"),
            "refs/heads/automation/regulations-stale-check",
        )
        with self.assertRaises(SystemExit):
            rsp.destination_ref("develop")
        with self.assertRaises(SystemExit):
            rsp.destination_ref("automation/main")
        with self.assertRaises(SystemExit):
            rsp.destination_ref("feature/regulations-stale-check")

    def test_unexpected_paths_are_refused(self):
        with self.assertRaises(SystemExit):
            rsp.assert_paths_allowed(["data/regulations.json"])
        with self.assertRaises(SystemExit):
            rsp.assert_paths_allowed(["README.md"])
        rsp.assert_paths_allowed([])
        rsp.assert_paths_allowed(list(rsp.PUBLISHED_PATHS))

    def test_pull_request_body_mentions_cursor_and_docs(self):
        payload = rsp.report_payload(
            threshold=180,
            checked_on="2026-11-12",
            stale=[
                rsp.StaleEntry(
                    id="nist-ai-rmf",
                    name="NIST AI RMF",
                    url="https://example.com",
                    version="1.0",
                    last_verified="2026-05-15",
                    age_days=181,
                    depth="full",
                    body="NIST",
                )
            ],
            newer_on_branch=["eu-ai-act"],
        )
        body = rsp.render_pull_request_body(payload)
        self.assertTrue(body.startswith("@cursor"))
        self.assertIn("`nist-ai-rmf`", body)
        self.assertIn("`eu-ai-act`", body)
        self.assertIn(rsp.DOCS_PATH, body)
        self.assertIn(rsp.REGULATIONS_PATH, body)
        self.assertIn("Do not bump a date without opening the source", body)
        self.assertNotIn("\u2014", body)
        self.assertNotIn("\u2013", body)
        comment = rsp.cursor_comment(payload)
        self.assertTrue(comment.startswith("@cursor"))
        self.assertIn("`nist-ai-rmf`", comment)

    def test_report_markdown_lists_rows(self):
        payload = rsp.report_payload(
            threshold=180,
            checked_on="2026-11-12",
            stale=[
                rsp.StaleEntry(
                    id="gdpr",
                    name="GDPR",
                    url="https://gdpr-info.eu/",
                    version="2016/679",
                    last_verified="2026-05-15",
                    age_days=181,
                    depth="full",
                    body="EU",
                )
            ],
            newer_on_branch=[],
        )
        md = rsp.render_report_markdown(payload)
        self.assertIn("`gdpr`", md)
        self.assertIn("https://gdpr-info.eu/", md)
        self.assertIn("181", md)

    def test_workflow_is_least_privilege_and_scheduled(self):
        workflow = (
            ROOT / ".github" / "workflows" / "regulations-stale-check.yml"
        ).read_text(encoding="utf-8")
        doc = (ROOT / "docs" / "regulations-verification.md").read_text(
            encoding="utf-8"
        )
        source = Path(rsp.__file__).read_text(encoding="utf-8")
        self.assertIn(f'cron: "{rsp.CRON}"', workflow)
        self.assertIn(rsp.CRON, doc)
        self.assertIn(rsp.BOT_BRANCH, doc)
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("contents: write", workflow)
        self.assertIn("pull-requests: write", workflow)
        self.assertNotIn("contents: read", workflow.split("permissions:", 1)[1][:200])
        self.assertIn("@cursor", source)
        self.assertIn("@cursor", doc)
        self.assertIn("reports/regulations-stale.json", doc)
        self.assertIn("does not bump", (workflow + doc).lower())


if __name__ == "__main__":
    unittest.main()
