// Automated UX journeys for the threat-model tool.
// Run: node tests/test_ux.js   (from tools/threat-model, with jsdom on NODE_PATH or via tests/node_modules)
// Walks reader paths, scores heuristics, writes tests/out-ux-report.json, exits non-zero on hard failures.
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const DIR = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window;
w.alert = () => {};
w.URL.createObjectURL = () => "blob:test";
const $ = (id) => w.document.getElementById(id);

const report = {
  tool: "tools/threat-model",
  as_of: new Date().toISOString().slice(0, 10),
  journeys: [],
  findings: [],
  hard_failed: 0,
  soft_failed: 0,
  passed: 0
};

function finding(journey, id, severity, ok, message, refine) {
  const row = { journey, id, severity, ok: !!ok, message, refine: refine || null };
  report.findings.push(row);
  const j = report.journeys[report.journeys.length - 1];
  if (j) j.checks.push(row);
  if (ok) report.passed++;
  else if (severity === "hard") report.hard_failed++;
  else report.soft_failed++;
  const tag = ok ? "ok  " : (severity === "hard" ? "FAIL" : "WARN");
  console.log(tag + " [" + journey + "] " + id + " — " + message);
  return !!ok;
}

function journey(name, fn) {
  report.journeys.push({ name, checks: [] });
  console.log("\n## " + name);
  fn(name);
}

function text(el) {
  return (el && (el.textContent || "") || "").replace(/\s+/g, " ").trim();
}

function selectIdsInForm(form) {
  return Array.prototype.map.call(form.querySelectorAll("select[id^='start-q-']"), (el) => el.id.replace(/^start-q-/, ""));
}

function inputKindsFor(layer) {
  const qs = (w.TM.STARTS[layer] && w.TM.STARTS[layer].questions) || [];
  return qs.map((q) => ({ id: q.id, kind: q.kind, options: q.options ? q.options.length : 0 }));
}

