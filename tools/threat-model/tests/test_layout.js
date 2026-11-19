// Real-browser layout checks for the Details drawer and the graph overlay.
// Needs puppeteer-core and a Chrome binary (CHROME_PATH, or a common install path).
// Without them it prints a skip line and exits 0, so local runs on a bare machine still pass.
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

let puppeteer = null;
try { puppeteer = require("puppeteer-core"); } catch (e) { /* optional */ }
const candidates = [process.env.CHROME_PATH, "/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const chrome = candidates.find((p) => fs.existsSync(p));
if (!puppeteer || !chrome) {
  console.log("SKIP test_layout.js: puppeteer-core or Chrome not found");
  process.exit(0);
}

const URL = pathToFileURL(path.join(__dirname, "..", "index.html")).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0, passed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : "  " + detail));
}

async function open(browser, width, height, mode) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction("window.TM_UI && document.querySelector('#graph .node')");
  if (mode !== "holistic") await page.evaluate((m) => window.TM_UI.setAssessment(m), mode);
  await sleep(300);
  return page;
}

const measure = () => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width }; };
  const sc = document.getElementById("graph-scroll");
  return { scroll: r(sc), side: r(document.getElementById("side")), open: document.getElementById("main").classList.contains("drawer-open") };
};

async function pageScrolls(browser) {
  const page = await open(browser, 1280, 800, "holistic");
  const r = await page.evaluate(() => {
    const svg = document.getElementById("graph-svg");
    const sc = document.getElementById("graph-scroll");
    const footer = document.querySelector("site-footer");
    return {
      overflow: getComputedStyle(document.body).overflowY,
      doc: document.documentElement.scrollHeight,
      view: window.innerHeight,
      svgBottom: svg.getBoundingClientRect().bottom + window.scrollY,
      svgH: svg.getBoundingClientRect().height,
      scH: sc.getBoundingClientRect().height,
      footerTop: footer.getBoundingClientRect().top + window.scrollY
    };
  });
  check("holistic at 1280: the window can scroll the page", r.overflow !== "hidden" && r.doc > r.view + 80, JSON.stringify(r));
  check("holistic at 1280: the graph is taller than the old leftover pane", r.scH + 1 >= r.svgH && r.svgBottom <= r.doc + 2 && r.footerTop + 2 >= r.svgBottom, JSON.stringify(r));
  const before = await page.evaluate(() => window.scrollY);
  const hero = await page.evaluate(() => {
    const b = document.querySelector(".page-hero").getBoundingClientRect();
    return { x: Math.round(b.left + 40), y: Math.round(b.top + 20) };
  });
  await page.mouse.move(hero.x, hero.y);
  await page.mouse.wheel({ deltaY: 500 });
  await sleep(200);
  const after = await page.evaluate(() => window.scrollY);
  check("holistic at 1280: the wheel scrolls the window", after > before + 40, JSON.stringify({ before, after, hero }));
  await page.close();
}

async function desktop(browser, mode, overlay) {
  const label = mode + (overlay ? " overlay" : " page") + " at 1280";
  const page = await open(browser, 1280, 800, mode);
  if (overlay) { await page.click("#expand-graph"); await sleep(300); }
  const before = await page.evaluate(measure);
  await page.evaluate(() => {
    const nodes = Array.prototype.slice.call(document.querySelectorAll("#graph .node"));
    nodes.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    nodes[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await sleep(600);
  const during = await page.evaluate(() => {
    const sc = document.getElementById("graph-scroll");
    const side = document.getElementById("side").getBoundingClientRect();
    const sel = document.querySelector("#graph .node[data-id]");
    const picked = Array.prototype.find.call(document.querySelectorAll("#graph .node"), (n) => n.getAttribute("data-id") === window.TM_UI.state.selected);
    const nb = picked.getBoundingClientRect();
    const sb = sc.getBoundingClientRect();
    sc.scrollLeft = sc.scrollWidth;
    const content = document.getElementById("graph").getBoundingClientRect();
    const canvas = document.querySelector("#graph svg, #graph .scoped-canvas");
    const cb = canvas.getBoundingClientRect();
    return { sideLeft: side.left, scrollRight: sb.right, scrollLeft: sb.left, nodeLeft: nb.left, nodeRight: nb.right, nodeTop: nb.top, nodeBottom: nb.bottom, scrollTop: sb.top, scrollBottom: sb.bottom, canvasRight: cb.right, open: document.getElementById("main").classList.contains("drawer-open") };
  });
  check(label + ": drawer opens", during.open, "");
  check(label + ": graph area ends at the drawer's left edge", during.scrollRight <= during.sideLeft + 1, JSON.stringify({ scrollRight: during.scrollRight, sideLeft: during.sideLeft }));
  check(label + ": selected box is not under the drawer", during.nodeRight <= during.sideLeft + 1, JSON.stringify({ nodeRight: during.nodeRight, sideLeft: during.sideLeft }));
  check(label + ": graph can scroll to its right edge beside the drawer", during.canvasRight <= during.sideLeft + 1, JSON.stringify({ canvasRight: during.canvasRight, sideLeft: during.sideLeft }));
  await page.keyboard.press("Escape");
  await sleep(500);
  const after = await page.evaluate(measure);
  check(label + ": full width returns when the drawer closes", Math.abs(after.scroll.width - before.scroll.width) < 2 && !after.open, JSON.stringify({ before: before.scroll.width, after: after.scroll.width }));
  await page.close();
}

async function phone(browser, mode) {
  const page = await open(browser, 375, 800, mode);
  await page.evaluate(() => document.querySelector("#graph .node").dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await sleep(500);
  const r = await page.evaluate(() => {
    const sc = document.getElementById("graph-scroll");
    const side = document.getElementById("side").getBoundingClientRect();
    return { pad: parseFloat(getComputedStyle(sc).paddingBottom), sideH: side.height, sx: document.documentElement.scrollWidth };
  });
  check(mode + " at 375: the graph can scroll above the bottom sheet", r.pad >= r.sideH - 2, JSON.stringify(r));
  check(mode + " at 375: no sideways scroll", r.sx <= 375, JSON.stringify(r));
  await page.close();
}

async function launchBrowser() {
  const args = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await puppeteer.launch({ executablePath: chrome, args, timeout: 45000 });
    } catch (err) {
      lastErr = err;
      console.log("Chrome launch attempt " + attempt + " failed: " + (err && err.message));
    }
  }
  throw lastErr;
}

(async () => {
  console.log("Chrome: " + chrome);
  const browser = await launchBrowser();
  try {
    await pageScrolls(browser);
    for (const mode of ["holistic", "L2", "L5"]) {
      await desktop(browser, mode, false);
      await desktop(browser, mode, true);
      await phone(browser, mode);
    }
  } finally { await browser.close(); }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
