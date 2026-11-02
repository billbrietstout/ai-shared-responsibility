#!/usr/bin/env python3
"""Unit tests for principle grace rules and the whitepaper fixture check.

Run from the repo root:

  python3 scripts/test_data_flow_checks.py
"""

from __future__ import annotations

import html
import importlib.util
import json
import os
import re
import subprocess
import sys
import unittest
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sync_whitepapers_fixture as fixture  # noqa: E402
import validate_principles as vp  # noqa: E402


TODAY = date(2026, 10, 31)
AFTER_GRACE = date(2026, 12, 1)


def catalog(sources: dict, principles: list) -> dict:
    return {
        "$schema_version": "1.0",
        "updated": "2026-10-31",
        "count": len(principles),
        "sources": sources,
        "sections": {"s": {"n": 1, "title": "S"}},
        "principles": principles,
    }


def source(**extra) -> dict:
    row = {
        "title": "Paper",
        "org": "Org",
        "date": "2026",
        "url": "https://example.com/paper",
        "wp_id": "WP-0001",
        "inventory_status": "matched",
    }
    row.update(extra)
    return row


def principle(pid: str = "p1", **extra) -> dict:
    row = {
        "id": pid,
        "section": "s",
        "category": "c",
        "statement": extra.pop(
            "statement", "training data must be signed before use"
        ),
        "src": extra.pop("src", ["SRC"]),
    }
    row.update(extra)
    return row


PAPER = {
    "id": "WP-0001",
    "issue": 7,
    "decision": "Include",
    "title": "Paper",
    "axioms": ["training data must be signed before use"],
    "invariables": [],
    "principles": [],
}


def run_agentic(data, papers, today, grandfather):
    report = vp.Report()
    vp.validate_agentic(
        data,
        papers,
        report,
        today=today,
        grandfather_ids=grandfather,
    )
    return report


