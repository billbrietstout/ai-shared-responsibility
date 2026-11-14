/* Relationship map
 * Reads site JSON at runtime and draws only links those files already name.
 *
 * Node kinds and files:
 *   layer    data/layers.json                         layers[]
 *   persona  data/personas.json                       personas[] and sector_specializations[]
 *   model    data/matrix.json                         models[] where provenance === "cosai-core"
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
 *   control-model   controls[].operating_models[] when the value is a cosai-core model id
 *
 * Policy levels and whitepaper topics have no field that names a layer, persona,
 * model, or control, so those nodes have no edges. Operating-model strings that
 * are not in the cosai-core set are not drawn.
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
    policy: 1.45,
    topic: 1.05
  };
  var LAYER_Y = { L1: 84, L2: 66, L3: 48, L4: 30, L5: 12 };
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

  var graphEl = document.getElementById("graph");
  var statusEl = document.getElementById("map-status");
  var errorEl = document.getElementById("map-error");
  var findForm = document.getElementById("find-form");
  var searchInput = document.getElementById("node-search");
  var searchResults = document.getElementById("search-results");
  var searchNote = document.getElementById("search-note");
  var detailsHeading = document.getElementById("details-heading");
  var detailsEmpty = document.getElementById("details-empty");
  var detailsBody = document.getElementById("details-body");
  var detailsKind = document.getElementById("details-kind");
  var detailsMeta = document.getElementById("details-meta");
  var detailsSummary = document.getElementById("details-summary");
  var detailsList = document.getElementById("details-connections");
  var clearBtn = document.getElementById("clear-selection");

  var graph = null;
  var renderer = null;
  var palette = null;
  var respLabel = {};
  var shown = {
    layer: true,
    persona: true,
    model: true,
    control: true,
    policy: true,
    topic: true
  };
  var selected = null;
  var neighborMap = {};
  var skippedModels = {};
  var missingLinks = [];

  function $(sel) { return document.querySelector(sel); }

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

  function num(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

  function addNode(id, attrs) {
    var searchBits = [attrs.name, attrs.label, attrs.ref, attrs.meta].filter(Boolean);
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

  function buildGraph(data) {
    var Graph = window.graphology && window.graphology.UndirectedGraph;
    if (typeof Graph !== "function") {
      throw new Error("Graphology did not load.");
    }
    graph = new Graph();

    var layers = (data.layers && data.layers.layers) || [];
    var layerIds = [];
    layers.forEach(function (layer) {
      var id = "layer:" + layer.id;
      layerIds.push(id);
      addNode(id, {
        kind: "layer",
        name: layer.id + " " + layer.name,
        label: layer.id + " " + layer.short,
        ref: layer.id,
        x: 22,
        y: LAYER_Y[layer.id] || 0
      });
    });

    var models = ((data.matrix && data.matrix.models) || []).filter(isCoreModel);
    var modelIds = [];
    models.forEach(function (model, i) {
      var id = "model:" + model.id;
      modelIds.push(id);
      addNode(id, {
        kind: "model",
        name: model.name,
        label: model.short || model.id,
        ref: model.id,
        x: 18 + i * 18,
        y: 104
      });
    });
    respLabel = {};
    var values = (data.matrix && data.matrix.responsibility_values) || {};
    Object.keys(values).forEach(function (key) {
      respLabel[key] = (values[key] && values[key].label) || key;
    });

    var coreIds = {};
    models.forEach(function (model) { coreIds[model.id] = true; });
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
      personaIds.push(id);
      addNode(id, {
        kind: "persona",
        name: persona.name,
        label: persona.name,
        ref: persona.id,
        provenance: persona.provenance || "",
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
        x: 0,
        y: 0
      });
      (spec.srf_layers || []).forEach(function (layerId) {
        link(id, "layer:" + layerId, { type: "persona-layer" });
      });
      if (spec.specializes) {
        link(id, "persona:" + spec.specializes, {
          type: "specializes",
          spec: id
        });
      }
    });
    placeColumn(personaIds, -6, 12, 84);

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
      var an = sections[a.slice(6)].n || 0;
      var bn = sections[b.slice(6)].n || 0;
      return an - bn;
    });
    placeGrid(topicIds, 78, 16, 4, 8, 14);

    var controlsByLayer = { L1: [], L2: [], L3: [], L4: [], L5: [] };
    (data.controlFiles || []).forEach(function (file) {
      var controls = (file.json && file.json.controls) || [];
      controls.forEach(function (control) {
        var id = "control:" + file.slug + ":" + control.id;
        addNode(id, {
          kind: "control",
          name: control.title,
          label: file.short + " " + String(control.id || "").replace(/^SRF-/, ""),
          ref: control.id,
          meta: file.name,
          vertical: file.slug,
          x: 0,
          y: 0
        });
        if (controlsByLayer[control.layer]) controlsByLayer[control.layer].push(id);
        if (control.layer) link(id, "layer:" + control.layer, { type: "control-layer" });
        if (control.accountable_persona) {
          link(id, "persona:" + control.accountable_persona, { type: "control-persona" });
        }
        (control.operating_models || []).forEach(function (modelId) {
          if (coreIds[modelId]) {
            link(id, "model:" + modelId, { type: "control-model" });
          } else if (modelId) {
            skippedModels[modelId] = true;
          }
        });
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

    return { modelIds: modelIds };
  }

  function kindShown(kind) {
    return shown[kind] !== false;
  }

  function nodeReducer(key, data, attrs) {
    if (!kindShown(attrs.kind)) {
      return { visibility: "hidden", labelVisibility: "hidden" };
    }
    var color = palette[attrs.kind] || FALLBACK[attrs.kind];
    var focus = !selected || key === selected || neighborMap[key];
    var z = key === selected ? 4 : neighborMap[key] ? 3 : (attrs.kind === "layer" || attrs.kind === "model" ? 2 : 1);
    if (!focus) {
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
    var showLabel = "hidden";
    if (key === selected) showLabel = "visible";
    else if (neighborMap[key] && attrs.kind !== "control") showLabel = "visible";
    else if (!selected && attrs.kind === "layer") showLabel = "visible";
    else if (!selected && (attrs.kind === "model" || attrs.kind === "policy")) showLabel = "auto";
    return {
      visibility: "visible",
      color: color,
      labelColor: palette.label,
      labelVisibility: showLabel,
      zIndex: z,
      size: key === selected ? attrs.size * 1.45 : attrs.size,
      highlighted: key === selected,
      cursor: "pointer"
    };
  }

  function edgeReducer(key, data) {
    var source = graph.source(key);
    var target = graph.target(key);
    var sourceKind = graph.getNodeAttribute(source, "kind");
    var targetKind = graph.getNodeAttribute(target, "kind");
    if (!kindShown(sourceKind) || !kindShown(targetKind)) {
      return { visibility: "hidden" };
    }
    var type = graph.getEdgeAttribute(key, "type") || "";
    if (!selected && type.indexOf("control-") === 0) {
      return { visibility: "hidden" };
    }
    if (selected && source !== selected && target !== selected) {
      return { visibility: "hidden" };
    }
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
    return "Connected in the site data.";
  }

  function renderDetails() {
    clearBtn.disabled = !selected;
    if (!selected || !graph.hasNode(selected)) {
      detailsHeading.textContent = "Node details";
      detailsEmpty.hidden = false;
      detailsBody.hidden = true;
      detailsSummary.textContent = "";
      detailsList.textContent = "";
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
    if (attrs.provenance === "proposed-extension") {
      meta.push("Proposed extension. Not part of SRF v1.0.");
    }
    if (meta.length) {
      detailsMeta.hidden = false;
      detailsMeta.textContent = meta.join(" · ");
    } else {
      detailsMeta.hidden = true;
      detailsMeta.textContent = "";
    }

    var rows = [];
    graph.forEachEdge(selected, function (edge, attr, source, target) {
      var otherId = source === selected ? target : source;
      if (!graph.hasNode(otherId)) return;
      var other = graph.getNodeAttributes(otherId);
      if (!kindShown(other.kind)) return;
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
    detailsSummary.textContent = attrs.name + ". " + (KIND_LABEL[attrs.kind] || attrs.kind) + ". " + rows.length + " connections.";
  }

  function publish() {
    var counts = { layer: 0, persona: 0, model: 0, control: 0, policy: 0, topic: 0 };
    var visible = { layer: 0, persona: 0, model: 0, control: 0, policy: 0, topic: 0 };
    var edgeCounts = {};
    var modelNames = [];
    graph.forEachNode(function (id, attrs) {
      counts[attrs.kind] = (counts[attrs.kind] || 0) + 1;
      var display = renderer.getNodeDisplayData(id);
      if (!display || display.visibility !== "hidden") {
        visible[attrs.kind] = (visible[attrs.kind] || 0) + 1;
      }
      if (attrs.kind === "model") modelNames.push(attrs.ref);
    });
    graph.forEachEdge(function (edge, attrs) {
      edgeCounts[attrs.type] = (edgeCounts[attrs.type] || 0) + 1;
    });
    KIND_ORDER.forEach(function (kind) {
      var slot = document.querySelector('[data-count-for="' + kind + '"]');
      if (slot) slot.textContent = "(" + (counts[kind] || 0) + ")";
      statusEl.dataset[kind] = String(counts[kind] || 0);
      statusEl.dataset["visible" + kind.charAt(0).toUpperCase() + kind.slice(1)] = String(visible[kind] || 0);
    });
    statusEl.dataset.nodes = String(graph.order);
    statusEl.dataset.edges = String(graph.size);
    statusEl.dataset.models = modelNames.join(",");
    statusEl.dataset.edgePersonaLayer = String(edgeCounts["persona-layer"] || 0);
    statusEl.dataset.edgeSpecializes = String(edgeCounts.specializes || 0);
    statusEl.dataset.edgeModelLayer = String(edgeCounts["model-layer"] || 0);
    statusEl.dataset.edgeControlLayer = String(edgeCounts["control-layer"] || 0);
    statusEl.dataset.edgeControlPersona = String(edgeCounts["control-persona"] || 0);
    statusEl.dataset.edgeControlModel = String(edgeCounts["control-model"] || 0);
    statusEl.dataset.skippedModels = Object.keys(skippedModels).sort().join(",");
    statusEl.dataset.missingLinks = String(missingLinks.length);
    statusEl.dataset.selected = selected || "";
    statusEl.dataset.neighbors = Object.keys(neighborMap).sort().join(",");
    var parts = [
      (counts.layer || 0) + " layers",
      (counts.persona || 0) + " personas",
      (counts.model || 0) + " operating models",
      (counts.control || 0) + " controls",
      (counts.policy || 0) + " policy levels",
      (counts.topic || 0) + " whitepaper topics"
    ];
    statusEl.textContent = parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1] + ". " + num(graph.size) + " connections.";
  }

  function applyScheme() {
    palette = readPalette();
    graphEl.style.backgroundColor = palette.stage;
    if (renderer) renderer.refresh();
    if (statusEl.dataset.ready === "true") publish();
  }

  function refreshView() {
    if (!renderer) return;
    renderer.refresh();
    renderDetails();
    publish();
  }

  function clearSelection() {
    selected = null;
    neighborMap = {};
    refreshView();
  }

  function focusNode(id) {
    var attrs = graph.getNodeAttributes(id);
    var norm = renderer.getNormalizationFunction();
    if (typeof norm !== "function") return;
    var framed = norm({ x: attrs.x, y: attrs.y });
    renderer.getCamera().animate(
      { x: framed.x, y: framed.y, ratio: 0.28, angle: 0 },
      { duration: 280 }
    );
  }

  function selectNode(id, shouldFocus) {
    if (!graph.hasNode(id)) return;
    var kind = graph.getNodeAttribute(id, "kind");
    if (!kindShown(kind)) {
      shown[kind] = true;
      var box = document.querySelector('input[data-kind="' + kind + '"]');
      if (box) box.checked = true;
    }
    selected = id;
    neighborMap = {};
    graph.forEachNeighbor(id, function (neighbor) {
      neighborMap[neighbor] = true;
    });
    refreshView();
    if (shouldFocus) {
      focusNode(id);
      detailsHeading.setAttribute("tabindex", "-1");
      detailsHeading.focus({ preventScroll: true });
    }
  }

  function matches(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    var ids = [];
    graph.forEachNode(function (id, attrs) {
      if (attrs.search.indexOf(q) !== -1) ids.push(id);
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
    searchResults.textContent = "";
    var shownIds = ids.slice(0, 8);
    if (!query.trim()) {
      searchNote.hidden = true;
      searchNote.textContent = "";
      return shownIds;
    }
    if (!shownIds.length) {
      searchNote.hidden = false;
      searchNote.textContent = "No matching node.";
      return shownIds;
    }
    if (ids.length > shownIds.length) {
      searchNote.hidden = false;
      searchNote.textContent = "Showing the first 8 matches. Type more of the name.";
    } else {
      searchNote.hidden = true;
      searchNote.textContent = "";
    }
    shownIds.forEach(function (id) {
      var attrs = graph.getNodeAttributes(id);
      var li = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      button.dataset.nodeId = id;
      var suffix = attrs.meta ? " · " + attrs.meta : "";
      button.textContent = attrs.name + " · " + (KIND_LABEL[attrs.kind] || attrs.kind) + suffix;
      li.appendChild(button);
      searchResults.appendChild(li);
    });
    return shownIds;
  }

  function start(built) {
    var SigmaCtor = window.Sigma && (window.Sigma.Sigma || window.Sigma);
    if (typeof SigmaCtor !== "function") throw new Error("Sigma did not load.");
    palette = readPalette();
    renderer = new SigmaCtor(graph, graphEl, {
      settings: {
        enableNodeDrag: false,
        enableCameraRotation: false,
        enableCameraMouseRotation: false,
        labelRenderedSizeThreshold: 7,
        labelDensity: 0.65,
        nodePickingPadding: 4,
        minEdgeThickness: 0.4,
        stagePadding: 28,
        hideLabelsOnMove: false,
        inertiaDuration: 0,
        inertiaRatio: 0
      },
      styles: {
        stage: {
          background: function () { return palette.stage; }
        }
      },
      nodeReducer: nodeReducer,
      edgeReducer: edgeReducer
    });
    graphEl.style.backgroundColor = palette.stage;

    var ignoreStage = false;
    function onNode(event) {
      ignoreStage = true;
      selectNode(event.node, false);
      setTimeout(function () { ignoreStage = false; }, 0);
    }
    renderer.on("clickNode", onNode);
    renderer.on("clickNodeLabel", onNode);
    renderer.on("clickStage", function () {
      if (ignoreStage) return;
      clearSelection();
    });

    window.__relationshipMap = {
      graph: graph,
      renderer: renderer,
      select: function (id) { selectNode(id, true); },
      clear: clearSelection
    };

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        publish();
        renderDetails();
        statusEl.dataset.ready = "true";
        statusEl.dataset.modelIds = built.modelIds.join(",");
      });
    });
  }

  findForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var ids = renderMatches(searchInput.value);
    if (ids.length) selectNode(ids[0], true);
  });
  searchInput.addEventListener("input", function () {
    renderMatches(searchInput.value);
  });
  searchResults.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button || !button.dataset.nodeId) return;
    selectNode(button.dataset.nodeId, true);
  });
  document.querySelectorAll(".kind-filter input").forEach(function (box) {
    box.addEventListener("change", function () {
      shown[box.dataset.kind] = box.checked;
      if (selected && !kindShown(graph.getNodeAttribute(selected, "kind"))) {
        selected = null;
        neighborMap = {};
      } else if (selected) {
        var next = {};
        graph.forEachNeighbor(selected, function (neighbor) {
          if (kindShown(graph.getNodeAttribute(neighbor, "kind"))) next[neighbor] = true;
        });
        neighborMap = next;
      }
      refreshView();
    });
  });
  clearBtn.addEventListener("click", clearSelection);
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (event.target === searchInput && searchInput.value) {
      searchInput.value = "";
      renderMatches("");
      return;
    }
    clearSelection();
  });

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
        return { slug: file[0], name: file[1], short: file[1].slice(0, 3).toUpperCase(), json: files[5 + i] };
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
    var built = buildGraph(data);
    start(built);
  }).catch(function (err) {
    showError(err && err.message ? err.message : "The map could not load the site data. Reload the page.");
  });
})();
