#!/usr/bin/env node
"use strict";
/** /sources/ must not scroll horizontally at 375px viewport (regression for long titles). */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUPPETEER = path.join(ROOT, "tools/relationship-map/tests/node_modules/puppeteer-core");
const puppeteer = require(PUPPETEER);

const CHROME = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/local/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean).find((p) => fs.existsSync(p));

if (!CHROME) {
  console.error("FAIL sources overflow test needs Chrome (set CHROME_PATH).");
  process.exit(1);
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(ROOT, p.endsWith("/") ? p + "index.html" : p);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("not found");
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function overflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
  }));
}

async function main() {
  const server = await serve();
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  let failed = 0;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 });
    await page.goto(base + "/sources/", { waitUntil: "networkidle0", timeout: 30000 });
    let m = await overflow(page);
    if (m.scrollWidth > m.clientWidth + 1) {
      console.error(
        "FAIL /sources/ horizontal overflow at top:",
        "scrollWidth=" + m.scrollWidth,
        "clientWidth=" + m.clientWidth
      );
      failed += 1;
    } else {
      console.log(
        "ok   /sources/ no horizontal overflow at top (scrollWidth=" +
          m.scrollWidth +
          ")"
      );
    }
    await page.evaluate(() => {
      const el =
        document.getElementById("src-5") ||
        document.getElementById("src-12") ||
        document.querySelector('a[href*="n221p.pdf"]');
      if (el) el.scrollIntoView({ block: "center" });
    });
    await new Promise((r) => setTimeout(r, 300));
    m = await overflow(page);
    if (m.scrollWidth > m.clientWidth + 1) {
      console.error(
        "FAIL /sources/ horizontal overflow at long-title anchors:",
        "scrollWidth=" + m.scrollWidth,
        "clientWidth=" + m.clientWidth
      );
      failed += 1;
    } else {
      console.log(
        "ok   /sources/ no horizontal overflow at long titles (scrollWidth=" +
          m.scrollWidth +
          ")"
      );
    }
    const out = process.env.SOURCES_OVERFLOW_SCREENSHOT;
    if (out) {
      await page.screenshot({ path: out, fullPage: false });
      console.log("wrote " + out);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? failed + " failed" : "all checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});