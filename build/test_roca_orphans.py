#!/usr/bin/env python3
"""Fixture tests for the ROCA orphan check."""
from __future__ import annotations

import io
import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from obligation_kind import citation_pattern
from roca_orphans import (
    analyze,
    baseline_document,
    cited_requirement_ids,
    compare,
    main,
)


def write_json(path, doc):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")


def chain_fixture(root):
    """One complete chain, one transitive control, one orphan of each type."""
    root = Path(root)
    write_json(root / "data" / "regulations.json", {
        "items": [{
            "id": "inst-a",
            "mapping_key": "inst_a",
            "source_kind": "binding",
            "name": "Instrument A",
        }],
    })
    write_json(root / "data" / "moral-regulatory-hierarchy.json", {
        "requirements": [
            {
                "id": "req-complete",
                "instrument": "inst-a",
                "citation": "Article 1",
                "citation_match": ["Article 1"],
                "title": "Complete duty",
                "srf_layers": ["L1"],
            },
            {
                "id": "req-transitive",
                "instrument": "inst-a",
                "citation": "Article 2",
                "citation_match": ["Article 2"],
                "title": "Transitive duty",
                "srf_layers": ["L2"],
            },
            {
                "id": "req-orphan",
                "instrument": "inst-a",
                "citation": "Article 3",
                "citation_match": ["Article 3"],
                "title": "Unlinked duty",
                "srf_layers": ["L1", "L3"],
            },
        ],
    })
    write_json(root / "data" / "threats.json", {
        "threats": [
            {
                "id": "risk-complete",
                "name": "Complete risk",
                "srf_layer": "L1",
                "related_controls": ["srf.control.common.C-complete"],
                "obligations": [{
                    "requirement": "req-complete",
                    "basis": "derived_via_control",
                    "source": {"controls": [{
                        "control": "srf.control.common.C-complete",
                        "mapping_key": "inst_a",
                        "citation": "Article 1",
                    }]},
                }],
            },
            {
                "id": "risk-trans",
                "name": "Transitive risk",
                "srf_layer": "L2",
                "related_controls": [],
                "obligations": [{
                    "requirement": "req-transitive",
                    "basis": "official_text",
                    "source": {
                        "url": "https://example.test/law",
                        "citation": "Article 2",
                    },
                }],
            },
            {
                "id": "risk-orphan",
                "name": "Orphan risk",
                "srf_layer": "L4",
                "related_controls": [],
                "obligations": [],
            },
        ],
    })
    write_json(root / "data" / "common-controls.json", {
        "controls": [
            {
                "id": "C-complete",
                "title": "Complete control",
                "layer": "L1",
                "mappings": {"inst_a": "Article 1; Article 3"},
                "accountable_by_model": {"AI-SaaS": "persona-complete"},
            },
            {
                "id": "C-transitive",
                "title": "Transitive control",
                "layer": "L2",
                "mappings": {"inst_a": "Article 2"},
                "accountable_persona": "persona-complete",
            },
            {
                "id": "C-orphan",
                "title": "Orphan control",
                "layer": "L5",
                "mappings": {},
                "accountable_by_model": {"IaaS": "persona-orphan"},
            },
        ],
    })
    write_json(root / "data" / "personas.json", {
        "personas": [
            {"id": "persona-complete", "name": "Complete persona", "srf_layers": ["L1"]},
            {"id": "persona-orphan", "name": "Orphan persona", "srf_layers": ["L5"]},
        ],
        "sector_specializations": [],
    })
    write_json(root / "thresholds" / "gap-register.json", {
        "controls": [],
        "common": {
            "source_file": "common-controls.json",
            "controls": [
                {"id": "C-complete", "defined_in": "common-controls.json"},
                {"id": "C-orphan", "defined_in": "common-controls.json"},
            ],
        },
    })
    return root


def ids_of(report, kind):
    return sorted(item["id"] for item in report["orphans"] if item["type"] == kind)


