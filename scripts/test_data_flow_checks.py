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
import stat
import subprocess
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import monitor_sync_pr as mspr  # noqa: E402
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
    "axioms": [],
    "invariants": ["training data must be signed before use"],
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
            "invariants": ["new list"],
            "invariables": ["old list"],
            "principles": [],
        }
        ok = catalog(
            {"SRC": source(monitor_issue=7)},
            [principle(risks=["extraction"], obligations=["log it"])],
        )
        report = run_agentic(ok, {"WP-0001": paper}, TODAY, {"p1"})
        self.assertEqual(report.errors, [])
        corpus = vp.paper_corpus(paper)
        self.assertIn("new list", corpus)
        self.assertNotIn("old list", corpus)
        self.assertEqual(corpus.count("new list"), 1)

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
                "invariants": [],
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

        # invariants is present and empty, so invariables is not read.
        # No extracted text: warn, and leave the grace-dated unmatched check
        # to cover sources that are not in the monitor yet.
        empty_papers = {
            "WP-0001": {
                **PAPER,
                "axioms": [],
                "invariants": [],
                "invariables": ["training data must be signed before use"],
                "principles": [],
            }
        }
        empty = run_agentic(data, empty_papers, TODAY, set())
        self.assertFalse(any("support score 0.00" in msg for msg in empty.errors))
        self.assertTrue(any("support weak" in msg for msg in empty.warnings))
        self.assertEqual(vp.paper_corpus(empty_papers["WP-0001"]), [])

    def test_paper_corpus_reads_invariants_and_falls_back(self):
        new_key = vp.paper_corpus(
            {
                "axioms": ["axiom text"],
                "invariants": ["invariant text"],
                "principles": ["principle text"],
            }
        )
        self.assertEqual(
            new_key, ["axiom text", "invariant text", "principle text"]
        )

        old_key = {
            "id": "WP-0001",
            "issue": 7,
            "decision": "Include",
            "title": "Paper",
            "axioms": [],
            "invariables": ["training data must be signed before use"],
            "principles": [],
        }
        self.assertEqual(
            vp.paper_corpus(old_key),
            ["training data must be signed before use"],
        )
        fallback = run_agentic(
            catalog({"SRC": source()}, [principle()]),
            {"WP-0001": old_key},
            TODAY,
            set(),
        )
        self.assertFalse(
            any("support score 0.00" in msg for msg in fallback.errors)
        )

        both = vp.paper_corpus(
            {
                "invariants": ["new invariant text"],
                "invariables": ["old invariant text"],
            }
        )
        self.assertEqual(both, ["new invariant text"])

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
        self.assertIn("ambiguous or conflicting answer", sec["gap"])
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
        self.assertEqual(talk_html.count('<details class="claim-details">'), 14)
        self.assertNotIn("<details class=\"claim-details\" open", talk_html)
        self.assertIn("Show the claim", talk_html)
        self.assertIn("Show the claims", talk_html)
        self.assertIn("claim text stays closed until you open it", talk_html)
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


FAKE_GH = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path

state_path = Path(os.environ["GH_FAKE_STATE"])
log_path = Path(os.environ["GH_FAKE_LOG"])
state = json.loads(state_path.read_text())
args = sys.argv[1:]
with log_path.open("a", encoding="utf-8") as handle:
    handle.write(json.dumps(args) + "\n")

VALUE_FLAGS = {
    "--head", "--base", "--state", "--limit", "--json", "--repo",
    "--title", "--body-file", "--comment",
}

def fail(msg):
    print(msg, file=sys.stderr)
    raise SystemExit(2)

flags = {}
positionals = []
index = 0
while index < len(args):
    arg = args[index]
    if arg == "--draft":
        flags[arg] = True
        index += 1
        continue
    if arg in VALUE_FLAGS:
        if index + 1 >= len(args):
            fail("missing value for " + arg)
        flags[arg] = args[index + 1]
        index += 2
        continue
    if arg.startswith("-"):
        fail("unexpected flag " + arg)
    positionals.append(arg)
    index += 1

