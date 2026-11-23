#!/usr/bin/env python3
import unittest

from regulation_citations import (
    READER_MAPPING_LEAK,
    load_regulations,
    omit_from_reader,
    reader_mapping_text,
    reader_mapping_texts_for_control,
)


class RegulationMappingsReaderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reg = load_regulations()

    def test_omit_na(self):
        self.assertTrue(omit_from_reader("N/A"))
        self.assertIsNone(reader_mapping_text("m_25_22", "N/A", self.reg))

    def test_pending_cosais_style(self):
        note = (
            "TBD: COSAIS overlays are pre-draft as of January 2026. "
            "Do not substitute invented IDs."
        )
        text = reader_mapping_text("nistir_8605a", note, self.reg)
        self.assertIn("(mapping pending)", text or "")
        self.assertNotIn("Do not substitute", text or "")
        self.assertNotIn("TBD:", text or "")

    def test_real_citation_unchanged(self):
        text = reader_mapping_text(
            "eu_ai_act", "Article 9 (Risk management system)", self.reg
        )
        self.assertIn("EU AI Act", text or "")
        self.assertIn("Article 9", text or "")

    def test_control_bundle_no_leaks(self):
        control = {
            "id": "SRF-TEST",
            "mappings": {
                "m_25_22": "N/A",
                "fedramp_20x_ksi": "N/A",
                "nistir_8605a": "TBD: editorial note. Do not substitute invented IDs.",
                "eu_ai_act": "Article 6 (Classification rules)",
            },
        }
        texts = reader_mapping_texts_for_control(control, self.reg)
        joined = " | ".join(texts)
        self.assertNotIn("N/A", joined)
        self.assertNotIn("TBD:", joined)
        self.assertNotIn("Do not substitute", joined)
        for text in texts:
            self.assertIsNone(READER_MAPPING_LEAK.search(text))


if __name__ == "__main__":
    unittest.main()