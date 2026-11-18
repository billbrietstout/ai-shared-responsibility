#!/usr/bin/env node
/* Tests for shared/pdf-text.js, the PDF text cleanup used by the Security
   Controls, Controls Assessment and Regulation Discovery wizards.
   Run: node scripts/test_pdf_text.js */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const P = require(path.join(__dirname, "..", "shared", "pdf-text.js"));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failed++; console.log("FAIL " + name + ": " + e.message); }
}

check("maps arrows, dashes, comparisons, quotes and ellipsis to ASCII", () => {
  assert.strictEqual(P.safe("a \u2192 b \u2190 c \u2194 d \u21D2 e"), "a -> b <- c <-> d => e");
  assert.strictEqual(P.safe("x \u2013 y \u2014 z"), "x - y - z");
  assert.strictEqual(P.safe("\u2265 90 and \u2264 24, \u2260 0"), ">= 90 and <= 24, != 0");
  assert.strictEqual(P.safe("\u201Cq\u201D \u2018s\u2019 wait\u2026"), "\"q\" 's' wait...");
});

check("keeps characters the Helvetica font prints", () => {
  const keep = "\u00B7 \u00A7 \u00E9 \u00F6 \u00F1 \u00A3 \u00B0 \u00D7 \u00A9 \u20AC \u2122 \u2022";
  assert.strictEqual(P.safe(keep), keep);
});

check("keeps colons", () => {
  assert.strictEqual(P.safe("ISO/IEC 42001:2023. Deployment: EU"), "ISO/IEC 42001:2023. Deployment: EU");
});

check("strips marks the font lacks and drops emoji instead of printing ?", () => {
  assert.strictEqual(P.safe("Dub\u0107ek Bra\u0219ov"), "Dubcek Brasov");
  assert.strictEqual(P.safe("\u2705 ok \u26A0\uFE0F warn \u274C no \uD83D\uDE00"), "+ ok ! warn x no ");
  assert.ok(P.safe("\u03B1\u3042").indexOf("?") === -1);
});

check("handles null and numbers", () => {
  assert.strictEqual(P.safe(null), "");
  assert.strictEqual(P.safe(42), "42");
});

// Every string in each wizard's data.json must come through with no dropped
// character, so a new symbol in the data gets an explicit mapping.
function strings(o, out) {
  if (typeof o === "string") out.push(o);
  else if (Array.isArray(o)) o.forEach((v) => strings(v, out));
  else if (o && typeof o === "object") Object.keys(o).forEach((k) => strings(o[k], out));
  return out;
}
function unmapped(s) {
  return Array.from(s).filter((ch) => !(ch in P.MAP) && !P.printable(ch));
}
["security-controls", "controls-assessment", "regulation-discovery"].forEach((tool) => {
  check(tool + " data.json has no character the cleanup would drop", () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tools", tool, "data.json"), "utf8"));
    const bad = new Set();
    strings(data, []).forEach((s) => unmapped(s).forEach((ch) => bad.add(ch + " U+" + ch.codePointAt(0).toString(16).toUpperCase())));
    assert.deepStrictEqual([...bad], []);
  });
  check(tool + " wizard.js uses the shared cleanup", () => {
    const js = fs.readFileSync(path.join(__dirname, "..", "tools", tool, "wizard.js"), "utf8");
    const html = fs.readFileSync(path.join(__dirname, "..", "tools", tool, "index.html"), "utf8");
    assert.ok(/window\.CoSAIPdfText\.safe\(str\)/.test(js), "pdfSafe does not call the shared routine");
    assert.ok(!/\[\^\\x00-\\x7F\]/.test(js), "old ASCII-only replacement is still present");
    assert.ok(html.indexOf('src="/shared/pdf-text.js"') < html.indexOf('src="wizard.js"'), "pdf-text.js must load before wizard.js");
  });
});

console.log(failed ? failed + " failed" : "All tests passed");
process.exit(failed ? 1 : 0);
