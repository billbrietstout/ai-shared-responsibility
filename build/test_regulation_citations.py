#!/usr/bin/env python3
"""Tests for readable regulation mapping output."""
import json
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "build"))

import regulation_citations as rc  # noqa: E402


class RegulationCitationsTest(unittest.TestCase):
    def test_format_plain(self):
        reg = {"eu_ai_act": {"short": "EU AI Act", "url": "https://example.test/eu"}}
        self.assertEqual(
            rc.format_plain("eu_ai_act", "Article 9 (Risk management system)", reg),
            "EU AI Act, Article 9 (Risk management system)",
        )
        self.assertEqual(rc.format_plain("eu_ai_act", "N/A", reg), "EU AI Act: N/A")

    def test_format_markdown_line(self):
        reg = {"eu_ai_act": {"short": "EU AI Act", "url": "https://example.test/eu"}}
        line = rc.format_markdown_line(
            "eu_ai_act", "Article 9 (Risk management system)", reg
        )
        self.assertIn("[EU AI Act, Article 9", line)
        self.assertIn("](https://example.test/eu)", line)


if __name__ == "__main__":
    raise SystemExit(unittest.main())