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
async function clickNow(page, selector) {
  await page.$eval(selector, (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.click(selector);
}
async function openEntry(page, entry) {
  await clickNow(page, "#entry-" + entry);
  await sleep(300);
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
    const shown = await idsIn(page, "#search-results [role=option][data-node-id]");
    const shownRisks = shown.filter((id) => id.indexOf("risk:") === 0);
    const d = diff(shownRisks, expected);
    check("search \"" + token + "\" finds every threat that records it (" + expected.length + ")", d.missing.length === 0 && expected.length > 0, JSON.stringify(d));
    check("search \"" + token + "\" returns no threat that does not record it", d.extra.length === 0, JSON.stringify(d));
  }
  await search(page, "Model behaviour integrity");
  const impactHits = await idsIn(page, "#search-results [role=option][data-node-id]");
  check("search matches a threat impact description", impactHits.indexOf("risk:directpromptinjection") !== -1, JSON.stringify(impactHits));

  const probe = controls.find((c) => /board-approved AI risk appetite statement/.test(c.description));
  await search(page, "board-approved AI risk appetite statement");
  const descHits = await idsIn(page, "#search-results [role=option][data-node-id]");
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
  const everyShown = await idsIn(page, "#suggestions button[data-node-id]");
  const dAll = diff(everyShown, inChainCore.map((c) => c.nodeId));
  check("All models and All layers lists every control that sits in an operating model (" + inChainCore.length + ")", everyShown.length === inChainCore.length && dAll.missing.length === 0 && dAll.extra.length === 0, JSON.stringify(dAll));
  check("the source note says the controls come from the sector catalogs", await page.$eval("#control-source-note", (el) => /sector catalogs/.test(el.textContent) && /CoSAI Risk Map controls\.yaml/.test(el.textContent) && !el.hidden));

  for (const model of MODELS) {
    await pickModel(page, model);
    await openEntry(page, "control");
    const expected = inChainCore.filter((c) => c.core.indexOf(model) !== -1).map((c) => c.nodeId);
    const shown = await idsIn(page, "#suggestions button[data-node-id]");
    const d = diff(shown, expected);
    check(model + " lists all " + expected.length + " controls, no sample", shown.length === expected.length && d.missing.length === 0 && d.extra.length === 0, JSON.stringify(d));
    const summary = await page.$eval("#filter-summary", (el) => el.textContent);
    check(model + " summary states the model and the count", summary === model + ", all layers: " + expected.length + " controls", summary);
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
  const paasSummary = await page.$eval("#filter-summary", (el) => el.textContent);
  check("the summary names both filters and the control count", paasSummary === "AI-PaaS, L3: " + expectedPaaS.length + " controls", paasSummary);
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
    await page.click('#search-results [role=option][data-node-id="risk:' + threat.id + '"]');
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

const inView = (page, selector) => page.$eval(selector, (el) => {
  const r = el.getBoundingClientRect();
  return r.height > 0 && r.top >= 0 && r.top < window.innerHeight * 0.5;
});
const activeId = (page) => page.evaluate(() => document.activeElement.id || document.activeElement.tagName);

async function testNavigation(browser, base) {
  console.log("\n## Navigation: jump links, skip link, focus, scrolling, search wording");
  const page = await openPage(browser, base, 1280, 800, "");

  const initial = await page.evaluate(() => {
    const order = (a, b) => !!(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
    const levels = Array.from(document.querySelectorAll("main h1, main h2, main h3, main h4")).filter((h) => !h.closest("[hidden]")).map((h) => Number(h.tagName[1]));
    let skipped = 0;
    levels.forEach((n, i) => { if (i && n - levels[i - 1] > 1) skipped += 1; });
    const targets = Array.from(document.querySelectorAll("a[data-jump], a.skip-link, .map-jump a")).filter((a) => !a.closest(".chain-jump")).map((a) => a.getAttribute("href"));
    return {
      searchBottom: document.getElementById("node-search").getBoundingClientRect().bottom,
      searchBeforeDomains: order("#find-form", ".layer-frames"),
      personasBeforeIllustrative: order("#persona-list", ".illustrative"),
      skipped: skipped,
      targets: targets.filter((href) => href && href[0] === "#").map((href) => ({ href: href, exists: !!document.getElementById(href.slice(1)) })),
      skipLinks: document.querySelectorAll("a.skip-link").length
    };
  });
  check("the search field is in the first screen at 1280x800", initial.searchBottom <= 800, String(initial.searchBottom));
  check("the search form comes before the Security domains block", initial.searchBeforeDomains);
  check("the persona list comes before the illustrative table", initial.personasBeforeIllustrative);
  check("visible headings never skip a level", initial.skipped === 0, String(initial.skipped));
  check("there is a skip link to the content and one to search", initial.skipLinks >= 2, String(initial.skipLinks));
  check("every in-page link on the first view has a target", initial.targets.length >= 6 && initial.targets.every((t) => t.exists), JSON.stringify(initial.targets.filter((t) => !t.exists)));

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const skipText = await page.evaluate(() => document.activeElement.textContent.trim());
  await page.keyboard.press("Enter");
  await sleep(150);
  check("Tab twice, then Enter on Skip to search, focuses the search field", skipText === "Skip to search" && (await activeId(page)) === "node-search", skipText + " / " + await activeId(page));

  await search(page, "stop prompt injection");
  const words = await page.evaluate(() => ({
    note: document.getElementById("search-note").textContent,
    ids: Array.from(document.querySelectorAll("#search-results [role=option]")).map((b) => b.dataset.nodeId)
  }));
  check("a plain phrase with no exact hit matches records by word count", /No record has that exact phrase/.test(words.note) && /at least 2 of your 3 words/.test(words.note), words.note);
  check("'stop prompt injection' lists the prompt injection threats", words.ids.indexOf("risk:directpromptinjection") !== -1 && words.ids.indexOf("risk:indirectpromptinjection") !== -1, JSON.stringify(words.ids));
  await search(page, "protect training data");
  const train = await page.evaluate(() => ({ note: document.getElementById("search-note").textContent, n: document.querySelectorAll("#search-results [role=option]").length }));
  check("'protect training data' returns records", train.n > 0 && /at least 2 of your 3 words/.test(train.note), train.note);

  await search(page, "prompt injection");
  const counts = await page.evaluate(() => ({
    note: document.getElementById("search-note").textContent,
    shown: document.querySelectorAll("#search-results [role=option]").length,
    showAll: !document.getElementById("show-all-results").hidden,
    showAllText: document.getElementById("show-all-results").textContent
  }));
  const total = Number((counts.note.match(/^(\d+) records match/) || [])[1]);
  check("the search note counts threats and controls", /^\d+ records match: \d+ threats? and \d+ controls?\./.test(counts.note), counts.note);
  const nThreats = Number((counts.note.match(/: (\d+) threats?/) || [])[1]);
  const nControls = Number((counts.note.match(/and (\d+) controls?/) || [])[1]);
  check("each group shows up to eight matches and the rest are behind a Show all button", counts.shown === Math.min(nThreats, 8) + Math.min(nControls, 8) && counts.showAll && counts.showAllText === "Show all " + total + " matches", JSON.stringify(counts));
  await page.click("#show-all-results");
  await sleep(150);
  const all = await page.evaluate(() => ({ shown: document.querySelectorAll("#search-results [role=option]").length, hidden: document.getElementById("show-all-results").hidden, activeInList: !!document.getElementById(document.activeElement.getAttribute("aria-activedescendant") || "none") }));
  check("Show all lists every match and highlights the first new one", all.shown === total && all.hidden && all.activeInList, JSON.stringify(all));

  await page.click('#search-results [role=option][data-node-id="risk:directpromptinjection"]');
  await sleep(900);
  const opened = await page.evaluate(() => ({
    active: document.activeElement.id,
    text: document.getElementById("chain-heading").textContent,
    level: document.getElementById("chain-heading").tagName,
    jumpChainShown: !document.getElementById("jump-chain").hidden
  }));
  check("choosing a threat moves focus to the chain heading", opened.active === "chain-heading" && opened.level === "H2" && /^Chain for Direct prompt injection/.test(opened.text), JSON.stringify(opened));
  check("the chain heading is in the first half of the window after choosing", await inView(page, "#chain-heading"));
  check("the Chain jump link appears with a chain", opened.jumpChainShown);

  const columnTargets = await page.$$eval(".chain-jump a", (links) => links.map((a) => ({ href: a.getAttribute("href"), exists: !!document.getElementById(a.getAttribute("href").slice(1)) })));
  check("every chain jump link has a target", columnTargets.length === 5 && columnTargets.every((t) => t.exists), JSON.stringify(columnTargets));
  await page.click('.chain-jump a[href="#chain-col-accountable"]');
  await sleep(900);
  check("the Accountable jump link moves focus to that column", (await activeId(page)) === "chain-col-accountable" && (await inView(page, "#chain-col-accountable")));
  await page.click('.chain-jump a[href="#node-search"]');
  await sleep(900);
  check("Find another focuses the search field", (await activeId(page)) === "node-search");

  await search(page, "direct prompt injection");
  await page.click('#search-results [role=option][data-node-id="risk:directpromptinjection"]');
  await sleep(900);
  await clickNow(page, "#clear-selection");
  await sleep(900);
  const cleared = await page.evaluate(() => ({ active: document.activeElement.id, chainHidden: document.getElementById("chain").hidden }));
  check("Clear selection returns focus to the search field", cleared.active === "node-search" && cleared.chainHidden, JSON.stringify(cleared));

  await page.$eval("#entry-account", (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.click("#entry-account");
  await sleep(900);
  await page.click("#persona-list button");
  await sleep(900);
  const persona = await page.evaluate(() => ({ active: document.activeElement.id, text: document.getElementById("chain-heading").textContent }));
  check("choosing a persona moves focus to its chain heading", persona.active === "chain-heading" && /^Chain for /.test(persona.text), JSON.stringify(persona));
  check("the persona chain heading is in the first half of the window", await inView(page, "#chain-heading"));
  check("no page errors on desktop", page.__errors.length === 0, page.__errors.join("; "));
  await page.close();

  const phone = await openPage(browser, base, 375, 812, "");
  await phone.keyboard.press("Tab");
  await phone.keyboard.press("Tab");
  await phone.keyboard.press("Enter");
  await sleep(150);
  check("the skip link works at 375 wide", (await activeId(phone)) === "node-search");
  await search(phone, "prompt injection");
  await sleep(900);
  const firstTop = await phone.$eval("#search-results [role=option]", (el) => el.getBoundingClientRect().top);
  check("the first match is on screen after typing at 375 wide", firstTop >= 0 && firstTop < 812 * 0.85, String(firstTop));
  await phone.click('#search-results [role=option][data-node-id="risk:directpromptinjection"]');
  await sleep(900);
  check("the chain heading is in the first half of the phone window", (await activeId(phone)) === "chain-heading" && await inView(phone, "#chain-heading"));
  await phone.click('.chain-jump a[href="#chain-col-obligation"]');
  await sleep(900);
  check("the Obligation jump link works at 375 wide", (await activeId(phone)) === "chain-col-obligation" && await inView(phone, "#chain-col-obligation"));
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("the page does not scroll sideways at 375 wide", overflow <= 0, String(overflow));
  check("no page errors at 375 wide", phone.__errors.length === 0, phone.__errors.join("; "));
  await phone.close();
}

const sheetState = (page) => page.evaluate(() => {
  const d = document.querySelector(".details");
  const r = d.getBoundingClientRect();
  return {
    shown: getComputedStyle(d).display !== "none",
    left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height),
    sheetOpen: document.body.classList.contains("sheet-open"),
    stageInert: document.querySelector(".map-stage").hasAttribute("inert")
  };
});
const graphState = (page) => page.evaluate(() => {
  const g = document.getElementById("graph");
  const dims = window.__relationshipMap.renderer.getDimensions();
  const canvas = g.querySelector("canvas");
  return {
    visibility: getComputedStyle(g).visibility,
    clientWidth: g.clientWidth, clientHeight: g.clientHeight, offsetWidth: g.offsetWidth, offsetHeight: g.offsetHeight,
    sigmaWidth: dims.width, sigmaHeight: dims.height,
    canvasWidth: canvas ? canvas.clientWidth : 0,
    focusable: g.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').length,
    wrapHeight: Math.round(g.parentNode.getBoundingClientRect().height)
  };
});

async function testListView(browser, base) {
  console.log("\n## List view: catalog first, filters above the results, summary line, side panel");
  const page = await openPage(browser, base, 1280, 800, "");
  const first = await page.evaluate(() => {
    const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
    const order = (a, b) => !!(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
    return {
      threats: document.querySelectorAll("#risk-suggestions button[data-node-id]").length,
      controls: document.querySelectorAll("#suggestions button[data-node-id]").length,
      summary: document.getElementById("filter-summary").textContent,
      filtersBeforeResults: order("#map-filters", "#risk-suggestions") && order("#map-filters", "#suggestions") && order("#map-filters", "#search-results"),
      summaryBeforeResults: order("#filter-summary", "#risk-suggestions"),
      chainHidden: document.getElementById("chain").hidden,
      emptyShown: !document.getElementById("details-empty").hidden,
      panelLeft: rect(".details").left, finderRight: rect(".map-stage").right,
      wrapHeight: Math.round(document.querySelector(".graph-wrap").getBoundingClientRect().height)
    };
  });
  check("the catalog lists every threat on load (" + threats.length + ")", first.threats === threats.length, String(first.threats));
  check("the catalog lists every control that sits in an operating model on load (" + inChainCore.length + ")", first.controls === inChainCore.length, String(first.controls));
  check("the summary line gives the filters and both counts", first.summary === "All operating models, all layers: " + inChainCore.length + " controls, " + threats.length + " threats", first.summary);
  check("the filters and the summary come before the results", first.filtersBeforeResults && first.summaryBeforeResults);
  check("the side panel sits beside the list and starts empty", first.chainHidden && first.emptyShown && first.panelLeft >= first.finderRight, JSON.stringify(first));
  check("no blank graph panel on load", first.wrapHeight < 120, String(first.wrapHeight));

  await pickModel(page, "AI-SaaS");
  await pickLayer(page, "L3");
  const filtered = await page.$eval("#filter-summary", (el) => el.textContent);
  const nControls = inChainCore.filter((c) => c.layer === "L3" && c.core.indexOf("AI-SaaS") !== -1).length;
  const nThreats = threats.filter((t) => t.srf_layer === "L3").length;
  check("the summary reads 'AI-SaaS, L3: N controls, M threats'", filtered === "AI-SaaS, L3: " + nControls + " controls, " + nThreats + " threats", filtered);
  await openEntry(page, "threat");
  const threatSummary = await page.$eval("#filter-summary", (el) => el.textContent);
  check("the summary follows Explore a threat", threatSummary === "AI-SaaS, L3: " + nThreats + " threats", threatSummary);

  await pickModel(page, "all");
  await pickLayer(page, "all");
  await openEntry(page, "threat");
  await page.click('#risk-suggestions button[data-node-id="risk:directpromptinjection"]');
  await sleep(600);
  const open = await page.evaluate(() => {
    const panel = document.querySelector(".details").getBoundingClientRect();
    const chain = document.getElementById("chain").getBoundingClientRect();
    const list = document.getElementById("risk-suggestions").getBoundingClientRect();
    return { chainInPanel: chain.left >= panel.left - 1 && chain.right <= panel.right + 1 && chain.height > 100, listStillThere: list.height > 0 && list.right <= panel.left, active: document.activeElement.id, panelTopInView: panel.top >= 0 && panel.top < 200 };
  });
  check("choosing a threat opens its chain in the side panel and the list stays", open.chainInPanel && open.listStillThere && open.active === "chain-heading", JSON.stringify(open));
  check("the side panel stays in view while the list scrolls", open.panelTopInView);
  await page.evaluate(() => window.scrollTo(0, 400));
  await sleep(300);
  check("the panel is still on screen after scrolling the page", await page.$eval(".details", (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < 300; }));
  check("no page errors in the list view", page.__errors.length === 0, page.__errors.join("; "));
  await page.close();
}

async function testGraphToggle(browser, base) {
  console.log("\n## Graph is optional: hidden until opened, Sigma resizes when it opens");
  const page = await openPage(browser, base, 1280, 800, "");
  const hidden = await graphState(page);
  check("the graph is hidden on load and out of the tab order", hidden.visibility === "hidden" && hidden.focusable === 0 && hidden.wrapHeight < 120, JSON.stringify(hidden));
  check("Show graph is offered and Hide graph is not", await page.evaluate(() => !document.getElementById("show-graph").hidden && document.getElementById("hide-graph").hidden));

  await page.click("#show-graph");
  await sleep(900);
  const shown = await graphState(page);
  check("Show graph reveals the graph", shown.visibility === "visible" && shown.clientWidth > 300 && shown.clientHeight > 300, JSON.stringify(shown));
  check("Sigma matches the container size after it opens", shown.sigmaWidth === shown.offsetWidth && shown.sigmaHeight === shown.offsetHeight && shown.canvasWidth > 0 && Math.abs(shown.canvasWidth - shown.sigmaWidth) <= 1, JSON.stringify(shown));
  check("focus moves to Hide graph and the URL records the graph", (await activeId(page)) === "hide-graph" && /[?&]graph=1/.test(page.url()), (await activeId(page)) + " " + page.url());
  await page.click("#hide-graph");
  await sleep(500);
  const closed = await graphState(page);
  check("Hide graph hides it again and focus returns to Show graph", closed.visibility === "hidden" && (await activeId(page)) === "show-graph" && !/graph=1/.test(page.url()), JSON.stringify(closed) + (await activeId(page)));

  await page.setViewport({ width: 1000, height: 800 });
  await sleep(300);
  await page.click("#show-graph");
  await sleep(900);
  const resized = await graphState(page);
  check("Sigma follows a window resize that happened while the graph was hidden", resized.clientWidth < shown.clientWidth && resized.sigmaWidth === resized.offsetWidth && resized.sigmaHeight === resized.offsetHeight, JSON.stringify(resized));
  await page.close();

  const linked = await openPage(browser, base, 1280, 800, "?graph=1");
  check("a shared link with graph=1 opens the graph", (await graphState(linked)).visibility === "visible");
  await linked.close();

  const chainPage = await openPage(browser, base, 1280, 800, "?risk=directpromptinjection");
  check("an open chain offers Show graph", await chainPage.evaluate(() => !document.getElementById("show-graph").hidden && !document.getElementById("chain").hidden));
  await chainPage.click("#show-graph");
  await sleep(900);
  const focusView = await chainPage.evaluate(() => ({ chainHidden: document.getElementById("chain").hidden, hideShown: !document.getElementById("hide-graph").hidden }));
  const focusGraph = await graphState(chainPage);
  check("Show graph on a chain draws the graph for that threat", focusView.chainHidden && focusView.hideShown && focusGraph.visibility === "visible" && focusGraph.sigmaWidth === focusGraph.offsetWidth, JSON.stringify(focusGraph));
  await chainPage.click("#hide-graph");
  await sleep(600);
  check("Hide graph returns to the chain", await chainPage.evaluate(() => !document.getElementById("chain").hidden && document.activeElement.id === "chain-heading"));
  await chainPage.close();

  const phone = await openPage(browser, base, 375, 812, "");
  check("the map still loads at 375 wide with the panel closed", await phone.$eval("#map-status", (el) => el.dataset.ready === "true" && !document.getElementById("map-error").textContent));
  await phone.click("#show-graph");
  await sleep(900);
  const phoneGraph = await graphState(phone);
  const sheet = await sheetState(phone);
  check("Sigma sizes itself when the graph opens in the phone sheet", phoneGraph.clientWidth > 250 && phoneGraph.sigmaWidth === phoneGraph.offsetWidth && phoneGraph.sigmaHeight === phoneGraph.offsetHeight && sheet.shown, JSON.stringify({ phoneGraph, sheet }));
  await phone.click("#clear-selection");
  await sleep(500);
  check("Back to list closes the graph sheet", !(await sheetState(phone)).shown);
  check("no page errors with the graph at 375 wide", phone.__errors.length === 0, phone.__errors.join("; "));
  await phone.close();
}

async function testListbox(browser, base) {
  console.log("\n## Search listbox: ARIA combobox, grouped options, keyboard");
  const page = await openPage(browser, base, 1280, 800, "");
  const attrs = await page.$eval("#node-search", (el) => ({ role: el.getAttribute("role"), auto: el.getAttribute("aria-autocomplete"), expanded: el.getAttribute("aria-expanded"), controls: el.getAttribute("aria-controls"), popup: el.getAttribute("aria-haspopup") }));
  check("the search field is a combobox that controls a listbox", attrs.role === "combobox" && attrs.auto === "list" && attrs.popup === "listbox" && attrs.expanded === "false" && attrs.controls === "search-results", JSON.stringify(attrs));
  check("the popup is a listbox", await page.$eval("#search-results", (el) => el.getAttribute("role") === "listbox" && el.hidden));

  await search(page, "prompt injection");
  const open = await page.evaluate(() => {
    const lb = document.getElementById("search-results");
    const groups = Array.from(lb.querySelectorAll('[role=group]')).map((g) => {
      const label = document.getElementById(g.getAttribute("aria-labelledby"));
      return { label: label ? label.textContent : null, options: g.querySelectorAll("[role=option]").length };
    });
    const options = Array.from(lb.querySelectorAll("[role=option]"));
    return { expanded: document.getElementById("node-search").getAttribute("aria-expanded"), shown: !lb.hidden, groups: groups, ids: options.every((o) => o.id), unique: new Set(options.map((o) => o.id)).size === options.length, active: document.getElementById("node-search").getAttribute("aria-activedescendant") };
  });
  check("typing opens the listbox with labeled Threats and Controls groups", open.expanded === "true" && open.shown && open.groups.length === 2 && /^Threats \(\d+\)$/.test(open.groups[0].label) && /^Controls \(\d+\)$/.test(open.groups[1].label), JSON.stringify(open));
  check("every option has a unique id and nothing is highlighted yet", open.ids && open.unique && open.active === null, JSON.stringify(open));

  const highlight = () => page.evaluate(() => {
    const id = document.getElementById("node-search").getAttribute("aria-activedescendant");
    const el = id ? document.getElementById(id) : null;
    const options = Array.from(document.querySelectorAll("#search-results [role=option]"));
    return { id: id, nodeId: el ? el.dataset.nodeId : null, index: el ? options.indexOf(el) : -1, selected: options.filter((o) => o.getAttribute("aria-selected") === "true").length, last: options.length - 1, focusOnInput: document.activeElement.id === "node-search" };
  });
  await page.keyboard.press("ArrowDown");
  let h = await highlight();
  check("ArrowDown highlights the first option and sets aria-activedescendant", h.index === 0 && h.selected === 1 && h.focusOnInput && /^risk:/.test(h.nodeId), JSON.stringify(h));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  h = await highlight();
  check("ArrowDown moves one option at a time", h.index === 2 && h.selected === 1, JSON.stringify(h));
  await page.keyboard.press("End");
  h = await highlight();
  check("End highlights the last option", h.index === h.last && /^control:/.test(h.nodeId), JSON.stringify(h));
  await page.keyboard.press("Home");
  h = await highlight();
  check("Home highlights the first option", h.index === 0, JSON.stringify(h));
  await page.keyboard.press("ArrowUp");
  h = await highlight();
  check("ArrowUp from the first option returns to the text field", h.index === -1 && h.id === null && h.selected === 0, JSON.stringify(h));

  await page.keyboard.press("Enter");
  await sleep(300);
  h = await highlight();
  const chainAfterEnter = await page.$eval("#chain", (el) => el.hidden);
  check("Enter with nothing highlighted does not jump to the first match", chainAfterEnter && h.index === 0, JSON.stringify(h) + chainAfterEnter);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  h = await highlight();
  const wanted = await page.evaluate((id) => window.__relationshipMap.graph.getNodeAttribute(id, "name"), h.nodeId);
  await page.keyboard.press("Enter");
  await sleep(700);
  const picked = await page.evaluate(() => ({ heading: document.getElementById("chain-heading").textContent, hidden: document.getElementById("chain").hidden }));
  check("Enter opens the highlighted option, not the first match", !picked.hidden && picked.heading.indexOf("Chain for " + wanted) === 0 && h.index === 2, JSON.stringify({ picked, wanted, h }));

  await clickNow(page, "#clear-selection");
  await sleep(400);
  await search(page, "prompt injection");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  const afterEsc1 = await page.evaluate(() => ({ expanded: document.getElementById("node-search").getAttribute("aria-expanded"), value: document.getElementById("node-search").value, active: document.getElementById("node-search").getAttribute("aria-activedescendant") }));
  check("Escape first clears the highlight and keeps the list open", afterEsc1.expanded === "true" && afterEsc1.active === null && afterEsc1.value === "prompt injection", JSON.stringify(afterEsc1));
  await page.keyboard.press("Escape");
  const afterEsc2 = await page.evaluate(() => ({ expanded: document.getElementById("node-search").getAttribute("aria-expanded"), hidden: document.getElementById("search-results").hidden, value: document.getElementById("node-search").value }));
  check("Escape again closes the list and keeps the text", afterEsc2.expanded === "false" && afterEsc2.hidden && afterEsc2.value === "prompt injection", JSON.stringify(afterEsc2));
  await page.keyboard.press("ArrowDown");
  const reopened = await page.evaluate(() => ({ expanded: document.getElementById("node-search").getAttribute("aria-expanded"), active: document.getElementById("node-search").getAttribute("aria-activedescendant") }));
  check("ArrowDown reopens the list", reopened.expanded === "true" && !!reopened.active, JSON.stringify(reopened));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  check("Escape once more clears the text", (await page.$eval("#node-search", (el) => el.value)) === "");
  check("no page errors with the listbox", page.__errors.length === 0, page.__errors.join("; "));
  await page.close();
}

async function testPhoneSheet(browser, base) {
  console.log("\n## Phone: sheet, collapsible chain columns, Read more");
  const desk = await openPage(browser, base, 1280, 800, "?risk=directpromptinjection");
  const deskCols = await desk.evaluate(() => ({
    toggles: document.querySelectorAll(".chain-col__toggle").length,
    bodiesShown: Array.from(document.querySelectorAll(".chain-col__body")).filter((b) => !b.hidden).length,
    readMore: getComputedStyle(document.getElementById("read-more")).display,
    summary: getComputedStyle(document.getElementById("hero-summary")).display,
    full: getComputedStyle(document.querySelector(".hero-full")).display,
    preview: getComputedStyle(document.querySelector(".map-preview")).display
  }));
  check("on desktop all four chain columns are open and have no toggles", deskCols.toggles === 0 && deskCols.bodiesShown === 4, JSON.stringify(deskCols));
  check("on desktop the hero shows the full text and no Read more", deskCols.readMore === "none" && deskCols.summary === "none" && deskCols.full !== "none" && deskCols.preview !== "none", JSON.stringify(deskCols));
  await desk.close();

  const page = await openPage(browser, base, 375, 812, "");
  const hero = await page.evaluate(() => ({
    summary: getComputedStyle(document.getElementById("hero-summary")).display,
    full: getComputedStyle(document.querySelector(".hero-full")).display,
    preview: getComputedStyle(document.querySelector(".map-preview")).display,
    button: document.getElementById("read-more").textContent, expanded: document.getElementById("read-more").getAttribute("aria-expanded"),
    controls: document.getElementById("read-more").getAttribute("aria-controls").split(" ").every((id) => !!document.getElementById(id))
  }));
  check("on the phone the hero is one summary sentence with a Read more button", hero.summary !== "none" && hero.full === "none" && hero.preview === "none" && hero.button === "Read more" && hero.expanded === "false" && hero.controls, JSON.stringify(hero));
  await page.click("#read-more");
  const more = await page.evaluate(() => ({ full: getComputedStyle(document.querySelector(".hero-full")).display, preview: getComputedStyle(document.querySelector(".map-preview")).display, summary: getComputedStyle(document.getElementById("hero-summary")).display, button: document.getElementById("read-more").textContent, expanded: document.getElementById("read-more").getAttribute("aria-expanded") }));
  check("Read more shows the full hero text and the Preview note", more.full !== "none" && more.preview !== "none" && more.summary === "none" && more.button === "Read less" && more.expanded === "true", JSON.stringify(more));
  await page.click("#read-more");
  check("Read less hides them again", await page.evaluate(() => getComputedStyle(document.querySelector(".map-preview")).display === "none"));
  check("the side panel is closed on the phone until a record is chosen", !(await sheetState(page)).shown);

  await search(page, "direct prompt injection");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await sleep(700);
  const sheet = await sheetState(page);
  check("the chain opens as a full-screen sheet", sheet.shown && sheet.left === 0 && sheet.top === 0 && sheet.width === 375 && sheet.height === 812 && sheet.sheetOpen, JSON.stringify(sheet));
  check("the list behind the sheet is inert and focus is in the sheet", sheet.stageInert && (await activeId(page)) === "chain-heading");

  const cols = await page.evaluate(() => Array.from(document.querySelectorAll(".chain-col__toggle")).map((b) => ({ text: b.textContent, expanded: b.getAttribute("aria-expanded"), key: b.dataset.column, bodyHidden: document.getElementById(b.getAttribute("aria-controls")).hidden })));
  check("the four columns are sections with counts", cols.length === 4 && cols.map((c) => c.key).join() === "risk,obligation,control,accountable" && cols.every((c) => /\(\d+\)$/.test(c.text)), JSON.stringify(cols));
  check("only Risk is open at first", cols.filter((c) => c.expanded === "true").map((c) => c.key).join() === "risk" && cols.every((c) => c.bodyHidden === (c.expanded !== "true")), JSON.stringify(cols));
  await page.click('.chain-col__toggle[data-column="obligation"]');
  const second = await page.evaluate(() => Array.from(document.querySelectorAll(".chain-col__toggle")).filter((b) => b.getAttribute("aria-expanded") === "true").map((b) => b.dataset.column));
  check("opening Obligation closes Risk, so one section is open at a time", second.join() === "obligation", JSON.stringify(second));
  await page.click('.chain-col__toggle[data-column="obligation"]');
  const none = await page.evaluate(() => document.querySelectorAll('.chain-col__toggle[aria-expanded="true"]').length);
  check("choosing the open section collapses it", none === 0);
  await page.click('.chain-jump a[href="#chain-col-accountable"]');
  await sleep(300);
  const jumped = await page.evaluate(() => ({ open: Array.from(document.querySelectorAll(".chain-col__toggle")).filter((b) => b.getAttribute("aria-expanded") === "true").map((b) => b.dataset.column), active: document.activeElement.id }));
  check("the Accountable jump link opens that section and focuses its heading", jumped.open.join() === "accountable" && jumped.active === "chain-col-accountable", JSON.stringify(jumped));
  await page.keyboard.press("Tab");
  check("Tab from the heading reaches the section toggle, then its cards", await page.evaluate(() => document.activeElement.classList.contains("chain-col__toggle")));
  await page.keyboard.press("Tab");
  check("the open section's card is next in the tab order", await page.evaluate(() => document.activeElement.classList.contains("chain-card")));

  await page.keyboard.press("Escape");
  await sleep(500);
  const afterEsc = await sheetState(page);
  check("Escape closes the sheet and returns focus to the search field", !afterEsc.shown && !afterEsc.stageInert && (await activeId(page)) === "node-search", JSON.stringify(afterEsc) + (await activeId(page)));

  await search(page, "direct prompt injection");
  await page.click('#search-results [role=option][data-node-id="risk:directpromptinjection"]');
  await sleep(600);
  await clickNow(page, "#clear-selection");
  await sleep(500);
  check("Back to list closes the sheet", !(await sheetState(page)).shown);

  await page.setViewport({ width: 1280, height: 800 });
  await sleep(300);
  check("the page loads without a sideways scroll and no errors", page.__errors.length === 0, page.__errors.join("; "));
  await page.close();

  const wide = await openPage(browser, base, 375, 812, "?risk=directpromptinjection");
  await wide.setViewport({ width: 1280, height: 800 });
  await sleep(500);
  const grown = await wide.evaluate(() => ({ toggles: document.querySelectorAll(".chain-col__toggle").length, bodies: Array.from(document.querySelectorAll(".chain-col__body")).filter((b) => !b.hidden).length }));
  check("growing the window past 800 px opens all four columns and drops the toggles", grown.toggles === 0 && grown.bodies === 4, JSON.stringify(grown));
  await wide.close();
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
    await testNavigation(browser, base);
    await testListView(browser, base);
    await testGraphToggle(browser, base);
    await testListbox(browser, base);
    await testPhoneSheet(browser, base);
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
