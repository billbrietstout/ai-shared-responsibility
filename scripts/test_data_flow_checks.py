#!/usr/bin/env python3
"""Unit tests for principle grace rules and the whitepaper fixture check.

Run from the repo root:

  python3 scripts/test_data_flow_checks.py
"""

from __future__ import annotations

import importlib.util
import json
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
            url=fixture.MONITOR_EXPORT_URL,
        )
        self.assertEqual(errors, [])
        self.assertTrue(any("not published" in msg for msg in warnings))

        errors, warnings = fixture.evaluate(
            self.local(updated="2026-10-01"),
            fetched,
            today=TODAY,
            max_age_days=14,
            url=fixture.MONITOR_EXPORT_URL,
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

    def test_head_catalog_is_readable_as_a_baseline(self):
        ids = vp.principle_ids_from_git(
            "HEAD", "data/ai-agentic-principles.json"
        )
        self.assertIsNotNone(ids)
        self.assertGreater(len(ids), 0)


if __name__ == "__main__":
    unittest.main()
