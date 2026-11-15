/* Relationship map
 * Reads site JSON at runtime and draws only links those files already name.
 * No sector model name is rewritten onto an SRF v1.0 model.
 *
 * Node kinds and files:
 *   layer    data/layers.json                         layers[]
 *   persona  data/personas.json                       personas[] and sector_specializations[]
 *   model    data/matrix.json                         cosai-core models, plus proposed-extension
 *                                                     models drawn only while Tapestry is on
 *   control  data/<vertical>-controls.json            controls[]
 *   policy   tools/policy-pyramid/data.json           levels[]
 *   topic    data/ai-agentic-principles.json          sections{}
 *
 * Edge types and the field that produces them:
 *   persona-layer   personas[].srf_layers and sector_specializations[].srf_layers
 *   specializes     sector_specializations[].specializes
 *   model-layer     layers[].operating_models[<cosai-core model id>]
 *   control-layer   controls[].layer
 *   control-persona controls[].accountable_persona
 *   control-model   controls[].operating_models[] when the id is a matrix model
 *   control-policy  controls[].policy_level or controls[].policy, when the value
 *                   matches a policy level (no control has this field today)
 *
 * A control is Tapestry when its file or record provenance is proposed-extension,
 * or when every operating model it names is a proposed-extension model.
 * A persona is Tapestry when its provenance is proposed-extension.
 * Operating-model strings that are not matrix models are not drawn.
 */
