// Browser tests for the AI Security & Accountability Explorer (tools/relationship-map).
// Serves the repo root, loads the page in Chrome through puppeteer-core, and checks
// the search index, the full control list, the layer filter, and the link-basis labels
// against the JSON files the page reads. Expected sets are computed from the data,
// not copied from the page.
// Run from tools/relationship-map/tests after npm ci. Set RELMAP_ARTIFACTS=<dir> to
// also write relmap-1280.png, relmap-search-1280.png, and relmap-375.png.
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");

const puppeteer = require("puppeteer-core");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const CHROME = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/local/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean).find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error("FAIL relationship-map tests need a Chrome binary. Set CHROME_PATH.");
  process.exit(1);
}

const MODELS = ["AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS"];
const LAYERS = ["L1", "L2", "L3", "L4", "L5"];
const CONTROL_FILES = ["finance", "healthcare", "insurance", "public-sector", "defense", "manufacturing"];
const FRAMEWORK_KEYS = ["owasp_llm_top10", "mitre_atlas", "owasp_dsgai"];
const ARTIFACTS = process.env.RELMAP_ARTIFACTS || "";

function readData(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data", file), "utf8"));
}

const threatsFile = readData("threats.json");
const threats = threatsFile.threats;
const sectorMap = {};
readData("sector-model-map.json").mappings.forEach((row) => {
  if (row.sector_model && row.srf_model) sectorMap[row.sector_model] = row.srf_model;
});

const controls = [];
CONTROL_FILES.forEach((slug) => {
  const file = readData(slug + "-controls.json");
  if (file.provenance === "proposed-extension") return;
  file.controls.forEach((control) => {
    if (control.provenance === "proposed-extension") return;
    const core = [];
    (control.operating_models || []).forEach((model) => {
      const srf = MODELS.indexOf(model) !== -1 ? model : sectorMap[model];
      if (srf && core.indexOf(srf) === -1) core.push(srf);
    });
    controls.push({ nodeId: "control:" + slug + ":" + control.id, id: control.id, layer: control.layer, core: core, name: control.title, description: control.description || "" });
  });
});
const inChainCore = controls.filter((c) => c.core.length);

const dsgaiUrl = threatsFile.sources.owasp_dsgai.url;
const dsgaiThreats = threats.filter((t) => t.dsgai);

let failed = 0;
let passed = 0;
function check(name, ok, detail) {
  if (ok) passed += 1;
  else failed += 1;
  console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : "  " + (detail || "")));
}
function sameSet(a, b) {
  const x = Array.from(new Set(a)).sort();
  const y = Array.from(new Set(b)).sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}