class GraceRulesTest(unittest.TestCase):
    def test_grace_date_is_thirty_days_after_2026_10_31(self):
        self.assertEqual(vp.GRACE_DATE, date(2026, 11, 30))
        self.assertFalse(vp.grace_lapsed(vp.GRACE_DATE))
        self.assertTrue(vp.grace_lapsed(AFTER_GRACE))

    def test_unmatched_warns_before_grace_and_errors_after(self):
        src = source(
            wp_id=None,
            inventory_status="unmatched",
            inventory_note="Talk, not yet in the monitor.",
        )
        data = catalog({"SRC": src}, [principle()])
        before = run_agentic(data, {"WP-0001": PAPER}, TODAY, {"p1"})
        self.assertEqual(before.errors, [])
        self.assertTrue(any("unmatched" in msg for msg in before.warnings))

        after = run_agentic(data, {"WP-0001": PAPER}, AFTER_GRACE, {"p1"})
        self.assertTrue(any("unmatched" in msg for msg in after.errors))

    def test_conference_talk_unmatched_stays_info_after_grace(self):
        src = source(
            wp_id=None,
            inventory_status="unmatched",
            inventory_note="Conference talk at [un]prompted II (October 2026).",
            type="conference-talk",
            speaker="Ada Speaker",
            title="Who authorized the agent",
            org="[un]prompted II",
            url="https://unpromptedcon.org",
        )
        data = catalog(
            {"UNPROMPTED2-X": src},
            [
                principle(
                    src=["UNPROMPTED2-X"],
                    risks=["agent acts without a recorded decision"],
                    obligations=["return the reason when a policy blocks the agent"],
                )
            ],
        )
        report = run_agentic(data, {}, AFTER_GRACE, {"p1"})
        self.assertEqual(report.errors, [])
        self.assertFalse(any("unmatched" in msg for msg in report.warnings))
        self.assertFalse(any("monitor_issue" in msg for msg in report.warnings))
        self.assertEqual(len(report.infos), 1)
        self.assertIn("conference-talk", report.infos[0])

    def test_conference_talk_requires_speaker_and_note(self):
        src = source(
            wp_id=None,
            inventory_status="unmatched",
            type="conference-talk",
            title="A talk",
            org="[un]prompted",
            url="https://unpromptedcon.org/abstract-march2026/",
        )
        src.pop("inventory_note", None)
        data = catalog(
            {"UNPROMPTED1-X": src},
            [
                principle(
                    src=["UNPROMPTED1-X"],
                    risks=["r"],
                    obligations=["o"],
                )
            ],
        )
        report = run_agentic(data, {}, AFTER_GRACE, {"p1"})
        self.assertTrue(any("speaker" in msg for msg in report.errors))
        self.assertTrue(any("inventory_note" in msg for msg in report.errors))
        self.assertFalse(any("Grace ended" in msg for msg in report.errors))

    def test_conference_talk_without_wp_id_is_not_a_matched_error(self):
        src = source(
            wp_id=None,
            inventory_status="matched",
            inventory_note="Talk, recorded outside the monitor.",
            type="conference-talk",
            speaker="Ada Speaker",
            title="A talk",
            org="[un]prompted",
            url="https://unpromptedcon.org",
        )
        data = catalog(
            {"UNPROMPTED1-Y": src},
            [principle(src=["UNPROMPTED1-Y"], risks=["r"], obligations=["o"])],
        )
        report = run_agentic(data, {}, TODAY, {"p1"})
        self.assertEqual(report.errors, [])
        self.assertFalse(any("wp_id" in msg for msg in report.warnings))

    def test_editorial_position_marker_does_not_weaken_source_checks(self):
        editorial = principle(
            pid="who-asked",
            src=["editorial-position"],
            statement="Each agent action must record three things",
            note=(
                "Editorial position of this document, not a source citation."
            ),
            risks=["a request can keep acting after the approver leaves"],
            obligations=[
                "the agent refuses an action that arrives without the three facts"
            ],
        )
        data = catalog(
            {"SRC": source()},
            [principle(risks=["extraction"], obligations=["log it"]), editorial],
        )
        report = run_agentic(data, {"WP-0001": PAPER}, AFTER_GRACE, set())
        self.assertEqual(report.errors, [])
        self.assertFalse(
            any("does not resolve" in msg for msg in report.errors)
        )
        self.assertFalse(
            any("who-asked" in msg and "support" in msg for msg in report.warnings)
        )
        self.assertFalse(
            any("support score 0.00" in msg for msg in report.errors)
        )

        missing_note = principle(
            pid="who-asked",
            src=["editorial-position"],
            risks=["r"],
            obligations=["o"],
        )
        report = run_agentic(
            catalog({}, [missing_note]), {}, AFTER_GRACE, set()
        )
        self.assertTrue(any("editorial position" in msg for msg in report.errors))

        bad = principle(
            pid="p9",
            src=["NOT-A-PAPER"],
            risks=["r"],
            obligations=["o"],
        )
        report = run_agentic(catalog({}, [bad]), {}, AFTER_GRACE, set())
        self.assertTrue(any("does not resolve" in msg for msg in report.errors))

        unmatched = source(
            wp_id=None,
            inventory_status="unmatched",
            inventory_note="not in the monitor",
        )
        mixed = catalog(
            {"SRC": unmatched},
            [
                principle(src=["SRC"], risks=["r"], obligations=["o"]),
                editorial,
            ],
        )
        report = run_agentic(mixed, {}, AFTER_GRACE, {"p1", "who-asked"})
        self.assertTrue(any("SRC" in msg and "unmatched" in msg for msg in report.errors))
        self.assertFalse(
            any("editorial-position" in msg and "unmatched" in msg for msg in report.errors)
        )

    def test_pending_add_stays_a_warning_after_grace(self):
        src = source(
            wp_id=None,
            inventory_status="pending_add",
            inventory_note="Filed, waiting for a WP- id.",
        )
        data = catalog({"SRC": src}, [principle()])
        report = run_agentic(data, {}, AFTER_GRACE, {"p1"})
        self.assertFalse(any("pending_add" in msg for msg in report.errors))
        self.assertTrue(any("pending_add" in msg for msg in report.warnings))

    def test_empty_risks_and_obligations_follow_the_grace_date(self):
        data = catalog({"SRC": source()}, [principle()])
        before = run_agentic(data, {"WP-0001": PAPER}, TODAY, {"p1"})
        self.assertEqual(before.errors, [])
        self.assertTrue(any("risks, obligations" in msg for msg in before.warnings))

        filled = catalog(
            {"SRC": source()},
            [
                principle(
                    risks=["model extraction"],
                    obligations=["log the access decision"],
                )
            ],
        )
        ok = run_agentic(filled, {"WP-0001": PAPER}, AFTER_GRACE, {"p1"})
        self.assertFalse(any("risks" in msg for msg in ok.errors))
        self.assertFalse(any("obligations" in msg for msg in ok.warnings))

        after = run_agentic(data, {"WP-0001": PAPER}, AFTER_GRACE, {"p1"})
        self.assertTrue(any("risks, obligations" in msg for msg in after.errors))

    def test_bad_risk_type_is_always_an_error(self):
        data = catalog({"SRC": source()}, [principle(risks="model extraction")])
        report = run_agentic(data, {"WP-0001": PAPER}, TODAY, {"p1"})
        self.assertTrue(any("risks must be an array" in msg for msg in report.errors))

    def test_monitor_issue_must_match_the_fixture(self):
        bad = catalog(
            {"SRC": source(monitor_issue="7")},
            [principle()],
        )
        report = run_agentic(bad, {"WP-0001": PAPER}, TODAY, {"p1"})
        self.assertTrue(any("monitor_issue must be" in msg for msg in report.errors))

        mismatch = catalog(
            {"SRC": source(monitor_issue=8)},
            [principle()],
        )
        report = run_agentic(mismatch, {"WP-0001": PAPER}, TODAY, {"p1"})
        self.assertTrue(any("does not match fixture issue" in msg for msg in report.errors))

        ok = catalog(
            {"SRC": source(monitor_issue=7)},
            [principle(risks=["extraction"], obligations=["log it"])],
        )
        report = run_agentic(ok, {"WP-0001": PAPER}, TODAY, {"p1"})
        self.assertEqual(report.errors, [])
        self.assertFalse(any("no monitor_issue" in msg for msg in report.warnings))

    def test_monitor_schema_fields_are_accepted(self):
        paper = {
            "wp_id": "WP-0001",
            "issue_number": 7,
            "source_org": "Org",
            "decision": "include",
            "title": "Paper",
            "axioms": ["training data must be signed before use"],
            "invariables": [],
            "principles": [],
        }
        ok = catalog(
            {"SRC": source(monitor_issue=7)},
            [principle(risks=["extraction"], obligations=["log it"])],
        )
        report = run_agentic(ok, {"WP-0001": paper}, TODAY, {"p1"})
        self.assertEqual(report.errors, [])

        retired = dict(paper)
        retired["decision"] = "delete_candidate"
        report = run_agentic(ok, {"WP-0001": retired}, TODAY, {"p1"})
        self.assertTrue(any("must be include" in msg for msg in report.errors))

        loaded = vp.load_papers(ROOT / "build" / "fixtures" / "whitepapers.json")
        self.assertIn("WP-0001", loaded)
        self.assertTrue(
            loaded["WP-0001"].get("wp_id") or loaded["WP-0001"].get("id")
        )

    def test_missing_monitor_issue_is_a_summary_warning(self):
        data = catalog({"SRC": source()}, [principle()])
        report = run_agentic(data, {"WP-0001": PAPER}, TODAY, {"p1"})
        self.assertTrue(any("no monitor_issue" in msg for msg in report.warnings))
        self.assertEqual(report.errors, [])

    def test_zero_support_errors_only_for_new_principles(self):
        papers = {
            "WP-0001": {
                **PAPER,
                "axioms": ["aaaa"],
            }
        }
        data = catalog(
            {"SRC": source()},
            [principle(statement="bbbb")],
        )
        old = run_agentic(data, papers, TODAY, {"p1"})
        self.assertEqual(old.errors, [])
        self.assertTrue(any("support weak" in msg for msg in old.warnings))

        new = run_agentic(data, papers, TODAY, set())
        self.assertTrue(
            any("support score 0.00 for new principle p1" in msg for msg in new.errors)
        )

        # A new principle whose statement matches the paper is not a 0.00 error.
        matched = catalog(
            {"SRC": source()},
            [principle(pid="p2", statement="aaaa")],
        )
        report = run_agentic(matched, papers, TODAY, set())
        self.assertFalse(any("support score 0.00" in msg for msg in report.errors))

        # No extracted text: warn, and leave the grace-dated unmatched check
        # to cover sources that are not in the monitor yet.
        empty_papers = {
            "WP-0001": {**PAPER, "axioms": [], "invariables": [], "principles": []}
        }
        empty = run_agentic(data, empty_papers, TODAY, set())
        self.assertFalse(any("support score 0.00" in msg for msg in empty.errors))
        self.assertTrue(any("support weak" in msg for msg in empty.warnings))

    def test_unknown_baseline_does_not_fail_zero_support(self):
        papers = {"WP-0001": {**PAPER, "axioms": ["aaaa"]}}
        data = catalog({"SRC": source()}, [principle(statement="bbbb")])
        report = run_agentic(data, papers, TODAY, None)
        self.assertEqual(report.errors, [])
        self.assertTrue(any("no base catalog" in msg for msg in report.warnings))


