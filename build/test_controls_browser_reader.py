#!/usr/bin/env python3
import unittest

from controls_browser_reader import (
    format_breach_action,
    format_metric,
    format_slug_phrase,
    is_param_constant,
)


class ControlsBrowserReaderTest(unittest.TestCase):
    def test_breach_public_sector_example(self):
        raw = "identify-unregistered-use-cases; notify-CAIO; escalate-to-AI-governance-board"
        text = format_breach_action(raw)
        self.assertIn("Identify unregistered use cases", text)
        self.assertIn("Notify the CAIO", text)
        self.assertIn("Escalate", text)

    def test_breach_insurance_board(self):
        text = format_breach_action("escalate-to-board-risk-committee")
        self.assertIn("Escalate", text)
        self.assertIn("board", text.lower())

    def test_param_constant(self):
        self.assertTrue(is_param_constant("TIER_AI_INVENTORY_COVERAGE_PCT"))
        self.assertFalse(is_param_constant("95"))

    def test_metric_words(self):
        text = format_metric("ai_use_case_inventory_coverage_pct")
        self.assertIn("inventory", text.lower())
        self.assertIn("percent", text.lower())

    def test_slug_phrase(self):
        self.assertEqual(format_slug_phrase("zero-tolerance"), "Zero Tolerance")


if __name__ == "__main__":
    unittest.main()