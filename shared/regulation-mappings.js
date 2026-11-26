/**
 * Readable, linked regulatory mapping citations for vertical control pages.
 * Loads mapping_key → { short, url } from /data/regulations.json and pinpoint
 * rules from /data/regulation-pinpoints.json once.
 */
(function (global) {
  const LOCAL_LABELS = {
    anti_capture_principle: "Anti-capture principle",
    layers_split: "Layer assignment (federated consortium)",
    tap_adr: "Tapestry ADR",
    work_group_charter: "Work group charter",
  };

  const MULTI_CITE_KEYS = new Set([
    "eu_ai_act",
    "finos_aigf",
    "sr26_2",
    "aicm",
    "m_25_21",
    "m_25_22",
    "fedramp_20x_ksi",
    "naic_model_bulletin",
    "naic_eval_tool",
    "co_reg_10_1_1",
    "nydfs_cl7",
    "owasp_llm",
    "dod_rai_strategy",
    "dodi_5000_90",
    "dodi_5000_89",
    "cc_srg",
    "cmmc_2_0",
    "nist_ai_rmf",
    "hipaa",
  ]);

  let regByKey = null;
  let pinpointByKey = null;
  let anchorAllow = null;
  let loadPromise = null;

  function ecfrHipaaSectionUrl(citation, inst) {
    const m = String(citation || "").match(/(?:45\s*CFR\s*)?§\s*164\.(\d{3})\b/i);
    if (!m) return null;
    const section = m[1];
    const allow = inst.verified_sections;
    if (allow && !allow.includes(section)) return null;
    return "https://www.ecfr.gov/current/title-45/section-164." + section;
  }

  function eurlexAnchor(citation) {
    const cite = String(citation || "").trim();
    let m = cite.match(/^Article\s+(\d+)/i);
    if (m) return "art_" + m[1];
    m = cite.match(/^Annex\s+([IVXLC]+)/i);
    if (m) return "anx_" + m[1].toUpperCase();
    return null;
  }

  function splitCitations(key, value) {
    const v = String(value || "").trim();
    if (!v) return [];
    if (MULTI_CITE_KEYS.has(key) && v.includes("; ")) {
      return v.split("; ").map((p) => p.trim()).filter(Boolean);
    }
    return [v];
  }

  function documentUrl(key) {
    const hit = regByKey && regByKey[key];
    return (hit && hit.url) || "";
  }

  function citationPinpointUrl(key, citation) {
    const inst = (pinpointByKey && pinpointByKey[key]) || {};
    const doc = documentUrl(key);
    const resolver = inst.resolver || "document_only";
    if (resolver === "iso_catalog" || resolver === "document_only") return doc;
    if (resolver === "eurlex") {
      const base = (inst.html_base || doc).replace(/#$/, "");
      const anchor = eurlexAnchor(citation);
      if (!anchor) return doc;
      const allow = anchorAllow && anchorAllow[key];
      if (allow && !allow.has(anchor)) return doc;
      return base + "#" + anchor;
    }
    if (resolver === "ecfr") {
      const url = ecfrHipaaSectionUrl(citation, inst);
      return url || doc;
    }
    return doc;
  }

  function mappingPinpointUrl(key, value) {
    const cites = splitCitations(key, value);
    if (!cites.length) return documentUrl(key);
    const doc = documentUrl(key);
    for (let i = 0; i < cites.length; i++) {
      const url = citationPinpointUrl(key, cites[i]);
      if (url && url !== doc) return url;
    }
    return citationPinpointUrl(key, cites[0]);
  }

  function loadRegulations() {
    if (regByKey && pinpointByKey) return Promise.resolve(regByKey);
    if (loadPromise) return loadPromise;
    loadPromise = Promise.all([
      fetch("/data/regulations.json").then((r) => r.json()),
      fetch("/data/regulation-pinpoints.json").then((r) => r.json()),
    ])
      .then(([regData, pinData]) => {
        regByKey = {};
        (regData.items || []).forEach((item) => {
          if (item.mapping_key) {
            regByKey[item.mapping_key] = {
              short: item.short || item.name,
              url: item.url || "",
            };
          }
        });
        pinpointByKey = (pinData && pinData.instruments) || {};
        anchorAllow = {};
        Object.keys(pinpointByKey).forEach((key) => {
          const inst = pinpointByKey[key];
          if (inst.verified_anchors) {
            anchorAllow[key] = new Set(inst.verified_anchors);
          }
        });
        return regByKey;
      })
      .catch(() => {
        regByKey = regByKey || {};
        pinpointByKey = pinpointByKey || {};
        return regByKey;
      });
    return loadPromise;
  }

  function instrumentLabel(key) {
    const hit = regByKey && regByKey[key];
    if (hit) return hit.short;
    return LOCAL_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function isPlaceholder(value) {
    const v = String(value || "").trim();
    return v === "" || v === "N/A" || v.startsWith("TBD");
  }

  function omitFromReader(value) {
    return String(value || "").trim() === "N/A";
  }

  function isMappingPending(value) {
    const v = String(value || "").trim();
    if (!v || v === "N/A") return false;
    if (/^TBD\b/i.test(v)) return true;
    if (/Do not substitute/i.test(v)) return true;
    if (/^TODO\b/i.test(v)) return true;
    if (/verify against source documents/i.test(v)) return true;
    return false;
  }

  function formatPlain(key, value) {
    const label = instrumentLabel(key);
    const v = String(value || "").trim();
    if (isPlaceholder(v)) return `${label}: ${v}`;
    return `${label}, ${v}`;
  }

  function readerMappingText(key, value) {
    const label = instrumentLabel(key);
    const v = String(value || "").trim();
    if (isMappingPending(v)) {
      return `${label} (mapping pending)`;
    }
    return formatPlain(key, value);
  }

  function readerEntries(mappings) {
    if (!mappings) return [];
    const skip = new Set(["mapping_status_note"]);
    return Object.entries(mappings).filter(([k, v]) => {
      if (skip.has(k) || v == null || String(v).trim() === "") return false;
      if (omitFromReader(v)) return false;
      return true;
    });
  }

  function citationSegments(key, value) {
    const v = String(value || "").trim();
    if (isMappingPending(v)) {
      return [{ text: readerMappingText(key, value), url: documentUrl(key), pending: true }];
    }
    if (isPlaceholder(v)) {
      const label = instrumentLabel(key);
      return [{ text: `${label}: ${v}`, url: "", pending: false }];
    }
    return splitCitations(key, v).map((cite) => {
      const text = `${instrumentLabel(key)}, ${cite}`;
      const url = citationPinpointUrl(key, cite);
      return { text, url, pending: false };
    });
  }

  function renderMappingTags(mappings, escHtml) {
    return readerEntries(mappings)
      .flatMap(([k, v]) =>
        citationSegments(k, v).map((seg) => {
          const linkable = seg.url && (seg.pending || !isPlaceholder(v));
          if (linkable) {
            return (
              `<a class="mapping-tag mapping-tag--linked" href="${escHtml(seg.url)}" ` +
              `target="_blank" rel="noopener">${escHtml(seg.text)}</a>`
            );
          }
          return `<span class="mapping-tag">${escHtml(seg.text)}</span>`;
        })
      )
      .join("");
  }

  function renderMappingRows(mappings, escHtml) {
    return readerEntries(mappings)
      .map(([k, v]) => {
        const segs = citationSegments(k, v);
        const valueHtml = segs
          .map((seg) => {
            const linkable = seg.url && (seg.pending || !isPlaceholder(v));
            if (linkable) {
              return (
                `<a class="mapping-tag mapping-tag--linked" href="${escHtml(seg.url)}" ` +
                `target="_blank" rel="noopener">${escHtml(seg.text)}</a>`
              );
            }
            return escHtml(seg.text);
          })
          .join("; ");
        return `<div class="detail-field">
          <div class="detail-field__label">Regulation</div>
          <div class="detail-field__value">${valueHtml}</div>
        </div>`;
      })
      .join("");
  }

  global.RegulationMappings = {
    load: loadRegulations,
    renderMappingTags,
    renderMappingRows,
    formatPlain,
    mappingPinpointUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);