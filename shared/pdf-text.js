/* Text cleanup for jsPDF exports that use the built-in Helvetica font.

   That font writes text in the Windows-1252 character set. A character
   outside that set comes out wrong in the PDF (an arrow prints as "!'",
   and the old cleanup printed "?"). This routine keeps every character
   the font can print, such as the middle dot (·), the section sign (§),
   accented Latin letters, and the bullet (•). It turns the rest into a
   plain ASCII equivalent:

     → ->    ← <-    ↔ <->    ⇒ =>    ≤ <=    ≥ >=    ≠ !=    ≈ ~
     – and — become -    curly quotes become straight quotes    … becomes ...

   Letters with marks that the font lacks (ć, ă, ş) lose the mark (c, a, s).
   A character with no fair equivalent is dropped rather than printed as "?".
   Used by the Security Controls, Controls Assessment and Regulation
   Discovery wizards. Exposed as window.CoSAIPdfText.safe(text). */
(function (root) {
  "use strict";

  var MAP = {
    "\u2192": "->", "\u2190": "<-", "\u2194": "<->", "\u21D2": "=>", "\u21D0": "<=",
    "\u2264": "<=", "\u2265": ">=", "\u2260": "!=", "\u2248": "~",
    "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-", "\u2015": "-", "\u2212": "-",
    "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'", "\u2032": "'",
    "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"', "\u2033": '"',
    "\u2026": "...",
    "\u00A0": " ", "\u2002": " ", "\u2003": " ", "\u2009": " ", "\u202F": " ",
    "\u200B": "", "\u200C": "", "\u200D": "", "\u2060": "", "\uFEFF": "", "\uFE0F": "", "\uFE0E": "",
    "\u2705": "+", "\u2713": "+", "\u2714": "+",
    "\u274C": "x", "\u2717": "x", "\u2718": "x",
    "\u26A0": "!"
  };

  // Characters above U+00FF that the font prints (Windows-1252, 0x80 to 0x9F).
  var EXTRA = "\u20AC\u0192\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u02DC\u2122\u0161\u203A\u0153\u017E\u0178\u2022";

  function printable(ch) {
    var code = ch.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13) return true;
    if (code >= 0x20 && code <= 0x7E) return true;
    if (code >= 0xA1 && code <= 0xFF) return true;
    return EXTRA.indexOf(ch) !== -1;
  }

  function one(ch) {
    if (Object.prototype.hasOwnProperty.call(MAP, ch)) return MAP[ch];
    if (printable(ch)) return ch;
    var base = ch.normalize ? ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "") : "";
    var out = "";
    for (var i = 0; i < base.length; i++) {
      var c = base.charAt(i);
      if (Object.prototype.hasOwnProperty.call(MAP, c)) out += MAP[c];
      else if (printable(c)) out += c;
    }
    return out;
  }

  function safe(text) {
    var s = String(text == null ? "" : text);
    var out = "";
    // Array.from walks code points, so an emoji is one unit, not two halves.
    var chars = Array.from(s);
    for (var i = 0; i < chars.length; i++) out += chars[i].length > 1 ? "" : one(chars[i]);
    return out;
  }

  var api = { safe: safe, printable: printable, MAP: MAP };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CoSAIPdfText = api;
})(typeof window !== "undefined" ? window : null);
