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
    finding(j, "lede_explains_start", "soft", /Start from the process, the data, or the AI Model Provider/i.test(text(w.document.querySelector(".page-hero__lede"))), "Hero lede names the three starting points", "Keep the lede aligned with Start from L1/L2/L5");
    finding(j, "start_closed", "hard", !$("start-from").open, "Start from stays closed so the graph keeps room");
    finding(j, "graph_visible", "hard", !!$("graph-svg") && !$("graph-wrap").classList.contains("starting"), "Default example graph is visible on load");
    finding(j, "example_count", "hard", $("example-pick").options.length === 11, "Example picker lists all eleven catalog models");
    finding(j, "glossary_present", "hard", /ROCA = Risk, Obligation, Control, Accountable/.test(text($("glossary"))), "ROCA glossary is visible under the filters");
    finding(j, "list_view_affordance", "hard", !!$("view-toggle") && /List view/.test(text($("view-toggle"))), "List view control is available for text access");
  });

  journey("start_from_l2_dropdowns", (j) => {
    $("start-from").open = true;
    const l2 = w.document.querySelector('input[name="start-from"][value="L2"]');
    l2.checked = true;
    l2.dispatchEvent(new w.Event("change"));
    finding(j, "panel_opens", "hard", $("graph-wrap").classList.contains("starting") && !$("start-panel").hidden, "Choosing L2 opens the Start panel and hides the graph chrome");
    finding(j, "threat_and_control_named", "hard", /dsgai21/.test(text($("start-panel"))) && /controlRetrievalAndVectorSystemIntegrity/.test(text($("start-panel"))), "L2 start names the typical threat and candidate control");
    const kinds = inputKindsFor("L2");
    const freeText = kinds.filter((q) => q.kind === "text" || q.kind === "textarea");
    finding(j, "no_free_text", "hard", freeText.length === 0, freeText.length ? ("L2 still has free-text fields: " + freeText.map((q) => q.id).join(", ")) : "L2 entry questions use fixed controls, not free text", "Keep data set, owner, reader, writer, and classification as selects");
    ["dataName", "ownerName", "readerName", "writerName", "classification", "dataKind", "dataUse", "party", "lineage", "operatingModel"].forEach((id) => {
      const el = $("start-q-" + id);
      finding(j, "field_" + id, "hard", !!el && el.tagName === "SELECT", id + " is a <select>");
    });
    const dataOpts = Array.prototype.map.call($("start-q-dataName").options, (o) => o.value);
    finding(j, "data_options_include_worked", "hard", dataOpts.indexOf("Refund policy knowledge base") >= 0, "Data set options include the worked seed");
    finding(j, "data_options_include_catalog", "soft", dataOpts.indexOf("Customer master data") >= 0 && dataOpts.indexOf("Order and invoice ledger") >= 0, "Data set options include O2C catalog sets", "Add catalog data sets readers already know from examples");
    const writerBlank = Array.prototype.some.call($("start-q-writerName").options, (o) => o.value === "" && /none/i.test(o.textContent));
    finding(j, "writer_none_option", "hard", writerBlank, "Writer select offers a None option instead of a blank text box");
    $("start-worked").click();
    finding(j, "worked_seed_lands", "hard", !!w.document.querySelector('#graph .node[data-id="cmp.policy-kb"]') && text($("sys-name")).indexOf("Refund policy") >= 0, "Worked seed loads the policy knowledge base on the graph");
    finding(j, "start_closes_after_seed", "hard", !$("start-from").open && !$("graph-wrap").classList.contains("starting"), "Start from closes after seed so the diagram returns");
  });

  journey("custom_l2_build", (j) => {
    const l2 = w.document.querySelector('input[name="start-from"][value="L2"]');
    $("start-from").open = true;
    l2.checked = true;
    l2.dispatchEvent(new w.Event("change"));
    $("start-q-dataName").value = "Other retrieval corpus";
    $("start-q-dataName").dispatchEvent(new w.Event("change"));
    $("start-q-ownerName").value = "Data steward (placeholder)";
    $("start-q-readerName").value = "Reading agent";
    $("start-q-classification").value = "Confidential";
    $("start-build").click();
    finding(j, "custom_name_on_graph", "hard", text($("sys-name")).indexOf("Other retrieval corpus") >= 0, "Build from answers names the model after the chosen data set");
    finding(j, "custom_node_present", "hard", !!w.document.querySelector('#graph .node[data-id="cmp.l2-data"]'), "Custom L2 seed draws the data component");
    const notes = (w.TM_STATE.model.components.find((c) => c.id === "cmp.l2-data") || {}).notes || "";
    finding(j, "classification_recorded", "hard", /Confidential/.test(notes), "Chosen classification is recorded on the data component");
  });

  journey("example_after_seed", (j) => {
    w.TM_UI.applySeed("L2", { worked: true });
    finding(j, "example_cleared", "hard", $("example-pick").selectedIndex === -1, "Seed clears the Example selection so the next pick fires change");
    $("example-pick").value = "o2c";
    $("example-pick").dispatchEvent(new w.Event("change"));
    finding(j, "o2c_loads", "hard", /Order to Cash/.test(text($("sys-name"))) && !!w.document.querySelector('#graph .node[data-id="cmp.reasoning-llm"]'), "Example picker restores a full catalog model after an L2 seed");
    finding(j, "source_line", "soft", /example in the picker/i.test(text($("model-source"))), "Model source line says the picker loaded the example", "Keep model-source copy honest about seed vs catalog");
    const focus = w.TM_UI.state.selected;
    const focused = focus && w.TM.active(w.TM_UI.state.model).components.filter((c) => c.id === focus)[0];
    finding(j, "keeps_l2_focus", "hard", !!(focused && focused.layer === "L2"), "After L2 seed, Example pick keeps focus on an L2 component instead of the tall L1 band");
  });

  // Regression: choosing L2/L5 then an Example used to leave selected=null and
  // show the tall L1 band. The UX eval must fail if that returns.
  function assertExampleKeepsLayer(j, layer, exampleId) {
    const radio = w.document.querySelector('input[name="start-from"][value="' + layer + '"]');
    $("start-from").open = true;
    radio.checked = true;
    radio.dispatchEvent(new w.Event("change"));
    finding(j, layer.toLowerCase() + "_panel_open", "hard", $("graph-wrap").classList.contains("starting"), layer + " radio opens the Start panel");
    $("example-pick").value = exampleId;
    $("example-pick").dispatchEvent(new w.Event("change"));
    finding(j, layer.toLowerCase() + "_panel_closed", "hard", !$("graph-wrap").classList.contains("starting"), "Example closes the Start panel after " + layer);
    const focus = w.TM_UI.state.selected;
    finding(j, layer.toLowerCase() + "_has_selection", "hard", !!focus, "Example after " + layer + " selects a component (not an empty L1 scroll)", "Remember Start from layer on radio select so Example does not reset to L1");
    const focused = focus && w.TM.active(w.TM_UI.state.model).components.filter((c) => c.id === focus)[0];
    finding(j, layer.toLowerCase() + "_not_l1", "hard", !!(focused && focused.layer !== "L1"), "Example after " + layer + " must not leave focus on an L1 component");
    finding(j, layer.toLowerCase() + "_keeps_layer", "hard", !!(focused && focused.layer === layer), "Example after " + layer + " focuses a " + layer + " component");
    const node = focus && w.document.querySelector('#graph .node[data-id="' + focus + '"]');
    const stroke = node && node.querySelector("rect") && node.querySelector("rect").getAttribute("stroke-width");
    finding(j, layer.toLowerCase() + "_node_selected", "hard", !!node && Number(stroke) >= 3, "Focused " + layer + " component is drawn selected on the graph");
    finding(j, layer.toLowerCase() + "_source_names_layer", "soft", new RegExp("focused on " + layer).test(text($("model-source"))), "Source line says the Example is focused on " + layer);
    finding(j, layer.toLowerCase() + "_radio_remains", "hard", !!radio.checked && !$("start-from").open, layer + " radio stays selected and Start from stays collapsed", "Keep the Start from layer radio after Example so layer selection remains");
  }

  journey("example_after_start_radio", (j) => {
    assertExampleKeepsLayer(j, "L2", "o2c");
    // Second Example while L2 radio still checked must keep L2 focus.
    $("example-pick").value = "p2p";
    $("example-pick").dispatchEvent(new w.Event("change"));
    const focus2 = w.TM_UI.state.selected;
    const focused2 = focus2 && w.TM.active(w.TM_UI.state.model).components.filter((c) => c.id === focus2)[0];
    finding(j, "second_example_keeps_l2", "hard", !!(focused2 && focused2.layer === "L2"), "A later Example pick still uses the kept L2 radio");
    assertExampleKeepsLayer(j, "L5", "o2c");
  });

  journey("start_from_l5_dropdowns", (j) => {
    const kinds = inputKindsFor("L5");
    const freeText = kinds.filter((q) => q.kind === "text" || q.kind === "textarea");
    finding(j, "no_free_text", "hard", freeText.length === 0, freeText.length ? ("L5 still has free-text fields: " + freeText.map((q) => q.id).join(", ")) : "L5 entry questions use fixed controls, not free text", "Keep weights and vendor model as selects");
    $("start-from").open = true;
    const l5 = w.document.querySelector('input[name="start-from"][value="L5"]');
    l5.checked = true;
    l5.dispatchEvent(new w.Event("change"));
    ["weightsName", "vendorName", "update", "finetune", "operatingModel"].forEach((id) => {
      finding(j, "field_" + id, "hard", !!$("start-q-" + id) && $("start-q-" + id).tagName === "SELECT", id + " is a <select>");
    });
    finding(j, "weights_none_option", "hard", Array.prototype.some.call($("start-q-weightsName").options, (o) => o.value === "" && /no local/i.test(o.textContent)), "Weights select offers No local weights file");
    $("start-worked").click();
    finding(j, "worked_seed_lands", "hard", !!w.document.querySelector('#graph .node[data-id="cmp.weights"]') || !!w.document.querySelector('#graph .node[data-id="cmp.l5-weights"]') || /weights|model/i.test(text($("sys-name"))), "Worked L5 seed loads a model graph");
  });

  journey("l1_free_text_accepted", (j) => {
    const kinds = inputKindsFor("L1");
    const freeText = kinds.filter((q) => q.kind === "text" || q.kind === "textarea");
    finding(j, "l1_keeps_free_text", "soft", freeText.length >= 1, "L1 still allows free text for process and step names (expected)", "Only convert L1 to dropdowns if a fixed process catalog is adopted");
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
    $("start-from").open = true;
    const note = text($("start-l34"));
    finding(j, "no_l3_l4_start", "hard", /No Start from for L3 or L4/.test(note), "Chrome explains there is no Start from for L3 or L4");
    ["owasp.org", "atlas.mitre.org", "secure-ai-tooling"].forEach((frag) => {
      finding(j, "link_" + frag.replace(/\W+/g, "_"), "soft", ($("start-l34").innerHTML || "").indexOf(frag) >= 0, "L3/L4 note links out via " + frag, "Keep outside threat-model links current");
    });
  });

  journey("heuristic_summary", (j) => {
    const css = Array.prototype.map.call(w.document.querySelectorAll("style"), (s) => s.textContent).join("\n");
    finding(j, "graph_flex_space", "hard", /#graph-scroll\s*\{[^}]*flex:\s*1\s+1\s+auto/.test(css), "Graph scroll claims leftover viewport height (avoids cramped panes)");
    finding(j, "start_form_select_width", "soft", /\.start-form input\[type="text"\],\s*\.start-form select/.test(css), "Start form styles cover select controls", "Keep start-form select styling when fields are dropdowns");
    const l2Kinds = inputKindsFor("L2");
    finding(j, "recognition_over_recall", "hard", l2Kinds.every((q) => q.kind !== "text"), "L2 prefers recognition (fixed options) over recall (free typing)");
    $("start-from").open = true;
    const l2radio = w.document.querySelector('input[name="start-from"][value="L2"]');
    l2radio.checked = true;
    l2radio.dispatchEvent(new w.Event("change"));
    const ids = selectIdsInForm($("start-form"));
    finding(j, "consistency_select_ids", "soft", ids.indexOf("dataName") >= 0 && ids.indexOf("classification") >= 0, "Start panel select ids stay start-q-* for scripts and tests", "Keep start-q-* ids stable for UX and cascade tests");
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
