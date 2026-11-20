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
  await page.$eval("#node-search", (el) => { el.value = ""; window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: "instant" }); });
  await sleep(60);
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
  await search(page, "Model behavior integrity");
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
  const everyShown = await idsIn(page, "#suggestions option[data-node-id]");
  const dAll = diff(everyShown, inChainCore.map((c) => c.nodeId));
  check("All models and All layers lists every control that sits in an operating model (" + inChainCore.length + ")", everyShown.length === inChainCore.length && dAll.missing.length === 0 && dAll.extra.length === 0, JSON.stringify(dAll));
  check("the source note says the controls come from the sector catalogs", await page.$eval("#control-source-note", (el) => /sector catalogs/.test(el.textContent) && /CoSAI Risk Map controls\.yaml/.test(el.textContent) && !el.hidden));

  for (const model of MODELS) {
    await pickModel(page, model);
    await openEntry(page, "control");
    const expected = inChainCore.filter((c) => c.core.indexOf(model) !== -1).map((c) => c.nodeId);
    const shown = await idsIn(page, "#suggestions option[data-node-id]");
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
  const shownL3 = await idsIn(page, "#suggestions option[data-node-id]");
  const d1 = diff(shownL3, expectedL3);
  check("L3 with All models lists every L3 control that sits in an operating model (" + expectedL3.length + ")", shownL3.length === expectedL3.length && d1.missing.length === 0 && d1.extra.length === 0, JSON.stringify(d1));

  await openEntry(page, "threat");
  const expectedRisks = threats.filter((t) => t.srf_layer === "L3").map((t) => "risk:" + t.id);
  const shownRisks = await idsIn(page, "#risk-suggestions option[data-node-id]");
  const d2 = diff(shownRisks, expectedRisks);
  check("L3 limits the threat list to threats at L3 (" + expectedRisks.length + ")", shownRisks.length === expectedRisks.length && d2.missing.length === 0 && d2.extra.length === 0, JSON.stringify(d2));

  await pickModel(page, "AI-PaaS");
  await openEntry(page, "control");
  const expectedPaaS = inChainCore.filter((c) => c.layer === "L3" && c.core.indexOf("AI-PaaS") !== -1).map((c) => c.nodeId);
  const shownPaaS = await idsIn(page, "#suggestions option[data-node-id]");
  const d3 = diff(shownPaaS, expectedPaaS);
  check("AI-PaaS with L3 lists the AI-PaaS controls at L3 (" + expectedPaaS.length + ")", shownPaaS.length === expectedPaaS.length && d3.missing.length === 0 && d3.extra.length === 0, JSON.stringify(d3));
  const paasSummary = await page.$eval("#filter-summary", (el) => el.textContent);
  check("the summary names both filters and the control count", paasSummary === "AI-PaaS, L3: " + expectedPaaS.length + " controls", paasSummary);
  check("both filters are in the URL", /[?&]model=ai-paas/.test(page.url()) && /[?&]layer=L3/.test(page.url()), page.url());
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
  check("risk-to-obligation cards name the recorded derived basis", obligationChips.length > 0 && obligationChips.every((t) => t.indexOf("Basis: derived through a shared control.") !== -1), JSON.stringify(obligationChips.slice(0, 2)));
  const personaChips = await page.$$eval('#chain-board button[data-chain-id^="accountable:"]', (els) => els.map((el) => el.textContent));
  check("control-to-persona cards say no source citation is recorded yet", personaChips.length > 0 && personaChips.every((t) => t.indexOf("No source citation recorded yet. The control's source record names this persona.") !== -1), JSON.stringify(personaChips.slice(0, 1)));
  const details = await page.$eval("#details-chain", (el) => el.textContent);
  check("details say what each link means in plain words", details.indexOf("The legal text is not the source of this link. It runs through a shared control.") !== -1 && details.indexOf("Listed as a control for this risk in the source record.") !== -1 && details.indexOf("No source citation recorded yet.") !== -1, details.slice(0, 200));
  check("details keep the threat definition link for an AI Exchange threat", await page.$$eval("#details-chain a", (els, url) => els.some((a) => a.href === url && a.textContent === "Risk definition"), derived.ai_exchange));
  await page.close();

  if (official) {
    const officialPage = await openPage(browser, base, 1280, 900, "?risk=" + official.id);
    const text = await officialPage.$$eval('#chain-board button[data-chain-id^="obligation:"]', (els) => els.map((el) => el.textContent).join(" | "));
    check("official-text links say so in the chain (" + official.id + ")", text.indexOf("Basis: official text.") !== -1, text.slice(0, 200));
    await officialPage.close();
  } else {
    check("data has at least one official_text link to test", false, "none found");
  }

  const controlPage = await openPage(browser, base, 1280, 900, "?control=finance:SRF-L3-DEV-001");
  const controlChips = await controlPage.$$eval('#chain-board button[data-chain-id^="obligation:"], #chain-board button[data-chain-id^="instrument:"]', (els) => els.map((el) => el.textContent).join(" | "));
  check("control chain says the obligation is cited on the control", controlChips.indexOf("Basis: citation on this control.") !== -1, controlChips.slice(0, 200));
  check("control chain groups risk-to-obligation bases by recorded value", /Risk to obligation, \d+ risks?\. Basis: derived through a shared control\./.test(controlChips), controlChips.slice(0, 300));
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
  check("search label says risk or control", label === "Find a risk or a control", label);
  const placeholder = await page.$eval("#node-search", (el) => el.placeholder);
  check("search placeholder says risk or control", placeholder === "Risk or control name", placeholder);
  const help = await page.$eval("#map-help", (el) => el.textContent);
  check("search help text says risk or control", /Type a risk or a control name/.test(help), help);
  const heading = await page.$eval("#risk-suggestions-heading", (el) => el.textContent.trim());
  check("risk picker label is Risk", heading === "Risk", heading);
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
  check("the search note counts risks and controls", /^\d+ records match: \d+ risks? and \d+ controls?\./.test(counts.note), counts.note);
  const nThreats = Number((counts.note.match(/: (\d+) risks?/) || [])[1]);
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
    text: document.getElementById("details-heading").textContent,
    graphHidden: document.getElementById("graph-workspace").hidden,
    chainHidden: document.getElementById("chain").hidden,
    graphInDetails: !!document.querySelector(".details #graph, .details .graph-wrap")
  }));
  check("choosing a threat moves focus to the details heading", opened.active === "details-heading" && opened.text === "Direct prompt injection", JSON.stringify(opened));
  check("the graph workspace stays closed and is not embedded in details", opened.graphHidden && opened.chainHidden && !opened.graphInDetails, JSON.stringify(opened));
  check("the details heading is in the first half of the window after choosing", await inView(page, "#details-heading"));

  await clickNow(page, "#explore-from-details");
  await sleep(900);
  const explored = await page.evaluate(() => ({
    workspaceHidden: document.getElementById("graph-workspace").hidden,
    chainHidden: document.getElementById("chain").hidden,
    heading: document.getElementById("chain-heading").textContent,
    jumpChainShown: !document.getElementById("jump-chain").hidden,
    active: document.activeElement.id
  }));
  check("Explore relationship graph opens the chain workspace", !explored.workspaceHidden && !explored.chainHidden && /^Chain for Direct prompt injection/.test(explored.heading), JSON.stringify(explored));
  check("the Chain jump link appears with a chain", explored.jumpChainShown);

  const columnTargets = await page.$$eval(".chain-jump a", (links) => links.map((a) => ({ href: a.getAttribute("href"), exists: !!document.getElementById(a.getAttribute("href").slice(1)) })));
  check("every chain jump link has a target", columnTargets.length === 5 && columnTargets.every((t) => t.exists), JSON.stringify(columnTargets));
  await clickNow(page, '.chain-jump a[href="#chain-col-accountable"]');
  await sleep(900);
  check("the Accountable jump link moves focus to that column", (await activeId(page)) === "chain-col-accountable" && (await inView(page, "#chain-col-accountable")));
  await clickNow(page, '.chain-jump a[href="#node-search"]');
  await sleep(900);
  check("Find another focuses the search field", (await activeId(page)) === "node-search");

  await search(page, "direct prompt injection");
  await page.click('#search-results [role=option][data-node-id="risk:directpromptinjection"]');
  await sleep(900);
  await clickNow(page, "#clear-selection");
  await sleep(900);
  const cleared = await page.evaluate(() => ({ active: document.activeElement.id, chainHidden: document.getElementById("chain").hidden, workspaceHidden: document.getElementById("graph-workspace").hidden }));
  check("Clear selection returns focus to the search field", cleared.active === "node-search" && cleared.chainHidden && cleared.workspaceHidden, JSON.stringify(cleared));

  await page.$eval("#entry-account", (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.click("#entry-account");
  await sleep(900);
  await page.click("#persona-list button");
  await sleep(900);
  const persona = await page.evaluate(() => ({ active: document.activeElement.id, text: document.getElementById("details-heading").textContent, workspaceHidden: document.getElementById("graph-workspace").hidden }));
  check("choosing a persona moves focus to its details heading", persona.active === "details-heading" && persona.text.length > 0 && persona.workspaceHidden, JSON.stringify(persona));
  check("the persona details heading is in the first half of the window", await inView(page, "#details-heading"));
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
  check("the details heading is in the first half of the phone window", (await activeId(phone)) === "details-heading" && await inView(phone, "#details-heading"));
  await clickNow(phone, "#explore-from-details");
  await sleep(900);
  await clickNow(phone, '.chain-jump a[href="#chain-col-obligation"]');
  await sleep(900);
  const obligationJump = await phone.evaluate(() => {
    const el = document.getElementById("chain-col-obligation");
    const r = el.getBoundingClientRect();
    return { active: document.activeElement.id, open: Array.from(document.querySelectorAll('.chain-col__toggle[aria-expanded="true"]')).map((b) => b.dataset.column), visible: r.height > 0 && r.top < window.innerHeight && r.bottom > 0 };
  });
  check("the Obligation jump link works at 375 wide", obligationJump.active === "chain-col-obligation" && obligationJump.open.join() === "obligation" && obligationJump.visible, JSON.stringify(obligationJump));
  await clickNow(phone, "#hide-graph");
  await sleep(400);
  await clickNow(phone, "#clear-selection");
  await sleep(400);
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("the page does not scroll sideways at 375 wide", overflow <= 1, String(overflow));
  check("no page errors at 375 wide", phone.__errors.length === 0, phone.__errors.join("; "));
  await phone.close();
}

const sheetState = (page) => page.evaluate(() => {
  const d = document.querySelector(".map-panel");
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
      threats: document.querySelectorAll("#risk-suggestions option[data-node-id]").length,
      controls: document.querySelectorAll("#suggestions option[data-node-id]").length,
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
  check("the summary line gives the filters and both counts", first.summary === "All operating models, all layers: " + inChainCore.length + " controls, " + threats.length + " risks", first.summary);
  check("the filters and the summary come before the results", first.filtersBeforeResults && first.summaryBeforeResults);
  check("the side panel sits beside the list and starts empty", first.chainHidden && first.emptyShown && first.panelLeft >= first.finderRight, JSON.stringify(first));
  check("no blank graph panel on load", first.wrapHeight < 120, String(first.wrapHeight));

  await pickModel(page, "AI-SaaS");
  await pickLayer(page, "L3");
  const filtered = await page.$eval("#filter-summary", (el) => el.textContent);
  const nControls = inChainCore.filter((c) => c.layer === "L3" && c.core.indexOf("AI-SaaS") !== -1).length;
  const nThreats = threats.filter((t) => t.srf_layer === "L3").length;
  check("the summary reads 'AI-SaaS, L3: N controls, M risks'", filtered === "AI-SaaS, L3: " + nControls + " controls, " + nThreats + " risks", filtered);
  await openEntry(page, "threat");
  const threatSummary = await page.$eval("#filter-summary", (el) => el.textContent);
  check("the summary follows Explore a risk", threatSummary === "AI-SaaS, L3: " + nThreats + " risks", threatSummary);

  await pickModel(page, "all");
  await pickLayer(page, "all");
  await openEntry(page, "threat");
  await page.select("#risk-suggestions", "risk:directpromptinjection");
  await sleep(600);
  const open = await page.evaluate(() => {
    const panel = document.querySelector(".map-panel").getBoundingClientRect();
    const list = document.getElementById("risk-suggestions").getBoundingClientRect();
    return {
      detailsShown: !document.getElementById("details-body").hidden,
      graphHidden: document.getElementById("graph-workspace").hidden,
      graphInDetails: !!document.querySelector(".details #graph, .details .graph-wrap"),
      listStillThere: list.height > 0 && list.right <= panel.left + 1,
      active: document.activeElement.id,
      panelTopInView: panel.top >= -1 && panel.top < 220,
      heading: document.getElementById("details-heading").textContent
    };
  });
  check("choosing a threat opens details beside the list without the graph", open.detailsShown && open.graphHidden && !open.graphInDetails && open.listStillThere && open.active === "details-heading", JSON.stringify(open));
  check("the details panel is brought into view when a record opens", open.panelTopInView);
  await page.evaluate(() => window.scrollTo(0, 600));
  await sleep(100);
  const scrolledList = await page.evaluate(() => ({
    scrollY: window.scrollY,
    height: document.documentElement.scrollHeight,
    ok: window.scrollY >= 500 && document.documentElement.scrollHeight > window.innerHeight
  }));
  check("the page scrolls the detail content with the window", scrolledList.ok, JSON.stringify(scrolledList));
  check("no page errors in the list view", page.__errors.length === 0, page.__errors.join("; "));
  await page.close();
}

async function testGraphToggle(browser, base) {
  console.log("\n## Graph workspace: separate from details, optional until Explore");
  const page = await openPage(browser, base, 1280, 800, "");
  const hidden = await graphState(page);
  check("the graph is hidden on load and out of the tab order", hidden.visibility === "hidden" && hidden.focusable === 0 && hidden.wrapHeight < 120, JSON.stringify(hidden));
  check("Explore relationship graph is offered and Back to details is not", await page.evaluate(() => {
    const show = document.getElementById("show-graph");
    const hide = document.getElementById("hide-graph");
    return !show.hidden && /Explore relationship graph/.test(show.textContent) && hide.hidden;
  }));

  await page.click("#show-graph");
  await sleep(900);
  const shown = await graphState(page);
  check("Explore relationship graph reveals the graph workspace", shown.visibility === "visible" && shown.clientWidth > 300 && shown.clientHeight > 300, JSON.stringify(shown));
  check("Sigma matches the container size after it opens", shown.sigmaWidth === shown.offsetWidth && shown.sigmaHeight === shown.offsetHeight && shown.canvasWidth > 0 && Math.abs(shown.canvasWidth - shown.sigmaWidth) <= 1, JSON.stringify(shown));
  check("focus moves to Back to details and the URL records the graph", (await activeId(page)) === "hide-graph" && /[?&]view=graph/.test(page.url()), (await activeId(page)) + " " + page.url());
  check("zoom controls are available in the graph workspace", await page.evaluate(() => !document.getElementById("graph-fit").hidden && !document.getElementById("graph-zoom-in").hidden && !document.getElementById("graph-zoom-out").hidden && !document.getElementById("graph-reset").hidden));
  await page.click("#hide-graph");
  await sleep(500);
  const closed = await graphState(page);
  check("Back to details hides the workspace and focus returns to Explore", closed.visibility === "hidden" && (await activeId(page)) === "show-graph" && !/graph=1/.test(page.url()), JSON.stringify(closed) + (await activeId(page)));

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
  check("a deep-linked threat opens details without the graph workspace", await chainPage.evaluate(() => {
    return !document.getElementById("details-body").hidden && document.getElementById("graph-workspace").hidden && document.getElementById("chain").hidden && !document.querySelector(".details #graph");
  }));
  await chainPage.click("#explore-from-details");
  await sleep(900);
  const focusView = await chainPage.evaluate(() => ({
    workspaceHidden: document.getElementById("graph-workspace").hidden,
    chainHidden: document.getElementById("chain").hidden,
    hideShown: !document.getElementById("hide-graph").hidden,
    detailsInChain: !!document.querySelector("#chain #chain-details-slot > .details") && getComputedStyle(document.querySelector(".details")).display !== "none"
  }));
  check("Explore opens the chain workspace and moves the details below the chain", !focusView.workspaceHidden && !focusView.chainHidden && focusView.hideShown && focusView.detailsInChain, JSON.stringify(focusView));
  await chainPage.click("#hide-graph");
  await sleep(600);
  const back = await chainPage.evaluate(() => ({
    workspaceHidden: document.getElementById("graph-workspace").hidden,
    active: document.activeElement.id,
    heading: document.getElementById("details-heading").textContent,
    selected: document.getElementById("map-status").dataset.root
  }));
  check("Back to details keeps the same threat selected", back.workspaceHidden && back.active === "details-heading" && back.heading === "Direct prompt injection" && back.selected === "risk:directpromptinjection", JSON.stringify(back));
  await chainPage.close();

  const phone = await openPage(browser, base, 375, 812, "");
  check("the map still loads at 375 wide with the panel closed", await phone.$eval("#map-status", (el) => el.dataset.ready === "true" && !document.getElementById("map-error").textContent));
  await phone.click("#show-graph");
  await sleep(900);
  const phoneGraph = await graphState(phone);
  const sheet = await sheetState(phone);
  check("Sigma sizes itself when the graph opens in the phone sheet", phoneGraph.clientWidth > 250 && phoneGraph.sigmaWidth === phoneGraph.offsetWidth && phoneGraph.sigmaHeight === phoneGraph.offsetHeight && sheet.shown, JSON.stringify({ phoneGraph, sheet }));
  await phone.click("#clear-graph-selection");
  await sleep(500);
  check("Back to list closes the graph sheet", !(await sheetState(phone)).shown);
  check("no page errors with the graph at 375 wide", phone.__errors.length === 0, phone.__errors.join("; "));
  await phone.close();
}

async function testPersonaGraph(browser, base) {
  console.log("\n## Visualization: a picked persona opens the ROCA chain, with the graph as an option");
  const read = (page) => page.evaluate(() => {
    const cols = {};
    document.querySelectorAll("#chain-board .chain-col").forEach((col) => {
      cols[col.dataset.column] = {
        heading: col.querySelector("h3").textContent.trim(),
        cards: col.querySelectorAll("button[data-chain-id]").length,
        more: Array.from(col.querySelectorAll("button.chain-more")).map((b) => b.textContent)
      };
    });
    const accountable = document.querySelector('#chain-board .chain-col[data-column="accountable"]');
    const hide = document.getElementById("hide-graph");
    return {
      cols: cols,
      rowCount: document.querySelectorAll("#chain-board li.control-row").length,
      more: Array.from(document.querySelectorAll("#chain-board button.chain-more")).map((b) => b.textContent),
      accountableText: accountable ? accountable.textContent : "",
      status: document.getElementById("map-status").textContent,
      chainHidden: document.getElementById("chain").hidden,
      focusGraphShown: !document.querySelector(".graph-wrap").classList.contains("graph-wrap--off"),
      empty: document.getElementById("graph-empty") ? { hidden: document.getElementById("graph-empty").hidden, text: document.getElementById("graph-empty").textContent } : null,
      widen: { hidden: document.getElementById("widen-view").hidden, text: document.getElementById("widen-view").textContent },
      chainBtnHidden: document.getElementById("show-chain").hidden,
      workspaceHeading: document.getElementById("graph-workspace-heading").textContent,
      chainNote: document.getElementById("chain-model-note").textContent,
      workspaceHidden: document.getElementById("graph-workspace").hidden,
      hideHidden: hide.hidden,
      search: location.search,
      heading: document.getElementById("details-heading").textContent,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
  for (const [width, height] of [[1280, 800], [375, 812]]) {
    const page = await openPage(browser, base, width, height, "?type=persona&node=ai-platform-provider&view=list");
    await clickNow(page, "#explore-from-details");
    await sleep(900);
    const chain = await read(page);
    const counts = /Showing (\d+) risks?, (\d+) obligations?, (\d+) controls?, and (\d+) accountable personas?/.exec(chain.status);
    const cols = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll("#chain-board .chain-col").forEach((col) => {
        out[col.dataset.column] = {
          heading: col.querySelector("h3").textContent.trim(),
          boxes: col.querySelectorAll("button[data-chain-id]").length,
          cards: col.querySelectorAll("button[data-chain-id]").length
        };
      });
      return {
        out: out,
        oldRows: document.querySelectorAll("#chain-board li.control-row, #chain-board .control-rows").length,
        oldToggles: document.querySelectorAll("#chain-board .chain-box, #chain-board .chain-box__toggle, #chain-board .chain-box__panel, #chain-board .chain-box__jump, #chain-board .chain-box__items").length
      };
    });
    const names = ["risk", "obligation", "control", "accountable"];
    check("persona chain at " + width + " renders the four columns with counts and no single list", names.every((n) => cols.out[n] && /\(\d+\)$/.test(cols.out[n].heading)) && cols.oldRows === 0, JSON.stringify(cols.out));
    check("every column lists its boxes as plain read-outs with no + or minus toggles at " + width, names.every((n) => cols.out[n].boxes === cols.out[n].cards && cols.out[n].boxes > 0) && cols.oldToggles === 0, JSON.stringify(cols.out));
    check("the persona is in the Accountable column at " + width, /AI Platform Provider/.test(await page.$eval('#chain-board .chain-col[data-column="accountable"]', (el) => el.textContent)) && cols.out.accountable.boxes === 1);
    const gone = await page.evaluate(() => ({
      legend: document.querySelector(".chain-legend-wrap").checkVisibility(),
      columnLinks: Array.from(document.querySelectorAll('.chain-jump a[href^="#chain-col-"]')).filter((a) => a.checkVisibility()).length,
      personaPick: !!document.querySelector("#persona-list button"),
      modelFilter: !!document.querySelector("#model-filter-list input"),
      layerFilter: !!document.querySelector("#layer-filter-list input")
    }));
    check("persona view keeps the persona list and the model and layer filters at " + width, gone.personaPick && gone.modelFilter && gone.layerFilter, JSON.stringify(gone));
    if (width === 1280) check("persona view shows the line legend and four column jump links", gone.legend && gone.columnLinks === 4, JSON.stringify(gone));
    const left = await page.evaluate(() => {
      const shown = (id) => { const el = document.getElementById(id); return !!el && el.getClientRects().length > 0; };
      return {
        wrapShown: shown("suggestions-wrap"), riskSelect: shown("risk-suggestions"), controlSelect: shown("suggestions"),
        riskLabel: !!document.querySelector('label[for="risk-suggestions"]') && shown("risk-suggestions-heading"),
        sourceNote: shown("control-source-note"),
        help: document.getElementById("map-help").textContent
      };
    });
    check("persona chain removes the left Risk and Control drop-downs and their source note at " + width, !left.wrapShown && !left.riskSelect && !left.controlSelect && !left.riskLabel && !left.sourceNote, JSON.stringify(left));
    check("persona chain help line names the four menus and the details at " + width, /^Four columns: Risk, Obligation, Control, and Accountable\. Each menu narrows the menu to its right\. Details for the choice appear below the columns\.$/.test(left.help) && !/Open a box/.test(left.help), left.help);

    await testRocaSelects(browser, base, width, height);
    check("the status line counts accountable personas and obligations above zero at " + width, !!counts && +counts[1] > 0 && +counts[2] > 0 && +counts[3] > 0 && +counts[4] > 0 && !/Choose a risk or a control/.test(chain.status), chain.status);
    check("the workspace heading reads ROCA chain in the chain view at " + width, chain.workspaceHeading === "ROCA chain", chain.workspaceHeading);
    check("persona chains show the persona line and not the generic model note at " + width, chain.chainNote === "These are the controls that name this persona as accountable, with their risks and obligations." && chain.chainNote.indexOf("All shows one accountable persona") === -1, chain.chainNote);
    check("long columns are collapsed with a Show more control at " + width, chain.cols.control.cards <= 8 && chain.cols.control.more.some((t) => /^Show \d+ more$/.test(t)), JSON.stringify(chain.cols.control));
    await page.evaluate(() => { const b = document.querySelector('button.chain-more[data-more-column="control"]'); if (b && /^Show \d+ more$/.test(b.textContent)) b.click(); });
    await sleep(300);
    const open = await read(page);
    check("Show more reveals every control and Show fewer is offered at " + width, open.cols.control.cards === +counts[3] && open.cols.control.more.indexOf("Show fewer") !== -1, JSON.stringify(open.cols.control));
    check("no horizontal page overflow in the persona chain at " + width, !open.overflow);
    if (width === 1280) {
      const toGraph = await page.evaluate(() => { const b = document.getElementById("widen-view"); return { hidden: b.hidden, text: b.textContent }; });
      check("the chain offers the relationship graph", !toGraph.hidden && /relationship graph/.test(toGraph.text), JSON.stringify(toGraph));
      await clickNow(page, "#widen-view");
      await sleep(900);
      const forced = await read(page);
      check("the graph toggle opens the force graph on the persona", forced.chainHidden && forced.focusGraphShown && /Showing this persona and \d+ nodes? next to it/.test(forced.status) && !forced.chainBtnHidden, JSON.stringify(forced));
      check("the workspace heading reads Relationship graph after the graph toggle", forced.workspaceHeading === "Relationship graph", forced.workspaceHeading);
      await clickNow(page, "#show-chain");
      await sleep(600);
      const again = await read(page);
      check("Show the chain returns to the persona chain", !again.chainHidden && !!again.cols.accountable, JSON.stringify(again.cols));
      check("the workspace heading returns to ROCA chain after Show the chain", again.workspaceHeading === "ROCA chain", again.workspaceHeading);
    }
    await clickNow(page, "#hide-graph");
    await sleep(600);
    const back = await read(page);
    check("Back to details at " + width + " returns to the persona", /node=ai-platform-provider/.test(back.search) && /view=list/.test(back.search) && /Platform Provider/i.test(back.heading), JSON.stringify({ search: back.search, heading: back.heading }));
    check("no page errors in the persona chain at " + width, page.__errors.length === 0, page.__errors.join("; "));
    await page.close();
  }
  const bare = await openPage(browser, base, 1280, 800, "?type=persona&node=ai-system-users&view=list");
  await clickNow(bare, "#explore-from-details");
  await sleep(900);
  const none = await read(bare);
  const gapText = await bare.evaluate(() => document.getElementById("chain-board").textContent);
  check("a persona with no controls says so in the chain", !none.workspaceHidden && !none.chainHidden && /No control names this persona yet\./.test(gapText), gapText.slice(0, 300));
  await clickNow(bare, "#widen-view");
  await sleep(700);
  const noneGraph = await read(bare);
  check("the force graph for that persona shows the same message", /No control names this persona yet/.test(noneGraph.status) && noneGraph.empty && !noneGraph.empty.hidden && /No control names this persona yet/.test(noneGraph.empty.text), JSON.stringify(noneGraph.empty) + noneGraph.status);
  await bare.close();

  const riskPage = await openPage(browser, base, 1280, 800, "?risk=directpromptinjection");
  await clickNow(riskPage, "#explore-from-details");
  await sleep(900);
  const riskChain = await read(riskPage);
  check("a risk chain keeps the generic model note and shows the ROCA chain heading", riskChain.chainNote.indexOf("All shows one accountable persona for each operating model") !== -1 && riskChain.chainNote.indexOf("These are the controls that name this persona") === -1 && riskChain.workspaceHeading === "ROCA chain", JSON.stringify({ note: riskChain.chainNote, heading: riskChain.workspaceHeading }));
  const riskPicks = await riskPage.evaluate(() => ({ help: document.getElementById("map-help").textContent, controls: document.getElementById("suggestions").options.length }));
  check("a risk chain keeps the four-column help line", /Four columns/.test(riskPicks.help), riskPicks.help);
  const riskGone = await riskPage.evaluate(() => ({
    legend: document.querySelector(".chain-legend-wrap").checkVisibility(),
    columnLinks: Array.from(document.querySelectorAll('.chain-jump a[href^="#chain-col-"]')).filter((a) => a.checkVisibility()).length,
    label: document.getElementById("chain-board").getAttribute("aria-label")
  }));
  check("a risk chain keeps the line-type legend, four column jump links, and its board label", riskGone.legend && riskGone.columnLinks === 4 && riskGone.label === "Risk, obligation, control, and accountable", JSON.stringify(riskGone));
  await riskPage.close();
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
  check("typing opens the listbox with labeled Risks and Controls groups", open.expanded === "true" && open.shown && open.groups.length === 2 && /^Risks \(\d+\)$/.test(open.groups[0].label) && /^Controls \(\d+\)$/.test(open.groups[1].label), JSON.stringify(open));
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
  const detailsAfterEnter = await page.$eval("#details-body", (el) => el.hidden);
  check("Enter with nothing highlighted does not jump to the first match", detailsAfterEnter && h.index === 0, JSON.stringify(h) + detailsAfterEnter);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  h = await highlight();
  const wanted = await page.evaluate((id) => window.__relationshipMap.graph.getNodeAttribute(id, "name"), h.nodeId);
  await page.keyboard.press("Enter");
  await sleep(700);
  const picked = await page.evaluate(() => ({ heading: document.getElementById("details-heading").textContent, bodyHidden: document.getElementById("details-body").hidden, workspaceHidden: document.getElementById("graph-workspace").hidden }));
  check("Enter opens the highlighted option in details, not the first match", !picked.bodyHidden && picked.heading === wanted && picked.workspaceHidden && h.index === 2, JSON.stringify({ picked, wanted, h }));

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

async function testColumnLabels(browser, base) {
  console.log("\n## ROCA column labels: Why, What, How, Who");
  const WORD = { risk: "Why", obligation: "What", control: "How", accountable: "Who" };
  const NAME = { risk: "Risk", obligation: "Obligation", control: "Control", accountable: "Accountable" };
  const ORDER = ["risk", "obligation", "control", "accountable"];
  const readHeads = (page) => page.evaluate(() => Array.from(document.querySelectorAll("#chain-board .chain-col")).map((col) => {
    const h = col.querySelector("h3");
    const label = h.querySelector(".chain-col__label");
    const toggle = col.querySelector("button.chain-col__toggle");
    return {
      key: col.dataset.column,
      label: label ? label.textContent : "",
      labelInHeading: !!label && !!label.closest("h3"),
      headingName: h.getAttribute("aria-label") || "",
      toggleName: toggle ? toggle.getAttribute("aria-label") : null,
      toggleExpanded: toggle ? toggle.getAttribute("aria-expanded") : null
    };
  }));
  const cases = [
    ["persona", "?type=persona&node=ai-platform-provider&view=list"],
    ["risk", "?risk=directpromptinjection"],
    ["control", "?type=control&node=finance:SRF-L3-DEV-001&model=iaas&view=list"]
  ];
  for (const [kind, query] of cases) {
    for (const [width, height] of [[1280, 800], [375, 812]]) {
      const page = await openPage(browser, base, width, height, query);
      await clickNow(page, "#explore-from-details");
      await sleep(900);
      const heads = await readHeads(page);
      const status = await page.$eval("#map-status", (el) => el.textContent);
      const counts = /Showing (\d+) risks?, (\d+) obligations?, (\d+) controls?, and (\d+) accountable personas?/.exec(status);
      const at = kind + " chain at " + width;
      check(at + " renders the four columns in order", heads.map((h) => h.key).join() === ORDER.join(), JSON.stringify(heads.map((h) => h.key)));
      check(at + " puts the label inside each heading", heads.every((h) => h.label === WORD[h.key].toLowerCase() && h.labelInHeading), JSON.stringify(heads.map((h) => [h.key, h.label, h.labelInHeading])));
      const nameRe = (key) => new RegExp("^" + WORD[key] + ": " + NAME[key] + " \\(\\d+\\)$");
      check(at + " gives each heading one accessible name with the label and count", heads.every((h) => nameRe(h.key).test(h.headingName)), JSON.stringify(heads.map((h) => h.headingName)));
      if (counts) {
        const total = { risk: +counts[1], obligation: +counts[2], control: +counts[3] };
        check(at + " keeps the heading counts equal to the status line", ORDER.slice(0, 3).every((k) => new RegExp("\\((" + total[k] + ")\\)$").test(heads.find((h) => h.key === k).headingName)), JSON.stringify(heads.map((h) => h.headingName)) + " | " + status);
      }
      if (width === 375) {
        const named = heads.every((h) => h.toggleName === h.headingName && (h.toggleExpanded === "true" || h.toggleExpanded === "false"));
        check(at + " gives each 375 px toggle the same name as its heading, with aria-expanded", named && heads.filter((h) => h.toggleExpanded === "true").length === 1, JSON.stringify(heads.map((h) => [h.toggleName, h.toggleExpanded])));
        await page.click('.chain-col__toggle[data-column="obligation"]');
        await sleep(200);
        const after = await readHeads(page);
        const ob = after.find((h) => h.key === "obligation");
        check(at + " keeps the toggle working after the label is added", ob.toggleExpanded === "true" && ob.toggleName === ob.headingName && after.find((h) => h.key === "risk").toggleExpanded === "false", JSON.stringify(ob));
      } else {
        check(at + " shows no column toggles on desktop", heads.every((h) => h.toggleName === null));
      }
      await page.close();
    }
  }
}

async function testPhoneSheet(browser, base) {
  console.log("\n## Phone: sheet, collapsible chain columns, Read more");
  const desk = await openPage(browser, base, 1280, 800, "?risk=directpromptinjection&graph=1");
  const deskCols = await desk.evaluate(() => ({
    toggles: document.querySelectorAll(".chain-col__toggle").length,
    bodiesShown: Array.from(document.querySelectorAll(".chain-col__body")).filter((b) => !b.hidden).length,
    preview: getComputedStyle(document.querySelector(".map-preview")).display
  }));
  check("on desktop all four chain columns are open and have no toggles", deskCols.toggles === 0 && deskCols.bodiesShown === 4, JSON.stringify(deskCols));
  await desk.close();

  const page = await openPage(browser, base, 375, 812, "");
  const hero = await page.evaluate(() => ({
    summary: getComputedStyle(document.getElementById("hero-summary")).display,
    paragraphs: document.querySelectorAll(".map-hero__inner > p").length,
    readMore: !!document.getElementById("read-more"),
    preview: getComputedStyle(document.querySelector(".map-preview")).display
  }));
  check("the hero is one paragraph with no Read more button and the Preview label stays", hero.summary !== "none" && hero.paragraphs === 1 && !hero.readMore && hero.preview !== "none", JSON.stringify(hero));
  check("the side panel is closed on the phone until a record is chosen", !(await sheetState(page)).shown);

  await search(page, "direct prompt injection");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await sleep(700);
  const sheet = await sheetState(page);
  check("the details open as a full-screen sheet", sheet.shown && sheet.left === 0 && sheet.top === 0 && sheet.width === 375 && sheet.height === 812 && sheet.sheetOpen, JSON.stringify(sheet));
  check("the list behind the sheet is inert and focus is on details", sheet.stageInert && (await activeId(page)) === "details-heading");

  await page.click("#explore-from-details");
  await sleep(700);
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
  await sleep(400);
  check("Escape from the graph workspace returns to details", await page.evaluate(() => document.getElementById("graph-workspace").hidden && document.activeElement.id === "details-heading"));
  await page.keyboard.press("Escape");
  await sleep(500);
  const afterEsc = await sheetState(page);
  check("Escape again closes the sheet and returns focus to the search field", !afterEsc.shown && !afterEsc.stageInert && (await activeId(page)) === "node-search", JSON.stringify(afterEsc) + (await activeId(page)));

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

  const wide = await openPage(browser, base, 375, 812, "?risk=directpromptinjection&graph=1");
  await wide.setViewport({ width: 1280, height: 800 });
  await sleep(500);
  const grown = await wide.evaluate(() => ({ toggles: document.querySelectorAll(".chain-col__toggle").length, bodies: Array.from(document.querySelectorAll(".chain-col__body")).filter((b) => !b.hidden).length }));
  check("growing the window past 800 px opens all four columns and drops the toggles", grown.toggles === 0 && grown.bodies === 4, JSON.stringify(grown));
  await wide.close();
}

async function testDetailGraphSplit(browser, base) {
  console.log("\n## Detail / graph split: insurance deep link, page scroll, refresh");
  const page = await openPage(browser, base, 1280, 900, "?control=insurance:SRF-L3-DEV-001");
  const first = await page.evaluate(() => {
    const details = document.querySelector(".details");
    const style = getComputedStyle(details);
    return {
      heading: document.getElementById("details-heading").textContent,
      id: document.getElementById("details-id").textContent,
      bodyHidden: document.getElementById("details-body").hidden,
      workspaceHidden: document.getElementById("graph-workspace").hidden,
      graphInDetails: !!document.querySelector(".details #graph, .details .graph-wrap"),
      overflow: style.overflow,
      maxHeight: style.maxHeight,
      root: document.getElementById("map-status").dataset.root
    };
  });
  check("insurance deep link selects the control in details", first.root === "control:insurance:SRF-L3-DEV-001" && /Prompt Injection Defense/.test(first.heading) && first.id === "ID: insurance:SRF-L3-DEV-001" && !first.bodyHidden, JSON.stringify(first));
  check("the graph is not embedded in details and the workspace starts closed", first.workspaceHidden && !first.graphInDetails, JSON.stringify(first));
  check("the details pane does not use a nested scroll container", first.overflow === "visible" || first.overflow === "clip" || first.maxHeight === "none" || first.maxHeight === "", JSON.stringify(first));

  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate((y) => window.scrollTo(0, y), Math.min(1200, Math.max(0, height - 900)));
  await sleep(100);
  const scrolled = await page.evaluate(() => ({
    scrollY: window.scrollY,
    height: document.documentElement.scrollHeight,
    hasSources: !!document.getElementById("details-sources"),
    nested: getComputedStyle(document.querySelector(".details")).overflow
  }));
  check("the page can scroll through the full detail content", scrolled.scrollY > 200 && scrolled.height > 900 && scrolled.hasSources && scrolled.nested === "visible", JSON.stringify(scrolled));

  await page.click("#explore-from-details");
  await sleep(800);
  const workspace = await page.evaluate(() => ({
    workspaceHidden: document.getElementById("graph-workspace").hidden,
    chainHidden: document.getElementById("chain").hidden,
    detailsDisplay: getComputedStyle(document.querySelector(".details")).display,
    root: document.getElementById("map-status").dataset.root
  }));
  check("Explore opens the chain workspace for the same control with the details below it", !workspace.workspaceHidden && !workspace.chainHidden && workspace.detailsDisplay === "block" && workspace.root === "control:insurance:SRF-L3-DEV-001", JSON.stringify(workspace));

  await page.click("#hide-graph");
  await sleep(500);
  const back = await page.evaluate(() => ({
    workspaceHidden: document.getElementById("graph-workspace").hidden,
    heading: document.getElementById("details-heading").textContent,
    root: document.getElementById("map-status").dataset.root
  }));
  check("Back to details keeps the insurance control selected", back.workspaceHidden && back.root === "control:insurance:SRF-L3-DEV-001" && /Prompt Injection Defense/.test(back.heading), JSON.stringify(back));

  await page.reload({ waitUntil: "load" });
  await page.waitForSelector('#map-status[data-ready="true"]', { timeout: 60000 });
  const refreshed = await page.evaluate(() => ({
    root: document.getElementById("map-status").dataset.root,
    heading: document.getElementById("details-heading").textContent,
    bodyHidden: document.getElementById("details-body").hidden
  }));
  check("refreshing the deep link restores the same control", refreshed.root === "control:insurance:SRF-L3-DEV-001" && /Prompt Injection Defense/.test(refreshed.heading) && !refreshed.bodyHidden, JSON.stringify(refreshed));

  await page.setViewport({ width: 800, height: 900 });
  await sleep(300);
  await page.setViewport({ width: 375, height: 812 });
  await sleep(400);
  const phone = await sheetState(page);
  check("the phone sheet opens for the restored control", phone.shown && phone.sheetOpen, JSON.stringify(phone));
  check("no page errors in the detail/graph split", page.__errors.length === 0, page.__errors.join("; "));
  await page.close();
}


const PREVIEW_TEXT = "This map is a preview. Risk-to-obligation links are in the data. Each link is indirect: it runs through a control that addresses the risk and cites the obligation. The link does not mean the legal text names the risk.";
const MODEL_SLUGS = { "AI-SaaS": "ai-saas", "AI-PaaS": "ai-paas", "Agent-PaaS": "agent-paas", "IaaS": "iaas" };
const norm = (text) => text.replace(/\s+/g, " ").trim();
const mapState = (page) => page.$eval("#map-status", (el) => ({ selected: el.dataset.selected, root: el.dataset.root, model: el.dataset.model, view: el.dataset.view }));

async function testUrlState(browser, base) {
  console.log("\n## URL state: node, type, model, view");
  const bare = await openPage(browser, base, 1280, 900, "");
  const first = await bare.evaluate(() => ({
    selected: document.getElementById("map-status").dataset.selected,
    root: document.getElementById("map-status").dataset.root,
    workspaceHidden: document.getElementById("graph-workspace").hidden,
    emptyShown: !document.getElementById("details-empty").hidden,
    search: location.search
  }));
  check("a bare load selects nothing, opens no trace, and leaves the URL clean", !first.selected && !first.root && first.workspaceHidden && first.emptyShown && first.search === "", JSON.stringify(first));

  const radios = await bare.$$eval('input[name="operating-model"]', (els) => els.map((el) => el.value));
  check("the operating model filter offers All and the four SRF models only", radios.join() === ["all"].concat(MODELS).join(), radios.join());
  const bodyText = await bare.evaluate(() => document.body.innerText);
  check("no page text names On-Prem as an operating model", !/on-prem/i.test(bodyText));

  const before = await bare.evaluate(() => history.length);
  await pickModel(bare, "AI-PaaS");
  await openEntry(bare, "threat");
  await bare.select("#risk-suggestions", "risk:directpromptinjection");
  await sleep(500);
  const afterSelect = await bare.evaluate(() => ({ search: location.search, length: history.length }));
  const params = new URLSearchParams(afterSelect.search);
  check("selecting a risk writes type, node, model slug, and list view", params.get("type") === "risk" && params.get("node") === "directpromptinjection" && params.get("model") === "ai-paas" && params.get("view") === "list", afterSelect.search);
  check("opening a trace adds exactly one history entry; model and entry changes add none", afterSelect.length === before + 1, before + " -> " + afterSelect.length);

  await clickNow(bare, "#explore-from-details");
  await sleep(700);
  const graphParams = new URLSearchParams(await bare.evaluate(() => location.search));
  check("opening the graph writes view=graph and keeps the selection", graphParams.get("view") === "graph" && graphParams.get("node") === "directpromptinjection" && graphParams.get("model") === "ai-paas", String(graphParams));
  const sharedUrl = bare.url();
  await bare.close();

  const restored = await openPage(browser, base, 1280, 900, sharedUrl.slice(sharedUrl.indexOf("?")));
  const back = await restored.evaluate(() => ({
    selected: document.getElementById("map-status").dataset.selected,
    model: document.querySelector('input[name="operating-model"]:checked').value,
    workspaceShown: !document.getElementById("graph-workspace").hidden,
    heading: document.getElementById("details-heading").textContent
  }));
  check("loading the shared URL restores the item, the model, and the graph view", back.selected === "risk:directpromptinjection" && back.model === "AI-PaaS" && back.workspaceShown, JSON.stringify(back));
  await restored.close();

  const listLoad = await openPage(browser, base, 1280, 900, "?type=control&node=finance:SRF-L3-DEV-001&model=iaas&view=list");
  const control = await listLoad.evaluate(() => ({
    selected: document.getElementById("map-status").dataset.selected,
    model: document.querySelector('input[name="operating-model"]:checked').value,
    workspaceHidden: document.getElementById("graph-workspace").hidden,
    search: location.search
  }));
  check("a control link restores a control in list view", control.selected === "control:finance:SRF-L3-DEV-001" && control.model === "IaaS" && control.workspaceHidden, JSON.stringify(control));
  check("colons in the node id stay readable in the URL", /node=finance:SRF-L3-DEV-001/.test(control.search), control.search);
  await listLoad.close();

  const persona = await openPage(browser, base, 1280, 900, "?type=persona&node=application-developer");
  const personaState = await persona.evaluate(() => ({ heading: document.getElementById("details-heading").textContent, search: location.search, copyShown: !document.getElementById("copy-chain").hidden }));
  check("a persona link opens that persona and rewrites its own URL", personaState.heading === "Application Developer" && /type=persona&node=application-developer/.test(personaState.search) && personaState.copyShown, JSON.stringify(personaState));
  await persona.close();

  for (const model of MODELS) {
    const page = await openPage(browser, base, 1280, 900, "?model=" + MODEL_SLUGS[model]);
    const checkedValue = await page.$eval('input[name="operating-model"]:checked', (el) => el.value);
    check("model slug " + MODEL_SLUGS[model] + " selects " + model, checkedValue === model, checkedValue);
    await page.close();
  }
  const legacy = await openPage(browser, base, 1280, 900, "?model=AI-PaaS&risk=directpromptinjection&graph=1");
  const legacyState = await legacy.evaluate(() => ({ model: document.querySelector('input[name="operating-model"]:checked').value, root: document.getElementById("map-status").dataset.root, search: location.search }));
  check("older risk=, model=, and graph=1 links still load and are rewritten", legacyState.model === "AI-PaaS" && legacyState.root === "risk:directpromptinjection" && /model=ai-paas/.test(legacyState.search) && /type=risk/.test(legacyState.search) && /view=graph/.test(legacyState.search), JSON.stringify(legacyState));
  await legacy.close();

  const badQueries = ["?type=bogus&node=x", "?type=risk&node=does-not-exist", "?type=control&node=", "?model=on-prem", "?model=%00&view=zzz", "?node=directpromptinjection", "?type=<script>&node=\"'", "?view=graph&type=persona&node=nobody"];
  for (const query of badQueries) {
    const page = await openPage(browser, base, 1280, 900, query);
    const state = await mapState(page);
    check("invalid parameters are ignored without errors: " + query, !state.selected && state.model === "all" && page.__errors.length === 0, JSON.stringify(state) + page.__errors.join(";"));
    await page.close();
  }
}

async function stubClipboard(page, mode) {
  await page.evaluate((m) => {
    window.__copied = null;
    const stub = m === "ok"
      ? { writeText: (text) => { window.__copied = text; return Promise.resolve(); } }
      : { writeText: () => Promise.reject(new DOMException("blocked", "NotAllowedError")) };
    Object.defineProperty(navigator, "clipboard", { value: stub, configurable: true });
    if (m !== "ok") document.execCommand = () => false;
  }, mode);
}

async function testCopyChain(browser, base) {
  console.log("\n## Copy chain as Markdown");
  const page = await openPage(browser, base, 1280, 900, "?type=risk&node=directpromptinjection&model=ai-paas&view=list");
  await stubClipboard(page, "ok");
  const hiddenBefore = await openPage(browser, base, 1280, 900, "");
  check("the copy button is hidden until a chain is open", await hiddenBefore.$eval("#copy-chain", (el) => el.hidden));
  await hiddenBefore.close();
  const live = await page.$eval("#copy-status", (el) => ({ role: el.getAttribute("role"), live: el.getAttribute("aria-live") }));
  check("the copy message sits in a polite live region", live.role === "status" && live.live === "polite", JSON.stringify(live));
  const inHeader = await page.$eval("#copy-chain", (el) => !!el.closest(".details__actions") && el.textContent === "Copy chain as Markdown");
  check("the button is in the node details action row", inHeader);

  await page.focus("#copy-chain");
  await page.keyboard.press("Enter");
  await sleep(250);
  const copied = await page.evaluate(() => ({ text: window.__copied, label: document.getElementById("copy-chain").textContent, status: document.getElementById("copy-status").textContent, url: location.href, active: document.activeElement.id }));
  check("Enter on the button copies Markdown", typeof copied.text === "string" && copied.text.indexOf("# Direct prompt injection") === 0, String(copied.text).slice(0, 80));
  check("the Markdown names the model, the selected item, and the deep link", /- Operating model: AI-PaaS\n/.test(copied.text) && /- Selected item: Risk, Direct prompt injection \(directpromptinjection\)\n/.test(copied.text) && copied.text.indexOf("- Link: " + copied.url + "\n") !== -1, copied.text.slice(0, 400));
  const direct = threats.find((t) => t.id === "directpromptinjection");
  const expectedControls = (direct.related_controls || []).filter((fullId) => {
    const found = controls.find((c) => c.nodeId === "control:" + fullId.replace(/^srf\.control\.(.+?)\.(SRF-.+)$/, "$1:$2"));
    return found && found.core.indexOf("AI-PaaS") !== -1;
  });
  const controlLines = (copied.text.split("## Controls\n")[1] || "").split("\n## ")[0].split("\n").filter((l) => l.indexOf("- ") === 0);
  check("the Markdown lists every control for AI-PaaS (" + expectedControls.length + ")", controlLines.length === expectedControls.length && expectedControls.length > 0, controlLines.length + " vs " + expectedControls.length);
  check("the Markdown lists obligations and the accountable persona", /## Obligations\n- /.test(copied.text) && /## Accountable persona\n- Application Developer \(AI-PaaS\)/.test(copied.text), copied.text.slice(-600));
  check("the button reads Copied and the live region says so", copied.label === "Copied" && /^Copied/.test(copied.status) && copied.active === "copy-chain", JSON.stringify({ label: copied.label, status: copied.status, active: copied.active }));
  await sleep(2300);
  const reset = await page.evaluate(() => ({ label: document.getElementById("copy-chain").textContent, status: document.getElementById("copy-status").textContent }));
  check("after 2 seconds the label and the message reset", reset.label === "Copy chain as Markdown" && reset.status === "", JSON.stringify(reset));
  await page.close();

  const failing = await openPage(browser, base, 1280, 900, "?type=control&node=finance:SRF-L3-DEV-001");
  await stubClipboard(failing, "fail");
  await failing.click("#copy-chain");
  await sleep(300);
  const failure = await failing.evaluate(() => {
    const status = document.getElementById("copy-status");
    const area = document.getElementById("copy-fallback");
    const box = area.getBoundingClientRect();
    return { text: status.textContent, error: status.classList.contains("copy-status--error"), areaShown: !area.hidden && box.height > 0, areaText: area.value.slice(0, 20), label: document.getElementById("copy-chain").textContent, focus: document.activeElement.id };
  });
  check("a clipboard failure shows a visible message and the text to copy by hand", /Could not copy/.test(failure.text) && failure.error && failure.areaShown && failure.areaText.indexOf("# ") === 0 && failure.label === "Copy chain as Markdown" && failure.focus === "copy-fallback", JSON.stringify(failure));
  await failing.keyboard.press("Escape");
  await sleep(300);
  check("no page errors while copying", failing.__errors.length === 0, failing.__errors.join("; "));
  await failing.close();

  const phone = await openPage(browser, base, 375, 812, "?type=risk&node=directpromptinjection");
  const layout = await phone.evaluate(() => {
    const bar = document.querySelector(".details__bar").getBoundingClientRect();
    const title = document.getElementById("details-heading").getBoundingClientRect();
    const copy = document.getElementById("copy-chain").getBoundingClientRect();
    return { titleWidth: title.width, titleHeight: title.height, copyRight: copy.right, barRight: bar.right, width: window.innerWidth };
  });
  check("on the phone the sheet title is readable and the buttons stay inside the sheet", layout.titleWidth > 200 && layout.titleHeight < 80 && layout.copyRight <= layout.width, JSON.stringify(layout));
  await phone.close();
}

async function loadWithRoutes(browser, base, width, query, handler) {
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: width > 600 ? 900 : 812 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on("request", (req) => { if (!handler(req)) req.continue(); });
  await page.goto(base + "/tools/relationship-map/index.html" + (query || ""), { waitUntil: "load" });
  page.__errors = errors;
  return page;
}

async function testDropdownPickers(browser, base) {
  console.log("\n## Risk and control pickers are drop-down lists");
  const page = await openPage(browser, base, 1280, 900, "");
  const info = await page.evaluate(() => {
    const r = document.getElementById("risk-suggestions");
    const c = document.getElementById("suggestions");
    return {
      riskTag: r.tagName, controlTag: c.tagName,
      riskOptions: r.querySelectorAll("option[data-node-id]").length,
      controlOptions: c.querySelectorAll("option[data-node-id]").length,
      groups: r.querySelectorAll("optgroup").length,
      riskLabel: document.querySelector('label[for="risk-suggestions"]').textContent.trim(),
      controlLabel: document.querySelector('label[for="suggestions"]').textContent.trim()
    };
  });
  check("risks and controls are select elements with labels", info.riskTag === "SELECT" && info.controlTag === "SELECT" && info.riskLabel === "Risk" && info.controlLabel === "Control", JSON.stringify(info));
  check("each picker lists many options grouped by layer", info.riskOptions >= 20 && info.controlOptions > 50 && info.groups >= 2, JSON.stringify(info));
  await page.focus("#risk-suggestions");
  await page.select("#risk-suggestions", "risk:directpromptinjection");
  await sleep(200);
  const after = await page.evaluate(() => ({ url: location.search, title: document.querySelector("#details-title, #details h2, #details-chain")?.textContent.slice(0, 80) }));
  check("choosing a risk in the drop-down opens its chain and updates the URL", /node=directpromptinjection/.test(after.url) && /type=risk/.test(after.url), JSON.stringify(after));
  await page.close();
}


async function testPlainDetails(browser, base) {
  console.log("\n## Plain-language details");
  const banned = ["related_controls", "accountable_by_model", "derived_via_control", "official_text", "Basis: none recorded", "Recorded basis", "mappings."];
  for (const query of ["?type=risk&node=directpromptinjection", "?type=control&node=" + (await (async () => { const p = await openPage(browser, base, 1280, 900, "?risk=directpromptinjection"); const id = await p.$eval('#chain-board button[data-chain-id^="control:"]', (el) => el.dataset.chainId.replace(/^control:/, "")); await p.close(); return id; })())]) {
    const page = await openPage(browser, base, 1280, 900, query);
    const shown = await page.evaluate(() => {
      const panel = document.querySelector(".details");
      return { text: panel.innerText, board: document.getElementById("chain-board").innerText, id: document.getElementById("details-id").textContent, kind: document.getElementById("details-kind").textContent };
    });
    const hits = banned.filter((w) => shown.text.indexOf(w) !== -1 || shown.board.indexOf(w) !== -1);
    check("no raw field names in visible text (" + query.slice(0, 40) + ")", hits.length === 0, JSON.stringify(hits));
    check("the record ID is a small ID: line (" + query.slice(0, 40) + ")", /^ID: \S+$/.test(shown.id), shown.id);
    await page.close();
  }
  const page = await openPage(browser, base, 1280, 900, "?type=risk&node=directpromptinjection");
  const text = await page.$eval("#details-chain", (el) => el.innerText);
  check("a risk link reads in plain words", text.indexOf("Listed as a control for this risk in the source record.") !== -1 && text.indexOf("No source citation recorded yet.") !== -1, text.slice(0, 200));
  const idStyle = await page.$eval("#details-id", (el) => ({ size: parseFloat(getComputedStyle(el).fontSize), kindSize: parseFloat(getComputedStyle(document.getElementById("details-kind")).fontSize) }));
  check("the ID line is small", idStyle.size <= 14, JSON.stringify(idStyle));
  await page.close();
}

async function testBackButton(browser, base) {
  console.log("\n## Back button and history");
  const page = await openPage(browser, base, 1280, 900, "");
  const start = await page.evaluate(() => history.length);
  await page.select("#risk-suggestions", "risk:directpromptinjection");
  await sleep(300);
  const opened = await page.evaluate(() => ({ len: history.length, search: location.search, root: document.getElementById("map-status").dataset.root }));
  check("opening a trace adds one history entry", opened.len === start + 1 && /node=directpromptinjection/.test(opened.search), JSON.stringify(opened));
  await clickNow(page, '#model-filter-list input[type="radio"]:not([value="all"])');
  await sleep(300);
  const afterFilter = await page.evaluate(() => ({ len: history.length, search: location.search }));
  check("a model change replaces the entry instead of adding one", afterFilter.len === start + 1 && /model=/.test(afterFilter.search), JSON.stringify(afterFilter));
  await page.goBack();
  await sleep(400);
  const back = await page.evaluate(() => ({ search: location.search, root: document.getElementById("map-status").dataset.root, active: document.activeElement.id, onPage: location.pathname.indexOf("relationship-map") !== -1, detailsHidden: document.getElementById("details-body").hidden }));
  check("Back closes the trace and stays in the tool", back.onPage && !/node=/.test(back.search) && !back.root && back.detailsHidden, JSON.stringify(back));
  check("after Back focus lands on the search field", back.active === "node-search", back.active);
  await page.goForward();
  await sleep(400);
  const fwd = await page.evaluate(() => ({ search: location.search, active: document.activeElement.id, root: document.getElementById("map-status").dataset.root }));
  check("Forward reopens the trace and focuses its heading", /node=directpromptinjection/.test(fwd.search) && fwd.root && fwd.active === "details-heading", JSON.stringify(fwd));

  await page.goBack();
  await sleep(300);
  await clickNow(page, "#show-graph");
  await sleep(300);
  const graph = await page.evaluate(() => ({ search: location.search, len: history.length }));
  check("opening the graph adds a history entry", /view=graph/.test(graph.search), JSON.stringify(graph));
  await page.goBack();
  await sleep(400);
  const noGraph = await page.evaluate(() => ({ search: location.search, shown: !document.getElementById("graph-workspace").hidden }));
  check("Back from the graph returns to the list", !/view=graph/.test(noGraph.search), JSON.stringify(noGraph));
  await page.close();

  const deep = await openPage(browser, base, 1280, 900, "?risk=directpromptinjection");
  const deepState = await deep.evaluate(() => ({ len: history.length, search: location.search }));
  const plain = await openPage(browser, base, 1280, 900, "");
  const plainLen = await plain.evaluate(() => history.length);
  await plain.close();
  check("loading a shared link does not add a history entry", deepState.len === plainLen && /node=directpromptinjection/.test(deepState.search), JSON.stringify(deepState));
  await deep.close();
}

async function testPhoneHeaderAndIntro(browser, base) {
  console.log("\n## Phone header and intro");
  const page = await openPage(browser, base, 375, 812, "?type=risk&node=directpromptinjection");
  const bar = await page.evaluate(() => {
    const el = document.querySelector(".details__bar");
    const r = el.getBoundingClientRect();
    const clear = document.getElementById("clear-selection").getBoundingClientRect();
    return { height: r.height, sticky: getComputedStyle(el).position, clearInside: clear.bottom <= r.bottom + 1 && clear.height >= 44, copyVisible: document.getElementById("copy-chain").getClientRects().length > 0 };
  });
  check("the sticky phone header is 100px or less and keeps the back button", bar.height <= 100 && bar.sticky === "sticky" && bar.clearInside, JSON.stringify(bar));
  check("Copy chain stays reachable on the phone", bar.copyVisible, JSON.stringify(bar));
  await page.close();

  const list = await openPage(browser, base, 375, 812, "");
  const sticky = await list.evaluate(() => Array.from(document.querySelectorAll("*")).filter((e) => ["sticky", "fixed"].indexOf(getComputedStyle(e).position) !== -1 && e.getClientRects().length).map((e) => e.getBoundingClientRect().height));
  check("no sticky element on the phone list view is taller than 100px", sticky.every((h) => h <= 100) && await list.$("#node-search") !== null, JSON.stringify(sticky));
  await list.close();

  const desk = await openPage(browser, base, 1280, 900, "");
  const intro = await desk.evaluate(() => {
    const p = document.getElementById("hero-summary");
    const sentences = p.textContent.trim().split(/(?<=[.?!])\s+/).filter(Boolean);
    return {
      paragraphs: document.querySelectorAll(".map-hero__inner > p").length,
      sentences: sentences.length,
      entries: Array.from(document.querySelectorAll(".entry-points button")).map((b) => b.textContent.trim()),
      reqInPreview: !!document.querySelector(".map-preview #entry-requirement"),
      gapInPreview: !!document.querySelector(".map-preview #entry-gap")
    };
  });
  check("the intro is one paragraph of at most two sentences", intro.paragraphs === 1 && intro.sentences <= 2, JSON.stringify(intro));
  check("the main choices are risk, control, and accountability", JSON.stringify(intro.entries) === JSON.stringify(["Explore a risk", "Explore a control", "Explore accountability"]), JSON.stringify(intro.entries));
  check("the requirements note lives in the Preview disclosure", intro.reqInPreview && intro.gapInPreview, JSON.stringify(intro));
  await desk.evaluate(() => { document.querySelector(".map-preview details").open = true; });
  await clickNow(desk, "#entry-requirement");
  await sleep(300);
  const gap = await desk.evaluate(() => ({ shown: !document.getElementById("entry-gap").hidden, visible: document.getElementById("entry-gap").getClientRects().length > 0 }));
  check("the requirements button shows the explanation in place", gap.shown && gap.visible, JSON.stringify(gap));
  await desk.close();
}

async function testLoadResilience(browser, base) {
  console.log("\n## Load placeholders, error alert, and Retry");
  let release = null;
  const gate = new Promise((resolve) => { release = resolve; });
  const slow = await loadWithRoutes(browser, base, 1280, "", (req) => {
    if (!req.url().endsWith("/data/threats.json")) return false;
    gate.then(() => req.continue());
    return true;
  });
  await sleep(600);
  const loading = await slow.evaluate(() => {
    const visibleText = (el) => Array.from(el.querySelectorAll("*")).concat([el]).filter((n) => n.children.length === 0 && !n.closest(".visually-hidden") && n.textContent.trim()).map((n) => n.textContent.trim());
    const coverage = document.getElementById("coverage-body");
    const status = document.getElementById("map-status");
    const loadingBox = document.getElementById("map-loading");
    return {
      coverageHeight: coverage.getBoundingClientRect().height,
      coverageText: visibleText(coverage),
      statusText: visibleText(status),
      bars: document.querySelectorAll(".load-placeholder__bar").length,
      loadingHeight: loadingBox.getBoundingClientRect().height,
      busy: coverage.getAttribute("aria-busy"),
      statusRole: status.getAttribute("role")
    };
  });
  check("while loading, the pickers reserve at least 200px and the status line shows no visible text", loading.loadingHeight >= 200 && loading.statusText.length === 0 && loading.bars >= 8 && loading.statusRole === "status" && loading.coverageText.length === 0 && loading.busy === "true", JSON.stringify(loading));
  const heightBefore = await slow.evaluate(() => document.documentElement.scrollHeight);
  release();
  await slow.waitForSelector('#map-status[data-ready="true"]', { timeout: 60000 });
  const after = await slow.evaluate(() => ({ height: document.documentElement.scrollHeight, placeholderGone: document.getElementById("map-loading").hidden, busy: document.getElementById("coverage-body").getAttribute("aria-busy"), coverageHeading: !!document.querySelector("#coverage-body h3") }));
  check("after loading, the placeholders are replaced by real content", after.placeholderGone && after.busy === null && after.coverageHeading, JSON.stringify(after));
  console.log("     page height before " + heightBefore + "px, after " + after.height + "px");
  const pickerShift = await slow.evaluate(() => document.getElementById("suggestions-wrap").getBoundingClientRect().height);
  check("the loaded pickers fit the reserved height within 120px", Math.abs(pickerShift - loading.loadingHeight) < 120, pickerShift + " vs " + loading.loadingHeight);
  await slow.close();

  let coverageRelease = null;
  const coverageGate = new Promise((resolve) => { coverageRelease = resolve; });
  const covSlow = await loadWithRoutes(browser, base, 1280, "?page=coverage", (req) => {
    if (!req.url().endsWith("/data/threats.json")) return false;
    coverageGate.then(() => req.continue());
    return true;
  });
  await sleep(600);
  const covLoading = await covSlow.evaluate(() => {
    const coverage = document.getElementById("coverage-body");
    const visible = Array.from(coverage.querySelectorAll("*")).filter((n) => n.children.length === 0 && !n.closest(".visually-hidden") && n.textContent.trim());
    return { height: coverage.getBoundingClientRect().height, text: visible.length, busy: coverage.getAttribute("aria-busy") };
  });
  check("while loading, the coverage page reserves at least 800px and shows no loading sentence", covLoading.height >= 800 && covLoading.text === 0 && covLoading.busy === "true", JSON.stringify(covLoading));
  coverageRelease();
  await covSlow.waitForSelector('#map-status[data-ready="true"]', { timeout: 60000 });
  const cov = await covSlow.evaluate(() => ({
    title: document.querySelector(".page-hero__title").textContent,
    headings: Array.from(document.querySelectorAll("#coverage-body h3")).length,
    layoutHidden: getComputedStyle(document.querySelector(".map-layout")).display === "none",
    back: document.querySelector(".coverage-back a").getAttribute("href"),
    url: location.search
  }));
  check("the coverage page shows the coverage lists, hides the explorer, and links back", cov.title === "Data coverage" && cov.headings >= 5 && cov.layoutHidden && cov.back === "./" && cov.url === "?page=coverage", JSON.stringify(cov));
  await covSlow.close();

  const normal = await openPage(browser, base, 1280, 900, "");
  const link = await normal.evaluate(() => ({
    sectionHidden: document.getElementById("coverage").hidden || getComputedStyle(document.getElementById("coverage")).display === "none",
    href: document.querySelector(".coverage-link a").getAttribute("href"),
    jump: !!document.querySelector('.map-jump a[href="#coverage-heading"]')
  }));
  check("the explorer page no longer shows coverage, only a link to it", link.sectionHidden && link.href === "?page=coverage" && !link.jump, JSON.stringify(link));
  await normal.close();

  let failures = 2;
  const failing = await loadWithRoutes(browser, base, 1280, "?type=risk&node=directpromptinjection&model=ai-paas", (req) => {
    if (!req.url().endsWith("/data/threats.json")) return false;
    if (failures > 0) {
      failures -= 1;
      if (failures === 1) req.respond({ status: 500, contentType: "text/plain", body: "boom" });
      else req.respond({ status: 200, contentType: "application/json", body: "{ not json" });
      return true;
    }
    return false;
  });
  await failing.waitForFunction(() => !document.getElementById("map-error-box").hidden, { timeout: 30000 });
  const err = await failing.evaluate(() => {
    const alert = document.getElementById("map-error");
    const retry = document.getElementById("map-retry");
    const box = retry.getBoundingClientRect();
    return { role: alert.getAttribute("role"), text: alert.textContent, retryShown: box.width > 0 && retry.textContent === "Retry", retryInAlert: alert.contains(retry), ready: document.getElementById("map-status").dataset.ready || "" , coverage: document.getElementById("coverage-body").textContent, loadingHidden: document.getElementById("map-loading").hidden };
  });
  check("a failed fetch puts a clear message in a role=alert region", err.role === "alert" && /threats\.json/.test(err.text) && /500/.test(err.text), JSON.stringify(err));
  check("a Retry button is visible next to the message, and placeholders are gone", err.retryShown && err.loadingHidden && !err.ready && /Retry/.test(err.coverage), JSON.stringify(err));

  await failing.focus("#map-retry");
  await failing.keyboard.press("Enter");
  await failing.waitForFunction(() => !document.getElementById("map-error-box").hidden && /JSON|Unexpected|Expected/i.test(document.getElementById("map-error").textContent), { timeout: 30000 });
  const second = await failing.evaluate(() => ({ text: document.getElementById("map-error").textContent, active: document.activeElement.id }));
  check("a parse failure also lands in the alert, and focus returns to Retry", second.active === "map-retry" && second.text.length > 0 && !/\(500\)/.test(second.text), JSON.stringify(second));

  await failing.keyboard.press("Space");
  await failing.waitForSelector('#map-status[data-ready="true"]', { timeout: 60000 });
  const recovered = await failing.evaluate(() => ({
    errorHidden: document.getElementById("map-error-box").hidden,
    models: Array.from(document.querySelectorAll('input[name="operating-model"]')).map((el) => el.value).join(),
    selected: document.getElementById("map-status").dataset.selected,
    model: document.querySelector('input[name="operating-model"]:checked').value,
    risks: document.querySelectorAll("#risk-suggestions option[data-node-id]").length
  }));
  check("Retry re-runs initialization without a page reload and applies the URL state", recovered.errorHidden && recovered.selected === "risk:directpromptinjection" && recovered.model === "AI-PaaS", JSON.stringify(recovered));
  check("Retry does not duplicate filter options or list items", recovered.models === ["all"].concat(MODELS).join() && recovered.risks === threats.length, JSON.stringify(recovered));
  check("no uncaught page errors in the error and retry path", failing.__errors.length === 0, failing.__errors.join("; "));
  await failing.close();

  const phone = await loadWithRoutes(browser, base, 375, "", (req) => {
    if (!req.url().endsWith("/data/matrix.json")) return false;
    req.respond({ status: 404, contentType: "text/plain", body: "no" });
    return true;
  });
  await phone.waitForFunction(() => !document.getElementById("map-error-box").hidden, { timeout: 30000 });
  const small = await phone.evaluate(() => {
    const retry = document.getElementById("map-retry").getBoundingClientRect();
    return { retryWidth: retry.width, retryHeight: retry.height, right: retry.right, width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  check("at 375 the Retry button is at least 44px tall and nothing scrolls sideways", small.retryHeight >= 44 && small.right <= small.width && small.scrollWidth <= small.width, JSON.stringify(small));
  await phone.close();
}

async function testDisclosures(browser, base) {
  console.log("\n## Disclosures: preview, line types, illustrative titles");
  const page = await openPage(browser, base, 1280, 900, "");
  const preview = await page.evaluate(() => {
    const wrap = document.querySelector(".map-preview");
    const details = wrap.querySelector("details");
    return { label: wrap.querySelector(".map-preview__label").textContent.trim(), open: details.open, summary: details.querySelector("summary").textContent.trim(), text: details.querySelector("p").textContent, wrapHeight: wrap.getBoundingClientRect().height, standaloneNote: !!document.querySelector("aside.map-preview") };
  });
  check("the Preview note is a compact inline label with a closed disclosure", preview.label === "Preview" && preview.open === false && preview.summary.length > 0 && preview.wrapHeight < 80 && !preview.standaloneNote, JSON.stringify(preview));
  check("the disclosure holds the full caveat text unchanged", norm(preview.text) === PREVIEW_TEXT, preview.text);
  await page.focus(".map-preview__details summary");
  await page.keyboard.press("Enter");
  check("Enter on the Preview summary opens the caveat", await page.$eval(".map-preview__details", (el) => el.open && el.querySelector("p").checkVisibility()));
  await page.keyboard.press("Escape");
  check("Escape closes it and keeps focus on the summary", await page.evaluate(() => !document.querySelector(".map-preview__details").open && document.activeElement.tagName === "SUMMARY"));

  await openEntry(page, "account");
  const fold = await page.evaluate(() => {
    const details = document.querySelector(".illustrative-fold");
    const table = document.querySelector("table.illustrative");
    const panel = document.getElementById("entry-account-panel");
    return {
      summary: details.querySelector("summary").textContent.trim(),
      open: details.open,
      tableInside: details.contains(table),
      paragraphInside: Array.from(details.children).some((el) => el.tagName === "P" && /not\s+personas in the SRF/.test(el.textContent)),
      tableVisible: table.checkVisibility(),
      personasOutside: !details.contains(document.getElementById("persona-list")) && panel.contains(document.getElementById("persona-list"))
    };
  });
  check("the illustrative table and its paragraph sit in a closed disclosure with the required summary", fold.summary === "View illustrative handoff titles (examples, not SRF)" && !fold.open && fold.tableInside && fold.paragraphInside && !fold.tableVisible && fold.personasOutside, JSON.stringify(fold));
  await page.focus(".illustrative-fold summary");
  await page.keyboard.press("Enter");
  check("Enter opens the illustrative table", await page.$eval("table.illustrative", (el) => el.checkVisibility()));
  await page.keyboard.press("Escape");
  check("Escape closes the illustrative table and returns to the summary", await page.evaluate(() => !document.querySelector(".illustrative-fold").open && document.activeElement.tagName === "SUMMARY"));
  await page.close();

  const chain = await openPage(browser, base, 1280, 900, "?type=risk&node=directpromptinjection&view=graph");
  const legend = await chain.evaluate(() => {
    const items = Array.from(document.querySelectorAll("#chain-legend li")).map((li) => li.textContent.trim());
    const details = document.querySelector(".legend-help");
    return { items: items, open: details.open, full: Array.from(details.querySelectorAll("li")).map((li) => li.textContent.trim()), titles: document.querySelectorAll("#chain-legend [title]").length };
  });
  check("the line-type legend uses the three short labels", legend.items.join("|") === "Solid: direct basis|Dashed: via shared control|Dotted: instrument level", legend.items.join("|"));
  check("the full sentences are in a closed disclosure, not in title attributes", !legend.open && legend.titles === 0 && legend.full.length === 3 && /The record names this link/.test(legend.full[0]) && /The legal text does not name the risk/.test(legend.full[1]) && /No article record matched/.test(legend.full[2]), JSON.stringify(legend));
  await chain.focus(".legend-help summary");
  await chain.keyboard.press("Enter");
  check("Enter opens the line-type explanation", await chain.$eval(".legend-help", (el) => el.open && el.querySelector("li").checkVisibility()));
  await chain.keyboard.press("Escape");
  const afterEsc = await chain.evaluate(() => ({ open: document.querySelector(".legend-help").open, tag: document.activeElement.tagName, workspaceHidden: document.getElementById("graph-workspace").hidden }));
  check("Escape closes the explanation first and does not close the graph", !afterEsc.open && afterEsc.tag === "SUMMARY" && !afterEsc.workspaceHidden, JSON.stringify(afterEsc));
  check("no page errors with the disclosures", chain.__errors.length === 0, chain.__errors.join("; "));
  await chain.close();

  const phone = await openPage(browser, base, 375, 812, "");
  const phoneState = await phone.evaluate(() => {
    const label = document.querySelector(".map-preview__label").getBoundingClientRect();
    const summary = document.querySelector(".map-preview__details summary").getBoundingClientRect();
    return { labelVisible: label.height > 0, summaryVisible: summary.height > 0, sameRow: Math.abs(label.top - summary.top) < 20 };
  });
  check("at 375 the Preview label and its disclosure are visible on one row", phoneState.labelVisible && phoneState.summaryVisible && phoneState.sameRow, JSON.stringify(phoneState));
  await phone.close();
}

async function testRiskWording(browser, base) {
  console.log("\n## Risk, not Threat, in the explorer's own labels");
  const page = await openPage(browser, base, 1280, 900, "?type=risk&node=directpromptinjection&model=ai-paas&view=graph");
  const text = await page.evaluate(() => {
    const skip = "site-nav, site-footer, #risk-suggestions, #suggestions, #persona-list, #chain-board, #details-chain, #coverage-body, #context-board, #search-results";
    const parts = [];
    const main = document.getElementById("main");
    main.querySelectorAll("h1, h2, h3, h4, label, legend, button, summary, th, caption, p, li, span, a").forEach((el) => {
      if (el.closest(skip)) return;
      if (el.children.length) return;
      parts.push(el.textContent.trim());
    });
    document.querySelectorAll("#chain-board .chain-card__kicker, #chain-board .chain-col__toggle, #details-chain h3").forEach((el) => parts.push(el.textContent.trim()));
    parts.push(document.querySelector("#node-search").placeholder);
    return parts.filter(Boolean);
  });
  const hits = text.filter((t) => /\bthreats?\b/i.test(t));
  check("no explorer label calls a risk a threat", hits.length === 0, JSON.stringify(hits.slice(0, 5)));
  const status = await page.$eval("#map-status", (el) => el.textContent);
  check("the status line and the graph label use risk", !/threat/i.test(status) && !/threat/i.test(await page.$eval("#graph", (el) => el.getAttribute("aria-label"))), status);
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

const ROCA_KEYS = ["risk", "obligation", "control", "accountable"];
const ROCA_WORD = { risk: "Why", obligation: "What", control: "How", accountable: "Who" };
const ROCA_NAME = { risk: "Risk", obligation: "Obligation", control: "Control", accountable: "Accountable" };
const ROCA_ALL = { risk: "All risks", obligation: "All obligations", control: "All controls", accountable: "All accountable parties" };
const PERSONA_CHAIN_QUERY = "?type=persona&node=ai-platform-provider&view=list";

async function openPersonaChain(browser, base, width, height, query) {
  const page = await openPage(browser, base, width, height, query || PERSONA_CHAIN_QUERY);
  await clickNow(page, "#explore-from-details");
  await sleep(900);
  return page;
}

const readRoca = (page) => page.evaluate(() => {
  const out = {};
  document.querySelectorAll("#chain-board .chain-col").forEach((col) => {
    const select = col.querySelector("select.chain-pick");
    const heading = col.querySelector("h3");
    const rect = select ? select.getBoundingClientRect() : null;
    out[col.dataset.column] = {
      exists: !!select,
      className: select ? select.className : "",
      labelledBy: select ? select.getAttribute("aria-labelledby") : "",
      headingId: heading.id,
      headingName: heading.getAttribute("aria-label"),
      first: select ? select.options[0].textContent : "",
      options: select ? select.options.length - 1 : -1,
      value: select ? select.value : "",
      cards: col.querySelectorAll("button[data-chain-id]").length,
      pressed: Array.from(col.querySelectorAll('button[data-chain-id][aria-pressed="true"]')).map((b) => b.dataset.chainId),
      more: Array.from(col.querySelectorAll("button.chain-more")).map((b) => b.textContent),
      rect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
      display: select ? getComputedStyle(select).display : ""
    };
  });
  return out;
});

const readPanel = (page) => page.evaluate(() => {
  const el = document.querySelector(".details");
  const board = document.getElementById("chain-board").getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    visible: el.getClientRects().length > 0,
    inSlot: !!el.closest("#chain-details-slot"),
    belowColumns: r.top >= board.bottom - 1,
    width: r.width,
    heading: document.getElementById("details-heading").textContent,
    headingTag: document.getElementById("details-heading").tagName,
    kind: document.getElementById("details-kind").textContent,
    id: document.getElementById("details-id").hidden ? "" : document.getElementById("details-id").textContent,
    text: document.getElementById("details-chain").innerText,
    sections: Array.from(document.querySelectorAll("#details-chain h3")).map((h) => h.textContent),
    obligationItems: document.querySelectorAll("#details-obligations ul > li, .details-section ul > li strong").length,
    live: document.getElementById("details-live").textContent,
    liveRole: document.getElementById("details-live").getAttribute("role"),
    livePolite: document.getElementById("details-live").getAttribute("aria-live"),
    labelledBy: el.getAttribute("aria-labelledby")
  };
});

async function pickValue(page, key, value) {
  await page.select("#chain-select-" + key, value);
  await sleep(350);
}

async function optionValues(page, key) {
  return page.$$eval("#chain-select-" + key + " option", (opts) => opts.map((o) => ({ value: o.value, text: o.textContent })));
}

async function testRocaSelects(browser, base, width, height) {
  const at = " at " + width;
  const page = await openPersonaChain(browser, base, width, height);
  const status = await page.$eval("#map-status", (el) => el.textContent);
  const counts = /Showing (\d+) risks?, (\d+) obligations?, (\d+) controls?, and (\d+) accountable personas?/.exec(status);
  const total = { risk: +counts[1], obligation: +counts[2], control: +counts[3], accountable: +counts[4] };

  let roca = await readRoca(page);
  check("each ROCA column has one native select" + at, ROCA_KEYS.every((k) => roca[k] && roca[k].exists) && (await page.$$eval("#chain-board select", (els) => els.length)) === 4);
  check("the selects reuse the left-column drop-down style" + at, ROCA_KEYS.every((k) => /\bpick-select\b/.test(roca[k].className)) && ROCA_KEYS.every((k) => roca[k].rect.height >= 44));
  const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
  const named = [];
  (function walk(node) {
    if (!node) return;
    if (node.role === "combobox" && /^(Why|What|How|Who): /.test(node.name || "")) named.push(node.name);
    (node.children || []).forEach(walk);
  })(snapshot);
  check("the selects have the accessible names Why, What, How, Who with counts" + at, ROCA_KEYS.every((k, i) => named[i] === ROCA_WORD[k] + ": " + ROCA_NAME[k] + " (" + total[k] + ")"), JSON.stringify(named));
  check("each select is tied to its column heading by aria-labelledby" + at, ROCA_KEYS.every((k) => roca[k].labelledBy === roca[k].headingId && roca[k].headingName === ROCA_WORD[k] + ": " + ROCA_NAME[k] + " (" + total[k] + ")"), JSON.stringify(roca));
  check("the first options read All risks, All obligations, All controls, All accountable parties with counts" + at, ROCA_KEYS.every((k) => roca[k].first === ROCA_ALL[k] + " (" + total[k] + ")" && roca[k].options === total[k]), JSON.stringify(ROCA_KEYS.map((k) => [roca[k].first, roca[k].options])));
  const labels = await page.$$eval("#chain-board .chain-col h3 .chain-col__label", (els) => els.map((el) => el.textContent));
  check("the small why, what, how, who labels stay" + at, labels.join() === "why,what,how,who", labels.join());
  if (width === 1280) {
    check("the four selects sit in one row at 1280", new Set(ROCA_KEYS.map((k) => Math.round(roca[k].rect.top))).size === 1 && ROCA_KEYS.every((k, i) => i === 0 || roca[k].rect.left > roca[ROCA_KEYS[i - 1]].rect.left), JSON.stringify(ROCA_KEYS.map((k) => roca[k].rect)));
  } else {
    const lefts = new Set(ROCA_KEYS.map((k) => Math.round(roca[k].rect.left)));
    const tops = ROCA_KEYS.map((k) => roca[k].rect.top);
    check("the selects stack in one column at 375 with room to read", lefts.size === 1 && tops.every((t, i) => i === 0 || t > tops[i - 1]) && ROCA_KEYS.every((k) => roca[k].rect.width >= 240 && roca[k].rect.left >= 0 && roca[k].rect.left + roca[k].rect.width <= 375), JSON.stringify(ROCA_KEYS.map((k) => roca[k].rect)));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("no sideways scroll with the selects at 375", overflow <= 1, String(overflow));
  }

  const panel0 = await readPanel(page);
  check("the details panel sits below the four columns and is not squeezed" + at, panel0.visible && panel0.inSlot && panel0.belowColumns && panel0.width >= (width === 1280 ? 560 : 300), JSON.stringify(panel0));
  check("the details panel has a heading, a polite live region, and a labelled region" + at, panel0.headingTag === "H2" && panel0.liveRole === "status" && panel0.livePolite === "polite" && panel0.labelledBy === "details-heading");

  const riskOptions = (await optionValues(page, "risk")).slice(1);
  let riskPick = null;
  for (const opt of riskOptions) {
    await pickValue(page, "risk", opt.value);
    roca = await readRoca(page);
    if (roca.obligation.options > 0 && roca.obligation.options < total.obligation) { riskPick = opt; break; }
  }
  check("picking a risk narrows the Obligation select and boxes" + at, !!riskPick && roca.obligation.options < total.obligation && roca.obligation.cards === Math.min(roca.obligation.options, 8), JSON.stringify(roca.obligation));
  const afterRisk = roca;
  const statusRisk = await page.$eval("#map-status", (el) => el.textContent);
  check("the risk count and risk boxes stay whole, and the risk box is highlighted" + at, afterRisk.risk.options === total.risk && afterRisk.risk.value === riskPick.value && afterRisk.risk.pressed.join() === riskPick.value, JSON.stringify(afterRisk.risk));
  check("the labels, options, and status line show the narrowed counts" + at,
    afterRisk.obligation.headingName === "What: Obligation (" + afterRisk.obligation.options + ")" &&
    afterRisk.obligation.first === "All obligations (" + afterRisk.obligation.options + ")" &&
    afterRisk.control.headingName === "How: Control (" + afterRisk.control.options + ")" &&
    afterRisk.control.first === "All controls (" + afterRisk.control.options + ")" &&
    new RegExp("Showing " + total.risk + " risks, " + afterRisk.obligation.options + " obligations?, " + afterRisk.control.options + " controls?, and ").test(statusRisk), JSON.stringify([afterRisk.obligation, afterRisk.control, statusRisk]));
  check("a risk with fewer obligations also narrows the Control select" + at, afterRisk.control.options <= total.control && afterRisk.control.options > 0, JSON.stringify(afterRisk.control));
  const risk1 = await readPanel(page);
  check("picking a risk shows that risk record in the details panel" + at, risk1.visible && risk1.belowColumns && risk1.kind === "Risk" && risk1.heading === riskPick.text && /^ID: \S+/.test(risk1.id) && risk1.sections.indexOf("Key metadata") !== -1 && risk1.sections.indexOf("Description and objective") !== -1 && /Layer|layer/.test(risk1.text) && risk1.live.indexOf(riskPick.text) !== -1, JSON.stringify(risk1).slice(0, 700));

  const obligationOptions = (await optionValues(page, "obligation")).slice(1);
  const obPick = obligationOptions[0];
  await pickValue(page, "obligation", obPick.value);
  roca = await readRoca(page);
  check("picking an obligation keeps the risk pick and narrows Control" + at, roca.risk.value === riskPick.value && roca.obligation.value === obPick.value && roca.control.options <= afterRisk.control.options && roca.control.options > 0 && roca.control.first === "All controls (" + roca.control.options + ")", JSON.stringify([roca.risk.value, roca.obligation.value, roca.control.options, afterRisk.control.options]));
  check("the obligation box is highlighted beside the risk box" + at, roca.obligation.pressed.join() === obPick.value && roca.risk.pressed.join() === riskPick.value);
  const ob1 = await readPanel(page);
  check("picking an obligation shows its record with citation and basis" + at, ob1.kind === "Obligation" && ob1.heading.length > 0 && ob1.sections.indexOf("Description and objective") !== -1 && ob1.sections.indexOf("Supporting obligations") !== -1 && ob1.sections.indexOf("Sources and relationship provenance") !== -1 && /Implements this obligation|Cited by/.test(ob1.text) && /Obligation text|Citation on the control|Instrument/.test(ob1.text) && ob1.live.indexOf("Obligation") !== -1, JSON.stringify(ob1).slice(0, 900));
  const dutyCount = await page.$$eval("#details-obligations", (els) => els[0].parentElement.querySelectorAll("ul > li").length);
  check("the details panel lists only the picked obligation" + at, dutyCount === 1, String(dutyCount));

  const controlOptions = (await optionValues(page, "control")).slice(1);
  const ctlPick = controlOptions[0];
  await pickValue(page, "control", ctlPick.value);
  roca = await readRoca(page);
  check("picking a control keeps the earlier picks and leaves the Accountable select" + at, roca.control.value === ctlPick.value && roca.obligation.value === obPick.value && roca.risk.value === riskPick.value && roca.accountable.options === 1 && roca.accountable.first === "All accountable parties (1)", JSON.stringify(roca.accountable));
  const ctl1 = await readPanel(page);
  check("picking a control shows its ID, layer, and evidence pointer" + at, ctl1.kind === "Control" && /^ID: \S+:\S+/.test(ctl1.id) && /Layer|layer/.test(ctl1.text) && /evidence pointer/i.test(ctl1.text + " " + await page.$eval("#details-chain", (el) => el.textContent)) && ctl1.sections.indexOf("Key metadata") !== -1, JSON.stringify(ctl1).slice(0, 900));

  await pickValue(page, "accountable", (await optionValues(page, "accountable"))[1].value);
  roca = await readRoca(page);
  const acc1 = await readPanel(page);
  check("picking the accountable party highlights its box and shows its record" + at, roca.accountable.pressed.length === 1 && acc1.kind === "Accountable" && /AI Platform Provider/.test(acc1.heading) && /Accountability/.test(acc1.sections.join()), JSON.stringify([roca.accountable.pressed, acc1.kind, acc1.heading]));

  await pickValue(page, "risk", riskOptions.find((o) => o.value !== riskPick.value).value);
  roca = await readRoca(page);
  check("changing the risk resets the Obligation, Control, and Accountable picks" + at, roca.risk.value !== riskPick.value && roca.obligation.value === "" && roca.control.value === "" && roca.accountable.value === "" && roca.obligation.pressed.length === 0 && roca.control.pressed.length === 0, JSON.stringify(ROCA_KEYS.map((k) => roca[k].value)));

  await pickValue(page, "risk", riskPick.value);
  await pickValue(page, "obligation", (await optionValues(page, "obligation"))[1].value);
  await pickValue(page, "control", (await optionValues(page, "control"))[1].value);
  await pickValue(page, "obligation", "");
  roca = await readRoca(page);
  check("choosing All obligations clears the obligation, control, and accountable picks but keeps the risk" + at, roca.risk.value === riskPick.value && roca.obligation.value === "" && roca.control.value === "" && roca.accountable.value === "" && roca.control.options > 0, JSON.stringify(ROCA_KEYS.map((k) => roca[k].value)));
  const ob3 = await readPanel(page);
  check("the details panel falls back to the remaining risk pick after All" + at, ob3.kind === "Risk" && ob3.heading === riskPick.text, JSON.stringify([ob3.kind, ob3.heading]));
  await pickValue(page, "risk", "");
  roca = await readRoca(page);
  check("choosing All risks restores every list and count" + at, ROCA_KEYS.every((k) => roca[k].value === "" && roca[k].options === total[k] && roca[k].first === ROCA_ALL[k] + " (" + total[k] + ")"), JSON.stringify(ROCA_KEYS.map((k) => [roca[k].value, roca[k].options])));
  const statusAll = await page.$eval("#map-status", (el) => el.textContent);
  check("the status line returns to the full counts" + at, statusAll === status, statusAll + " | " + status);

  const lastOb = (await optionValues(page, "obligation")).slice(1).pop();
  await pickValue(page, "obligation", lastOb.value);
  roca = await readRoca(page);
  const lastShown = await page.evaluate((id) => !!document.querySelector('#chain-board button[data-chain-id="' + id + '"]'), lastOb.value);
  check("a pick behind Show N more is revealed and highlighted" + at, lastShown && roca.obligation.pressed.join() === lastOb.value && roca.obligation.more.indexOf("Show fewer") !== -1, JSON.stringify(roca.obligation));
  await pickValue(page, "obligation", "");

  const boxId = await page.evaluate(() => {
    const card = document.querySelector('#chain-board .chain-col[data-column="obligation"] button[data-chain-id]');
    return card.dataset.chainId;
  });
  if (width === 375) await page.evaluate(() => { const t = document.querySelector('.chain-col__toggle[data-column="obligation"]'); if (t.getAttribute("aria-expanded") !== "true") t.click(); });
  await sleep(150);
  await page.click('#chain-board button[data-chain-id="' + boxId.replace(/"/g, '\\"') + '"]');
  await sleep(350);
  roca = await readRoca(page);
  const clicked = await readPanel(page);
  check("clicking a box selects it in its select and shows its details" + at, roca.obligation.value === boxId && roca.obligation.pressed.join() === boxId && clicked.kind === "Obligation", JSON.stringify([roca.obligation.value, clicked.kind]));
  const noToggle = await page.evaluate(() => ({
    classes: document.querySelectorAll("#chain-board [class*='chain-box']").length,
    plus: Array.from(document.querySelectorAll("#chain-board button")).filter((b) => /^[+\u2212-]$/.test(b.textContent.trim()) || /^Links to the next column/.test(b.getAttribute("aria-label") || "")).length,
    lists: document.querySelectorAll("#chain-board .chain-card ul, #chain-board .chain-col__body ul").length
  }));
  check("the chain has no +/- toggles and no inner linked-item lists" + at, noToggle.classes === 0 && noToggle.plus === 0 && noToggle.lists === 0, JSON.stringify(noToggle));
  const dead = await page.evaluate(() => /chain-box/.test(document.documentElement.outerHTML));
  check("no old box markup is left on the page" + at, !dead);
  const lines = await page.$$eval("#chain-svg path.chain-line", (els) => els.length);
  if (width === 1280) check("the chain lines still draw after a pick" + at, lines > 0, String(lines));
  check("no page errors with the selects" + at, page.__errors.length === 0, page.__errors.join("; "));
  await page.close();

  const wide = await openPersonaChain(browser, base, width, height);
  const fit = await wide.evaluate(() => {
    const measure = document.createElement("span");
    measure.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
    document.body.appendChild(measure);
    const broken = [];
    const narrow = [];
    document.querySelectorAll("#chain-board .chain-card").forEach((card) => {
      if (!card.getClientRects().length) return;
      const col = card.closest(".chain-col__body").getBoundingClientRect();
      if (card.getBoundingClientRect().width < col.width - 1) narrow.push(card.dataset.chainId);
      card.querySelectorAll("span").forEach((span) => {
        const cs = getComputedStyle(span);
        measure.style.font = cs.font;
        measure.style.fontWeight = cs.fontWeight;
        span.textContent.split(/\s+/).forEach((word) => {
          if (!word) return;
          measure.textContent = word;
          if (measure.getBoundingClientRect().width > span.getBoundingClientRect().width + 1) broken.push(word);
        });
      });
    });
    measure.remove();
    return { broken: broken.slice(0, 5), narrow: narrow.slice(0, 5) };
  });
  check("boxes take the full column width" + at, fit.narrow.length === 0, JSON.stringify(fit.narrow));
  check("no word is broken mid-word in the visible boxes" + at, fit.broken.length === 0, JSON.stringify(fit.broken));
  await wide.close();
  await testOrganizationalFit(browser, base, width, height);
}

async function testOrganizationalFit(browser, base, width, height) {
  const at = " at " + width;
  const ids = ["ai-system-users", "ai-system-governance", "data-provider", "application-developer", "agentic-platform-provider", "ai-platform-provider", "ai-model-serving", "ai-model-provider"];
  let found = null;
  for (const id of ids) {
    const page = await openPersonaChain(browser, base, width, height, "?type=persona&node=" + id + "&view=list");
    await page.evaluate(() => { const b = document.querySelector('button.chain-more[data-more-column="obligation"]'); if (b && /^Show \d+ more$/.test(b.textContent)) b.click(); });
    await sleep(300);
    if (width === 375) await page.evaluate(() => { const t = document.querySelector('.chain-col__toggle[data-column="obligation"]'); if (t.getAttribute("aria-expanded") !== "true") t.click(); });
    const hit = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#chain-board .chain-col[data-column="obligation"] .chain-card'));
      const card = cards.find((c) => /\b3\.11\.1\b/.test(c.textContent) && /organizational/i.test(c.textContent));
      if (!card) return null;
      const spans = Array.from(card.querySelectorAll("span")).filter((s) => /organizational/i.test(s.textContent));
      const measure = document.createElement("span");
      measure.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
      document.body.appendChild(measure);
      const rows = spans.map((span) => {
        const cs = getComputedStyle(span);
        measure.style.font = cs.font;
        measure.textContent = "organizational";
        return { word: measure.getBoundingClientRect().width, box: span.getBoundingClientRect().width };
      });
      measure.remove();
      return { rows: rows, text: card.textContent.slice(0, 120) };
    });
    await page.close();
    if (hit) { found = { id: id, hit: hit }; break; }
  }
  check("obligation 3.11.1 is in a persona chain and keeps 'organizational' whole" + at, !!found && found.hit.rows.length > 0 && found.hit.rows.every((r) => r.word <= r.box + 1), JSON.stringify(found));
}

async function testLeftColumnTrim(browser, base, width, height) {
  const at = " at " + width;
  const page = await openPersonaChain(browser, base, width, height);
  const left = await page.evaluate(() => {
    const shown = (sel) => { const el = document.querySelector(sel); return !!el && el.getClientRects().length > 0; };
    return {
      risk: shown("#risk-pick"), control: shown("#control-pick"), note: shown("#control-source-note"),
      modes: ["entry-threat", "entry-control", "entry-account"].every((id) => shown("#" + id)),
      search: shown("#node-search"),
      personas: document.querySelectorAll("#persona-list button").length,
      model: document.querySelectorAll('#model-filter-list input[name="operating-model"]').length,
      layers: document.querySelectorAll('#layer-filter-list input[name="layer"]').length,
      tapestry: !!document.getElementById("show-tapestry"),
      graph: shown("#show-graph") || !document.getElementById("show-graph").hidden,
      layersBtn: !!document.getElementById("show-context"),
      legend: shown(".chain-legend-wrap") ,
      note2: document.getElementById("chain-model-note").textContent
    };
  });
  check("the persona chain drops the left Risk and Control drop-downs" + at, !left.risk && !left.control && !left.note, JSON.stringify(left));
  check("the left column keeps the mode buttons, search, persona picker, filters, Tapestry, and the graph and layers buttons" + at, left.modes && left.search && left.personas >= 6 && left.model >= 4 && left.layers >= 5 && left.tapestry && left.layersBtn, JSON.stringify(left));
  check("the line legend and the persona note stay" + at, left.legend && /These are the controls that name this persona as accountable/.test(left.note2), JSON.stringify(left));
  await page.close();

  const riskPage = await openPage(browser, base, width, height, "?risk=directpromptinjection");
  await clickNow(riskPage, "#explore-from-details");
  await sleep(900);
  const riskState = await riskPage.evaluate(() => ({
    selects: document.querySelectorAll("#chain-board select").length,
    wrapDisplay: getComputedStyle(document.getElementById("suggestions-wrap")).display,
    cards: document.querySelectorAll("#chain-board button[data-chain-id]").length,
    detailsInChain: !!document.querySelector("#chain-details-slot > .details")
  }));
  check("the risk chain keeps the left Risk and Control drop-downs and has no column selects" + at, riskState.selects === 0 && riskState.wrapDisplay !== "none" && riskState.cards > 0, JSON.stringify(riskState));
  const firstControl = await riskPage.evaluate(() => {
    const card = document.querySelector('#chain-board .chain-col[data-column="control"] button[data-chain-id]');
    return card ? card.dataset.chainId : "";
  });
  if (width === 375) await riskPage.evaluate(() => { const t = document.querySelector('.chain-col__toggle[data-column="control"]'); if (t.getAttribute("aria-expanded") !== "true") t.click(); });
  await sleep(150);
  await riskPage.click('#chain-board button[data-chain-id="' + firstControl.replace(/"/g, '\\"') + '"]');
  await sleep(300);
  const riskPick = await riskPage.evaluate(() => ({ kind: document.getElementById("details-kind").textContent, pressed: document.querySelectorAll('#chain-board button[aria-pressed="true"]').length, inSlot: !!document.querySelector("#chain-details-slot > .details") }));
  check("clicking a control card in the risk chain still shows its details below the chain" + at, riskPick.kind === "Control" && riskPick.pressed === 1 && riskPick.inSlot, JSON.stringify(riskPick));
  await riskPage.close();

  const controlPage = await openPage(browser, base, width, height, "?type=control&node=finance:SRF-L3-DEV-001&model=iaas&view=list");
  await clickNow(controlPage, "#explore-from-details");
  await sleep(900);
  const controlState = await controlPage.evaluate(() => ({
    selects: document.querySelectorAll("#chain-board select").length,
    cards: document.querySelectorAll("#chain-board button[data-chain-id]").length,
    lines: document.querySelectorAll("#chain-svg path.chain-line").length,
    hasRisks: document.querySelectorAll('#chain-board .chain-col[data-column="risk"] button[data-chain-id]').length
  }));
  check("the control chain keeps its cards and lines and has no column selects" + at, controlState.selects === 0 && controlState.cards > 0 && controlState.hasRisks > 0 && (width === 375 || controlState.lines > 0), JSON.stringify(controlState));
  await controlPage.close();
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
    await testPersonaGraph(browser, base);
    await testColumnLabels(browser, base);
    await testListbox(browser, base);
    await testPhoneSheet(browser, base);
    await testDetailGraphSplit(browser, base);
    await testUrlState(browser, base);
    await testCopyChain(browser, base);
    await testDropdownPickers(browser, base);
    await testPlainDetails(browser, base);
    await testBackButton(browser, base);
    await testPhoneHeaderAndIntro(browser, base);
    await testLoadResilience(browser, base);
    await testDisclosures(browser, base);
    await testRiskWording(browser, base);
    for (const [width, height] of [[1280, 800], [375, 812]]) await testLeftColumnTrim(browser, base, width, height);
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