class CitationMatchTest(unittest.TestCase):
    def test_word_boundary_catalog_and_placeholder(self):
        regs = {
            "inst_a": {"id": "inst-a", "source_kind": "binding"},
            "cat": {"id": "cat-inst", "source_kind": "catalog"},
        }
        req_1 = {"id": "req-1", "instrument": "inst-a"}
        req_10 = {"id": "req-10", "instrument": "inst-a"}
        req_cat = {"id": "req-cat", "instrument": "cat-inst"}
        matchers = {
            "inst-a": [
                {"req": req_1, "pats": [citation_pattern("Article 1")]},
                {"req": req_10, "pats": [citation_pattern("Article 10")]},
            ],
            "cat-inst": [
                {"req": req_cat, "pats": [citation_pattern("Article 1")]},
            ],
        }
        both = {"mappings": {
            "inst_a": "Article 1 and Article 10",
            "cat": "Article 1",
            "mapping_status_note": "Article 1",
            "later": "TBD later",
        }}
        self.assertEqual(cited_requirement_ids(both, regs, matchers), ["req-1", "req-10"])
        only_ten = {"mappings": {"inst_a": "Article 10"}}
        self.assertEqual(cited_requirement_ids(only_ten, regs, matchers), ["req-10"])


class FixtureTest(unittest.TestCase):
    def test_one_orphan_of_each_type_and_one_transitive_link(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = analyze(chain_fixture(tmp))
        self.assertEqual(ids_of(report, "risk"), ["risk-orphan"])
        self.assertEqual(ids_of(report, "obligation"), ["req-orphan"])
        self.assertEqual(ids_of(report, "control"), ["srf.control.common.C-orphan"])
        self.assertEqual(ids_of(report, "persona"), ["persona-orphan"])

        by_id = {item["id"]: item for item in report["orphans"]}
        self.assertEqual(by_id["risk-orphan"]["missing"], ["no obligation"])
        self.assertEqual(by_id["req-orphan"]["missing"], ["no risk links it"])
        self.assertEqual(by_id["req-orphan"]["layers"], ["L1", "L3"])
        self.assertEqual(
            by_id["srf.control.common.C-orphan"]["missing"],
            ["no risk", "no obligation"],
        )
        self.assertTrue(by_id["srf.control.common.C-orphan"]["in_gap_register"])
        self.assertFalse(by_id["risk-orphan"]["in_gap_register"])
        self.assertEqual(
            by_id["persona-orphan"]["missing"],
            ["accountable for no control in a complete chain"],
        )
        self.assertEqual(report["counts"]["obligation"]["by_layer"]["L1"], 1)
        self.assertEqual(report["counts"]["obligation"]["by_layer"]["L3"], 1)
        self.assertEqual(report["counts"]["obligation"]["total"], 1)
        self.assertEqual(report["control_to_risk"], {
            "direct": 1,
            "transitive": 2,
            "in_both_columns": 1,
        })
        self.assertEqual(report["gap_register_orphans"]["control"], 1)

    def test_source_named_control_reaches_the_obligation_without_a_citation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_json(root / "data" / "regulations.json", {
                "items": [{
                    "id": "inst-a",
                    "mapping_key": "inst_a",
                    "source_kind": "binding",
                    "name": "Instrument A",
                }],
            })
            write_json(root / "data" / "moral-regulatory-hierarchy.json", {
                "requirements": [{
                    "id": "req-s",
                    "instrument": "inst-a",
                    "citation": "Article 9",
                    "citation_match": ["Article 9"],
                    "title": "Named duty",
                    "srf_layers": ["L3"],
                }],
            })
            write_json(root / "data" / "threats.json", {
                "threats": [{
                    "id": "risk-s",
                    "name": "Source risk",
                    "srf_layer": "L3",
                    "related_controls": [],
                    "obligations": [{
                        "requirement": "req-s",
                        "basis": "derived_via_control",
                        "source": {"controls": [{
                            "control": "srf.control.common.C-named",
                            "mapping_key": "inst_a",
                            "citation": "not a matching citation",
                        }]},
                    }],
                }],
            })
            write_json(root / "data" / "common-controls.json", {
                "controls": [{
                    "id": "C-named",
                    "title": "Named control",
                    "layer": "L3",
                    "mappings": {},
                    "accountable_by_model": {"AI-PaaS": "persona-named"},
                }],
            })
            write_json(root / "data" / "personas.json", {
                "personas": [{
                    "id": "persona-named",
                    "name": "Named persona",
                    "srf_layers": ["L3"],
                }],
            })
            report = analyze(root)
        self.assertEqual(ids_of(report, "risk"), [])
        self.assertEqual(ids_of(report, "obligation"), [])
        self.assertEqual(ids_of(report, "control"), ["srf.control.common.C-named"])
        self.assertEqual(report["orphans"][0]["missing"], ["no risk"])
        self.assertEqual(report["control_to_risk"]["direct"], 0)
        self.assertEqual(report["control_to_risk"]["transitive"], 0)

    def test_unknown_obligation_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = chain_fixture(tmp)
            threats = json.loads((root / "data" / "threats.json").read_text())
            threats["threats"][2]["obligations"] = [{
                "requirement": "missing-req",
                "basis": "official_text",
                "source": {"url": "https://example.test/x", "citation": "nowhere"},
            }]
            write_json(root / "data" / "threats.json", threats)
            report = analyze(root)
        risk = [item for item in report["orphans"] if item["id"] == "risk-orphan"][0]
        self.assertEqual(risk["missing"], ["obligation id does not match a requirement"])


class BaselineTest(unittest.TestCase):
    def test_report_only_passes_at_or_below_the_baseline(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = chain_fixture(tmp)
            report = analyze(root)
            baseline = baseline_document(report)
            self.assertEqual(compare(report, baseline, "report-only"), [])
            baseline["counts"]["control"]["total"] += 1
            self.assertEqual(compare(report, baseline, "report-only"), [])

    def test_count_above_the_baseline_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = chain_fixture(tmp)
            report = analyze(root)
            baseline = baseline_document(report)
            baseline["counts"]["obligation"]["by_layer"]["L1"] = 0
            problems = compare(report, baseline, "report-only")
        self.assertEqual(problems, ["obligation L1 orphan count is 1, baseline is 0"])

    def test_blocking_fails_while_any_orphan_remains(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = analyze(chain_fixture(tmp))
        baseline = baseline_document(report)
        problems = compare(report, baseline, "blocking")
        self.assertTrue(any(item.startswith("blocking mode:") for item in problems))

    def test_cli_report_and_blocking_switch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = chain_fixture(tmp)
            report = analyze(root)
            baseline_path = root / "thresholds" / "orphan-baseline.json"
            write_json(baseline_path, baseline_document(report))
            script = Path(__file__).resolve().parent / "roca_orphans.py"
            ok = subprocess.run(
                [sys.executable, str(script), "--root", str(root), "--baseline", str(baseline_path)],
                check=False, capture_output=True, text=True,
            )
            self.assertEqual(ok.returncode, 0, ok.stderr)
            self.assertIn("Result: within baseline", ok.stdout)
            self.assertIn("srf.control.common.C-orphan: no risk; no obligation; in gap register", ok.stdout)
            self.assertNotIn("risk-complete", ok.stdout)
            self.assertNotIn("C-transitive", ok.stdout)
            blocked = subprocess.run(
                [sys.executable, str(script), "--root", str(root), "--baseline", str(baseline_path),
                 "--mode", "blocking"],
                check=False, capture_output=True, text=True,
            )
            self.assertEqual(blocked.returncode, 1)
            self.assertIn("blocking mode: 1 risk orphan", blocked.stdout)
            buf = io.StringIO()
            with redirect_stdout(buf):
                code = main(["--root", str(root), "--print-baseline"])
            self.assertEqual(code, 0)
            self.assertIn('"population"', buf.getvalue())


if __name__ == "__main__":
    unittest.main()
