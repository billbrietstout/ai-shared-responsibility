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
 *   risk     data/threats.json                        threats[] (the 31 Risk records)
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
 *   risk-control    threats[].related_controls
 *
 * Chain provenance is drawn on the four-column board:
 *   risk to obligation     threats[].obligations[] (dashed when the basis is
 *                          derived_via_control or editorial)
 *   obligation to control  the source control on that link, or a citation match
 *                          (solid). A current-obligation citation with no article
 *                          match is dotted and marked Instrument-level.
 *   control to persona     controls[].accountable_by_model for the chosen model
 *
 * Every mode opens the same four-column board: Explore a risk, Explore a
 * control, and Explore accountability. The mode sets which column holds the
 * choice list. ?view=full and ?view=full&node= open this board when the query
 * names a risk, control, persona, or node that can build a chain, and the
 * empty start state otherwise. ?tapestry=1 includes proposed-extension
 * records in the layer view. Tapestry records stay out of an SRF chain.
 *
 * A control is Tapestry when its file or record provenance is proposed-extension,
 * or when every operating model it names is a proposed-extension model.
 * A persona is Tapestry when its provenance is proposed-extension.
 * Tapestry records stay out of an SRF chain.
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
  var modelNote = document.getElementById("model-note");
  var layerList = document.getElementById("layer-filter-list");
  var tapestryInput = document.getElementById("show-tapestry");
  var contextBtn = document.getElementById("show-context");
  var contextBoard = document.getElementById("context-board");
  var helpEl = document.getElementById("map-help");
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
  var finderEl = document.querySelector(".map-stage");
  var coverageMode = new URLSearchParams(location.search).get("page") === "coverage";
  var restoringHistory = false;
  var openColumn = "risk";
  var expandedColumns = {};
  var COLUMN_LIMIT = 8;
  var opener = null;
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
  var detailsSummary = copyStatus;
  var detailsLive = copyStatus;

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
  var view = "search";
  var root = null;
  var selected = null;
  var showTapestry = false;
  var modelFilter = "all";
  var layerFilter = "all";
  var entry = "";
  var personaPick = "";
  var reqPick = "";
  var catalog = null;
  var currentChain = null;
  var chainFocus = "";
  var linkHits = null;
  var linkNote = "";
  var skippedModels = {};
  var missingLinks = [];

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
    return next;
  }

  function buildGraph(data) {
    var Graph = window.graphology && window.graphology.UndirectedGraph;
    if (typeof Graph !== "function") throw new Error("Graphology did not load.");
    graph = new Graph();
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
    if (attrs.kind === "control" && modelFilter !== "all") {
      if (!attrs.coreModels || attrs.coreModels.indexOf(modelFilter) === -1) return false;
    }
    return true;
  }

  /* The layer filter narrows what the finder and suggestion lists offer. It
   * does not remove controls from an open chain, because a threat can name a
   * control in another layer. */
  function layerAllowed(attrs) {
    return !!attrs && (layerFilter === "all" || attrs.layer === layerFilter);
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
    if (!attrs || attrs.kind !== "control" || attrs.tapestry) return false;
    if (!nodeAllowed(attrs)) return false;
    if (!(attrs.coreModels && attrs.coreModels.length)) return false;
    if (modelFilter === "all") return true;
    return attrs.coreModels.indexOf(modelFilter) !== -1;
  }

  function modelsFor(attrs) {
    var models = (attrs.coreModels || []).filter(function (id) { return MODEL_ORDER.indexOf(id) !== -1; });
    models.sort(function (a, b) { return MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b); });
    if (modelFilter === "all") return models;
    return models.indexOf(modelFilter) === -1 ? [] : [modelFilter];
  }

  function basisIsDashed(basis) {
    return basis === "derived_via_control" || basis === "editorial" || basis === "editorial_mapping" ||
      !(basis === "official_text" || basis === "official_legal_text" || basis === "named_citation" || basis === "named_cite");
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
    named_citation: "named citation",
    named_cite: "named citation"
  };
  var BASIS_GLOSS = {
    derived_via_control: "The legal text is not the source of this link. It runs through a shared control.",
    official_text: "Taken from the official text.",
    official_legal_text: "Taken from the official text.",
    editorial: "The legal text is not the source of this link.",
    editorial_mapping: "The legal text is not the source of this link.",
    named_citation: "The record names this citation.",
    named_cite: "The record names this citation."
  };

  function basisSentence(basis) {
    if (!basis) return "No source citation recorded yet.";
    return (BASIS_GLOSS[basis] || "The source record gives a basis that this page does not describe yet.");
  }

  function basisChip(basis) {
    if (!basis) return "No source citation recorded yet.";
    return "Basis: " + (BASIS_SHORT[basis] || "other") + ".";
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
    if (edge.style === "dashed") chain.dashed += 1;
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
      owasp_dsgai: "OWASP DSGAI"
    };
    return Object.keys(labels).map(function (key) {
      if (!map[key]) return "";
      return labels[key] + ": " + map[key];
    }).filter(Boolean);
  }

  /* Search matches recorded identifiers and descriptions only. The OWASP LLM
   * Top 10, MITRE ATLAS, and OWASP DSGAI mapping strings are the framework IDs
   * on the record. BIML is left out of the search index. */
  var SEARCH_MAPPING_KEYS = ["owasp_llm_top10", "mitre_atlas", "owasp_dsgai"];
  function threatSearchText(threat) {
    var map = threat.mappings || {};
    return SEARCH_MAPPING_KEYS.map(function (key) { return map[key]; })
      .concat([threat.impact, threat.attack_surface, threat.layer_rationale]);
  }

  /* A DSGAI record has no per-entry source URL in the AI Exchange field. It
   * cites the DSGAI collection, which threats.json records once under sources. */
  function riskSource(threat) {
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
      if (modelFilter !== "all" && modelId !== modelFilter) return;
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
      crossLayerNote: attrs.crossLayerNote || ""
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
    return {
      id: "accountable:" + nodeId,
      controlId: nodeId,
      controlName: attrs.name,
      lines: lines,
      sectorPersona: attrs.accountablePersona || "",
      linkBasis: true
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
    var articles = [];
    var seenReq = {};
    var matched = {};
    var keys = Object.keys(attrs.mappings || {});
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
    return { articles: articles, fallbacks: fallbacks };
  }

  function pushControlGaps(chain, threat, controlCount) {
    function gapFor(modelId) {
      var label = modelName(modelId);
      chain.gaps.push({
        column: "control",
        text: "Confirmed coverage gap. No linked control is recorded for this risk in " + label + ". The recorded persona stays visible. This is not a missing owner."
      });
    }
    if (modelFilter !== "all") {
      if (!controlCount) gapFor(modelFilter);
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
    (threat.related_controls || []).forEach(function (fullId) {
      var node = controlRecord(fullId);
      if (!node || seen[node.id] || !controlInChain(node.attrs)) return;
      seen[node.id] = true;
      nodes.push(node);
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
    nodes.forEach(function (node) { chain.controls.push(controlCard(node.id, node.attrs)); });
    sortChainControls(chain);
    pushControlGaps(chain, threat, nodes.length);
    addPersonaCards(chain, nodes);
    return chain;
  }

  function chainFromControl(nodeId, attrs) {
    var chain = blankChain("control");
    var threats = [];
    Object.keys(catalog.threats).forEach(function (id) {
      var threat = catalog.threats[id];
      if ((threat.related_controls || []).indexOf(attrs.fullId) !== -1) threats.push(threat);
    });
    threats.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    if (!threats.length) {
      chain.gaps.push({ column: "risk", text: "No risk record names this control." });
    }
    threats.forEach(function (threat) { chain.risks.push(riskCard(threat)); });
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
      if (named) nodes.push({ id: nodeId, attrs: attrs });
    });
    var controlFullIds = {};
    nodes.forEach(function (node) { controlFullIds[node.attrs.fullId] = true; });
    var threats = [];
    Object.keys(catalog.threats).forEach(function (threatId) {
      var threat = catalog.threats[threatId];
      var named = MODEL_ORDER.some(function (modelId) {
        if (modelFilter !== "all" && modelId !== modelFilter) return false;
        return ((threat.accountability || {})[modelId] || {}).accountable_persona === id;
      });
      var viaControl = (threat.related_controls || []).some(function (fullId) { return controlFullIds[fullId]; });
      if (named || viaControl) threats.push(threat);
    });
    threats.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    threats.forEach(function (threat) { chain.risks.push(riskCard(threat)); });
    nodes.sort(function (a, b) {
      return compareControlNodes(a, b);
    });
    var riskIds = {};
    chain.risks.forEach(function (card) { riskIds[card.id] = true; });
    var obligationCards = {};
    nodes.forEach(function (node) {
      chain.controls.push(controlCard(node.id, node.attrs));
      addEdge(chain, { from: node.id, to: "accountable:persona:" + id, style: "solid" });
      threats.forEach(function (threat) {
        if ((threat.related_controls || []).indexOf(node.attrs.fullId) !== -1 && riskIds["risk:" + threat.id]) {
          addEdge(chain, { from: "risk:" + threat.id, to: node.id, style: "solid" });
        }
      });
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
    chain.personaCards.push({
      id: "accountable:persona:" + id,
      controlId: "persona:" + id,
      controlName: personaLabel(id),
      lines: [{
        model: modelFilter,
        label: modelFilter === "all" ? "Selected models" : modelName(modelFilter),
        personaId: id,
        name: personaLabel(id),
        missing: false
      }],
      sectorPersona: ""
    });
    chain.personaCount = 1;
    return chain;
  }

  function obligationCardFrom(cardId, item, instrumentLevel) {
    var source = instrumentLevel ? item.reg : item.req;
    return {
      id: cardId,
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
    var key = [modelFilter, layerFilter, showTapestry].join("|");
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
    cards.sort(function (a, b) {
      return String(a.citation) < String(b.citation) ? -1 : String(a.citation) > String(b.citation) ? 1 : 0;
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
      chain.risks.push(riskCard(row.threat));
      if (row.direct) addEdge(chain, { from: "risk:" + row.threat.id, to: obligationId, style: basisIsDashed(row.direct.basis) ? "dashed" : "solid" });
      row.viaControl.forEach(function (node) { addEdge(chain, { from: "risk:" + row.threat.id, to: node.id, style: "solid" }); });
    });
    nodes.forEach(function (node) {
      chain.controls.push(controlCard(node.id, node.attrs));
      addEdge(chain, { from: obligationId, to: node.id, style: node.instrumentLevel ? "dotted" : "solid" });
    });
    if (!nodes.length) chain.gaps.push({ column: "control", text: "No control cites this obligation for the selected operating model." });
    addPersonaCards(chain, nodes);
    return chain;
  }

  function buildChain(nodeId) {
    if (!graph.hasNode(nodeId)) return null;
    var attrs = graph.getNodeAttributes(nodeId);
    if (attrs.tapestry) return null;
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
    return CORE_PERSONAS.filter(function (id) {
      return graph.hasNode("persona:" + id) && graph.getNodeAttribute("persona:" + id, "provenance") !== "proposed-extension";
    }).map(function (id) { return "persona:" + id; });
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

  /* Each select lists every item of its kind that passes the Options filters.
     Nothing on the chain changes these lists. A select shows its own pick
     while the focus is in its column and the All option otherwise. */
  function choiceSelect(key, headingId) {
    var select = makeEl("select", "pick-select chain-pick");
    select.id = "chain-select-" + key;
    select.dataset.column = key;
    select.setAttribute("aria-labelledby", headingId);
    var current = focusKey() === key ? focusValue() : "";
    if (key === "obligation") {
      var cards = obligationChoiceCards();
      var all = document.createElement("option");
      all.value = "";
      all.textContent = ALL_LABEL[key] + " (" + cards.length + ")";
      select.appendChild(all);
      cards.forEach(function (card) {
        var option = document.createElement("option");
        option.value = card.id;
        option.textContent = optionText(key, card);
        select.appendChild(option);
      });
      if (current && !cards.some(function (card) { return card.id === current; })) {
        var held = currentChain && currentChain.obligations.filter(function (card) { return card.id === current; })[0];
        if (held) {
          var extra = document.createElement("option");
          extra.value = held.id;
          extra.textContent = optionText(key, held);
          select.appendChild(extra);
        }
      }
    } else {
      var ids = key === "risk" ? riskChoiceIds() : key === "control" ? suggestedIds() : personaChoiceIds();
      fillSelect(select, ids, ALL_LABEL[key] + " (" + ids.length + ")", function (attrs) {
        return attrs.name;
      }, key === "accountable", key === "control");
      if (current && ids.indexOf(current) === -1 && graph.hasNode(current)) {
        var held2 = document.createElement("option");
        held2.value = current;
        held2.dataset.nodeId = current;
        held2.textContent = graph.getNodeAttribute(current, "name");
        select.appendChild(held2);
      }
    }
    select.value = current;
    return select;
  }

  var START_NOTE = "Choose a risk, an obligation, a control, or an accountable persona in any menu. The boxes then show what links to it.";
  var CONTROL_SOURCE_NOTE = "These controls come from the site's sector catalogs. They are not yet drawn from the CoSAI Risk Map controls.yaml. Narrow the list with Operating model and Layer.";

  function entryChain() {
    var chain = blankChain("risk");
    chain.blank = true;
    return chain;
  }

  function announceDetails() {
    if (!detailsLive) return;
    var kind = detailsKind ? detailsKind.textContent : "";
    var name = detailsHeading ? detailsHeading.textContent : "";
    detailsLive.textContent = "Details updated: " + (kind ? kind + ", " : "") + name + ".";
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
      entry = key === "risk" ? "threat" : "control";
      if (graph.hasNode(value) && graph.getNodeAttribute(value, "tapestry")) showTapestry = true;
    } else if (key === "obligation") {
      reqPick = value;
      chainFocus = value;
      entry = "obligation";
    } else {
      personaPick = value.replace(/^persona:/, "");
      chainFocus = "accountable:persona:" + personaPick;
      entry = "account";
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
      return hit ? (hit.citation && hit.citation !== hit.title ? hit.citation + ": " + hit.title : hit.title) : "";
    }
    return "";
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
    chainBoard.textContent = "";
    var chainTitle = focusName();
    chainHeading.textContent = chainTitle ? "Chain for " + chainTitle + (modelFilter === "all" ? "" : " in " + modelName(modelFilter)) : "Chain";
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
    } else if (chain.blank) {
      notes.push(START_NOTE);
    } else if (chain.startKind === "persona") {
      notes.push("These are the controls that name this persona as accountable, with their risks and obligations.");
    } else if (chain.startKind === "obligation") {
      notes.push("These are the controls that cite this obligation, with their risks and accountable personas.");
    } else if (modelFilter === "all") {
      notes.push("All shows one accountable persona for each operating model. The model name is on that persona. Choose one model to see only that persona.");
    }
    if (chain.startKind === "control" || (chain.blank && entry === "control")) notes.push(CONTROL_SOURCE_NOTE);
    chainModelNote.textContent = notes.filter(Boolean).join(" ");
    var columns = [
      ["Risk", chain.risks, "risk"],
      ["Obligation", chain.obligations, "obligation"],
      ["Control", chain.controls, "control"],
      ["Accountable", chain.personaCards, "accountable"]
    ];
    columns.forEach(function (column) {
      var wrap = makeEl("div", "chain-col");
      var select = choiceSelect(column[2], "chain-col-" + column[2]);
      var headingName = column[0] + " (" + (select.options.length - 1) + ")";
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
      wrap.appendChild(select);
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
          var duty = item.title && item.title !== item.citation ? item.title : (item.summary || item.title || item.citation);
          if (item.citation && item.citation !== duty) button.appendChild(makeEl("span", "chain-card__kicker", item.citation));
          button.appendChild(makeEl("span", "chain-card__title", duty));
          button.appendChild(makeEl("span", "chain-card__tag", item.instrumentLevel ? "Instrument-level" : "Implements this obligation"));
          (item.basisChips || []).forEach(function (text) {
            button.appendChild(makeEl("span", "chain-card__meta", text));
          });
        } else if (column[2] === "control") {
          button.appendChild(makeEl("span", "chain-card__kicker", [item.layer ? "Operates at " + item.layer : "", item.meta, item.ref].filter(Boolean).join(" · ")));
          button.appendChild(makeEl("span", "chain-card__title", item.name));
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
      svg.appendChild(path);
    });
  }

  function appendSentence(parent, text) {
    if (!text) return;
    parent.appendChild(makeEl("p", "", text));
  }

  function glanceLines(chain) {
    if (chain.startKind !== "risk" && chain.startKind !== "control") return [];
    var where = modelFilter === "all" ? "across all operating models" : "in " + modelName(modelFilter);
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
        return (modelFilter === "all" ? label + ": " : "") + byModel[label].join(" and ");
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
      appendSentence(about, focus.item.title || focus.item.citation || "Obligation record.");
      if (focus.item.summary) appendSentence(about, focus.item.summary);
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
      appendSentence(meta, "Operating model filter: " + (modelFilter === "all" ? "All" : modelName(modelFilter)) + ".");
    } else if (focus && focus.kind === "control") {
      appendSentence(meta, layerSentence(focus.item.layer));
      appendSentence(meta, [focus.item.meta, focus.item.ref].filter(Boolean).join(" · "));
      appendSentence(meta, "Operating model filter: " + (modelFilter === "all" ? "All" : modelName(modelFilter)) + ".");
      (focus.item.sectorModels || []).forEach(function (row) {
        appendSentence(meta, "Sector model " + row.name + " is mapped to " + modelName(row.srf) + " by data/sector-model-map.json. The sector name stays on this control.");
      });
    } else if (focus && focus.kind === "obligation") {
      appendSentence(meta, "Operating model filter: " + (modelFilter === "all" ? "All" : modelName(modelFilter)) + ".");
    } else if (controlAttrs) {
      appendSentence(meta, layerSentence(controlAttrs.layer));
      appendSentence(meta, [controlAttrs.meta, controlAttrs.ref].filter(Boolean).join(" · "));
    } else {
      appendSentence(meta, "Operating model filter: " + (modelFilter === "all" ? "All" : modelName(modelFilter)) + ".");
    }

    var account = sectionBlock("Accountability", "details-accountability");
    if (chain.startKind === "persona") {
      chain.personaCards.forEach(function (item) {
        item.lines.forEach(function (line) {
          var row = makeEl("p", "");
          row.appendChild(document.createTextNode(line.label + ": "));
          row.appendChild(makeLink("/personas/#" + line.personaId, line.name));
          row.appendChild(document.createTextNode(". The control record names this persona for " + line.label + "."));
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
    if ((chain.startKind === "risk" || chain.startKind === "control") && chain.risks.length) {
      appendSentence(related, NO_CONTROL_BASIS);
    }

    var duties = sectionBlock("Supporting obligations", "details-obligations");
    var dutyList = makeEl("ul", "");
    chain.obligations.forEach(function (item) {
      var li = makeEl("li", "");
      li.appendChild(makeEl("strong", "", (item.citation ? item.citation + ": " : "") + item.title));
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
    var personaBit = modelFilter === "all" && chain.startKind !== "persona"
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
          return pools[i][j].name || pools[i][j].title || pools[i][j].controlName || "";
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
    var canClear = !!(selected || hasFocus() || view === "chain" || view === "context");
    if (copyBtn) copyBtn.hidden = !(view === "chain" && currentChain && !currentChain.blank && hasFocus());
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
      detailsMeta.hidden = true;
      detailsMeta.textContent = "";
      detailsModelNote.hidden = true;
      detailsModelNote.textContent = "";
      connectionsHeading.hidden = true;
      detailsList.hidden = true;
      renderChainDetails(currentChain);
      if (detailsSummary) detailsSummary.textContent = chainSentence(currentChain);
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
      detailsEmpty.textContent = view === "chain"
        ? "Choose an item in any menu to see its record, sources, and links."
        : "Select a risk or a control to see its record, sources, and links.";
      detailsBody.hidden = true;
      if (detailsSummary) detailsSummary.textContent = "";
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
    if (attrs.provenance === "proposed-extension") meta.push("Proposed extension. Not part of SRF v1.0.");
    if (meta.length) {
      detailsMeta.hidden = false;
      detailsMeta.textContent = meta.join(" · ");
    } else {
      detailsMeta.hidden = true;
      detailsMeta.textContent = "";
    }
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
    if (detailsSummary) detailsSummary.textContent = summary;
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

  function publish() {
    var allowed = countNodes(function (id, attrs) { return nodeAllowed(attrs); });
    var text = "";
    if (view === "chain" && currentChain && !currentChain.blank) {
      text = chainSentence(currentChain);
    } else if (view === "chain" && currentChain) {
      text = currentChain.note || START_NOTE;
    } else if (view === "search") {
      var offered = countNodes(function (id, attrs) { return nodeAllowed(attrs) && layerAllowed(attrs); });
      text = unit(offered.risk || 0, "risk", "risks") + " and " + unit(offered.control || 0, "control", "controls") + " can be opened.";
      if (modelFilter === "all" && !showTapestry && stats.tapestryControls) {
        text += " " + unit(stats.tapestryControls, "Tapestry control is hidden.", "Tapestry controls are hidden.");
      }
      text += " Choose a risk, an obligation, a control, or a persona to see its chain.";
    } else if (view === "context") {
      text = "Layers run from L1 to L5. Open a name to see its chain.";
    } else {
      text = "Choose a risk, an obligation, a control, or a persona to see its chain.";
    }
    statusEl.textContent = text;
    statusEl.dataset.view = view;
    statusEl.dataset.model = modelFilter;
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
    statusEl.dataset.mode = entry;
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
      if (modelFilter === "all" && !(attrs.coreModels && attrs.coreModels.length)) return;
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
    return card.citation && card.citation !== card.title ? card.citation + ": " + card.title : card.title;
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
      search: [card.citation, card.title, card.summary, card.citationText].filter(Boolean).join(" ").toLowerCase()
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

  var MODE_SEARCH = {
    threat: { kind: "risk", label: "Find a risk", placeholder: "Risk name or a few words", noun: "a risk", none: "No matching risk." },
    obligation: { kind: "obligation", label: "Find an obligation", placeholder: "Obligation citation or a few words", noun: "an obligation", none: "No matching obligation." },
    control: { kind: "control", label: "Find a control", placeholder: "Control name or a few words", noun: "a control", none: "No matching control." },
    account: { kind: "persona", label: "Find an accountable persona", placeholder: "Persona name", noun: "an accountable persona", none: "No matching persona." }
  };

  function matches(query) {
    var q = query.trim().toLowerCase();
    wordMatch = null;
    if (!q) return [];
    var ids = [];
    var allowed = [];
    var only = MODE_SEARCH[entry] ? MODE_SEARCH[entry].kind : "";
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind !== "control" && attrs.kind !== "risk") return;
      if (only && attrs.kind !== only) return;
      if (!nodeAllowed(attrs) || !layerAllowed(attrs)) return;
      allowed.push(id);
      if (attrs.search.indexOf(q) !== -1) ids.push(id);
    });
    obligationChoiceCards().map(function (card) { return card.id; }).concat(personaChoiceIds()).filter(function (id) {
      return !only || searchAttrs(id).kind === only;
    }).forEach(function (id) {
      allowed.push(id);
      if (searchAttrs(id).search.indexOf(q) !== -1) ids.push(id);
    });
    var counts = {};
    if (!ids.length) {
      var words = queryWords(q);
      if (words.length >= 2) {
        var needed = words.length <= 2 ? words.length : words.length - 1;
        allowed.forEach(function (id) {
          var haystack = searchAttrs(id).search;
          var hit = words.filter(function (word) {
            return haystack.indexOf(word) !== -1;
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
      searchNote.textContent = MODE_SEARCH[entry] ? MODE_SEARCH[entry].none : "No matching risk, obligation, control, or persona.";
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
      option.textContent = label(attrs);
      groups[key].appendChild(option);
    });
    order.sort(function (x, y) {
      return (layerRank(x.layer) - layerRank(y.layer)) || compareSectors(x.sector, y.sector);
    });
    if (!flat) order.forEach(function (group) { select.appendChild(groups[group.key]); });
  }

  function renderSummary() {
    if (!summaryEl || !graph) return;
    if (entry === "requirement") {
      summaryEl.textContent = "";
      return;
    }
    var counts = [];
    if (entry !== "threat") counts.push(unit(suggestedIds().length, "control", "controls"));
    if (entry !== "control") {
      var threatCount = riskIds().filter(function (id) {
        return layerAllowed(graph.getNodeAttributes(id));
      }).length;
      counts.push(unit(threatCount, "risk", "risks"));
    }
    summaryEl.textContent = (modelFilter === "all" ? "All operating models" : modelName(modelFilter)) + ", " + (layerFilter === "all" ? "all layers" : layerFilter) + ": " + counts.join(", ");
  }

  function syncToggles() {
    tapestryInput.checked = showTapestry;
    document.querySelectorAll('input[name="operating-model"]').forEach(function (radio) {
      radio.checked = radio.value === modelFilter;
    });
    document.querySelectorAll('input[name="layer"]').forEach(function (radio) {
      radio.checked = radio.value === layerFilter;
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

    var modeSearch = MODE_SEARCH[entry];
    if (findLabel) findLabel.textContent = modeSearch ? modeSearch.label : "Find a risk, obligation, control, or persona";
    searchInput.placeholder = modeSearch ? modeSearch.placeholder : "Name or a few words";
    if (contextOn) {
      helpEl.textContent = "Layers show personas and controls by L1 to L5. Open a name to see its ROCA chain.";
    } else if (view === "chain") {
      helpEl.textContent = "Four columns: Risk, Obligation, Control, and Accountable. " +
        "Each menu lists every item in its column. A choice shows the items linked to it in the other columns. " +
        "Details for the choice appear beside the columns on a wide screen and below them on a narrow one.";
    } else {
      helpEl.textContent = "Type a name or a few words about " + (modeSearch ? modeSearch.noun : "a risk, an obligation, a control, or a persona") + ". Use the arrow keys to move through the matches, Enter to open one, and Escape to close the list.";
    }

    if (view === "chain" && !currentChain) {
      chainEmpty.hidden = false;
      chainEmpty.textContent = "This record has no chain for the selected operating model.";
    } else {
      chainEmpty.hidden = true;
      chainEmpty.textContent = "";
    }
    var panelOpen = !!(chainOn || contextOn || selected || personaPick);
    mapPage.classList.toggle("is-panel-open", panelOpen);
    syncEntry();
    renderSummary();
    syncSheet();
  }

  function syncSheet() {
    var open = mapPage.classList.contains("is-panel-open") && narrowQuery.matches;
    document.body.classList.toggle("sheet-open", open);
    SHEET_INERT.forEach(function (selector) {
      Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
        if (open) el.setAttribute("inert", "");
        else el.removeAttribute("inert");
      });
    });
  }

  function syncEntry() {
    ["threat", "obligation", "requirement", "control", "account"].forEach(function (key) {
      var button = document.getElementById("entry-" + key);
      if (button) button.setAttribute("aria-pressed", entry === key ? "true" : "false");
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

  /* Every mode opens the same ROCA chain. The mode sets only which column
     opens first on a phone: Risk, Control, or Accountable. */
  var ENTRY_COLUMN = { threat: "risk", obligation: "obligation", control: "control", account: "accountable" };

  function chooseEntry(next) {
    entry = next;
    root = null;
    selected = null;
    personaPick = "";
    reqPick = "";
    chainFocus = "";
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    expandedColumns = {};
    view = ENTRY_COLUMN[next] ? "chain" : "search";
    openColumn = ENTRY_COLUMN[next] || "risk";
    commit(true);
    if (view === "chain") revealChain();
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
    if (moveFocus) rememberOpener();
    openColumn = "accountable";
    personaPick = id;
    entry = "account";
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
    if (modelFilter !== "all" && MODEL_SLUG[modelFilter]) params.set("model", MODEL_SLUG[modelFilter]);
    if (layerFilter !== "all") params.set("layer", layerFilter);
    if (showTapestry) params.set("tapestry", "1");
    if (view === "context") params.set("view", "context");
    else if (hasNode || modelFilter !== "all" || layerFilter !== "all" || showTapestry) params.set("view", "list");
    return params.toString().replace(/%3A/g, ":");
  }

  /* Opening a chain adds a history entry so Back returns to the list.
     Filter, model, and close changes replace the current entry. */
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
    if (attrs.tapestry) return "This is a Tapestry record. Tapestry records stay out of an SRF chain.";
    return outsideFilter(attrs)
      ? GAP_NOTE + " Choose All to see it in a chain."
      : "This control does not list " + modelName(modelFilter) + ". Choose All under Operating model to see it.";
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
      view = "search";
      return;
    }
    var attrs = graph.getNodeAttributes(node);
    if (attrs.kind === "persona" && CORE_PERSONAS.indexOf(attrs.ref) !== -1 && attrs.provenance !== "proposed-extension") {
      personaPick = attrs.ref;
      entry = "account";
      view = "chain";
      chainFocus = "accountable:persona:" + attrs.ref;
      return;
    }
    if ((attrs.kind === "risk" || attrs.kind === "control") && buildChain(node)) {
      root = node;
      selected = node;
      chainFocus = node;
      view = "chain";
      entry = attrs.kind === "risk" ? "threat" : "control";
      return;
    }
    view = "search";
  }

  function applyFromLocation() {
    if (!graph) return;
    var params = new URLSearchParams(location.search);
    modelFilter = modelFromSlug(params.get("model")) || "all";
    var layer = params.get("layer") || "all";
    layerFilter = layer === "all" || LAYERS.indexOf(layer) !== -1 ? layer : "all";
    showTapestry = params.get("tapestry") === "1";
    linkHits = null;
    linkNote = "";
    root = null;
    selected = null;
    chainFocus = "";
    personaPick = "";
    reqPick = "";
    entry = "";
    var viewParam = params.get("view");
    view = viewParam === "context" ? "context" : "search";
    openColumn = "risk";
    var controlParam = params.get("control");
    var riskParam = params.get("risk");
    var personaParam = params.get("persona") || "";
    var typeParam = params.get("type");
    var nodeParam = params.get("node");
    if (typeParam === "obligation" && nodeParam && viewParam !== "full") {
      if (/^(obligation|instrument):/.test(nodeParam)) {
        reqPick = nodeParam;
        entry = "obligation";
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
        entry = openedAttrs.kind === "risk" ? "threat" : "control";
        openColumn = ENTRY_COLUMN[entry];
      }
    } else {
      var asked = personaParam;
      if (CORE_PERSONAS.indexOf(asked) !== -1 && graph.hasNode("persona:" + asked)) {
        var personaAttrs = graph.getNodeAttributes("persona:" + asked);
        if (personaAttrs.provenance !== "proposed-extension") {
          personaPick = asked;
          openColumn = "accountable";
          entry = "account";
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
    if (mapPanel && narrowQuery.matches && mapPage.classList.contains("is-panel-open")) {
      var bar = mapPanel.querySelector(".chain-workspace__bar:not([hidden])") || mapPanel.querySelector(".details__bar");
      var offset = (bar && bar.getClientRects().length ? bar.getBoundingClientRect().height : 0) + 8;
      var delta = target.getBoundingClientRect().top - mapPanel.getBoundingClientRect().top - offset;
      mapPanel.scrollTop += delta;
      target.focus({ preventScroll: true });
      return;
    }
    scrollToTarget(target);
  }

  function revealChain() {
    if (!currentChain) return;
    updateChrome();
    if (chainEl.hidden) return;
    if (mapPanel && narrowQuery.matches) mapPanel.scrollTop = 0;
    else chainWorkspace.scrollIntoView({ block: "start", behavior: "auto" });
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
    if (mapPanel && narrowQuery.matches) mapPanel.scrollTop = 0;
    detailsHeading.setAttribute("tabindex", "-1");
    detailsHeading.focus({ preventScroll: true });
  }

  function openControl(id, moveFocus, options) {
    options = options || {};
    if (!graph.hasNode(id)) return;
    var attrs = graph.getNodeAttributes(id);
    if (attrs.kind !== "risk" && attrs.kind !== "control") return;
    if (moveFocus) rememberOpener();
    entry = attrs.kind === "risk" ? "threat" : "control";
    if (root !== id) {
      openColumn = ENTRY_COLUMN[entry];
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
      if (moveFocus) rememberOpener();
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
        if (modelFilter !== "all" && modelId !== modelFilter) return;
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
        if (CORE_PERSONAS.indexOf(attrs.ref) === -1) return;
        people.appendChild(nodeButton(id, attrs.name));
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
        wrap.appendChild(nodeButton(id, graph.getNodeAttribute(id, "name")));
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
    entry = "";
    root = null;
    selected = null;
    chainFocus = "";
    personaPick = "";
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    commit(push);
  }

  function showSearch(push) {
    view = "search";
    root = null;
    selected = null;
    chainFocus = "";
    personaPick = "";
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    commit(push);
  }

  /* Clear steps back one level: first the chain focus (the four menus stay
     full), then the mode itself. */
  function clearSelection(push) {
    if (view === "chain" && hasFocus()) {
      linkHits = null;
      linkNote = "";
      clearFocus();
      commit(!!push);
      return;
    }
    if (view === "chain" || view === "context") {
      entry = "";
      showSearch(!!push);
      return;
    }
    selected = null;
    commit(!!push);
  }

  function closePanel(push) {
    entry = "";
    showSearch(push);
    restoreOpener();
  }

  function rememberOpener() {
    var el = document.activeElement;
    if (el && finderEl && finderEl.contains(el) && el !== document.body) {
      opener = { el: el, id: el.dataset ? el.dataset.nodeId : "" };
    } else if (!opener) {
      opener = { el: searchInput, id: "" };
    }
  }

  function restoreOpener() {
    openOptions();
    var target = null;
    if (opener) {
      if (opener.el && opener.el.isConnected && opener.el.getClientRects().length) target = opener.el;
      else if (opener.id) target = finderEl.querySelector('[data-node-id="' + opener.id + '"]');
    }
    if (!target || !target.getClientRects().length) target = searchInput;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest" });
    opener = null;
  }

  function setModel(id, push) {
    if (id !== "all" && !coreIds[id]) id = "all";
    if (id === modelFilter) return;
    modelFilter = id;
    commit(push);
  }

  function setLayer(id, push) {
    if (id !== "all" && LAYERS.indexOf(id) === -1) id = "all";
    if (id === layerFilter) return;
    layerFilter = id;
    commit(push);
  }

  function setTapestry(on, push) {
    if (on === showTapestry) return;
    showTapestry = on;
    if (root && graph.hasNode(root) && !nodeAllowed(graph.getNodeAttributes(root))) {
      root = null;
      selected = null;
    }
    commit(push);
  }

  function renderModelRadios(models) {
    Array.prototype.slice.call(modelList.querySelectorAll("label")).slice(1).forEach(function (el) { el.remove(); });
    models.forEach(function (model) {
      var label = document.createElement("label");
      label.className = "model-option";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "operating-model";
      input.value = model.id;
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
    var all = [{ id: "all", name: "All" }].concat(layers.map(function (layer) {
      return { id: layer.id, name: layer.id + " " + layer.name };
    }));
    all.forEach(function (layer) {
      var label = document.createElement("label");
      label.className = "model-option";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "layer";
      input.value = layer.id;
      input.checked = layer.id === layerFilter;
      var text = document.createElement("span");
      text.textContent = layer.name;
      label.appendChild(input);
      label.appendChild(text);
      layerList.appendChild(label);
    });
  }

  function renderModelNote() {
    var mapped = stats.mappedFromSector || 0;
    var verb = mapped === 1 ? "uses" : "use";
    modelNote.textContent = mapped
      ? mapped + " controls " + verb + " a sector model name, such as SaMD-Cloud or OT-Edge. data/sector-model-map.json maps each name to one of these four SRF models. The sector name stays on the control. This filter uses that mapping."
      : "Sector model names are mapped to these four SRF models by data/sector-model-map.json. The sector name stays on the control.";
  }

  function start() {
    window.__relationshipMap = {
      graph: graph,
      outsideFilter: function (id) { return outsideFilter(graph.getNodeAttributes(id)); }
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
      return;
    }
    renderMatches(searchInput.value);
    var listTop = (searchResults.hidden ? searchNote : searchResults).getBoundingClientRect().top;
    var inputTop = searchInput.getBoundingClientRect().top;
    if (listTop > window.innerHeight * 0.85 && inputTop > 130) window.scrollBy({ top: inputTop - 130, behavior: "auto" });
  });
  document.getElementById("map-tools").addEventListener("click", function (event) {
    var button = event.target.closest("button[data-node-id], [role='option'][data-node-id]");
    if (!button) return;
    activateNode(button.dataset.nodeId, true);
  });
  modelList.addEventListener("change", function (event) {
    var input = event.target;
    if (!input || input.name !== "operating-model") return;
    setModel(input.value, true);
  });
  if (layerList) {
    layerList.addEventListener("change", function (event) {
      var input = event.target;
      if (!input || input.name !== "layer") return;
      setLayer(input.value, true);
    });
  }
  tapestryInput.addEventListener("change", function () {
    setTapestry(tapestryInput.checked, true);
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
    var buttons = Array.prototype.slice.call(chainBoard.querySelectorAll("button")).filter(function (b) {
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
      if (attrs.kind === "persona" && CORE_PERSONAS.indexOf(attrs.ref) !== -1) {
        openPersona(attrs.ref, true);
        return;
      }
      activateNode(id, true);
    });
  }
  document.getElementById("entry-threat").addEventListener("click", function () { chooseEntry("threat"); });
  var obligationButton = document.getElementById("entry-obligation");
  if (obligationButton) obligationButton.addEventListener("click", function () { chooseEntry("obligation"); });
  document.getElementById("entry-requirement").addEventListener("click", function () { chooseEntry("requirement"); });
  document.getElementById("entry-control").addEventListener("click", function () { chooseEntry("control"); });
  document.getElementById("entry-account").addEventListener("click", function () { chooseEntry("account"); });
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
    lines.push("- Operating model: " + (modelFilter === "all" ? "All operating models" : modelName(modelFilter)));
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
    if (copyBtn) copyBtn.textContent = "Copy chain as Markdown";
    if (copyStatus) {
      copyStatus.textContent = "";
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
      setCopyState("Copy chain as Markdown", "Could not copy. Your browser blocked clipboard access. Select the text below and copy it yourself.", true);
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

  var filtersToggle = document.getElementById("toggle-filters");
  if (filtersToggle) filtersToggle.addEventListener("click", function () {
    var open = findForm.classList.toggle("filters-open");
    filtersToggle.setAttribute("aria-expanded", open ? "true" : "false");
    filtersToggle.textContent = open ? "Hide filters" : "Change filters";
  });

  function onClearClick() {
    if (narrowQuery.matches) closePanel(true);
    else {
      clearSelection(true);
      if (view === "search") restoreOpener();
    }
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
      if (narrowQuery.matches && mapPage.classList.contains("is-panel-open")) closePanel(true);
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
    if (view === "search" && !selected) return;
    if (narrowQuery.matches) closePanel(true);
    else clearSelection(true);
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
    Object.keys(catalog.byFull).forEach(function (fullId) {
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
