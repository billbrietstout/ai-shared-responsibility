#!/usr/bin/env python3
"""Scope rules for the slim whitepaper inventory."""

from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = (
    ROOT / "agentic-ai-security" / "index.html",
    ROOT / "assess" / "whitepaper-assessment" / "index.html",
)


def load_generator():
    path = ROOT / "build" / "generate_whitepaper_inventory.py"
    spec = importlib.util.spec_from_file_location("gen_inventory", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class InventoryScopeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_generator()
        cls.fixture = json.loads(
            (ROOT / "build" / "fixtures" / "whitepapers.json").read_text()
        )
        cls.catalog = json.loads(
            (ROOT / "data" / "ai-agentic-principles.json").read_text()
        )
        cls.classic = json.loads(
            (ROOT / "data" / "security-principles.json").read_text()
        )["count"]
        cls.inventory = cls.mod.build_inventory(
            cls.fixture, cls.catalog, cls.classic
        )

    def test_committed_slim_matches_the_builder(self):
        slim = ROOT / "data" / "whitepaper-inventory.slim.json"
        self.assertEqual(
            slim.read_text(encoding="utf-8"),
            self.mod.dumps(self.inventory),
        )
        proc = subprocess.run(
            [sys.executable, str(ROOT / "build" / "generate_whitepaper_inventory.py"), "--check"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)

    def test_scope_counts_do_not_overlap(self):
        counts = self.inventory["counts"]
        papers = self.inventory["papers"]
        org = [row for row in papers if row["k"] == "org" and row["dec"] == "include"]
        research = [row for row in papers if row["k"] == "research"]
        cited_codes = sum(len(row.get("cs") or []) for row in papers)
        self.assertEqual(counts["all"], len(papers))
        self.assertEqual(counts["org"], len(org))
        self.assertEqual(counts["research"], len(research))
        self.assertEqual(counts["cited"], cited_codes)
        self.assertEqual(counts["cited"], 68)
        self.assertEqual(counts["talks"], 14)
        self.assertEqual(counts["principles"], 170)
        self.assertEqual(counts["classic"], 87)
        self.assertEqual(len(set(row["i"] for row in org) & set(row["i"] for row in research)), 0)
        self.assertEqual(counts["org"] + counts["research"] + (
            counts["all"] - counts["org"] - counts["research"]
        ), counts["all"])
        self.assertGreater(counts["all"], counts["org"])
        self.assertNotEqual(counts["org"], counts["research"])

    def test_cited_research_is_not_a_principle_source(self):
        for row in self.inventory["papers"]:
            if row["k"] != "research":
                continue
            self.assertNotIn("c", row)
            self.assertNotIn("cs", row)
            self.assertNotEqual(row["x"], "extracted")
            self.assertEqual(row["x"], "metadata")
        self.assertEqual(self.inventory["counts"]["research-extracted"], 0)
        cited = [row for row in self.inventory["papers"] if row.get("cs")]
        self.assertTrue(all(row["k"] == "org" for row in cited))
        self.assertTrue(all(row["dec"] == "include" for row in cited))

    def test_evidence_tags_keep_possibly_deployed_out_of_deployed(self):
        evidence = self.inventory["evidence_research"]
        self.assertEqual(evidence["deployed"], 0)
        self.assertGreater(evidence["possibly_deployed"], 0)
        self.assertEqual(
            sum(evidence.values()),
            self.inventory["counts"]["research"],
        )
        self.assertEqual(evidence["untagged"], 0)
        codes = {row.get("ev") for row in self.inventory["papers"] if row.get("ev")}
        self.assertNotIn("deployed", codes)
        self.assertIn("possibly_deployed", codes)

    def test_known_rows(self):
        by_id = {row["i"]: row for row in self.inventory["papers"]}
        cited = by_id["WP-0001"]
        self.assertEqual(cited["c"], "BIML-SE")
        self.assertEqual(cited["x"], "extracted")
        self.assertEqual(cited["k"], "org")
        shared = by_id["WP-0040"]
        self.assertEqual(shared["c"], "SANS-CAISG14")
        self.assertEqual(len(shared["cs"]), 1)
        early = by_id["WP-0168"]
        self.assertEqual(early["k"], "org")
        self.assertEqual(early["ev"], "theoretical")
        self.assertEqual(early["ax"], 1)
        self.assertNotIn("c", early)
        self.assertEqual(early["x"], "extracted")
        bare = by_id["WP-0177"]
        self.assertEqual(bare["k"], "org")
        self.assertEqual(bare["x"], "metadata")
        self.assertNotIn("c", bare)
        research = by_id["WP-0180"]
        self.assertEqual(research["k"], "research")
        self.assertEqual(research["x"], "metadata")
        self.assertEqual(research["ev"], "tested")
        self.assertNotIn("c", research)
        text = json.dumps(self.inventory)
        self.assertNotIn("Not extracted yet", text)
        self.assertNotIn("sophisticated associative-learning", text)

    def test_extracted_flag_reads_invariants_then_invariables(self):
        flag = self.mod.is_extracted
        self.assertTrue(flag({"invariants": ["a rule that stays true"]}))
        self.assertTrue(flag({"invariables": ["a rule that stays true"]}))
        self.assertFalse(
            flag(
                {
                    "invariants": [],
                    "invariables": ["a rule that stays true"],
                }
            )
        )
        self.assertTrue(
            flag(
                {
                    "invariants": ["new rule"],
                    "invariables": ["Not extracted yet."],
                }
            )
        )
        self.assertFalse(
            flag(
                {
                    "invariants": ["Not extracted yet."],
                    "invariables": ["a rule that stays true"],
                }
            )
        )
        self.assertEqual(
            self.mod.invariant_values({"invariants": ["new"], "invariables": ["old"]}),
            ["new"],
        )
        self.assertEqual(
            self.mod.invariant_values({"invariables": ["old"]}),
            ["old"],
        )

    def test_minimal_fixture_for_the_weekly_job(self):
        catalog = {
            "count": 1,
            "sources": {
                "SRC": {
                    "title": "Old",
                    "org": "Org",
                    "url": "https://example.com/WP-0001",
                    "wp_id": "WP-0001",
                }
            },
        }
        fixture = {
            "updated": "2026-11-04",
            "papers": [
                {
                    "wp_id": "WP-0001",
                    "title": "Old",
                    "decision": "include",
                    "source_org": "Org",
                    "url": "https://example.com/WP-0001",
                    "issue_number": 1,
                },
                {
                    "wp_id": "WP-0180",
                    "title": "Cited",
                    "decision": "include",
                    "source_org": "Academic",
                    "url": "https://arxiv.org/abs/1206.6389",
                    "issue_number": 180,
                    "legacy_sheet_row": (
                        "Found by the weekly pass, as a reference cited "
                        "by a monitored paper."
                    ),
                    "legacy_notes": "Evidence level: tested. Basis: automated read",
                    "axioms": [
                        "Not extracted yet. The next pass will fill this from the paper."
                    ],
                    "principles": ["Not extracted yet."],
                },
            ],
        }
        built = self.mod.build_inventory(fixture, catalog, None)
        self.assertEqual(built["counts"]["cited"], 1)
        self.assertEqual(built["counts"]["org"], 1)
        self.assertEqual(built["counts"]["research"], 1)
        self.assertEqual(built["counts"]["all"], 2)
        research = built["papers"][1]
        self.assertEqual(research["i"], "WP-0180")
        self.assertNotIn("c", research)
        self.assertEqual(research["x"], "metadata")
        self.assertEqual(research["ev"], "tested")

    def test_pages_default_to_cited_and_label_research(self):
        for path in PAGES:
            html = path.read_text(encoding="utf-8")
            self.assertIn('value="cited" checked', html)
            self.assertIn("Cited research", html)
            self.assertIn("not part of the default", html)
            self.assertNotIn("Research the monitor found", html)
            self.assertIn("not a source of principles", html.lower())
            self.assertIn("paraphrase", html.lower())
            self.assertIn('value="possibly_deployed"', html)
            self.assertIn('value="deployed"', html)
            self.assertIn('value="untagged"', html)
            self.assertIn('id="inventory-evidence-set" hidden', html)
            block = re.search(
                r"<!-- inventory-controls:start -->.*?<!-- inventory-controls:end -->",
                html,
                re.S,
            )
            self.assertIsNotNone(block)
            self.assertNotIn("\u2014", block.group(0))
            self.assertNotIn("\u2013", block.group(0))
            stripped = re.sub(
                r'<span\b[^>]*\bdata-inv-count="cited"[^>]*>\d+</span>',
                "",
                html,
            )
            stripped = re.sub(
                r'<meta\b[^>]*\bdata-inv-stamp="cited-papers"[^>]*>',
                "",
                stripped,
            )
            stripped = re.sub(
                r'<script\b[^>]*\bdata-inv-stamp="cited-papers"[^>]*>.*?</script>',
                "",
                stripped,
                flags=re.S,
            )
            self.assertIsNone(
                re.search(r"\b52\b", stripped),
                path.name,
            )

    def test_catalog_files_are_not_in_the_generator_writes(self):
        source = (
            ROOT / "build" / "generate_whitepaper_inventory.py"
        ).read_text(encoding="utf-8")
        self.assertNotIn("ai-agentic-principles.json\").write", source)
        self.assertNotIn("security-principles.json\").write", source)
        self.assertIn("SLIM_REL", source)


if __name__ == "__main__":
    unittest.main()