function diff(a, b) {
  return { missing: b.filter((v) => a.indexOf(v) === -1).slice(0, 10), extra: a.filter((v) => b.indexOf(v) === -1).slice(0, 10) };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(ROOT, p.endsWith("/") ? p + "index.html" : p);
    if (file.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function openPage(browser, base, width, height, query) {
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/tools/relationship-map/index.html" + (query || ""), { waitUntil: "load" });
  await page.waitForSelector('#map-status[data-ready="true"]', { timeout: 60000 });
  page.__errors = errors;
  return page;
}

const idsIn = (page, selector) => page.$$eval(selector, (els) => els.map((el) => el.dataset.nodeId || el.dataset.chainId));

async function pickModel(page, model) {
  await page.click('input[name="operating-model"][value="' + model + '"]');
  await sleep(150);
}
async function pickLayer(page, layer) {
  await page.click('input[name="layer"][value="' + layer + '"]');
  await sleep(150);
}
async function openEntry(page, entry) {
  await page.click("#entry-" + entry);
  await sleep(150);
}
async function search(page, text) {
  await page.$eval("#node-search", (el) => { el.value = ""; });
  await page.click("#node-search", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#node-search", text);
  await sleep(200);
}

async function testSearchIndex(browser, base) {
  console.log("\n## Search index: framework IDs and descriptions");
  const page = await openPage(browser, base, 1280, 900, "");
  const frameworkIds = ["LLM01", "AML.T0051", "DSGAI02", "LLM04", "AML.T0018.000", "dsgai21"];
  for (const token of frameworkIds) {
    const needle = token.toLowerCase();
    const expected = threats.filter((t) => FRAMEWORK_KEYS.some((key) => {
      const value = (t.mappings || {})[key];
      return value && String(value).toLowerCase().indexOf(needle) !== -1;
    })).map((t) => "risk:" + t.id);
    await search(page, token);
    const shown = await idsIn(page, "#search-results button[data-node-id]");
    const shownRisks = shown.filter((id) => id.indexOf("risk:") === 0);
    const d = diff(shownRisks, expected);
    check("search \"" + token + "\" finds every threat that records it (" + expected.length + ")", d.missing.length === 0 && expected.length > 0, JSON.stringify(d));
    check("search \"" + token + "\" returns no threat that does not record it", d.extra.length === 0, JSON.stringify(d));
  }
  await search(page, "Model behaviour integrity");
  const impactHits = await idsIn(page, "#search-results button[data-node-id]");
  check("search matches a threat impact description", impactHits.indexOf("risk:directpromptinjection") !== -1, JSON.stringify(impactHits));

  const probe = controls.find((c) => /board-approved AI risk appetite statement/.test(c.description));
  await search(page, "board-approved AI risk appetite statement");
  const descHits = await idsIn(page, "#search-results button[data-node-id]");
  check("search matches a control description", !!probe && descHits.indexOf(probe.nodeId) !== -1, JSON.stringify(descHits));

  await search(page, "LLM01");
  await page.$eval("#find-form", (el) => el.scrollIntoView({ block: "start" }));
  await sleep(100);
  if (ARTIFACTS) await page.screenshot({ path: path.join(ARTIFACTS, "relmap-search-1280.png") });
  check("no page errors during search tests", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

async function testFullControlList(browser, base) {
  console.log("\n## Explore a control lists every control for the chosen model");
  const page = await openPage(browser, base, 1280, 900, "");
  await openEntry(page, "control");
  const sample = await idsIn(page, "#suggestions button[data-node-id]");
  const sampleLayers = sample.map((id) => controls.find((c) => c.nodeId === id)).map((c) => c && c.layer);
  check("All models and All layers shows one sample control per layer", sample.length === LAYERS.length && sameSet(sampleLayers, LAYERS), JSON.stringify(sample));
  check("the source note says the controls come from the sector catalogs", await page.$eval("#control-source-note", (el) => /sector catalogs/.test(el.textContent) && /CoSAI Risk Map controls\.yaml/.test(el.textContent) && !el.hidden));

  for (const model of MODELS) {
    await pickModel(page, model);
    await openEntry(page, "control");
    const expected = inChainCore.filter((c) => c.core.indexOf(model) !== -1).map((c) => c.nodeId);
    const shown = await idsIn(page, "#suggestions button[data-node-id]");
    const d = diff(shown, expected);
    check(model + " lists all " + expected.length + " controls, no sample", shown.length === expected.length && d.missing.length === 0 && d.extra.length === 0, JSON.stringify(d));
    const note = await page.$eval("#search-note", (el) => el.textContent);
    check(model + " note states the count and the model", note.indexOf(expected.length + " controls list " + model) === 0, note);
  }
  await pickModel(page, "all");
  await page.close();
}

async function testLayerFilter(browser, base) {
  console.log("\n## Layer filter");
  const page = await openPage(browser, base, 1280, 900, "");
  const radios = await page.$$eval('input[name="layer"]', (els) => els.map((el) => el.value));
  check("layer filter offers All plus L1 to L5", sameSet(radios, ["all"].concat(LAYERS)), JSON.stringify(radios));
  const label = await page.$eval('fieldset.layer-filter legend', (el) => el.textContent.trim());
  check("layer filter sits in its own fieldset labeled Layer", label === "Layer", label);
  const l5 = await page.$$eval('#layer-filter-list .model-option span', (els) => els.map((el) => el.textContent.trim()));
  check("layer names come from data/layers.json (L5 is AI Model Provider)", l5.indexOf("L5 AI Model Provider") !== -1 && l5.indexOf("L1 AI Business & Usage") !== -1, JSON.stringify(l5));

  await pickLayer(page, "L3");
  check("choosing L3 puts layer=L3 in the URL", /[?&]layer=L3/.test(page.url()), page.url());
  await openEntry(page, "control");
  const expectedL3 = inChainCore.filter((c) => c.layer === "L3").map((c) => c.nodeId);
  const shownL3 = await idsIn(page, "#suggestions button[data-node-id]");
  const d1 = diff(shownL3, expectedL3);
  check("L3 with All models lists every L3 control that sits in an operating model (" + expectedL3.length + ")", shownL3.length === expectedL3.length && d1.missing.length === 0 && d1.extra.length === 0, JSON.stringify(d1));

  await openEntry(page, "threat");
  const expectedRisks = threats.filter((t) => t.srf_layer === "L3").map((t) => "risk:" + t.id);
  const shownRisks = await idsIn(page, "#risk-suggestions button[data-node-id]");
  const d2 = diff(shownRisks, expectedRisks);
  check("L3 limits the threat list to threats at L3 (" + expectedRisks.length + ")", shownRisks.length === expectedRisks.length && d2.missing.length === 0 && d2.extra.length === 0, JSON.stringify(d2));

  await pickModel(page, "AI-PaaS");
  await openEntry(page, "control");
  const expectedPaaS = inChainCore.filter((c) => c.layer === "L3" && c.core.indexOf("AI-PaaS") !== -1).map((c) => c.nodeId);
  const shownPaaS = await idsIn(page, "#suggestions button[data-node-id]");
  const d3 = diff(shownPaaS, expectedPaaS);
  check("AI-PaaS with L3 lists the AI-PaaS controls at L3 (" + expectedPaaS.length + ")", shownPaaS.length === expectedPaaS.length && d3.missing.length === 0 && d3.extra.length === 0, JSON.stringify(d3));
  check("both filters are in the URL", /[?&]model=AI-PaaS/.test(page.url()) && /[?&]layer=L3/.test(page.url()), page.url());
  await page.close();

  const deep = await openPage(browser, base, 1280, 900, "?layer=L5&model=IaaS");
  const checked = await deep.$$eval('input[name="layer"]:checked, input[name="operating-model"]:checked', (els) => els.map((el) => el.value));
  check("a shared link restores layer and model", sameSet(checked, ["L5", "IaaS"]), JSON.stringify(checked));
  await deep.close();

  const chainPage = await openPage(browser, base, 1280, 900, "?risk=dsgai02&layer=L4");
  const dsgai02 = threats.find((t) => t.id === "dsgai02");
  const crossLayer = (dsgai02.related_controls || []).map((fullId) => "control:" + fullId.replace(/^srf\.control\./, "").replace(/\.([^.]+)$/, ":$1")).filter((id) => {
    const c = controls.find((x) => x.nodeId === id);
    return c && c.core.length && c.layer !== "L4";
  });
  const chainControls = await idsIn(chainPage, "#chain-board button[data-chain-id]");
  check("an open chain keeps controls from other layers under a layer filter", crossLayer.length > 0 && crossLayer.every((id) => chainControls.indexOf(id) !== -1), JSON.stringify({ crossLayer: crossLayer, chainControls: chainControls }));
  await chainPage.close();
}

async function testLinkBasis(browser, base) {
  console.log("\n## Link basis labels on the chain");
  const derived = threats.find((t) => t.id === "directpromptinjection");
  const official = threats.find((t) => (t.obligations || []).some((o) => o.basis === "official_text"));
  const page = await openPage(browser, base, 1280, 900, "?risk=directpromptinjection");
  const obligationChips = await page.$$eval('#chain-board button[data-chain-id^="obligation:"]', (els) => els.map((el) => el.textContent));
  check("risk-to-obligation cards name the recorded derived basis", obligationChips.length > 0 && obligationChips.every((t) => t.indexOf("Basis: derived through a shared control (derived_via_control).") !== -1), JSON.stringify(obligationChips.slice(0, 2)));
  const personaChips = await page.$$eval('#chain-board button[data-chain-id^="accountable:"]', (els) => els.map((el) => el.textContent));
  check("control-to-persona cards say no basis is recorded", personaChips.length > 0 && personaChips.every((t) => t.indexOf("Basis: none recorded. accountable_by_model names this persona.") !== -1), JSON.stringify(personaChips.slice(0, 1)));
  const details = await page.$eval("#details-chain", (el) => el.textContent);
  check("details name the recorded basis value in plain words", details.indexOf("Recorded basis: derived_via_control.") !== -1 && details.indexOf("Basis: none recorded.") !== -1, details.slice(0, 200));
  check("details keep the threat definition link for an AI Exchange threat", await page.$$eval("#details-chain a", (els, url) => els.some((a) => a.href === url && a.textContent === "Threat definition"), derived.ai_exchange));
  await page.close();

  if (official) {
    const officialPage = await openPage(browser, base, 1280, 900, "?risk=" + official.id);
    const text = await officialPage.$$eval('#chain-board button[data-chain-id^="obligation:"]', (els) => els.map((el) => el.textContent).join(" | "));
    check("official-text links say so in the chain (" + official.id + ")", text.indexOf("Basis: official text (official_text).") !== -1, text.slice(0, 200));
    await officialPage.close();
  } else {
    check("data has at least one official_text link to test", false, "none found");
  }

  const controlPage = await openPage(browser, base, 1280, 900, "?control=finance:SRF-L3-DEV-001");
  const controlChips = await controlPage.$$eval('#chain-board button[data-chain-id^="obligation:"], #chain-board button[data-chain-id^="instrument:"]', (els) => els.map((el) => el.textContent).join(" | "));
  check("control chain names the citation field behind each obligation", controlChips.indexOf("Basis: citation on this control (mappings.") !== -1, controlChips.slice(0, 200));
  check("control chain groups risk-to-obligation bases by recorded value", /Risk to obligation, \d+ threats?\. Basis: derived through a shared control \(derived_via_control\)\./.test(controlChips), controlChips.slice(0, 300));
  await controlPage.close();
}

async function testDsgaiSourceLinks(browser, base) {
  console.log("\n## DSGAI threats link to the file-level source");
  const page = await openPage(browser, base, 1280, 900, "");
  check("data has 15 DSGAI threats", dsgaiThreats.length === 15, String(dsgaiThreats.length));
  const linkTexts = [];
  for (const threat of dsgaiThreats) {
    await search(page, threat.id);
    await page.click('#search-results button[data-node-id="risk:' + threat.id + '"]');
    await sleep(120);
    const found = await page.$$eval("#details-chain a", (els, url) => els.filter((a) => a.href === url).map((a) => a.textContent), dsgaiUrl);
    linkTexts.push(found[0] || "");
    check(threat.id + " links to the DSGAI source document", found.length === 1, JSON.stringify(found));
  }
  check("the DSGAI link label names the source", linkTexts.every((t) => t === threatsFile.sources.owasp_dsgai.name), JSON.stringify(linkTexts.slice(0, 1)));
  await page.close();
}

async function testWording(browser, base) {
  console.log("\n## Search label wording");
  const page = await openPage(browser, base, 1280, 900, "");
  const label = await page.$eval('label[for="node-search"]', (el) => el.textContent.trim());
  check("search label says threat or control", label === "Find a threat or a control", label);
  const placeholder = await page.$eval("#node-search", (el) => el.placeholder);
  check("search placeholder says threat or control", placeholder === "Threat or control name", placeholder);
  const help = await page.$eval("#map-help", (el) => el.textContent);
  check("search help text says threat or control", /Type a threat or a control name/.test(help), help);
  const heading = await page.$eval("#risk-suggestions-heading", (el) => el.textContent.trim());
  check("threat list heading is Threats", heading === "Threats", heading);
  await openEntry(page, "threat");
  const hidden = await page.$eval("#control-source-note", (el) => el.hidden);
  check("control source note is hidden on Explore a threat", hidden === true);
  await page.close();
}

async function captureMobile(browser, base) {
  if (!ARTIFACTS) return;
  const page = await openPage(browser, base, 375, 812, "");
  await openEntry(page, "control");
  await pickModel(page, "AI-SaaS");
  await page.$eval("#find-form", (el) => el.scrollIntoView({ block: "start" }));
  await sleep(150);
  await page.screenshot({ path: path.join(ARTIFACTS, "relmap-375.png") });
  await page.close();
}

async function captureDesktop(browser, base) {
  if (!ARTIFACTS) return;
  const page = await openPage(browser, base, 1280, 900, "");
  await openEntry(page, "control");
  await pickModel(page, "AI-SaaS");
  await pickLayer(page, "L3");
  await openEntry(page, "control");
  const clip = await page.evaluate(() => {
    const top = document.getElementById("find-form").getBoundingClientRect().top + window.scrollY - 24;
    const bottom = document.querySelector(".layer-filter").getBoundingClientRect().bottom + window.scrollY + 8;
    return { x: 0, y: Math.max(0, top), width: 1280, height: bottom - Math.max(0, top) };
  });
  await page.screenshot({ path: path.join(ARTIFACTS, "relmap-1280.png"), clip: clip, captureBeyondViewport: true });
  await page.close();
}

async function main() {
  const server = await serve();
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  });
  try {
    await testSearchIndex(browser, base);
    await testFullControlList(browser, base);
    await testLayerFilter(browser, base);
    await testLinkBasis(browser, base);
    await testDsgaiSourceLinks(browser, base);
    await testWording(browser, base);
    await captureDesktop(browser, base);
    await captureMobile(browser, base);
  } finally {
    await browser.close();
    server.close();
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error("FAIL " + (err && err.stack || err));
  process.exit(1);
});
