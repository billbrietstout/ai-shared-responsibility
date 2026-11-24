/* Relationship map
 * Reads site JSON at runtime and draws only links those files already name.
 * ROCA is Risk, Obligation, Control, Accountable. It is not a RACI chart.
 *
 * A sector model name is not rewritten on the control. data/sector-model-map.json
 * says which of the four SRF v1.0 models that name joins. The chain uses that
 * mapping, and the sector name stays on the control as context.
 *
 * Node kinds and files:
 *   layer    data/layers.json                         layers[]
 *   persona  data/personas.json                       personas[] and sector_specializations[]
 *   model    data/matrix.json                         cosai-core models, plus proposed-extension
 *                                                     models drawn only while Tapestry is on
 *   risk     data/threats.json                        threats[] (the Risk records)
 *   control  data/<vertical>-controls.json            controls[]
 *   policy   tools/policy-pyramid/data.json           levels[]
 *   topic    data/ai-agentic-principles.json          sections{}
 *
 * The chain view also reads:
 *   data/moral-regulatory-hierarchy.json   requirements[] (article-level obligations)
 *   data/regulations.json                  source_kind, used for the instrument fallback
 *   data/sector-model-map.json             sector name to SRF model
 *   controls[].accountable_by_model        one persona per SRF model
 *   threats[].obligations[]                basis and source for the risk-to-obligation link
 *
 * Edge types and the field that produces them:
 *   persona-layer   personas[].srf_layers and sector_specializations[].srf_layers
 *   specializes     sector_specializations[].specializes
 *   model-layer     layers[].operating_models[<cosai-core model id>]
 *   control-layer   controls[].layer
 *   control-persona controls[].accountable_persona
 *   control-model   controls[].operating_models[] when the id is a matrix model,
 *                   or the SRF model named for a sector model in the sector map
 *   control-policy  controls[].policy_level or controls[].policy, when the value
 *                   matches a policy level (no control has this field today)
 *   risk-control    threats[].related_controls (solid). Also a longer dash when
 *                   citationsForControl matches a requirement in
 *                   threats[].obligations[]. One pair is one line, and the
 *                   direct line wins.
 *
 * Chain provenance is drawn on the four-column board:
 *   risk to obligation     threats[].obligations[] (dashed when the basis is
 *                          derived_via_control or editorial)
 *   obligation to control  the source control on that link, or a citation match
 *                          (solid). A current-obligation citation with no article
 *                          match is dotted and marked Instrument-level.
 *   risk to control        solid from related_controls. A longer dash when the
 *                          control only reaches the risk through a requirement
 *                          it cites.
 *   control to persona     controls[].accountable_by_model for the chosen model
 *
 * The page opens on the four-column ROCA chain. Each column menu lists every
 * item of that kind. Choosing one shows the linked items in the other columns.
 * A card click focuses that card. It does not change the column menus.
 * Older links use ?mode=risk|obligation|control|accountable, ?explore=, or
 * ?anchor=. They open this same chain with that item selected. ?view=full and
 * ?view=full&node= do the same when the query names a risk, control, persona,
 * or node that can build a chain, and the empty chain otherwise.
 * ?tapestry=1 and the Show Tapestry checkbox include proposed-extension
 * controls and personas in the column menus, the ROCA chain, and the layer
 * view. Each of those records is marked "Proposed AI Alliance extension, not
 * SRF v1.0". With the box off, those records stay out of the SRF chain and
 * out of the SRF missing-mapping count.
 *
 * A control is Tapestry when its file or record provenance is proposed-extension,
 * or when every operating model it names is a proposed-extension model.
 * A persona is Tapestry when its provenance is proposed-extension.
 * Operating-model strings that are not matrix models and are not in the sector
 * map are not drawn.
 */
