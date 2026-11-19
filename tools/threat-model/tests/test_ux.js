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

  function esc(name) { w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); }
  function tab(shift) { return w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Tab", shiftKey: !!shift, bubbles: true, cancelable: true })); }
  function overlayChecks(j, label) {
    const main = w.document.querySelector("main");
    const wrap = $("graph-wrap");
    const expand = $("expand-graph");
    finding(j, label + "_drawer_closed_default", "hard", main.classList.contains("drawer-closed") && $("side").getAttribute("aria-hidden") === "true", label + ": Details is closed by default");
    finding(j, label + "_overlay_closed_default", "hard", !wrap.classList.contains("expanded") && !wrap.hasAttribute("role"), label + ": the overlay is closed by default");
    expand.focus();
    expand.click();
    finding(j, label + "_overlay_opens", "hard", wrap.classList.contains("expanded") && wrap.getAttribute("role") === "dialog" && wrap.getAttribute("aria-modal") === "true", label + ": Expand graph opens a modal dialog");
    finding(j, label + "_focus_in", "hard", wrap.contains(w.document.activeElement) && w.document.activeElement === $("overlay-close"), label + ": focus moves into the overlay");
    finding(j, label + "_zoom_controls", "hard", !$("zoom-in").closest("[hidden]") && !$("zoom-out").closest("[hidden]") && !$("zoom-fit").closest("[hidden]"), label + ": the overlay has Zoom in, Zoom out and Fit");
    let stays = true;
    for (let i = 0; i < 40; i++) { tab(false); if (!wrap.contains(w.document.activeElement)) stays = false; }
    for (let i = 0; i < 40; i++) { tab(true); if (!wrap.contains(w.document.activeElement)) stays = false; }
    const items = Array.prototype.filter.call(wrap.querySelectorAll("a[href], button, input, select, textarea, [tabindex='0']"), (el) => !el.disabled && !el.closest("[hidden]") && !el.closest("#side") && !el.closest("#results-wrap"));
    items[items.length - 1].focus();
    tab(false);
    const wrapsForward = w.document.activeElement === items[0];
    tab(true);
    const wrapsBack = w.document.activeElement === items[items.length - 1];
    finding(j, label + "_focus_trap", "hard", stays && wrapsForward && wrapsBack && items.length > 3, label + ": Tab wraps from the last control to the first, and Shift+Tab back, inside the overlay");
    const node = w.document.querySelector("#graph .node");
    node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    finding(j, label + "_click_opens_drawer", "hard", main.classList.contains("drawer-open") && wrap.contains($("side")), label + ": a click opens Details as a drawer inside the overlay");
    finding(j, label + "_tabs_kept", "hard", Array.prototype.map.call(w.document.querySelectorAll("nav.tabs .tab"), (b) => b.getAttribute("data-tab")).join(",") === "details,cascade,threats,dataflow,gaps,edit,export", label + ": the Details tabs are unchanged");
    $("drawer-close").click();
    finding(j, label + "_close_button_drawer", "hard", main.classList.contains("drawer-closed") && wrap.classList.contains("expanded"), label + ": Close hides Details and leaves the overlay open");
    node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    esc();
    finding(j, label + "_esc_drawer_first", "hard", main.classList.contains("drawer-closed") && wrap.classList.contains("expanded"), label + ": Esc closes the drawer first and keeps the overlay");
    esc();
    finding(j, label + "_esc_closes_overlay", "hard", !wrap.classList.contains("expanded") && !wrap.hasAttribute("aria-modal"), label + ": a second Esc closes the overlay");
    finding(j, label + "_focus_returns", "hard", w.document.activeElement === expand, label + ": focus returns to Expand graph");
    expand.click();
    $("overlay-close").click();
    finding(j, label + "_close_button_overlay", "hard", !wrap.classList.contains("expanded") && w.document.activeElement === expand, label + ": Close exits the overlay and returns focus");
    node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    finding(j, label + "_page_drawer_opens", "hard", main.classList.contains("drawer-open"), label + ": a click opens the drawer on the normal page too");
    esc();
    finding(j, label + "_page_drawer_esc", "hard", main.classList.contains("drawer-closed"), label + ": Esc closes the drawer on the normal page");
  }

  journey("graph_overlay", (j) => {
    w.TM_UI.setAssessment("holistic");
    w.TM_UI.load(JSON.parse(fs.readFileSync(path.join(DIR, "example-o2c.json"), "utf8")));
    overlayChecks(j, "holistic");
    finding(j, "holistic_filters_in_overlay", "hard", (function () { $("expand-graph").click(); const ok = !$("rel-filters").hidden && $("rel-filters").querySelectorAll("input").length > 3; $("overlay-close").click(); return ok; })(), "Holistic: the relationship filters are in the overlay");
    w.TM_UI.setAssessment("L2");
    overlayChecks(j, "scoped_l2");
    w.TM_UI.setAssessment("L5");
    overlayChecks(j, "scoped_l5");
    $("expand-graph").click();
    finding(j, "scoped_overlay_cards", "hard", !!w.document.querySelector("#graph .scoped-canvas") && !$("graph-svg"), "Scoped: the HTML card canvas is what expands");
    $("overlay-close").click();
    w.TM_UI.setAssessment("holistic");
  });

  journey("drawer_beside_graph", (j) => {
    const css = Array.prototype.map.call(w.document.querySelectorAll("style"), (st) => st.textContent).join("\n");
    finding(j, "css_offsets_graph", "hard", /@media \(min-width: 761px\)\s*\{[^}]*main\.drawer-open #graph-wrap > #graph-scroll[^}]*margin-right:\s*min\(var\(--drawer-w\)/.test(css), "On wide screens the open drawer narrows the graph area by its own width");
    finding(j, "css_phone_padding", "hard", /main\.drawer-open #graph-scroll[^{]*\{[^}]*padding-bottom:\s*min\(50vh, 440px\)/.test(css), "On phones the graph keeps room to scroll above the bottom sheet");
    ["holistic", "L2", "L5"].forEach((mode) => {
      w.TM_UI.setAssessment(mode);
      const sc = $("graph-scroll");
      sc.scrollLeft = 7; sc.scrollTop = 11;
      const node = w.document.querySelector("#graph .node");
      let revealed = 0;
      w.Element.prototype.scrollIntoView = function () { revealed++; };
      node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      finding(j, mode + "_reveals_selected", "hard", revealed >= 1, mode + ": opening Details scrolls the selected box into view");
      sc.scrollLeft = 99; sc.scrollTop = 98;
      w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      finding(j, mode + "_restores_view", "hard", sc.scrollLeft === 7 && sc.scrollTop === 11 && w.document.querySelector("main").classList.contains("drawer-closed"), mode + ": closing Details restores the earlier view");
    });
    w.TM_UI.setAssessment("holistic");
  });

  journey("heuristic_summary", (j) => {
    const css = Array.prototype.map.call(w.document.querySelectorAll("style"), (s) => s.textContent).join("\n");
    finding(j, "graph_flex_space", "hard", /body\s*\{[^}]*overflow:\s*visible/.test(css) && /#graph-scroll\s*\{[^}]*overflow:\s*visible/.test(css), "The page scrolls and the graph keeps its own height");
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
