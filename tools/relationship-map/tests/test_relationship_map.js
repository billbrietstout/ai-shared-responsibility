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

const SECTOR_LABEL = { finance: "Finance", healthcare: "Healthcare", insurance: "Insurance", "public-sector": "Public sector", defense: "Defense", manufacturing: "Manufacturing" };
const controls = [];
CONTROL_FILES.forEach((slug) => {
  const file = readData(slug + "-controls.json");
  if (file.provenance === "proposed-extension") return;
  file.controls.forEach((control) => {
    if (control.provenance === "proposed-extension") return;
    const core = [];
    const sectorNamed = (control.operating_models || []).some((model) => !!sectorMap[model]);
    (control.operating_models || []).forEach((model) => {
      const srf = MODELS.indexOf(model) !== -1 ? model : sectorMap[model];
      if (srf && core.indexOf(srf) === -1) core.push(srf);
    });
    controls.push({ nodeId: "control:" + slug + ":" + control.id, id: control.id, layer: control.layer, core: core, name: control.title, description: control.description || "", persona: control.accountable_persona || "", sector: sectorNamed ? SECTOR_LABEL[slug] : "" });
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
  if (process.env.RELMAP_NAV) page.on("framenavigated", (f) => console.log("NAV", f.url()));
  await page.goto(base + "/tools/relationship-map/index.html" + (query || ""), { waitUntil: "load" });
  await page.waitForSelector('#map-status[data-ready="true"]', { timeout: 60000 });
  page.__errors = errors;
  return page;
}

const idsIn = (page, selector) => page.$$eval(selector, (els) => els.map((el) => el.dataset.nodeId || el.dataset.chainId));

const openOptionsPanel = (page) => page.evaluate(() => { const o = document.getElementById("options"); if (o) o.open = true; });

async function pickModel(page, model) {
  await openOptionsPanel(page);
  await page.click('input[name="operating-model"][value="' + model + '"]');
  await sleep(150);
}
async function pickLayer(page, layer) {
  await openOptionsPanel(page);
  await page.click('input[name="layer"][value="' + layer + '"]');
  await sleep(150);
}
async function clickNow(page, selector) {
  await page.$eval(selector, (el) => { const o = el.closest("details#options"); if (o) o.open = true; });
  await page.$eval(selector, (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.click(selector);
}
async function openEntry(page, entry) {
  await clickNow(page, "#entry-" + entry);
  await sleep(300);
}
async function search(page, text) {
  await openOptionsPanel(page);
  await page.$eval("#node-search", (el) => { el.value = ""; window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: "instant" }); });
  await sleep(60);
  await page.focus("#node-search");
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
  const everyShown = await idsIn(page, "#chain-select-control option[data-node-id]");
  const dAll = diff(everyShown, inChainCore.map((c) => c.nodeId));
  check("All models and All layers lists every control that sits in an operating model (" + inChainCore.length + ")", everyShown.length === inChainCore.length && dAll.missing.length === 0 && dAll.extra.length === 0, JSON.stringify(dAll));
  check("the chain note says the controls come from the sector catalogs", await page.$eval("#chain-model-note", (el) => /sector catalogs/.test(el.textContent) && /CoSAI Risk Map controls\.yaml/.test(el.textContent) && el.getClientRects().length > 0));

  for (const model of MODELS) {
    await pickModel(page, model);
    await openEntry(page, "control");
    const expected = inChainCore.filter((c) => c.core.indexOf(model) !== -1).map((c) => c.nodeId);
    const shown = await idsIn(page, "#chain-select-control option[data-node-id]");
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
  const shownL3 = await idsIn(page, "#chain-select-control option[data-node-id]");
  const d1 = diff(shownL3, expectedL3);
  check("L3 with All models lists every L3 control that sits in an operating model (" + expectedL3.length + ")", shownL3.length === expectedL3.length && d1.missing.length === 0 && d1.extra.length === 0, JSON.stringify(d1));

  await openEntry(page, "threat");
  const expectedRisks = threats.filter((t) => t.srf_layer === "L3").map((t) => "risk:" + t.id);
  const shownRisks = await idsIn(page, "#chain-select-risk option[data-node-id]");
  const d2 = diff(shownRisks, expectedRisks);
  check("L3 limits the threat list to threats at L3 (" + expectedRisks.length + ")", shownRisks.length === expectedRisks.length && d2.missing.length === 0 && d2.extra.length === 0, JSON.stringify(d2));

  await pickModel(page, "AI-PaaS");
  await openEntry(page, "control");
  const expectedPaaS = inChainCore.filter((c) => c.layer === "L3" && c.core.indexOf("AI-PaaS") !== -1).map((c) => c.nodeId);
  const shownPaaS = await idsIn(page, "#chain-select-control option[data-node-id]");
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
  await chainPage.evaluate(() => { const b = document.querySelector('button.chain-more[data-more-column="control"]'); if (b && /^Show \d+ more$/.test(b.textContent)) b.click(); });
  await sleep(300);
  const chainControls = await chainPage.$$eval('#chain-board .chain-col[data-column="control"] button[data-chain-id]', (els) => els.map((el) => el.dataset.chainId));
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
    await page.$eval('#search-results [role=option][data-node-id="risk:' + threat.id + '"]', (el) => el.click());
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
  check("search label names the four kinds", label === "Find a risk, obligation, control, or persona", label);
  const placeholder = await page.$eval("#node-search", (el) => el.placeholder);
  check("search placeholder asks for a name or a few words", placeholder === "Name or a few words", placeholder);
  const help = await page.$eval("#map-help", (el) => el.textContent);
  check("search help text names the four kinds", /Type a name or a few words about a risk, an obligation, a control, or a persona/.test(help), help);
  await openEntry(page, "threat");
  const heading = await page.$eval("#chain-col-risk", (el) => el.textContent.trim());
  check("the Risk column heading reads Risk", /^whyRisk \(\d+\)$/.test(heading), heading);
  const note = await page.$eval("#chain-model-note", (el) => el.textContent);
  check("the chain note does not mention the control source on Explore a risk", note.indexOf("sector catalogs") === -1, note);
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
    const targets = Array.from(document.querySelectorAll("a[data-jump], a.skip-link, .map-jump a")).map((a) => a.getAttribute("href"));
    return {
      searchBottom: document.getElementById("node-search").getBoundingClientRect().bottom,
      searchBeforeDomains: order("#find-form", ".layer-frames"),
      skipped: skipped,
      targets: targets.filter((href) => href && href[0] === "#").map((href) => ({ href: href, exists: !!document.getElementById(href.slice(1)) })),
      skipLinks: document.querySelectorAll("a.skip-link").length
    };
  });
  check("the search field is in the first screen at 1280x800", initial.searchBottom <= 800, String(initial.searchBottom));
  check("the search form comes before the Security domains block", initial.searchBeforeDomains);
  check("visible headings never skip a level", initial.skipped === 0, String(initial.skipped));
  check("there is a skip link to the content and one to search", initial.skipLinks >= 2, String(initial.skipLinks));
  check("every in-page link on the first view has a target", initial.targets.length >= 4 && initial.targets.every((t) => t.exists), JSON.stringify(initial.targets.filter((t) => !t.exists)));

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
  check("the search note counts each kind with matches", /^\d+ records match: (\d+ (risks?|obligations?|controls?|personas?)(, | and )?)+\./.test(counts.note), counts.note);
  const kindCounts = ["risk", "obligation", "control", "persona"].map((k) => Number((new RegExp("(\\d+) " + k + "s?(?:[,. ]|$)").exec(counts.note) || [])[1] || 0));
  check("each group shows up to eight matches and the rest are behind a Show all button", counts.shown === kindCounts.reduce((sum, n) => sum + Math.min(n, 8), 0) && counts.showAll && counts.showAllText === "Show all " + total + " matches", JSON.stringify(counts));
  await page.click("#show-all-results");
  await sleep(150);
  const all = await page.evaluate(() => ({ shown: document.querySelectorAll("#search-results [role=option]").length, hidden: document.getElementById("show-all-results").hidden, activeInList: !!document.getElementById(document.activeElement.getAttribute("aria-activedescendant") || "none") }));
  check("Show all lists every match and highlights the first new one", all.shown === total && all.hidden && all.activeInList, JSON.stringify(all));

  await page.click('#search-results [role=option][data-node-id="risk:directpromptinjection"]');
  await sleep(900);
  const opened = await page.evaluate(() => ({
    active: document.activeElement.id,
    text: document.getElementById("details-heading").textContent,
    workspaceHidden: document.getElementById("chain-workspace").hidden,
    chainHidden: document.getElementById("chain").hidden,
    inSlot: !!document.querySelector("#chain-details-slot > .details")
  }));
  check("choosing a risk moves focus to the chain heading", opened.active === "chain-heading" && opened.text === "Direct prompt injection", JSON.stringify(opened));
  check("choosing a risk opens the ROCA chain with the details panel inside it", !opened.workspaceHidden && !opened.chainHidden && opened.inSlot, JSON.stringify(opened));
  check("the chain heading is in the first half of the window after choosing", await inView(page, "#chain-heading"));
  const explored = await page.evaluate(() => ({
    workspaceHidden: document.getElementById("chain-workspace").hidden,
    chainHidden: document.getElementById("chain").hidden,
    heading: document.getElementById("chain-heading").textContent,
    jumpChainShown: !document.getElementById("jump-chain").hidden,
    active: document.activeElement.id
  }));
  check("choosing a risk shows the chain workspace", !explored.workspaceHidden && !explored.chainHidden && /^Chain for Direct prompt injection/.test(explored.heading), JSON.stringify(explored));
  check("the Chain jump link appears with a chain", explored.jumpChainShown);

  check("the chain has no column jump links", (await page.$$(".chain-jump")).length === 0);

  await search(page, "direct prompt injection");
  await page.click('#search-results [role=option][data-node-id="risk:directpromptinjection"]');
  await sleep(900);
  await clickNow(page, "#clear-chain-selection");
  await sleep(500);
  const cleared1 = await page.evaluate(() => ({ chainHidden: document.getElementById("chain").hidden, root: document.getElementById("chain-select-risk").value }));
  check("the first Clear selection empties the risk menu and keeps the chain open", !cleared1.chainHidden && cleared1.root === "", JSON.stringify(cleared1));
  await clickNow(page, "#clear-chain-selection");
  await sleep(900);
  const cleared = await page.evaluate(() => ({ active: document.activeElement.id, chainHidden: document.getElementById("chain").hidden, workspaceHidden: document.getElementById("chain-workspace").hidden }));
  check("the second Clear selection returns focus to the search field", cleared.active === "node-search" && cleared.chainHidden && cleared.workspaceHidden, JSON.stringify(cleared));

  await page.$eval("#entry-account", (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.click("#entry-account");
  await sleep(900);
  await page.select("#chain-select-accountable", (await optionValues(page, "accountable"))[1].value);
  await sleep(900);
  const persona = await page.evaluate(() => ({ active: document.activeElement.id, text: document.getElementById("chain-heading").textContent, workspaceHidden: document.getElementById("chain-workspace").hidden }));
  check("choosing a persona in the Accountable menu opens its chain and keeps focus on the menu", persona.active === "chain-select-accountable" && /^Chain for /.test(persona.text) && !persona.workspaceHidden, JSON.stringify(persona));
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
  await clickNow(phone, '.chain-col__toggle[data-column="obligation"]');
  await sleep(300);
  const obligationOpen = await phone.evaluate(() => Array.from(document.querySelectorAll('.chain-col__toggle[aria-expanded="true"]')).map((b) => b.dataset.column));
  check("the Obligation column header opens that column at 375 wide", obligationOpen.join() === "obligation", obligationOpen.join());
  await clickNow(phone, "#clear-chain-selection");
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
async function testListView(browser, base) {
  console.log("\n## List view: catalog first, filters above the results, summary line, side panel");
  const page = await openPage(browser, base, 1280, 800, "");
  const first = await page.evaluate(() => {
    const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
    const order = (a, b) => !!(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
    return {
      selects: document.querySelectorAll("#risk-pick, #control-pick, #risk-suggestions, #suggestions").length,
      summary: document.getElementById("filter-summary").textContent,
      filtersBeforeResults: order("#map-filters", "#search-results"),
      summaryBeforeResults: order("#filter-summary", "#search-results"),
      chainHidden: document.getElementById("chain").hidden,
      emptyShown: !document.getElementById("details-empty").hidden,
      panelTop: rect(".map-panel").top, stageBottom: rect(".map-stage").bottom, panelWidth: rect(".map-panel").width, stageWidth: rect(".map-stage").width,
      wrapHeight: Math.round(document.querySelector(".chain-wrap").getBoundingClientRect().height)
    };
  });
  check("Options has no Risk or Control drop-down", first.selects === 0, String(first.selects));
  check("the summary line gives the filters and both counts", first.summary === "All operating models, all layers: " + inChainCore.length + " controls, " + threats.length + " risks", first.summary);
  check("the filters and the summary come before the results", first.filtersBeforeResults && first.summaryBeforeResults);
  check("the details panel sits below Options at the full page width and starts empty", first.chainHidden && first.emptyShown && first.panelTop >= first.stageBottom - 1 && Math.abs(first.panelWidth - first.stageWidth) <= 1 && first.panelWidth > 1000, JSON.stringify(first));
  check("no blank chain panel on load", first.wrapHeight < 120, String(first.wrapHeight));

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
  await page.select("#chain-select-risk", "risk:directpromptinjection");
  await sleep(600);
  const open = await page.evaluate(() => {
    const panel = document.querySelector("#chain-details-slot > .details").getBoundingClientRect();
    const list = document.getElementById("chain-select-risk").getBoundingClientRect();
    return {
      detailsShown: !document.getElementById("details-body").hidden,
      workspaceShown: !document.getElementById("chain-workspace").hidden,
      selectAbovePanel: list.height > 0 && (list.right <= panel.left + 1 || list.bottom <= panel.top + 1),
      heading: document.getElementById("details-heading").textContent
    };
  });
  check("choosing a risk in the chain opens its details beside the columns", open.detailsShown && open.workspaceShown && open.selectAbovePanel && open.heading === "Direct prompt injection", JSON.stringify(open));
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

async function testGraphRemoved(browser, base) {
  console.log("\n## The relationship graph is gone");
  const page = await openPage(browser, base, 1280, 800, "");
  const gone = await page.evaluate(() => {
    const ids = ["graph", "show-graph", "hide-graph", "widen-view", "show-chain", "explore-from-details", "graph-workspace", "graph-empty", "graph-fit", "graph-zoom-in", "graph-zoom-out", "graph-reset", "map-gesture", "jump-graph", "clear-graph-selection", "risk-pick", "control-pick", "risk-suggestions", "suggestions", "suggestions-wrap", "control-source-note"];
    return {
      ids: ids.filter((id) => document.getElementById(id)),
      classes: document.querySelectorAll(".graph-wrap, .graph-kind-legend, .graph, canvas").length,
      sigmaScript: Array.from(document.scripts).some((s) => /sigma/i.test(s.src)),
      sigmaGlobal: typeof window.Sigma !== "undefined",
      text: document.body.innerText.match(/relationship graph|widen the view|show the chain|zoom the graph|\bgraph\b/gi) || []
    };
  });
  check("no graph element, button, skip link, or legend is in the page", gone.ids.length === 0 && gone.classes === 0, JSON.stringify(gone));
  check("the Sigma script is not loaded", !gone.sigmaScript && !gone.sigmaGlobal);
  check("no visible text mentions the relationship graph", gone.text.length === 0, JSON.stringify(gone.text));
  check("the Options section has no Risk or Control drop-down", await page.evaluate(() => document.querySelectorAll("#options select").length === 0));
  await page.close();

  for (const query of ["?risk=directpromptinjection&view=graph", "?risk=directpromptinjection&graph=1", "?risk=directpromptinjection&view=full&graph=1&neighbors=1"]) {
    const legacy = await openPage(browser, base, 1280, 800, query);
    const state = await legacy.evaluate(() => ({ chainShown: !document.getElementById("chain").hidden, root: document.getElementById("map-status").dataset.root, selects: document.querySelectorAll("#chain-board select").length }));
    check("the old link " + query + " lands on the ROCA chain", state.chainShown && state.root === "risk:directpromptinjection" && state.selects === 4, JSON.stringify(state));
    check("the old link " + query + " throws no page error", legacy.__errors.length === 0, legacy.__errors.join("; "));
    await legacy.close();
  }
  const bare = await openPage(browser, base, 1280, 800, "?graph=1");
  check("a bare graph=1 link opens the list, not a graph", await bare.evaluate(() => document.getElementById("chain-workspace").hidden && !document.getElementById("graph")));
  await bare.close();
}

const MODE_SETUP = {
  threat: { entry: "threat", key: "risk", pick: "risk:directpromptinjection", record: "Risk" },
  obligation: { entry: "obligation", key: "obligation", pick: "", record: "Obligation" },
  control: { entry: "control", key: "control", pick: "control:finance:SRF-L3-DEV-001", record: "Control" },
  account: { entry: "account", key: "accountable", pick: "", record: "Accountable" }
};

async function modePick(page, setup) {
  if (setup.pick) return setup.pick;
  if (setup.key === "obligation") return (await optionValues(page, "obligation"))[3].value;
  return (await optionValues(page, "accountable")).filter((o) => /model provider/i.test(o.text))[0].value;
}

async function startMode(browser, base, width, height, mode) {
  const page = await openPage(browser, base, width, height, "");
  if (mode === "account") {
    await clickNow(page, "#entry-account");
    await sleep(500);
  } else {
    await openEntry(page, mode);
  }
  return page;
}

async function testModeParity(browser, base, width, height) {
  const at = " at " + width;
  console.log("\n## Explore a risk, a control, and accountability share one ROCA chain" + at);
  const signatures = {};
  const helps = {};
  const startCounts = {};
  for (const mode of ["threat", "obligation", "control", "account"]) {
    const setup = MODE_SETUP[mode];
    const page = await startMode(browser, base, width, height, mode);
    const start = await page.evaluate(() => ({
      workspace: !document.getElementById("chain-workspace").hidden,
      chain: !document.getElementById("chain").hidden,
      heading: document.getElementById("chain-workspace-heading").textContent,
      selects: Array.from(document.querySelectorAll("#chain-board select")).map((s) => ({ id: s.id, disabled: s.disabled, options: s.options.length - 1, root: s.dataset.root === "true" })),
      inOptions: document.querySelectorAll("#options select").length,
      cards: document.querySelectorAll("#chain-board button[data-chain-id]").length,
      help: document.getElementById("map-help").textContent,
      slot: !!document.querySelector("#chain-details-slot > .details"),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    }));
    check(mode + " mode starts on the ROCA chain" + at, start.workspace && start.chain && start.heading === "ROCA chain", JSON.stringify(start));
    check(mode + " mode shows all four column selects and none in Options" + at, start.selects.map((s) => s.id).join() === "chain-select-risk,chain-select-obligation,chain-select-control,chain-select-accountable" && start.inOptions === 0, JSON.stringify(start.selects));
    check(mode + " mode starts with all four selects enabled and full" + at, start.selects.every((s) => !s.disabled && s.options > 5), JSON.stringify(start.selects));
    check(mode + " mode starts with no boxes until something is picked" + at, start.cards === 0, String(start.cards));
    check("no sideways scroll when " + mode + " mode opens" + at, start.overflow <= 1, String(start.overflow));
    startCounts[mode] = start.selects.map((s) => s.id.replace("chain-select-", "") + ":" + s.options).join(" ");
    helps[mode] = start.help;

    const pick = await modePick(page, setup);
    await pickValue(page, setup.key, pick);
    const after = await page.evaluate(() => {
      const cols = Array.from(document.querySelectorAll("#chain-board .chain-col")).map((c) => c.dataset.column);
      return {
        cols: cols,
        selects: Array.from(document.querySelectorAll("#chain-board select")).map((s) => ({ id: s.id, disabled: s.disabled, options: s.options.length - 1, value: s.value })),
        status: document.getElementById("map-status").textContent,
        details: document.getElementById("details-kind").textContent,
        slot: !!document.querySelector("#chain-details-slot > .details"),
        lines: document.querySelectorAll("#chain-svg path.chain-line").length,
        overflow: document.documentElement.scrollWidth - window.innerWidth
      };
    });
    signatures[mode] = after.cols.join();
    check(mode + " mode keeps the same four columns after a pick" + at, after.cols.join() === "risk,obligation,control,accountable", after.cols.join());
    check(mode + " mode: a " + setup.key + " pick leaves every select at its start count and shows the pick only in its own column" + at, after.selects.map((x) => x.id.replace("chain-select-", "") + ":" + x.options).join(" ") === startCounts[mode] && after.selects.filter((x) => x.value).length === 1 && after.selects.every((x) => !x.disabled), JSON.stringify(after.selects));
    check(mode + " mode shows the picked record in the details panel inside the chain" + at, after.details === setup.record && after.slot, JSON.stringify([after.details, after.slot]));
    check(mode + " mode status line counts all four columns" + at, /^Showing \d+ risks?, \d+ obligations?, \d+ controls?, and \d+ accountable personas?/.test(after.status) && !/ 0 (risks?|obligations?|controls?), /.test(after.status), after.status);
    if (width === 1280) check(mode + " mode draws connector lines" + at, after.lines > 0, String(after.lines));
    check("no sideways scroll after a pick in " + mode + " mode" + at, after.overflow <= 1, String(after.overflow));
    const sizes = () => page.evaluate(() => Array.from(document.querySelectorAll("#chain-board select")).map((sel) => sel.options.length + ":" + sel.options[0].textContent));
    const sizeBefore = await sizes();
    for (const key of ["risk", "obligation", "control", "accountable"]) {
      const opts = (await optionValues(page, key)).filter((o) => o.value);
      if (opts.length < 2) continue;
      await pickValue(page, key, opts[1].value);
      const now = await page.evaluate(() => Array.from(document.querySelectorAll("#chain-board select")).map((sel) => ({ id: sel.id, value: sel.value, disabled: sel.disabled })));
      const boxCount = await page.$$eval('#chain-board .chain-col[data-column="' + key + '"] button[data-chain-id]', (els) => els.length);
      check(mode + " mode: a " + key + " pick leaves every menu length and count unchanged" + at, (await sizes()).join("|") === sizeBefore.join("|"), (await sizes()).join("|") + " vs " + sizeBefore.join("|"));
      check(mode + " mode: a " + key + " pick becomes the only pick and shows one box in its column" + at, now.filter((x) => x.value).map((x) => x.id).join() === "chain-select-" + key && now.every((x) => !x.disabled) && boxCount === 1, JSON.stringify(now) + " " + boxCount);
    }
    check("no page errors in " + mode + " mode" + at, page.__errors.length === 0, page.__errors.join("; "));
    await page.close();
  }
  check("all four modes show the same help line" + at, helps.threat === helps.control && helps.control === helps.account && helps.account === helps.obligation && /^Four columns: Risk, Obligation, Control, and Accountable\./.test(helps.threat), JSON.stringify(helps));
  check("all four modes list the columns in the same order" + at, signatures.threat === signatures.control && signatures.control === signatures.account && signatures.account === signatures.obligation);
  check("all four modes start with identical select counts" + at, startCounts.threat === startCounts.control && startCounts.control === startCounts.account && startCounts.account === startCounts.obligation, JSON.stringify(startCounts));
  console.log("  select option counts at start" + at + ": " + startCounts.threat);

  const lastChance = await openPage(browser, base, width, height, "");
  await clickNow(lastChance, "#show-context");
  await sleep(300);
  check("Show layers still opens the layers view" + at, await lastChance.evaluate(() => !document.getElementById("context-board").hidden && document.getElementById("chain-workspace-heading").textContent === "Layers"));
  await lastChance.close();

  const page = await openPage(browser, base, width, height, PERSONA_CHAIN_QUERY);
  const chain = await page.evaluate(() => {
    const cols = {};
    document.querySelectorAll("#chain-board .chain-col").forEach((col) => {
      cols[col.dataset.column] = { heading: col.querySelector("h3").textContent.trim(), cards: col.querySelectorAll("button[data-chain-id]").length, more: Array.from(col.querySelectorAll("button.chain-more")).map((b) => b.textContent) };
    });
    return {
      cols: cols,
      accountableText: document.querySelector('#chain-board .chain-col[data-column="accountable"]').textContent,
      status: document.getElementById("map-status").textContent,
      note: document.getElementById("chain-model-note").textContent,
      legend: document.querySelector(".chain-legend-wrap").checkVisibility(),
      columnLinks: document.querySelectorAll(".chain-jump").length,
      oldRows: document.querySelectorAll("#chain-board li.control-row, #chain-board .control-rows, #chain-board .chain-box").length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
  const names = ["risk", "obligation", "control", "accountable"];
  const counts = /Showing (\d+) risks?, (\d+) obligations?, (\d+) controls?, and (\d+) accountable personas?/.exec(chain.status);
  check("a persona link opens the chain with four columns, counts, and no single list" + at, names.every((n) => chain.cols[n] && /\(\d+\)$/.test(chain.cols[n].heading)) && chain.oldRows === 0, JSON.stringify(chain.cols));
  check("the persona is in the Accountable column" + at, /AI Platform Provider/.test(chain.accountableText) && chain.cols.accountable.cards === 1);
  check("the persona status line counts every column above zero" + at, !!counts && counts.slice(1).every((n) => +n > 0), chain.status);
  check("persona chains show the persona line" + at, chain.note === "These are the controls that name this persona as accountable, with their risks and obligations.", chain.note);
  if (width === 1280) check("the chain shows the line legend and no column jump links" + at, chain.legend && chain.columnLinks === 0, JSON.stringify([chain.legend, chain.columnLinks]));
  check("long columns are collapsed with a Show more control" + at, chain.cols.control.cards <= 8 && chain.cols.control.more.some((t) => /^Show \d+ more$/.test(t)), JSON.stringify(chain.cols.control));
  await page.evaluate(() => { const b = document.querySelector('button.chain-more[data-more-column="control"]'); if (b && /^Show \d+ more$/.test(b.textContent)) b.click(); });
  await sleep(300);
  const open = await page.evaluate(() => ({ cards: document.querySelectorAll('#chain-board .chain-col[data-column="control"] button[data-chain-id]').length, more: Array.from(document.querySelectorAll('#chain-board .chain-col[data-column="control"] button.chain-more')).map((b) => b.textContent) }));
  check("Show more reveals every control and Show fewer is offered" + at, open.cards === +counts[3] && open.more.indexOf("Show fewer") !== -1, JSON.stringify(open));
  check("no sideways scroll in the persona chain" + at, !chain.overflow);
  await page.close();

  await testRocaSelects(browser, base, width, height);

  if (width === 1280) {
    const bare = await openNoControlsFixture(browser, base, 1280, 800);
    const gapText = await bare.evaluate(() => document.getElementById("chain-board").textContent);
    check("fixture: a persona with no controls says so in the chain", /No control names this persona yet\./.test(gapText), gapText.slice(0, 300));
    await bare.close();

    const riskPage = await openPage(browser, base, 1280, 800, "?risk=directpromptinjection");
    const riskChain = await riskPage.evaluate(() => ({
      note: document.getElementById("chain-model-note").textContent,
      heading: document.getElementById("chain-workspace-heading").textContent,
      legend: document.querySelector(".chain-legend-wrap").checkVisibility(),
      columnLinks: document.querySelectorAll(".chain-jump").length,
      label: document.getElementById("chain-board").getAttribute("aria-label")
    }));
    check("a risk chain shows the generic model note and the ROCA chain heading", riskChain.note.indexOf("All shows one accountable persona for each operating model") !== -1 && riskChain.heading === "ROCA chain", JSON.stringify(riskChain));
    check("a risk chain keeps the line-type legend and its board label and has no column jump links", riskChain.legend && riskChain.columnLinks === 0 && riskChain.label === "Risk, obligation, control, and accountable", JSON.stringify(riskChain));
    await riskPage.close();
  }
}

async function testNoNarrowingCode(browser, base) {
  console.log("\n## No list narrowing code");
  const source = fs.readFileSync(path.join(ROOT, "tools/relationship-map/app.js"), "utf8");
  check("app.js has no narrowing flag, linked-column filter, pick state, or control link map", !/NARROW_COLUMNS|narrowedColumns|dropStalePicks|linkedColumns|linkedChain|chainPicks|controlLinks|resetPicks/.test(source));
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
  const picked = await page.evaluate(() => ({ heading: document.getElementById("details-heading").textContent, bodyHidden: document.getElementById("details-body").hidden, workspaceHidden: document.getElementById("chain-workspace").hidden }));
  check("Enter opens the highlighted option in the chain, not the first match", !picked.bodyHidden && picked.heading === wanted && !picked.workspaceHidden && h.index === 2, JSON.stringify({ picked, wanted, h }));

  await clickNow(page, "#clear-chain-selection");
  await sleep(300);
  await clickNow(page, "#clear-chain-selection");
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
      const heads = await readHeads(page);
      const status = await page.$eval("#map-status", (el) => el.textContent);
      const counts = /Showing (\d+) risks?, (\d+) obligations?, (\d+) controls?, and (\d+) accountable personas?/.exec(status);
      const at = kind + " chain at " + width;
      check(at + " renders the four columns in order", heads.map((h) => h.key).join() === ORDER.join(), JSON.stringify(heads.map((h) => h.key)));
      check(at + " puts the label inside each heading", heads.every((h) => h.label === WORD[h.key].toLowerCase() && h.labelInHeading), JSON.stringify(heads.map((h) => [h.key, h.label, h.labelInHeading])));
      const nameRe = (key) => new RegExp("^" + WORD[key] + ": " + NAME[key] + " \\(\\d+\\)$");
      check(at + " gives each heading one accessible name with the label and count", heads.every((h) => nameRe(h.key).test(h.headingName)), JSON.stringify(heads.map((h) => h.headingName)));
      const optionCounts = await page.$$eval("#chain-board select", (els) => els.map((el) => el.options.length - 1));
      check(at + " keeps each heading count equal to its select's option count", ORDER.every((k, n) => new RegExp("\\(" + optionCounts[n] + "\\)$").test(heads.find((h) => h.key === k).headingName)), JSON.stringify(heads.map((h) => h.headingName)) + " | " + optionCounts.join());
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
  const desk = await openPage(browser, base, 1280, 800, "?risk=directpromptinjection");
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
  check("the list behind the sheet is inert and focus is on the chain heading", sheet.stageInert && (await activeId(page)) === "chain-heading");

  const cols = await page.evaluate(() => Array.from(document.querySelectorAll(".chain-col__toggle")).map((b) => ({ text: b.textContent, expanded: b.getAttribute("aria-expanded"), key: b.dataset.column, bodyHidden: document.getElementById(b.getAttribute("aria-controls")).hidden })));
  check("the four columns are sections with counts", cols.length === 4 && cols.map((c) => c.key).join() === "risk,obligation,control,accountable" && cols.every((c) => /\(\d+\)$/.test(c.text)), JSON.stringify(cols));
  check("only Risk is open at first", cols.filter((c) => c.expanded === "true").map((c) => c.key).join() === "risk" && cols.every((c) => c.bodyHidden === (c.expanded !== "true")), JSON.stringify(cols));
  await page.click('.chain-col__toggle[data-column="obligation"]');
  const second = await page.evaluate(() => Array.from(document.querySelectorAll(".chain-col__toggle")).filter((b) => b.getAttribute("aria-expanded") === "true").map((b) => b.dataset.column));
  check("opening Obligation closes Risk, so one section is open at a time", second.join() === "obligation", JSON.stringify(second));
  await page.click('.chain-col__toggle[data-column="obligation"]');
  const none = await page.evaluate(() => document.querySelectorAll('.chain-col__toggle[aria-expanded="true"]').length);
  check("choosing the open section collapses it", none === 0);
  await page.click('.chain-col__toggle[data-column="control"]');
  await sleep(200);
  check("the section toggle keeps focus after it opens", await page.evaluate(() => document.activeElement.classList.contains("chain-col__toggle")));
  await page.keyboard.press("Tab");
  check("the open section's menu is next in the tab order", await page.evaluate(() => document.activeElement.tagName === "SELECT"));
  await page.keyboard.press("Tab");
  check("the open section's card follows its menu", await page.evaluate(() => document.activeElement.classList.contains("chain-card")));

  await page.keyboard.press("Escape");
  await sleep(400);
  await sleep(100);
  const afterEsc = await sheetState(page);
  check("Escape closes the sheet and returns focus to the search field", !afterEsc.shown && !afterEsc.stageInert && (await activeId(page)) === "node-search", JSON.stringify(afterEsc) + (await activeId(page)));

  await search(page, "direct prompt injection");
  await page.click('#search-results [role=option][data-node-id="risk:directpromptinjection"]');
  await sleep(600);
  await clickNow(page, "#clear-chain-selection");
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

async function testDeepLinkRefresh(browser, base) {
  console.log("\n## Deep link: insurance control chain, page scroll, refresh");
  const page = await openPage(browser, base, 1280, 900, "?control=insurance:SRF-L3-DEV-001");
  const first = await page.evaluate(() => {
    const details = document.querySelector(".details");
    const style = getComputedStyle(details);
    return {
      heading: document.getElementById("details-heading").textContent,
      id: document.getElementById("details-id").textContent,
      bodyHidden: document.getElementById("details-body").hidden,
      workspaceHidden: document.getElementById("chain-workspace").hidden,
      inSlot: !!details.closest("#chain-details-slot"),
      overflow: style.overflow,
      maxHeight: style.maxHeight,
      root: document.getElementById("map-status").dataset.root
    };
  });
  check("insurance deep link selects the control in details", first.root === "control:insurance:SRF-L3-DEV-001" && /Prompt Injection Defense/.test(first.heading) && first.id === "ID: insurance:SRF-L3-DEV-001" && !first.bodyHidden, JSON.stringify(first));
  check("the deep link opens the chain workspace with the details inside it", !first.workspaceHidden && first.inSlot, JSON.stringify(first));
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
  check("no page errors on the deep link", page.__errors.length === 0, page.__errors.join("; "));
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
    workspaceHidden: document.getElementById("chain-workspace").hidden,
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
  await bare.select("#chain-select-risk", "risk:directpromptinjection");
  await sleep(500);
  const afterSelect = await bare.evaluate(() => ({ search: location.search, length: history.length }));
  const params = new URLSearchParams(afterSelect.search);
  check("selecting a risk writes type, node, model slug, and list view", params.get("type") === "risk" && params.get("node") === "directpromptinjection" && params.get("model") === "ai-paas" && params.get("view") === "list" && !/graph/.test(afterSelect.search), afterSelect.search);
  check("opening a trace adds exactly one history entry; model and entry changes add none", afterSelect.length === before + 1, before + " -> " + afterSelect.length);

  const sharedUrl = bare.url();
  await bare.close();

  const restored = await openPage(browser, base, 1280, 900, sharedUrl.slice(sharedUrl.indexOf("?")));
  const back = await restored.evaluate(() => ({
    selected: document.getElementById("map-status").dataset.selected,
    model: document.querySelector('input[name="operating-model"]:checked').value,
    workspaceShown: !document.getElementById("chain-workspace").hidden,
    heading: document.getElementById("details-heading").textContent
  }));
  check("loading the shared URL restores the item, the model, and the chain", back.selected === "risk:directpromptinjection" && back.model === "AI-PaaS" && back.workspaceShown, JSON.stringify(back));
  await restored.close();

  const listLoad = await openPage(browser, base, 1280, 900, "?type=control&node=finance:SRF-L3-DEV-001&model=iaas&view=list");
  const control = await listLoad.evaluate(() => ({
    selected: document.getElementById("map-status").dataset.selected,
    model: document.querySelector('input[name="operating-model"]:checked').value,
    workspaceShown: !document.getElementById("chain-workspace").hidden,
    search: location.search
  }));
  check("a control link restores a control and opens its chain", control.selected === "control:finance:SRF-L3-DEV-001" && control.model === "IaaS" && control.workspaceShown, JSON.stringify(control));
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
  check("older risk=, model=, and graph=1 links still load and are rewritten without the graph parameter", legacyState.model === "AI-PaaS" && legacyState.root === "risk:directpromptinjection" && /model=ai-paas/.test(legacyState.search) && /type=risk/.test(legacyState.search) && !/graph/.test(legacyState.search), JSON.stringify(legacyState));
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

async function testRootSelects(browser, base) {
  console.log("\n## Chain menus are drop-down lists in every mode");
  const page = await openPage(browser, base, 1280, 900, "");
  for (const [mode, key, minOptions] of [["threat", "risk", 20], ["control", "control", 50], ["account", "accountable", 6]]) {
    await clickNow(page, "#entry-" + mode);
    await sleep(300);
    const info = await page.evaluate((k) => {
      const sel = document.getElementById("chain-select-" + k);
      return {
        tag: sel.tagName,
        options: sel.querySelectorAll("option[value]:not([value=''])").length,
        groups: sel.querySelectorAll("optgroup").length,
        label: sel.getAttribute("aria-labelledby") && document.getElementById(sel.getAttribute("aria-labelledby")).textContent,
        all: document.querySelectorAll("#chain-board select").length
      };
    }, key);
    check(mode + " mode: the " + key + " menu is a labeled select and the chain has four", info.tag === "SELECT" && !!info.label && info.all === 4, JSON.stringify(info));
    check(mode + " mode: the " + key + " menu lists every choice", info.options >= minOptions, JSON.stringify(info));
    if (key !== "accountable") check(mode + " mode: the " + key + " menu groups choices by layer", info.groups >= 2, JSON.stringify(info));
  }
  await clickNow(page, "#entry-threat");
  await sleep(300);
  await page.focus("#chain-select-risk");
  await page.select("#chain-select-risk", "risk:directpromptinjection");
  await sleep(200);
  const after = await page.evaluate(() => ({ url: location.search, title: document.getElementById("details-heading").textContent }));
  check("choosing a risk in the drop-down opens its chain and updates the URL", /node=directpromptinjection/.test(after.url) && /type=risk/.test(after.url) && after.title === "Direct prompt injection", JSON.stringify(after));
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
  await openEntry(page, "threat");
  const start = await page.evaluate(() => history.length);
  await page.select("#chain-select-risk", "risk:directpromptinjection");
  await sleep(300);
  const opened = await page.evaluate(() => ({ len: history.length, search: location.search, root: document.getElementById("map-status").dataset.root }));
  check("opening a trace adds one history entry", opened.len === start + 1 && /node=directpromptinjection/.test(opened.search), JSON.stringify(opened));
  await clickNow(page, '#model-filter-list input[type="radio"]:not([value="all"])');
  await sleep(300);
  const afterFilter = await page.evaluate(() => ({ len: history.length, search: location.search }));
  check("a model change replaces the entry instead of adding one", afterFilter.len === start + 1 && /model=/.test(afterFilter.search), JSON.stringify(afterFilter));
  await page.goBack();
  await sleep(400);
  const back = await page.evaluate(() => ({ search: location.search, root: document.getElementById("map-status").dataset.root, onPage: location.pathname.indexOf("relationship-map") !== -1 }));
  check("Back closes the trace and stays in the tool", back.onPage && !/node=/.test(back.search) && !back.root, JSON.stringify(back));
  await page.goForward();
  await sleep(400);
  const fwd = await page.evaluate(() => ({ search: location.search, active: document.activeElement.id, root: document.getElementById("map-status").dataset.root }));
  check("Forward reopens the trace and focuses the chain heading", /node=directpromptinjection/.test(fwd.search) && fwd.root && fwd.active === "chain-heading", JSON.stringify(fwd));
  check("the URL never names a graph view after history moves", !/graph/.test(fwd.search));
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
    const el = document.querySelector(".chain-workspace__bar");
    const r = el.getBoundingClientRect();
    const clear = document.getElementById("clear-chain-selection").getBoundingClientRect();
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
  check("the main choices are risk, obligation, control, and accountability", JSON.stringify(intro.entries) === JSON.stringify(["Explore a risk", "Explore an obligation", "Explore a control", "Explore accountability"]), JSON.stringify(intro.entries));
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
    risks: document.querySelectorAll("#chain-select-risk option[data-node-id]").length
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
  console.log("\n## Disclosures: preview and line types");
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
  const gone = await page.evaluate(() => ({
    panel: !!document.getElementById("entry-account-panel"),
    fold: !!document.querySelector(".illustrative-fold, table.illustrative, .auth-principle"),
    persona: !!document.getElementById("persona-list"),
    search: document.getElementById("node-search").checkVisibility(),
    find: document.querySelector(".find-form__submit").checkVisibility()
  }));
  check("Explore accountability has no persona-only panel and keeps the search and Find controls", !gone.panel && !gone.fold && !gone.persona && gone.search && gone.find, JSON.stringify(gone));
  await page.close();

  const chain = await openPage(browser, base, 1280, 900, "?type=risk&node=directpromptinjection&view=list");
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
  const afterEsc = await chain.evaluate(() => ({ open: document.querySelector(".legend-help").open, tag: document.activeElement.tagName, workspaceHidden: document.getElementById("chain-workspace").hidden }));
  check("Escape closes the explanation first and does not close the chain", !afterEsc.open && afterEsc.tag === "SUMMARY" && !afterEsc.workspaceHidden, JSON.stringify(afterEsc));
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
  const page = await openPage(browser, base, 1280, 900, "?type=risk&node=directpromptinjection&model=ai-paas&view=list");
  const text = await page.evaluate(() => {
    const skip = "site-nav, site-footer, #persona-list, #chain-board, #details-chain, #coverage-body, #context-board, #search-results";
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
  check("the status line and the chain label use risk", !/threat/i.test(status) && !/threat/i.test(await page.$eval("#chain-board", (el) => el.getAttribute("aria-label"))), status);
  await page.close();
}

async function captureModes(browser, base) {
  if (!ARTIFACTS) return;
  for (const [width, height] of [[1280, 900], [375, 812]]) {
    for (const mode of ["threat", "obligation", "control", "account"]) {
      const setup = MODE_SETUP[mode];
      const page = await startMode(browser, base, width, height, mode);
      const pick = await modePick(page, setup);
      await pickValue(page, setup.key, pick);
      await page.evaluate(() => { document.getElementById("options").open = false; });
      await sleep(400);
      const name = { threat: "risk", obligation: "obligation", control: "control", account: "accountability" }[mode];
      if (width === 1280) {
        await page.setViewport({ width: 1280, height: 1100 });
        await page.$eval("#options", (el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
        await page.evaluate(() => window.scrollBy(0, -100));
        await sleep(300);
        if (process.env.RELMAP_DEBUG) console.log(JSON.stringify(await page.evaluate(() => ({ y: scrollY, o: document.getElementById("options").getBoundingClientRect().toJSON(), ws: document.getElementById("chain-workspace").getBoundingClientRect().top }))));
      }
      await page.screenshot({ path: path.join(ARTIFACTS, "relmap-" + name + "-" + width + ".png") });
      await page.close();
    }
    const open = await openPage(browser, base, width, height, "");
    await open.evaluate(() => { document.getElementById("options").open = true; });
    await open.$eval("#options", (el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await sleep(300);
    await open.screenshot({ path: path.join(ARTIFACTS, "relmap-options-open-" + width + ".png") });
    await open.close();
  }
}

const ROCA_KEYS = ["risk", "obligation", "control", "accountable"];
const ROCA_WORD = { risk: "Why", obligation: "What", control: "How", accountable: "Who" };
const ROCA_NAME = { risk: "Risk", obligation: "Obligation", control: "Control", accountable: "Accountable" };
const ROCA_ALL = { risk: "All risks", obligation: "All obligations", control: "All controls", accountable: "All accountable parties" };
const PERSONA_CHAIN_QUERY = "?type=persona&node=ai-platform-provider&view=list";

async function openPersonaChain(browser, base, width, height, query) {
  return openPage(browser, base, width, height, query || PERSONA_CHAIN_QUERY);
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
      disabled: select ? select.disabled : true,
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
    belowColumns: window.innerWidth >= 1100 ? r.left >= board.right - 1 : r.top >= board.bottom - 1,
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
  let roca = await readRoca(page);
  const total = {};
  ROCA_KEYS.forEach((k) => { total[k] = roca[k].options; });

  check("each ROCA column has one native select" + at, ROCA_KEYS.every((k) => roca[k] && roca[k].exists) && (await page.$$eval("#chain-board select", (els) => els.length)) === 4);
  check("all four selects are enabled and list every item of their kind" + at, ROCA_KEYS.every((k) => !roca[k].disabled) && total.risk >= 20 && total.obligation >= 50 && total.control >= 50 && total.accountable >= 6, JSON.stringify(total));
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
  check("every select starts with its All option and a count" + at, ROCA_KEYS.every((k) => roca[k].first === ROCA_ALL[k] + " (" + total[k] + ")"), JSON.stringify(ROCA_KEYS.map((k) => roca[k].first)));
  check("the persona select shows the chosen persona and the other selects show All" + at, roca.accountable.value === "persona:ai-platform-provider" && ["risk", "obligation", "control"].every((k) => roca[k].value === ""), JSON.stringify(ROCA_KEYS.map((k) => roca[k].value)));
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
  check("the details panel sits beside the four columns on desktop, below on a phone, and is not squeezed" + at, panel0.visible && panel0.inSlot && panel0.belowColumns && panel0.width >= (width === 1280 ? 280 : 300), JSON.stringify(panel0));
  check("the details panel has a heading, a polite live region, and a labelled region" + at, panel0.headingTag === "H2" && panel0.liveRole === "status" && panel0.livePolite === "polite" && panel0.labelledBy === "details-heading");

  const lens = (r) => ROCA_KEYS.map((k) => r[k].options + "/" + r[k].headingName + "/" + r[k].first).join("|");
  const lens0 = lens(roca);
  const optionIds = async () => {
    const out = {};
    for (const k of ROCA_KEYS) out[k] = (await optionValues(page, k)).map((o) => o.value).join(",");
    return out;
  };
  const ids0 = await optionIds();
  const sameLists = async () => {
    const now = await optionIds();
    return ROCA_KEYS.every((k) => now[k] === ids0[k]);
  };
  const boxes = (page2) => page2.evaluate(() => {
    const out = {};
    document.querySelectorAll("#chain-board .chain-col").forEach((col) => {
      const more = Array.from(col.querySelectorAll("button.chain-more")).map((b) => (/^Show (\d+) more$/.exec(b.textContent) || [0, 0])[1]);
      out[col.dataset.column] = { n: col.querySelectorAll("button[data-chain-id]").length + Number(more[0] || 0), ids: Array.from(col.querySelectorAll("button[data-chain-id]")).map((b) => b.dataset.chainId) };
    });
    return out;
  });
  const boxes0 = await boxes(page);
  check("the persona chain shows one persona box and linked controls" + at, boxes0.accountable.n === 1 && boxes0.control.n > 0, JSON.stringify(ROCA_KEYS.map((k) => boxes0[k].n)));

  const riskOptions = (await optionValues(page, "risk")).slice(1);
  let riskPick = null;
  let boxesRisk = null;
  for (const opt of riskOptions) {
    await pickValue(page, "risk", opt.value);
    boxesRisk = await boxes(page);
    if (boxesRisk.obligation.n > 0 && boxesRisk.control.n > 0) { riskPick = opt; break; }
  }
  roca = await readRoca(page);
  const statusRisk = await page.$eval("#map-status", (el) => el.textContent);
  check("picking a risk keeps every select list and count the same" + at, lens(roca) === lens0 && (await sameLists()), lens(roca) + " vs " + lens0);
  check("picking a risk replaces the persona pick and shows only that risk box, highlighted" + at, !!riskPick && boxesRisk.risk.n === 1 && roca.risk.value === riskPick.value && roca.accountable.value === "" && roca.risk.pressed.join() === riskPick.value, JSON.stringify(ROCA_KEYS.map((k) => roca[k].value)));
  check("picking a risk shows its linked obligations, controls, and personas as boxes" + at, boxesRisk.obligation.n > 0 && boxesRisk.obligation.n < total.obligation && boxesRisk.control.n > 0 && boxesRisk.control.n < total.control && boxesRisk.accountable.n > 0, JSON.stringify(ROCA_KEYS.map((k) => boxesRisk[k].n)));
  check("the status line counts the focused chain" + at, new RegExp("Showing 1 risk, " + boxesRisk.obligation.n + " obligations?, " + boxesRisk.control.n + " controls?, and ").test(statusRisk), statusRisk);
  const risk1 = await readPanel(page);
  check("picking a risk shows that risk record in the details panel" + at, risk1.visible && risk1.belowColumns && risk1.kind === "Risk" && risk1.heading === riskPick.text && /^ID: \S+/.test(risk1.id) && risk1.sections.indexOf("Key metadata") !== -1 && risk1.sections.indexOf("Description and objective") !== -1 && /Layer|layer/.test(risk1.text) && risk1.live.indexOf(riskPick.text) !== -1, JSON.stringify(risk1).slice(0, 700));

  const obligationOptions = (await optionValues(page, "obligation")).slice(1);
  check("the Obligation select still lists every obligation after the risk pick" + at, obligationOptions.length === total.obligation, String(obligationOptions.length));
  let obPick = null;
  let boxesOb = null;
  for (const opt of obligationOptions) {
    await pickValue(page, "obligation", opt.value);
    boxesOb = await boxes(page);
    if (boxesOb.risk.n > 0 && boxesOb.control.n > 0) { obPick = opt; break; }
  }
  roca = await readRoca(page);
  check("picking an obligation moves the focus there and keeps every list the same" + at, !!obPick && roca.obligation.value === obPick.value && roca.risk.value === "" && lens(roca) === lens0 && (await sameLists()), lens(roca) + " vs " + lens0);
  check("picking an obligation shows only that obligation box and its linked risks, controls, and personas" + at, boxesOb.obligation.n === 1 && roca.obligation.pressed.join() === obPick.value && boxesOb.risk.n > 0 && boxesOb.control.n > 0 && boxesOb.accountable.n > 0, JSON.stringify(ROCA_KEYS.map((k) => boxesOb[k].n)));
  const ob1 = await readPanel(page);
  check("picking an obligation shows its record with citation and basis" + at, ob1.kind === "Obligation" && ob1.heading.length > 0 && ob1.sections.indexOf("Description and objective") !== -1 && ob1.sections.indexOf("Supporting obligations") !== -1 && ob1.sections.indexOf("Sources and relationship provenance") !== -1 && /Implements this obligation|Cited by/.test(ob1.text) && ob1.live.indexOf("Obligation") !== -1, JSON.stringify(ob1).slice(0, 900));
  check("the URL records the obligation focus" + at, /type=obligation/.test(page.url()), page.url());

  const controlOptions = (await optionValues(page, "control")).slice(1);
  let ctlPick = null;
  let boxesCtl = null;
  for (const opt of controlOptions) {
    await pickValue(page, "control", opt.value);
    boxesCtl = await boxes(page);
    if (boxesCtl.risk.n > 0 && boxesCtl.obligation.n > 0) { ctlPick = opt; break; }
  }
  roca = await readRoca(page);
  check("picking a control moves the focus there and keeps every list the same" + at, roca.control.value === ctlPick.value && roca.obligation.value === "" && lens(roca) === lens0 && (await sameLists()), lens(roca) + " vs " + lens0);
  check("picking a control shows only that control box with its linked risks and obligations" + at, boxesCtl.control.n === 1 && boxesCtl.risk.n > 0 && boxesCtl.obligation.n > 0 && boxesCtl.accountable.n >= 1, JSON.stringify(ROCA_KEYS.map((k) => boxesCtl[k].n)));
  const ctl1 = await readPanel(page);
  const pressedText = await page.$eval('#chain-board button[aria-pressed="true"]', (el) => el.textContent);
  check("picking a control shows its ID, layer, and evidence pointer" + at, ctl1.kind === "Control" && /^ID: \S+:\S+/.test(ctl1.id) && /Operates at L\d|Layer|layer/.test(ctl1.text + " " + pressedText) && /evidence pointer/i.test(ctl1.text + " " + pressedText) && ctl1.sections.indexOf("Key metadata") !== -1, JSON.stringify(ctl1).slice(0, 900));

  await pickValue(page, "accountable", "persona:ai-system-users");
  roca = await readRoca(page);
  const acc1 = await readPanel(page);
  check("choosing a persona resets every other select to All and shows that persona" + at, roca.accountable.value === "persona:ai-system-users" && roca.risk.value === "" && roca.obligation.value === "" && roca.control.value === "" && acc1.kind === "Accountable" && /AI System Users/.test(acc1.heading) && lens(roca) === lens0 && (await sameLists()), JSON.stringify([roca.accountable.value, acc1.kind, acc1.heading]));

  await pickValue(page, "risk", riskPick.value);
  await pickValue(page, "risk", riskOptions.find((o) => o.value !== riskPick.value).value);
  roca = await readRoca(page);
  check("a new pick in the same column replaces the old one" + at, roca.risk.value !== riskPick.value && roca.risk.value !== "" && ["obligation", "control", "accountable"].every((k) => roca[k].value === "") && lens(roca) === lens0, JSON.stringify(ROCA_KEYS.map((k) => roca[k].value)));

  await pickValue(page, "risk", riskPick.value);
  await pickValue(page, "obligation", "");
  roca = await readRoca(page);
  const boxesAfterAll = await boxes(page);
  check("choosing All obligations clears the focus and every select shows All" + at, ROCA_KEYS.every((k) => roca[k].value === "") && ROCA_KEYS.every((k) => boxesAfterAll[k].n === 0) && lens(roca) === lens0 && (await sameLists()), JSON.stringify(ROCA_KEYS.map((k) => [roca[k].value, boxesAfterAll[k].n])));

  const lastOb = (await optionValues(page, "obligation")).slice(1).pop();
  await pickValue(page, "obligation", lastOb.value);
  roca = await readRoca(page);
  const lastShown = await page.evaluate((id) => !!document.querySelector('#chain-board button[data-chain-id="' + id + '"]'), lastOb.value);
  check("the last obligation in the menu shows as a highlighted box when picked" + at, lastShown && roca.obligation.pressed.join() === lastOb.value && roca.obligation.cards === 1, JSON.stringify(roca.obligation));

  await pickValue(page, "risk", riskPick.value);
  if (width === 375) await page.evaluate(() => { const t = document.querySelector('.chain-col__toggle[data-column="control"]'); if (t.getAttribute("aria-expanded") !== "true") t.click(); });
  await sleep(150);
  const boxId = await page.evaluate(() => document.querySelector('#chain-board .chain-col[data-column="control"] button[data-chain-id]').dataset.chainId);
  await page.click('#chain-board button[data-chain-id="' + boxId.replace(/"/g, '\\"') + '"]');
  await sleep(350);
  roca = await readRoca(page);
  const clicked = await readPanel(page);
  check("clicking a box in another column makes it the focus and shows its details" + at, roca.control.value === boxId && roca.risk.value === "" && roca.control.pressed.join() === boxId && clicked.kind === "Control" && lens(roca) === lens0, JSON.stringify([roca.control.value, roca.risk.value, clicked.kind]));
  const noToggle = await page.evaluate(() => ({
    classes: document.querySelectorAll("#chain-board [class*='chain-box']").length,
    plus: Array.from(document.querySelectorAll("#chain-board button")).filter((b) => /^[+\u2212-]$/.test(b.textContent.trim()) || /^Links to the next column/.test(b.getAttribute("aria-label") || "")).length,
    lists: document.querySelectorAll("#chain-board .chain-card ul, #chain-board .chain-col__body ul").length
  }));
  if (width === 1280) check("the chain has no +/- toggles and no inner linked-item lists" + at, noToggle.classes === 0 && noToggle.plus === 0 && noToggle.lists === 0, JSON.stringify(noToggle));
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
      selectsInOptions: document.querySelectorAll("#options select").length,
      oldIds: ["risk-pick", "control-pick", "risk-suggestions", "suggestions", "suggestions-wrap", "control-source-note"].filter((id) => document.getElementById(id)),
      modes: ["entry-threat", "entry-obligation", "entry-control", "entry-account"].every((id) => !!document.getElementById(id)),
      search: !!document.getElementById("node-search"),
      removed: ["persona-list", "start-one", "risk-pick", "control-pick"].filter((id) => document.getElementById(id)),
      illustrative: !!document.querySelector(".illustrative-fold"),
      model: document.querySelectorAll('#model-filter-list input[name="operating-model"]').length,
      layers: document.querySelectorAll('#layer-filter-list input[name="layer"]').length,
      tapestry: !!document.getElementById("show-tapestry"),
      layersBtn: !!document.getElementById("show-context"),
      legend: shown(".chain-legend-wrap"),
      note2: document.getElementById("chain-model-note").textContent
    };
  });
  check("Options has no Risk or Control drop-down and no control source note" + at, left.selectsInOptions === 0 && left.oldIds.length === 0, JSON.stringify(left));
  check("Options keeps the four mode buttons, search, filters, Tapestry, and the layers button" + at, left.modes && left.search && left.removed.length === 0 && !left.illustrative && left.model >= 4 && left.layers >= 5 && left.tapestry && left.layersBtn, JSON.stringify(left));
  check("the line legend and the persona note stay" + at, left.legend && /These are the controls that name this persona as accountable/.test(left.note2), JSON.stringify(left));
  await page.close();

  const riskPage = await openPage(browser, base, width, height, "?risk=directpromptinjection");
  const riskState = await riskPage.evaluate(() => ({
    selects: document.querySelectorAll("#chain-board select").length,
    cards: document.querySelectorAll("#chain-board button[data-chain-id]").length,
    detailsInChain: !!document.querySelector("#chain-details-slot > .details")
  }));
  check("the risk chain has the four column selects and its cards" + at, riskState.selects === 4 && riskState.cards > 0 && riskState.detailsInChain, JSON.stringify(riskState));
  const firstControl = await riskPage.evaluate(() => {
    const card = document.querySelector('#chain-board .chain-col[data-column="control"] button[data-chain-id]');
    return card ? card.dataset.chainId : "";
  });
  if (width === 375) await riskPage.evaluate(() => { const t = document.querySelector('.chain-col__toggle[data-column="control"]'); if (t.getAttribute("aria-expanded") !== "true") t.click(); });
  await sleep(150);
  await riskPage.click('#chain-board button[data-chain-id="' + firstControl.replace(/"/g, '\\"') + '"]');
  await sleep(300);
  const riskPick = await riskPage.evaluate(() => ({ kind: document.getElementById("details-kind").textContent, pressed: document.querySelectorAll('#chain-board button[aria-pressed="true"]').length, inSlot: !!document.querySelector("#chain-details-slot > .details") }));
  check("clicking a control card in the risk chain shows its details below the chain" + at, riskPick.kind === "Control" && riskPick.pressed === 1 && riskPick.inSlot, JSON.stringify(riskPick));
  await riskPage.close();

  const controlPage = await openPage(browser, base, width, height, "?type=control&node=finance:SRF-L3-DEV-001&model=iaas&view=list");
  const controlState = await controlPage.evaluate(() => ({
    selects: document.querySelectorAll("#chain-board select").length,
    cards: document.querySelectorAll("#chain-board button[data-chain-id]").length,
    lines: document.querySelectorAll("#chain-svg path.chain-line").length,
    hasRisks: document.querySelectorAll('#chain-board .chain-col[data-column="risk"] button[data-chain-id]').length
  }));
  check("the control chain has the four column selects, its cards, and its lines" + at, controlState.selects === 4 && controlState.cards > 0 && controlState.hasRisks > 0 && (width === 375 || controlState.lines > 0), JSON.stringify(controlState));
  await controlPage.close();
}

async function testOptionsLayout(browser, base, width, height) {
  const at = " at " + width;
  const page = await openPage(browser, base, width, height, "");
  const first = await page.evaluate(() => {
    const opt = document.getElementById("options");
    return { open: opt.open, search: document.getElementById("node-search").checkVisibility(), modes: document.getElementById("entry-threat").checkVisibility(), status: document.getElementById("map-status").checkVisibility(), summary: opt.querySelector(":scope > summary").checkVisibility() };
  });
  check("Options is collapsed on first load, with only its summary and the status line showing" + at, first.open === false && !first.search && !first.modes && first.status && first.summary, JSON.stringify(first));
  await page.evaluate(() => { sessionStorage.setItem("relmap-options-open", "open"); });
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector('#map-status[data-ready="true"]', { timeout: 60000 });
  check("a stored open state is ignored: Options is still collapsed after a reload" + at, await page.evaluate(() => document.getElementById("options").open === false));
  await page.click("#options > summary");
  await sleep(200);
  const info = await page.evaluate(() => {
    const opt = document.getElementById("options");
    const sum = opt ? opt.querySelector(":scope > summary") : null;
    const inside = (id) => !!opt && opt.contains(document.getElementById(id));
    const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
    return {
      tag: opt && opt.tagName, open: opt && opt.open, summary: sum && sum.textContent.trim(), summaryTag: sum && sum.tagName,
      moved: ["entry-threat", "entry-obligation", "entry-control", "entry-account", "node-search", "model-filter-list", "layer-filter-list", "show-tapestry", "show-context", "map-filters"].filter((id) => !inside(id)),
      layerFrames: !!opt && !!opt.querySelector(".layer-frames"),
      sideColumn: getComputedStyle(document.querySelector(".map-layout")).gridTemplateColumns.split(" ").length,
      stageWidth: rect(".map-stage").width, panelWidth: rect(".map-panel").width, viewport: window.innerWidth,
      panelBelow: rect(".map-panel").top >= rect(".map-stage").bottom - 1,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });
  check("Options is a details element with a summary that opens on click" + at, info.tag === "DETAILS" && info.open === true && info.summary === "Hide options" && info.summaryTag === "SUMMARY", JSON.stringify(info));
  check("the mode buttons, search, filters, Tapestry, and the layers button are inside Options" + at, info.moved.length === 0, JSON.stringify(info.moved));
  check("the left column is gone: one grid column, and the details panel sits below at the same width" + at, info.sideColumn === 1 && info.stageWidth > width - 160 && (width === 375 || (info.panelBelow && Math.abs(info.stageWidth - info.panelWidth) <= 1)), JSON.stringify(info));
  check("Options does not scroll sideways" + at, info.overflow <= 1, String(info.overflow));
  const rows = await page.evaluate(() => {
    const top = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().top);
    const left = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().left);
    return { modeTop: top("#entry-threat"), actionTop: top("#show-context"), modelTop: top('[name="operating-model"]'), layerTop: top('[name="layer"]'), modeLeft: left("#entry-threat"), actionLeft: left("#show-context"), modelLeft: left("#model-filter-list"), layerLeft: left("#layer-filter-list") };
  });
  if (width === 1280) check("at 1280 the mode buttons share a row with the layers and start-over buttons, and the two filters share a row" + at, Math.abs(rows.modeTop - rows.actionTop) < 40 && rows.actionLeft > rows.modeLeft && Math.abs(rows.modelTop - rows.layerTop) < 40 && rows.layerLeft > rows.modelLeft, JSON.stringify(rows));
  else check("at 375 the Options rows stack: buttons, then filters" + at, rows.actionTop > rows.modeTop && rows.layerTop > rows.modelTop && rows.modeLeft < 40 && rows.actionLeft < 40, JSON.stringify(rows));

  await page.click("#options > summary");
  await sleep(200);
  const closed = await page.evaluate(() => ({ open: document.getElementById("options").open, search: document.getElementById("node-search").checkVisibility() ? 1 : 0, status: document.getElementById("map-status").checkVisibility() ? 1 : 0, stored: sessionStorage.getItem("relmap-options-open") }));
  check("clicking the open Options summary collapses it and hides the controls" + at, closed.open === false && closed.search === 0 && closed.status === 1, JSON.stringify(closed));
  await page.click("#options > summary");
  await sleep(200);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector('#map-status[data-ready="true"]', { timeout: 60000 });
  check("an Options panel left open is collapsed again after a reload" + at, await page.evaluate(() => document.getElementById("options").open === false));
  await page.focus("#options > summary");
  await page.keyboard.press("Enter");
  await sleep(200);
  check("the Options summary opens from the keyboard" + at, await page.evaluate(() => document.getElementById("options").open === true));
  await page.click("#options > summary");
  await sleep(150);
  await page.evaluate(() => document.querySelector('a[href="#node-search"]').click());
  await sleep(300);
  check("a Find link reopens a collapsed Options and focuses search" + at, await page.evaluate(() => document.getElementById("options").open && document.activeElement.id === "node-search"));
  await page.close();

  const persona = await openPersonaChain(browser, base, width, height);
  const chain = await persona.evaluate(() => ({
    board: document.getElementById("chain-board").getBoundingClientRect().width,
    belowOptions: document.getElementById("chain-workspace").getBoundingClientRect().top >= document.getElementById("options").getBoundingClientRect().bottom - 1,
    optionsOpen: document.getElementById("options").open,
    selects: document.querySelectorAll("#chain-board select").length,
    panelInChain: !!document.querySelector("#chain-details-slot > .details"),
    detailsWidth: document.querySelector(".details").getBoundingClientRect().width,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));
  check("the ROCA chain and its details sit below Options, side by side at 1280" + at, (width === 375 || chain.belowOptions) && chain.panelInChain && chain.selects === 4 && chain.overflow <= 1 && (width === 1280 ? chain.board > 700 && chain.detailsWidth >= 280 && chain.detailsWidth <= 320 : chain.board > 300), JSON.stringify(chain));
  if (width === 1280) {
    const cols = await persona.evaluate(() => Array.from(document.querySelectorAll("#chain-board .chain-col")).map((c) => Math.round(c.getBoundingClientRect().width)));
    check("at 1280 each ROCA column is at least 170 px wide" + at, cols.length === 4 && cols.every((w) => w >= 170), cols.join());
  }
  await persona.close();

  const layers = await openPage(browser, base, width, height, "?view=context");
  const l = await layers.evaluate(() => ({ board: !document.getElementById("context-board").hidden, bands: document.querySelectorAll("#context-board button[data-node-id]").length, overflow: document.documentElement.scrollWidth - window.innerWidth }));
  check("the layers view still renders with the new layout" + at, l.board && l.bands > 5 && l.overflow <= 1, JSON.stringify(l));
  await layers.close();

  if (width === 375) {
    const sheet = await openPage(browser, base, width, height, "?risk=directpromptinjection");
    const state = await sheet.evaluate(() => { const p = document.querySelector(".map-panel").getBoundingClientRect(); return { left: p.left, top: p.top, w: p.width, h: p.height, open: document.body.classList.contains("sheet-open"), inert: document.querySelector(".map-stage").hasAttribute("inert") }; });
    check("the 375 px sheet still covers the screen and makes Options inert" + at, state.left === 0 && state.top === 0 && state.w === 375 && state.open && state.inert, JSON.stringify(state));
    await sheet.close();
  }
}

async function testFourModes(browser, base, width, height) {
  const at = " at " + width;
  console.log("\n## All four modes and search picks land on the ROCA chain" + at);
  const info = await openPage(browser, base, width, height, "");
  const closed = await info.evaluate(() => ({
    detailsShown: document.querySelector(".details").getClientRects().length > 0,
    workspaceHidden: document.getElementById("chain-workspace").hidden,
    optionsOpen: document.getElementById("options").open,
    buttons: Array.from(document.querySelectorAll("button, summary, a")).filter((el) => el.getClientRects().length > 0 || el.closest("#options")).map((el) => el.textContent.trim()).filter((t) => /graph/i.test(t)),
    clearSelection: !!document.getElementById("clear-selection"),
    jump: !!document.querySelector(".chain-jump"),
    entries: Array.from(document.querySelectorAll(".entry-points button")).map((b) => b.id)
  }));
  check("with no pick there is no details panel, no chain, and Options is collapsed" + at, !closed.detailsShown && closed.workspaceHidden && !closed.optionsOpen, JSON.stringify(closed));
  check("no button or link is labeled graph, and the duplicate Clear and jump links are gone" + at, closed.buttons.length === 0 && !closed.clearSelection && !closed.jump, JSON.stringify(closed));
  check("the four mode buttons come in ROCA order" + at, closed.entries.join() === "entry-threat,entry-obligation,entry-control,entry-account", closed.entries.join());
  await info.close();

  const modes = [
    ["threat", "risk", "Direct prompt injection", "risk"],
    ["obligation", "obligation", "", "obligation"],
    ["control", "control", "", "control"],
    ["account", "accountable", "AI Platform Provider", "accountable"]
  ];
  for (const [mode, key, query, kindKey] of modes) {
    const page = await startMode(browser, base, width, height, mode);
    const start = await page.evaluate(() => ({
      pressed: Array.from(document.querySelectorAll(".entry-points button[aria-pressed='true']")).map((b) => b.id),
      counts: Array.from(document.querySelectorAll("#chain-board select")).map((s) => s.options.length - 1),
      disabled: Array.from(document.querySelectorAll("#chain-board select")).filter((s) => s.disabled).length,
      search: document.getElementById("node-search").checkVisibility(),
      find: document.querySelector(".find-form__submit").checkVisibility()
    }));
    check(mode + " mode: the same search and Find controls, four full selects, and its button pressed" + at, start.pressed.join() === "entry-" + mode && start.disabled === 0 && start.counts.every((n) => n >= 6) && start.search && start.find, JSON.stringify(start));
    let text = query;
    if (!text) text = (await optionValues(page, key))[4].text;
    if (width === 375) {
      await clickNow(page, "#clear-chain-selection");
      await sleep(500);
    }
    await search(page, text);
    const results = await page.evaluate(() => Array.from(document.querySelectorAll("#search-results [role=option]")).map((o) => o.dataset.nodeId));
    const want = results.filter((id) => (kindKey === "risk" ? id.indexOf("risk:") === 0 : kindKey === "obligation" ? /^(obligation|instrument):/.test(id) : kindKey === "control" ? id.indexOf("control:") === 0 : id.indexOf("persona:") === 0));
    check(mode + " mode: search finds " + kindKey + " records" + at, want.length > 0, JSON.stringify(results.slice(0, 8)));
    await page.click('#search-results [role=option][data-node-id="' + want[0] + '"]');
    await sleep(900);
    const landed = await page.evaluate(() => ({
      chain: !document.getElementById("chain").hidden,
      inSlot: !!document.querySelector("#chain-details-slot > .details"),
      detailsShown: document.querySelector(".details").getClientRects().length > 0,
      values: Array.from(document.querySelectorAll("#chain-board select")).map((s) => s.id.replace("chain-select-", "") + "=" + s.value),
      counts: Array.from(document.querySelectorAll("#chain-board select")).map((s) => s.options.length - 1),
      pressed: document.querySelectorAll("#chain-board button[aria-pressed='true']").length,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    }));
    const held = landed.values.filter((v) => !/=$/.test(v));
    check(mode + " mode: choosing a " + kindKey + " from search shows the chain with details, and only the " + key + " select holds it" + at, landed.chain && landed.inSlot && landed.detailsShown && held.length === 1 && held[0].indexOf(key + "=") === 0 && landed.pressed >= 1, JSON.stringify(landed));
    check(mode + " mode: the select counts are unchanged after a search pick" + at, landed.counts.join() === start.counts.join(), landed.counts.join() + " vs " + start.counts.join());
    check(mode + " mode: no sideways scroll after a search pick" + at, landed.overflow <= 1, String(landed.overflow));
    check("no page errors in the " + mode + " search flow" + at, page.__errors.length === 0, page.__errors.join("; "));
    await page.close();
  }
}

async function testOptionsSameInEveryMode(browser, base) {
  console.log("\n## Options shows the same controls in all four modes at 1280");
  const labels = { threat: "Find a risk", obligation: "Find an obligation", control: "Find a control", account: "Find an accountable persona" };
  const signatures = {};
  const texts = {};
  for (const mode of ["threat", "obligation", "control", "account"]) {
    const page = await startMode(browser, base, 1280, 900, mode);
    const seen = await page.evaluate(() => {
      const opt = document.getElementById("options");
      const items = [];
      opt.querySelectorAll("*").forEach((el) => {
        if (!el.checkVisibility()) return;
        if (!el.matches("[id], button, input, select, legend, summary, h2, h3, p, fieldset, label, form, section, details, dl, dt")) return;
        const textual = el.matches("legend, summary, button, h2, h3, dt");
        items.push(el.tagName + "#" + (el.id || "") + "." + (el.id ? "" : el.className) + "|" + (textual ? el.textContent.trim() : ""));
      });
      return { items: items.filter((t) => !/^LABEL#\.find-form__label/.test(t)), text: opt.innerText, label: document.querySelector('label[for="node-search"]').textContent.trim(), placeholder: document.getElementById("node-search").placeholder, help: document.getElementById("map-help").textContent };
    });
    signatures[mode] = seen.items.join("\n");
    texts[mode] = seen.text;
    check(mode + " mode: the find label names the mode" + " at 1280", seen.label === labels[mode] && seen.placeholder.length > 0, seen.label + " / " + seen.placeholder);
    check(mode + " mode: Options has no authorization text, Accountable personas heading, persona buttons, handoff titles fold, or Start from one button", !/Authorization establishes|Accountable personas|illustrative|handoff|Start from one/i.test(seen.text) && (await page.$$("#persona-list, #start-one, .illustrative-fold, #entry-account-panel")).length === 0, seen.text.slice(0, 200));
    await page.close();
  }
  const sameSet = ["obligation", "control", "account"].every((m) => signatures[m] === signatures.threat);
  check("the visible Options children are the same set in all four modes", sameSet && signatures.threat.length > 200, JSON.stringify(["obligation", "control", "account"].map((m) => [m, diff(signatures[m].split("\n"), signatures.threat.split("\n"))])));
}

const LAYER_NAME = {};
readData("layers.json").layers.forEach((l) => { LAYER_NAME[l.id] = l.id + " " + l.name; });
const byText = (a, b) => String(a).localeCompare(String(b), "en", { sensitivity: "base" });
function controlOrder(a, b) {
  return (LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer))
    || (a.sector === b.sector ? 0 : !a.sector ? -1 : !b.sector ? 1 : byText(a.sector, b.sector))
    || byText(a.name, b.name)
    || (a.nodeId < b.nodeId ? -1 : 1);
}
const groupLabel = (c) => LAYER_NAME[c.layer] + (c.sector ? " \u00b7 " + c.sector : "");

async function testControlOrdering(browser, base) {
  console.log("\n## Controls list by layer, then no sector, then sector, then name");
  const expected = inChainCore.slice().sort(controlOrder);
  check("data has sector-specific and no-sector controls in the same layer", LAYERS.some((l) => expected.some((c) => c.layer === l && !c.sector) && expected.some((c) => c.layer === l && c.sector)), "none");
  const page = await startMode(browser, base, 1280, 900, "control");
  const select = await page.$$eval("#chain-select-control optgroup", (groups) => groups.map((g) => ({ label: g.label, ids: Array.from(g.querySelectorAll("option")).map((o) => o.value) })));
  check("the Control select lists every control in layer, sector, name order (" + expected.length + ")", JSON.stringify(select.flatMap((g) => g.ids)) === JSON.stringify(expected.map((c) => c.nodeId)), JSON.stringify(select.flatMap((g) => g.ids).slice(0, 5)) + " vs " + JSON.stringify(expected.slice(0, 5).map((c) => c.nodeId)));
  const labels = [];
  expected.forEach((c) => { const l = groupLabel(c); if (labels[labels.length - 1] !== l) labels.push(l); });
  check("the Control select uses one optgroup per layer and sector, in order", JSON.stringify(select.map((g) => g.label)) === JSON.stringify(labels), JSON.stringify(select.map((g) => g.label)));
  check("optgroup labels include L5 AI Model Provider and L5 AI Model Provider \u00b7 Healthcare", select.some((g) => g.label === "L5 AI Model Provider") && select.some((g) => g.label === "L5 AI Model Provider \u00b7 Healthcare"), JSON.stringify(select.map((g) => g.label)));
  await page.close();

  for (const [width, height] of [[1280, 900], [375, 812]]) {
    const at = " at " + width;
    const p2 = await openPersonaChain(browser, base, width, height);
    await p2.evaluate(() => { document.querySelectorAll('.chain-more[data-more-column="control"]').forEach((b) => b.click()); });
    await sleep(200);
    const boxes = await p2.$$eval('#chain-board .chain-col[data-column="control"] button[data-chain-id]', (els) => els.map((el) => el.dataset.chainId));
    const listed = await p2.$$eval('#details-chain .details-related[data-node-id^="control:"]', (els) => els.map((el) => el.dataset.nodeId));
    const known = listed.map((id) => inChainCore.find((c) => c.nodeId === id)).filter(Boolean);
    const sorted = known.slice().sort(controlOrder).map((c) => c.nodeId);
    check("the control list in the details panel follows the order" + at, listed.length > 10 && known.length === listed.length && JSON.stringify(listed) === JSON.stringify(sorted), JSON.stringify(listed.slice(0, 4)) + " vs " + JSON.stringify(sorted.slice(0, 4)));
    check("the chain boxes match the first entries of that list" + at, boxes.length > 1 && JSON.stringify(boxes) === JSON.stringify(listed.slice(0, boxes.length)), JSON.stringify(boxes.slice(0, 4)));
    check("the persona chain mixes layers and sectors so the order is exercised" + at, new Set(known.map((c) => c.layer)).size > 1 && known.some((c) => c.sector) && known.some((c) => !c.sector), "too uniform");
    await p2.close();
  }
}

async function testOptionsCue(browser, base) {
  console.log("\n## Options shows a chevron and Show options / Hide options");
  for (const [width, height] of [[1280, 800], [375, 812]]) {
    const at = " at " + width;
    const page = await openPage(browser, base, width, height, "");
    const read = () => page.evaluate(() => {
      const opt = document.getElementById("options");
      const sum = opt.querySelector(":scope > summary");
      const chev = sum.querySelector(".options__chevron");
      const box = chev.getBoundingClientRect();
      return { open: opt.open, text: sum.textContent.replace(/\s+/g, " ").trim(), expanded: sum.getAttribute("aria-expanded"), chevron: chev.checkVisibility() && box.width > 0, transform: getComputedStyle(chev).transform, active: document.activeElement === sum };
    });
    const closed = await read();
    check("collapsed Options reads Show options with a visible chevron and aria-expanded false" + at, !closed.open && closed.text === "Show options" && closed.expanded === "false" && closed.chevron, JSON.stringify(closed));
    await page.focus("#options > summary");
    await page.keyboard.press("Enter");
    await sleep(400);
    const open = await read();
    check("Enter on the focused summary opens Options, reads Hide options, and rotates the chevron" + at, open.open && open.text === "Hide options" && open.expanded === "true" && open.transform !== closed.transform && open.active, JSON.stringify(open));
    await page.keyboard.press("Space");
    await sleep(400);
    const again = await read();
    check("Space closes Options and restores Show options" + at, !again.open && again.text === "Show options" && again.expanded === "false" && again.transform === closed.transform, JSON.stringify(again));
    await page.close();
  }
}

async function testDetailsBesideChain(browser, base) {
  console.log("\n## Details sit beside the chain on desktop and below it on a phone");
  for (const [width, height] of [[1280, 900], [375, 812]]) {
    const at = " at " + width;
    const page = await openPersonaChain(browser, base, width, height);
    const m = await page.evaluate(() => {
      const r = (sel) => { const el = document.querySelector(sel); return el && el.getClientRects().length ? el.getBoundingClientRect() : null; };
      const chain = r("#chain");
      const details = r("#chain-details-slot .details");
      const cols = Array.from(document.querySelectorAll("#chain-board .chain-col")).map((c) => c.getBoundingClientRect().width);
      const panel = document.querySelector(".map-panel");
      return {
        chain: chain && { left: chain.left, right: chain.right, top: chain.top, bottom: chain.bottom },
        details: details && { left: details.left, right: details.right, top: details.top },
        cols: cols,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        panelOverflow: panel.scrollWidth - panel.clientWidth,
        viewport: window.innerWidth
      };
    });
    if (width >= 1100) {
      check("details panel is to the right of the chain at the same top" + at, !!m.chain && !!m.details && m.details.left >= m.chain.right - 1 && Math.abs(m.details.top - m.chain.top) < 4 && m.details.right <= m.viewport, JSON.stringify(m));
      check("the chain keeps four columns at least 140px wide" + at, m.cols.length === 4 && m.cols.every((w) => w >= 140), JSON.stringify(m.cols));
    } else {
      check("details panel is below the chain on a phone" + at, !!m.chain && !!m.details && m.details.top >= m.chain.bottom - 1, JSON.stringify(m));
    }
    check("no horizontal scroll" + at, m.overflow <= 0 && m.panelOverflow <= 0, JSON.stringify(m));
    await page.close();
  }
}

async function openNoControlsFixture(browser, base, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (/\/data\/[a-z-]+-controls\.json$/.test(req.url())) {
      const file = path.join(ROOT, "data", path.basename(req.url()));
      const body = fs.readFileSync(file, "utf8").split("ai-system-users").join("ai-system-governance");
      req.respond({ status: 200, contentType: "application/json", body: body });
    } else {
      req.continue();
    }
  });
  await page.goto(base + "/tools/relationship-map/index.html?type=persona&node=ai-system-users&view=list", { waitUntil: "load" });
  await page.waitForSelector('#map-status[data-ready="true"]', { timeout: 60000 });
  return page;
}

async function testPersonaRisks(browser, base) {
  console.log("\n## A persona chain shows the risks of its controls and the risks that name it");
  const personas = ["ai-system-users", "ai-system-governance", "data-provider", "application-developer", "agentic-platform-provider", "ai-platform-provider", "ai-model-serving", "model-provider"];
  const finance = readData("finance-controls.json").controls;
  const linked = threats.filter((t) => (t.related_controls || []).some((c) => c === "srf.control.finance.SRF-L1-DEV-003" || c === "srf.control.finance.SRF-L1-DEV-006")).map((t) => "risk:" + t.id);
  check("data: DEV-003 and DEV-006 are linked to at least dsgai03 and dsgai16", ["risk:dsgai03", "risk:dsgai16"].every((id) => linked.indexOf(id) !== -1) && finance.some((c) => c.id === "SRF-L1-DEV-006"), JSON.stringify(linked));
  for (const id of personas) {
    const page = await openPersonaChain(browser, base, 1280, 900, "?type=persona&node=" + id + "&view=list");
    await page.evaluate(() => { document.querySelectorAll('.chain-more[data-more-column="risk"]').forEach((b) => b.click()); });
    await sleep(200);
    const shown = await page.$$eval('#chain-board .chain-col[data-column="risk"] button[data-chain-id]', (els) => els.map((el) => el.dataset.chainId));
    const ownerNamed = threats.filter((t) => Object.values(t.accountability || {}).some((cell) => cell.accountable_persona === id)).map((t) => "risk:" + t.id);
    check(id + " chain keeps every risk that names it as owner (" + ownerNamed.length + ") and shows " + shown.length, ownerNamed.every((r) => shown.indexOf(r) !== -1), JSON.stringify(ownerNamed.filter((r) => shown.indexOf(r) === -1)));
    if (id === "ai-system-users") {
      check("AI System Users chain shows the risks linked to DEV-003 and DEV-006", linked.every((r) => shown.indexOf(r) !== -1) && shown.length >= linked.length, JSON.stringify({ linked: linked, shown: shown }));
    }
    await page.close();
  }
}

async function testRelatedListBullets(browser, base) {
  console.log("\n## Related list bullets sit on the first line of each item");
  for (const [width, height] of [[1280, 900], [375, 812]]) {
    const at = " at " + width;
    const page = await openPersonaChain(browser, base, width, height, "?type=persona&node=data-provider&view=list");
    const m = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("#details-chain li > .details-related").forEach((b) => {
        const li = b.parentElement;
        const probe = document.createElement("span");
        probe.style.cssText = "display:inline-block;width:0;height:0";
        li.insertBefore(probe, li.firstChild);
        const line = parseFloat(getComputedStyle(b).fontSize) * 1.6;
        out.push({ wrapped: b.getBoundingClientRect().height > line * 1.5, off: probe.getBoundingClientRect().bottom - b.getBoundingClientRect().top, line: line });
        probe.remove();
      });
      return out;
    });
    const wrapped = m.filter((x) => x.wrapped);
    check("some related items wrap, so the bullet position is exercised" + at, wrapped.length > 0, String(m.length));
    check("each bullet baseline is inside the first line of its item" + at, m.every((x) => x.off <= x.line), JSON.stringify(m.filter((x) => x.off > x.line).slice(0, 2)));
    await page.close();
  }
}

async function testEmptyControlsState(browser, base) {
  console.log("\n## A pick with no controls shows an empty state (fixture)");
  // Fixture: serve the control files with every ai-system-users owner swapped to
  // ai-system-governance, so the persona has zero controls. Real data is not touched.
  for (const [width, height] of [[1280, 900], [375, 812]]) {
    const at = " at " + width;
    const page = await openNoControlsFixture(browser, base, width, height);
    const s = await page.evaluate(() => {
      const empty = document.querySelector("#chain-board .chain-empty-state");
      return {
        text: empty ? empty.textContent : "",
        visible: !!empty && empty.getClientRects().length > 0,
        cards: document.querySelectorAll('#chain-board .chain-col[data-column="control"] button[data-chain-id]').length,
        selects: document.querySelectorAll("#chain-board select.chain-pick").length,
        overflow: document.documentElement.scrollWidth - window.innerWidth
      };
    });
    check("fixture: a persona with zero controls says No controls mapped yet and keeps its four menus" + at, s.visible && /No controls mapped yet/.test(s.text) && s.cards === 0 && s.selects === 4 && s.overflow <= 0, JSON.stringify(s));
    await page.close();
  }
  const page = await openPersonaChain(browser, base, 1280, 900);
  check("a persona with controls shows no empty state", (await page.$$("#chain-board .chain-empty-state")).length === 0);
  await page.close();
}

async function testUsersPersonaControls(browser, base) {
  console.log("\n## AI System Users is accountable for the acceptable use controls");
  const want = ["control:finance:SRF-L1-DEV-003", "control:finance:SRF-L1-DEV-006", "control:healthcare:SRF-L1-HOR-002"];
  const byId = (id) => controls.find((c) => c.nodeId === id);
  const finance = readData("finance-controls.json").controls;
  const health = readData("healthcare-controls.json").controls;
  const dev3 = finance.find((c) => c.id === "SRF-L1-DEV-003");
  const hor2 = health.find((c) => c.id === "SRF-L1-HOR-002");
  const dev6 = finance.find((c) => c.id === "SRF-L1-DEV-006");
  const allUsers = (c) => Object.keys(c.accountable_by_model).length > 0 && Object.values(c.accountable_by_model).every((p) => p === "ai-system-users") && c.accountable_persona === "ai-system-users";
  check("data: DEV-003 and HOR-002 name ai-system-users on each model they already mapped, with models unchanged", allUsers(dev3) && allUsers(hor2) && sameSet(Object.keys(dev3.accountable_by_model), ["AI-SaaS", "AI-PaaS", "Agent-PaaS"]) && sameSet(Object.keys(hor2.accountable_by_model), ["AI-SaaS", "Agent-PaaS", "IaaS"]) && sameSet(dev3.operating_models, ["AI-SaaS", "AI-PaaS", "Agent-PaaS"]) && sameSet(hor2.operating_models, ["SaMD-Cloud", "EHR-Embedded", "Agent-Clinical", "On-Premise"]), "unexpected");
  check("data: both descriptions say AI System Governance still issues the policy", /AI System Governance issues and maintains the policy/.test(dev3.description) && /AI System Governance issues and maintains the policy/.test(hor2.description), "missing sentence");
  check("data: SRF-L1-DEV-006 is an L1 sector-neutral control owned by ai-system-users on all four models", !!dev6 && dev6.layer === "L1" && allUsers(dev6) && sameSet(Object.keys(dev6.accountable_by_model), MODELS) && sameSet(dev6.operating_models, MODELS), JSON.stringify(dev6 && dev6.accountable_by_model));
  check("data: SRF-L1-DEV-006 has no sector operating model", !!dev6 && dev6.operating_models.every((m) => MODELS.indexOf(m) !== -1), "sector model present");
  const page = await openPersonaChain(browser, base, 1280, 900, "?type=persona&node=ai-system-users&view=list");
  await page.evaluate(() => { document.querySelectorAll('.chain-more[data-more-column="control"]').forEach((b) => b.click()); });
  await sleep(200);
  const listed = await page.$$eval('#details-chain .details-related[data-node-id^="control:"]', (els) => els.map((el) => el.dataset.nodeId));
  check("the AI System Users chain lists its controls, including all three", want.every((id) => listed.indexOf(id) !== -1) && listed.length >= 3, JSON.stringify(listed));
  const state = await page.evaluate(() => ({ empty: document.querySelectorAll("#chain-board .chain-empty-state").length, cards: document.querySelectorAll('#chain-board .chain-col[data-column="control"] button[data-chain-id]').length }));
  check("the AI System Users chain shows control boxes and no empty state", state.empty === 0 && state.cards >= 3, JSON.stringify(state));
  check("DEV-006 appears in the L1 no-sector group of the Control select", await page.$$eval("#chain-select-control optgroup", (groups) => { const g = groups.find((x) => x.label === "L1 AI Business & Usage"); return !!g && Array.from(g.querySelectorAll("option")).some((o) => o.value === "control:finance:SRF-L1-DEV-006"); }));
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
    const suites = [
      ["searchIndex", () => testSearchIndex(browser, base)],
      ["fullControlList", () => testFullControlList(browser, base)],
      ["layerFilter", () => testLayerFilter(browser, base)],
      ["linkBasis", () => testLinkBasis(browser, base)],
      ["dsgaiSourceLinks", () => testDsgaiSourceLinks(browser, base)],
      ["wording", () => testWording(browser, base)],
      ["navigation", () => testNavigation(browser, base)],
      ["listView", () => testListView(browser, base)],
      ["graphRemoved", () => testGraphRemoved(browser, base)],
      ["noNarrowingCode", () => testNoNarrowingCode(browser, base)],
      ["modeParity", async () => {
        for (const [width, height] of [[1280, 800], [375, 812]]) await testModeParity(browser, base, width, height);
      }],
      ["fourModes", async () => {
        for (const [width, height] of [[1280, 800], [375, 812]]) await testFourModes(browser, base, width, height);
      }],
      ["optionsSameInEveryMode", () => testOptionsSameInEveryMode(browser, base)],
      ["controlOrdering", () => testControlOrdering(browser, base)],
      ["optionsCue", () => testOptionsCue(browser, base)],
      ["detailsBesideChain", () => testDetailsBesideChain(browser, base)],
      ["emptyControlsState", () => testEmptyControlsState(browser, base)],
      ["usersPersonaControls", () => testUsersPersonaControls(browser, base)],
      ["personaRisks", () => testPersonaRisks(browser, base)],
      ["relatedListBullets", () => testRelatedListBullets(browser, base)],
      ["columnLabels", () => testColumnLabels(browser, base)],
      ["listbox", () => testListbox(browser, base)],
      ["phoneSheet", () => testPhoneSheet(browser, base)],
      ["deepLinkRefresh", () => testDeepLinkRefresh(browser, base)],
      ["urlState", () => testUrlState(browser, base)],
      ["copyChain", () => testCopyChain(browser, base)],
      ["rootSelects", () => testRootSelects(browser, base)],
      ["plainDetails", () => testPlainDetails(browser, base)],
      ["backButton", () => testBackButton(browser, base)],
      ["phoneHeaderAndIntro", () => testPhoneHeaderAndIntro(browser, base)],
      ["loadResilience", () => testLoadResilience(browser, base)],
      ["disclosures", () => testDisclosures(browser, base)],
      ["riskWording", () => testRiskWording(browser, base)],
      ["optionsAndSelects", async () => {
        for (const [width, height] of [[1280, 800], [375, 812]]) {
          await testLeftColumnTrim(browser, base, width, height);
          await testOptionsLayout(browser, base, width, height);
        }
      }],
      ["captureModes", () => captureModes(browser, base)]
    ];
    const only = (process.env.RELMAP_TESTS || "").split(",").filter(Boolean);
    for (const [name, run] of suites) {
      if (only.length && only.indexOf(name) === -1) continue;
      await run();
    }
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
