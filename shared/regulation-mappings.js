/**
 * Readable, linked regulatory mapping citations for vertical control pages.
 * Loads mapping_key → { short, url } from /data/regulations.json once.
 */
(function (global) {
  const LOCAL_LABELS = {
    anti_capture_principle: "Anti-capture principle",
    layers_split: "Layers split",
    tap_adr: "Tapestry ADR",
    work_group_charter: "Work group charter",
  };

  let regByKey = null;
  let loadPromise = null;

  function loadRegulations() {
    if (regByKey) return Promise.resolve(regByKey);
    if (loadPromise) return loadPromise;
    loadPromise = fetch("/data/regulations.json")
      .then((r) => r.json())
      .then((data) => {
        regByKey = {};
        (data.items || []).forEach((item) => {
          if (item.mapping_key) {
            regByKey[item.mapping_key] = {
              short: item.short || item.name,
              url: item.url || "",
            };
          }
        });
        return regByKey;
      })
      .catch(() => {
        regByKey = {};
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

  function formatPlain(key, value) {
    const label = instrumentLabel(key);
    const v = String(value || "").trim();
    if (isPlaceholder(v)) return `${label}: ${v}`;
    return `${label}, ${v}`;
  }

  function renderMappingTags(mappings, escHtml) {
    if (!mappings) return "";
    const skip = new Set(["mapping_status_note"]);
    return Object.entries(mappings)
      .filter(([k, v]) => !skip.has(k) && v != null && v !== "")
      .map(([k, v]) => {
        const text = formatPlain(k, v);
        const url = regByKey && regByKey[k] && regByKey[k].url;
        if (url && !isPlaceholder(v)) {
          return (
            `<a class="mapping-tag mapping-tag--linked" href="${escHtml(url)}" ` +
            `target="_blank" rel="noopener">${escHtml(text)}</a>`
          );
        }
        return `<span class="mapping-tag">${escHtml(text)}</span>`;
      })
      .join("");
  }

  function renderMappingRows(mappings, escHtml) {
    if (!mappings) return "";
    const skip = new Set(["mapping_status_note"]);
    return Object.entries(mappings)
      .filter(([k, v]) => !skip.has(k) && v != null && String(v).trim() !== "")
      .map(([k, v]) => {
        const text = formatPlain(k, v);
        const url = regByKey && regByKey[k] && regByKey[k].url;
        const valueHtml =
          url && !isPlaceholder(v)
            ? `<a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(text)}</a>`
            : escHtml(text);
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
  };
})(typeof window !== "undefined" ? window : globalThis);