(function () {
  "use strict";

  var KIND_ORDER = ["layer", "persona", "model", "risk", "control", "policy", "topic"];
  var KIND_LABEL = {
    layer: "Layer",
    persona: "Persona",
    model: "Operating model",
    risk: "Risk",
    control: "Control",
    policy: "Policy level",
    topic: "Whitepaper topic"
  };
  var MODEL_ORDER = ["AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS"];
  var MODEL_SLUG = { "AI-SaaS": "ai-saas", "AI-PaaS": "ai-paas", "Agent-PaaS": "agent-paas", "IaaS": "iaas" };
  var LAYER_FRAME = {
    L1: "Business and usage security. Business processes, acceptable use, authority, human oversight.",
    L2: "Information and data security. Data protection, privacy, provenance, poisoning, exfiltration.",
    L3: "AI application security. Agent identity, authorization, tool access, prompt injection, runtime behavior.",
    L4: "AI platform security. Inference, orchestration, infrastructure, isolation, telemetry.",
    L5: "AI model and supply-chain security. Model integrity, provenance, vulnerabilities, third-party dependencies."
  };
  var CORE_PERSONAS = [
    "ai-system-users",
    "ai-system-governance",
    "data-provider",
    "application-developer",
    "agentic-platform-provider",
    "ai-platform-provider",
    "ai-model-serving",
    "model-provider"
  ];
  var LAYERS = ["L1", "L2", "L3", "L4", "L5"];
  var VERTICAL_RANK = {
    common: -1,
    finance: 0,
    insurance: 1,
    "public-sector": 2,
    defense: 3,
    manufacturing: 4,
    healthcare: 5,
    tapestry: 6
  };
  var CONTROL_FILES = [
    ["common", "All sectors (common)", "/data/common-controls.json"],
    ["finance", "Finance", "/data/finance-controls.json"],
    ["healthcare", "Healthcare", "/data/healthcare-controls.json"],
    ["insurance", "Insurance", "/data/insurance-controls.json"],
    ["public-sector", "Public sector", "/data/public-sector-controls.json"],
    ["defense", "Defense", "/data/defense-controls.json"],
    ["manufacturing", "Manufacturing", "/data/manufacturing-controls.json"],
    ["tapestry", "Tapestry", "/data/tapestry-controls.json"]
  ];
  var COMMON_SECTOR = CONTROL_FILES[0][1];
  var controlAliases = {};

  function controlPageUrl(vertical, ref) {
    if (vertical === "common") return "/data/common-controls.json";
    return "/" + vertical + "/controls/#" + ref;
  }

  var GAP_NOTE = "This control isn't in any operating model filter yet.";
  var EXTENSION_BADGE = "Proposed AI Alliance extension, not SRF v1.0";

  var chainEmpty = document.getElementById("chain-empty");
  var chainWorkspaceHeading = document.getElementById("chain-workspace-heading");
  var chainWrap = document.querySelector(".chain-wrap");
  var chainEl = document.getElementById("chain");
  var chainBoard = document.getElementById("chain-board");
  var chainModelNote = document.getElementById("chain-model-note");
  var statusEl = document.getElementById("map-status");
  var errorEl = document.getElementById("map-error");
  var errorBox = document.getElementById("map-error-box");
  var retryBtn = document.getElementById("map-retry");
  var loadingEl = document.getElementById("map-loading");
  var copyBtn = document.getElementById("copy-chain");
  var csvDownloadBtn = document.getElementById("download-chain-csv");
  var copyStatus = document.getElementById("copy-status");
  var copyFallback = document.getElementById("copy-fallback");
  var copyTimer = 0;
  var lastCopyKey = "";
  var findForm = document.getElementById("find-form");
  var findLabel = document.querySelector("label[for='node-search']");
  var searchInput = document.getElementById("node-search");
  var searchResults = document.getElementById("search-results");
  var searchNote = document.getElementById("search-note");
  var modelList = document.getElementById("model-filter-list");
  var modelNote = document.getElementById("model-info-text");
  var scopeSummaryEl = document.getElementById("scope-summary");
  var scopeCountsEl = document.getElementById("scope-counts");
  var activePillsEl = document.getElementById("active-filter-pills");
  var clearFiltersBtn = document.getElementById("clear-filters");
  var layerList = document.getElementById("layer-filter-list");
  var tapestryInput = document.getElementById("show-tapestry");
  var contextBtn = document.getElementById("show-context");
  var contextBoard = document.getElementById("context-board");
  var detailsHeading = document.getElementById("details-heading");
  var detailsEmpty = document.getElementById("details-empty");
  var detailsBody = document.getElementById("details-body");
  var detailsKind = document.getElementById("details-kind");
  var detailsMeta = document.getElementById("details-meta");
  var detailsModelNote = document.getElementById("details-model-note");
  var detailsList = document.getElementById("details-connections");
  var detailsChain = document.getElementById("details-chain");
  var connectionsHeading = document.getElementById("connections-heading");
  var clearChainBtn = document.getElementById("clear-chain-selection");
  var layerFrames = document.getElementById("layer-frames");
  var mapPage = document.querySelector(".map-page");
  var chainHeading = document.getElementById("chain-heading");
  var jumpChain = document.getElementById("jump-chain");
  var showAllBtn = document.getElementById("show-all-results");
  var showAllMatches = false;
  var chainWorkspace = document.getElementById("chain-workspace");
  var mapPanel = document.querySelector(".map-panel");
  var summaryEl = document.getElementById("filter-summary");
  var coverageMode = new URLSearchParams(location.search).get("page") === "coverage";
  var restoringHistory = false;
  var openColumn = "risk";
  var expandedColumns = {};
  var COLUMN_LIMIT = 8;
  var activeIndex = -1;
  var listClosed = false;
  var narrowQuery = window.matchMedia("(max-width: 800px)");
  var SHEET_INERT = ["site-nav", ".page-hero", ".map-jump", ".map-preview", ".map-stage", ".coverage", "site-footer", ".skip-link"];
  var wordMatch = null;
  var detailsEl = document.querySelector(".details");
  var detailsId = document.getElementById("details-id");
  var detailsSlot = document.getElementById("chain-details-slot");
  if (!copyStatus && detailsEl) {
    copyStatus = document.createElement("p");
    copyStatus.id = "copy-status";
    copyStatus.className = "copy-status";
    copyStatus.setAttribute("role", "status");
    var detailsActions = detailsEl.querySelector(".details__actions");
    if (detailsActions) detailsActions.insertAdjacentElement("afterend", copyStatus);
    else detailsEl.appendChild(copyStatus);
  }
  /* Node details announcements and copy feedback share one status region. */

  var graph = null;
  var respLabel = {};
  var coreIds = {};
  var modelShort = { all: "All" };
  var stats = {
    controls: 0,
    srfControls: 0,
    sectorOnly: 0,
    noModels: 0,
    tapestryControls: 0,
    tapestryPersonas: 0,
    mappedFromSector: 0
  };
  var view = "chain";
  var root = null;
  var selected = null;
  var showTapestry = false;
  var selectedModels = [];
  var selectedLayers = [];
  var personaPick = "";
  var reqPick = "";
  var catalog = null;
  var citationCache = {};
  var currentChain = null;
  var chainFocus = "";
  var linkHits = null;
  var linkNote = "";
  var skippedModels = {};
  var missingLinks = [];

  function isAllModels() {
    return selectedModels.length === 0;
  }

  function isAllLayers() {
    return selectedLayers.length === 0;
  }

  function hasModel(modelId) {
    return isAllModels() || selectedModels.indexOf(modelId) !== -1;
  }

  function hasLayer(layerId) {
    return isAllLayers() || selectedLayers.indexOf(layerId) !== -1;
  }

  function activeModelIds() {
    return isAllModels() ? MODEL_ORDER.slice() : selectedModels.slice();
  }

  function modelFilterLabel(allText) {
    if (isAllModels()) return allText || "All models";
    return selectedModels.map(modelName).join(", ");
  }

  function layerFilterLabel(allText) {
    if (isAllLayers()) return allText || "All layers";
    return selectedLayers.join(", ");
  }

  function modelFilterKey() {
    return isAllModels() ? "all" : selectedModels.join(",");
  }

  function layerFilterKey() {
    return isAllLayers() ? "all" : selectedLayers.join(",");
  }

  function hasActiveFilters() {
    return !isAllModels() || !isAllLayers() || showTapestry || !!(searchInput && searchInput.value.trim());
  }

  function showError(message, focusRetry) {
    errorBox.hidden = false;
    errorEl.textContent = message;
    statusEl.textContent = "The map did not finish loading.";
    if (loadingEl) loadingEl.hidden = true;
    var coverageBody = document.getElementById("coverage-body");
    if (coverageBody && coverageBody.getAttribute("aria-busy") === "true") {
      coverageBody.className = "";
      coverageBody.removeAttribute("aria-busy");
      coverageBody.textContent = "";
      coverageBody.appendChild(makeEl("p", "", "Coverage did not load. Use Retry above."));
    }
    if (focusRetry && retryBtn) retryBtn.focus();
  }

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("Could not load " + url + " (" + res.status + ").");
      return res.json();
    });
  }

  function isCoreModel(model) {
    return !!(model && model.provenance === "cosai-core");
  }

  function unit(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }

  function outsideFilter(attrs) {
    return !!(attrs && attrs.kind === "control" && !attrs.tapestry && !(attrs.coreModels && attrs.coreModels.length));
  }

  function addNode(id, attrs) {
    var searchBits = [attrs.name, attrs.label, attrs.ref, attrs.meta, attrs.layer]
      .concat(attrs.coreModels || [])
      .concat(attrs.otherModels || [])
      .concat(attrs.searchExtra || [])
      .filter(Boolean);
    attrs.search = searchBits.join(" ").toLowerCase();
    graph.addNode(id, attrs);
  }

  function link(source, target, attr) {
    if (!graph.hasNode(source) || !graph.hasNode(target)) {
      missingLinks.push(source + " -> " + target);
      return;
    }
    if (graph.hasUndirectedEdge(source, target)) return;
    graph.addUndirectedEdge(source, target, attr);
  }

  function controlIsTapestry(control, fileProvenance, extIds) {
    if (fileProvenance === "proposed-extension" || control.provenance === "proposed-extension") return true;
    var listed = control.operating_models || [];
    if (!listed.length) return false;
    for (var i = 0; i < listed.length; i++) {
      if (!extIds[listed[i]]) return false;
    }
    return true;
  }

  function isTapestryRecord(attrs) {
    return !!(attrs && attrs.tapestry);
  }

  function policyNodeFor(control, policyLookup) {
    var raw = control.policy_level != null ? control.policy_level : control.policy;
    if (raw == null || typeof raw === "object") return "";
    var key = String(raw).trim();
    if (!key) return "";
    return policyLookup[key] || policyLookup[key.toLowerCase()] || "";
  }

  function citationPattern(text) {
    var escaped = String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (text && /[A-Za-z0-9]/.test(String(text).charAt(String(text).length - 1))) escaped += "\\b";
    return new RegExp(escaped, "i");
  }

  function isPlaceholder(value) {
    return typeof value !== "string" || !value.trim() || /^\s*(TBD|N\/?A|None|-)\b/i.test(value);
  }

  function isCurrentObligation(item) {
    if (!item) return false;
    if (Object.prototype.hasOwnProperty.call(item, "current_obligation")) return !!item.current_obligation;
    if (item.source_kind === "catalog") return false;
    if (item.lifecycle === "draft" || item.lifecycle === "rescinded") return false;
    if ((item.tags || []).indexOf("proposed") !== -1) return false;
    return item.source_kind === "binding" || item.source_kind === "voluntary_standard";
  }

  function buildCatalog(data) {
    var next = {
      threats: {},
      reqs: {},
      regsById: {},
      regsByKey: {},
      matchers: {},
      sectorToSrf: {},
      byFull: {},
      personaName: {},
      attacksByThreat: {},
      dsgaiSource: {},
      emptyCrosswalk: []
    };
    ((data.sectorMap && data.sectorMap.mappings) || []).forEach(function (row) {
      if (row && row.sector_model && row.srf_model) next.sectorToSrf[row.sector_model] = row.srf_model;
    });
    ((data.threats && data.threats.threats) || []).forEach(function (threat) {
      if (threat && threat.id) next.threats[threat.id] = threat;
    });
    next.dsgaiSource = (data.threats && data.threats.sources && data.threats.sources.owasp_dsgai) || {};
    ((data.attacks && data.attacks.entries) || []).forEach(function (entry) {
      if (!entry || !entry.id) return;
      var row = {
        id: entry.id,
        name: entry.name || entry.id,
        refs: (entry.taxonomy_refs || []).map(function (ref) {
          return [ref.catalog, ref.id, ref.title_in_catalog].filter(Boolean).join(" ");
        }).filter(Boolean)
      };
      var walk = entry.srf_crosswalk || [];
      if (!walk.length) {
        next.emptyCrosswalk.push(row);
        return;
      }
      walk.forEach(function (threatId) {
        if (!next.attacksByThreat[threatId]) next.attacksByThreat[threatId] = [];
        next.attacksByThreat[threatId].push(row);
      });
    });
    ((data.requirements && data.requirements.requirements) || []).forEach(function (req) {
      if (!req || !req.id) return;
      next.reqs[req.id] = req;
      var pats = (req.citation_match || [req.citation]).filter(Boolean).map(citationPattern);
      if (!next.matchers[req.instrument]) next.matchers[req.instrument] = [];
      next.matchers[req.instrument].push({ pats: pats, req: req });
    });
    ((data.regulations && data.regulations.items) || []).forEach(function (item) {
      if (!item || !item.id) return;
      next.regsById[item.id] = item;
      if (item.mapping_key) next.regsByKey[item.mapping_key] = item;
    });
    next.priorityInstruments = (data.requirements && data.requirements.priority_instruments) || [];
    return next;
  }

  function buildGraph(data) {
    var Graph = window.graphology && window.graphology.UndirectedGraph;
    if (typeof Graph !== "function") throw new Error("Graphology did not load.");
    graph = new Graph();
    citationCache = {};
    skippedModels = {};
    missingLinks = [];
    coreIds = {};
    modelShort = { all: "All" };
    stats = {
      controls: 0,
      srfControls: 0,
      sectorOnly: 0,
      noModels: 0,
      tapestryControls: 0,
      tapestryPersonas: 0,
      mappedFromSector: 0
    };
    catalog = buildCatalog(data);

    var layers = (data.layers && data.layers.layers) || [];
    layers.forEach(function (layer) {
      addNode("layer:" + layer.id, {
        kind: "layer",
        name: layer.id + " " + layer.name,
        // L5 shows its full SRF name, "AI Model Provider". The other layers keep their short labels.
        label: layer.id + " " + (layer.id === "L5" ? layer.name : layer.short),
        ref: layer.id
      });
    });

    var matrixModels = (data.matrix && data.matrix.models) || [];
    var models = matrixModels.filter(isCoreModel);
    var extModels = matrixModels.filter(function (model) {
      return model && model.provenance === "proposed-extension";
    });
    var extIds = {};
    var modelIds = [];
    models.forEach(function (model, i) {
      var id = "model:" + model.id;
      modelIds.push(id);
      coreIds[model.id] = true;
      modelShort[model.id] = model.short || model.id;
      addNode(id, {
        kind: "model",
        name: model.name,
        label: model.short || model.id,
        ref: model.id
      });
    });
    extModels.forEach(function (model, i) {
      extIds[model.id] = true;
      addNode("model:" + model.id, {
        kind: "model",
        name: model.name,
        label: model.short || model.id,
        ref: model.id,
        tapestry: true,
        provenance: "proposed-extension"
      });
    });

    respLabel = {};
    var values = (data.matrix && data.matrix.responsibility_values) || {};
    Object.keys(values).forEach(function (key) {
      respLabel[key] = (values[key] && values[key].label) || key;
    });
    layers.forEach(function (layer) {
      models.forEach(function (model) {
        var value = (layer.operating_models || {})[model.id];
        if (value == null || value === "") return;
        link("model:" + model.id, "layer:" + layer.id, {
          type: "model-layer",
          responsibility: value
        });
      });
    });

    var personas = (data.personas && data.personas.personas) || [];
    personas.forEach(function (persona) {
      var id = "persona:" + persona.id;
      var tapestry = persona.provenance === "proposed-extension";
      if (tapestry) stats.tapestryPersonas += 1;
      catalog.personaName[persona.id] = persona.name;
      addNode(id, {
        kind: "persona",
        name: persona.name,
        label: persona.name,
        ref: persona.id,
        provenance: persona.provenance || "",
        tapestry: tapestry,
        srfLayers: persona.srf_layers || []
      });
      (persona.srf_layers || []).forEach(function (layerId) {
        link(id, "layer:" + layerId, { type: "persona-layer" });
      });
    });

    var specs = (data.personas && data.personas.sector_specializations) || [];
    specs.forEach(function (spec) {
      var id = "persona:" + spec.id;
      catalog.personaName[spec.id] = spec.name;
      addNode(id, {
        kind: "persona",
        name: spec.name,
        label: spec.name,
        ref: spec.id,
        specializes: spec.specializes || "",
        tapestry: spec.provenance === "proposed-extension",
        srfLayers: spec.srf_layers || []
      });
      (spec.srf_layers || []).forEach(function (layerId) {
        link(id, "layer:" + layerId, { type: "persona-layer" });
      });
      if (spec.specializes) {
        link(id, "persona:" + spec.specializes, { type: "specializes", spec: id });
      }
    });

    var policyLookup = {};
    ((data.policy && data.policy.levels) || []).forEach(function (level) {
      var id = "policy:" + level.key;
      addNode(id, {
        kind: "policy",
        name: level.label,
        label: level.label,
        ref: level.key
      });
      policyLookup[level.key] = id;
      if (level.label) policyLookup[String(level.label).toLowerCase()] = id;
    });

    var sections = (data.topics && data.topics.sections) || {};
    Object.keys(sections).forEach(function (key) {
      var section = sections[key];
      if (!section || !section.title) return;
      var id = "topic:" + key;
      addNode(id, {
        kind: "topic",
        name: section.title,
        label: section.title,
        ref: key
      });
    });

    (data.controlFiles || []).forEach(function (file) {
      var controls = (file.json && file.json.controls) || [];
      controls.forEach(function (control) {
        var id = "control:" + file.slug + ":" + control.id;
        var tapestry = controlIsTapestry(control, file.provenance, extIds);
        var coreModels = [];
        var otherModels = [];
        var sectorModels = [];
        var directCore = false;
        var listed = control.operating_models || [];
        stats.controls += 1;
        if (tapestry) stats.tapestryControls += 1;
        listed.forEach(function (modelId) {
          if (!modelId) return;
          if (coreIds[modelId]) {
            directCore = true;
            if (coreModels.indexOf(modelId) === -1) coreModels.push(modelId);
          } else if (extIds[modelId]) {
            return;
          } else if (!tapestry && catalog.sectorToSrf[modelId]) {
            var mapped = catalog.sectorToSrf[modelId];
            sectorModels.push({ name: modelId, srf: mapped });
            otherModels.push(modelId);
            if (coreModels.indexOf(mapped) === -1) coreModels.push(mapped);
          } else if (!extIds[modelId]) {
            skippedModels[modelId] = true;
            otherModels.push(modelId);
          }
        });
        if (coreModels.length) stats.srfControls += 1;
        else if (!tapestry && listed.length) stats.sectorOnly += 1;
        else if (!tapestry) stats.noModels += 1;
        if (!tapestry && !directCore && sectorModels.length) stats.mappedFromSector += 1;
        var fullId = "srf.control." + file.slug + "." + control.id;
        addNode(id, {
          kind: "control",
          name: control.title,
          label: file.short + " " + String(control.id || "").replace(/^SRF-(COM-)?/, ""),
          ref: control.id,
          fullId: fullId,
          meta: file.name,
          vertical: file.slug,
          layer: control.layer || "",
          coreModels: coreModels,
          otherModels: otherModels,
          searchExtra: [control.description],
          description: control.description || "",
          sectorModels: sectorModels,
          accountablePersona: control.accountable_persona || "",
          accountableByModel: control.accountable_by_model || {},
          mappings: control.mappings || {},
          evidenceText: evidenceParts(control).short,
          evidenceDetail: evidenceParts(control).detail,
          crossLayerNote: control.cross_layer_note || "",
          tapestry: tapestry,
          provenance: tapestry ? "proposed-extension" : (control.provenance || "")
        });
        catalog.byFull[fullId] = id;
        (control.former_ids || []).forEach(function (oldId) {
          controlAliases[oldId] = id;
          var tail = String(oldId).replace(/^srf\.control\./, "");
          var dot = tail.indexOf(".");
          if (dot !== -1) {
            controlAliases[tail.slice(0, dot) + ":" + tail.slice(dot + 1)] = id;
            controlAliases[tail.slice(dot + 1)] = id;
          }
        });
        if (control.layer) link(id, "layer:" + control.layer, { type: "control-layer" });
        if (control.accountable_persona) {
          link(id, "persona:" + control.accountable_persona, { type: "control-persona" });
        }
        listed.forEach(function (modelId) {
          if (coreIds[modelId] || extIds[modelId]) {
            link(id, "model:" + modelId, { type: "control-model" });
          }
        });
        sectorModels.forEach(function (row) {
          link(id, "model:" + row.srf, { type: "control-model", viaSector: row.name });
        });
        var policyId = policyNodeFor(control, policyLookup);
        if (policyId) link(id, policyId, { type: "control-policy" });
      });
    });

    var riskIds = Object.keys(catalog.threats);
    riskIds.sort(function (a, b) {
      var an = catalog.threats[a].name || a;
      var bn = catalog.threats[b].name || b;
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
    riskIds.forEach(function (threatId) {
      var threat = catalog.threats[threatId];
      var id = "risk:" + threatId;
      addNode(id, {
        kind: "risk",
        name: threat.name,
        label: threat.name,
        ref: threatId,
        layer: threat.srf_layer || "",
        searchExtra: threatSearchText(threat)
      });
      (threat.related_controls || []).forEach(function (fullId) {
        var controlId = catalog.byFull[fullId];
        if (!controlId) {
          missingLinks.push(id + " -> " + fullId);
          return;
        }
        link(id, controlId, { type: "risk-control" });
      });
    });

    return models.map(function (model) {
      return { id: model.id, name: model.name, short: model.short || model.id };
    });
  }

  function nodeAllowed(attrs) {
    if (!attrs) return false;
    if (attrs.tapestry && !showTapestry) return false;
    if (attrs.kind === "control" && !isAllModels()) {
      if (!attrs.coreModels || !attrs.coreModels.some(function (m) { return selectedModels.indexOf(m) !== -1; })) return false;
    }
    return true;
  }

  /* The layer filter narrows what the finder and suggestion lists offer. It
   * does not remove controls from an open chain, because a threat can name a
   * control in another layer. */
  function layerAllowed(attrs) {
    return !!attrs && hasLayer(attrs.layer);
  }

  function relationPhrase(fromId, attr) {
    var type = attr.type;
    if (type === "persona-layer") {
      return graph.getNodeAttribute(fromId, "kind") === "persona"
        ? "Works at this layer."
        : "Persona at this layer.";
    }
    if (type === "specializes") {
      return fromId === attr.spec
        ? "Specializes this persona."
        : "Has this sector specialization.";
    }
    if (type === "model-layer") {
      return "Responsibility: " + (respLabel[attr.responsibility] || attr.responsibility) + ".";
    }
    if (type === "control-layer") {
      return graph.getNodeAttribute(fromId, "kind") === "control"
        ? "Applies at this layer."
        : "Control at this layer.";
    }
    if (type === "control-persona") {
      return graph.getNodeAttribute(fromId, "kind") === "control"
        ? "Accountable persona."
        : "Accountable for this control.";
    }
    if (type === "control-model") {
      var mapped = attr.viaSector ? " Sector model " + attr.viaSector + " is mapped to this model by data/sector-model-map.json." : "";
      return graph.getNodeAttribute(fromId, "kind") === "control"
        ? "Applies in this operating model." + mapped
        : "Control in this operating model." + mapped;
    }
    if (type === "control-policy") {
      return graph.getNodeAttribute(fromId, "kind") === "control"
        ? "Policy level for this control."
        : "Control at this policy level.";
    }
    if (type === "risk-control") {
      return graph.getNodeAttribute(fromId, "kind") === "risk"
        ? "Control that addresses this risk."
        : "Risk this control addresses.";
    }
    return "Connected in the site data.";
  }

  function personaLabel(id) {
    if (!id) return "";
    return (catalog && catalog.personaName && catalog.personaName[id]) || id;
  }

  function modelName(id) {
    return modelShort[id] || id;
  }

  function controlRecord(fullId) {
    var nodeId = catalog && catalog.byFull[fullId];
    if (!nodeId || !graph.hasNode(nodeId)) return null;
    return { id: nodeId, attrs: graph.getNodeAttributes(nodeId) };
  }

  function controlInChain(attrs) {
    if (!attrs || attrs.kind !== "control") return false;
    if (isTapestryRecord(attrs) && !showTapestry) return false;
    if (isTapestryRecord(attrs)) return isAllModels();
    if (!(attrs.coreModels && attrs.coreModels.length)) return false;
    return true;
  }

  function outsideCurrentFilter(attrs) {
    if (!attrs || attrs.kind !== "control") return false;
    return !nodeAllowed(attrs) || !layerAllowed(attrs);
  }

  function modelsFor(attrs) {
    var models = (attrs.coreModels || []).filter(function (id) { return MODEL_ORDER.indexOf(id) !== -1; });
    models.sort(function (a, b) { return MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b); });
    if (isAllModels()) return models;
    return models.filter(function (id) { return selectedModels.indexOf(id) !== -1; });
  }

  function basisIsDashed(basis) {
    return basis === "derived_via_control" || basis === "named_citation" || basis === "named_cite" ||
      basis === "editorial" || basis === "editorial_mapping" ||
      !(basis === "official_text" || basis === "official_legal_text");
  }

  /* Recorded values come from threats[].obligations[].basis. The chain shows
   * the raw value and a plain-words gloss. It does not add labels of its own. */
  var NO_CONTROL_BASIS = "Mitigates. Listed as a control for this risk in the source record.";
  var BASIS_SHORT = {
    derived_via_control: "derived through a shared control",
    official_text: "official text",
    official_legal_text: "official text",
    editorial: "editorial judgment",
    editorial_mapping: "editorial judgment",
    named_citation: "derived from the cited duty",
    named_cite: "derived from the cited duty"
  };
  var LINK_TYPE_BADGE = {
    solid: "Direct",
    dashed: "Via shared control",
    "long-dashed": "Via cited obligation",
    dotted: "Instrument level"
  };

  var ACCOUNTABILITY_PARTY_LABEL = {
    provider: "provider",
    customer: "accountable"
  };

  var SYMPTOM_ALIASES = {
    leak: ["leakage", "exfiltration", "exfiltrat"],
    leakage: ["leak", "exfiltration", "exfiltrat"],
    exfiltration: ["leak", "leakage", "exfiltrat"],
    inject: ["injection"],
    injection: ["inject"]
  };

  var BASIS_GLOSS = {
    derived_via_control: "The legal text is not the source of this link. It runs through a shared control.",
    official_text: "Taken from the official text.",
    official_legal_text: "Taken from the official text.",
    editorial: "The legal text is not the source of this link.",
    editorial_mapping: "The legal text is not the source of this link.",
    named_citation: "The cited text states a duty. It does not state this harm. The link does not run through a control.",
    named_cite: "The cited text states a duty. It does not state this harm. The link does not run through a control."
  };

  function basisSentence(basis) {
    if (!basis) return "No source citation recorded yet.";
    return (BASIS_GLOSS[basis] || "The source record gives a basis that this page does not describe yet.");
  }

  function basisChip(basis) {
    if (!basis) return "No source citation recorded yet.";
    return "Basis: " + (BASIS_SHORT[basis] || "other") + ".";
  }

  function linkStyleForCard(item, column, chain) {
    if (column === "obligation") {
      if (item.instrumentLevel) return "dotted";
      if (item.style === "dashed") return "dashed";
      return item.style || "solid";
    }
    if (column === "control") {
      if (item.viaObligations && item.viaObligations.length) return "long-dashed";
      return "solid";
    }
    if (column === "risk") {
      if (item.viaObligations && item.viaObligations.length) return "long-dashed";
      var riskId = item.id;
      var dashed = false;
      var cited = false;
      chain.edges.forEach(function (edge) {
        if (edge.from !== riskId && edge.to !== riskId) return;
        if (edge.style === "dashed") dashed = true;
        if (edge.style === "long-dashed") cited = true;
      });
      if (dashed) return "dashed";
      if (cited) return "long-dashed";
      return "solid";
    }
    if (column === "accountable") return "solid";
    return "";
  }

  function layerForCard(item, column) {
    if (column === "risk" || column === "control") return item.layer || "";
    if (column === "obligation") return "";
    if (column === "accountable") {
      var controlId = item.controlId;
      if (controlId && graph && graph.hasNode(controlId)) {
        return graph.getNodeAttribute(controlId, "layer") || "";
      }
      if (item.id && /^accountable:persona:/.test(item.id) && graph.hasNode("persona:" + personaPick)) {
        var layers = graph.getNodeAttribute("persona:" + personaPick, "srfLayers") || [];
        if (layers.length === 1) return layers[0];
      }
    }
    return "";
  }

  function appendCardBadges(button, item, column, chain) {
    var style = linkStyleForCard(item, column, chain);
    var layer = layerForCard(item, column);
    if (!style && !layer) return;
    var row = makeEl("span", "chain-card__badges");
    if (style) {
      var linkBadge = makeEl("span", "chain-card__badge chain-card__badge--link", LINK_TYPE_BADGE[style] || style);
      linkBadge.setAttribute("aria-label", "Link type: " + (LINK_TYPE_BADGE[style] || style));
      row.appendChild(linkBadge);
    }
    if (layer) {
      var layerBadge = makeEl("span", "chain-card__badge chain-card__badge--layer", layer);
      layerBadge.setAttribute("aria-label", "Layer " + layer);
      row.appendChild(layerBadge);
    }
    button.appendChild(row);
  }

  function personaModelRoles(personaId, chain) {
    if (!personaId || !chain || !catalog) return "";
    var byModel = {};
    (chain.risks || []).forEach(function (riskItem) {
      var threat = catalog.threats[riskItem.ref];
      if (!threat) return;
      MODEL_ORDER.forEach(function (modelId) {
        if (!hasModel(modelId)) return;
        var cell = (threat.accountability || {})[modelId] || {};
        if (cell.accountable_persona !== personaId) return;
        var party = cell.accountable_party || "";
        var label = ACCOUNTABILITY_PARTY_LABEL[party] || party || "accountable";
        byModel[modelId] = label;
      });
    });
    return MODEL_ORDER.filter(function (modelId) { return byModel[modelId]; }).map(function (modelId) {
      return byModel[modelId] + " in " + modelName(modelId);
    }).join("; ");
  }

  function blankChain(startKind) {
    return {
      startKind: startKind,
      risks: [],
      obligations: [],
      controls: [],
      personaCards: [],
      gaps: [],
      edges: [],
      dashed: 0,
      fallbacks: 0,
      personaCount: 0,
      columnNotes: {},
      blank: false
    };
  }

  function addEdge(chain, edge) {
    var key = edge.from + ">" + edge.to + ">" + edge.style;
    if (chain.edges.some(function (item) { return item.from === edge.from && item.to === edge.to && item.style === edge.style; })) return;
    chain.edges.push(edge);
    if (edge.style === "dashed" || edge.style === "long-dashed") chain.dashed += 1;
    if (edge.style === "dotted") chain.fallbacks += 1;
  }

  function evidenceParts(control) {
    var evidence = control && control.threshold && control.threshold.evidence;
    if (!evidence || typeof evidence !== "object") {
      return { short: "The evidence pointer is not recorded.", detail: "" };
    }
    if (JSON.stringify(evidence).indexOf("TBD") !== -1) {
      return { short: "The evidence pointer is not recorded.", detail: "" };
    }
    var detail = evidence.description || "";
    if (evidence.ocsf_class) detail = (detail ? detail + " " : "") + "Class: " + evidence.ocsf_class + ".";
    return { short: "An evidence pointer is recorded on this control.", detail: detail };
  }

  function layerSentence(layerId) {
    if (!layerId) return "";
    var name = layerId;
    if (graph && graph.hasNode("layer:" + layerId)) name = graph.getNodeAttribute("layer:" + layerId, "name");
    var frame = LAYER_FRAME[layerId] || "";
    return "Operates at " + name + ". " + frame;
  }

  function mappingLines(threat) {
    var map = (threat && threat.mappings) || {};
    var labels = {
      owasp_llm_top10: "OWASP LLM Top 10",
      mitre_atlas: "MITRE ATLAS",
      biml_llm24: "BIML",
      owasp_dsgai: "OWASP DSGAI",
      mit_ai_risk_repository: "MIT AI Risk Repository",
      oecd_ai_principles: "OECD AI Principles",
      oecd_aim: "OECD AIM"
    };
    return Object.keys(labels).map(function (key) {
      if (!map[key]) return "";
      return labels[key] + ": " + map[key];
    }).filter(Boolean);
  }

  /* Search matches recorded identifiers and descriptions only. The OWASP LLM
   * Top 10, MITRE ATLAS, OWASP DSGAI, MIT AI Risk Repository, OECD AI
   * Principles, and OECD AIM mapping strings are the framework IDs on the
   * record. BIML is left out of the search index. */
  var SEARCH_MAPPING_KEYS = ["owasp_llm_top10", "mitre_atlas", "owasp_dsgai", "mit_ai_risk_repository", "oecd_ai_principles", "oecd_aim"];
  function threatSearchText(threat) {
    var map = threat.mappings || {};
    return SEARCH_MAPPING_KEYS.map(function (key) { return map[key]; })
      .concat([threat.name, threat.impact, threat.attack_surface, threat.layer_rationale]);
  }

  /* A DSGAI record has no per-entry source URL in the AI Exchange field. It
   * cites the DSGAI collection, which threats.json records once under sources. */
  function riskSource(threat) {
    if (typeof threat.source_url === "string" && threat.source_url.indexOf("http") === 0) {
      return { url: threat.source_url, label: "Risk definition" };
    }
    if (typeof threat.ai_exchange === "string" && threat.ai_exchange.indexOf("http") === 0) {
      return { url: threat.ai_exchange, label: "Risk definition" };
    }
    if (threat.dsgai && catalog.dsgaiSource.url) {
      return { url: catalog.dsgaiSource.url, label: catalog.dsgaiSource.name || "OWASP DSGAI" };
    }
    return { url: "", label: "" };
  }

  function riskCard(threat) {
    var owners = [];
    MODEL_ORDER.forEach(function (modelId) {
      if (!hasModel(modelId)) return;
      var cell = (threat.accountability || {})[modelId] || {};
      owners.push({
        model: modelId,
        label: modelName(modelId),
        personaId: cell.accountable_persona || "",
        name: cell.accountable_persona ? personaLabel(cell.accountable_persona) : "",
        gap: !!cell.no_linked_control_in_model,
        sharedContext: ((cell.responsibility || {}).customer === "shared" || (cell.responsibility || {}).provider === "shared")
      });
    });
    var source = riskSource(threat);
    return {
      id: "risk:" + threat.id,
      ref: threat.id,
      name: threat.name,
      url: source.url,
      sourceLabel: source.label,
      layer: threat.srf_layer || "",
      affected: threat.affected_layers || [],
      attackSurface: threat.attack_surface || "",
      mappings: mappingLines(threat),
      attacks: (catalog.attacksByThreat && catalog.attacksByThreat[threat.id]) || [],
      owners: owners
    };
  }

  function controlCard(nodeId, attrs) {
    return {
      id: nodeId,
      name: attrs.name,
      ref: attrs.ref,
      meta: attrs.meta || "",
      layer: attrs.layer || "",
      vertical: attrs.vertical || "",
      url: controlPageUrl(attrs.vertical, attrs.ref),
      sectorModels: attrs.sectorModels || [],
      fullId: attrs.fullId,
      evidenceText: attrs.evidenceText || "",
      evidenceDetail: attrs.evidenceDetail || "",
      crossLayerNote: attrs.crossLayerNote || "",
      tapestry: isTapestryRecord(attrs)
    };
  }

  function personaCard(nodeId, attrs) {
    var lines = [];
    modelsFor(attrs).forEach(function (modelId) {
      var personaId = (attrs.accountableByModel || {})[modelId];
      if (!personaId) {
        lines.push({ model: modelId, label: modelName(modelId), missing: true });
      } else {
        lines.push({
          model: modelId,
          label: modelName(modelId),
          personaId: personaId,
          name: personaLabel(personaId),
          missing: false
        });
      }
    });
    if (!lines.length && showTapestry && isTapestryRecord(attrs) && attrs.accountablePersona) {
      lines.push({
        model: "",
        label: "Accountable persona",
        personaId: attrs.accountablePersona,
        name: personaLabel(attrs.accountablePersona),
        missing: false
      });
    }
    return {
      id: "accountable:" + nodeId,
      controlId: nodeId,
      controlName: attrs.name,
      lines: lines,
      sectorPersona: attrs.accountablePersona || "",
      linkBasis: true,
      tapestry: isTapestryRecord(attrs)
    };
  }

  function sourceRows(link) {
    return (((link || {}).source || {}).controls || []).map(function (row) {
      var node = row && row.control ? controlRecord(row.control) : null;
      return {
        fullId: row.control || "",
        nodeId: node ? node.id : "",
        name: node ? node.attrs.name : (row.control || ""),
        ref: node ? node.attrs.ref : "",
        vertical: node ? node.attrs.vertical : "",
        citation: row.citation || "",
        inChain: !!(node && controlInChain(node.attrs))
      };
    });
  }

  function citationsForControl(attrs) {
    var cacheKey = attrs && attrs.fullId;
    if (cacheKey && citationCache[cacheKey]) return citationCache[cacheKey];
    var articles = [];
    var seenReq = {};
    var matched = {};
    var keys = Object.keys((attrs && attrs.mappings) || {});
    keys.forEach(function (key) {
      if (key === "mapping_status_note") return;
      var citation = attrs.mappings[key];
      if (isPlaceholder(citation)) return;
      var reg = catalog.regsByKey[key];
      if (!reg || !isCurrentObligation(reg)) return;
      (catalog.matchers[reg.id] || []).forEach(function (matcher) {
        if (seenReq[matcher.req.id]) return;
        var hit = matcher.pats.some(function (pattern) { return pattern.test(citation); });
        if (!hit) return;
        seenReq[matcher.req.id] = true;
        matched[reg.id] = true;
        articles.push({ req: matcher.req, citation: citation, instrument: reg });
      });
    });
    var fallbacks = [];
    var seenFallback = {};
    keys.forEach(function (key) {
      if (key === "mapping_status_note") return;
      var citation = attrs.mappings[key];
      if (isPlaceholder(citation)) return;
      var reg = catalog.regsByKey[key];
      if (!reg || !isCurrentObligation(reg) || matched[reg.id] || seenFallback[reg.id]) return;
      seenFallback[reg.id] = true;
      fallbacks.push({ reg: reg, citation: citation });
    });
    articles.sort(function (a, b) {
      return String(a.req.citation) < String(b.req.citation) ? -1 : String(a.req.citation) > String(b.req.citation) ? 1 : 0;
    });
    fallbacks.sort(function (a, b) { return a.reg.name < b.reg.name ? -1 : a.reg.name > b.reg.name ? 1 : 0; });
    var cited = { articles: articles, fallbacks: fallbacks };
    if (cacheKey) citationCache[cacheKey] = cited;
    return cited;
  }

  /* A requirement the control cites and the risk lists. The risk record does
   * not have to name the control. */
  function viasBetween(threat, attrs) {
    var cited = {};
    citationsForControl(attrs).articles.forEach(function (item) {
      cited[item.req.id] = item.req;
    });
    var hits = [];
    var seen = {};
    (threat.obligations || []).forEach(function (link) {
      var req = cited[link.requirement];
      if (!req || seen[req.id]) return;
      seen[req.id] = true;
      hits.push({ id: req.id, citation: req.citation || "", title: req.title || "" });
    });
    return hits;
  }

  function noteVia(card, vias) {
    if (!card || !vias || !vias.length) return;
    if (!card.viaObligations) card.viaObligations = [];
    vias.forEach(function (via) {
      if (card.viaObligations.some(function (item) { return item.id === via.id; })) return;
      card.viaObligations.push(via);
    });
  }

  function viaSentence(vias) {
    var names = vias.map(function (via) {
      if (via.citation && via.title) return via.citation + ": " + via.title;
      return via.citation || via.title || via.id;
    });
    if (names.length === 1) return "Linked through the cited obligation " + names[0] + ".";
    return "Linked through the cited obligations " + names.join("; ") + ".";
  }

  function directRiskControl(chain) {
    var cards = chain.startKind === "risk" ? chain.controls : chain.risks;
    return cards.some(function (item) { return !item.viaObligations || !item.viaObligations.length; });
  }

  /* Direct related_controls stays one solid line. A cited-obligation link
   * uses a longer dash, and it is not drawn again when the solid line is
   * already there. */
  function addRiskControlEdge(chain, riskId, controlId, direct, vias) {
    if (!direct && (!vias || !vias.length)) return;
    var style = direct ? "solid" : "long-dashed";
    var i;
    for (i = 0; i < chain.edges.length; i++) {
      var item = chain.edges[i];
      if (item.from !== riskId || item.to !== controlId) continue;
      if (item.style !== "solid" && item.style !== "dashed" && item.style !== "long-dashed") continue;
      if (item.style !== "solid" && style === "solid") {
        item.style = "solid";
        chain.dashed -= 1;
        delete item.via;
      }
      return;
    }
    var edge = { from: riskId, to: controlId, style: style };
    if (style === "long-dashed") edge.via = vias;
    addEdge(chain, edge);
  }

  function pushControlGaps(chain, threat, controlCount) {
    function gapFor(modelId) {
      var label = modelName(modelId);
      chain.gaps.push({
        column: "control",
        text: "Confirmed coverage gap. No linked control is recorded for this risk in " + label + ". The recorded persona stays visible. This is not a missing owner."
      });
    }
    if (!isAllModels()) {
      selectedModels.forEach(function (modelId) {
        var row = ((threat || {}).accountability || {})[modelId] || {};
        if (!controlCount || row.no_linked_control_in_model) gapFor(modelId);
      });
      return;
    }
    MODEL_ORDER.forEach(function (modelId) {
      var row = ((threat || {}).accountability || {})[modelId] || {};
      if (row.no_linked_control_in_model) gapFor(modelId);
    });
  }

  function addPersonaCards(chain, nodes) {
    nodes.forEach(function (node) {
      var card = personaCard(node.id, node.attrs);
      if (!card.lines.length) return;
      chain.personaCards.push(card);
      card.lines.forEach(function (line) { if (!line.missing) chain.personaCount += 1; });
      addEdge(chain, { from: node.id, to: card.id, style: "solid" });
    });
  }

  function chainFromRisk(nodeId, attrs) {
    var threat = catalog.threats[attrs.ref];
    var chain = blankChain("risk");
    if (!threat) return chain;
    chain.risks.push(riskCard(threat));
    var nodes = [];
    var seen = {};
    graph.forEachNode(function (id, controlAttrs) {
      if (!controlInChain(controlAttrs) || seen[id]) return;
      var direct = (threat.related_controls || []).indexOf(controlAttrs.fullId) !== -1;
      var vias = direct ? [] : viasBetween(threat, controlAttrs);
      if (!direct && !vias.length) return;
      seen[id] = true;
      nodes.push({ id: id, attrs: controlAttrs, direct: direct, vias: vias });
    });
    nodes.sort(function (a, b) {
      return compareControlNodes(a, b);
    });
    var links = threat.obligations || [];
    if (!links.length) {
      chain.gaps.push({ column: "obligation", text: "No obligation is linked to this risk." });
    }
    links.forEach(function (link) {
      var req = catalog.reqs[link.requirement];
      if (!req) {
        chain.gaps.push({ column: "obligation", text: "An obligation id on this risk does not match a requirement record." });
        return;
      }
      var cardId = "obligation:" + req.id;
      var style = basisIsDashed(link.basis) ? "dashed" : "solid";
      var sources = sourceRows(link);
      chain.obligations.push({
        id: cardId,
        citation: req.citation,
        title: req.title,
        summary: req.summary || "",
        url: req.url || "",
        basis: link.basis,
        basisChips: ["Risk to obligation. " + basisChip(link.basis)],
        basisSentences: ["Implements this obligation. " + basisSentence(link.basis)],
        style: style,
        instrumentLevel: false,
        sources: sources
      });
      addEdge(chain, { from: nodeId, to: cardId, style: style });
      sources.forEach(function (source) {
        if (source.inChain && seen[source.nodeId]) addEdge(chain, { from: cardId, to: source.nodeId, style: "solid" });
      });
    });
    nodes.forEach(function (node) {
      var card = controlCard(node.id, node.attrs);
      if (node.vias.length) card.viaObligations = node.vias.slice();
      chain.controls.push(card);
      addRiskControlEdge(chain, nodeId, node.id, node.direct, node.vias);
    });
    sortChainControls(chain);
    pushControlGaps(chain, threat, nodes.length);
    addPersonaCards(chain, nodes);
    return chain;
  }

  function chainFromControl(nodeId, attrs) {
    var chain = blankChain("control");
    var rows = [];
    Object.keys(catalog.threats).forEach(function (id) {
      var threat = catalog.threats[id];
      var direct = (threat.related_controls || []).indexOf(attrs.fullId) !== -1;
      var vias = viasBetween(threat, attrs);
      if (!direct && !vias.length) return;
      rows.push({ threat: threat, direct: direct, vias: direct ? [] : vias });
    });
    rows.sort(function (a, b) { return a.threat.name < b.threat.name ? -1 : a.threat.name > b.threat.name ? 1 : 0; });
    if (!rows.length) {
      chain.gaps.push({ column: "risk", text: "No risk record names this control." });
    }
    var threats = [];
    rows.forEach(function (row) {
      var card = riskCard(row.threat);
      if (row.vias.length) card.viaObligations = row.vias.slice();
      chain.risks.push(card);
      threats.push(row.threat);
      addRiskControlEdge(chain, card.id, nodeId, row.direct, row.vias);
    });
    var cited = citationsForControl(attrs);
    if (!cited.articles.length && !cited.fallbacks.length) {
      chain.gaps.push({ column: "obligation", text: "No obligation is linked to this control." });
    }
    var obligationIds = {};
    cited.articles.forEach(function (item) {
      var cardId = "obligation:" + item.req.id;
      obligationIds[item.req.id] = cardId;
      var key = item.instrument.mapping_key || "";
      chain.obligations.push({
        id: cardId,
        citation: item.req.citation,
        title: item.req.title,
        summary: item.req.summary || "",
        url: item.req.url || "",
        basis: "",
        basisChips: ["Obligation to this control. Basis: citation on this control."],
        basisSentences: ["Cited by this control in its source record."],
        style: "solid",
        instrumentLevel: false,
        citationText: item.citation,
        sources: []
      });
      addEdge(chain, { from: cardId, to: nodeId, style: "solid" });
    });
    cited.fallbacks.forEach(function (item) {
      var cardId = "instrument:" + item.reg.id;
      var key = item.reg.mapping_key || "";
      chain.obligations.push({
        id: cardId,
        citation: item.reg.short || item.reg.name,
        title: item.reg.name,
        summary: "",
        url: item.reg.url || "",
        basis: "",
        basisChips: ["Obligation to this control. Basis: instrument cited by this control. No article record matched."],
        basisSentences: [],
        style: "dotted",
        instrumentLevel: true,
        citationText: item.citation,
        sources: []
      });
      addEdge(chain, { from: cardId, to: nodeId, style: "dotted" });
    });
    threats.forEach(function (threat) {
      (threat.obligations || []).forEach(function (link) {
        var cardId = obligationIds[link.requirement];
        if (!cardId) return;
        var listsThis = (((link.source || {}).controls) || []).some(function (row) {
          return row.control === attrs.fullId;
        });
        if (!listsThis) return;
        var style = basisIsDashed(link.basis) ? "dashed" : "solid";
        addEdge(chain, { from: "risk:" + threat.id, to: cardId, style: style });
        chain.obligations.forEach(function (item) {
          if (item.id !== cardId) return;
          item.riskLinks = (item.riskLinks || []).concat([{ risk: threat.name, basis: link.basis }]);
        });
      });
    });
    chain.obligations.forEach(function (item) {
      var groups = {};
      var order = [];
      (item.riskLinks || []).forEach(function (row) {
        var key = row.basis || "";
        if (!groups[key]) {
          groups[key] = [];
          order.push(key);
        }
        groups[key].push(row.risk);
      });
      order.forEach(function (basis) {
        var names = groups[basis];
        item.basisChips.push("Risk to obligation, " + unit(names.length, "risk", "risks") + ". " + basisChip(basis));
        item.basisSentences.push("Risks to this obligation: " + names.join(", ") + ". " + basisSentence(basis));
      });
    });
    chain.controls.push(controlCard(nodeId, attrs));
    sortChainControls(chain);
    addPersonaCards(chain, [{ id: nodeId, attrs: attrs }]);
    return chain;
  }

  function chainFromPersona(id) {
    var chain = blankChain("persona");
    var nodes = [];
    graph.forEachNode(function (nodeId, attrs) {
      if (!controlInChain(attrs)) return;
      var named = modelsFor(attrs).some(function (modelId) {
        return (attrs.accountableByModel || {})[modelId] === id;
      });
      if (!named && isTapestryRecord(attrs) && attrs.accountablePersona === id) named = true;
      if (named) nodes.push({ id: nodeId, attrs: attrs });
    });
    nodes.sort(function (a, b) {
      return compareControlNodes(a, b);
    });
    var threats = [];
    Object.keys(catalog.threats).forEach(function (threatId) {
      var threat = catalog.threats[threatId];
      var named = MODEL_ORDER.some(function (modelId) {
        if (!hasModel(modelId)) return false;
        return ((threat.accountability || {})[modelId] || {}).accountable_persona === id;
      });
      var linked = nodes.some(function (node) {
        var direct = (threat.related_controls || []).indexOf(node.attrs.fullId) !== -1;
        return direct || viasBetween(threat, node.attrs).length;
      });
      if (named || linked) threats.push(threat);
    });
    threats.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    var riskCards = {};
    threats.forEach(function (threat) {
      var card = riskCard(threat);
      riskCards[card.id] = card;
      chain.risks.push(card);
    });
    var riskIds = {};
    chain.risks.forEach(function (card) { riskIds[card.id] = true; });
    var obligationCards = {};
    nodes.forEach(function (node) {
      var card = controlCard(node.id, node.attrs);
      threats.forEach(function (threat) {
        var riskId = "risk:" + threat.id;
        if (!riskIds[riskId]) return;
        var direct = (threat.related_controls || []).indexOf(node.attrs.fullId) !== -1;
        var vias = direct ? [] : viasBetween(threat, node.attrs);
        if (!direct && !vias.length) return;
        if (vias.length) {
          noteVia(card, vias);
          noteVia(riskCards[riskId], vias);
        }
        addRiskControlEdge(chain, riskId, node.id, direct, vias);
      });
      chain.controls.push(card);
      addEdge(chain, { from: node.id, to: "accountable:persona:" + id, style: "solid" });
      var cited = citationsForControl(node.attrs);
      cited.articles.forEach(function (item) {
        var cardId = "obligation:" + item.req.id;
        if (!obligationCards[cardId]) {
          obligationCards[cardId] = {
            id: cardId,
            citation: item.req.citation,
            title: item.req.title,
            summary: item.req.summary || "",
            url: item.req.url || "",
            basis: "",
            basisChips: [],
            basisSentences: ["Cited by a control in its source record."],
            style: "solid",
            instrumentLevel: false,
            citationText: item.citation,
            sources: [],
            controlCount: 0
          };
          chain.obligations.push(obligationCards[cardId]);
        }
        obligationCards[cardId].controlCount += 1;
        addEdge(chain, { from: cardId, to: node.id, style: "solid" });
      });
      cited.fallbacks.forEach(function (item) {
        var cardId = "instrument:" + item.reg.id;
        if (!obligationCards[cardId]) {
          obligationCards[cardId] = {
            id: cardId,
            citation: item.reg.short || item.reg.name,
            title: item.reg.name,
            summary: "",
            url: item.reg.url || "",
            basis: "",
            basisChips: [],
            basisSentences: [],
            style: "dotted",
            instrumentLevel: true,
            citationText: item.citation,
            sources: [],
            controlCount: 0
          };
          chain.obligations.push(obligationCards[cardId]);
        }
        obligationCards[cardId].controlCount += 1;
        addEdge(chain, { from: cardId, to: node.id, style: "dotted" });
      });
    });
    chain.obligations.forEach(function (item) {
      item.basisChips.push("Cited by " + unit(item.controlCount, "control", "controls") + " on this chain." + (item.instrumentLevel ? " No article record matched." : ""));
    });
    chain.obligations.sort(function (a, b) {
      return String(a.citation) < String(b.citation) ? -1 : String(a.citation) > String(b.citation) ? 1 : 0;
    });
    if (!nodes.length) {
      chain.gaps.push({
        column: "control",
        text: "No control names this persona yet."
      });
    } else if (!chain.obligations.length) {
      chain.gaps.push({ column: "obligation", text: "No obligation is linked to these controls." });
    }
    var extensionPersona = graph.hasNode("persona:" + id) && isTapestryRecord(graph.getNodeAttributes("persona:" + id));
    chain.personaCards.push({
      id: "accountable:persona:" + id,
      controlId: "persona:" + id,
      controlName: personaLabel(id),
      lines: [{
        model: modelFilterKey(),
        label: extensionPersona ? "Accountable persona" : (isAllModels() ? "Selected models" : modelFilterLabel()),
        personaId: id,
        name: personaLabel(id),
        missing: false
      }],
      sectorPersona: "",
      tapestry: extensionPersona
    });
    chain.personaCount = 1;
    return chain;
  }

  function obligationCardFrom(cardId, item, instrumentLevel) {
    var source = instrumentLevel ? item.reg : item.req;
    var instrumentId = instrumentLevel ? (item.reg && item.reg.id) : (item.req && item.req.instrument);
    if (!instrumentId && source && source.id && String(source.id).indexOf(".") !== -1) {
      instrumentId = String(source.id).split(".")[0];
    }
    return {
      id: cardId,
      instrumentId: instrumentId || "",
      citation: instrumentLevel ? (source.short || source.name) : source.citation,
      title: instrumentLevel ? source.name : source.title,
      summary: instrumentLevel ? "" : (source.summary || ""),
      url: source.url || "",
      basis: "",
      basisChips: [],
      basisSentences: instrumentLevel ? [] : ["Cited by a control in its source record."],
      style: instrumentLevel ? "dotted" : "solid",
      instrumentLevel: instrumentLevel,
      citationText: item.citation,
      sources: [],
      controlCount: 0
    };
  }

  /* Every obligation that a control allowed by the current filters cites. */
  var obligationChoiceCache = { key: "", cards: [], byId: {} };

  function obligationChoiceCards() {
    var key = [modelFilterKey(), layerFilterKey(), showTapestry].join("|");
    if (obligationChoiceCache.key === key) return obligationChoiceCache.cards;
    var seen = {};
    var cards = [];
    suggestedIds().forEach(function (id) {
      var cited = citationsForControl(graph.getNodeAttributes(id));
      cited.articles.forEach(function (item) {
        var cardId = "obligation:" + item.req.id;
        if (seen[cardId]) return;
        seen[cardId] = true;
        cards.push(obligationCardFrom(cardId, item, false));
      });
      cited.fallbacks.forEach(function (item) {
        var cardId = "instrument:" + item.reg.id;
        if (seen[cardId]) return;
        seen[cardId] = true;
        cards.push(obligationCardFrom(cardId, item, true));
      });
    });
    var byId = {};
    cards.forEach(function (card) { byId[card.id] = card; });
    obligationChoiceCache = { key: key, cards: cards, byId: byId };
    return cards;
  }

  function chainFromObligation(obligationId) {
    var chain = blankChain("obligation");
    var nodes = [];
    var card = null;
    graph.forEachNode(function (nodeId, attrs) {
      if (!controlInChain(attrs)) return;
      var cited = citationsForControl(attrs);
      var hit = null;
      var instrumentLevel = false;
      cited.articles.forEach(function (item) { if ("obligation:" + item.req.id === obligationId) hit = item; });
      cited.fallbacks.forEach(function (item) {
        if ("instrument:" + item.reg.id === obligationId) {
          hit = item;
          instrumentLevel = true;
        }
      });
      if (!hit) return;
      nodes.push({ id: nodeId, attrs: attrs, instrumentLevel: instrumentLevel });
      if (!card) card = obligationCardFrom(obligationId, hit, instrumentLevel);
    });
    var reqId = obligationId.indexOf("obligation:") === 0 ? obligationId.slice(11) : "";
    if (!card && reqId && catalog.reqs[reqId]) card = obligationCardFrom(obligationId, { req: catalog.reqs[reqId], citation: "" }, false);
    if (!card) return chain;
    nodes.sort(function (a, b) {
      return compareControlNodes(a, b);
    });
    card.controlCount = nodes.length;
    card.basisChips.push("Cited by " + unit(nodes.length, "control", "controls") + " on this chain." + (card.instrumentLevel ? " No article record matched." : ""));
    chain.obligations.push(card);
    var threats = [];
    Object.keys(catalog.threats).forEach(function (threatId) {
      var threat = catalog.threats[threatId];
      var direct = reqId && (threat.obligations || []).filter(function (link) { return link.requirement === reqId; })[0];
      var viaControl = nodes.filter(function (node) { return (threat.related_controls || []).indexOf(node.attrs.fullId) !== -1; });
      if (!direct && !viaControl.length) return;
      threats.push({ threat: threat, direct: direct || null, viaControl: viaControl });
    });
    threats.sort(function (a, b) { return a.threat.name < b.threat.name ? -1 : a.threat.name > b.threat.name ? 1 : 0; });
    threats.forEach(function (row) {
      var card = riskCard(row.threat);
      chain.risks.push(card);
      if (row.direct) addEdge(chain, { from: "risk:" + row.threat.id, to: obligationId, style: basisIsDashed(row.direct.basis) ? "dashed" : "solid" });
      nodes.forEach(function (node) {
        var direct = (row.threat.related_controls || []).indexOf(node.attrs.fullId) !== -1;
        var vias = direct ? [] : viasBetween(row.threat, node.attrs);
        if (!direct && !vias.length) return;
        if (vias.length) {
          noteVia(card, vias);
          if (!node.viaObligations) node.viaObligations = [];
          vias.forEach(function (via) {
            if (!node.viaObligations.some(function (item) { return item.id === via.id; })) node.viaObligations.push(via);
          });
        }
        addRiskControlEdge(chain, "risk:" + row.threat.id, node.id, direct, vias);
      });
    });
    nodes.forEach(function (node) {
      var control = controlCard(node.id, node.attrs);
      if (node.viaObligations && node.viaObligations.length) control.viaObligations = node.viaObligations.slice();
      chain.controls.push(control);
      addEdge(chain, { from: obligationId, to: node.id, style: node.instrumentLevel ? "dotted" : "solid" });
    });
    if (!nodes.length) chain.gaps.push({ column: "control", text: "No control cites this obligation for the selected operating model." });
    addPersonaCards(chain, nodes);
    return chain;
  }

  function buildChain(nodeId) {
    if (!graph.hasNode(nodeId)) return null;
    var attrs = graph.getNodeAttributes(nodeId);
    if (isTapestryRecord(attrs) && !showTapestry) return null;
    if (attrs.kind === "risk") return chainFromRisk(nodeId, attrs);
    if (attrs.kind === "control") {
      if (!controlInChain(attrs)) return null;
      return chainFromControl(nodeId, attrs);
    }
    return null;
  }

  function makeEl(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function makeLink(href, text) {
    var anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = text;
    if (/^https?:/i.test(href)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    return anchor;
  }

  function cardButton(cardId, pressed) {
    var button = makeEl("button", "chain-card");
    button.type = "button";
    button.dataset.chainId = cardId;
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    return button;
  }

  var COLUMN_WORD = { risk: "Why", obligation: "What", control: "How", accountable: "Who" };
  function columnItems(chain, key) {
    return key === "risk" ? chain.risks : key === "obligation" ? chain.obligations : key === "control" ? chain.controls : chain.personaCards;
  }

  function instrumentShortName(instrumentId) {
    if (!instrumentId) return "";
    var reg = catalog && catalog.regsById[instrumentId];
    return reg && reg.short ? reg.short : instrumentId;
  }

  function obligationGroupLabel(instrumentId, count) {
    var name = instrumentShortName(instrumentId);
    if (!name && instrumentId && catalog && catalog.regsById[instrumentId]) {
      var reg = catalog.regsById[instrumentId];
      name = reg.short || reg.name || instrumentId;
    }
    if (!name) name = instrumentId || "Unnamed instrument";
    return name + " (" + count + ")";
  }

  function instrumentSearchText(instrumentId) {
    var reg = catalog && catalog.regsById[instrumentId];
    if (!reg) return instrumentId;
    return [reg.short, reg.name, reg.id].filter(Boolean).join(" ");
  }

  var NIST_RMF_FUNCTIONS = { GOVERN: 0, MAP: 1, MEASURE: 2, MANAGE: 3 };

  function citationSortParts(citation) {
    var parts = [];
    String(citation || "").replace(/(\d+(?:\.\d+)*|[A-Za-z]+|\([^)]*\))/g, function (token) {
      if (/^\d+(?:\.\d+)*$/.test(token)) {
        token.split(".").forEach(function (bit) {
          parts.push({ kind: "n", value: parseInt(bit, 10) });
        });
      } else if (/^[A-Za-z]+$/.test(token)) {
        parts.push({ kind: "a", value: token.toUpperCase() });
      } else {
        parts.push({ kind: "s", value: token });
      }
    });
    return parts;
  }

  function leadingArticleNumber(citation) {
    var match = String(citation || "").match(/Article\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  var ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

  function romanToInt(token) {
    var upper = String(token || "").toUpperCase();
    if (!upper || !/^[IVXLCDM]+$/.test(upper)) return null;
    var total = 0;
    var prev = 0;
    var i;
    for (i = upper.length - 1; i >= 0; i -= 1) {
      var val = ROMAN_VALUES[upper.charAt(i)] || 0;
      if (!val) return null;
      if (val < prev) total -= val;
      else total += val;
      prev = val;
    }
    return total;
  }

  function leadingAnnexNumber(citation) {
    var match = String(citation || "").match(/^Annex\s+([IVXLCDM]+|\d+)/i);
    if (!match) return null;
    if (/^\d+$/.test(match[1])) return parseInt(match[1], 10);
    return romanToInt(match[1]);
  }

  function euAiActCitationRank(citation) {
    var text = String(citation || "");
    var article = leadingArticleNumber(text);
    if (article !== null) return { kind: 0, major: article, text: text };
    var annex = leadingAnnexNumber(text);
    if (annex !== null) return { kind: 1, major: annex, text: text };
    return { kind: 2, major: 0, text: text };
  }

  function compareCitation(a, b, instrumentId) {
    var left = String(a || "");
    var right = String(b || "");
    if (instrumentId === "eu-ai-act") {
      var ra = euAiActCitationRank(left);
      var rb = euAiActCitationRank(right);
      if (ra.kind !== rb.kind) return ra.kind - rb.kind;
      if (ra.kind <= 1 && ra.major !== rb.major) return ra.major - rb.major;
    }
    if (instrumentId === "nist-ai-rmf") {
      var fa = (left.match(/^(GOVERN|MAP|MEASURE|MANAGE)/i) || [""])[0].toUpperCase();
      var fb = (right.match(/^(GOVERN|MAP|MEASURE|MANAGE)/i) || [""])[0].toUpperCase();
      var ta = Object.prototype.hasOwnProperty.call(NIST_RMF_FUNCTIONS, fa) ? NIST_RMF_FUNCTIONS[fa] : 99;
      var tb = Object.prototype.hasOwnProperty.call(NIST_RMF_FUNCTIONS, fb) ? NIST_RMF_FUNCTIONS[fb] : 99;
      var fn = ta - tb;
      if (fn) return fn;
    }
    var pa = citationSortParts(left);
    var pb = citationSortParts(right);
    var len = Math.max(pa.length, pb.length);
    var i;
    for (i = 0; i < len; i += 1) {
      if (!pa[i]) return -1;
      if (!pb[i]) return 1;
      if (pa[i].kind === "n" && pb[i].kind === "n" && pa[i].value !== pb[i].value) return pa[i].value - pb[i].value;
      var textCmp = textOrder(pa[i].value, pb[i].value);
      if (textCmp) return textCmp;
    }
    return textOrder(left, right);
  }

  function instrumentSortRank(instrumentId) {
    var priority = catalog.priorityInstruments || [];
    var hit = priority.indexOf(instrumentId);
    if (hit !== -1) return { tier: 0, order: hit, label: instrumentShortName(instrumentId) };
    var reg = catalog.regsById[instrumentId];
    var binding = reg && reg.source_kind === "binding" ? 0 : 1;
    return { tier: 1, order: binding, label: instrumentShortName(instrumentId) };
  }

  function compareInstruments(a, b) {
    var ra = instrumentSortRank(a);
    var rb = instrumentSortRank(b);
    if (ra.tier !== rb.tier) return ra.tier - rb.tier;
    if (ra.tier === 0) return ra.order - rb.order;
    if (ra.order !== rb.order) return ra.order - rb.order;
    return textOrder(ra.label, rb.label);
  }

  function compareObligationCards(a, b) {
    var instCmp = compareInstruments(a.instrumentId, b.instrumentId);
    if (instCmp) return instCmp;
    var citeCmp = compareCitation(a.citation, b.citation, a.instrumentId);
    if (citeCmp) return citeCmp;
    return textOrder(a.id, b.id);
  }

  function obligationRecordLabel(card) {
    if (!card) return "";
    var duty = boxTitle("obligation", card);
    var short = instrumentShortName(card.instrumentId);
    return short ? short + " \u00b7 " + duty : duty;
  }

  function obligationContextLine(card) {
    var short = instrumentShortName(card.instrumentId);
    return [short, card.citation].filter(Boolean).join(" \u00b7 ");
  }

  function boxTitle(key, item) {
    if (key === "risk" || key === "control") return item.name;
    if (key === "obligation") return item.title && item.title !== item.citation ? item.title : (item.summary || item.title || item.citation);
    var one = item.lines.length === 1 ? item.lines[0] : null;
    return one && !one.missing ? one.name : item.controlName;
  }

  var ALL_LABEL = { risk: "All risks", obligation: "All obligations", control: "All controls", accountable: "All accountable parties" };

  function hasId(list, id) {
    return !!list && list.indexOf(id) !== -1;
  }

  function optionText(key, item) {
    if (key === "obligation") {
      var duty = boxTitle(key, item);
      return item.citation && item.citation !== duty ? item.citation + ". " + duty : duty;
    }
    if (key === "control") return item.name;
    if (key === "accountable" && item.lines.length > 1) return item.controlName + " (one persona per model)";
    return boxTitle(key, item);
  }

  function personaChoiceIds() {
    var allIds = CORE_PERSONAS.filter(function (id) {
      return graph.hasNode("persona:" + id) && graph.getNodeAttribute("persona:" + id, "provenance") !== "proposed-extension";
    }).map(function (id) { return "persona:" + id; });
    if (showTapestry) {
      var extra = [];
      graph.forEachNode(function (id, attrs) {
        if (attrs.kind === "persona" && isTapestryRecord(attrs) && allIds.indexOf(id) === -1) extra.push(id);
      });
      extra.sort(function (a, b) {
        var an = graph.getNodeAttribute(a, "name");
        var bn = graph.getNodeAttribute(b, "name");
        return an < bn ? -1 : an > bn ? 1 : 0;
      });
      allIds = allIds.concat(extra);
    }
    if (isAllModels() && isAllLayers()) return allIds;

    var activeControlIds = suggestedIds();
    var activePersonaRefs = {};
    activeControlIds.forEach(function (cid) {
      var attrs = graph.getNodeAttributes(cid);
      modelsFor(attrs).forEach(function (modelId) {
        var pid = (attrs.accountableByModel || {})[modelId];
        if (pid) activePersonaRefs[pid] = true;
      });
      if (isTapestryRecord(attrs) && attrs.accountablePersona) {
        activePersonaRefs[attrs.accountablePersona] = true;
      }
    });
    riskChoiceIds().forEach(function (rid) {
      var ref = graph.getNodeAttribute(rid, "ref");
      var threat = catalog && catalog.threats && catalog.threats[ref];
      if (!threat) return;
      activeModelIds().forEach(function (modelId) {
        var pid = ((threat.accountability || {})[modelId] || {}).accountable_persona;
        if (pid) activePersonaRefs[pid] = true;
      });
    });

    return allIds.filter(function (id) {
      var attrs = graph.getNodeAttributes(id);
      if (activePersonaRefs[attrs.ref]) return true;
      if (!isAllLayers()) {
        var layers = attrs.srfLayers || [];
        if (layers.some(function (l) { return selectedLayers.indexOf(l) !== -1; })) {
          return isAllModels();
        }
      }
      return false;
    });
  }

  function menuLabel(attrs) {
    if (attrs && isTapestryRecord(attrs)) return attrs.name + ", " + EXTENSION_BADGE;
    return attrs ? attrs.name : "";
  }

  function riskChoiceIds() {
    return riskIds().filter(function (id) {
      var attrs = graph.getNodeAttributes(id);
      return nodeAllowed(attrs) && layerAllowed(attrs);
    });
  }

  /* The key of the column that holds the focus, or "" when nothing is chosen. */
  function focusKey() {
    if (root && graph.hasNode(root)) return graph.getNodeAttribute(root, "kind") === "risk" ? "risk" : "control";
    if (reqPick) return "obligation";
    return personaPick ? "accountable" : "";
  }

  function focusValue() {
    var key = focusKey();
    if (key === "risk" || key === "control") return root;
    if (key === "obligation") return reqPick;
    return key === "accountable" ? "persona:" + personaPick : "";
  }

  var FILTER_PLACEHOLDER = {
    risk: "Filter risks by name, layer, or ID…",
    obligation: "Filter obligations by instrument or article…",
    control: "Filter controls by name, layer, or sector…",
    accountable: "Filter accountable personas…"
  };

  function closeAllCombos(except) {
    Array.prototype.forEach.call(document.querySelectorAll(".chain-combo.is-open"), function (combo) {
      if (combo === except) return;
      combo.classList.remove("is-open");
      var trig = combo.querySelector(".chain-combo__trigger");
      var pan = combo.querySelector(".chain-combo__panel");
      if (trig) trig.setAttribute("aria-expanded", "false");
      if (pan) pan.hidden = true;
    });
  }

  function comboItemSearchText(key, value, labelText, groupLabel) {
    var parts = [labelText, groupLabel];
    if (key === "obligation") {
      var card = obligationChoiceCache.byId[value];
      if (card) {
        parts.push(card.citation, card.title, card.summary, card.citationText, instrumentSearchText(card.instrumentId));
      }
    } else if (value && graph && graph.hasNode(value)) {
      var attrs = graph.getNodeAttributes(value);
      parts.push(attrs.search, attrs.ref, attrs.layer, attrs.meta);
    }
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function buildComboGroups(key, current) {
    var groups = [];
    var totalCount = 0;
    var selectedText = "";

    if (key === "obligation") {
      var cards = obligationChoiceCards();
      totalCount = cards.length;
      var held = null;
      if (current && !cards.some(function (card) { return card.id === current; })) {
        held = currentChain && currentChain.obligations.filter(function (card) { return card.id === current; })[0];
        if (!held) held = obligationChoiceCache.byId[current] || null;
      }
      var byInstrument = {};
      var instrumentIds = [];
      cards.forEach(function (card) {
        var instrumentId = card.instrumentId || "";
        if (!byInstrument[instrumentId]) {
          byInstrument[instrumentId] = [];
          instrumentIds.push(instrumentId);
        }
        byInstrument[instrumentId].push(card);
      });
      instrumentIds.sort(compareInstruments);
      instrumentIds.forEach(function (instrumentId) {
        var members = byInstrument[instrumentId].slice().sort(function (a, b) {
          return compareCitation(a.citation, b.citation, instrumentId) || textOrder(a.id, b.id);
        });
        var gLabel = instrumentShortName(instrumentId) || "Other";
        var items = members.map(function (card) {
          var text = optionText("obligation", card);
          if (card.id === current) selectedText = text;
          return {
            value: card.id,
            text: text,
            search: comboItemSearchText("obligation", card.id, text, gLabel),
            extension: false
          };
        });
        groups.push({ label: gLabel, items: items, instrumentId: instrumentId });
      });
      if (held) {
        var holdId = held.instrumentId || "";
        var holdLabel = instrumentShortName(holdId) || "Other";
        var holdText = optionText("obligation", held);
        selectedText = holdText;
        var target = groups.filter(function (g) { return g.instrumentId === holdId; })[0];
        if (!target) {
          target = { label: holdLabel, items: [], instrumentId: holdId };
          groups.push(target);
        }
        target.items.push({
          value: held.id,
          text: holdText,
          search: comboItemSearchText("obligation", held.id, holdText, holdLabel),
          extension: false
        });
      }
      return { groups: groups, count: totalCount, selectedText: selectedText };
    }

    var ids = key === "risk" ? riskChoiceIds() : key === "control" ? suggestedIds() : personaChoiceIds();
    totalCount = ids.length;
    var flat = key === "accountable" && !showTapestry;
    var bySector = key === "control";
    var groupMap = {};
    var order = [];

    ids.forEach(function (id) {
      var attrs = graph.getNodeAttributes(id);
      var text = menuLabel(attrs);
      if (id === current) selectedText = text;
      var layer = attrs.layer || "";
      var sector = bySector ? controlSector(attrs) : "";
      var gKey = flat ? "" : (key === "accountable" ? (isTapestryRecord(attrs) ? "tapestry" : "core") : (layer + "|" + sector));
      if (!groupMap[gKey]) {
        var gLabel = "";
        if (!flat) {
          if (key === "accountable") {
            gLabel = isTapestryRecord(attrs) ? EXTENSION_BADGE : "SRF v1.0 personas";
          } else {
            var base = layer ? layerName(layer) : "No layer recorded";
            gLabel = sector ? base + " \u00b7 " + sector : base;
          }
        }
        groupMap[gKey] = {
          key: gKey,
          label: gLabel,
          layer: layer,
          sector: sector,
          extension: isTapestryRecord(attrs),
          items: []
        };
        order.push(groupMap[gKey]);
      } else if (isTapestryRecord(attrs)) {
        groupMap[gKey].extension = true;
      }
      groupMap[gKey].items.push({
        value: id,
        text: text,
        search: comboItemSearchText(key, id, text, groupMap[gKey].label),
        extension: isTapestryRecord(attrs)
      });
    });

    if (key === "accountable" && !flat) {
      order.sort(function (a, b) { return a.key === "core" ? -1 : b.key === "core" ? 1 : 0; });
    } else if (!flat) {
      order.sort(function (x, y) {
        return (layerRank(x.layer) - layerRank(y.layer)) || compareSectors(x.sector, y.sector);
      });
      order.forEach(function (g) {
        if (g.extension && g.label.indexOf(EXTENSION_BADGE) === -1) g.label += " \u00b7 " + EXTENSION_BADGE;
      });
    }

    if (current && ids.indexOf(current) === -1 && graph.hasNode(current)) {
      var heldAttrs = graph.getNodeAttributes(current);
      var heldText = menuLabel(heldAttrs);
      selectedText = heldText;
      order.push({
        key: "__held__",
        label: "Selected (outside current filter)",
        items: [{
          value: current,
          text: heldText,
          search: comboItemSearchText(key, current, heldText, "Selected"),
          extension: isTapestryRecord(heldAttrs)
        }]
      });
    }

    return { groups: order, count: totalCount, selectedText: selectedText };
  }

  /* Custom indented combobox with typeahead filtering that hides empty groups
     and dynamically scopes items and counts to active filters. */
  function choiceCombobox(key, headingId) {
    var current = focusKey() === key ? focusValue() : "";
    var built = buildComboGroups(key, current);
    var placeholder = ALL_LABEL[key] + " (" + built.count + ")";

    var combo = makeEl("div", "chain-combo");
    combo.dataset.column = key;

    var trigger = makeEl("button", "chain-combo__trigger");
    trigger.type = "button";
    trigger.id = "chain-select-" + key;
    trigger.dataset.column = key;
    trigger.dataset.value = current;
    trigger.setAttribute("aria-labelledby", headingId + " " + trigger.id + "-text");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "chain-combo-panel-" + key);
    if (current) trigger.classList.add("has-value");

    var trigText = makeEl("span", "chain-combo__text", built.selectedText || placeholder);
    trigText.id = trigger.id + "-text";
    trigger.appendChild(trigText);

    var chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chevron.setAttribute("class", "chain-combo__chevron");
    chevron.setAttribute("viewBox", "0 0 16 16");
    chevron.setAttribute("width", "14");
    chevron.setAttribute("height", "14");
    chevron.setAttribute("aria-hidden", "true");
    chevron.setAttribute("focusable", "false");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M4 6l4 4 4-4");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    chevron.appendChild(path);
    trigger.appendChild(chevron);
    combo.appendChild(trigger);

    var panel = makeEl("div", "chain-combo__panel");
    panel.id = "chain-combo-panel-" + key;
    panel.hidden = true;

    var searchWrap = makeEl("div", "chain-combo__search-wrap");
    var input = document.createElement("input");
    input.type = "search";
    input.className = "chain-combo__search";
    input.placeholder = FILTER_PLACEHOLDER[key] || "Filter…";
    input.setAttribute("aria-label", FILTER_PLACEHOLDER[key] || "Filter options");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    searchWrap.appendChild(input);
    panel.appendChild(searchWrap);

    var listbox = makeEl("div", "chain-combo__list");
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("aria-labelledby", headingId);

    var resetOpt = makeEl("div", "chain-combo__option chain-combo__option--all", placeholder);
    resetOpt.setAttribute("role", "option");
    resetOpt.setAttribute("aria-selected", current === "" ? "true" : "false");
    resetOpt.dataset.value = "";
    resetOpt.dataset.isReset = "1";
    listbox.appendChild(resetOpt);

    built.groups.forEach(function (group) {
      if (!group.items.length) return;
      var container = listbox;
      var countSpan = null;
      if (group.label) {
        var groupEl = makeEl("div", "chain-combo__group");
        groupEl.setAttribute("role", "group");
        var gLabelEl = makeEl("div", "chain-combo__group-label");
        gLabelEl.appendChild(makeEl("span", "chain-combo__group-name", group.label));
        countSpan = makeEl("span", "chain-combo__group-count", "(" + group.items.length + ")");
        gLabelEl.appendChild(countSpan);
        groupEl.appendChild(gLabelEl);
        listbox.appendChild(groupEl);
        container = groupEl;
      }
      group.items.forEach(function (item) {
        var opt = makeEl("div", group.label ? "chain-combo__option chain-combo__option--indented" : "chain-combo__option", item.text);
        opt.setAttribute("role", "option");
        opt.setAttribute("aria-selected", item.value === current ? "true" : "false");
        opt.dataset.value = item.value;
        opt.dataset.nodeId = item.value;
        opt.dataset.search = item.search;
        if (item.extension) opt.dataset.extension = "1";
        container.appendChild(opt);
      });
    });

    panel.appendChild(listbox);
    var emptyMsg = makeEl("p", "chain-combo__empty", "No matching items.");
    emptyMsg.hidden = true;
    panel.appendChild(emptyMsg);
    combo.appendChild(panel);

    var activeOpt = null;

    function visibleOptions() {
      return Array.prototype.slice.call(listbox.querySelectorAll('.chain-combo__option')).filter(function (el) {
        return !el.hidden && (!el.parentNode || !el.parentNode.hidden);
      });
    }

    function setActiveOption(el) {
      if (activeOpt) activeOpt.classList.remove("is-active");
      activeOpt = el || null;
      if (activeOpt) {
        activeOpt.classList.add("is-active");
        activeOpt.scrollIntoView({ block: "nearest" });
      }
    }

    function filterList(rawQuery) {
      var q = String(rawQuery || "").trim().toLowerCase();
      var tokens = q ? q.split(/\s+/).filter(Boolean) : [];
      resetOpt.hidden = !!q;

      var groupsInDom = listbox.querySelectorAll(".chain-combo__group");
      if (groupsInDom.length) {
        Array.prototype.forEach.call(groupsInDom, function (groupEl) {
          var opts = groupEl.querySelectorAll(".chain-combo__option");
          var shownInGroup = 0;
          Array.prototype.forEach.call(opts, function (opt) {
            var hay = opt.dataset.search || "";
            var ok = !tokens.length || tokens.every(function (tok) { return searchHaystackMatches(hay, tok); });
            opt.hidden = !ok;
            if (ok) shownInGroup += 1;
          });
          groupEl.hidden = shownInGroup === 0;
          var cnt = groupEl.querySelector(".chain-combo__group-count");
          if (cnt) cnt.textContent = "(" + shownInGroup + ")";
        });
      } else {
        Array.prototype.forEach.call(listbox.querySelectorAll(".chain-combo__option:not([data-is-reset='1'])"), function (opt) {
          var hay = opt.dataset.search || "";
          var ok = !tokens.length || tokens.every(function (tok) { return searchHaystackMatches(hay, tok); });
          opt.hidden = !ok;
        });
      }

      var vis = visibleOptions();
      emptyMsg.hidden = vis.length > 0;
      if (q && vis.length) {
        setActiveOption(vis[0]);
      } else {
        var sel = vis.filter(function (el) { return el.getAttribute("aria-selected") === "true"; })[0];
        setActiveOption(sel || vis[0] || null);
      }
    }

    function openPanel() {
      closeAllCombos(combo);
      combo.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      panel.hidden = false;
      input.value = "";
      filterList("");
      input.focus();
    }

    function closePanel(restoreFocus) {
      combo.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      panel.hidden = true;
      setActiveOption(null);
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }

    function chooseOption(opt) {
      if (!opt) return;
      var val = opt.dataset.value || "";
      closePanel(false);
      setFocus(key, val);
      if (val && chainHeading) chainHeading.scrollIntoView({ block: "start", behavior: "auto" });
      var again = document.getElementById("chain-select-" + key);
      if (again) again.focus({ preventScroll: true });
    }

    trigger.addEventListener("click", function () {
      if (combo.classList.contains("is-open")) closePanel(true);
      else openPanel();
    });

    trigger.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPanel();
      }
    });

    input.addEventListener("input", function () {
      filterList(input.value);
    });

    input.addEventListener("keydown", function (event) {
      var vis = visibleOptions();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!vis.length) return;
        var idx = activeOpt ? vis.indexOf(activeOpt) : -1;
        setActiveOption(vis[Math.min(vis.length - 1, idx + 1)]);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!vis.length) return;
        var idxUp = activeOpt ? vis.indexOf(activeOpt) : vis.length;
        setActiveOption(vis[Math.max(0, idxUp - 1)]);
      } else if (event.key === "Home") {
        if (!vis.length) return;
        event.preventDefault();
        setActiveOption(vis[0]);
      } else if (event.key === "End") {
        if (!vis.length) return;
        event.preventDefault();
        setActiveOption(vis[vis.length - 1]);
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (activeOpt) chooseOption(activeOpt);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePanel(true);
      }
    });

    listbox.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });

    listbox.addEventListener("click", function (event) {
      var opt = event.target.closest(".chain-combo__option");
      if (!opt) return;
      chooseOption(opt);
    });

    return { el: combo, count: built.count };
  }

  var START_NOTE = "Choose a risk, an obligation, a control, or an accountable persona in any menu. The boxes then show what links to it.";
  var CONTROL_SOURCE_NOTE = "These controls come from the site's sector catalogs. They are not yet drawn from the CoSAI Risk Map controls.yaml. Narrow the list with Operating model and Layer.";

  function entryChain() {
    var chain = blankChain("risk");
    chain.blank = true;
    return chain;
  }

  function announceDetails() {
    if (!copyStatus) return;
    var kind = detailsKind ? detailsKind.textContent : "";
    var name = detailsHeading ? detailsHeading.textContent : "";
    copyStatus.textContent = "Details updated: " + (kind ? kind + ", " : "") + name + ".";
  }

  function clearFocus() {
    root = null;
    selected = null;
    personaPick = "";
    reqPick = "";
    chainFocus = "";
    expandedColumns = {};
  }

  /* A pick in any column makes that item the chain focus. The chain, the
     boxes, and the details panel then show that item's linked chain. */
  function setFocus(key, value) {
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    clearFocus();
    if (!value) {
      commit(true);
      return;
    }
    if (key === "risk" || key === "control") {
      root = value;
      selected = value;
      chainFocus = value;
      if (graph.hasNode(value) && graph.getNodeAttribute(value, "tapestry")) showTapestry = true;
    } else if (key === "obligation") {
      reqPick = value;
      chainFocus = value;
    } else {
      personaPick = value.replace(/^persona:/, "");
      chainFocus = "accountable:persona:" + personaPick;
    }
    view = "chain";
    openColumn = key;
    commit(true);
    announceDetails();
  }

  function focusName() {
    if (root && graph.hasNode(root)) return graph.getNodeAttribute(root, "name");
    if (personaPick) return personaLabel(personaPick);
    if (reqPick && currentChain) {
      var hit = currentChain.obligations.filter(function (card) { return card.id === reqPick; })[0];
      return hit ? obligationRecordLabel(hit) : "";
    }
    return "";
  }

  function fillObligationSelect(select, cards, placeholder, heldOutside) {
    select.textContent = "";
    var first = document.createElement("option");
    first.value = "";
    first.textContent = placeholder;
    select.appendChild(first);
    var byInstrument = {};
    var instrumentIds = [];
    cards.forEach(function (card) {
      var instrumentId = card.instrumentId || "";
      if (!byInstrument[instrumentId]) {
        byInstrument[instrumentId] = [];
        instrumentIds.push(instrumentId);
      }
      byInstrument[instrumentId].push(card);
    });
    instrumentIds.sort(compareInstruments);
    instrumentIds.forEach(function (instrumentId) {
      var members = byInstrument[instrumentId].slice().sort(function (a, b) {
        return compareCitation(a.citation, b.citation, instrumentId) || textOrder(a.id, b.id);
      });
      var group = document.createElement("optgroup");
      group.label = obligationGroupLabel(instrumentId, members.length);
      group.dataset.instrumentId = instrumentId;
      members.forEach(function (card) {
        var option = document.createElement("option");
        option.value = card.id;
        option.textContent = optionText("obligation", card);
        group.appendChild(option);
      });
      select.appendChild(group);
    });
    if (heldOutside) {
      var holdId = heldOutside.instrumentId || "";
      var target = Array.prototype.find.call(select.querySelectorAll("optgroup"), function (node) {
        return node.dataset.instrumentId === holdId;
      });
      if (!target) {
        target = document.createElement("optgroup");
        target.label = obligationGroupLabel(holdId, 1);
        target.dataset.instrumentId = holdId;
        select.appendChild(target);
      }
      var extra = document.createElement("option");
      extra.value = heldOutside.id;
      extra.textContent = optionText("obligation", heldOutside);
      target.appendChild(extra);
    }
  }

  function columnTitle(key, headingName) {
    var text = makeEl("span", "chain-col__text");
    var label = makeEl("span", "chain-col__label", COLUMN_WORD[key].toLowerCase());
    label.setAttribute("aria-hidden", "true");
    text.appendChild(label);
    text.appendChild(makeEl("span", "chain-col__name", headingName));
    return text;
  }

  function renderChain(chain) {
    closeAllCombos();
    chainBoard.textContent = "";
    var chainTitle = focusName();
    chainHeading.textContent = chainTitle ? "Chain for " + chainTitle + (isAllModels() ? "" : " in " + modelFilterLabel()) : "Chain";
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", "chain-svg");
    svg.setAttribute("class", "chain-svg");
    svg.setAttribute("aria-hidden", "true");
    chainBoard.appendChild(svg);
    var noControls = !chain.blank && !chain.controls.length;
    if (noControls) {
      var empty = makeEl("div", "chain-empty-state");
      empty.setAttribute("role", "status");
      empty.appendChild(makeEl("p", "chain-empty-state__title", "No controls mapped yet"));
      empty.appendChild(makeEl("p", "chain-empty-state__text", "No control in the data links to this pick for the selected operating model. Choose another item in any menu."));
      chainBoard.appendChild(empty);
    }
    chainBoard.classList.toggle("chain-board--empty", noControls);
    var columnsWrap = makeEl("div", "chain-columns");
    chainBoard.appendChild(columnsWrap);
    var notes = [];
    if (chain.note) {
      notes.push(chain.note);
    } else if (chain.startKind === "persona") {
      notes.push("These are the controls that name this persona as accountable, with their risks and obligations.");
    } else if (chain.startKind === "obligation") {
      notes.push("These are the controls that cite this obligation, with their risks and accountable personas.");
    } else if (isAllModels()) {
      notes.push("All shows one accountable persona for each operating model. The model name is on that persona. Choose one model to see only that persona.");
    }
    if (chain.startKind === "control") notes.push(CONTROL_SOURCE_NOTE);
    if (chainModelNote) chainModelNote.textContent = notes.filter(Boolean).join(" ");
    var columns = [
      ["Risk", chain.risks, "risk"],
      ["Obligation", chain.obligations, "obligation"],
      ["Control", chain.controls, "control"],
      ["Accountable", chain.personaCards, "accountable"]
    ];
    columns.forEach(function (column) {
      var wrap = makeEl("div", "chain-col");
      var combo = choiceCombobox(column[2], "chain-col-" + column[2]);
      var headingName = column[0] + " (" + combo.count + ")";
      var accessibleName = COLUMN_WORD[column[2]] + ": " + headingName;
      var heading = makeEl("h3");
      heading.appendChild(columnTitle(column[2], headingName));
      heading.setAttribute("aria-label", accessibleName);
      heading.id = "chain-col-" + column[2];
      heading.setAttribute("tabindex", "-1");
      wrap.dataset.column = column[2];
      var narrowChain = narrowQuery.matches;
      var colOpen = !narrowChain || openColumn === column[2];
      var colBody = makeEl("div", "chain-col__body");
      colBody.id = "chain-col-body-" + column[2];
      if (narrowChain) {
        var toggle = makeEl("button", "chain-col__toggle");
        toggle.appendChild(columnTitle(column[2], headingName));
        toggle.type = "button";
        toggle.dataset.column = column[2];
        toggle.setAttribute("aria-label", accessibleName);
        toggle.setAttribute("aria-expanded", colOpen ? "true" : "false");
        toggle.setAttribute("aria-controls", colBody.id);
        heading.textContent = "";
        heading.appendChild(toggle);
        colBody.hidden = !colOpen;
      }
      wrap.appendChild(heading);
      wrap.appendChild(combo.el);
      wrap.appendChild(colBody);
      var boxes = column[1];
      var collapsible = column[2] !== "accountable" && boxes.length > COLUMN_LIMIT;
      var shownItems = collapsible && !expandedColumns[column[2]] ? boxes.slice(0, COLUMN_LIMIT) : boxes;
      shownItems.forEach(function (item) {
        var pressed = chainFocus === item.id;
        var button = cardButton(item.id, pressed);
        if (column[2] === "risk") {
          button.appendChild(makeEl("span", "chain-card__kicker", item.layer ? "Risk record · " + item.layer : "Risk record"));
          button.appendChild(makeEl("span", "chain-card__title", item.name));
          if (item.attackSurface) button.appendChild(makeEl("span", "chain-card__meta", "Attack surface: " + item.attackSurface));
        } else if (column[2] === "obligation") {
          var duty = boxTitle("obligation", item);
          var context = obligationContextLine(item);
          if (context) button.appendChild(makeEl("span", "chain-card__kicker chain-card__instrument", context));
          button.appendChild(makeEl("span", "chain-card__title", duty));
          button.appendChild(makeEl("span", "chain-card__tag", item.instrumentLevel ? "Instrument-level" : "Implements this obligation"));
          (item.basisChips || []).forEach(function (text) {
            button.appendChild(makeEl("span", "chain-card__meta", text));
          });
        } else if (column[2] === "control") {
          button.appendChild(makeEl("span", "chain-card__kicker", [item.layer ? "Operates at " + item.layer : "", item.meta, item.ref].filter(Boolean).join(" · ")));
          button.appendChild(makeEl("span", "chain-card__title", item.name));
          if (graph.hasNode(item.id) && outsideCurrentFilter(graph.getNodeAttributes(item.id))) {
            button.appendChild(makeEl("span", "chain-card__meta chain-card__outside", "Outside current filter"));
          }
          if (item.evidenceText) button.appendChild(makeEl("span", "chain-card__meta", item.evidenceText));
          if (item.sectorModels.length) {
            button.appendChild(makeEl("span", "chain-card__meta", "Sector: " + item.sectorModels.map(function (row) {
              return row.name;
            }).join(", ")));
          }
        } else {
          var one = item.lines.length === 1 ? item.lines[0] : null;
          button.appendChild(makeEl("span", "chain-card__kicker", one ? one.label : item.controlName));
          button.appendChild(makeEl("span", "chain-card__title", one ? (one.missing ? "No persona recorded" : one.name) : "One persona per model"));
          if (one && !one.missing && one.personaId && graph.hasNode("persona:" + one.personaId)) {
            var personaLayers = graph.getNodeAttribute("persona:" + one.personaId, "srfLayers") || [];
            if (personaLayers.length) button.appendChild(makeEl("span", "chain-card__meta", "Layers recorded: " + personaLayers.join(", ")));
          }
          if (!one) {
            item.lines.forEach(function (line) {
              button.appendChild(makeEl("span", "chain-owner", line.label + ": " + (line.missing ? "No persona recorded" : line.name)));
            });
          }
          if (item.linkBasis) {
            button.appendChild(makeEl("span", "chain-card__meta", "Control to persona. No source citation recorded yet. The control's source record names this persona."));
          }
        }
        appendCardBadges(button, item, column[2], chain);
        if (chain.startKind === "persona" && column[2] === "accountable" && item.id === "accountable:persona:" + personaPick) {
          var roleLine = personaModelRoles(personaPick, chain);
          if (roleLine) button.appendChild(makeEl("span", "chain-card__meta chain-card__accountability", roleLine));
        }
        if ((column[2] === "control" || column[2] === "accountable") && item.tapestry) {
          button.appendChild(makeEl("span", "chain-card__tag chain-card__badge", EXTENSION_BADGE));
          button.dataset.extension = "1";
        }
        colBody.appendChild(button);
      });
      if (collapsible) {
        var more = makeEl("button", "chain-more", expandedColumns[column[2]]
          ? "Show fewer"
          : "Show " + (column[1].length - COLUMN_LIMIT) + " more");
        more.type = "button";
        more.dataset.moreColumn = column[2];
        more.setAttribute("aria-expanded", expandedColumns[column[2]] ? "true" : "false");
        colBody.appendChild(more);
      }
      if (!column[1].length && chain.columnNotes && chain.columnNotes[column[2]]) {
        colBody.appendChild(makeEl("p", "chain-card__meta", chain.columnNotes[column[2]]));
      }
      chain.gaps.forEach(function (gap) {
        if (gap.column !== column[2]) return;
        var note = makeEl("p", "chain-gap");
        note.appendChild(makeEl("span", "chain-gap__label", "Gap"));
        note.appendChild(document.createTextNode(" " + gap.text));
        colBody.appendChild(note);
      });
      columnsWrap.appendChild(wrap);
    });
    requestAnimationFrame(function () {
      drawChainLines();
      requestAnimationFrame(drawChainLines);
    });
  }

  function setOpenColumn(key) {
    openColumn = key;
    Array.prototype.forEach.call(chainBoard.querySelectorAll(".chain-col"), function (col) {
      var open = col.dataset.column === key;
      var body = col.querySelector(".chain-col__body");
      var toggle = col.querySelector(".chain-col__toggle");
      if (body) body.hidden = !open;
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function chainCard(id) {
    var cards = chainBoard.querySelectorAll("button[data-chain-id]");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.chainId === id) return cards[i];
    }
    return null;
  }

  function drawChainLines() {
    if (!currentChain || !chainBoard) return;
    var svg = document.getElementById("chain-svg");
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (window.matchMedia("(max-width: 800px)").matches) return;
    var origin = chainBoard.getBoundingClientRect();
    var width = chainBoard.clientWidth;
    var height = chainBoard.scrollHeight;
    if (!width || !height) return;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    currentChain.edges.forEach(function (edge) {
      var from = chainCard(edge.from);
      var to = chainCard(edge.to);
      if (!from || !to) return;
      var ar = from.getBoundingClientRect();
      var br = to.getBoundingClientRect();
      var x1 = ar.right - origin.left;
      var y1 = ar.top + ar.height / 2 - origin.top;
      var x2 = br.left - origin.left;
      var y2 = br.top + br.height / 2 - origin.top;
      var mid = (x1 + x2) / 2;
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M " + x1 + " " + y1 + " C " + mid + " " + y1 + ", " + mid + " " + y2 + ", " + x2 + " " + y2);
      path.setAttribute("class", "chain-line chain-line--" + edge.style);
      path.setAttribute("data-from", edge.from);
      path.setAttribute("data-to", edge.to);
      svg.appendChild(path);
    });
  }

  function appendSentence(parent, text) {
    if (!text) return;
    parent.appendChild(makeEl("p", "", text));
  }

  function glanceLines(chain) {
    if (chain.startKind !== "risk" && chain.startKind !== "control") return [];
    var where = isAllModels() ? "across all operating models" : "in " + modelFilterLabel();
    var lines = [];
    if (chain.startKind === "risk") {
      lines.push(chain.controls.length
        ? unit(chain.controls.length, "control applies", "controls apply") + " " + where + "."
        : "No control is linked to this risk " + where + ".");
    } else {
      lines.push("This control covers " + unit(chain.risks.length, "risk", "risks") + ", " + where + ".");
    }
    var byModel = {};
    var order = [];
    chain.personaCards.forEach(function (card) {
      card.lines.forEach(function (line) {
        if (line.missing) return;
        if (!byModel[line.label]) {
          byModel[line.label] = [];
          order.push(line.label);
        }
        if (byModel[line.label].indexOf(line.name) === -1) byModel[line.label].push(line.name);
      });
    });
    if (order.length) {
      lines.push("Accountable: " + order.map(function (label) {
        return (isAllModels() || selectedModels.length > 1 ? label + ": " : "") + byModel[label].join(" and ");
      }).join("; ") + ".");
    } else if (chain.startKind === "risk" && chain.risks[0]) {
      var owners = chain.risks[0].owners.filter(function (owner) { return owner.name; }).map(function (owner) {
        return owner.label + ": " + owner.name;
      });
      lines.push(owners.length ? "No persona is recorded on a control. The risk record names " + owners.join("; ") + " as context." : "No accountable persona is recorded.");
    } else {
      lines.push("No accountable persona is recorded.");
    }
    return lines;
  }

  function renderChainDetails(chain) {
    detailsChain.hidden = false;
    detailsChain.className = "details-chain";
    detailsChain.textContent = "";
    connectionsHeading.hidden = true;
    detailsList.hidden = true;
    var focus = focusedChainItem(chain);
    var controlAttrs = root && graph.hasNode(root) && graph.getNodeAttribute(root, "kind") === "control"
      ? graph.getNodeAttributes(root)
      : null;
    if (focus && focus.kind === "control" && graph.hasNode(focus.item.id)) {
      controlAttrs = graph.getNodeAttributes(focus.item.id);
    }

    if (detailsId) {
      var idText = "";
      if (focus && focus.kind === "control") idText = (focus.item.vertical || "") + ":" + (focus.item.ref || "");
      else if (focus && focus.kind === "risk") idText = focus.item.ref || "";
      else if (!focus && controlAttrs) idText = controlAttrs.vertical + ":" + controlAttrs.ref;
      if (idText && idText !== ":") {
        detailsId.hidden = false;
        detailsId.textContent = "ID: " + idText;
      }
    }

    var glance = glanceLines(chain);
    if (glance.length) {
      var glanceBlock = sectionBlock("At a glance", "details-glance");
      glance.forEach(function (line) { appendSentence(glanceBlock, line); });
      detailsChain.appendChild(glanceBlock);
    }

    var about = sectionBlock("Description and objective", "details-about");
    if (focus && focus.kind === "obligation") {
      var dutyLine = boxTitle("obligation", focus.item);
      appendSentence(about, obligationRecordLabel(focus.item) || focus.item.citation || "Obligation record.");
      if (focus.item.summary && focus.item.summary !== dutyLine) appendSentence(about, focus.item.summary);
    } else if (focus && focus.kind === "risk") {
      if (focus.item.attackSurface) appendSentence(about, "Attack surface: " + focus.item.attackSurface + ".");
      if (focus.item.mappings && focus.item.mappings.length) {
        focus.item.mappings.forEach(function (line) { appendSentence(about, line + "."); });
      } else {
        appendSentence(about, "No separate objective text is stored on this risk record.");
      }
    } else if (controlAttrs && controlAttrs.description) {
      if (controlAttrs.description.length > 280) {
        appendSentence(about, controlAttrs.description.slice(0, 220).replace(/\s+\S*$/, "") + "…");
        appendFold(about, "Full description", [controlAttrs.description]);
      } else {
        appendSentence(about, controlAttrs.description);
      }
    } else {
      appendSentence(about, "Choose a card or a menu entry in the chain to see its record.");
    }

    var meta = sectionBlock("Key metadata", "details-metadata");
    if (focus && focus.kind === "risk") {
      appendSentence(meta, layerSentence(focus.item.layer));
      if (focus.item.affected && focus.item.affected.length) {
        appendSentence(meta, "Affected layers recorded on this risk: " + focus.item.affected.join(", ") + ".");
      }
      appendSentence(meta, "Operating model filter: " + modelFilterLabel("All") + ".");
    } else if (focus && focus.kind === "control") {
      appendSentence(meta, layerSentence(focus.item.layer));
      appendSentence(meta, [focus.item.meta, focus.item.ref].filter(Boolean).join(" · "));
      appendSentence(meta, "Operating model filter: " + modelFilterLabel("All") + ".");
      (focus.item.sectorModels || []).forEach(function (row) {
        appendSentence(meta, "Sector model " + row.name + " is mapped to " + modelName(row.srf) + " by data/sector-model-map.json. The sector name stays on this control.");
      });
    } else if (focus && focus.kind === "obligation") {
      appendSentence(meta, "Operating model filter: " + modelFilterLabel("All") + ".");
    } else if (controlAttrs) {
      appendSentence(meta, layerSentence(controlAttrs.layer));
      appendSentence(meta, [controlAttrs.meta, controlAttrs.ref].filter(Boolean).join(" · "));
    } else {
      appendSentence(meta, "Operating model filter: " + modelFilterLabel("All") + ".");
    }
    if (focus && (focus.kind === "control" || focus.kind === "accountable") && focus.item.tapestry) {
      appendSentence(meta, EXTENSION_BADGE);
    }

    var account = sectionBlock("Accountability", "details-accountability");
    if (chain.startKind === "persona") {
      chain.personaCards.forEach(function (item) {
        item.lines.forEach(function (line) {
          var row = makeEl("p", "");
          row.appendChild(document.createTextNode(line.label + ": "));
          row.appendChild(makeLink("/personas/#" + line.personaId, line.name));
          row.appendChild(document.createTextNode(item.tapestry
            ? ". The control record names this persona."
            : ". The control record names this persona for " + line.label + "."));
          account.appendChild(row);
        });
      });
    } else {
      var groups = {};
      var groupOrder = [];
      chain.personaCards.forEach(function (item) {
        item.lines.forEach(function (line) {
          var key = line.label + "|" + (line.missing ? "none" : line.personaId);
          if (!groups[key]) {
            groups[key] = { line: line, count: 0 };
            groupOrder.push(key);
          }
          groups[key].count += 1;
        });
      });
      var layersShown = {};
      groupOrder.forEach(function (key) {
        var line = groups[key].line;
        var count = groups[key].count;
        var row = makeEl("p", "");
        if (line.missing) {
          row.textContent = line.label + ": no accountable persona is recorded on " + unit(count, "control", "controls") + ".";
        } else {
          row.appendChild(document.createTextNode(line.label + ": "));
          row.appendChild(makeLink("/personas/#" + line.personaId, line.name));
          row.appendChild(document.createTextNode(". Named on " + unit(count, "control", "controls") + " in this chain."));
        }
        account.appendChild(row);
        if (!line.missing && line.personaId && !layersShown[line.personaId] && graph.hasNode("persona:" + line.personaId)) {
          layersShown[line.personaId] = true;
          var recorded = graph.getNodeAttribute("persona:" + line.personaId, "srfLayers") || [];
          if (recorded.length) appendSentence(account, "Layers recorded for " + line.name + ": " + recorded.join(", ") + ".");
        }
      });
      if (chain.personaCards.length) {
        appendSentence(account, "Control to persona. No source citation recorded yet. Each persona comes from controls that name it as accountable.");
      }
    }
    if (!chain.personaCards.length) {
      appendSentence(account, "No accountable persona is recorded for the selected operating model.");
    }
    chain.risks.forEach(function (item) {
      item.owners.forEach(function (owner) {
        var sentence = "Risk owner in " + owner.label + ": " + (owner.name || "none recorded") + ". ";
        sentence += owner.gap
          ? "Confirmed coverage gap. No linked control is recorded for this risk in this operating model."
          : "This is context. The accountable persona above is the one on the control.";
        if (owner.sharedContext) sentence += " The matrix records shared responsibility as context. It does not add a second owner.";
        appendSentence(account, sentence);
      });
    });

    var relatedTitle = chain.startKind === "control" ? "Risks this control covers"
      : chain.startKind === "risk" ? "Controls for this risk" : "Related risks and controls";
    var related = sectionBlock(relatedTitle, "details-related");
    var relatedList = makeEl("ul", "");
    function addRelated(item, word) {
      var li = makeEl("li", "");
      if (graph.hasNode(item.id)) li.appendChild(relatedButton(item.id, item.name));
      else li.appendChild(makeEl("strong", "", item.name));
      li.appendChild(document.createTextNode(" (" + word + ")"));
      relatedList.appendChild(li);
    }
    if (chain.startKind !== "risk") chain.risks.forEach(function (item) { addRelated(item, "risk"); });
    if (chain.startKind !== "control") chain.controls.forEach(function (item) { addRelated(item, "control"); });
    if (!relatedList.childNodes.length) {
      var emptyText = chain.startKind === "control" ? "No risk record names this control."
        : chain.startKind === "risk" ? "No control is linked to this risk for the selected operating model."
        : "No related risk or control is in this chain.";
      relatedList.appendChild(makeEl("li", "", emptyText));
    }
    related.appendChild(relatedList);
    var focusedVia = focus && (focus.kind === "risk" || focus.kind === "control") && focus.item.viaObligations && focus.item.viaObligations.length
      ? focus.item.viaObligations : null;
    if (focusedVia) {
      appendSentence(related, viaSentence(focusedVia));
    } else if ((chain.startKind === "risk" || chain.startKind === "control") && directRiskControl(chain)) {
      appendSentence(related, NO_CONTROL_BASIS);
    }

    var duties = sectionBlock("Supporting obligations", "details-obligations");
    var dutyList = makeEl("ul", "");
    chain.obligations.forEach(function (item) {
      var li = makeEl("li", "");
      li.appendChild(makeEl("strong", "", obligationRecordLabel(item)));
      if (item.instrumentLevel) {
        appendSentence(li, "Instrument-level. The control cites this instrument, and no article record matched.");
        if (item.citationText) appendSentence(li, "Citation on the control: " + item.citationText);
      } else {
        (item.basisSentences || []).forEach(function (text) { appendSentence(li, text); });
        if (item.citationText) appendSentence(li, "Citation on the control: " + item.citationText);
      }
      if (item.url) {
        var duty = makeEl("p", "");
        duty.appendChild(document.createTextNode("Source: "));
        duty.appendChild(makeLink(item.url, item.instrumentLevel ? "Instrument" : "Obligation text"));
        li.appendChild(duty);
      }
      dutyList.appendChild(li);
    });
    if (!dutyList.childNodes.length) {
      chain.gaps.filter(function (gap) { return gap.column === "obligation"; }).forEach(function (gap) {
        var item = makeEl("li", "");
        var note = makeEl("p", "chain-gap");
        note.appendChild(makeEl("span", "chain-gap__label", "Gap"));
        note.appendChild(document.createTextNode(" " + gap.text));
        item.appendChild(note);
        dutyList.appendChild(item);
      });
      if (!dutyList.childNodes.length) dutyList.appendChild(makeEl("li", "", "No obligation is recorded on this chain."));
    }
    duties.appendChild(dutyList);

    var sources = sectionBlock("Sources and relationship provenance", "details-sources");
    chain.risks.forEach(function (item) {
      if (!item.url) return;
      var source = makeEl("p", "");
      source.appendChild(document.createTextNode("Risk source: "));
      source.appendChild(makeLink(item.url, item.sourceLabel || "Risk definition"));
      sources.appendChild(source);
      if (item.attacks && item.attacks.length) {
        appendFold(sources, "Attack inventory rows", item.attacks.map(function (attack) {
          var line = attack.name + " (" + attack.id + ")";
          if (attack.refs.length) line += ". " + attack.refs.join("; ");
          return line;
        }));
      } else {
        appendSentence(sources, "No attack-inventory row names this risk in srf_crosswalk.");
      }
    });
    chain.controls.forEach(function (item) {
      var page = makeEl("p", "");
      page.appendChild(document.createTextNode("Control page: "));
      page.appendChild(makeLink(item.url, item.name));
      sources.appendChild(page);
      if (item.evidenceText) appendSentence(sources, item.evidenceText);
      if (item.evidenceDetail) appendFold(sources, "Evidence detail", [item.evidenceDetail]);
      if (item.crossLayerNote) appendSentence(sources, "Cross-layer note on this control: " + item.crossLayerNote);
    });
    chain.obligations.forEach(function (item) {
      (item.basisSentences || []).forEach(function (text) { appendSentence(sources, text); });
      if (item.sources && item.sources.length) {
        var through = makeEl("p", "", "Obligation through these controls:");
        sources.appendChild(through);
        var sub = makeEl("ul", "");
        item.sources.slice().sort(function (x, y) {
          if (x.nodeId && y.nodeId && graph.hasNode(x.nodeId) && graph.hasNode(y.nodeId)) return compareControlIds(x.nodeId, y.nodeId);
          if (!!x.nodeId !== !!y.nodeId) return x.nodeId ? -1 : 1;
          return textOrder(x.name, y.name);
        }).forEach(function (source) {
          var row = makeEl("li", "");
          if (source.vertical && source.ref) row.appendChild(makeLink(controlPageUrl(source.vertical, source.ref), source.name));
          else row.appendChild(document.createTextNode(source.name));
          if (source.citation) row.appendChild(document.createTextNode(". Citation: " + source.citation));
          if (!source.inChain) row.appendChild(document.createTextNode(". This control is not in the selected operating model."));
          sub.appendChild(row);
        });
        sources.appendChild(sub);
      }
    });
    appendSentence(sources, chainSentence(chain));
    [related, account, about, meta, duties, sources].forEach(function (section) { detailsChain.appendChild(section); });
  }

  function chainSentence(chain) {
    var personaBit = (isAllModels() || selectedModels.length > 1) && chain.startKind !== "persona"
      ? chain.personaCount + (chain.personaCount === 1 ? " accountable persona" : " accountable personas") + ", one for each model on a shown control"
      : unit(chain.personaCount, "accountable persona", "accountable personas");
    var text = "Showing " + unit(chain.risks.length, "risk", "risks") + ", " +
      unit(chain.obligations.length, "obligation", "obligations") + ", " +
      unit(chain.controls.length, "control", "controls") + ", and " + personaBit + ".";
    if (chain.gaps.length) text += " " + unit(chain.gaps.length, "gap is labeled.", "gaps are labeled.");
    return text;
  }

  function focusedChainName(chain) {
    var pools = [chain.risks, chain.obligations, chain.controls, chain.personaCards];
    for (var i = 0; i < pools.length; i++) {
      for (var j = 0; j < pools[i].length; j++) {
        if (pools[i][j].id === chainFocus) {
          var item = pools[i][j];
          if (item.instrumentId || (item.id && /^(obligation|instrument):/.test(item.id))) {
            return obligationRecordLabel(item);
          }
          return item.name || item.title || item.controlName || "";
        }
      }
    }
    return "";
  }

  function placeDetailsPanel(inChain) {
    if (!detailsEl || !detailsSlot || !mapPanel) return;
    detailsEl.classList.toggle("details--in-chain", !!inChain);
    if (inChain) {
      if (detailsEl.parentNode !== detailsSlot) detailsSlot.appendChild(detailsEl);
    } else if (detailsEl.parentNode !== mapPanel) {
      mapPanel.insertBefore(detailsEl, chainWorkspace);
    }
  }

  function placeDetails() {
    if (!detailsEl) return;
    detailsEl.style.top = "";
    detailsEl.style.maxHeight = "";
  }

  function appendFold(parent, label, lines) {
    if (!lines || !lines.length) return;
    var fold = makeEl("details", "details-fold");
    fold.appendChild(makeEl("summary", "", label));
    lines.forEach(function (line) {
      if (typeof line === "string") appendSentence(fold, line);
      else fold.appendChild(line);
    });
    parent.appendChild(fold);
  }

  function relatedButton(nodeId, label) {
    var button = makeEl("button", "details-related", label);
    button.type = "button";
    button.dataset.nodeId = nodeId;
    return button;
  }

  function sectionBlock(title, id) {
    var section = makeEl("section", "details-section");
    var heading = makeEl("h3", "", title);
    if (id) heading.id = id;
    section.appendChild(heading);
    return section;
  }

  function hasFocus() {
    return !!(root || personaPick || reqPick);
  }

  function focusedChainItem(chain) {
    var pools = [
      ["risk", chain.risks],
      ["obligation", chain.obligations],
      ["control", chain.controls],
      ["accountable", chain.personaCards]
    ];
    for (var i = 0; i < pools.length; i++) {
      for (var j = 0; j < pools[i][1].length; j++) {
        if (pools[i][1][j].id === chainFocus) return { kind: pools[i][0], item: pools[i][1][j] };
      }
    }
    if (root && graph.hasNode(root)) {
      var attrs = graph.getNodeAttributes(root);
      if (attrs.kind === "risk") {
        for (var r = 0; r < chain.risks.length; r++) if (chain.risks[r].id === root) return { kind: "risk", item: chain.risks[r] };
      }
      if (attrs.kind === "control") {
        for (var c = 0; c < chain.controls.length; c++) if (chain.controls[c].id === root) return { kind: "control", item: chain.controls[c] };
      }
    }
    if (reqPick && chain.obligations.length) return { kind: "obligation", item: chain.obligations[0] };
    if (personaPick && chain.personaCards.length) return { kind: "accountable", item: chain.personaCards[0] };
    if (chain.controls.length) return { kind: "control", item: chain.controls[0] };
    if (chain.risks.length) return { kind: "risk", item: chain.risks[0] };
    return null;
  }

  function renderDetails() {
    var canClear = !!(hasFocus() || view === "context");
    var chainOpen = view === "chain" && currentChain && !currentChain.blank && hasFocus();
    if (copyBtn) copyBtn.hidden = !chainOpen;
    if (csvDownloadBtn) csvDownloadBtn.hidden = !chainOpen;
    var copyKey = root || personaPick || reqPick || "";
    if (copyKey !== lastCopyKey) {
      lastCopyKey = copyKey;
      if (copyBtn) resetCopyState();
      if (copyFallback) copyFallback.hidden = true;
    }
    if (clearChainBtn) clearChainBtn.disabled = !canClear;
    if (detailsId) {
      detailsId.hidden = true;
      detailsId.textContent = "";
    }
    if (view === "chain" && currentChain && !currentChain.blank && hasFocus()) {
      var rootAttrs = root && graph.hasNode(root) ? graph.getNodeAttributes(root) : null;
      var focusedName = focusedChainName(currentChain);
      detailsHeading.textContent = focusedName || focusName();
      detailsEmpty.hidden = true;
      detailsBody.hidden = false;
      var focusKind = "";
      if (focusedName && chainFocus !== root && chainFocus !== reqPick) {
        if (chainFocus.indexOf("instrument:") === 0 || chainFocus.indexOf("obligation:") === 0) focusKind = "Obligation";
        else if (chainFocus.indexOf("accountable:") === 0) focusKind = "Accountable";
        else if (chainFocus.indexOf("risk:") === 0) focusKind = "Risk";
        else focusKind = "Control";
      }
      detailsKind.textContent = focusKind || (rootAttrs ? (KIND_LABEL[rootAttrs.kind] || rootAttrs.kind) : reqPick ? "Obligation" : "Accountable");
      var extensionFocus = false;
      var focusItem = focusedChainItem(currentChain);
      if (focusItem && (focusItem.kind === "control" || focusItem.kind === "accountable") && focusItem.item.tapestry) extensionFocus = true;
      detailsMeta.hidden = !extensionFocus;
      detailsMeta.textContent = extensionFocus ? EXTENSION_BADGE : "";
      detailsMeta.classList.toggle("is-extension", extensionFocus);
      detailsModelNote.hidden = true;
      detailsModelNote.textContent = "";
      connectionsHeading.hidden = true;
      detailsList.hidden = true;
      renderChainDetails(currentChain);
      if (copyStatus) copyStatus.textContent = chainSentence(currentChain);
      placeDetails();
      return;
    }
    detailsChain.hidden = true;
    detailsChain.textContent = "";
    connectionsHeading.hidden = false;
    detailsList.hidden = false;
    if (!selected || !graph.hasNode(selected)) {
      detailsHeading.textContent = "Node details";
      detailsEmpty.hidden = false;
      detailsEmpty.textContent = "Choose a column item to see its record, sources, and links.";
      detailsBody.hidden = true;
      if (copyStatus) copyStatus.textContent = "";
      detailsList.textContent = "";
      detailsModelNote.hidden = true;
      detailsModelNote.textContent = "";
      placeDetails();
      return;
    }
    var attrs = graph.getNodeAttributes(selected);
    detailsHeading.textContent = attrs.name;
    detailsEmpty.hidden = true;
    detailsBody.hidden = false;
    detailsKind.textContent = KIND_LABEL[attrs.kind] || attrs.kind;
    if (detailsId && attrs.ref) {
      detailsId.hidden = false;
      detailsId.textContent = "ID: " + (attrs.kind === "control" ? (attrs.vertical + ":" + attrs.ref) : attrs.ref);
    }
    var meta = [];
    if (attrs.meta) meta.push(attrs.meta);
    if (attrs.layer) meta.push(layerSentence(attrs.layer) || attrs.layer);
    if (attrs.provenance === "proposed-extension" || isTapestryRecord(attrs)) meta.push(EXTENSION_BADGE);
    if (meta.length) {
      detailsMeta.hidden = false;
      detailsMeta.textContent = meta.join(" · ");
    } else {
      detailsMeta.hidden = true;
      detailsMeta.textContent = "";
    }
    detailsMeta.classList.toggle("is-extension", meta.indexOf(EXTENSION_BADGE) !== -1);
    var gap = outsideFilter(attrs) ? GAP_NOTE : "";
    detailsModelNote.hidden = !gap;
    detailsModelNote.textContent = gap;

    detailsChain.hidden = false;
    detailsChain.className = "details-chain";
    detailsChain.textContent = "";
    if (attrs.description) {
      var about = sectionBlock("Description", "details-about");
      if (attrs.description.length > 280) {
        appendSentence(about, attrs.description.slice(0, 220).replace(/\s+\S*$/, "") + "…");
        appendFold(about, "Full description", [attrs.description]);
      } else {
        appendSentence(about, attrs.description);
      }
      detailsChain.appendChild(about);
    }

    var rows = [];
    graph.forEachEdge(selected, function (edge, attr, source, target) {
      var otherId = source === selected ? target : source;
      if (!graph.hasNode(otherId)) return;
      var other = graph.getNodeAttributes(otherId);
      if (!nodeAllowed(other)) return;
      rows.push({
        id: otherId,
        kind: other.kind,
        name: other.name,
        text: other.name + " (" + (KIND_LABEL[other.kind] || other.kind) + "). " + relationPhrase(selected, attr)
      });
    });
    rows.sort(function (a, b) {
      var ak = KIND_ORDER.indexOf(a.kind);
      var bk = KIND_ORDER.indexOf(b.kind);
      if (ak !== bk) return ak - bk;
      if (a.kind === "control" && b.kind === "control") return compareControlIds(a.id, b.id);
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    detailsList.textContent = "";
    if (!rows.length) {
      var empty = document.createElement("li");
      empty.textContent = "No connections in the site data.";
      detailsList.appendChild(empty);
    } else {
      rows.forEach(function (row) {
        var li = document.createElement("li");
        if (row.kind === "risk" || row.kind === "control") {
          li.appendChild(relatedButton(row.id, row.name));
          li.appendChild(document.createTextNode(" (" + (KIND_LABEL[row.kind] || row.kind) + "). " + row.text.replace(row.name + " (" + (KIND_LABEL[row.kind] || row.kind) + "). ", "")));
        } else {
          li.textContent = row.text;
        }
        detailsList.appendChild(li);
      });
    }
    var summary = attrs.name + ". " + (KIND_LABEL[attrs.kind] || attrs.kind) + ". " + rows.length + " connections.";
    if (gap) summary += " " + gap;
    if (copyStatus) copyStatus.textContent = summary;
    placeDetails();
  }

  function countNodes(pred) {
    var counts = { layer: 0, persona: 0, model: 0, risk: 0, control: 0, policy: 0, topic: 0, total: 0 };
    graph.forEachNode(function (id, attrs) {
      if (!pred(id, attrs)) return;
      counts[attrs.kind] = (counts[attrs.kind] || 0) + 1;
      counts.total += 1;
    });
    return counts;
  }

  function tapestryInclusionNote() {
    if (!showTapestry || !graph) return "";
    var controls = 0;
    var personas = 0;
    suggestedIds().forEach(function (id) {
      if (isTapestryRecord(graph.getNodeAttributes(id))) controls += 1;
    });
    personaChoiceIds().forEach(function (id) {
      if (isTapestryRecord(graph.getNodeAttributes(id))) personas += 1;
    });
    if (!controls && !personas) return "";
    var parts = [];
    if (controls) parts.push(unit(controls, "Tapestry control", "Tapestry controls"));
    if (personas) parts.push(unit(personas, "Tapestry persona", "Tapestry personas"));
    var joined = parts.length > 1 ? parts[0] + " and " + parts[1] : parts[0];
    return " " + joined + (controls + personas === 1 ? " is included." : " are included.");
  }

  function publish() {
    var allowed = countNodes(function (id, attrs) { return nodeAllowed(attrs); });
    var text = "";
    if (view === "chain" && currentChain && !currentChain.blank) {
      text = chainSentence(currentChain);
    } else if (view === "chain" && currentChain) {
      text = currentChain.note || "Map ready.";
    } else if (view === "context") {
      text = "Layers run from L1 to L5. Open a name to see its chain.";
    } else {
      text = "Choose a risk, an obligation, a control, or a persona to see its chain.";
    }
    text += tapestryInclusionNote();
    statusEl.textContent = text;
    statusEl.dataset.view = view;
    statusEl.dataset.model = modelFilterKey();
    statusEl.dataset.layer = layerFilterKey();
    statusEl.dataset.tapestry = showTapestry ? "1" : "0";
    statusEl.dataset.root = root || "";
    statusEl.dataset.persona = personaPick || "";
    statusEl.dataset.selected = selected || "";
    statusEl.dataset.totalControls = String(stats.controls);
    statusEl.dataset.srfControls = String(stats.srfControls);
    statusEl.dataset.sectorOnly = String(stats.sectorOnly);
    statusEl.dataset.noModels = String(stats.noModels);
    statusEl.dataset.tapestryControls = String(stats.tapestryControls);
    statusEl.dataset.tapestryPersonas = String(stats.tapestryPersonas);
    statusEl.dataset.allowedControls = String(allowed.control || 0);
    statusEl.dataset.skippedModels = Object.keys(skippedModels).sort().join(",");
    statusEl.dataset.missingLinks = String(missingLinks.length);
    statusEl.dataset.mappedFromSector = String(stats.mappedFromSector || 0);
    var shownNow = currentChain;
    statusEl.dataset.chainRisks = shownNow ? String(shownNow.risks.length) : "";
    statusEl.dataset.chainObligations = shownNow ? String(shownNow.obligations.length) : "";
    statusEl.dataset.chainControls = shownNow ? String(shownNow.controls.length) : "";
    statusEl.dataset.chainPersonas = shownNow ? String(shownNow.personaCount) : "";
    statusEl.dataset.chainGaps = currentChain ? String(currentChain.gaps.length) : "";
    statusEl.dataset.chainDashed = currentChain ? String(currentChain.dashed) : "";
    statusEl.dataset.chainFallbacks = currentChain ? String(currentChain.fallbacks) : "";
    statusEl.dataset.chainGapText = currentChain ? currentChain.gaps.map(function (gap) { return gap.text; }).join(" | ") : "";
    var suggested = suggestedIds();
    statusEl.dataset.suggested = suggested.join(",");
  }

  function suggestedIds() {
    var every = [];
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind !== "control" || !nodeAllowed(attrs) || !layerAllowed(attrs)) return;
      if (isAllModels() && !(attrs.coreModels && attrs.coreModels.length) && !isTapestryRecord(attrs)) return;
      if (!attrs.layer) return;
      every.push(id);
    });
    return every.sort(compareControlIds);
  }

  /* Display order for every control list: layer L1 to L5, then the common
    group (data/common-controls.json), then one group per sector file by sector
    name, then title. A control's group is its source file (item.vertical, from
    CONTROL_FILES), not the operating models it lists. Common controls and
    controls that list only the 4 SRF models stay in their own file's group. */
  function controlSector(item) {
    return item && item.vertical ? String(item.meta || "") : "";
  }

  function layerRank(layerId) {
    var i = LAYERS.indexOf(layerId);
    return i === -1 ? 99 : i;
  }

  function textOrder(a, b) {
    return String(a).localeCompare(String(b), "en", { sensitivity: "base" });
  }

  function sectorRank(name) {
    return !name ? 2 : name === COMMON_SECTOR ? 0 : 1;
  }

  function compareSectors(a, b) {
    var rank = sectorRank(a) - sectorRank(b);
    return rank || textOrder(a, b);
  }

  function compareControls(x, y) {
    var ln = layerRank(x.layer) - layerRank(y.layer);
    if (ln) return ln;
    var sn = compareSectors(controlSector(x), controlSector(y));
    if (sn) return sn;
    var nn = textOrder(x.name, y.name);
    if (nn) return nn;
    var mn = textOrder(x.meta || "", y.meta || "");
    if (mn) return mn;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  }

  function compareControlNodes(a, b) {
    function plain(node) {
      return { id: node.id, layer: node.attrs.layer, name: node.attrs.name, meta: node.attrs.meta, vertical: node.attrs.vertical };
    }
    return compareControls(plain(a), plain(b));
  }

  function controlWithId(id) {
    var attrs = graph.getNodeAttributes(id);
    return { id: id, layer: attrs.layer, name: attrs.name, meta: attrs.meta, vertical: attrs.vertical };
  }

  function compareControlIds(a, b) {
    return compareControls(controlWithId(a), controlWithId(b));
  }

  function sortChainControls(chain) {
    chain.controls.sort(compareControls);
  }

  function layerName(layerId) {
    if (!graph || !graph.hasNode("layer:" + layerId)) return layerId;
    return graph.getNodeAttribute("layer:" + layerId, "name");
  }

  var SEARCH_KINDS = [["risk", "Risks"], ["obligation", "Obligations"], ["control", "Controls"], ["persona", "Accountable personas"]];

  function obligationName(card) {
    var duty = boxTitle("obligation", card);
    var short = instrumentShortName(card.instrumentId);
    var name = card.citation && card.citation !== duty ? card.citation + ": " + duty : duty;
    return short ? short + " \u00b7 " + name : name;
  }

  /* Search results can be graph records or obligation cards, which are not graph nodes. */
  function searchAttrs(id) {
    if (graph.hasNode(id)) return graph.getNodeAttributes(id);
    obligationChoiceCards();
    var card = obligationChoiceCache.byId[id];
    if (!card) return { kind: "", name: id, search: "" };
    return {
      kind: "obligation",
      name: obligationName(card),
      meta: card.instrumentLevel ? "Instrument level" : "",
      ref: "",
      layer: "",
      search: [card.citation, card.title, card.summary, card.citationText, instrumentSearchText(card.instrumentId)].filter(Boolean).join(" ").toLowerCase()
    };
  }

  function fillButton(button, id) {
    var attrs = searchAttrs(id);
    button.type = "button";
    button.dataset.nodeId = id;
    var title = document.createElement("span");
    title.textContent = (attrs.kind === "control" || attrs.kind === "risk") && attrs.layer
      ? attrs.layer + " · " + attrs.name
      : attrs.name + " · " + (KIND_LABEL[attrs.kind] || attrs.kind);
    button.appendChild(title);
    var bits = [];
    if (attrs.meta) bits.push(attrs.meta);
    if (attrs.ref) bits.push(attrs.ref);
    if (outsideFilter(attrs)) bits.push("Not in a model filter");
    if (bits.length) {
      var meta = document.createElement("span");
      meta.className = "suggestion-meta";
      meta.textContent = bits.join(" · ");
      button.appendChild(meta);
    }
  }

  var optionSeq = 0;

  function hideResults() {
    searchResults.hidden = true;
    searchResults.textContent = "";
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function optionEls() {
    return Array.prototype.slice.call(searchResults.querySelectorAll('[role="option"]'));
  }

  function setActive(index) {
    var opts = optionEls();
    if (index >= opts.length) index = opts.length - 1;
    if (index < -1) index = -1;
    opts.forEach(function (el, i) {
      el.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    activeIndex = index;
    if (index < 0) {
      searchInput.removeAttribute("aria-activedescendant");
      return;
    }
    searchInput.setAttribute("aria-activedescendant", opts[index].id);
    opts[index].scrollIntoView({ block: "nearest" });
  }

  function renderIdList(ids, perGroup) {
    searchResults.textContent = "";
    activeIndex = -1;
    searchInput.removeAttribute("aria-activedescendant");
    var shown = 0;
    SEARCH_KINDS.forEach(function (group) {
      var members = ids.filter(function (id) {
        return searchAttrs(id).kind === group[0];
      });
      if (!members.length) return;
      var wrap = document.createElement("div");
      wrap.setAttribute("role", "group");
      var label = document.createElement("div");
      label.className = "listbox-group__label";
      label.id = "listbox-label-" + group[0];
      label.textContent = group[1] + " (" + members.length + ")";
      wrap.setAttribute("aria-labelledby", label.id);
      wrap.appendChild(label);
      members.slice(0, perGroup || members.length).forEach(function (id) {
        var option = document.createElement("div");
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.id = "search-option-" + (optionSeq += 1);
        fillButton(option, id);
        wrap.appendChild(option);
        shown += 1;
      });
      searchResults.appendChild(wrap);
    });
    searchResults.hidden = !shown;
    searchInput.setAttribute("aria-expanded", shown ? "true" : "false");
    return shown;
  }

  var STOP_WORDS = ["the", "and", "for", "with", "from", "how", "what", "are", "that", "this", "into", "can", "not", "our", "you", "your", "use", "using"];

  function queryWords(q) {
    return q.split(/[^a-z0-9.:_]+/).filter(function (word) {
      return word.length >= 3 && STOP_WORDS.indexOf(word) === -1;
    });
  }

  function symptomNeedles(q) {
    var needles = [q];
    var aliases = SYMPTOM_ALIASES[q];
    if (aliases) needles = needles.concat(aliases);
    return needles;
  }

  function searchHaystackMatches(haystack, q) {
    if (!haystack) return false;
    var needles = symptomNeedles(q);
    var i;
    for (i = 0; i < needles.length; i++) {
      if (haystack.indexOf(needles[i]) !== -1) return true;
    }
    return false;
  }

  function matches(query) {
    var q = query.trim().toLowerCase();
    wordMatch = null;
    if (!q) return [];
    var ids = [];
    var allowed = [];
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind !== "control" && attrs.kind !== "risk") return;
      if (!nodeAllowed(attrs) || !layerAllowed(attrs)) return;
      allowed.push(id);
      if (searchHaystackMatches(attrs.search, q)) ids.push(id);
    });
    obligationChoiceCards().map(function (card) { return card.id; }).concat(personaChoiceIds()).forEach(function (id) {
      allowed.push(id);
      if (searchHaystackMatches(searchAttrs(id).search, q)) ids.push(id);
    });
    var counts = {};
    if (!ids.length) {
      var words = queryWords(q);
      if (words.length >= 2) {
        var needed = words.length <= 2 ? words.length : words.length - 1;
        allowed.forEach(function (id) {
          var haystack = searchAttrs(id).search;
          var hit = words.filter(function (word) {
            return searchHaystackMatches(haystack, word);
          }).length;
          if (hit >= needed) {
            counts[id] = hit;
            ids.push(id);
          }
        });
        wordMatch = { needed: needed, total: words.length };
      }
    }
    ids.sort(function (a, b) {
      if ((counts[a] || 0) !== (counts[b] || 0)) return (counts[b] || 0) - (counts[a] || 0);
      var aa = searchAttrs(a);
      var bb = searchAttrs(b);
      function exactness(attrs) {
        var name = attrs.name.toLowerCase();
        if (name === q || (attrs.ref && String(attrs.ref).toLowerCase() === q)) return 0;
        if (name.indexOf(q) === 0) return 1;
        return 2;
      }
      var ae = exactness(aa);
      var be = exactness(bb);
      if (ae !== be) return ae - be;
      var ak = SEARCH_KINDS.map(function (group) { return group[0]; }).indexOf(aa.kind);
      var bk = SEARCH_KINDS.map(function (group) { return group[0]; }).indexOf(bb.kind);
      if (ak !== bk) return ak - bk;
      return aa.name < bb.name ? -1 : aa.name > bb.name ? 1 : 0;
    });
    return ids;
  }

  function renderMatches(query) {
    var ids = matches(query);
    var shown = 0;
    if (listClosed) hideResults();
    else shown = renderIdList(ids, showAllMatches ? 0 : 8);
    showAllBtn.hidden = listClosed || ids.length <= shown;
    showAllBtn.textContent = "Show all " + ids.length + " matches";
    if (!query.trim()) {
      searchNote.textContent = "";
      return ids;
    }
    if (!ids.length) {
      searchNote.textContent = "No matching risk, obligation, control, or persona.";
      return ids;
    }
    var parts = [];
    [["risk", "risk", "risks"], ["obligation", "obligation", "obligations"], ["control", "control", "controls"], ["persona", "persona", "personas"]].forEach(function (group) {
      var count = ids.filter(function (id) { return searchAttrs(id).kind === group[0]; }).length;
      if (count) parts.push(unit(count, group[1], group[2]));
    });
    var breakdown = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
    var line;
    if (wordMatch) {
      line = "No record has that exact phrase. " + ids.length + (ids.length === 1 ? " record matches" : " records match") + " at least " + wordMatch.needed + " of your " + wordMatch.total + " words: " + breakdown + ".";
    } else {
      line = ids.length + (ids.length === 1 ? " record matches" : " records match") + ": " + breakdown + ".";
    }
    if (!listClosed && ids.length > shown) line += " Showing up to 8 of each group.";
    if (listClosed) line += " The list is closed. Press the down arrow to open it.";
    searchNote.textContent = line;
    return ids;
  }

  function riskIds() {
    var ids = [];
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind === "risk") ids.push(id);
    });
    ids.sort(function (a, b) {
      var an = graph.getNodeAttribute(a, "name");
      var bn = graph.getNodeAttribute(b, "name");
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
    return ids;
  }

  function fillSelect(select, ids, placeholder, label, flat, bySector) {
    select.textContent = "";
    var first = document.createElement("option");
    first.value = "";
    first.textContent = placeholder;
    select.appendChild(first);
    var groups = {};
    var order = [];
    ids.forEach(function (id) {
      var attrs = graph.getNodeAttributes(id);
      var layer = attrs.layer || "";
      var sector = bySector ? controlSector(attrs) : "";
      var key = flat ? "" : layer + "|" + sector;
      if (!groups[key]) {
        if (flat) {
          groups[key] = select;
        } else {
          groups[key] = document.createElement("optgroup");
          var base = layer ? layerName(layer) : "No layer recorded";
          groups[key].label = sector ? base + " \u00b7 " + sector : base;
        }
        order.push({ key: key, layer: layer, sector: sector });
      }
      var option = document.createElement("option");
      option.value = id;
      option.dataset.nodeId = id;
      if (isTapestryRecord(attrs)) {
        option.dataset.extension = "1";
        if (!flat) groups[key].dataset.extension = "1";
      }
      option.textContent = label(attrs);
      groups[key].appendChild(option);
    });
    order.sort(function (x, y) {
      return (layerRank(x.layer) - layerRank(y.layer)) || compareSectors(x.sector, y.sector);
    });
    if (!flat) order.forEach(function (group) {
      var node = groups[group.key];
      if (node.dataset.extension && node.label.indexOf(EXTENSION_BADGE) === -1) node.label += " · " + EXTENSION_BADGE;
      select.appendChild(node);
    });
  }

  function scopeSummaryLine() {
    var model = modelFilterLabel("All models");
    var layer = layerFilterLabel("All layers");
    var tapestry = showTapestry ? "Tapestry on" : "Tapestry off";
    return model + " \u00b7 " + layer + " \u00b7 " + tapestry;
  }

  function renderActivePills() {
    if (!activePillsEl) return;
    activePillsEl.textContent = "";
    var pills = [];
    selectedModels.forEach(function (id) {
      pills.push({ kind: "model", value: id, label: "Model: " + modelName(id) });
    });
    selectedLayers.forEach(function (id) {
      pills.push({ kind: "layer", value: id, label: "Layer: " + id });
    });
    if (showTapestry) {
      pills.push({ kind: "tapestry", value: "1", label: "Tapestry: On" });
    }
    var q = searchInput && searchInput.value ? searchInput.value.trim() : "";
    if (q) {
      pills.push({ kind: "query", value: q, label: "Find: \"" + q + "\"" });
    }
    pills.forEach(function (pill) {
      var btn = makeEl("button", "filter-pill");
      btn.type = "button";
      btn.dataset.pillKind = pill.kind;
      btn.dataset.pillValue = pill.value;
      btn.setAttribute("aria-label", "Remove filter " + pill.label);
      btn.appendChild(makeEl("span", "filter-pill__text", pill.label));
      btn.appendChild(makeEl("span", "filter-pill__x", "\u00d7"));
      activePillsEl.appendChild(btn);
    });
    if (clearFiltersBtn) clearFiltersBtn.hidden = pills.length === 0;
  }

  function renderSummary() {
    if (!graph) return;
    var riskCount = riskChoiceIds().length;
    var obligationCount = obligationChoiceCards().length;
    var controlCount = suggestedIds().length;
    var personaCount = personaChoiceIds().length;
    if (scopeCountsEl) {
      scopeCountsEl.textContent = unit(riskCount, "risk", "risks") + " \u00b7 " +
        unit(obligationCount, "obligation", "obligations") + " \u00b7 " +
        unit(controlCount, "control", "controls") + " \u00b7 " +
        unit(personaCount, "persona", "personas");
    }
    if (scopeSummaryEl) scopeSummaryEl.textContent = scopeSummaryLine();
    if (summaryEl) {
      summaryEl.textContent = modelFilterLabel("All operating models") + ", " + layerFilterLabel("all layers") + ": " + unit(controlCount, "control", "controls") + ", " + unit(riskCount, "risk", "risks");
    }
    renderActivePills();
  }

  function syncToggles() {
    if (tapestryInput) tapestryInput.checked = showTapestry;
    document.querySelectorAll('input[name="operating-model"]').forEach(function (input) {
      var checked = input.value === "all" ? isAllModels() : selectedModels.indexOf(input.value) !== -1;
      input.checked = checked;
      if (input.parentNode && input.parentNode.classList) {
        input.parentNode.classList.toggle("is-checked", checked);
      }
    });
    document.querySelectorAll('input[name="layer"]').forEach(function (input) {
      var checked = input.value === "all" ? isAllLayers() : selectedLayers.indexOf(input.value) !== -1;
      input.checked = checked;
      if (input.parentNode && input.parentNode.classList) {
        input.parentNode.classList.toggle("is-checked", checked);
      }
    });
  }

  function updateChrome() {
    syncToggles();
    var query = searchInput.value.trim();
    findForm.classList.toggle("has-query", !!query);
    if (query) {
      renderMatches(searchInput.value);
    } else if (linkHits && linkHits.length) {
      renderIdList(linkHits);
      searchNote.textContent = linkNote;
    } else {
      hideResults();
      searchNote.textContent = linkNote;
    }

    var chainOn = view === "chain" && !!currentChain;
    var contextOn = view === "context";
    var vizOpen = view === "chain" || contextOn;
    if (contextBtn) contextBtn.hidden = contextOn;
    if (mapPage) {
      mapPage.classList.toggle("is-chain", chainOn);
      mapPage.classList.toggle("is-workspace-open", vizOpen);
    }
    document.body.classList.toggle("chain-open", chainOn);
    chainWorkspace.hidden = !vizOpen;
    chainEl.hidden = !chainOn;
    placeDetailsPanel(chainOn);
    detailsEl.hidden = !chainOn;
    setChainWorkspaceHeading(contextOn);
    if (jumpChain) jumpChain.hidden = !chainOn;
    if (contextBoard) contextBoard.hidden = !contextOn;
    chainWrap.classList.toggle("chain-wrap--chain", chainOn);
    chainWrap.classList.toggle("chain-wrap--context", contextOn);
    if (contextOn) renderContext();

    if (chainEmpty) {
      if (view === "chain" && !currentChain) {
        chainEmpty.hidden = false;
        chainEmpty.textContent = "This record has no chain for the selected operating model.";
      } else {
        chainEmpty.hidden = true;
        chainEmpty.textContent = "";
      }
    }
    renderSummary();
    syncSheet();
  }

  function syncSheet() {
    document.body.classList.remove("sheet-open");
    SHEET_INERT.forEach(function (selector) {
      Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
        el.removeAttribute("inert");
      });
    });
  }

  function setChainWorkspaceHeading(contextOn) {
    if (!chainWorkspaceHeading) return;
    if (contextOn) {
      chainWorkspaceHeading.textContent = "Layers";
      return;
    }
    chainWorkspaceHeading.textContent = "";
    var abbr = document.createElement("abbr");
    abbr.title = "Risk, Obligation, Control, Accountable";
    abbr.textContent = "ROCA";
    chainWorkspaceHeading.appendChild(abbr);
    chainWorkspaceHeading.appendChild(document.createTextNode(" chain"));
  }

  function fillLayerFrames() {
    if (!layerFrames || !graph) return;
    layerFrames.textContent = "";
    LAYERS.forEach(function (layerId) {
      if (!graph.hasNode("layer:" + layerId)) return;
      var name = graph.getNodeAttribute("layer:" + layerId, "name");
      var item = makeEl("div", "layer-frames__item");
      item.appendChild(makeEl("dt", "", name));
      item.appendChild(makeEl("dd", "", LAYER_FRAME[layerId] || ""));
      layerFrames.appendChild(item);
    });
  }

  function openPersona(id, moveFocus) {
    openColumn = "accountable";
    personaPick = id;
    view = "chain";
    root = null;
    reqPick = "";
    selected = null;
    chainFocus = "accountable:persona:" + id;
    expandedColumns = {};
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    commit(true);
    if (moveFocus) revealChain();
  }

  function modelFromSlug(raw) {
    var key = String(raw || "").trim().toLowerCase();
    if (!key) return "";
    for (var i = 0; i < MODEL_ORDER.length; i++) {
      if (coreIds[MODEL_ORDER[i]] && MODEL_SLUG[MODEL_ORDER[i]] === key) return MODEL_ORDER[i];
    }
    return "";
  }

  /* The URL carries type and node (the selected item), model (a slug), and
     view (list). risk=, control=, persona=, graph=1, and the old graph
     parameters are older spellings. They still load into the ROCA chain, and
     the next state change rewrites them. */
  function currentQuery() {
    var params = new URLSearchParams();
    var hasNode = false;
    if (view === "chain") {
      if (root && graph.hasNode(root)) {
        var attrs = graph.getNodeAttributes(root);
        if (attrs.kind === "risk") {
          params.set("type", "risk");
          params.set("node", attrs.ref);
          hasNode = true;
        } else if (attrs.kind === "control") {
          params.set("type", "control");
          params.set("node", attrs.vertical + ":" + attrs.ref);
          hasNode = true;
        }
      } else if (personaPick && !root) {
        params.set("type", "persona");
        params.set("node", personaPick);
        hasNode = true;
      } else if (reqPick) {
        params.set("type", "obligation");
        params.set("node", reqPick);
        hasNode = true;
      }
    }
    if (!isAllModels()) {
      var slugs = selectedModels.map(function (id) { return MODEL_SLUG[id]; }).filter(Boolean);
      if (slugs.length) params.set("model", slugs.join(","));
    }
    if (!isAllLayers()) params.set("layer", selectedLayers.join(","));
    if (showTapestry) params.set("tapestry", "1");
    if (view === "context") params.set("view", "context");
    else if (hasNode || !isAllModels() || !isAllLayers() || showTapestry) params.set("view", "list");
    return params.toString().replace(/%3A/g, ":").replace(/%2C/g, ",");
  }

  /* Opening a chain adds a history entry so Back returns to the previous chain.
     Filter and model changes replace the current entry. */
  function historyKey(params) {
    var node = params.get("node") || params.get("risk") || params.get("control") || params.get("persona") || "";
    var type = params.get("type") || (params.get("risk") ? "risk" : params.get("control") ? "control" : params.get("persona") ? "persona" : "");
    return (node ? type + ":" + node : "") + "|";
  }

  function writeUrl() {
    if (coverageMode) return;
    var query = currentQuery();
    var next = location.pathname + (query ? "?" + query : "") + location.hash;
    var current = location.pathname + location.search + location.hash;
    if (next === current) return;
    var before = historyKey(new URLSearchParams(location.search));
    var after = historyKey(new URLSearchParams(query));
    var opening = after !== "|" && after !== before && !restoringHistory;
    var state = { view: view, root: root, selected: selected };
    if (opening) history.pushState(state, "", next);
    else history.replaceState(state, "", next);
  }

  function onPopState() {
    restoringHistory = true;
    try { applyFromLocation(); } finally { restoringHistory = false; }
    if (!graph) return;
    var target = null;
    if (hasFocus()) target = chainHeading;
    if (!target || !target.getClientRects().length) target = searchInput;
    if (target === chainHeading && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  function deepLink() {
    var query = currentQuery();
    return location.origin + location.pathname + (query ? "?" + query : "");
  }

  function blockedNote(id) {
    var attrs = graph.getNodeAttributes(id);
    if (isTapestryRecord(attrs) && !showTapestry) return "This is a Tapestry record. Turn on Show Tapestry to include it in the chain.";
    return outsideFilter(attrs)
      ? GAP_NOTE + " Choose All to see it in a chain."
      : "This control does not list " + modelFilterLabel() + ". Choose All under Operating model to see it.";
  }

  /* The chain for the current state. A record that cannot build a chain keeps
     the four columns and the choice list, and the note says why. */
  function chainForState() {
    if (view !== "chain") return null;
    if (root && graph.hasNode(root)) {
      var built = buildChain(root);
      if (built) return built;
      var blocked = entryChain();
      if (blocked) blocked.note = blockedNote(root);
      return blocked;
    }
    if (personaPick) return chainFromPersona(personaPick);
    if (reqPick) {
      var fromReq = chainFromObligation(reqPick);
      if (fromReq.obligations.length) return fromReq;
      var lost = entryChain();
      lost.note = "No record matches that obligation.";
      return lost;
    }
    return entryChain();
  }

  function commit(push) {
    currentChain = chainForState();
    if (view !== "chain") chainFocus = "";
    if (currentChain) renderChain(currentChain);
    else if (chainBoard) chainBoard.textContent = "";
    updateChrome();
    renderDetails();
    publish();
    writeUrl(!!push);
  }

  function resolveControl(token) {
    var raw = String(token || "").trim();
    var hits = [];
    if (!raw) return { id: "", hits: hits };
    if (controlAliases[raw] && graph.hasNode(controlAliases[raw])) {
      return { id: controlAliases[raw], hits: [controlAliases[raw]] };
    }
    if (raw.indexOf(":") !== -1 && graph.hasNode("control:" + raw)) {
      return { id: "control:" + raw, hits: ["control:" + raw] };
    }
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind === "control" && String(attrs.ref) === raw) hits.push(id);
    });
    hits.sort(function (a, b) {
      var aa = graph.getNodeAttributes(a);
      var bb = graph.getNodeAttributes(b);
      var ar = VERTICAL_RANK[aa.vertical];
      var br = VERTICAL_RANK[bb.vertical];
      if (ar == null) ar = 99;
      if (br == null) br = 99;
      if (ar !== br) return ar - br;
      return aa.meta < bb.meta ? -1 : aa.meta > bb.meta ? 1 : 0;
    });
    if (hits.length === 1) return { id: hits[0], hits: hits };
    return { id: "", hits: hits };
  }

  function resolveRisk(token) {
    var raw = String(token || "").trim();
    if (!raw) return "";
    if (graph.hasNode("risk:" + raw)) return "risk:" + raw;
    var hit = "";
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind !== "risk") return;
      if (attrs.ref === raw || attrs.name.toLowerCase() === raw.toLowerCase()) hit = id;
    });
    return hit;
  }

  /* view=full used to select a node on a link graph. The graph is gone.
     Open the chain when this id can build one. Otherwise leave the empty
     start state and do not report an error. */
  function openChainFromNode(node) {
    if (!node || !graph.hasNode(node)) {
      view = "chain";
      return;
    }
    var attrs = graph.getNodeAttributes(node);
    if (isTapestryRecord(attrs)) showTapestry = true;
    var corePersona = attrs.kind === "persona" && CORE_PERSONAS.indexOf(attrs.ref) !== -1 && attrs.provenance !== "proposed-extension";
    if (corePersona || (attrs.kind === "persona" && isTapestryRecord(attrs))) {
      personaPick = attrs.ref;
      view = "chain";
      openColumn = "accountable";
      chainFocus = "accountable:persona:" + attrs.ref;
      return;
    }
    if ((attrs.kind === "risk" || attrs.kind === "control") && buildChain(node)) {
      root = node;
      selected = node;
      chainFocus = node;
      view = "chain";
      openColumn = attrs.kind === "risk" ? "risk" : "control";
      return;
    }
    view = "chain";
  }

  /* ?mode=, ?explore=, and ?anchor= are older links. They select the same
     item on the chain the page opens with. A column name with no item leaves
     every menu on All and opens that column on a narrow screen. */
  var LEGACY_COLUMN = {
    risk: "risk",
    threat: "risk",
    obligation: "obligation",
    control: "control",
    accountable: "accountable",
    account: "accountable",
    persona: "accountable"
  };

  function legacyColumn(raw) {
    return LEGACY_COLUMN[String(raw || "").trim().toLowerCase()] || "";
  }

  function applyLegacyQuery(params) {
    var mode = legacyColumn(params.get("mode"));
    var exploreRaw = String(params.get("explore") || "").trim();
    var exploreColumn = legacyColumn(exploreRaw);
    var column = mode || exploreColumn;
    if (column) openColumn = column;
    var anchor = String(params.get("anchor") || "").trim();
    if (!anchor && exploreRaw && !exploreColumn) anchor = exploreRaw;
    var hasItem = !!(params.get("type") || params.get("node") || params.get("risk") || params.get("control") || params.get("persona"));
    if (anchor && !hasItem) {
      if (/^(obligation|instrument):/.test(anchor)) {
        params.set("type", "obligation");
        params.set("node", anchor);
      } else if (anchor.indexOf("persona:") === 0) {
        params.set("type", "persona");
        params.set("node", anchor.slice("persona:".length));
      } else if (anchor.indexOf("risk:") === 0) {
        params.set("type", "risk");
        params.set("node", anchor.slice("risk:".length));
      } else if (anchor.indexOf("control:") === 0) {
        params.set("type", "control");
        params.set("node", anchor.slice("control:".length));
      } else if (column === "accountable") {
        params.set("type", "persona");
        params.set("node", anchor);
      } else if (column) {
        params.set("type", column);
        params.set("node", anchor);
      } else {
        params.set("risk", anchor);
      }
      hasItem = true;
    }
    if (column && params.get("node") && !params.get("type") && !params.get("risk") && !params.get("control") && !params.get("persona")) {
      params.set("type", column === "accountable" ? "persona" : column);
    }
  }

  function applyFromLocation() {
    if (!graph) return;
    var params = new URLSearchParams(location.search);
    var rawModels = String(params.get("model") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    selectedModels = [];
    rawModels.forEach(function (tok) {
      var resolved = modelFromSlug(tok);
      if (resolved && selectedModels.indexOf(resolved) === -1) selectedModels.push(resolved);
    });
    selectedModels.sort(function (a, b) { return MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b); });

    var rawLayers = String(params.get("layer") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    selectedLayers = [];
    rawLayers.forEach(function (tok) {
      if (LAYERS.indexOf(tok) !== -1 && selectedLayers.indexOf(tok) === -1) selectedLayers.push(tok);
    });
    selectedLayers.sort(function (a, b) { return LAYERS.indexOf(a) - LAYERS.indexOf(b); });

    showTapestry = params.get("tapestry") === "1";
    linkHits = null;
    linkNote = "";
    root = null;
    selected = null;
    chainFocus = "";
    personaPick = "";
    reqPick = "";
    var viewParam = params.get("view");
    view = viewParam === "context" ? "context" : "chain";
    openColumn = "risk";
    applyLegacyQuery(params);
    var controlParam = params.get("control");
    var riskParam = params.get("risk");
    var personaParam = params.get("persona") || "";
    var typeParam = params.get("type");
    var nodeParam = params.get("node");
    if (typeParam === "obligation" && nodeParam && viewParam !== "full") {
      if (/^(obligation|instrument):/.test(nodeParam)) {
        reqPick = nodeParam;
        openColumn = "obligation";
        view = "chain";
        chainFocus = nodeParam;
      }
    }
    if (viewParam !== "full" && nodeParam) {
      if (typeParam === "risk") riskParam = riskParam || nodeParam;
      else if (typeParam === "control") controlParam = controlParam || nodeParam;
      else if (typeParam === "persona") personaParam = personaParam || nodeParam;
    }
    if (riskParam || controlParam) {
      var opened = "";
      if (riskParam) {
        opened = resolveRisk(riskParam);
        if (!opened) linkNote = "No risk matches that link.";
      }
      if (!opened && controlParam) {
        var resolved = resolveControl(controlParam);
        if (resolved.id) opened = resolved.id;
        else if (resolved.hits.length > 1) {
          linkHits = resolved.hits;
          linkNote = "More than one control uses this identifier. Choose one.";
        } else if (!riskParam) {
          linkNote = "No control matches that link.";
        }
      }
      if (opened) {
        var openedAttrs = graph.getNodeAttributes(opened);
        if (openedAttrs.tapestry) showTapestry = true;
        root = opened;
        selected = opened;
        chainFocus = opened;
        view = "chain";
        openColumn = openedAttrs.kind === "risk" ? "risk" : "control";
      }
    } else {
      var asked = personaParam;
      if (graph.hasNode("persona:" + asked)) {
        var personaAttrs = graph.getNodeAttributes("persona:" + asked);
        if (isTapestryRecord(personaAttrs)) showTapestry = true;
        var corePersona = CORE_PERSONAS.indexOf(asked) !== -1 && personaAttrs.provenance !== "proposed-extension";
        if (corePersona || isTapestryRecord(personaAttrs)) {
          personaPick = asked;
          openColumn = "accountable";
          view = "chain";
          chainFocus = "accountable:persona:" + asked;
        }
      }
    }
    if (viewParam === "full" && !root && !personaPick && !reqPick) openChainFromNode(params.get("node"));
    commit(false);
  }

  function scrollToTarget(target, focusEl) {
    target.scrollIntoView({ block: "start", behavior: "auto" });
    (focusEl || target).focus({ preventScroll: true });
  }

  function scrollPanelTo(target) {
    if (!target) return;
    scrollToTarget(target);
  }

  function revealChain() {
    if (!currentChain) return;
    updateChrome();
    if (chainEl.hidden) return;
    if (narrowQuery.matches) {
      var headTop = chainHeading.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, headTop), behavior: "auto" });
    } else {
      chainWorkspace.scrollIntoView({ block: "start", behavior: "auto" });
    }
    chainHeading.focus({ preventScroll: true });
    drawChainLines();
  }

  var optionsEl = document.getElementById("options");
  var optionsLabel = document.getElementById("options-label");
  function syncOptionsCue() {
    if (!optionsEl) return;
    if (optionsLabel) optionsLabel.textContent = optionsEl.open ? "Hide options" : "Show options";
  }
  if (optionsEl) {
    optionsEl.addEventListener("toggle", syncOptionsCue);
    syncOptionsCue();
  }

  function openOptions() {
    if (optionsEl && !optionsEl.open) optionsEl.open = true;
  }

  function revealSearch() {
    openOptions();
    scrollToTarget(findForm, searchInput);
  }

  function revealDetails(moveFocus) {
    updateChrome();
    if (!moveFocus) return;
    detailsHeading.setAttribute("tabindex", "-1");
    detailsHeading.focus({ preventScroll: true });
  }

  function openControl(id, moveFocus, options) {
    options = options || {};
    if (!graph.hasNode(id)) return;
    var attrs = graph.getNodeAttributes(id);
    if (attrs.kind !== "risk" && attrs.kind !== "control") return;
    var column = attrs.kind === "risk" ? "risk" : "control";
    if (root !== id) {
      openColumn = column;
      expandedColumns = {};
    }
    root = id;
    selected = id;
    chainFocus = id;
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    personaPick = "";
    reqPick = "";
    if (attrs.tapestry) showTapestry = true;
    view = "chain";
    commit(options.push !== false);
    if (moveFocus) revealChain();
  }

  function activateNode(id, moveFocus) {
    if (!graph) return;
    var obligation = /^(obligation|instrument):/.test(id);
    if (obligation || (id.indexOf("persona:") === 0 && graph.hasNode(id))) {
      setFocus(obligation ? "obligation" : "accountable", id);
      if (moveFocus) revealChain();
      return;
    }
    if (!graph.hasNode(id)) return;
    openControl(id, moveFocus, {});
  }

  function nodeButton(id, label) {
    var button = document.createElement("button");
    button.type = "button";
    button.dataset.nodeId = id;
    button.textContent = label;
    return button;
  }

  function renderContext() {
    if (!contextBoard || !graph) return;
    contextBoard.textContent = "";
    contextBoard.appendChild(makeEl("p", "context-intro", "Layers run top to bottom, L1 to L5. Each band lists the personas recorded there and how many controls sit at that layer. Open a name to see its ROCA chain. This view does not draw the link mesh."));
    var bands = makeEl("div", "context-bands");
    LAYERS.forEach(function (layerId) {
      if (!graph.hasNode("layer:" + layerId)) return;
      var band = makeEl("section", "context-band");
      var label = makeEl("div", "context-band__label");
      label.appendChild(makeEl("span", "context-band__id", layerId));
      label.appendChild(makeEl("span", "context-band__name", graph.getNodeAttribute("layer:" + layerId, "name").replace(/^L\d\s+/, "")));
      if (LAYER_FRAME[layerId]) label.title = LAYER_FRAME[layerId];
      band.appendChild(label);
      var body = makeEl("div", "context-band__body");
      var modelBits = [];
      graph.forEachEdge(function (edge, attrs, source, target) {
        if (!attrs || attrs.type !== "model-layer") return;
        var layerEnd = source.indexOf("layer:") === 0 ? source : target.indexOf("layer:") === 0 ? target : "";
        var modelEnd = source.indexOf("model:") === 0 ? source : target.indexOf("model:") === 0 ? target : "";
        if (layerEnd !== "layer:" + layerId || !modelEnd) return;
        var modelId = modelEnd.slice(6);
        if (MODEL_ORDER.indexOf(modelId) === -1) return;
        if (!hasModel(modelId)) return;
        modelBits.push({ id: modelId, text: (graph.getNodeAttribute("model:" + modelId, "label") || modelName(modelId)) + " " + (respLabel[attrs.responsibility] || attrs.responsibility || "") });
      });
      modelBits.sort(function (a, b) { return MODEL_ORDER.indexOf(a.id) - MODEL_ORDER.indexOf(b.id); });
      if (modelBits.length) {
        body.appendChild(makeEl("p", "context-meta", modelBits.map(function (row) { return row.text; }).join(" · ")));
      }
      var people = makeEl("div", "context-people");
      graph.forEachNode(function (id, attrs) {
        if (attrs.kind !== "persona") return;
        if (attrs.tapestry && !showTapestry) return;
        if ((attrs.srfLayers || []).indexOf(layerId) === -1) return;
        if (CORE_PERSONAS.indexOf(attrs.ref) === -1 && !isTapestryRecord(attrs)) return;
        people.appendChild(nodeButton(id, isTapestryRecord(attrs) ? attrs.name + ", " + EXTENSION_BADGE : attrs.name));
      });
      if (people.childNodes.length) body.appendChild(people);
      var controls = [];
      graph.forEachNode(function (id, attrs) {
        if (attrs.kind !== "control" || attrs.layer !== layerId || !nodeAllowed(attrs)) return;
        controls.push(id);
      });
      controls.sort(compareControlIds);
      var details = makeEl("details", "context-controls-fold");
      details.appendChild(makeEl("summary", "", controls.length + (controls.length === 1 ? " control" : " controls")));
      var wrap = makeEl("div", "context-controls");
      controls.forEach(function (id) {
        var controlName = graph.getNodeAttribute(id, "name");
        if (isTapestryRecord(graph.getNodeAttributes(id))) controlName += ", " + EXTENSION_BADGE;
        wrap.appendChild(nodeButton(id, controlName));
      });
      details.appendChild(wrap);
      body.appendChild(details);
      band.appendChild(body);
      bands.appendChild(band);
    });
    contextBoard.appendChild(bands);

    var riskIds = [];
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind === "risk") riskIds.push(id);
    });
    riskIds.sort(function (a, b) {
      var an = graph.getNodeAttribute(a, "name");
      var bn = graph.getNodeAttribute(b, "name");
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
    var threats = makeEl("details", "context-extra context-extra--fold");
    threats.appendChild(makeEl("summary", "", riskIds.length + (riskIds.length === 1 ? " risk record" : " risk records")));
    threats.appendChild(makeEl("p", "context-meta", "Each name opens the ROCA chain for that risk."));
    var threatWrap = makeEl("div", "context-controls");
    riskIds.forEach(function (id) { threatWrap.appendChild(nodeButton(id, graph.getNodeAttribute(id, "name"))); });
    threats.appendChild(threatWrap);
    contextBoard.appendChild(threats);

    var extra = makeEl("details", "context-extra context-extra--fold");
    extra.appendChild(makeEl("summary", "", "Policy levels and whitepaper topics"));
    extra.appendChild(makeEl("p", "context-meta", "These names are in the data. No control record has a policy-level field, and whitepaper topics are not linked to controls, so they are not drawn as lines."));
    var names = makeEl("ul", "context-names");
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind === "policy" || attrs.kind === "topic") names.appendChild(makeEl("li", "", attrs.name));
    });
    extra.appendChild(names);
    contextBoard.appendChild(extra);
  }

  function showContext(push) {
    view = "context";
    root = null;
    selected = null;
    chainFocus = "";
    personaPick = "";
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    commit(push);
  }

  /* Clear returns the four menus to All and keeps the chain on the page. */
  function clearSelection(push) {
    if (view === "context") {
      view = "chain";
      clearFocus();
      linkHits = null;
      linkNote = "";
      commit(!!push);
      return;
    }
    if (!hasFocus()) return;
    linkHits = null;
    linkNote = "";
    clearFocus();
    view = "chain";
    commit(!!push);
  }

  function toggleModel(id, checked, push) {
    if (id === "all") {
      if (isAllModels()) {
        syncToggles();
        return;
      }
      selectedModels = [];
      commit(push);
      return;
    }
    if (!coreIds[id]) return;
    var next = selectedModels.slice();
    var idx = next.indexOf(id);
    if (checked && idx === -1) next.push(id);
    else if (!checked && idx !== -1) next.splice(idx, 1);
    next.sort(function (a, b) { return MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b); });
    selectedModels = next;
    commit(push);
  }

  function toggleLayer(id, checked, push) {
    if (id === "all") {
      if (isAllLayers()) {
        syncToggles();
        return;
      }
      selectedLayers = [];
      commit(push);
      return;
    }
    if (LAYERS.indexOf(id) === -1) return;
    var next = selectedLayers.slice();
    var idx = next.indexOf(id);
    if (checked && idx === -1) next.push(id);
    else if (!checked && idx !== -1) next.splice(idx, 1);
    next.sort(function (a, b) { return LAYERS.indexOf(a) - LAYERS.indexOf(b); });
    selectedLayers = next;
    commit(push);
  }

  function clearFilters(push) {
    var changed = !isAllModels() || !isAllLayers() || showTapestry;
    selectedModels = [];
    selectedLayers = [];
    if (showTapestry) {
      showTapestry = false;
      if (root && graph.hasNode(root) && !nodeAllowed(graph.getNodeAttributes(root))) {
        root = null;
        selected = null;
        chainFocus = "";
      }
      if (personaPick && graph.hasNode("persona:" + personaPick) && isTapestryRecord(graph.getNodeAttributes("persona:" + personaPick))) {
        personaPick = "";
        if (!root) {
          selected = null;
          chainFocus = "";
        }
      }
    }
    if (searchInput && searchInput.value) {
      searchInput.value = "";
      linkHits = null;
      linkNote = "";
      hideResults();
      if (searchNote) searchNote.textContent = "";
      changed = true;
    }
    if (changed) commit(!!push);
    else renderSummary();
  }

  function setTapestry(on, push) {
    if (on === showTapestry) return;
    showTapestry = on;
    if (root && graph.hasNode(root) && !nodeAllowed(graph.getNodeAttributes(root))) {
      root = null;
      selected = null;
      chainFocus = "";
    }
    if (!showTapestry && personaPick && graph.hasNode("persona:" + personaPick) && isTapestryRecord(graph.getNodeAttributes("persona:" + personaPick))) {
      personaPick = "";
      if (!root) {
        selected = null;
        chainFocus = "";
      }
    }
    commit(push);
  }

  function renderModelRadios(models) {
    if (!modelList) return;
    modelList.textContent = "";
    var allItems = [{ id: "all", short: "All", name: "All operating models" }].concat(models);
    allItems.forEach(function (model) {
      var label = document.createElement("label");
      label.className = "filter-chip";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.name = "operating-model";
      input.value = model.id;
      input.checked = model.id === "all" ? isAllModels() : selectedModels.indexOf(model.id) !== -1;
      label.classList.toggle("is-checked", input.checked);
      var text = document.createElement("span");
      text.textContent = model.short || model.id;
      label.appendChild(input);
      label.appendChild(text);
      if (model.name && model.name !== text.textContent) label.title = model.name;
      modelList.appendChild(label);
    });
  }

  function renderLayerRadios(layers) {
    if (!layerList) return;
    layerList.textContent = "";
    var all = [{ id: "all", name: "All", full: "All layers" }].concat(layers.map(function (layer) {
      return { id: layer.id, name: layer.id + " " + layer.name, full: layer.id + " " + layer.name };
    }));
    all.forEach(function (layer) {
      var label = document.createElement("label");
      label.className = "filter-chip";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.name = "layer";
      input.value = layer.id;
      input.checked = layer.id === "all" ? isAllLayers() : selectedLayers.indexOf(layer.id) !== -1;
      label.classList.toggle("is-checked", input.checked);
      var text = document.createElement("span");
      text.textContent = layer.name;
      label.appendChild(input);
      label.appendChild(text);
      if (layer.full && layer.full !== layer.name) label.title = layer.full;
      layerList.appendChild(label);
    });
  }

  function renderModelNote() {
    if (!modelNote) return;
    var mapped = stats.mappedFromSector || 0;
    var verb = mapped === 1 ? "uses" : "use";
    var sector = mapped
      ? mapped + " controls " + verb + " a sector model name, such as SaMD-Cloud or OT-Edge. data/sector-model-map.json maps each name to one of these four SRF models. The sector name stays on the control. This filter uses that mapping."
      : "Sector model names are mapped to these four SRF models by data/sector-model-map.json. The sector name stays on the control.";
    modelNote.textContent = sector + " The layer filter narrows the finder and the lists. It does not remove controls from a chain that is already open.";
  }

  function closeInfoBubble(btn) {
    if (!btn) return;
    var panelId = btn.getAttribute("aria-controls");
    var panel = panelId ? document.getElementById(panelId) : null;
    btn.setAttribute("aria-expanded", "false");
    if (panel) panel.hidden = true;
  }

  function openInfoBubble(btn) {
    if (!btn) return;
    var panelId = btn.getAttribute("aria-controls");
    var panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;
    document.querySelectorAll(".info-bubble__btn[aria-expanded='true']").forEach(function (other) {
      if (other !== btn) closeInfoBubble(other);
    });
    btn.setAttribute("aria-expanded", "true");
    panel.hidden = false;
  }

  function wireInfoBubble(btn) {
    if (!btn || btn.dataset.infoWired === "1") return;
    btn.dataset.infoWired = "1";
    var panelId = btn.getAttribute("aria-controls");
    if (panelId && !btn.getAttribute("aria-describedby")) btn.setAttribute("aria-describedby", panelId);
    btn.addEventListener("focus", function () { openInfoBubble(btn); });
    btn.addEventListener("blur", function () {
      window.setTimeout(function () {
        if (btn.matches(":focus")) return;
        var panelId = btn.getAttribute("aria-controls");
        var panel = panelId ? document.getElementById(panelId) : null;
        if (panel && panel.matches(":hover")) return;
        closeInfoBubble(btn);
      }, 0);
    });
    btn.addEventListener("mouseenter", function () { openInfoBubble(btn); });
    btn.addEventListener("mouseleave", function (event) {
      var panelId = btn.getAttribute("aria-controls");
      var panel = panelId ? document.getElementById(panelId) : null;
      if (panel && panel.contains(event.relatedTarget)) return;
      if (btn.matches(":focus")) return;
      closeInfoBubble(btn);
    });
    var panelId = btn.getAttribute("aria-controls");
    var panel = panelId ? document.getElementById(panelId) : null;
    if (panel) {
      panel.addEventListener("mouseleave", function (event) {
        if (btn.contains(event.relatedTarget)) return;
        if (btn.matches(":focus")) return;
        closeInfoBubble(btn);
      });
    }
    btn.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeInfoBubble(btn);
        btn.focus();
      }
    });
  }

  function initInfoBubbles() {
    Array.prototype.forEach.call(document.querySelectorAll(".info-bubble__btn"), wireInfoBubble);
  }

  function start() {
    initInfoBubbles();
    window.__relationshipMap = {
      graph: graph,
      outsideFilter: function (id) { return outsideFilter(graph.getNodeAttributes(id)); },
      outsideCurrentFilter: function (id) { return outsideCurrentFilter(graph.getNodeAttributes(id)); },
      isTapestryRecord: function (id) { return graph.hasNode(id) && isTapestryRecord(graph.getNodeAttributes(id)); },
      linkTypeBadge: function (item, column, chain) {
        return LINK_TYPE_BADGE[linkStyleForCard(item, column, chain)] || "";
      },
      layerBadge: layerForCard,
      personaAccountability: personaModelRoles,
      chainCsvRows: chainCsvRows,
      chainCsvText: chainCsvText,
      csvEscape: csvEscape,
      matches: matches,
      compareCitation: compareCitation,
      obligationGroupLabel: obligationGroupLabel
    };
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        publish();
        renderDetails();
        statusEl.dataset.ready = "true";
      });
    });
  }

  findForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!searchInput.value.trim()) return;
    if (listClosed) {
      listClosed = false;
      renderMatches(searchInput.value);
    }
    if (optionEls().length && activeIndex < 0) setActive(0);
  });
  searchInput.addEventListener("keydown", function (event) {
    var opts = optionEls();
    var open = !searchResults.hidden && opts.length > 0;
    var key = event.key;
    if (key === "ArrowDown") {
      if (!searchInput.value.trim()) return;
      if (listClosed) {
        listClosed = false;
        renderMatches(searchInput.value);
        opts = optionEls();
      }
      if (!opts.length) return;
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (key === "ArrowUp") {
      if (!open) return;
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if ((key === "Home" || key === "End") && open && activeIndex >= 0) {
      event.preventDefault();
      setActive(key === "Home" ? 0 : opts.length - 1);
    } else if (key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      activateNode(opts[activeIndex].dataset.nodeId, true);
    } else if (key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      if (activeIndex >= 0) {
        setActive(-1);
      } else {
        listClosed = true;
        renderMatches(searchInput.value);
      }
    }
  });
  searchResults.addEventListener("mousedown", function (event) {
    event.preventDefault();
  });
  searchInput.addEventListener("input", function () {
    linkHits = null;
    linkNote = "";
    showAllMatches = false;
    listClosed = false;
    findForm.classList.toggle("has-query", !!searchInput.value.trim());
    if (!graph) return;
    if (!searchInput.value.trim()) {
      hideResults();
      searchNote.textContent = "";
      renderActivePills();
      return;
    }
    renderMatches(searchInput.value);
    renderActivePills();
    var listTop = (searchResults.hidden ? searchNote : searchResults).getBoundingClientRect().top;
    var inputTop = searchInput.getBoundingClientRect().top;
    if (listTop > window.innerHeight * 0.85 && inputTop > 130) window.scrollBy({ top: inputTop - 130, behavior: "auto" });
  });
  var mapToolsEl = document.getElementById("map-tools");
  if (mapToolsEl) {
    mapToolsEl.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-node-id], [role='option'][data-node-id]");
      if (!button) return;
      activateNode(button.dataset.nodeId, true);
    });
  }
  modelList.addEventListener("change", function (event) {
    var input = event.target;
    if (!input || input.name !== "operating-model") return;
    toggleModel(input.value, input.checked, true);
  });
  if (layerList) {
    layerList.addEventListener("change", function (event) {
      var input = event.target;
      if (!input || input.name !== "layer") return;
      toggleLayer(input.value, input.checked, true);
    });
  }
  tapestryInput.addEventListener("change", function () {
    setTapestry(tapestryInput.checked, true);
  });
  if (activePillsEl) {
    activePillsEl.addEventListener("click", function (event) {
      var btn = event.target.closest("button.filter-pill");
      if (!btn) return;
      var kind = btn.dataset.pillKind;
      var val = btn.dataset.pillValue;
      if (kind === "model") toggleModel(val, false, true);
      else if (kind === "layer") toggleLayer(val, false, true);
      else if (kind === "tapestry") setTapestry(false, true);
      else if (kind === "query") {
        searchInput.value = "";
        linkHits = null;
        linkNote = "";
        hideResults();
        if (searchNote) searchNote.textContent = "";
        renderActivePills();
        searchInput.focus({ preventScroll: true });
      }
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", function () {
      clearFilters(true);
    });
  }
  document.addEventListener("click", function (event) {
    if (!event.target.closest || !event.target.closest(".chain-combo")) {
      closeAllCombos();
    }
  });
  chainBoard.addEventListener("click", function (event) {
    var more = event.target.closest("button.chain-more");
    if (more) {
      var key = more.dataset.moreColumn;
      expandedColumns[key] = !expandedColumns[key];
      renderChain(currentChain);
      var again = chainBoard.querySelector('button.chain-more[data-more-column="' + key + '"]');
      if (again) again.focus({ preventScroll: true });
      return;
    }
    var toggle = event.target.closest("button.chain-col__toggle");
    if (toggle) {
      setOpenColumn(openColumn === toggle.dataset.column ? "" : toggle.dataset.column);
      return;
    }
    var button = event.target.closest("button[data-chain-id]");
    if (!button) return;
    event.preventDefault();
    var keep = button.dataset.chainId;
    chainFocus = keep;
    Array.prototype.forEach.call(chainBoard.querySelectorAll("button[data-chain-id]"), function (card) {
      card.setAttribute("aria-pressed", card.dataset.chainId === keep ? "true" : "false");
    });
    renderDetails();
    announceDetails();
    button.focus();
  });
  chainBoard.addEventListener("change", function (event) {
    var select = event.target.closest("select.chain-pick");
    if (!select) return;
    var key = select.dataset.column;
    setFocus(key, select.value);
    if (select.value && chainHeading) chainHeading.scrollIntoView({ block: "start", behavior: "auto" });
    var again = document.getElementById("chain-select-" + key);
    if (again) again.focus({ preventScroll: true });
  });
  if (detailsBody) {
    detailsBody.addEventListener("click", function (event) {
      var related = event.target.closest("button.details-related[data-node-id]");
      if (!related) return;
      activateNode(related.dataset.nodeId, true);
    });
  }
  chainBoard.addEventListener("keydown", function (event) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (event.target && event.target.closest && event.target.closest(".chain-combo")) return;
    var buttons = Array.prototype.slice.call(chainBoard.querySelectorAll("button.chain-card, button.chain-more, button.chain-col__toggle")).filter(function (b) {
      return b.getClientRects().length > 0;
    });
    var idx = buttons.indexOf(document.activeElement);
    if (idx < 0) return;
    event.preventDefault();
    var next = event.key === "ArrowDown" ? Math.min(buttons.length - 1, idx + 1) : Math.max(0, idx - 1);
    buttons[next].focus();
  });
  window.addEventListener("resize", function () {
    placeDetails();
    drawChainLines();
  });
  window.addEventListener("scroll", placeDetails, { passive: true });
  window.addEventListener("load", placeDetails);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      placeDetails();
      drawChainLines();
    });
  }
  placeDetails();
  if (contextBtn) contextBtn.addEventListener("click", function () { showContext(true); });
  if (contextBoard) {
    contextBoard.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-node-id]");
      if (!button || !graph || !graph.hasNode(button.dataset.nodeId)) return;
      var id = button.dataset.nodeId;
      var attrs = graph.getNodeAttributes(id);
      if (attrs.kind === "persona" && (CORE_PERSONAS.indexOf(attrs.ref) !== -1 || isTapestryRecord(attrs))) {
        openPersona(attrs.ref, true);
        return;
      }
      activateNode(id, true);
    });
  }
  var requirementButton = document.getElementById("entry-requirement");
  if (requirementButton) requirementButton.addEventListener("click", function () {
    var toggle = document.querySelector('.chain-col__toggle[data-column="obligation"]');
    if (toggle && toggle.getAttribute("aria-expanded") !== "true") toggle.click();
    var select = document.getElementById("chain-select-obligation");
    if (!select) return;
    select.scrollIntoView({ block: "center", behavior: "auto" });
    select.focus({ preventScroll: true });
  });
  function selectedKindLabel() {
    if (root && graph.hasNode(root)) return KIND_LABEL[graph.getNodeAttribute(root, "kind")] || "Item";
    return reqPick ? "Obligation" : "Persona";
  }

  function chainMarkdown() {
    var chain = currentChain;
    var rootAttrs = root && graph.hasNode(root) ? graph.getNodeAttributes(root) : null;
    var name = focusName();
    var ref = "";
    if (rootAttrs) ref = rootAttrs.kind === "control" ? rootAttrs.vertical + ":" + rootAttrs.ref : rootAttrs.ref;
    else ref = personaPick || reqPick;
    var lines = [];
    lines.push("# " + name);
    lines.push("");
    lines.push("- Operating model: " + modelFilterLabel("All operating models"));
    lines.push("- Selected item: " + selectedKindLabel() + ", " + name + (ref ? " (" + ref + ")" : ""));
    lines.push("- Link: " + deepLink());
    function section(title, rows, none) {
      lines.push("");
      lines.push("## " + title);
      if (!rows.length) lines.push("- " + none);
      rows.forEach(function (row) { lines.push("- " + row); });
    }
    section("Risks", chain.risks.map(function (item) {
      return item.name + (item.layer ? " (" + item.layer + ")" : "");
    }), "None recorded.");
    section("Obligations", chain.obligations.map(function (item) {
      return item.citation && item.citation !== item.title ? item.citation + ": " + item.title : item.title;
    }), "None recorded.");
    section("Controls", chain.controls.map(function (item) {
      return item.name + " (" + item.vertical + ":" + item.ref + (item.layer ? ", " + item.layer : "") + ")";
    }), "None recorded.");
    var personas = [];
    var counts = {};
    chain.personaCards.forEach(function (card) {
      card.lines.forEach(function (line) {
        if (line.missing) return;
        var key = line.name + " (" + line.label + ")";
        if (!counts[key]) {
          counts[key] = 0;
          personas.push(key);
        }
        counts[key] += 1;
      });
    });
    section("Accountable persona", chain.startKind === "persona" ? [name] : personas.map(function (key) {
      return key + ", named on " + unit(counts[key], "control", "controls");
    }), "None recorded for this operating model.");
    if (chain.gaps.length) {
      section("Gaps", chain.gaps.map(function (gap) { return gap.text; }), "");
    }
    return lines.join("\n") + "\n";
  }

  function setCopyState(label, message, isError) {
    clearTimeout(copyTimer);
    if (copyBtn) copyBtn.textContent = label;
    if (copyStatus) {
      copyStatus.textContent = message;
      copyStatus.classList.toggle("copy-status--error", !!isError);
    }
  }

  function resetCopyState() {
    if (copyBtn) copyBtn.textContent = "Copy chain";
    if (copyStatus) {
      copyStatus.textContent = "";
      copyStatus.classList.remove("copy-status--error");
    }
  }

  function csvEscape(value) {
    var text = value == null ? "" : String(value);
    if (/[",\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function obligationExportName(item) {
    if (!item) return "";
    return item.citation && item.citation !== item.title ? item.citation + ": " + item.title : (item.title || item.citation || "");
  }

  function chainCsvRows() {
    var chain = currentChain;
    if (!chain) return [];
    var rows = [];
    var riskDefault = chain.risks.map(function (item) { return item.name; }).join("; ");
    var obligationDefault = chain.obligations.map(obligationExportName).join("; ");
    if (!chain.controls.length) {
      rows.push({
        risk: riskDefault,
        obligation: obligationDefault,
        control: "",
        persona: "",
        model: modelFilterLabel("All"),
        linkType: ""
      });
      return rows;
    }
    chain.controls.forEach(function (ctrl) {
      var linkType = LINK_TYPE_BADGE[linkStyleForCard(ctrl, "control", chain)] || "";
      var wrote = false;
      chain.personaCards.forEach(function (pCard) {
        if (pCard.controlId !== ctrl.id) return;
        pCard.lines.forEach(function (line) {
          if (line.missing) return;
          wrote = true;
          rows.push({
            risk: riskDefault,
            obligation: obligationDefault,
            control: ctrl.name,
            persona: line.name,
            model: line.label,
            linkType: linkType
          });
        });
      });
      if (!wrote) {
        rows.push({
          risk: riskDefault,
          obligation: obligationDefault,
          control: ctrl.name,
          persona: "",
          model: modelFilterLabel("All"),
          linkType: linkType
        });
      }
    });
    return rows;
  }

  function chainCsvText() {
    var header = ["risk", "obligation", "control", "persona", "model", "link type"];
    var lines = [header.map(csvEscape).join(",")];
    chainCsvRows().forEach(function (row) {
      lines.push([
        row.risk,
        row.obligation,
        row.control,
        row.persona,
        row.model,
        row.linkType
      ].map(csvEscape).join(","));
    });
    return lines.join("\n") + "\n";
  }

  function downloadChainCsv() {
    if (!currentChain || !csvDownloadBtn) return;
    var csv = chainCsvText();
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "roca-chain.csv";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (copyStatus) {
      copyStatus.textContent = "CSV download started.";
      copyStatus.classList.remove("copy-status--error");
    }
  }

  function copyWithTextarea(text) {
    copyFallback.hidden = false;
    copyFallback.value = text;
    copyFallback.focus();
    copyFallback.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    return ok;
  }

  function copyChain() {
    if (!currentChain || !copyBtn) return;
    var text = chainMarkdown();
    copyFallback.hidden = true;
    function done() {
      copyFallback.hidden = true;
      setCopyState("Copied", "Copied. The chain is on your clipboard as Markdown.", false);
      copyTimer = setTimeout(resetCopyState, 2000);
    }
    function failed() {
      setCopyState("Copy chain", "Could not copy. Your browser blocked clipboard access. Select the text below and copy it yourself.", true);
      copyFallback.hidden = false;
      copyFallback.value = text;
      copyFallback.focus();
      copyFallback.select();
    }
    var attempt;
    try {
      attempt = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error("no clipboard"));
    } catch (err) {
      attempt = Promise.reject(err);
    }
    attempt.then(done, function () {
      if (copyWithTextarea(text)) {
        copyBtn.focus();
        done();
      } else {
        failed();
      }
    });
  }

  if (copyBtn) copyBtn.addEventListener("click", copyChain);
  if (csvDownloadBtn) csvDownloadBtn.addEventListener("click", downloadChainCsv);

  function onClearClick() {
    clearSelection(true);
  }
  if (clearChainBtn) clearChainBtn.addEventListener("click", onClearClick);
  var lastNarrow = narrowQuery.matches;
  narrowQuery.addEventListener("change", function () {
    if (narrowQuery.matches === lastNarrow) return;
    lastNarrow = narrowQuery.matches;
    if (currentChain) renderChain(currentChain);
    syncSheet();
  });
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[data-jump]");
    if (!link) return;
    var id = (link.getAttribute("href") || "").slice(1);
    var target = document.getElementById(id);
    if (target && optionsEl && optionsEl.contains(target)) openOptions();
    if (!target || target.closest("[hidden]") || !target.getClientRects().length) return;
    event.preventDefault();
    if (id === "node-search") {
      revealSearch();
      return;
    }
    if (id === "chain-workspace" || id === "chain-heading" || id === "details-heading") {
      scrollPanelTo(target);
      return;
    }
    if (id.indexOf("chain-col-") === 0) {
      if (narrowQuery.matches) setOpenColumn(id.slice("chain-col-".length));
      scrollPanelTo(document.getElementById(id));
      return;
    }
    if (detailsEl.contains(target) || (mapPanel && mapPanel.contains(target))) {
      scrollPanelTo(target);
      return;
    }
    if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
      target.setAttribute("tabindex", "-1");
    }
    scrollToTarget(target);
  });
  showAllBtn.addEventListener("click", function () {
    var shown = optionEls().length;
    showAllMatches = true;
    renderMatches(searchInput.value);
    searchInput.focus();
    setActive(shown);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var openCombo = document.querySelector(".chain-combo.is-open");
    if (openCombo) {
      event.preventDefault();
      event.stopPropagation();
      var trig = openCombo.querySelector(".chain-combo__trigger");
      closeAllCombos();
      if (trig) trig.focus({ preventScroll: true });
      return;
    }
    var bubble = event.target.closest && event.target.closest(".info-bubble__btn[aria-expanded='true']");
    if (bubble) {
      event.preventDefault();
      event.stopPropagation();
      closeInfoBubble(bubble);
      bubble.focus();
      return;
    }
    var fold = event.target.closest && event.target.closest("details.esc-close[open]");
    if (fold) {
      event.preventDefault();
      fold.open = false;
      fold.querySelector("summary").focus();
      return;
    }
    if (event.target === searchInput && searchInput.value) {
      searchInput.value = "";
      linkHits = null;
      linkNote = "";
      hideResults();
      searchNote.textContent = "";
      return;
    }
    if (!hasFocus() && view !== "context") return;
    clearSelection(true);
  });
  window.addEventListener("popstate", onPopState);

  function renderCoverage() {
    var body = document.getElementById("coverage-body");
    if (!body || !catalog || !graph) return;
    body.textContent = "";
    body.className = "";
    body.removeAttribute("aria-busy");
    function addList(items) {
      var ul = makeEl("ul", "");
      items.forEach(function (text) { ul.appendChild(makeEl("li", "", text)); });
      body.appendChild(ul);
    }
    var confirmed = [];
    Object.keys(catalog.threats).forEach(function (id) {
      var threat = catalog.threats[id];
      MODEL_ORDER.forEach(function (modelId) {
        var cell = (threat.accountability || {})[modelId] || {};
        if (!cell.no_linked_control_in_model) return;
        confirmed.push(threat.name + " in " + modelId + " still names " + (personaLabel(cell.accountable_persona) || "a persona") + ". No linked control is recorded for that model.");
      });
    });
    body.appendChild(makeEl("h3", "", "Confirmed coverage gap"));
    addList(confirmed.length ? confirmed : ["No risk cell sets no_linked_control_in_model."]);

    var named = {};
    Object.keys(catalog.threats).forEach(function (id) {
      (catalog.threats[id].related_controls || []).forEach(function (fullId) { named[fullId] = true; });
    });
    var controlCount = 0;
    var unlinked = 0;
    var tapestryListed = 0;
    var tapestryUnlinked = 0;
    Object.keys(catalog.byFull).forEach(function (fullId) {
      var nodeId = catalog.byFull[fullId];
      if (graph.hasNode(nodeId) && isTapestryRecord(graph.getNodeAttributes(nodeId))) {
        tapestryListed += 1;
        if (!named[fullId]) tapestryUnlinked += 1;
        return;
      }
      controlCount += 1;
      if (!named[fullId]) unlinked += 1;
    });
    var cited = {};
    Object.keys(catalog.threats).forEach(function (id) {
      (catalog.threats[id].obligations || []).forEach(function (link) {
        if (link.requirement) cited[link.requirement] = true;
      });
    });
    var uncited = 0;
    Object.keys(catalog.reqs).forEach(function (id) { if (!cited[id]) uncited += 1; });
    var missing = [
      unlinked + " of " + controlCount + " controls are not named by any risk record. That is a missing mapping, not a confirmed gap.",
      uncited + " of " + Object.keys(catalog.reqs).length + " obligation records are not cited by a risk obligation link. That is a missing mapping, not a confirmed absence of a control."
    ];
    if (tapestryListed) {
      missing.push(tapestryUnlinked + " of " + tapestryListed + " Tapestry controls are not named by any risk record. Tapestry controls stay out of the count above.");
    }
    (catalog.emptyCrosswalk || []).forEach(function (row) {
      missing.push(row.name + " (" + row.id + ") has an empty srf_crosswalk. That is a missing mapping.");
    });
    body.appendChild(makeEl("h3", "", "Missing mapping"));
    addList(missing);

    var unassessed = 0;
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind === "control" && attrs.evidenceText === "The evidence pointer is not recorded.") unassessed += 1;
    });
    body.appendChild(makeEl("h3", "", "Unassessed"));
    addList([
      unassessed + " controls have no evidence pointer, or the pointer contains TBD. That is not a failed control.",
      "Risk-to-control links have no basis field. The basis is not classified."
    ]);

    var multi = [];
    function badOwner(value) {
      return Array.isArray(value) || value === "Shared" || value === "shared";
    }
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind !== "control" || !attrs.accountableByModel) return;
      Object.keys(attrs.accountableByModel).forEach(function (modelId) {
        if (badOwner(attrs.accountableByModel[modelId])) multi.push(attrs.ref + " in " + modelId);
      });
    });
    Object.keys(catalog.threats).forEach(function (id) {
      var acc = catalog.threats[id].accountability || {};
      Object.keys(acc).forEach(function (modelId) {
        if (badOwner((acc[modelId] || {}).accountable_persona)) multi.push(catalog.threats[id].name + " in " + modelId);
      });
    });
    body.appendChild(makeEl("h3", "", "Multiple accountable owners"));
    addList(multi.length ? multi : ["This check found no cell with more than one accountable persona."]);

    body.appendChild(makeEl("h3", "", "Prevention, detection, response, and recovery"));
    body.appendChild(makeEl("p", "", "Not classified. No control stores a value for those four functions. Vertical lifecycle stages are a different field and are not shown here as those functions."));
  }

  var VENDOR_SCRIPTS = [
    ["/shared/vendor/graphology-0.26.0.umd.min.js", function () { return !!(window.graphology && window.graphology.UndirectedGraph); }]
  ];

  /* The page loads the library with defer. After a failed attempt, Retry
     adds a script tag if it is still missing. */
  function ensureVendors() {
    return Promise.all(VENDOR_SCRIPTS.map(function (entry) {
      if (entry[1]()) return null;
      return new Promise(function (resolve, reject) {
        var tag = document.createElement("script");
        tag.src = entry[0];
        tag.onload = resolve;
        tag.onerror = function () { reject(new Error("Could not load " + entry[0] + ".")); };
        document.head.appendChild(tag);
      });
    }));
  }

  function loadFiles() {
    return Promise.all([
      fetchJson("/data/layers.json"),
      fetchJson("/data/personas.json"),
      fetchJson("/data/matrix.json"),
      fetchJson("/tools/policy-pyramid/data.json"),
      fetchJson("/data/ai-agentic-principles.json")
    ].concat(CONTROL_FILES.map(function (file) { return fetchJson(file[2]); })).concat([
      fetchJson("/data/threats.json"),
      fetchJson("/data/moral-regulatory-hierarchy.json"),
      fetchJson("/data/regulations.json"),
      fetchJson("/data/sector-model-map.json"),
      fetchJson("/data/attack-inventory.json")
    ]));
  }

  function initialize(userRetry) {
    errorBox.hidden = true;
    errorEl.textContent = "";
    if (loadingEl) loadingEl.hidden = false;
    statusEl.textContent = "";
    statusEl.appendChild(makeEl("span", "visually-hidden", userRetry ? "Loading map data again." : "Loading map data."));
    return ensureVendors().then(loadFiles).then(function (files) {
      var data = {
        layers: files[0],
        personas: files[1],
        matrix: files[2],
        policy: files[3],
        topics: files[4],
        threats: files[5 + CONTROL_FILES.length],
        requirements: files[6 + CONTROL_FILES.length],
        regulations: files[7 + CONTROL_FILES.length],
        sectorMap: files[8 + CONTROL_FILES.length],
        attacks: files[9 + CONTROL_FILES.length],
        controlFiles: CONTROL_FILES.map(function (file, i) {
          return {
            slug: file[0],
            name: file[1],
            short: file[1].slice(0, 3).toUpperCase(),
            provenance: (files[5 + i] && files[5 + i].provenance) || "",
            json: files[5 + i]
          };
        })
      };
      data.controlFiles.forEach(function (file) {
        if (file.slug === "public-sector") file.short = "PUB";
        if (file.slug === "healthcare") file.short = "HCR";
        if (file.slug === "manufacturing") file.short = "MFG";
        if (file.slug === "tapestry") file.short = "TAP";
        if (file.slug === "insurance") file.short = "INS";
        if (file.slug === "defense") file.short = "DEF";
        if (file.slug === "finance") file.short = "FIN";
        if (file.slug === "common") file.short = "COM";
      });
      var models = buildGraph(data);
      renderModelRadios(models);
      renderLayerRadios((data.layers && data.layers.layers) || []);
      fillLayerFrames();
      renderCoverage();
      renderModelNote();
      restoringHistory = true;
      applyFromLocation();
      restoringHistory = false;
      start();
      if (loadingEl) loadingEl.hidden = true;
    }).catch(function (err) {
      var detail = err && err.message ? err.message : "The site data could not be read.";
      var name = err && err.name ? err.name : "";
      var isDomBug = name === "TypeError" || /null|undefined|textContent|Cannot set properties/i.test(detail);
      var isFetchFail = /Could not load |Failed to fetch|NetworkError|Load failed|JSON/i.test(detail) ||
        name === "SyntaxError";
      if (typeof console !== "undefined" && console.error) {
        console.error(isDomBug ? "[relationship-map] render failed after data load:" : "[relationship-map] load failed:", err);
      }
      if (isDomBug && !isFetchFail) {
        showError("The map UI failed to finish rendering. " + detail + " Reload the page. If it keeps failing, report this as a site bug.", userRetry);
        return;
      }
      showError("The map data did not load. " + detail + " Check your connection, then choose Retry.", userRetry);
    });
  }

  if (retryBtn) retryBtn.addEventListener("click", function () {
    statusEl.setAttribute("tabindex", "-1");
    statusEl.focus({ preventScroll: true });
    initialize(true);
  });

  if (coverageMode) {
    document.body.classList.add("coverage-mode");
    document.title = "Data coverage · AI Security & Accountability Explorer · AI Shared Responsibility";
    var coverageTitle = document.querySelector(".page-hero__title");
    if (coverageTitle) coverageTitle.textContent = "Data coverage";
    var coverageSection = document.getElementById("coverage");
    if (coverageSection) coverageSection.hidden = false;
  }

  initialize(false);
})();
