/* Red Team Scoping Tool
 * Applies the CoSAI AI SRF accountability overlay to an AI red team engagement:
 * resolves testable / authorization-required / out-of-scope layers by operating
 * model, pre-assigns finding ownership, and exports a signable scoping record.
 * No backend, no tracking; all state lives in localStorage. */
(function () {
  "use strict";

  var STORE_KEY = "srf-redteam-scope-v1";

  // Friendly labels for the framework's per-layer/operating-model default value.
  var TIER = {
    "customer-owned": { key: "testable", label: "Testable directly" },
    "shared": { key: "coordinate", label: "Authorization required" },
    "model-evaluation": { key: "coordinate", label: "Authorization required" },
    "N/A": { key: "out-of-scope", label: "Out of scope" }
  };

  var OWNER_TYPES = [
    { key: "customer", label: "Target org" },
    { key: "provider", label: "Provider" },
    { key: "other", label: "Other" },
    { key: "na", label: "Not tested" }
  ];

  var DATA = { layers: null, models: null, threats: null };
  var state = null;

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function defaultState() {
    return {
      system: "", org: "", vendor: "", testers: "", model: "AI-SaaS", vertical: "",
      autonomy: "", window: "",
      layers: {}, // id -> { ownerType, otherName, authRef }
      evidenceNotes: "", gaps: "",
      decision: "Approved", date: todayISO(), approver: "", review: ""
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
  function layerTier(layer) {
    return TIER[layerDefault(layer)] || TIER["N/A"];
  }

  /* Suggested owner type from the scope tier, used as the starting point. */
  function suggestedOwnerType(def) {
    if (def === "customer-owned") return "customer";
    if (def === "N/A") return "na";
    return "other"; // shared / model-evaluation force an explicit choice
  }

  function resolveOwner(id) {
    var ls = state.layers[id] || {};
    if (ls.ownerType === "customer") return state.org || "(target org not named)";
    if (ls.ownerType === "provider") return state.vendor || "(provider not named)";
    if (ls.ownerType === "na") return "Not tested";
    if (ls.ownerType === "other") return ls.otherName || "(not named)";
    return "(not assigned)";
  }

  /* A tested layer is unresolved if it has no single named finding owner. */
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

  /* Authorization-required and out-of-scope layers should carry a reference to
     what was actually granted, otherwise the tool is scoping on assumption. */
  function authMissing(layer, tierKey) {
    if (tierKey === "testable") return false;
    var ls = state.layers[layer.id] || {};
    if (ls.ownerType === "na") return false;
    return !(ls.authRef && ls.authRef.trim());
  }

  function relevantThreats(layerId) {
    if (!DATA.threats) return [];
    return DATA.threats.filter(function (t) {
      return (t.affected_layers || []).indexOf(layerId) !== -1;
    });
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
      state.layers[id] = { ownerType: suggestedOwnerType(layerDefault(layer)), otherName: "", authRef: "" };
    }
  }

  function renderLayers() {
    var wrap = $("#layers");
    wrap.innerHTML = "";
    DATA.layers.forEach(function (layer) {
      ensureLayerState(layer);
      var id = layer.id;
      var ls = state.layers[id];
      var tier = layerTier(layer);

      var card = el("div", "layer-card");
      card.style.setProperty("--accent", "var(" + (layer.color_var || "--cosai-blue") + ")");

      var head = el("div", "layer-card__head");
      var tag = el("span", "layer-card__tag", id);
      var name = el("span", "layer-card__name", layer.name);
      var badge = el("span", "layer-card__default badge-" + tier.key, tier.label);
      head.appendChild(tag);
      head.appendChild(name);
      head.appendChild(badge);
      card.appendChild(head);

      // owner-type segmented control
      var seg = el("div", "seg", null);
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", id + " finding owner");
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
        inp.placeholder = "Name the single finding owner";
        inp.value = ls.otherName || "";
        inp.addEventListener("input", function () { ls.otherName = inp.value; save(); renderRecord(); });
        f.appendChild(inp);
        card.appendChild(f);
      }

      if (tier.key !== "testable" && ls.ownerType !== "na") {
        var af = el("div", "field field--tight");
        var authInp = el("input", "field__input field__input--sm");
        authInp.type = "text";
        authInp.maxLength = 300;
        authInp.placeholder = "Authorization reference (contract clause, written approval, ticket)";
        authInp.value = ls.authRef || "";
        authInp.addEventListener("input", function () { ls.authRef = authInp.value; save(); renderLayers(); renderRecord(); });
        af.appendChild(authInp);
        card.appendChild(af);
        if (authMissing(layer, tier.key)) {
          card.appendChild(el("p", "layer-card__warn", "No authorization reference on file. Do not test this layer until one exists."));
        }
      }

      if (layerUnresolved(layer)) {
        card.appendChild(el("p", "layer-card__warn", "Unresolved: name one finding owner."));
      }

      var threats = relevantThreats(id);
      if (threats.length) {
        var tblock = el("div", "layer-card__threats");
        tblock.appendChild(el("span", "layer-card__threats-label", "From the crosswalk: "));
        threats.slice(0, 4).forEach(function (t) {
          tblock.appendChild(el("span", "threat-chip", t.name));
        });
        if (threats.length > 4) tblock.appendChild(el("span", "threat-chip threat-chip--more", "+" + (threats.length - 4) + " more"));
        card.appendChild(tblock);
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

    r.appendChild(el("div", "rec-eyebrow", "AI Red Team Scoping Record"));
    r.appendChild(el("h2", "rec-title", state.system || "Untitled engagement"));

    var meta = el("div", "rec-meta");
    var m = DATA.models.filter(function (x) { return x.id === state.model; })[0];
    meta.appendChild(metaRow("Target org", state.org));
    meta.appendChild(metaRow("Testing party", state.testers));
    meta.appendChild(metaRow("Provider", state.vendor));
    meta.appendChild(metaRow("Operating model", m ? m.name : state.model));
    if (state.vertical) meta.appendChild(metaRow("Industry", verticalLabel(state.vertical)));
    if (state.autonomy) meta.appendChild(metaRow("Autonomy", state.autonomy));
    if (state.window) meta.appendChild(metaRow("Window", state.window));
    r.appendChild(meta);

    // layer table
    var unresolved = 0, missingAuth = 0;
    var table = el("div", "rec-table");
    var thead = el("div", "rec-row rec-row--head");
    thead.appendChild(el("span", "rec-cell rec-cell--layer", "Layer / tier"));
    thead.appendChild(el("span", "rec-cell rec-cell--owner", "Finding owner"));
    table.appendChild(thead);

    DATA.layers.forEach(function (layer) {
      var tier = layerTier(layer);
      var row = el("div", "rec-row");
      var lcell = el("span", "rec-cell rec-cell--layer");
      lcell.appendChild(el("strong", null, layer.id));
      lcell.appendChild(document.createTextNode(" " + layer.short));
      lcell.appendChild(el("small", "rec-cell__sup", tier.label));
      row.appendChild(lcell);

      var owner = resolveOwner(layer.id);
      var ocell = el("span", "rec-cell rec-cell--owner", owner);
      if (layerUnresolved(layer)) { ocell.classList.add("is-unresolved"); unresolved++; }
      if (authMissing(layer, tier.key)) missingAuth++;
      var ls = state.layers[layer.id] || {};
      if (ls.authRef) { var s = el("small", "rec-cell__sup", "auth: " + ls.authRef); ocell.appendChild(s); }
      row.appendChild(ocell);
      table.appendChild(row);
    });
    r.appendChild(table);

    if (state.gaps) {
      var g = el("div", "rec-block");
      g.appendChild(el("div", "rec-block__h", "Rules of engagement / exclusions"));
      g.appendChild(el("p", "rec-block__p", state.gaps));
      r.appendChild(g);
    }

    if (state.evidenceNotes) {
      var ev = el("div", "rec-block");
      ev.appendChild(el("div", "rec-block__h", "Evidence handling notes"));
      ev.appendChild(el("p", "rec-block__p", state.evidenceNotes));
      r.appendChild(ev);
    }

    var dec = el("div", "rec-decision rec-decision--" + state.decision.replace(/[^a-z]/gi, "").toLowerCase());
    dec.appendChild(el("span", "rec-decision__label", "Authorization status"));
    dec.appendChild(el("span", "rec-decision__value", state.decision));
    r.appendChild(dec);

    var sign = el("div", "rec-meta");
    sign.appendChild(metaRow("Authorizer", state.approver));
    sign.appendChild(metaRow("Date", state.date));
    if (state.review) sign.appendChild(metaRow("Re-scope by", state.review));
    r.appendChild(sign);

    var problems = unresolved + missingAuth;
    var banner = el("div", "rec-valid " + (problems ? "rec-valid--bad" : "rec-valid--ok"));
    banner.textContent = problems
      ? unresolved + " layer" + (unresolved === 1 ? "" : "s") + " with no named finding owner, " +
        missingAuth + " with no authorization reference. Do not begin testing until both are resolved."
      : "Every layer has a named finding owner and, where required, an authorization reference on file.";
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
    bindField("f-testers", "testers");
    bindField("f-model", "model", function () { renderModelDesc(); renderLayers(); });
    bindField("f-vertical", "vertical");
    bindField("f-autonomy", "autonomy");
    bindField("f-window", "window");
    bindField("f-evidence-notes", "evidenceNotes");
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
      } catch (e) { alert("That file is not a valid Red Team Scoping Record JSON export."); }
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
    var s = (state.system || "redteam-scope").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "srf-redteam-scope-" + (s || "untitled");
  }

  /* ---------- PDF ---------- */
  function exportPDF() {
    var jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDF) { alert("PDF library did not load. Reload the page and try again."); return; }
    var doc = new jsPDF({ unit: "pt", format: "letter" });
    var M = 54, W = doc.internal.pageSize.getWidth(), y = M;
    var navy = [15, 31, 61], slate = [71, 85, 105];

    function text(s, x, yy, opt) { doc.text(s == null ? "" : String(s), x, yy, opt); }
    function setF(size, style, color) {
      doc.setFontSize(size);
      doc.setFont("helvetica", style || "normal");
      doc.setTextColor.apply(doc, color || navy);
    }

    setF(8, "bold", slate);
    text("AI RED TEAM SCOPING RECORD", M, y); y += 18;
    setF(18, "bold", navy);
    var titleLines = doc.splitTextToSize(state.system || "Untitled engagement", W - M * 2);
    text(titleLines, M, y); y += titleLines.length * 20 + 4;

    var m = DATA.models.filter(function (x) { return x.id === state.model; })[0];
    var metaPairs = [
      ["Target org", state.org], ["Testing party", state.testers || "—"], ["Provider", state.vendor || "—"],
      ["Operating model", m ? m.name : state.model],
      ["Industry", state.vertical ? verticalLabel(state.vertical) : "General"]
    ];
    if (state.autonomy) metaPairs.push(["Autonomy", state.autonomy]);
    if (state.window) metaPairs.push(["Window", state.window]);
    setF(9, "normal", slate);
    metaPairs.forEach(function (p) {
      setF(9, "bold", slate); text(p[0] + ":", M, y);
      setF(9, "normal", navy); text(p[1] || "—", M + 96, y);
      y += 14;
    });
    y += 8;

    // layer table
    doc.setDrawColor(203, 213, 225);
    setF(8, "bold", slate);
    text("LAYER / TIER", M, y); text("FINDING OWNER", M + 200, y); y += 6;
    doc.line(M, y, W - M, y); y += 14;
    DATA.layers.forEach(function (layer) {
      var tier = layerTier(layer);
      setF(10, "bold", navy); text(layer.id, M, y);
      setF(9, "normal", slate); text(layer.short + " — " + tier.label, M + 24, y);
      var owner = resolveOwner(layer.id);
      var unresolved = layerUnresolved(layer);
      setF(10, unresolved ? "bolditalic" : "normal", unresolved ? [185, 28, 28] : navy);
      var ol = doc.splitTextToSize(owner, W - M - (M + 200));
      text(ol, M + 200, y);
      var ls = state.layers[layer.id] || {};
      var rows = ol.length;
      if (ls.authRef) {
        setF(8, "italic", slate);
        var al = doc.splitTextToSize("auth: " + ls.authRef, W - M - (M + 200));
        text(al, M + 200, y + rows * 12);
        rows += al.length;
      }
      y += Math.max(16, rows * 12 + 4);
      doc.setDrawColor(235, 238, 243); doc.line(M, y - 8, W - M, y - 8);
    });
    y += 6;

    if (state.gaps) {
      setF(8, "bold", slate); text("RULES OF ENGAGEMENT / EXCLUSIONS", M, y); y += 14;
      setF(10, "normal", navy);
      var gl = doc.splitTextToSize(state.gaps, W - M * 2);
      text(gl, M, y); y += gl.length * 13 + 8;
    }

    if (state.evidenceNotes) {
      setF(8, "bold", slate); text("EVIDENCE HANDLING NOTES", M, y); y += 14;
      setF(10, "normal", navy);
      var el2 = doc.splitTextToSize(state.evidenceNotes, W - M * 2);
      text(el2, M, y); y += el2.length * 13 + 8;
    }

    // decision strip
    var decColors = { approved: [21, 128, 61], approvedwithconditions: [161, 98, 7], deferred: [161, 98, 7], rejected: [185, 28, 28] };
    var dc = decColors[state.decision.replace(/[^a-z]/gi, "").toLowerCase()] || navy;
    doc.setFillColor.apply(doc, dc);
    doc.rect(M, y, W - M * 2, 26, "F");
    setF(11, "bold", [255, 255, 255]);
    text("AUTHORIZATION:  " + state.decision.toUpperCase(), M + 12, y + 17);
    y += 42;

    setF(9, "bold", slate); text("Authorizer:", M, y);
    setF(9, "normal", navy); text(state.approver || "________________________", M + 70, y);
    setF(9, "bold", slate); text("Date:", M + 300, y);
    setF(9, "normal", navy); text(state.date || "__________", M + 332, y);
    y += 16;
    if (state.review) {
      setF(9, "bold", slate); text("Re-scope by:", M, y);
      setF(9, "normal", navy); text(state.review, M + 76, y); y += 16;
    }

    // footer
    var fy = doc.internal.pageSize.getHeight() - 36;
    setF(7.5, "normal", slate);
    var foot = doc.splitTextToSize(
      "Generated " + new Date().toLocaleString() + " via aisharedresponsibility.com. Applies the CoSAI AI Shared Responsibility Framework accountability overlay to engagement scoping; methodology from the OWASP GenAI Red Teaming Guide and NIST AI 100-2. Governance artifact, not legal advice.",
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
      if (!confirm("Clear this scoping record and start over?")) return;
      state = defaultState();
      save();
      rerenderAll();
    });
  }

  function boot() {
    Promise.all([
      fetch("/data/layers.json").then(function (r) { return r.json(); }),
      fetch("/data/matrix.json").then(function (r) { return r.json(); }),
      fetch("/data/threats.json").then(function (r) { return r.json(); }).catch(function () { return { threats: [] }; })
    ]).then(function (res) {
      DATA.layers = res[0].layers;
      DATA.models = res[1].models;
      DATA.threats = res[2].threats || [];
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