def save():
    state_path.write_text(json.dumps(state))

if positionals[:2] == ["pr", "list"]:
    rows = []
    for pr in state["prs"]:
        if flags.get("--head") and pr["head"] != flags["--head"]:
            continue
        if flags.get("--base") and pr["base"] != flags["--base"]:
            continue
        wanted = flags.get("--state", "open")
        if wanted != "all" and pr["state"] != wanted:
            continue
        rows.append({
            "number": pr["number"],
            "url": pr["url"],
            "isDraft": pr["isDraft"],
        })
    print(json.dumps(rows))
    raise SystemExit(0)

if positionals[:2] == ["pr", "create"]:
    if not flags.get("--draft"):
        fail("draft flag required")
    number = state["next"]
    state["next"] = number + 1
    body = Path(flags["--body-file"]).read_text()
    pr = {
        "number": number,
        "url": "https://example.test/pull/" + str(number),
        "isDraft": True,
        "state": "open",
        "head": flags["--head"],
        "base": flags["--base"],
        "title": flags.get("--title", ""),
        "body": body,
    }
    state["prs"].append(pr)
    save()
    print(pr["url"])
    raise SystemExit(0)

if positionals[:2] == ["pr", "edit"]:
    number = int(positionals[2])
    body = Path(flags["--body-file"]).read_text()
    for pr in state["prs"]:
        if pr["number"] == number:
            pr["body"] = body
            save()
            print(pr["url"])
            raise SystemExit(0)
    fail("missing pr " + str(number))

if positionals[:2] == ["pr", "close"]:
    number = int(positionals[2])
    for pr in state["prs"]:
        if pr["number"] == number:
            pr["state"] = "closed"
            pr["comment"] = flags.get("--comment", "")
            save()
            raise SystemExit(0)
    fail("missing pr " + str(number))

