#!/usr/bin/env node
/**
 * link-resolver.mjs
 *
 * Build-time semantic linking pass. Replaces the FIRST occurrence of each
 * glossary term on a page with a link to its canonical glossary anchor, so
 * concepts are machine-addressable without hand-authored hyperlinks.
 *
 * Source of truth for terms: /glossary.json (regenerate it with
 * build/generate_knowledge_layer.py before running this).
 *
 * SAFETY: dry-run by default. It NEVER writes unless you pass --apply.
 *   - Skips text inside <head>, <script>, <style>, <svg>, <a>, <code>, <pre>,
 *     and inside any HTML tag, so it cannot break existing markup or links.
 *   - Links each term at most once per page (first occurrence only).
 *   - Skips the glossary page itself and pages already linking the term.
 *   - Generic single-word terms are denylisted to avoid noise.
 *
 * Usage:
 *   node build/link-resolver.mjs                       # dry run, whole site
 *   node build/link-resolver.mjs framework/index.html  # dry run, one file
 *   node build/link-resolver.mjs --apply               # write changes
 *   node build/link-resolver.mjs --max 3 --apply       # cap links per page
 *
 * Exit code is non-zero only on error, so it is CI-friendly.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const MAX = (() => {
  const i = args.indexOf("--max");
  return i >= 0 ? parseInt(args[i + 1], 10) : Infinity;
})();
const explicitFiles = args.filter(a => !a.startsWith("--") && a !== String(MAX));

// Terms we never auto-link: too generic, would create noise.
const DENY = new Set([
  "layer", "persona", "control", "accountability", "operating-model", "raci",
]);

// ── Load terms from the generated registry ───────────────────────────────────
const registryPath = path.join(ROOT, "glossary.json");
if (!fs.existsSync(registryPath)) {
  console.error("Missing glossary.json. Run build/generate_knowledge_layer.py first.");
  process.exit(1);
}
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const TERMS = registry.terms
  .filter(t => !DENY.has(t.anchor))
  .map(t => {
    // Code-style anchors (L1, AI-SaaS) match case-sensitively; phrases do not.
    const isCode = /^(L[1-5]|AI-[A-Za-z]+|Agent-PaaS|IaaS)$/.test(t.anchor);
    // Use the bare term name without the "L1: " code prefix for phrase matches.
    const surface = t.term.replace(/^L[1-5]:\s*/, "").replace(/\s+/g, " ").trim();
    const phrase = isCode ? t.anchor : surface;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
      anchor: t.anchor,
      url: `/glossary/#${t.anchor}`,
      phrase,
      len: phrase.length,
      re: new RegExp(`\\b${escaped}\\b`, isCode ? "" : "i"),
    };
  })
  // longest first so "Human Override Tier" wins over "Override"
  .sort((a, b) => b.len - a.len);

// ── Protected-context aware text walk ────────────────────────────────────────
const PROTECTED = new Set(["head", "script", "style", "svg", "a", "code", "pre"]);

function transform(htmlText) {
  const out = [];
  const stack = [];
  const used = new Set();
  let linkCount = 0;
  let i = 0;

  const protectedNow = () => stack.some(tag => PROTECTED.has(tag));

  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?>|<!--[\s\S]*?-->/g;
  let m;
  let last = 0;
  while ((m = tagRe.exec(htmlText)) !== null) {
    const textSeg = htmlText.slice(last, m.index);
    out.push(processText(textSeg));
    out.push(m[0]);

    if (!m[0].startsWith("<!--")) {
      const tag = m[1].toLowerCase();
      const isClose = m[0].startsWith("</");
      const selfClose = m[0].endsWith("/>") ||
        ["meta", "link", "br", "hr", "img", "input", "source"].includes(tag);
      if (isClose) {
        const idx = stack.lastIndexOf(tag);
        if (idx >= 0) stack.length = idx;
      } else if (!selfClose) {
        stack.push(tag);
      }
    }
    last = tagRe.lastIndex;
  }
  out.push(processText(htmlText.slice(last)));

  function processText(seg) {
    if (!seg || protectedNow() || linkCount >= MAX) return seg;
    for (const t of TERMS) {
      if (used.has(t.anchor)) continue;
      const mt = t.re.exec(seg);
      if (mt) {
        used.add(t.anchor);
        linkCount++;
        const before = seg.slice(0, mt.index);
        const word = mt[0];
        const after = seg.slice(mt.index + word.length);
        return before +
          `<a href="${t.url}" class="srf-term" data-concept="${t.anchor}">${word}</a>` +
          after;
        // one replacement per text node keeps the walk simple and safe
      }
    }
    return seg;
  }

  return { html: out.join(""), linkCount, terms: [...used] };
}

// ── File selection ───────────────────────────────────────────────────────────
function walkHtml(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".") || name === "build" || name === "node_modules") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkHtml(full, acc);
    else if (name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

const files = (explicitFiles.length
  ? explicitFiles.map(f => path.resolve(ROOT, f))
  : walkHtml(ROOT, []))
  .filter(f => !f.includes(`${path.sep}glossary${path.sep}`)); // never touch glossary

// ── Run ──────────────────────────────────────────────────────────────────────
let totalLinks = 0, changedFiles = 0;
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const { html, linkCount, terms } = transform(src);
  if (linkCount === 0 || html === src) continue;
  changedFiles++;
  totalLinks += linkCount;
  const rel = path.relative(ROOT, file);
  console.log(`${APPLY ? "LINKED " : "WOULD LINK "}${rel}: ${linkCount} (${terms.join(", ")})`);
  if (APPLY) fs.writeFileSync(file, html);
}

console.log(`\n${APPLY ? "Applied" : "Dry run"}: ${totalLinks} links across ${changedFiles} files.`);
if (!APPLY) console.log("Re-run with --apply to write changes. Review a git diff before committing.");