class FixtureCheckTest(unittest.TestCase):
    def test_max_age_is_14_days(self):
        self.assertEqual(fixture.MAX_FIXTURE_AGE_DAYS, 14)

    def test_default_branch_comes_from_the_api_payload(self):
        self.assertEqual(
            fixture.default_branch_from_payload({"default_branch": "master"}),
            "master",
        )
        self.assertEqual(
            fixture.default_branch_from_payload({"default_branch": "main"}),
            "main",
        )
        self.assertIsNone(
            fixture.default_branch_from_payload({"default_branch": "main/../x"})
        )
        self.assertIsNone(fixture.default_branch_from_payload({}))
        url = fixture.export_url(fixture.MONITOR_REPO, "master")
        self.assertEqual(
            url,
            "https://raw.githubusercontent.com/billbrietstout/"
            "ai-security-whitepaper-monitor/master/data/whitepapers.json",
        )
        source = Path(fixture.__file__).read_text()
        self.assertNotIn("/main/data/whitepapers.json", source)

    def test_token_is_sent_only_to_the_github_api(self):
        old = os.environ.get("GITHUB_TOKEN")
        os.environ["GITHUB_TOKEN"] = "secret-token"
        try:
            api = fixture._request_headers(
                "https://api.github.com/repos/billbrietstout/ai-security-whitepaper-monitor"
            )
            raw = fixture._request_headers(
                fixture.export_url(fixture.MONITOR_REPO, "master")
            )
        finally:
            if old is None:
                os.environ.pop("GITHUB_TOKEN", None)
            else:
                os.environ["GITHUB_TOKEN"] = old
        self.assertEqual(api.get("Authorization"), "Bearer secret-token")
        self.assertNotIn("Authorization", raw)

    def local(self, updated="2026-10-30", papers=None):
        return {
            "updated": updated,
            "count": 1,
            "papers": papers
            if papers is not None
            else [{"id": "WP-0001", "issue": 1, "title": "A"}],
        }

    def test_missing_remote_warns_and_still_checks_age(self):
        fetched = fixture.FetchResult("missing", None, "HTTP 404")
        errors, warnings = fixture.evaluate(
            self.local(),
            fetched,
            today=TODAY,
            max_age_days=14,
            url=fixture.export_url(fixture.MONITOR_REPO, "master"),
        )
        self.assertEqual(errors, [])
        self.assertTrue(any("not published" in msg for msg in warnings))
        self.assertFalse(any(" on main" in msg for msg in warnings))

        errors, warnings = fixture.evaluate(
            self.local(updated="2026-10-01"),
            fetched,
            today=TODAY,
            max_age_days=14,
            url=fixture.export_url(fixture.MONITOR_REPO, "master"),
        )
        self.assertTrue(any("days old" in msg for msg in errors))
        self.assertTrue(any("not published" in msg for msg in warnings))

    def test_age_boundary(self):
        fetched = fixture.FetchResult("missing", None, "HTTP 404")
        errors, _ = fixture.evaluate(
            self.local(updated="2026-10-17"),
            fetched,
            today=TODAY,
            max_age_days=14,
            url="http://example.test/whitepapers.json",
        )
        self.assertEqual(errors, [])
        errors, _ = fixture.evaluate(
            self.local(updated="2026-10-16"),
            fetched,
            today=TODAY,
            max_age_days=14,
            url="http://example.test/whitepapers.json",
        )
        self.assertTrue(errors)

    def test_content_mismatch_is_an_error(self):
        local = self.local()
        remote = self.local(papers=[{"id": "WP-0002", "issue": 2, "title": "B"}])
        body = json.dumps(remote).encode()
        fetched = fixture.FetchResult("ok", body, "HTTP 200")
        errors, warnings = fixture.evaluate(
            local,
            fetched,
            today=TODAY,
            max_age_days=14,
            url="http://example.test/whitepapers.json",
        )
        self.assertEqual(warnings, [])
        self.assertTrue(any("WP-0002" in msg and "WP-0001" in msg for msg in errors))

    def test_same_json_different_key_order_passes(self):
        local = {"updated": "2026-10-30", "papers": [{"id": "WP-0001", "issue": 1}]}
        remote = {"papers": [{"issue": 1, "id": "WP-0001"}], "updated": "2026-10-30"}
        fetched = fixture.FetchResult(
            "ok", json.dumps(remote).encode(), "HTTP 200"
        )
        errors, warnings = fixture.evaluate(
            local,
            fetched,
            today=TODAY,
            max_age_days=14,
            url="http://example.test/whitepapers.json",
        )
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_wp_id_counts_as_a_paper(self):
        local = self.local()
        remote = {
            "updated": "2026-10-30",
            "papers": [{"wp_id": "WP-0001", "issue_number": 1, "title": "A"}],
        }
        fetched = fixture.FetchResult(
            "ok", json.dumps(remote).encode(), "HTTP 200"
        )
        errors, warnings = fixture.evaluate(
            local,
            fetched,
            today=TODAY,
            max_age_days=14,
            url="http://example.test/whitepapers.json",
        )
        self.assertEqual(warnings, [])
        self.assertTrue(any("fixture differs" in msg for msg in errors))
        self.assertTrue(any("Monitor papers: 1" in msg for msg in errors))
        self.assertFalse(any("Monitor papers: 0" in msg for msg in errors))

    def test_zero_paper_records_are_not_a_content_diff(self):
        remote = {"updated": "2026-10-30", "papers": []}
        fetched = fixture.FetchResult(
            "ok", json.dumps(remote).encode(), "HTTP 200"
        )
        errors, warnings = fixture.evaluate(
            self.local(),
            fetched,
            today=TODAY,
            max_age_days=14,
            url="http://example.test/whitepapers.json",
        )
        self.assertEqual(warnings, [])
        self.assertTrue(any("no usable paper ids" in msg for msg in errors))
        self.assertTrue(any("Paper records: 0" in msg for msg in errors))
        self.assertFalse(any("fixture differs" in msg for msg in errors))

    def test_records_without_an_id_are_not_a_content_diff(self):
        remote = {
            "updated": "2026-10-30",
            "papers": [{"title": "A", "url": "https://example.test/a"}],
        }
        fetched = fixture.FetchResult(
            "ok", json.dumps(remote).encode(), "HTTP 200"
        )
        errors, _ = fixture.evaluate(
            self.local(),
            fetched,
            today=TODAY,
            max_age_days=14,
            url="http://example.test/whitepapers.json",
        )
        self.assertTrue(any("no usable paper ids" in msg for msg in errors))
        self.assertTrue(any("Paper records: 1" in msg for msg in errors))
        self.assertTrue(any("title" in msg for msg in errors))
        self.assertFalse(any("fixture differs" in msg for msg in errors))
        self.assertFalse(any("In the fixture only" in msg for msg in errors))

    def test_fetch_error_fails_the_check(self):
        fetched = fixture.FetchResult("error", None, "timed out")
        errors, _ = fixture.evaluate(
            self.local(),
            fetched,
            today=TODAY,
            max_age_days=14,
            url="http://example.test/whitepapers.json",
        )
        self.assertTrue(any("could not fetch" in msg for msg in errors))