fail("unexpected command " + " ".join(positionals))
'''


def paper_row(wp_id, title, issue):
    return {
        "wp_id": wp_id,
        "issue_number": issue,
        "title": title,
        "decision": "include",
        "source_org": "Org",
        "url": "https://example.com/" + wp_id,
    }


def export_doc(updated, papers):
    return {"updated": updated, "count": len(papers), "papers": papers}


class MonitorSyncTest(unittest.TestCase):
    def test_classify_splits_added_modified_and_removed(self):
        local = export_doc(
            "2026-10-31",
            [
                paper_row("WP-0001", "Old", 1),
                paper_row("WP-0003", "Gone", 3),
            ],
        )
        remote = export_doc(
            "2026-11-03",
            [
                paper_row("WP-0001", "New", 1),
                paper_row("WP-0002", "Added", 2),
            ],
        )
        summary = fixture.classify_paper_changes(local, remote)
        self.assertEqual(summary["added"], ["WP-0002"])
        self.assertEqual(summary["modified"], ["WP-0001"])
        self.assertEqual(summary["removed"], ["WP-0003"])
        self.assertEqual(summary["changed"], ["WP-0002", "WP-0001"])
        self.assertTrue(summary["fixture_changed"])
        self.assertFalse(summary["metadata_only"])
        self.assertEqual(summary["baseline_count"], 2)
        self.assertEqual(summary["monitor_count"], 2)
        self.assertEqual(summary["updated"], "2026-11-03")

    def test_key_order_is_not_a_paper_change(self):
        local = {
            "updated": "2026-11-03",
            "papers": [{"wp_id": "WP-0001", "title": "Same"}],
        }
        remote = {
            "papers": [{"title": "Same", "wp_id": "WP-0001"}],
            "updated": "2026-11-03",
        }
        summary = fixture.classify_paper_changes(local, remote)
        self.assertFalse(summary["fixture_changed"])
        self.assertEqual(summary["changed"], [])

    def test_top_level_field_is_metadata_only(self):
        papers = [paper_row("WP-0001", "Same", 1)]
        local = export_doc("2026-10-31", papers)
        remote = export_doc("2026-11-03", papers)
        remote["source"] = "github-issues"
        summary = fixture.classify_paper_changes(local, remote)
        self.assertTrue(summary["fixture_changed"])
        self.assertTrue(summary["metadata_only"])
        self.assertEqual(summary["added"], [])
        self.assertEqual(summary["modified"], [])
        self.assertEqual(summary["removed"], [])

    def test_unusable_export_is_not_an_empty_diff(self):
        local = export_doc("2026-10-31", [paper_row("WP-0001", "A", 1)])
        remote = {"updated": "2026-11-03", "papers": [{"title": "no id"}]}
        with self.assertRaises(ValueError):
            fixture.classify_paper_changes(local, remote)

    def test_push_ref_rejects_protected_branches(self):
        self.assertEqual(
            mspr.destination_ref(mspr.BOT_BRANCH),
            "refs/heads/automation/monitor-fixture-sync",
        )
        for branch in (
            "develop",
            "main",
            "master",
            "automation/develop",
            "automation/../develop",
            "automation/monitor-fixture-sync/../../main",
        ):
            with self.assertRaises(SystemExit):
                mspr.destination_ref(branch)

    def test_unexpected_paths_are_refused(self):
        with self.assertRaises(SystemExit):
            mspr.assert_paths_allowed(["data/ai-agentic-principles.json"])
        with self.assertRaises(SystemExit):
            mspr.assert_paths_allowed(["README.md"])
        mspr.assert_paths_allowed([])
        mspr.assert_paths_allowed(list(mspr.PUBLISHED_PATHS))

    def test_plan_reuses_one_pull_request(self):
        def prs(*numbers):
            return [{"number": number} for number in numbers]

        self.assertEqual(
            mspr.plan_pull_request([], False).action, "skip"
        )
        closed = mspr.plan_pull_request(prs(4, 2), False)
        self.assertEqual(closed.action, "close")
        self.assertEqual(closed.close, [2, 4])
        created = mspr.plan_pull_request([], True)
        self.assertEqual(created.action, "create")
        updated = mspr.plan_pull_request(prs(9, 3), True)
        self.assertEqual(updated.action, "update")
        self.assertEqual(updated.keep, 3)
        self.assertEqual(updated.close, [9])

    def test_pull_request_body_names_ids_and_leaves_the_catalog(self):
        summary = {
            "updated": "2026-11-03",
            "added": ["WP-0002"],
            "modified": ["WP-0001"],
            "removed": ["WP-0003"],
            "baseline_count": 2,
            "monitor_count": 2,
            "metadata_only": False,
        }
        body = mspr.render_pull_request_body(
            summary,
            monitor_repo=fixture.MONITOR_REPO,
            monitor_branch="master",
            checked_on="2026-11-04",
            sources_changed=["SRC"],
        )
        self.assertIn("`WP-0002`", body)
        self.assertIn("`WP-0001`", body)
        self.assertIn("`WP-0003`", body)
        self.assertIn("`SRC`", body)
        self.assertIn(
            "leaves `data/ai-agentic-principles.json` and "
            "`data/ai-agentic-principles.slim.json` unchanged",
            body,
        )
        self.assertIn("data/whitepaper-inventory.slim.json", body)
        self.assertIn("The principle catalogs stay unchanged.", body)
        self.assertIn("does not enable auto-merge", body)
        self.assertIn("Approve workflows to run", body)
        self.assertNotIn("\u2014", body)
        self.assertNotIn("\u2013", body)

    def test_redact_strips_tokens(self):
        text = mspr.redact(
            "https://x-access-token:secret@github.com/a ghp_abc123"
        )
        self.assertNotIn("secret", text)
        self.assertNotIn("ghp_abc123", text)
        self.assertIn("REDACTED", text)

    def test_workflow_is_least_privilege_and_scheduled(self):
        workflow = (
            ROOT / ".github" / "workflows" / "monitor-fixture-sync.yml"
        ).read_text()
        doc = (ROOT / "docs" / "monitor-data-flow.md").read_text()
        source = Path(mspr.__file__).read_text()
        self.assertIn(f'cron: "{mspr.CRON}"', workflow)
        self.assertIn(mspr.CRON, doc)
        self.assertIn(mspr.BOT_BRANCH, doc)
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("contents: write", workflow)
        self.assertIn("pull-requests: write", workflow)
        self.assertNotIn("id-token:", workflow)
        self.assertNotIn("packages:", workflow)
        self.assertNotIn("secrets.", workflow)
        self.assertNotIn("pull_request_target", workflow)
        self.assertIn("ref: develop", workflow)
        self.assertIn("monitor_sync_pr.py --push", workflow)
        self.assertIn("monitor_sync_pr.py --dry-run", workflow)
        self.assertNotIn("git push", workflow)
        self.assertNotIn("pr merge", workflow)
        self.assertNotIn("--force", source)
        self.assertNotIn("pr merge", source)
        self.assertIn('"--draft"', source)
        self.assertIn('"-f"', source)
        self.assertIn(
            "Allow GitHub Actions to create and approve pull requests", doc
        )
        self.assertIn("03:00 UTC", doc)
        self.assertNotIn("\u2014", doc)
        self.assertNotIn("\u2013", doc)
        self.assertNotIn("\u2014", workflow)
        self.assertNotIn("\u2013", workflow)

    def test_refuses_to_target_main_or_to_push_without_a_flag(self):
        with self.assertRaises(SystemExit):
            mspr.run(mspr.parse_args(["--dry-run", "--base", "main"]))
        with self.assertRaises(SystemExit):
            mspr.run(mspr.parse_args(["--dry-run", "--push"]))
        with self.assertRaises(SystemExit):
            mspr.run(mspr.parse_args([]))

    def test_site_sync_reports_removals_and_does_not_write_data(self):
        catalog_path = ROOT / "data" / "ai-agentic-principles.json"
        slim_path = ROOT / "data" / "ai-agentic-principles.slim.json"
        before = catalog_path.read_bytes()
        slim_before = slim_path.read_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            agentic = {
                "$schema_version": "1.0",
                "updated": "2026-10-31",
                "count": 1,
                "sources": {
                    "SRC": {
                        "title": "Old",
                        "org": "Org",
                        "url": "https://example.com/WP-0001",
                        "wp_id": "WP-0001",
                    },
                    "GONE": {
                        "title": "Gone",
                        "org": "Org",
                        "url": "https://example.com/WP-0003",
                        "wp_id": "WP-0003",
                    },
                },
                "gap_index": {},
                "principles": [
                    {
                        "id": "p1",
                        "section": "s",
                        "category": "c",
                        "statement": "keep the record",
                        "src": ["SRC"],
                    }
                ],
            }
            agentic_path = tmp / "agentic.json"
            agentic_path.write_text(json.dumps(agentic), encoding="utf-8")
            papers = export_doc(
                "2026-11-03",
                [
                    paper_row("WP-0001", "New", 1),
                    paper_row("WP-0002", "Added", 2),
                    paper_row("WP-0004", "Edited", 4),
                ],
            )
            papers_path = tmp / "papers.json"
            papers_path.write_text(json.dumps(papers), encoding="utf-8")
            changes = {
                "updated": "2026-11-03",
                "added": ["WP-0002"],
                "modified": ["WP-0001", "WP-0004"],
                "removed": ["WP-0003"],
                "changed": ["WP-0002", "WP-0001", "WP-0004"],
            }
            changes_path = tmp / "changes.json"
            changes_path.write_text(json.dumps(changes), encoding="utf-8")
            out = tmp / "out"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts" / "site_sync.py"),
                    "--whitepapers",
                    str(papers_path),
                    "--changes",
                    str(changes_path),
                    "--agentic",
                    str(agentic_path),
                    "--out-dir",
                    str(out),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            diff = (out / "principles-diff.md").read_text()
            self.assertIn("## New monitor papers", diff)
            self.assertIn("`WP-0002`", diff)
            self.assertIn("## Modified papers with no site source", diff)
            self.assertIn("`WP-0004`", diff)
            self.assertIn("## Removed from the monitor export", diff)
            self.assertIn("`WP-0003` / `GONE`", diff)
            self.assertIn("Do not auto-delete.", diff)
            candidate = json.loads(
                (out / "ai-agentic-principles.candidate.json").read_text()
            )
            self.assertEqual(set(candidate["sources"]), {"SRC", "GONE"})
            self.assertEqual(candidate["sources"]["SRC"]["title"], "New")
            self.assertEqual(candidate["sources"]["GONE"]["title"], "Gone")
            self.assertEqual(
                agentic_path.read_text(), json.dumps(agentic)
            )
        self.assertEqual(catalog_path.read_bytes(), before)
        self.assertEqual(slim_path.read_bytes(), slim_before)

    def test_legacy_changes_list_still_marks_a_new_paper(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            agentic = {
                "$schema_version": "1.0",
                "updated": "2026-10-31",
                "count": 0,
                "sources": {},
                "principles": [],
            }
            agentic_path = tmp / "agentic.json"
            agentic_path.write_text(json.dumps(agentic), encoding="utf-8")
            papers_path = tmp / "papers.json"
            papers_path.write_text(
                json.dumps(export_doc("2026-11-03", [paper_row("WP-0002", "Added", 2)])),
                encoding="utf-8",
            )
            changes_path = tmp / "changes.json"
            changes_path.write_text(
                json.dumps({"changed": ["WP-0002"], "updated": "2026-11-03"}),
                encoding="utf-8",
            )
            out = tmp / "out"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts" / "site_sync.py"),
                    "--whitepapers",
                    str(papers_path),
                    "--changes",
                    str(changes_path),
                    "--agentic",
                    str(agentic_path),
                    "--out-dir",
                    str(out),
                ],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            diff = (out / "principles-diff.md").read_text()
            self.assertIn("`WP-0002`", diff.split("## Modified papers")[0])
            self.assertIn("Removed WP- IDs: (none)", diff)
            self.assertIn("## Unknown WP- IDs\nNone.", diff)

    def test_one_draft_is_reused_and_develop_is_not_pushed(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            work, baseline, monitor = self.make_repo(tmp)
            develop_sha = self.git(work, "rev-parse", "develop").stdout.strip()
            state = tmp / "gh-state.json"
            log = tmp / "gh.log"
            state.write_text(json.dumps({"next": 1, "prs": []}), encoding="utf-8")
            first = self.invoke(work, baseline, monitor, state, log)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            second = self.invoke(work, baseline, monitor, state, log)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)

            self.assertEqual(
                self.git(work, "rev-parse", "develop").stdout.strip(),
                develop_sha,
            )
            bare = tmp / "origin.git"
            refs = self.git(bare, "show-ref").stdout
            self.assertIn("refs/heads/develop", refs)
            self.assertIn("refs/heads/" + mspr.BOT_BRANCH, refs)
            self.assertNotIn("refs/heads/main", refs)
            self.assertEqual(
                self.git(bare, "rev-parse", "refs/heads/develop").stdout.strip(),
                develop_sha,
            )
            names = self.git(
                work,
                "diff",
                "--name-only",
                "origin/develop",
                mspr.BOT_BRANCH,
            ).stdout.split()
            self.assertTrue(names)
            self.assertTrue(set(names) <= set(mspr.PUBLISHED_PATHS))
            self.assertIn("build/fixtures/whitepapers.json", names)
            self.assertNotIn("data/ai-agentic-principles.json", names)
            catalog = self.git(
                work, "show", f"{mspr.BOT_BRANCH}:data/ai-agentic-principles.json"
            ).stdout
            self.assertIn('"title": "Old"', catalog)
            candidate = self.git(
                work,
                "show",
                f"{mspr.BOT_BRANCH}:reports/ai-agentic-principles.candidate.json",
            ).stdout
            self.assertIn('"title": "New"', candidate)
            diff = self.git(
                work, "show", f"{mspr.BOT_BRANCH}:reports/principles-diff.md"
            ).stdout
            self.assertIn("WP-0002", diff)
            self.assertIn("WP-0003", diff)

            calls = [
                json.loads(line)
                for line in log.read_text().splitlines()
                if line.strip()
            ]
            creates = [call for call in calls if call[:2] == ["pr", "create"]]
            edits = [call for call in calls if call[:2] == ["pr", "edit"]]
            self.assertEqual(len(creates), 1)
            self.assertIn("--draft", creates[0])
            self.assertGreaterEqual(len(edits), 1)
            saved = json.loads(state.read_text())
            open_prs = [pr for pr in saved["prs"] if pr["state"] == "open"]
            self.assertEqual(len(open_prs), 1)
            self.assertTrue(open_prs[0]["isDraft"])
            self.assertIn("WP-0002", open_prs[0]["body"])
            self.assertIn("leaves `data/ai-agentic-principles.json`", open_prs[0]["body"])

    def test_matching_export_closes_the_draft_without_pushing(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            work, baseline, _monitor = self.make_repo(tmp)
            develop_sha = self.git(bare := tmp / "origin.git", "rev-parse", "HEAD").stdout.strip()
            state = tmp / "gh-state.json"
            log = tmp / "gh.log"
            state.write_text(
                json.dumps(
                    {
                        "next": 2,
                        "prs": [
                            {
                                "number": 7,
                                "url": "https://example.test/pull/7",
                                "isDraft": True,
                                "state": "open",
                                "head": mspr.BOT_BRANCH,
                                "base": "develop",
                                "title": "old",
                                "body": "old",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            proc = self.invoke(work, baseline, baseline, state, log)
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            saved = json.loads(state.read_text())
            self.assertEqual(saved["prs"][0]["state"], "closed")
            self.assertIn("without merging", saved["prs"][0]["comment"])
            refs = self.git(bare, "show-ref").stdout
            self.assertNotIn("refs/heads/" + mspr.BOT_BRANCH, refs)
            self.assertEqual(
                self.git(bare, "rev-parse", "HEAD").stdout.strip(),
                develop_sha,
            )
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            self.assertFalse(any(call[:2] == ["pr", "create"] for call in calls))

    def test_extra_open_drafts_are_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            work, baseline, monitor = self.make_repo(tmp)
            state = tmp / "gh-state.json"
            log = tmp / "gh.log"
            state.write_text(
                json.dumps(
                    {
                        "next": 3,
                        "prs": [
                            self.seed_pr(1),
                            self.seed_pr(2),
                        ],
                    }
                ),
                encoding="utf-8",
            )
            proc = self.invoke(work, baseline, monitor, state, log)
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            saved = json.loads(state.read_text())
            by_number = {pr["number"]: pr for pr in saved["prs"]}
            self.assertEqual(by_number[1]["state"], "open")
            self.assertIn("WP-0001", by_number[1]["body"])
            self.assertEqual(by_number[2]["state"], "closed")
            self.assertIn("#1", by_number[2]["comment"])
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            self.assertFalse(any(call[:2] == ["pr", "create"] for call in calls))

    def seed_pr(self, number):
        return {
            "number": number,
            "url": f"https://example.test/pull/{number}",
            "isDraft": True,
            "state": "open",
            "head": mspr.BOT_BRANCH,
            "base": "develop",
            "title": "old",
            "body": "old",
        }

    def make_repo(self, tmp: Path):
        bare = tmp / "origin.git"
        work = tmp / "work"
        subprocess.check_call(
            ["git", "init", "--bare", "-b", "develop", str(bare)],
            stdout=subprocess.DEVNULL,
        )
        subprocess.check_call(
            ["git", "init", "-b", "develop", str(work)],
            stdout=subprocess.DEVNULL,
        )
        self.git(work, "config", "user.email", "test@example.com")
        self.git(work, "config", "user.name", "Test")
        self.git(work, "config", "commit.gpgsign", "false")
        fixture_dir = work / "build" / "fixtures"
        fixture_dir.mkdir(parents=True)
        data_dir = work / "data"
        data_dir.mkdir()
        (work / "reports").mkdir()
        (work / ".gitignore").write_text(
            "reports/*.candidate.json\nreports/principles-diff.md\n",
            encoding="utf-8",
        )
        baseline = export_doc(
            "2026-10-31",
            [
                paper_row("WP-0001", "Old", 1),
                paper_row("WP-0003", "Gone", 3),
            ],
        )
        monitor = export_doc(
            "2026-11-03",
            [
                paper_row("WP-0001", "New", 1),
                paper_row("WP-0002", "Added", 2),
            ],
        )
        catalog = {
            "$schema_version": "1.0",
            "updated": "2026-10-31",
            "count": 1,
            "sources": {
                "SRC": {
                    "title": "Old",
                    "org": "Org",
                    "url": "https://example.com/WP-0001",
                    "wp_id": "WP-0001",
                }
            },
            "gap_index": {},
            "principles": [
                {
                    "id": "p1",
                    "section": "s",
                    "category": "c",
                    "statement": "keep the record",
                    "src": ["SRC"],
                }
            ],
        }
        fixture_path = fixture_dir / "whitepapers.json"
        fixture_path.write_text(
            json.dumps(baseline, indent=2) + "\n", encoding="utf-8"
        )
        (data_dir / "ai-agentic-principles.json").write_text(
            json.dumps(catalog, indent=2) + "\n", encoding="utf-8"
        )
        inputs = tmp / "inputs"
        inputs.mkdir()
        baseline_file = inputs / "baseline.json"
        monitor_file = inputs / "monitor.json"
        baseline_file.write_text(
            json.dumps(baseline, indent=2) + "\n", encoding="utf-8"
        )
        monitor_file.write_text(
            json.dumps(monitor, indent=2) + "\n", encoding="utf-8"
        )
        self.git(work, "add", ".")
        self.git(work, "commit", "-m", "base")
        self.git(work, "remote", "add", "origin", str(bare))
        self.git(work, "push", "-u", "origin", "develop")
        return work, baseline_file, monitor_file

    def invoke(self, work, baseline, monitor, state, log):
        bin_dir = work.parent / "bin"
        bin_dir.mkdir(exist_ok=True)
        fake = bin_dir / "gh"
        fake.write_text(FAKE_GH, encoding="utf-8")
        fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
        env = os.environ.copy()
        env["PATH"] = str(bin_dir) + os.pathsep + env.get("PATH", "")
        env["GH_FAKE_STATE"] = str(state)
        env["GH_FAKE_LOG"] = str(log)
        for key in ("GH_TOKEN", "GITHUB_TOKEN", "GITHUB_REPOSITORY"):
            env.pop(key, None)
        return subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "monitor_sync_pr.py"),
                "--push",
                "--repo-root",
                str(work),
                "--baseline-file",
                str(baseline),
                "--monitor-file",
                str(monitor),
                "--monitor-branch",
                "master",
            ],
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )

    def git(self, repo, *args):
        proc = subprocess.run(
            ["git", "-C", str(repo), *args],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(
            proc.returncode,
            0,
            f"git {' '.join(args)} failed\n{proc.stdout}\n{proc.stderr}",
        )
        return proc


if __name__ == "__main__":
    unittest.main()