function run() {
  journey("first_paint", (j) => {
    finding(j, "skip_link", "hard", !!w.document.querySelector('a.skip-link[href="#main"]'), "Skip link targets #main");
    finding(j, "site_chrome", "hard", !!(w.document.querySelector("site-nav") && w.document.querySelector("site-footer")), "Site nav and footer are present");
    finding(j, "hero_disclaimer", "hard", /not legal advice/i.test(text(w.document.querySelector(".callout--warn"))), "Warn callout states the prototype disclaimer");
    finding(j, "one_explainer", "hard", !/on its own|feed into/.test(text(w.document.querySelector(".page-hero__lede"))), "The hero lede does not repeat the explainer line");
    finding(j, "why_line", "hard", /on its own/.test(text($("mode-why"))) && /feed into the holistic view/.test(text($("mode-why"))), "The page says each layer can be assessed on its own and that scoped results feed the holistic view");
    finding(j, "panel_closed", "hard", !$("assessment-mode").open, "Assessment panel stays closed so the graph keeps room");
    finding(j, "graph_visible", "hard", !!$("graph-svg") && !$("graph-wrap").classList.contains("starting"), "Default example graph is visible on load");
    finding(j, "example_count", "hard", $("example-pick").options.length === 11, "Example picker lists all eleven catalog models");
    finding(j, "glossary_present", "hard", /ROCA = Risk, Obligation, Control, Accountable/.test(text($("glossary"))), "ROCA glossary is visible under the filters");
    finding(j, "list_view_affordance", "hard", !!$("view-toggle") && /List view/.test(text($("view-toggle"))), "List view control is available for text access");
  });

  journey("scoped_l2", (j) => {
    const l2 = w.document.querySelector('input[name="assessment-mode"][value="L2"]');
    l2.checked = true;
    l2.dispatchEvent(new w.Event("change"));
    finding(j, "policy_on_graph", "hard", !!w.document.querySelector('#graph .node[data-id="cmp.policy-kb"]') && /Refund policy/.test(text($("sys-name"))), "Scoped L2 draws the refund policy knowledge base");
    finding(j, "edge_actor", "hard", !!w.document.querySelector('#graph .node[data-id="cmp.edge-resolve"]'), "A reader outside the layer is an edge actor");
    finding(j, "no_l1_band", "hard", !w.document.querySelector("#graph text.band-id"), "Scoped L2 does not draw L1 to L5 bands");
    finding(j, "boundaries", "hard", !!w.document.querySelector("#graph .b-customer") && !!w.document.querySelector("#graph .b-provider") && /Internal|External/.test(text($("graph"))), "Customer, provider, internal, and external boundaries are on the canvas");
    const onlyLayer = w.TM_STATE.model.components.every((c) => c.edge_actor || c.layer === "L2");
    finding(j, "only_l2_plus_edges", "hard", onlyLayer && w.TM_STATE.model.relationships.length === 0, "The model has L2 components plus edge actors, and no cascade links");
    finding(j, "results_table", "hard", !!$("results-main") && /dsgai21/.test(text($("results-main"))) && /Customer/.test(text($("results-main"))), "Results table names the threat and the customer side");
    finding(j, "one_owner", "hard", w.TM_STATE.model.controls.every((c) => w.TM.controlOwnerCount(c) === 1), "Each control has one owner");
    finding(j, "panel_stays_closed", "hard", !$("assessment-mode").open, "Choosing Scoped does not force the panel open");
  });

  journey("example_after_scoped", (j) => {
    w.TM_UI.setAssessment("L2");
    finding(j, "example_cleared", "hard", $("example-pick").selectedIndex === -1, "Scoped L2 clears the Example selection so the next pick fires change");
    $("example-pick").value = "o2c";
    $("example-pick").dispatchEvent(new w.Event("change"));
    finding(j, "o2c_loads", "hard", /Order to Cash/.test(text($("sys-name"))) && !!w.document.querySelector('#graph .node[data-id="cmp.reasoning-llm"]'), "Example picker restores the holistic catalog model");
    finding(j, "source_line", "soft", /example in the picker/i.test(text($("model-source"))), "Model source line says the picker loaded the example");
    finding(j, "no_forced_focus", "hard", w.TM_UI.state.selected === null, "Holistic example load does not keep a scoped selection");
    finding(j, "cascade_available", "hard", /Cascade/.test(text(w.document.querySelector('.tab[data-tab="cascade"]'))), "Holistic restores the Cascade tab label");
  });

  journey("scoped_l5", (j) => {
    w.TM_UI.setAssessment("L5");
    finding(j, "weights_on_graph", "hard", !!w.document.querySelector('#graph .node[data-id="cmp.base-weights"]'), "Scoped L5 draws the public-hub weights file");
    finding(j, "edge_hub", "hard", !!w.document.querySelector('#graph .node[data-id="cmp.edge-hub"]'), "The public hub is an edge actor");
    finding(j, "no_realization", "hard", w.TM_STATE.model.relationships.every((r) => r.type !== "realization" && !r.cascade), "No realization or cascade links");
    const table = text($("results-main"));
    finding(j, "results_name_threat", "hard", /supplymodelpoison/.test(table) && /retire/.test(text($("results-none"))) && /Placeholder/.test(text($("results-none"))), "Results include the supply-chain threat and a Placeholder retire row");
    $("om").value = "AI-SaaS";
    $("om").dispatchEvent(new w.Event("change"));
    const pin = w.TM_STATE.model.controls.find((c) => c.id === "ctl.pin-version");
    finding(j, "saas_attestation", "hard", !!(pin && pin.party === "provider" && /attestation/.test(pin.attestation_note || "") && !/SOC|ISO/.test(pin.attestation_note || "")), "Under AI-SaaS a provider-side control says the customer relies on the provider's attestation");
    finding(j, "keyboard_node", "hard", w.document.querySelector("#graph .node").getAttribute("tabindex") === "0", "Graph nodes are keyboard focusable");
  });

  journey("cascade_and_controls", (j) => {
    w.TM_UI.load(JSON.parse(fs.readFileSync(path.join(DIR, "example-o2c.json"), "utf8")));
    const node = w.document.querySelector('#graph .node[data-id="cmp.reasoning-llm"]');
    node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    finding(j, "details_open_on_click", "hard", w.document.querySelector("main").classList.contains("drawer-open"), "Clicking a node opens Details");
    finding(j, "focus_to_close", "hard", w.document.activeElement === $("drawer-close"), "Focus moves to Close when Details opens");
    w.document.querySelector('.tab[data-tab="cascade"]').click();
    finding(j, "cascade_tables", "hard", /L1/.test(text($("panel"))) && /L5/.test(text($("panel"))), "Cascade tab shows layer reach for the selected component");
    $("mode").value = "controls";
    $("mode").dispatchEvent(new w.Event("change"));
    finding(j, "controls_mode", "hard", $("mode").value === "controls", "Reader can switch cascade mode to With controls in place");
    w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    finding(j, "escape_closes", "hard", w.document.querySelector("main").classList.contains("drawer-closed"), "Escape closes Details");
  });

  journey("list_view_and_threats", (j) => {
    w.TM_UI.load(JSON.parse(fs.readFileSync(path.join(DIR, "example-o2c.json"), "utf8")));
    $("view-toggle").click();
    finding(j, "list_replaces_svg", "hard", !$("graph-svg") && !!$("list-view"), "List view replaces the SVG with a text list");
    const row = w.document.querySelector("#list-view button[data-lv]");
    finding(j, "list_has_rows", "hard", !!row, "List view has selectable component rows");
    if (row) row.click();
    finding(j, "list_opens_details", "hard", w.document.querySelector("main").classList.contains("drawer-open"), "Selecting a list row opens Details");
    w.TM_UI.selectThreat("thr.llm-reinterprets");
    finding(j, "counsel_label", "hard", /Unverified, needs counsel/.test(text($("roca") || $("panel"))), "Threats tab shows the counsel label on obligations");
    finding(j, "threats_disclaimer", "hard", text($("threats-disclaimer")) === w.TM.DISCLAIMER, "Threats tab footer repeats the prototype disclaimer");
    w.document.querySelector('.tab[data-tab="export"]').click();
    finding(j, "export_actions", "hard", !!$("exp-json") && !!$("exp-yaml") && !!$("export-text"), "Export tab offers JSON and YAML with a readable output box");
    $("exp-yaml").click();
    finding(j, "export_yaml_disclaimer", "hard", ($("export-text").value || "").indexOf("# " + w.TM.DISCLAIMER) === 0, "YAML export leads with the disclaimer comment");
    $("view-toggle").click();
  });

  journey("l3_l4_guidance", (j) => {
    const note = text($("start-l34"));
    finding(j, "l3_l4_practice", "hard", /mature threat-modeling practice/.test(note), "The note says L3 and L4 already have a mature threat-modeling practice");
    ["owasp.org", "atlas.mitre.org", "secure-ai-tooling"].forEach((frag) => {
      finding(j, "link_" + frag.replace(/\W+/g, "_"), "soft", ($("start-l34").innerHTML || "").indexOf(frag) >= 0, "L3/L4 note links out via " + frag);
    });
  });

  journey("heuristic_summary", (j) => {
    const css = Array.prototype.map.call(w.document.querySelectorAll("style"), (s) => s.textContent).join("\n");
    finding(j, "graph_flex_space", "hard", /#graph-scroll\s*\{[^}]*flex:\s*1\s+1\s+auto/.test(css), "Graph scroll claims leftover viewport height");
    finding(j, "results_stack", "hard", /table\.results td::before/.test(css), "Results rows stack on a narrow screen");
    w.TM_UI.setAssessment("holistic");
    finding(j, "holistic_has_cascade", "hard", !!w.document.querySelector("#graph text.band-id"), "Holistic still draws the five layer bands");
  });

  const scoreHard = report.findings.filter((f) => f.severity === "hard");
  const scoreSoft = report.findings.filter((f) => f.severity === "soft");
  report.summary = {
    hard_total: scoreHard.length,
    hard_passed: scoreHard.filter((f) => f.ok).length,
    soft_total: scoreSoft.length,
    soft_passed: scoreSoft.filter((f) => f.ok).length,
    refine: report.findings.filter((f) => !f.ok && f.refine).map((f) => ({ id: f.id, refine: f.refine, message: f.message }))
  };
  report.ok = report.hard_failed === 0;

  const out = path.join(__dirname, "out-ux-report.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("\nWrote " + out);
  console.log(report.summary.hard_passed + "/" + report.summary.hard_total + " hard, " +
    report.summary.soft_passed + "/" + report.summary.soft_total + " soft");
  if (report.summary.refine.length) {
    console.log("Refine:");
    report.summary.refine.forEach((r) => console.log("  - " + r.id + ": " + r.refine));
  }
  process.exit(report.ok ? 0 : 1);
}

if (w.document.readyState === "loading") w.document.addEventListener("DOMContentLoaded", run);
else run();