class SchemaAndCatalogTest(unittest.TestCase):
    def test_schema_accepts_current_catalogs_and_new_fields(self):
        import jsonschema

        schema = json.loads(
            (ROOT / "schemas" / "principles.schema.json").read_text()
        )
        agentic = json.loads(
            (ROOT / "data" / "ai-agentic-principles.json").read_text()
        )
        classic = json.loads(
            (ROOT / "data" / "security-principles.json").read_text()
        )
        jsonschema.validate(instance=agentic, schema=schema)
        jsonschema.validate(instance=classic, schema=schema)

        agentic["sources"]["CIS-AGENTS"]["monitor_issue"] = 7
        agentic["principles"][0]["risks"] = ["model extraction"]
        agentic["principles"][0]["obligations"] = ["log the decision"]
        jsonschema.validate(instance=agentic, schema=schema)

        agentic["sources"]["CIS-AGENTS"]["monitor_issue"] = 0
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate(instance=agentic, schema=schema)

    def test_generator_output_matches_committed_catalog(self):
        path = ROOT / "build" / "generate_principle_catalogs.py"
        spec = importlib.util.spec_from_file_location("gpc", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        sources, _sections, _gap, ordered, _excluded, _raw, _merged = (
            mod.build_agentic()
        )
        data = json.loads(
            (ROOT / "data" / "ai-agentic-principles.json").read_text()
        )
        self.assertEqual(sources, data["sources"])
        self.assertEqual(ordered, data["principles"])

    def test_section_2_editorial_gap_keeps_its_bullet_list(self):
        path = ROOT / "build" / "generate_principle_catalogs.py"
        spec = importlib.util.spec_from_file_location("gpc_gap", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _sources, sections, _order = mod.parse_synthesis()
        sec = sections["zero-standing-privilege"]
        self.assertIn("deny by default", sec["gap"])
        note = sec["editorial_position"]
        self.assertIn("Approvals outlive their owner.", note)
        replay = (
            "Old requests can come back. A request queued, retried, "
            "scheduled, or saved in agent memory can run weeks or months "
            "later. If it carries no expiry, nothing stops it, and no one "
            "can trace it to the person who asked."
        )
        self.assertIn(replay, note)
        self.assertLess(
            note.index("Approvals outlive their owner."),
            note.index("Old requests can come back."),
        )
        self.assertLess(
            note.index("Old requests can come back."),
            note.index("No one holds the full story."),
        )
        self.assertTrue(
            any(
                b.startswith("Each agent action must record three things")
                for b in sec["bullets"]
            )
        )
        self.assertFalse(
            any(b.startswith("You can't undo") for b in sec["bullets"])
        )
        self.assertFalse(
            any(b.startswith("Old requests can come back") for b in sec["bullets"])
        )
        intro = (ROOT / "agentic-ai-security" / "agentic-security.md").read_text()
        self.assertIn(
            "Three of these Gap notes, in sections 2, 12, and 18,",
            intro,
        )
        self.assertNotIn(
            "Two of these Gap notes, in sections 12 and 18,",
            intro,
        )

    def test_current_catalog_passes_on_the_grace_start_date(self):
        proc = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "validate_principles.py"),
                "--as-of",
                "2026-10-31",
                "--grandfather",
                str(ROOT / "data" / "ai-agentic-principles.json"),
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(
            proc.returncode,
            0,
            proc.stdout[-2000:] + proc.stderr[-2000:],
        )
        self.assertIn("0 error(s)", proc.stdout)
        self.assertIn("conference-talk source(s) are exempt", proc.stdout)
        self.assertNotIn("UNPROMPTED1-MCCARTHY: unmatched", proc.stdout)
        self.assertNotIn("UNPROMPTED2-EVRON: unmatched", proc.stdout)

    def test_head_catalog_is_readable_as_a_baseline(self):
        ids = vp.principle_ids_from_git(
            "HEAD", "data/ai-agentic-principles.json"
        )
        self.assertIsNotNone(ids)
        self.assertGreater(len(ids), 0)


class TalkClaimsColumnTest(unittest.TestCase):
    """The conference-talk Claims column repeats catalog statements.

    A talk with no citing principle shows Not yet recorded. The column is
    not a second copy stored on the source row, and it does not change the
    monitor exemption.
    """

    def catalog_module(self):
        path = ROOT / "build" / "generate_principle_catalogs.py"
        spec = importlib.util.spec_from_file_location("gpc_claims", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_empty_citation_uses_placeholder(self):
        mod = self.catalog_module()
        self.assertEqual(mod.MISSING_TALK_CLAIM, "Not yet recorded")
        self.assertNotIn("\u2014", mod.MISSING_TALK_CLAIM)
        self.assertNotIn("\u2013", mod.MISSING_TALK_CLAIM)
        principles = [
            {"statement": "A real claim", "src": ["OTHER"]},
            {"statement": "  Keep\n the   words. ", "src": ["TALK"]},
        ]
        self.assertEqual(mod.claims_cited_by(principles, "ABSENT"), [])
        self.assertEqual(
            mod.talk_claims_cell(principles, "ABSENT"), "Not yet recorded"
        )
        self.assertEqual(
            mod.claims_cited_by(principles, "TALK"), ["Keep the words."]
        )

    def test_claims_column_does_not_change_source_parse(self):
        mod = self.catalog_module()
        with_claim = (
            "| UNPROMPTED2-X | Title | Event name | October 2026 | "
            "https://unpromptedcon.org | left | right |"
        )
        parsed = mod.SRC_ROW_RE.match(with_claim)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.group(1), "UNPROMPTED2-X")
        self.assertEqual(parsed.group(3), "Event name")
        self.assertEqual(parsed.group(5), "https://unpromptedcon.org")
        plain = (
            "| CIS-AGENTS | Title | Org | April 20, 2026 | "
            "https://example.com/a |"
        )
        parsed = mod.SRC_ROW_RE.match(plain)
        self.assertEqual(parsed.group(5), "https://example.com/a")

    def test_published_tables_repeat_recorded_claims_only(self):
        mod = self.catalog_module()
        data = json.loads(
            (ROOT / "data" / "ai-agentic-principles.json").read_text()
        )
        sources, _sections, _gap, ordered, _ex, _raw, _merged = mod.build_agentic()
        self.assertEqual(sources, data["sources"])
        talks = {
            code: src
            for code, src in sources.items()
            if src.get("type") == "conference-talk"
        }
        self.assertGreater(len(talks), 0)
        for code, src in talks.items():
            self.assertEqual(src.get("type"), "conference-talk")
            self.assertTrue(src.get("speaker"))
            self.assertTrue(src.get("title"))
            self.assertTrue(src.get("org"))
            self.assertTrue(src.get("url"))
            self.assertTrue(src.get("inventory_note"))
            self.assertIsNone(src.get("wp_id"))

        expected = {
            code: mod.claims_cited_by(ordered, code) for code in talks
        }
        html_order, html_claims = self.html_claims()
        md_claims = self.markdown_claims(
            (ROOT / "agentic-ai-security" / "agentic-security.md").read_text(),
            mod,
        )
        full_claims = self.markdown_claims(
            (ROOT / "agentic-ai-security" / "llms-full.txt").read_text(),
            mod,
        )
        self.assertEqual(html_claims.keys(), talks.keys())
        self.assertEqual(list(html_order), list(md_claims))
        self.assertEqual(html_claims, expected)
        self.assertEqual(md_claims, expected)
        self.assertEqual(full_claims, expected)
        page = (ROOT / "agentic-ai-security" / "index.html").read_text()
        talk_html = page[
            page.find("<p><strong>Conference talks</strong>"):page.find(
                'id="agent-identity"'
            )
        ]
        self.assertIn("Not yet recorded", talk_html)
        self.assertIn(
            "paraphrased takeaways we drew from each talk", talk_html
        )
        self.assertIn(
            "not direct quotes from the speaker", talk_html
        )
        self.assertIn("our own conclusions", talk_html)
        self.assertNotIn("asserts only what the named speaker said", page)
        self.assertNotIn("\u2014", talk_html)
        self.assertNotIn("\u2013", talk_html)
        self.assertEqual(html_order, list(talks))
        self.assertIn('id="claim"', page)
        self.assertIn(
            "A short statement this page records and cites with a short code",
            page,
        )
        for copy in (
            (ROOT / "agentic-ai-security" / "agentic-security.md").read_text(),
            (ROOT / "agentic-ai-security" / "llms-full.txt").read_text(),
        ):
            self.assertIn(
                "paraphrased takeaways drawn from each talk", copy
            )
            self.assertIn("not direct quotes from the speaker", copy)
            self.assertNotIn(
                "asserts only what the named speaker said", copy
            )

    def html_claims(self):
        page = (ROOT / "agentic-ai-security" / "index.html").read_text()
        table = re.search(
            r'<table class="src-table src-table--talks">(.*?)</table>',
            page,
            re.S,
        )
        self.assertIsNotNone(table)
        body = re.search(r"<tbody>(.*)</tbody>", table.group(1), re.S).group(1)
        order = []
        claims = {}
        for row in re.findall(r"<tr>(.*?)</tr>", body, re.S):
            cells = re.findall(r"<td([^>]*)>(.*?)</td>", row, re.S)
            self.assertEqual(len(cells), 6, row[:80])
            code = re.sub(r"<[^>]+>", "", cells[0][1]).strip()
            attrs, inner = cells[5]
            self.assertIn('data-label="Claims"', attrs)
            if "<li>" in inner:
                self.assertNotIn("claim-missing", attrs)
                items = []
                for li in re.findall(r"<li>(.*?)</li>", inner, re.S):
                    text = html.unescape(re.sub(r"<[^>]+>", "", li))
                    items.append(" ".join(text.split()))
            else:
                text = " ".join(
                    html.unescape(re.sub(r"<[^>]+>", "", inner)).split()
                )
                self.assertEqual(text, "Not yet recorded")
                self.assertIn("claim-missing", attrs)
                items = []
            order.append(code)
            claims[code] = items
        self.assertEqual(len(order), len(set(order)))
        return order, claims

    def markdown_claims(self, text, mod):
        start = text.find("**Conference talks**")
        end = text.find("\n## ", start)
        self.assertGreater(start, -1)
        claims = {}
        order = []
        for line in text[start:end].splitlines():
            parsed = mod.SRC_ROW_RE.match(line)
            if not parsed:
                continue
            parts = [part.strip() for part in line.strip().strip("|").split("|")]
            self.assertGreaterEqual(len(parts), 6, line)
            code = parts[0]
            self.assertEqual(parsed.group(5), parts[4])
            cell = parts[5]
            if cell == mod.MISSING_TALK_CLAIM:
                items = []
            else:
                items = [" ".join(piece.split()) for piece in cell.split("<br>")]
                self.assertNotIn(mod.MISSING_TALK_CLAIM, items)
            order.append(code)
            claims[code] = items
        self.assertEqual(len(order), len(claims))
        return claims


if __name__ == "__main__":
    unittest.main()
