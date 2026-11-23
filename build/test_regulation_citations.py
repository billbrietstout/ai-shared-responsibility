#!/usr/bin/env python3
"""Tests for readable regulation mapping output and pinpoint URLs."""
import json
import os
import sys
import unittest
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "build"))

import regulation_citations as rc  # noqa: E402


class RegulationCitationsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reg = rc.load_regulations()
        cls.pinpoints = rc.load_pinpoints()

    def test_format_plain(self):
        self.assertEqual(
            rc.format_plain("eu_ai_act", "Article 9 (Risk management system)", self.reg),
            "EU AI Act, Article 9 (Risk management system)",
        )
        self.assertEqual(rc.format_plain("eu_ai_act", "N/A", self.reg), "EU AI Act: N/A")

    def test_eu_ai_act_pinpoint_markdown(self):
        line = rc.format_markdown_line(
            "eu_ai_act", "Article 9 (Risk management system)", self.reg, self.pinpoints
        )
        self.assertIn("[EU AI Act, Article 9", line)
        self.assertIn("#art_9)", line)
        self.assertIn("CELEX:32024R1689", line)

    def test_nist_rmf_fallback_document_url(self):
        value = "GOVERN 2.3 (executive leadership takes responsibility for AI risk decisions)"
        url = rc.mapping_pinpoint_url("nist_ai_rmf", value, self.reg, self.pinpoints)
        self.assertEqual(url, self.reg["nist_ai_rmf"]["url"])
        line = rc.format_markdown_line("nist_ai_rmf", value, self.reg, self.pinpoints)
        self.assertIn(self.reg["nist_ai_rmf"]["url"], line)
        self.assertNotIn("#", line.split("](")[-1])

    def test_placeholder_has_no_pinpoint_link(self):
        line = rc.format_markdown_line("eu_ai_act", "N/A", self.reg, self.pinpoints)
        self.assertEqual(line, "  - EU AI Act: N/A")
        self.assertNotIn("](", line)

    def test_multi_cite_uses_first_pinpoint(self):
        value = (
            "Article 10 (data governance); Article 9 (Risk management system)"
        )
        url = rc.mapping_pinpoint_url("eu_ai_act", value, self.reg, self.pinpoints)
        self.assertIn("#art_10", url)

    def test_gdpr_falls_back_to_document_url(self):
        value = (
            "Article 5 (principles for processing personal data, including purpose "
            "limitation and data minimization; where in scope)"
        )
        url = rc.citation_pinpoint_url("gdpr", value, self.reg, self.pinpoints)
        self.assertEqual(url, self.reg["gdpr"]["url"])

    def test_iso_catalog_no_fragment(self):
        value = "ISO/IEC 42001:2023 (edition-level)"
        url = rc.citation_pinpoint_url("iso_42001", value, self.reg, self.pinpoints)
        self.assertEqual(url, self.reg["iso_42001"]["url"])
        self.assertNotIn("#", url)

    def test_eurlex_anchor_parser(self):
        self.assertEqual(rc.eurlex_anchor_id("Article 10(2)(f) (Bias examination)"), "art_10")
        self.assertEqual(rc.eurlex_anchor_id("Annex IV (technical documentation)"), "anx_IV")

    def test_pinpoint_bases_respond_http(self):
        """HEAD-check each instrument html_base used for pinpoints (fragment stripped)."""
        seen = set()
        for key, inst in (self.pinpoints.get("instruments") or {}).items():
            base = inst.get("html_base")
            if not base or base in seen:
                continue
            seen.add(base)
            req = urllib.request.Request(
                base.split("#")[0],
                method="HEAD",
                headers={"User-Agent": "srf-regulation-citation-test/1.0"},
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    self.assertIn(
                        resp.status,
                        (200, 202, 301, 302, 303, 307, 308),
                        msg=f"{key} base {base}",
                    )
            except urllib.error.HTTPError as exc:
                self.assertIn(
                    exc.code,
                    (200, 202, 301, 302, 303, 307, 308),
                    msg=f"{key} base {base}",
                )


if __name__ == "__main__":
    raise SystemExit(unittest.main())