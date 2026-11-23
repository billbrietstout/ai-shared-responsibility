#!/usr/bin/env python3
"""Tests for /sources/ catalog and exports."""
import json
import os
import re
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "build"))

import generate_sources as gs  # noqa: E402
import regulation_citations as rc  # noqa: E402


class SourcesCatalogTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog_path = os.path.join(ROOT, "data", "sources.json")
        if os.path.isfile(cls.catalog_path):
            cls.catalog = json.load(open(cls.catalog_path, encoding="utf-8"))
        else:
            entries, _ = gs.collect_entries()
            cls.catalog = {"entries": entries}

    def test_one_entry_per_source_with_url(self):
        entries = self.catalog.get("entries") or []
        self.assertGreater(len(entries), 0)
        for e in entries:
            self.assertTrue(e.get("anchor"), msg=json.dumps(e)[:120])
            self.assertTrue(e.get("title"), msg=e.get("anchor"))
            self.assertTrue(e.get("kind") in gs.KIND_ORDER, msg=e.get("anchor"))
            self.assertTrue(e.get("url"), msg=f"missing url: {e.get('anchor')}")

    def test_anchor_ids_unique(self):
        anchors = [e["anchor"] for e in self.catalog.get("entries") or []]
        self.assertEqual(len(anchors), len(set(anchors)))

    def test_csl_json_parses(self):
        path = os.path.join(ROOT, "export", "sources.csl.json")
        if not os.path.isfile(path):
            self.skipTest("export/sources.csl.json not generated yet")
        data = json.load(open(path, encoding="utf-8"))
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        for item in data:
            self.assertIn("id", item)
            self.assertIn("title", item)

    def test_bibtex_parses(self):
        path = os.path.join(ROOT, "export", "sources.bib")
        if not os.path.isfile(path):
            self.skipTest("export/sources.bib not generated yet")
        text = open(path, encoding="utf-8").read()
        self.assertIn("@misc{", text)
        self.assertGreaterEqual(text.count("@"), 10)

    def test_sources_page_lists_anchors(self):
        html_path = os.path.join(ROOT, "sources", "index.html")
        if not os.path.isfile(html_path):
            self.skipTest("sources/index.html not generated yet")
        html = open(html_path, encoding="utf-8").read()
        for e in self.catalog.get("entries") or []:
            self.assertIn(f'id="{e["anchor"]}"', html, msg=e["anchor"])

    def test_multi_cite_cells_one_link_per_cite(self):
        reg = rc.load_regulations()
        pin = rc.load_pinpoints()
        value = (
            "45 CFR §164.308(b): Business associate contracts; "
            "45 CFR §164.502(e): Disclosures to business associates"
        )
        line = rc.format_markdown_line("hipaa", value, reg, pin)
        self.assertEqual(line.count("]("), 2)
        self.assertIn("section-164.502", line)


if __name__ == "__main__":
    raise SystemExit(unittest.main())