(function () {
  "use strict";

  var KIND_ORDER = ["layer", "persona", "model", "control", "policy", "topic"];
  var KIND_LABEL = {
    layer: "Layer",
    persona: "Persona",
    model: "Operating model",
    control: "Control",
    policy: "Policy level",
    topic: "Whitepaper topic"
  };
  var SIZE = {
    layer: 2.4,
    persona: 1.35,
    model: 1.9,
    control: 0.5,
    policy: 1.9,
    topic: 1.05
  };
  var LAYER_Y = { L1: 84, L2: 66, L3: 48, L4: 30, L5: 12 };
  var LAYERS = ["L1", "L2", "L3", "L4", "L5"];
  var VERTICAL_RANK = {
    finance: 0,
    insurance: 1,
    "public-sector": 2,
    defense: 3,
    manufacturing: 4,
    healthcare: 5,
    tapestry: 6
  };
  var CONTROL_FILES = [
    ["finance", "Finance", "/data/finance-controls.json"],
    ["healthcare", "Healthcare", "/data/healthcare-controls.json"],
    ["insurance", "Insurance", "/data/insurance-controls.json"],
    ["public-sector", "Public sector", "/data/public-sector-controls.json"],
    ["defense", "Defense", "/data/defense-controls.json"],
    ["manufacturing", "Manufacturing", "/data/manufacturing-controls.json"],
    ["tapestry", "Tapestry", "/data/tapestry-controls.json"]
  ];
  var FALLBACK = {
    layer: "#166534",
    persona: "#1d4ed8",
    model: "#c2410c",
    control: "#6d28d9",
    policy: "#0f766e",
    topic: "#be123c",
    edge: "#475569",
    dim: "#94a3b8",
    label: "#1a2332",
    stage: "#ffffff"
  };
  var GAP_NOTE = "This control isn't in any operating model filter yet.";

  var graphEl = document.getElementById("graph");
  var graphEmpty = document.getElementById("graph-empty");
  var statusEl = document.getElementById("map-status");
  var errorEl = document.getElementById("map-error");
  var findForm = document.getElementById("find-form");
  var findLabel = document.querySelector("label[for='node-search']");
  var searchInput = document.getElementById("node-search");
  var searchResults = document.getElementById("search-results");
  var searchNote = document.getElementById("search-note");
  var suggestionsWrap = document.getElementById("suggestions-wrap");
  var suggestions = document.getElementById("suggestions");
  var modelList = document.getElementById("model-filter-list");
  var modelNote = document.getElementById("model-note");
  var tapestryInput = document.getElementById("show-tapestry");
  var kindFilters = document.getElementById("kind-filters");
  var widenBtn = document.getElementById("widen-view");
  var fullBtn = document.getElementById("full-graph");
  var startBtn = document.getElementById("start-one");
  var helpEl = document.getElementById("map-help");
  var detailsHeading = document.getElementById("details-heading");
  var detailsEmpty = document.getElementById("details-empty");
  var detailsBody = document.getElementById("details-body");
  var detailsKind = document.getElementById("details-kind");
  var detailsMeta = document.getElementById("details-meta");
  var detailsModelNote = document.getElementById("details-model-note");
  var detailsSummary = document.getElementById("details-summary");
  var detailsList = document.getElementById("details-connections");
  var clearBtn = document.getElementById("clear-selection");

  var graph = null;
  var renderer = null;
  var palette = null;
  var respLabel = {};
  var coreIds = {};
  var modelShort = { all: "All" };
  var stats = {
    controls: 0,
    srfControls: 0,
    sectorOnly: 0,
    noModels: 0,
    tapestryControls: 0,
    tapestryPersonas: 0
  };
  var shown = {
    layer: true,
    persona: true,
    model: true,
    control: true,
    policy: true,
    topic: true
  };
  var view = "search";
  var root = null;
  var selected = null;
  var wide = false;
  var showTapestry = false;
  var modelFilter = "all";
  var focusSet = {};
  var neighborMap = {};
  var linkHits = null;
  var linkNote = "";
  var skippedModels = {};
  var missingLinks = [];

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var out = {};
    ["layer", "persona", "model", "control", "policy", "topic", "edge", "dim", "label", "stage"].forEach(function (key) {
      var token = key === "label" ? "--ink" : key === "stage" ? "--surface" : "--map-" + key;
      var value = cs.getPropertyValue(token).trim();
      out[key] = value || FALLBACK[key];
    });
    return out;
  }

  function showError(message) {
    errorEl.hidden = false;
    errorEl.textContent = message;
    statusEl.textContent = "The map did not finish loading.";
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

  function listPhrase(parts) {
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
  }

  function outsideFilter(attrs) {
    return !!(attrs && attrs.kind === "control" && !attrs.tapestry && !(attrs.coreModels && attrs.coreModels.length));
  }

  function addNode(id, attrs) {
    var searchBits = [attrs.name, attrs.label, attrs.ref, attrs.meta, attrs.layer]
      .concat(attrs.coreModels || [])
      .concat(attrs.otherModels || [])
      .filter(Boolean);
    attrs.search = searchBits.join(" ").toLowerCase();
    attrs.size = SIZE[attrs.kind];
    graph.addNode(id, attrs);
  }

  function link(source, target, attr) {
    if (!graph.hasNode(source) || !graph.hasNode(target)) {
      missingLinks.push(source + " -> " + target);
      return;
    }
    if (graph.hasUndirectedEdge(source, target)) return;
    attr.size = 0.6;
    graph.addUndirectedEdge(source, target, attr);
  }

  function placeColumn(ids, x, y0, y1) {
    var step = ids.length > 1 ? (y1 - y0) / (ids.length - 1) : 0;
    ids.forEach(function (id, i) {
      graph.setNodeAttribute(id, "x", x);
      graph.setNodeAttribute(id, "y", y0 + step * i);
    });
  }

  function placeGrid(ids, x0, y0, cols, dx, dy) {
    ids.forEach(function (id, i) {
      graph.setNodeAttribute(id, "x", x0 + (i % cols) * dx);
      graph.setNodeAttribute(id, "y", y0 + Math.floor(i / cols) * dy);
    });
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
      tapestryPersonas: 0
    };

    var layers = (data.layers && data.layers.layers) || [];
    layers.forEach(function (layer) {
      addNode("layer:" + layer.id, {
        kind: "layer",
        name: layer.id + " " + layer.name,
        label: layer.id + " " + layer.short,
        ref: layer.id,
        x: 22,
        y: LAYER_Y[layer.id] || 0
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
        ref: model.id,
        x: 18 + i * 18,
        y: 104
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
        provenance: "proposed-extension",
        x: 18 + (models.length + i) * 18,
        y: 104
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

    var personaIds = [];
    var personas = (data.personas && data.personas.personas) || [];
    personas.forEach(function (persona) {
      var id = "persona:" + persona.id;
      var tapestry = persona.provenance === "proposed-extension";
      personaIds.push(id);
      if (tapestry) stats.tapestryPersonas += 1;
      addNode(id, {
        kind: "persona",
        name: persona.name,
        label: persona.name,
        ref: persona.id,
        provenance: persona.provenance || "",
        tapestry: tapestry,
        x: 0,
        y: 0
      });
      (persona.srf_layers || []).forEach(function (layerId) {
        link(id, "layer:" + layerId, { type: "persona-layer" });
      });
    });

    var specs = (data.personas && data.personas.sector_specializations) || [];
    specs.forEach(function (spec) {
      var id = "persona:" + spec.id;
      personaIds.push(id);
      addNode(id, {
        kind: "persona",
        name: spec.name,
        label: spec.name,
        ref: spec.id,
        specializes: spec.specializes || "",
        tapestry: spec.provenance === "proposed-extension",
        x: 0,
        y: 0
      });
      (spec.srf_layers || []).forEach(function (layerId) {
        link(id, "layer:" + layerId, { type: "persona-layer" });
      });
      if (spec.specializes) {
        link(id, "persona:" + spec.specializes, { type: "specializes", spec: id });
      }
    });
    placeColumn(personaIds, -6, 12, 84);

    var policyLookup = {};
    var policyIds = [];
    ((data.policy && data.policy.levels) || []).forEach(function (level) {
      var id = "policy:" + level.key;
      policyIds.push(id);
      addNode(id, {
        kind: "policy",
        name: level.label,
        label: level.label,
        ref: level.key,
        x: 0,
        y: 0
      });
      policyLookup[level.key] = id;
      if (level.label) policyLookup[String(level.label).toLowerCase()] = id;
    });
    placeGrid(policyIds, -6, -8, 5, 16, 8);

    var topicIds = [];
    var sections = (data.topics && data.topics.sections) || {};
    Object.keys(sections).forEach(function (key) {
      var section = sections[key];
      if (!section || !section.title) return;
      var id = "topic:" + key;
      topicIds.push(id);
      addNode(id, {
        kind: "topic",
        name: section.title,
        label: section.title,
        ref: key,
        x: 0,
        y: 0
      });
    });
    topicIds.sort(function (a, b) {
      return (sections[a.slice(6)].n || 0) - (sections[b.slice(6)].n || 0);
    });
    placeGrid(topicIds, 78, 16, 4, 8, 14);

    var controlsByLayer = { L1: [], L2: [], L3: [], L4: [], L5: [] };
    (data.controlFiles || []).forEach(function (file) {
      var controls = (file.json && file.json.controls) || [];
      controls.forEach(function (control) {
        var id = "control:" + file.slug + ":" + control.id;
        var tapestry = controlIsTapestry(control, file.provenance, extIds);
        var coreModels = [];
        var otherModels = [];
        var listed = control.operating_models || [];
        stats.controls += 1;
        if (tapestry) stats.tapestryControls += 1;
        listed.forEach(function (modelId) {
          if (!modelId) return;
          if (coreIds[modelId]) coreModels.push(modelId);
          else if (!extIds[modelId]) {
            skippedModels[modelId] = true;
            otherModels.push(modelId);
          }
        });
        if (coreModels.length) stats.srfControls += 1;
        else if (!tapestry && listed.length) stats.sectorOnly += 1;
        else if (!tapestry) stats.noModels += 1;
        addNode(id, {
          kind: "control",
          name: control.title,
          label: file.short + " " + String(control.id || "").replace(/^SRF-/, ""),
          ref: control.id,
          meta: file.name,
          vertical: file.slug,
          layer: control.layer || "",
          coreModels: coreModels,
          otherModels: otherModels,
          tapestry: tapestry,
          provenance: tapestry ? "proposed-extension" : (control.provenance || ""),
          x: 0,
          y: 0
        });
        if (controlsByLayer[control.layer]) controlsByLayer[control.layer].push(id);
        if (control.layer) link(id, "layer:" + control.layer, { type: "control-layer" });
        if (control.accountable_persona) {
          link(id, "persona:" + control.accountable_persona, { type: "control-persona" });
        }
        listed.forEach(function (modelId) {
          if (coreIds[modelId] || extIds[modelId]) {
            link(id, "model:" + modelId, { type: "control-model" });
          }
        });
        var policyId = policyNodeFor(control, policyLookup);
        if (policyId) link(id, policyId, { type: "control-policy" });
      });
    });
    Object.keys(controlsByLayer).forEach(function (layerId) {
      var ids = controlsByLayer[layerId];
      var cols = 10;
      var dy = 1.35;
      var rows = Math.max(1, Math.ceil(ids.length / cols));
      var originY = (LAYER_Y[layerId] || 0) - ((rows - 1) * dy) / 2;
      placeGrid(ids, 46, originY, cols, 2.15, dy);
    });

    return models.map(function (model) {
      return { id: model.id, name: model.name, short: model.short || model.id };
    });
  }

  function kindShown(kind) {
    return shown[kind] !== false;
  }

  function nodeAllowed(attrs) {
    if (!attrs) return false;
    if (attrs.tapestry && !showTapestry) return false;
    if (attrs.kind === "control" && modelFilter !== "all") {
      if (!attrs.coreModels || attrs.coreModels.indexOf(modelFilter) === -1) return false;
    }
    return true;
  }

  function nodeVisible(id) {
    if (!graph || !graph.hasNode(id)) return false;
    var attrs = graph.getNodeAttributes(id);
    if (!nodeAllowed(attrs)) return false;
    if (view === "search") return false;
    if (view === "focus") return !!focusSet[id];
    return kindShown(attrs.kind);
  }

  function edgeVisible(source, target, type) {
    if (!nodeVisible(source) || !nodeVisible(target)) return false;
    if (view === "full" && !selected && String(type).indexOf("control-") === 0) return false;
    if (view === "full" && selected && source !== selected && target !== selected) return false;
    return true;
  }

  function rebuildFocus() {
    focusSet = {};
    if (view !== "focus" || !root || !graph.hasNode(root)) return;
    if (!nodeAllowed(graph.getNodeAttributes(root))) return;
    focusSet[root] = true;
    var frontier = [root];
    var hops = wide ? 2 : 1;
    for (var hop = 0; hop < hops; hop++) {
      var next = [];
      frontier.forEach(function (id) {
        graph.forEachNeighbor(id, function (neighbor) {
          if (focusSet[neighbor]) return;
          var attrs = graph.getNodeAttributes(neighbor);
          if (!nodeAllowed(attrs)) return;
          if (hop > 0 && (attrs.kind === "control" || attrs.kind === "topic")) return;
          focusSet[neighbor] = true;
          next.push(neighbor);
        });
      });
      frontier = next;
    }
  }

  function rebuildNeighbors() {
    neighborMap = {};
    if (!selected || !graph.hasNode(selected)) return;
    graph.forEachNeighbor(selected, function (neighbor) {
      if (view === "focus") {
        if (focusSet[neighbor]) neighborMap[neighbor] = true;
        return;
      }
      if (nodeVisible(neighbor)) neighborMap[neighbor] = true;
    });
  }

  /* Operating-model and policy names are short anchors. On a wide canvas
   * they are forced on, so the label grid cannot drop AI-SaaS, Agent-PaaS,
   * or the five policy levels at the default zoom. On a narrow canvas they
   * stay on "auto": the grid may cull them until a zoom makes room. */
  function anchorLabelsForced() {
    return !!(graphEl && graphEl.clientWidth >= 700);
  }

  function labelMode(key, attrs, hovered) {
    if (key === selected || hovered) return "visible";
    if (view === "focus") return "visible";
    if (selected && !neighborMap[key]) return "hidden";
    if (attrs.kind === "layer") return "visible";
    if ((attrs.kind === "model" || attrs.kind === "policy") && anchorLabelsForced()) return "visible";
    if (attrs.kind === "persona" || attrs.kind === "model" || attrs.kind === "policy") return "auto";
    return "hidden";
  }

  function labelPlate(mode, kind) {
    if (mode === "hidden") return {};
    if (kind !== "layer" && kind !== "persona" && kind !== "model" && kind !== "policy") {
      if (!(kind === "control" && view === "focus")) return {};
    }
    return {
      labelBackgroundColor: palette.stage,
      labelBackgroundPadding: 4,
      labelDepth: "topNodes"
    };
  }

  function nodeReducer(key, data, attrs, state) {
    if (!nodeVisible(key)) return { visibility: "hidden", labelVisibility: "hidden" };
    var hovered = !!(state && state.isHovered);
    var color = palette[attrs.kind] || FALLBACK[attrs.kind];
    var inContext = view !== "full" || !selected || key === selected || neighborMap[key] || hovered;
    if (!inContext) {
      return {
        visibility: "visible",
        color: palette.dim,
        labelColor: palette.dim,
        labelVisibility: "hidden",
        zIndex: 0,
        highlighted: false,
        cursor: "pointer"
      };
    }
    var showLabel = labelMode(key, attrs, hovered);
    var z = key === selected ? 4 : (neighborMap[key] || hovered) ? 3 : (attrs.kind === "layer" || attrs.kind === "model" ? 2 : 1);
    return Object.assign({
      visibility: "visible",
      color: color,
      labelColor: palette.label,
      labelVisibility: showLabel,
      labelPosition: view === "focus" || attrs.kind !== "persona" ? "right" : "left",
      zIndex: z,
      size: key === selected ? attrs.size * 1.25 : attrs.size,
      highlighted: key === selected,
      cursor: "pointer"
    }, labelPlate(showLabel, attrs.kind));
  }

  function edgeReducer(key) {
    var source = graph.source(key);
    var target = graph.target(key);
    var type = graph.getEdgeAttribute(key, "type") || "";
    if (!edgeVisible(source, target, type)) return { visibility: "hidden" };
    return {
      visibility: "visible",
      color: palette.edge,
      size: selected ? 1.8 : 1.1
    };
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
      return graph.getNodeAttribute(fromId, "kind") === "control"
        ? "Applies in this operating model."
        : "Control in this operating model.";
    }
    if (type === "control-policy") {
      return graph.getNodeAttribute(fromId, "kind") === "control"
        ? "Policy level for this control."
        : "Control at this policy level.";
    }
    return "Connected in the site data.";
  }

  function renderDetails() {
    clearBtn.disabled = !selected;
    if (!selected || !graph.hasNode(selected)) {
      detailsHeading.textContent = "Node details";
      detailsEmpty.hidden = false;
      detailsEmpty.textContent = view === "full"
        ? "Select a node to see its name, kind, and connections."
        : "Select a control to see its name and the nodes next to it.";
      detailsBody.hidden = true;
      detailsSummary.textContent = "";
      detailsList.textContent = "";
      detailsModelNote.hidden = true;
      detailsModelNote.textContent = "";
      return;
    }
    var attrs = graph.getNodeAttributes(selected);
    detailsHeading.textContent = attrs.name;
    detailsEmpty.hidden = true;
    detailsBody.hidden = false;
    detailsKind.textContent = KIND_LABEL[attrs.kind] || attrs.kind;
    var meta = [];
    if (attrs.meta) meta.push(attrs.meta);
    if (attrs.ref && attrs.ref !== attrs.name) meta.push(attrs.ref);
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

    var rows = [];
    graph.forEachEdge(selected, function (edge, attr, source, target) {
      var otherId = source === selected ? target : source;
      if (!graph.hasNode(otherId)) return;
      var other = graph.getNodeAttributes(otherId);
      if (!nodeAllowed(other)) return;
      if (view === "full" && !kindShown(other.kind)) return;
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
        li.textContent = row.text;
        detailsList.appendChild(li);
      });
    }
    var summary = attrs.name + ". " + (KIND_LABEL[attrs.kind] || attrs.kind) + ". " + rows.length + " connections.";
    if (gap) summary += " " + gap;
    detailsSummary.textContent = summary;
  }

  function countNodes(pred) {
    var counts = { layer: 0, persona: 0, model: 0, control: 0, policy: 0, topic: 0, total: 0 };
    graph.forEachNode(function (id, attrs) {
      if (!pred(id, attrs)) return;
      counts[attrs.kind] = (counts[attrs.kind] || 0) + 1;
      counts.total += 1;
    });
    return counts;
  }

  function publish() {
    var allowed = countNodes(function (id, attrs) { return nodeAllowed(attrs); });
    var visible = countNodes(nodeVisible);
    KIND_ORDER.forEach(function (kind) {
      var slot = document.querySelector('[data-count-for="' + kind + '"]');
      if (slot) slot.textContent = "(" + (allowed[kind] || 0) + ")";
    });
    var parts = [
      unit(visible.layer || 0, "layer", "layers"),
      unit(visible.persona || 0, "persona", "personas"),
      unit(visible.model || 0, "operating model", "operating models"),
      unit(visible.control || 0, "control", "controls"),
      unit(visible.policy || 0, "policy level", "policy levels"),
      unit(visible.topic || 0, "whitepaper topic", "whitepaper topics")
    ];
    var text = "";
    if (view === "search") {
      if (modelFilter === "all") {
        text = unit(allowed.control || 0, "control can be opened.", "controls can be opened.");
        if (!showTapestry && stats.tapestryControls) {
          text += " " + unit(stats.tapestryControls, "Tapestry control is hidden.", "Tapestry controls are hidden.");
        }
      } else {
        text = unit(allowed.control || 0, "control lists " + (modelShort[modelFilter] || modelFilter) + ".", "controls list " + (modelShort[modelFilter] || modelFilter) + ".");
      }
      text += " Choose a control to see it and the nodes next to it.";
    } else if (view === "focus" && root && graph.hasNode(root)) {
      var rootAttrs = graph.getNodeAttributes(root);
      if (!nodeAllowed(rootAttrs)) {
        text = outsideFilter(rootAttrs)
          ? GAP_NOTE + " Choose All to see it on the map."
          : "This control does not list " + (modelShort[modelFilter] || modelFilter) + ". Choose All under Operating model to see it.";
      } else {
        var beside = Math.max(0, visible.total - 1);
        text = beside === 1
          ? "Showing this control and 1 node next to it."
          : "Showing this control and " + beside + " nodes next to it.";
      }
    } else {
      text = "Showing " + listPhrase(parts) + ".";
    }
    statusEl.textContent = text;
    graphEl.setAttribute("aria-label", text);
    statusEl.dataset.view = view;
    statusEl.dataset.model = modelFilter;
    statusEl.dataset.tapestry = showTapestry ? "1" : "0";
    statusEl.dataset.wide = wide ? "1" : "0";
    statusEl.dataset.root = root || "";
    statusEl.dataset.selected = selected || "";
    statusEl.dataset.totalControls = String(stats.controls);
    statusEl.dataset.srfControls = String(stats.srfControls);
    statusEl.dataset.sectorOnly = String(stats.sectorOnly);
    statusEl.dataset.noModels = String(stats.noModels);
    statusEl.dataset.tapestryControls = String(stats.tapestryControls);
    statusEl.dataset.tapestryPersonas = String(stats.tapestryPersonas);
    statusEl.dataset.allowedControls = String(allowed.control || 0);
    statusEl.dataset.visibleControls = String(visible.control || 0);
    statusEl.dataset.visiblePersonas = String(visible.persona || 0);
    statusEl.dataset.visibleModels = String(visible.model || 0);
    statusEl.dataset.visibleNodes = String(visible.total || 0);
    statusEl.dataset.focusCount = String(Object.keys(focusSet).length);
    statusEl.dataset.skippedModels = Object.keys(skippedModels).sort().join(",");
    statusEl.dataset.missingLinks = String(missingLinks.length);
    var suggested = suggestedIds();
    statusEl.dataset.suggested = suggested.join(",");
  }

  function suggestedIds() {
    var best = {};
    graph.forEachNode(function (id, attrs) {
      if (attrs.kind !== "control" || !nodeAllowed(attrs)) return;
      if (modelFilter === "all" && !(attrs.coreModels && attrs.coreModels.length)) return;
      if (!attrs.layer) return;
      var rank = VERTICAL_RANK[attrs.vertical];
      if (rank == null) rank = 99;
      var key = [-(attrs.coreModels ? attrs.coreModels.length : 0), rank, attrs.ref || "", id];
      var prev = best[attrs.layer];
      if (!prev || compareKeys(key, prev.key) < 0) best[attrs.layer] = { id: id, key: key };
    });
    return LAYERS.map(function (layer) { return best[layer] && best[layer].id; }).filter(Boolean);
  }

  function compareKeys(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return 0;
  }

  function fillButton(button, id) {
    var attrs = graph.getNodeAttributes(id);
    button.type = "button";
    button.dataset.nodeId = id;
    var title = document.createElement("span");
    title.textContent = attrs.kind === "control" && attrs.layer
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

  function renderIdList(ids, limit) {
    searchResults.textContent = "";
    searchResults.hidden = !ids.length;
    ids.slice(0, limit || ids.length).forEach(function (id) {
      var li = document.createElement("li");
      var button = document.createElement("button");
      fillButton(button, id);
      li.appendChild(button);
      searchResults.appendChild(li);
    });
  }

  function matches(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    var ids = [];
    graph.forEachNode(function (id, attrs) {
      if (!nodeAllowed(attrs)) return;
      if (view !== "full" && attrs.kind !== "control") return;
      if (attrs.search.indexOf(q) === -1) return;
      ids.push(id);
    });
    ids.sort(function (a, b) {
      var aa = graph.getNodeAttributes(a);
      var bb = graph.getNodeAttributes(b);
      function exactness(attrs) {
        var name = attrs.name.toLowerCase();
        if (name === q || (attrs.ref && String(attrs.ref).toLowerCase() === q)) return 0;
        if (name.indexOf(q) === 0) return 1;
        return 2;
      }
      var ae = exactness(aa);
      var be = exactness(bb);
      if (ae !== be) return ae - be;
      var ak = KIND_ORDER.indexOf(aa.kind);
      var bk = KIND_ORDER.indexOf(bb.kind);
      if (ak !== bk) return ak - bk;
      return aa.name < bb.name ? -1 : aa.name > bb.name ? 1 : 0;
    });
    return ids;
  }

  function renderMatches(query) {
    var ids = matches(query);
    var shownIds = ids.slice(0, 8);
    suggestionsWrap.hidden = true;
    renderIdList(shownIds);
    if (!query.trim()) {
      searchNote.textContent = "";
      return ids;
    }
    var noun = view === "full"
      ? (ids.length === 1 ? "node matches." : "nodes match.")
      : (ids.length === 1 ? "control matches." : "controls match.");
    var line = ids.length ? ids.length + " " + noun : (view === "full" ? "No matching node." : "No matching control.");
    if (ids.length > shownIds.length) line += " Showing the first " + shownIds.length + ".";
    searchNote.textContent = line;
    return ids;
  }

  function renderSuggestions() {
    var ids = suggestedIds();
    suggestions.textContent = "";
    suggestionsWrap.hidden = !ids.length;
    ids.forEach(function (id) {
      var li = document.createElement("li");
      var button = document.createElement("button");
      fillButton(button, id);
      li.appendChild(button);
      suggestions.appendChild(li);
    });
    searchResults.hidden = true;
    searchResults.textContent = "";
    searchNote.textContent = ids.length
      ? unit(ids.length, "suggested starting point.", "suggested starting points.")
      : "No control lists this operating model.";
  }

  function syncToggles() {
    tapestryInput.checked = showTapestry;
    document.querySelectorAll('input[name="operating-model"]').forEach(function (radio) {
      radio.checked = radio.value === modelFilter;
    });
    document.querySelectorAll(".kind-filter input").forEach(function (box) {
      box.checked = shown[box.dataset.kind] !== false;
    });
  }

  function updateChrome() {
    syncToggles();
    var query = searchInput.value.trim();
    if (query) {
      renderMatches(searchInput.value);
    } else if (linkHits && linkHits.length) {
      suggestionsWrap.hidden = true;
      renderIdList(linkHits);
      searchNote.textContent = linkNote;
    } else if (linkNote) {
      suggestionsWrap.hidden = true;
      searchResults.hidden = true;
      searchResults.textContent = "";
      searchNote.textContent = linkNote;
    } else if (view === "search") {
      renderSuggestions();
    } else {
      suggestionsWrap.hidden = true;
      searchResults.hidden = true;
      searchResults.textContent = "";
      searchNote.textContent = "";
    }

    var rootAttrs = root && graph.hasNode(root) ? graph.getNodeAttributes(root) : null;
    var rootVisible = !!(rootAttrs && nodeAllowed(rootAttrs));
    widenBtn.hidden = !(view === "focus" && rootVisible);
    widenBtn.textContent = wide ? "Show only the nodes next to this control" : "Widen the view";
    widenBtn.setAttribute("aria-pressed", wide ? "true" : "false");
    fullBtn.hidden = view === "full";
    startBtn.hidden = view === "search";
    kindFilters.hidden = view !== "full";

    if (view === "full") {
      findLabel.textContent = "Find a node";
      searchInput.placeholder = "Layer, persona, model, or control name";
      helpEl.textContent = "Type a name, then choose Find. The map moves to that node and keeps the nodes next to it in view.";
    } else if (view === "focus" && wide) {
      findLabel.textContent = "Find a control";
      searchInput.placeholder = "Control name or identifier";
      helpEl.textContent = "The map includes the layers and personas connected to the nodes next to this control.";
    } else if (view === "focus") {
      findLabel.textContent = "Find a control";
      searchInput.placeholder = "Control name or identifier";
      helpEl.textContent = "The map is showing this control and the nodes next to it.";
    } else {
      findLabel.textContent = "Find a control";
      searchInput.placeholder = "Control name or identifier";
      helpEl.textContent = "Type a control name or identifier, then choose a match. The map shows that control and the nodes next to it.";
    }

    if (view === "search") {
      graphEmpty.hidden = false;
      graphEmpty.textContent = "Choose a control to see it and the nodes next to it.";
    } else if (view === "focus" && rootAttrs && !rootVisible) {
      graphEmpty.hidden = false;
      graphEmpty.textContent = outsideFilter(rootAttrs)
        ? GAP_NOTE + " Choose All to see it on the map."
        : "This control does not list " + (modelShort[modelFilter] || modelFilter) + ". Choose All under Operating model to see it.";
    } else {
      graphEmpty.hidden = true;
      graphEmpty.textContent = "";
    }
  }

  function currentQuery() {
    var params = new URLSearchParams();
    if (view === "full") {
      params.set("view", "full");
      if (selected && graph.hasNode(selected)) params.set("node", selected);
    } else if (view === "focus" && root && graph.hasNode(root)) {
      var attrs = graph.getNodeAttributes(root);
      params.set("control", attrs.vertical + ":" + attrs.ref);
      if (wide) params.set("wide", "1");
    }
    if (modelFilter !== "all") params.set("model", modelFilter);
    if (showTapestry) params.set("tapestry", "1");
    return params.toString();
  }

  function writeUrl(push) {
    var query = currentQuery();
    var next = location.pathname + (query ? "?" + query : "") + location.hash;
    var current = location.pathname + location.search + location.hash;
    if (next === current) return;
    history[push ? "pushState" : "replaceState"]({ view: view, root: root, selected: selected }, "", next);
  }

  function commit(push) {
    rebuildFocus();
    rebuildNeighbors();
    updateChrome();
    renderDetails();
    if (renderer) {
      renderer.refresh();
      publish();
    }
    writeUrl(!!push);
  }

  function resolveControl(token) {
    var raw = String(token || "").trim();
    var hits = [];
    if (!raw) return { id: "", hits: hits };
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

  function applyFromLocation() {
    if (!graph) return;
    var params = new URLSearchParams(location.search);
    var model = params.get("model") || "all";
    modelFilter = model === "all" || coreIds[model] ? model : "all";
    showTapestry = params.get("tapestry") === "1";
    wide = params.get("wide") === "1";
    linkHits = null;
    linkNote = "";
    root = null;
    selected = null;
    view = params.get("view") === "full" ? "full" : "search";
    var controlParam = params.get("control");
    if (controlParam && view !== "full") {
      var resolved = resolveControl(controlParam);
      if (resolved.id) {
        if (graph.getNodeAttribute(resolved.id, "tapestry")) showTapestry = true;
        root = resolved.id;
        selected = resolved.id;
        view = "focus";
      } else if (resolved.hits.length > 1) {
        linkHits = resolved.hits;
        linkNote = "More than one control uses this identifier. Choose one.";
      } else {
        linkNote = "No control matches that link.";
      }
    } else if (view === "full") {
      var node = params.get("node");
      if (node && graph.hasNode(node)) {
        if (graph.getNodeAttribute(node, "tapestry")) showTapestry = true;
        if (nodeAllowed(graph.getNodeAttributes(node))) selected = node;
      }
    }
    commit(false);
    if (!renderer) return;
    if (view === "focus") frameFocus();
    else if (view === "full" && selected) frameSelection(selected);
    else frameAll();
  }

  function focusDetails(moveFocus) {
    if (!moveFocus) return;
    detailsHeading.setAttribute("tabindex", "-1");
    detailsHeading.focus({ preventScroll: true });
  }

  function openControl(id, moveFocus, options) {
    options = options || {};
    if (!graph.hasNode(id)) return;
    root = id;
    selected = id;
    view = "focus";
    if (!options.keepWide) wide = false;
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    if (graph.getNodeAttribute(id, "tapestry")) showTapestry = true;
    commit(options.push !== false);
    if (renderer) frameFocus();
    focusDetails(moveFocus);
  }

  function selectInFull(id, moveFocus) {
    if (!graph.hasNode(id)) return;
    var kind = graph.getNodeAttribute(id, "kind");
    if (!kindShown(kind)) {
      shown[kind] = true;
      var box = document.querySelector('input[data-kind="' + kind + '"]');
      if (box) box.checked = true;
    }
    if (graph.getNodeAttribute(id, "tapestry")) showTapestry = true;
    selected = id;
    commit(true);
    if (renderer) frameSelection(id);
    focusDetails(moveFocus);
  }

  function activateNode(id, moveFocus) {
    if (!graph || !graph.hasNode(id)) return;
    if (view === "full") selectInFull(id, moveFocus);
    else openControl(id, moveFocus, {});
  }

  function showFull(push) {
    view = "full";
    root = null;
    selected = null;
    wide = false;
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    commit(push);
    if (renderer) frameAll();
  }

  function showSearch(push) {
    view = "search";
    root = null;
    selected = null;
    wide = false;
    linkHits = null;
    linkNote = "";
    searchInput.value = "";
    commit(push);
    if (renderer) frameAll();
  }

  function clearSelection(push) {
    if (view === "focus" && root && selected && selected !== root) {
      selected = root;
      commit(!!push);
      return;
    }
    if (view === "focus") {
      showSearch(!!push);
      return;
    }
    selected = null;
    commit(!!push);
  }

  function toggleWide() {
    if (view !== "focus" || !root) return;
    wide = !wide;
    commit(true);
    if (renderer) frameFocus();
  }

  function setModel(id, push) {
    if (id !== "all" && !coreIds[id]) id = "all";
    if (id === modelFilter) return;
    modelFilter = id;
    if (view === "full" && selected && !nodeAllowed(graph.getNodeAttributes(selected))) selected = null;
    commit(push);
    if (renderer && view === "focus" && root && nodeAllowed(graph.getNodeAttributes(root))) frameFocus();
  }

  function setTapestry(on, push) {
    if (on === showTapestry) return;
    showTapestry = on;
    if (root && graph.hasNode(root) && !nodeAllowed(graph.getNodeAttributes(root))) {
      root = null;
      selected = null;
      wide = false;
      view = "search";
    } else if (view === "full" && selected && !nodeAllowed(graph.getNodeAttributes(selected))) {
      selected = null;
    }
    commit(push);
    if (renderer && view === "focus") frameFocus();
  }

  function frameAll() {
    if (!renderer) return;
    renderer.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1, angle: 0 }, { duration: 280 });
  }

  function frameNodeIds(ids, minRatio, always, labelPad) {
    if (!renderer || !ids.length) return;
    var dims = renderer.getDimensions();
    var edge = 40;
    var allIn = true;
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;
    ids.forEach(function (nid) {
      if (!graph.hasNode(nid)) return;
      var attrs = graph.getNodeAttributes(nid);
      if (attrs.x < minX) minX = attrs.x;
      if (attrs.x > maxX) maxX = attrs.x;
      if (attrs.y < minY) minY = attrs.y;
      if (attrs.y > maxY) maxY = attrs.y;
      var point = renderer.graphToViewport({ x: attrs.x, y: attrs.y });
      if (point.x < edge || point.y < edge || point.x > dims.width - edge || point.y > dims.height - edge) {
        allIn = false;
      }
    });
    if (!always && allIn) return;
    var spanX = Math.max(maxX - minX, 8);
    var spanY = Math.max(maxY - minY, 8);
    var padX = Math.max(spanX * 0.3, 10);
    var padY = Math.max(spanY * 0.3, 10);
    /* Focused persona names are drawn to the right of the node, and model
     * names are drawn to the right as well. Keep a little extra room there
     * so a short name is not cut off at the canvas edge. */
    var rightPad = padX + (labelPad ? Math.max(spanX * 0.22, 8) : 0);
    var norm = renderer.getNormalizationFunction();
    if (typeof norm !== "function") return;
    var a = norm({ x: minX - padX, y: minY - padY });
    var b = norm({ x: maxX + rightPad, y: maxY + padY });
    var ratio = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    var cx = (a.x + b.x) / 2;
    var cy = (a.y + b.y) / 2;
    if (ratio < minRatio) ratio = minRatio;
    if (ratio > 1) {
      ratio = 1;
      cx = 0.5;
      cy = 0.5;
    }
    renderer.getCamera().animate({
      x: cx,
      y: cy,
      ratio: ratio,
      angle: 0
    }, { duration: 280 });
  }

  /* Frame the selected node and its neighbors. Do not zoom closer than
   * about 55% of the map, so the surrounding nodes stay in view. */
  function frameSelection(id) {
    var ids = [id];
    graph.forEachNeighbor(id, function (neighbor) {
      if (nodeVisible(neighbor) || (view === "full" && nodeAllowed(graph.getNodeAttributes(neighbor)) && kindShown(graph.getNodeAttribute(neighbor, "kind")))) {
        ids.push(neighbor);
      }
    });
    frameNodeIds(ids, 0.55, false);
  }

  function frameFocus() {
    frameNodeIds(Object.keys(focusSet), 0.12, true, true);
  }

  function activeButtons() {
    var list = suggestionsWrap.hidden ? searchResults : suggestions;
    return Array.prototype.slice.call(list.querySelectorAll("button"));
  }

  function renderModelRadios(models) {
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

  function renderModelNote() {
    var verb = stats.srfControls === 1 ? "lists" : "list";
    modelNote.textContent = "Some controls use sector model names and aren't in this filter yet. "
      + stats.srfControls + " of " + stats.controls + " controls " + verb + " an SRF v1.0 model.";
  }

  function applyScheme() {
    palette = readPalette();
    graphEl.style.backgroundColor = palette.stage;
    if (renderer) renderer.refresh();
    if (statusEl.dataset.ready === "true") publish();
  }

  function start() {
    var SigmaCtor = window.Sigma && (window.Sigma.Sigma || window.Sigma);
    if (typeof SigmaCtor !== "function") throw new Error("Sigma did not load.");
    palette = readPalette();
    renderer = new SigmaCtor(graph, graphEl, {
      settings: {
        enableNodeDrag: false,
        enableCameraRotation: false,
        enableCameraMouseRotation: false,
        /* Persona labels use "auto" in the full graph. At the overview a
         * persona is about 7px, under this threshold, so the name stays off.
         * A modest zoom (camera ratio near 0.6) crosses 9px and the name is
         * drawn. The label grid drops names that would stack. Hover forces
         * one name on at any zoom. Focus view forces labels on. */
        labelRenderedSizeThreshold: 9,
        labelDensity: 0.5,
        labelGridCellSize: 150,
        nodePickingPadding: 4,
        minEdgeThickness: 0.4,
        stagePadding: 28,
        hideLabelsOnMove: false,
        inertiaDuration: 0,
        inertiaRatio: 0
      },
      styles: {
        stage: { background: function () { return palette.stage; } }
      },
      nodeReducer: nodeReducer,
      edgeReducer: edgeReducer
    });
    graphEl.style.backgroundColor = palette.stage;

    var ignoreStage = false;
    function onNode(event) {
      ignoreStage = true;
      if (view === "focus" && focusSet[event.node]) {
        selected = event.node;
        commit(true);
      } else if (view === "full") {
        selectInFull(event.node, false);
      }
      setTimeout(function () { ignoreStage = false; }, 0);
    }
    renderer.on("clickNode", onNode);
    renderer.on("clickNodeLabel", onNode);
    renderer.on("clickStage", function () {
      if (ignoreStage) return;
      if (view === "search") return;
      clearSelection(true);
    });

    window.__relationshipMap = {
      graph: graph,
      renderer: renderer,
      labelMode: labelMode,
      anchorLabelsForced: anchorLabelsForced,
      nodeVisible: nodeVisible,
      outsideFilter: function (id) { return outsideFilter(graph.getNodeAttributes(id)); }
    };

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        renderer.refresh();
        publish();
        renderDetails();
        if (view === "focus") frameFocus();
        else if (view === "full" && selected) frameSelection(selected);
        statusEl.dataset.ready = "true";
      });
    });
  }

  findForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var ids = matches(searchInput.value);
    if (ids.length) activateNode(ids[0], true);
  });
  searchInput.addEventListener("input", function () {
    linkHits = null;
    linkNote = "";
    if (!graph) return;
    if (!searchInput.value.trim()) {
      if (view === "search") renderSuggestions();
      else {
        suggestionsWrap.hidden = true;
        searchResults.hidden = true;
        searchResults.textContent = "";
        searchNote.textContent = "";
      }
      return;
    }
    renderMatches(searchInput.value);
  });
  findForm.addEventListener("keydown", function (event) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    var buttons = activeButtons();
    if (!buttons.length) return;
    var idx = buttons.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[idx < 0 ? 0 : Math.min(buttons.length - 1, idx + 1)].focus();
    } else if (idx > 0) {
      event.preventDefault();
      buttons[idx - 1].focus();
    } else if (idx === 0) {
      event.preventDefault();
      searchInput.focus();
    }
  });
  document.getElementById("map-tools").addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button || !button.dataset.nodeId) return;
    activateNode(button.dataset.nodeId, true);
  });
  modelList.addEventListener("change", function (event) {
    var input = event.target;
    if (!input || input.name !== "operating-model") return;
    setModel(input.value, true);
  });
  tapestryInput.addEventListener("change", function () {
    setTapestry(tapestryInput.checked, true);
  });
  widenBtn.addEventListener("click", toggleWide);
  fullBtn.addEventListener("click", function () { showFull(true); });
  startBtn.addEventListener("click", function () { showSearch(true); });
  document.querySelectorAll(".kind-filter input").forEach(function (box) {
    box.addEventListener("change", function () {
      shown[box.dataset.kind] = box.checked;
      if (view === "full" && selected && !kindShown(graph.getNodeAttribute(selected, "kind"))) selected = null;
      commit(false);
    });
  });
  clearBtn.addEventListener("click", function () { clearSelection(true); });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (event.target === searchInput && searchInput.value) {
      searchInput.value = "";
      linkHits = null;
      linkNote = "";
      if (view === "search") renderSuggestions();
      else {
        suggestionsWrap.hidden = true;
        searchResults.hidden = true;
        searchResults.textContent = "";
        searchNote.textContent = "";
      }
      return;
    }
    if (view === "search" && !selected) return;
    clearSelection(true);
  });
  window.addEventListener("popstate", applyFromLocation);

  var scheme = window.matchMedia("(prefers-color-scheme: dark)");
  if (scheme.addEventListener) scheme.addEventListener("change", applyScheme);
  else if (scheme.addListener) scheme.addListener(applyScheme);

  var loads = [
    fetchJson("/data/layers.json"),
    fetchJson("/data/personas.json"),
    fetchJson("/data/matrix.json"),
    fetchJson("/tools/policy-pyramid/data.json"),
    fetchJson("/data/ai-agentic-principles.json")
  ].concat(CONTROL_FILES.map(function (file) { return fetchJson(file[2]); }));

  Promise.all(loads).then(function (files) {
    var data = {
      layers: files[0],
      personas: files[1],
      matrix: files[2],
      policy: files[3],
      topics: files[4],
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
    });
    var models = buildGraph(data);
    renderModelRadios(models);
    renderModelNote();
    applyFromLocation();
    start();
  }).catch(function (err) {
    showError(err && err.message ? err.message : "The map could not load the site data. Reload the page.");
  });
})();
