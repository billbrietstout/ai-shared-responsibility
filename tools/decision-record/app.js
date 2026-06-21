/* Accountability Decision Record
 * Applies the CoSAI AI SRF rule of one accountable party per layer to a single
 * deployment, then exports a signable one-page record. No backend, no tracking;
 * all state lives in localStorage. */
(function () {
  "use strict";

  var STORE_KEY = "srf-decision-record-v1";

  // Friendly labels for the framework's per-layer/operating-model default value.
  var DEFAULT_LABEL = {
    "customer-owned": "Customer-owned",
    "shared": "Shared — must be resolved",
    "model-evaluation": "Provider-built, customer-evaluated",
    "N/A": "Not in scope for this model"
  };

  var OWNER_TYPES = [
    { key: "customer", label: "Customer" },
    { key: "provider", label: "Provider" },
    { key: "other", label: "Other" },
    { key: "na", label: "Out of scope" }
  ];

  var DATA = { layers: null, models: null };
  var state = null;

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s) { return (s == null ? "" : String(s)); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function defaultState() {
    return {
      system: "", org: "", vendor: "", model: "AI-SaaS", vertical: "",
      autonomy: "", override: "",
      layers: {}, // id -> { ownerType, otherName, supporting }
      gaps: "", decision: "Approved", date: todayISO(), approver: "", review: ""
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return defaultState();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* The framework default for a layer under the selected operating model. */
  function layerDefault(layer) {
    var v = (layer.operating_models || {})[state.model];
    return v || "N/A";
  }

  /* Suggested owner type from the framework default, used as the starting point. */
  function suggestedOwnerType(def) {
    if (def === "customer-owned") return "customer";
    if (def === "N/A") return "na";
    return "other"; // shared / model-evaluation force an explicit choice
  }

  /* Resolve a layer's accountable party to a display name. */
  function resolveOwner(id) {
    var ls = state.layers[id] || {};
    if (ls.ownerType === "customer") return state.org || "(customer not named)";
    if (ls.ownerType === "provider") return state.vendor || "(provider not named)";
    if (ls.ownerType === "na") return "Out of scope";
    if (ls.ownerType === "other") return ls.otherName || "(not named)";
    return "(not assigned)";
  }

  /* A layer is unresolved if it is in scope but has no single named owner. */
  function layerUnresolved(layer) {
    var id = layer.id;
    var ls = state.layers[id] || {};
    if (ls.ownerType === "na") return false;
    if (!ls.ownerType) return true;
    if (ls.ownerType === "customer") return !state.org;
    if (ls.ownerType === "provider") return !state.vendor;
    if (ls.ownerType === "other") return !(ls.otherName && ls.otherName.trim());
    return true;
  }

  /* ---------- build form ---------- */
  function buildModelSelect() {
    var sel = $("#f-model");
    sel.innerHTML = "";
    DATA.models.forEach(function (m) {
      var o = el("option");
      o.value = m.id;
      o.textContent = m.name + " (" + m.short + ")";
      sel.appendChild(o);
    });
    sel.value = state.model;
  }

  function renderModelDesc() {
    var m = DATA.models.filter(function (x) { return x.id === state.model; })[0];
    $("#model-desc").textContent = m ? m.description : "";
  }

  function ensureLayerState(layer) {
    var id = layer.id;
    if (!state.layers[id]) {
      state.layers[id] = { ownerType: suggestedOwnerType(layerDefault(layer)), otherName: "", supporting: "" };
    }
  }

  function renderLayers() {
    var wrap = $("#layers");
    wrap.innerHTML = "";
    DATA.layers.forEach(function (layer) {
      ensureLayerState(layer);
      var id = layer.id;
      var ls = state.layers[id];
      var def = layerDefault(layer);

      var card = el("div", "layer-card");
      card.style.setProperty("--accent", "var(" + (layer.color_var || "--cosai-blue") + ")");

      var head = el("div", "layer-card__head");
      var tag = el("span", "layer-card__tag", id);
      var name = el("span", "layer-card__name", layer.name);
      var badge = el("span", "layer-card__default badge-" + def.replace(/[^a-z]/gi, "").toLowerCase(), DEFAULT_LABEL[def] || def);
      head.appendChild(tag);
      head.appendChild(name);
      head.appendChild(badge);
      card.appendChild(head);

      // owner-type segmented control
      var seg = el("div", "seg", null);
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", id + " accountable party");
      OWNER_TYPES.forEach(function (ot) {
        var b = el("button", "seg__btn" + (ls.ownerType === ot.key ? " is-active" : ""), ot.label);
        b.type = "button";
        b.addEventListener("click", function () {
          ls.ownerType = ot.key;
          save();
          renderLayers();
          renderRecord();
        });
        seg.appendChild(b);
      });
      card.appendChild(seg);

      if (ls.ownerType === "other") {
        var f = el("div", "field field--tight");
        var inp = el("input", "field__input");
        inp.type = "text";
        inp.maxLength = 200;
        inp.placeholder = "Name the single accountable party";
        inp.value = ls.otherName || "";
        inp.addEventListener("input", function () { ls.otherName = inp.value; save(); renderRecord(); });
        f.appendChild(inp);
        card.appendChild(f);
      }

      var sup = el("div", "field field--tight");
      var supInp = el("input", "field__input field__input--sm");
      supInp.type = "text";
      supInp.maxLength = 300;
      supInp.placeholder = "Supporting / consulted parties (optional)";
      supInp.value = ls.supporting || "";
      supInp.addEventListener("input", function () { ls.supporting = supInp.value; save(); renderRecord(); });
      sup.appendChild(supInp);
      card.appendChild(sup);

      if (layerUnresolved(layer)) {
        card.appendChild(el("p", "layer-card__warn", "Unresolved: name one accountable party."));
      }

      wrap.appendChild(card);
    });
  }

  /* ---------- live record ---------- */
  function metaRow(label, value) {
    var r = el("div", "rec-meta__row");
    r.appendChild(el("span", "rec-meta__k", label));
    r.appendChild(el("span", "rec-meta__v", value || "—"));
    return r;
  }

  function renderRecord() {
    var r = $("#record");
    r.innerHTML = "";

    r.appendChild(el("div", "rec-eyebrow", "AI Accountability Decision Record"));
    r.appendChild(el("h2", "rec-title", state.system || "Untitled deployment"));

    var meta = el("div", "rec-meta");
    var m = DATA.models.filter(function (x) { return x.id === state.model; })[0];
    meta.appendChild(metaRow("Accountable org", state.org));
    meta.appendChild(metaRow("Provider", state.vendor));
    meta.appendChild(metaRow("Operating model", m ? m.name : state.model));
    if (state.vertical) meta.appendChild(metaRow("Industry", verticalLabel(state.vertical)));
    if (state.autonomy) meta.appendChild(metaRow("Autonomy", state.autonomy));
    if (state.override) meta.appendChild(metaRow("Override tier", state.override));
    r.appendChild(meta);

    // layer table
    var unresolved = 0;
    var table = el("div", "rec-table");
    var thead = el("div", "rec-row rec-row--head");
    thead.appendChild(el("span", "rec-cell rec-cell--layer", "Layer"));
    thead.appendChild(el("span", "rec-cell rec-cell--owner", "Accountable party"));
    table.appendChild(thead);

    DATA.layers.forEach(function (layer) {
      var row = el("div", "rec-row");
      var lcell = el("span", "rec-cell rec-cell--layer");
      lcell.appendChild(el("strong", null, layer.id));
      lcell.appendChild(document.createTextNode(" " + layer.short));
      row.appendChild(lcell);

      var owner = resolveOwner(layer.id);
      var ocell = el("span", "rec-cell rec-cell--owner", owner);
      if (layerUnresolved(layer)) { ocell.classList.add("is-unresolved"); unresolved++; }
      var sup = (state.layers[layer.id] || {}).supporting;
      if (sup) { var s = el("small", "rec-cell__sup", "supporting: " + sup); ocell.appendChild(s); }
      row.appendChild(ocell);
      table.appendChild(row);
    });
    r.appendChild(table);

    if (state.gaps) {
      var g = el("div", "rec-block");
      g.appendChild(el("div", "rec-block__h", "Open gaps / accepted residual risk"));
      g.appendChild(el("p", "rec-block__p", state.gaps));
      r.appendChild(g);
    }

    var dec = el("div", "rec-decision rec-decision--" + state.decision.replace(/[^a-z]/gi, "").toLowerCase());
    dec.appendChild(el("span", "rec-decision__label", "Decision"));
    dec.appendChild(el("span", "rec-decision__value", state.decision));
    r.appendChild(dec);

    var sign = el("div", "rec-meta");
    sign.appendChild(metaRow("Approver", state.approver));
    sign.appendChild(metaRow("Date", state.date));
    if (state.review) sign.appendChild(metaRow("Next review", state.review));
    r.appendChild(sign);

    var banner = el("div", "rec-valid " + (unresolved ? "rec-valid--bad" : "rec-valid--ok"));
    banner.textContent = unresolved
      ? unresolved + " layer" + (unresolved > 1 ? "s" : "") + " still unresolved. Shared is not a valid final answer."
      : "Every in-scope layer has one named accountable party.";
    r.appendChild(banner);

    r.appendChild(el("div", "rec-gen", "Generated " + new Date().toLocaleString() + " · aisharedresponsibility.com"));
  }

  function verticalLabel(v) {
    var map = { finance: "Financial services", healthcare: "Healthcare", insurance: "Insurance",
      "public-sector": "Public sector", defense: "Defense / DoD", manufacturing: "Manufacturing" };
    return map[v] || v;
  }

  /* ---------- field wiring ---------- */
  function bindField(id, key, after) {
    var node = $("#" + id);
    if (!node) return;
    node.value = state[key] || "";
    var evt = (node.tagName === "SELECT") ? "change" : "input";
    node.addEventListener(evt, function () {
      state[key] = node.value;
      save();
      if (after) after();
      renderRecord();
    });
  }

  function wireFields() {
    bindField("f-system", "system");
    bindField("f-org", "org", renderLayers);
    bindField("f-vendor", "vendor", renderLayers);
    bindField("f-model", "model", function () { renderModelDesc(); renderLayers(); });
    bindField("f-vertical", "vertical");
    bindField("f-autonomy", "autonomy");
    bindField("f-override", "override");
    bindField("f-gaps", "gaps");
    bindField("f-decision", "decision");
    bindField("f-date", "date");
    bindField("f-approver", "approver");
    bindField("f-review", "review");
    if (!state.date) { state.date = todayISO(); $("#f-date").value = state.date; }
  }

  /* ---------- export / import ---------- */
  function exportJSON() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    downloadBlob(blob, fileSlug() + ".json");
  }
  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        state = Object.assign(defaultState(), JSON.parse(reader.result));
        save();
        rerenderAll();
      } catch (e) { alert("That file is not a valid Decision Record JSON export."); }
    };
    reader.readAsText(file);
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = el("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function fileSlug() {
    var s = (state.system || "decision-record").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "srf-decision-record-" + (s || "untitled");
  }

  /* ---------- PDF ---------- */
  function exportPDF() {
    var jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDF) { alert("PDF library did not load. Reload the page and try again."); return; }
    var doc = new jsPDF({ unit: "pt", format: "letter" });
    var M = 54, W = doc.internal.pageSize.getWidth(), y = M;
    var navy = [15, 31, 61], slate = [71, 85, 105], line = [203, 213, 225];

    function text(s, x, yy, opt) { doc.text(s == null ? "" : String(s), x, yy, opt); }
    function setF(size, style, color) {
      doc.setFontSize(size);
      doc.setFont("helvetica", style || "normal");
      doc.setTextColor.apply(doc, color || navy);
    }

    setF(8, "bold", slate);
    text("AI ACCOUNTABILITY DECISION RECORD", M, y); y += 18;
    setF(18, "bold", navy);
    var titleLines = doc.splitTextToSize(state.system || "Untitled deployment", W - M * 2);
    text(titleLines, M, y); y += titleLines.length * 20 + 4;

    var m = DATA.models.filter(function (x) { return x.id === state.model; })[0];
    var metaPairs = [
      ["Accountable org", state.org], ["Provider", state.vendor || "—"],
      ["Operating model", m ? m.name : state.model],
      ["Industry", state.vertical ? verticalLabel(state.vertical) : "General"]
    ];
    if (state.autonomy) metaPairs.push(["Autonomy", state.autonomy]);
    if (state.override) metaPairs.push(["Override tier", state.override]);
    setF(9, "normal", slate);
    metaPairs.forEach(function (p) {
      setF(9, "bold", slate); text(p[0] + ":", M, y);
      setF(9, "normal", navy); text(p[1] || "—", M + 96, y);
      y += 14;
    });
    y += 8;

    // layer table
    doc.setDrawColor.apply(doc, line);
    setF(8, "bold", slate);
    text("LAYER", M, y); text("ACCOUNTABLE PARTY", M + 150, y); y += 6;
    doc.line(M, y, W - M, y); y += 14;
    DATA.layers.forEach(function (layer) {
      setF(10, "bold", navy); text(layer.id, M, y);
      setF(9, "normal", slate); text(layer.short, M + 24, y);
      var owner = resolveOwner(layer.id);
      setF(10, layerUnresolved(layer) ? "bolditalic" : "normal", layerUnresolved(layer) ? [185, 28, 28] : navy);
      var ol = doc.splitTextToSize(owner, W - M - (M + 150));
      text(ol, M + 150, y);
      var sup = (state.layers[layer.id] || {}).supporting;
      var rows = ol.length;
      if (sup) {
        setF(8, "italic", slate);
        var sl = doc.splitTextToSize("supporting: " + sup, W - M - (M + 150));
        text(sl, M + 150, y + rows * 12);
        rows += sl.length;
      }
      y += Math.max(16, rows * 12 + 4);
      doc.setDrawColor(235, 238, 243); doc.line(M, y - 8, W - M, y - 8);
    });
    y += 6;

    if (state.gaps) {
      setF(8, "bold", slate); text("OPEN GAPS / ACCEPTED RESIDUAL RISK", M, y); y += 14;
      setF(10, "normal", navy);
      var gl = doc.splitTextToSize(state.gaps, W - M * 2);
      text(gl, M, y); y += gl.length * 13 + 8;
    }

    // decision strip
    var decColors = { approved: [21, 128, 61], approvedwithconditions: [161, 98, 7], deferred: [161, 98, 7], rejected: [185, 28, 28] };
    var dc = decColors[state.decision.replace(/[^a-z]/gi, "").toLowerCase()] || navy;
    doc.setFillColor.apply(doc, dc);
    doc.rect(M, y, W - M * 2, 26, "F");
    setF(11, "bold", [255, 255, 255]);
    text("DECISION:  " + state.decision.toUpperCase(), M + 12, y + 17);
    y += 42;

    setF(9, "bold", slate); text("Approver:", M, y);
    setF(9, "normal", navy); text(state.approver || "________________________", M + 64, y);
    setF(9, "bold", slate); text("Date:", M + 300, y);
    setF(9, "normal", navy); text(state.date || "__________", M + 332, y);
    y += 16;
    if (state.review) {
      setF(9, "bold", slate); text("Next review:", M, y);
      setF(9, "normal", navy); text(state.review, M + 70, y); y += 16;
    }

    // footer
    var fy = doc.internal.pageSize.getHeight() - 36;
    setF(7.5, "normal", slate);
    var foot = doc.splitTextToSize(
      "Generated " + new Date().toLocaleString() + " via aisharedresponsibility.com. Applies the CoSAI AI Shared Responsibility Framework rule of one accountable party per activity. Governance artifact, not legal advice; does not by itself transfer liability.",
      W - M * 2);
    text(foot, M, fy);

    doc.save(fileSlug() + ".pdf");
  }

  /* ---------- lifecycle ---------- */
  function rerenderAll() {
    buildModelSelect();
    wireFields();
    renderModelDesc();
    renderLayers();
    renderRecord();
  }

  function wireButtons() {
    $("#btn-export").addEventListener("click", exportJSON);
    $("#btn-pdf").addEventListener("click", exportPDF);
    $("#btn-import").addEventListener("click", function () { $("#file-import").click(); });
    $("#file-import").addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = "";
    });
    $("#btn-reset").addEventListener("click", function () {
      if (!confirm("Clear this Decision Record and start over?")) return;
      state = defaultState();
      save();
      rerenderAll();
    });
  }

  function boot() {
    Promise.all([
      fetch("/data/layers.json").then(function (r) { return r.json(); }),
      fetch("/data/matrix.json").then(function (r) { return r.json(); })
    ]).then(function (res) {
      DATA.layers = res[0].layers;
      DATA.models = res[1].models;
      state = load();
      rerenderAll();
      wireButtons();
    }).catch(function () {
      $("#boot-error").hidden = false;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
