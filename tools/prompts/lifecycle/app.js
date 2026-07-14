/* Lifecycle Prompt Builder
 * Stitches the persona/sector slices of /tools/prompts/ to the six stages of
 * /framework/security-lifecycle/. Given a persona, industry vertical, lifecycle
 * stage, and operating model, it generates one grounded, copy-ready prompt that
 * names the single accountable party, resolves any "shared" default to one owner,
 * cites canonical IDs, and points the agent at the exact data file and on-site
 * tool for that stage.
 *
 * All resolution tables are embedded so the tool works with no network call. The
 * embedded owner resolver is transcribed verbatim from /data/finding-routing.json
 * (layer x operating model -> one accountable persona, party, and counterparty
 * note); the generated prompt also tells the agent to fetch the live file. */
(function () {
  "use strict";

  var BASE = "https://aisharedresponsibility.com";

  /* ---- Personas (order and display names from /data/personas.json) -------- */
  var PERSONAS = [
    { id: "agentic-platform-provider", name: "Agentic Platform & Framework Providers", layer: "L3", altLayer: "L4", note: "Owns L3 orchestration and L4 framework runtime. This builder routes accountability on its primary layer L3." },
    { id: "application-developer",     name: "Application Developer",        layer: "L3", note: "Owns L3 AI Application: guardrails, input validation, output filtering, RAG, agent orchestration." },
    { id: "data-provider",            name: "Data Provider",                layer: "L2", note: "Owns L2 AI Information: data provenance, quality, privacy, classification." },
    { id: "ai-system-users",          name: "AI System Users",              layer: "L1", note: "Uses the system. L1 accountability sits with AI System Governance under the org's acceptable-use policy." },
    { id: "ai-system-governance",     name: "AI System Governance",         layer: "L1", note: "Owns L1 AI Business & Usage: policy, compliance, acceptable-risk, incident governance." },
    { id: "model-provider",           name: "Model Provider",               layer: "L5", note: "Owns L5 AI Model Provider: model architecture security, model cards, vulnerability disclosure." },
    { id: "ai-model-serving",         name: "AI Model Serving",             layer: "L4", note: "Serves models at L4. L4 accountability currently routes to AI Platform Provider." },
    { id: "ai-platform-provider",     name: "AI Platform Provider",         layer: "L4", note: "Owns L4 AI Platform: compute, gateways, guardrail infrastructure, platform IAM." }
  ];

  /* ---- Layers (names from /data/layers.json) ------------------------------ */
  var LAYER_NAME = {
    L1: "AI Business & Usage",
    L2: "AI Information",
    L3: "AI Application",
    L4: "AI Platform",
    L5: "AI Model Provider"
  };

  /* ---- Operating models (from /data/matrix.json) -------------------------- */
  var MODELS = [
    { id: "AI-SaaS",    slug: "ai-saas",    name: "AI-Enabled SaaS",              agentic: false, note: "Provider runs a managed AI application. Customer keeps business governance and context data." },
    { id: "AI-PaaS",    slug: "ai-paas",    name: "AI Platform as a Service",     agentic: false, note: "Customer builds the application on a provider-managed platform and model." },
    { id: "Agent-PaaS", slug: "agent-paas", name: "Agentic Platform as a Service", agentic: true,  note: "Customer owns agent definitions on a provider-managed orchestration runtime. Agentic: classify autonomy and override." },
    { id: "IaaS",       slug: "iaas",       name: "Infrastructure as a Service",  agentic: false, note: "Customer builds application, platform, and model. Provider owns infrastructure under L4 only." }
  ];

  /* ---- Verticals (control files + regulation sets from /tools/prompts/) --- */
  var VERTICALS = [
    { id: "finance",       name: "Financial services", file: "finance-controls.json",       regs: "SR 26-2, FINOS AIGF, OWASP LLM Top 10, EU AI Act" },
    { id: "healthcare",    name: "Healthcare",         file: "healthcare-controls.json",    regs: "FDA TPLC, FDA PCCP, ONC HTI-1, HIPAA, EU AI Act" },
    { id: "insurance",     name: "Insurance",          file: "insurance-controls.json",     regs: "NAIC AI Model Bulletin, Colorado Reg 10-1-1, NYDFS Circular Letter 7" },
    { id: "public-sector", name: "Public sector",      file: "public-sector-controls.json", regs: "OMB M-25-21, OMB M-25-22, FedRAMP 20x, NIST AI RMF" },
    { id: "defense",       name: "Defense / DoD",      file: "defense-controls.json",       regs: "DoD RAI, CMMC 2.0, DoD CC SRG, NIST 800-171" },
    { id: "manufacturing", name: "Manufacturing",      file: "manufacturing-controls.json", regs: "EU AI Act, IEC 62443, ISO 42001, NIST AI RMF" }
  ];

  /* ---- Lifecycle stages (tool + data mapping from /framework/security-lifecycle/) */
  var STAGES = [
    {
      id: 1, name: "Threat modeling and risk analysis", anchor: "cat-threat-modeling",
      toolName: "Layer Accountability Matrix", toolPath: "/tools/layer-matrix/",
      dataName: "Threat-to-accountability crosswalk", dataPath: "/data/threats.json", dataId: "srf.data.threats",
      contribution: "Bounds the analysis to the layers you own under this operating model and names the persona who owns each identified risk, so the threat model produces assignments instead of an unowned list.",
      produce: [
        "A layer-scoped threat list: for each threat, the SRF layer it lands on and whether this operating model puts it in your scope.",
        "The single accountable persona for each in-scope threat, taken from the resolver.",
        "Residual risks with no named owner, flagged for assignment."
      ]
    },
    {
      id: 2, name: "Adversarial testing and red teaming", anchor: "cat-red-teaming",
      toolName: "Red Team Scoping Tool", toolPath: "/tools/redteam-scope/",
      dataName: "Threat-to-accountability crosswalk", dataPath: "/data/threats.json", dataId: "srf.data.threats",
      contribution: "Sets rules of engagement. The operating model decides which layers the customer may test at all, and personas pre-assign finding ownership before testing starts.",
      produce: [
        "Rules of engagement: which layers are testable, which need provider authorization, and which are out of scope under this operating model.",
        "Pre-assigned finding ownership per layer, decided before testing starts.",
        "Test cases keyed to the crosswalk threats, each mapped to the accountable persona who will receive the finding."
      ]
    },
    {
      id: 3, name: "Secure development and AI supply chain", anchor: "cat-secure-dev",
      toolName: "Vendor Risk Assessment", toolPath: "/tools/vendor-risk/",
      dataName: "AI vendor risk categories", dataPath: "/data/vendor-risk.json", dataId: null,
      contribution: "Names who attests at each handoff in the model and data supply chain. Provenance schemes prove an attestation exists; the SRF names which persona produces it and which verifies it.",
      produce: [
        "An attestation handoff map: for each supply-chain boundary, the producing persona, the verifying persona, and the evidence object.",
        "The vendor risk tier and the attestation baseline to demand before signing.",
        "Handoffs where no persona is named to produce or verify an attestation, flagged as gaps."
      ]
    },
    {
      id: 4, name: "Control implementation and benchmarking", anchor: "cat-controls",
      toolName: "Controls Assessment (AICM)", toolPath: "/tools/controls-assessment/",
      dataName: "Vertical control schema", dataVertical: true, dataId: null,
      contribution: "Assigns control ownership. Control catalogs describe what good looks like; they do not name who at your company owns each control under your deployment model. The vertical schemas already carry an accountable persona per control.",
      produce: [
        "For each control in the vertical schema in scope at this layer, the single accountable persona under this operating model.",
        "The benchmark or evidence that proves the control operates, and who signs it.",
        "Controls with no clear owner under this operating model, flagged for assignment."
      ]
    },
    {
      id: 5, name: "Vulnerability management and finding remediation", anchor: "cat-vuln-mgmt",
      toolName: "Incident Response Playbooks", toolPath: "/tools/ir-playbooks/",
      dataName: "Finding routing reference", dataPath: "/data/finding-routing.json", dataId: null,
      contribution: "Routes findings. Severity scoring rates how bad a finding is; the SRF adds whose queue it goes in and who signs acceptance if it will not be fixed.",
      produce: [
        "For a scored finding at this layer, the queue it routes to and the accountable persona who owns remediation.",
        "The breach action per severity band, taken from the routing reference.",
        "Who signs residual acceptance if the finding will not be fixed."
      ]
    },
    {
      id: 6, name: "Detection, monitoring, and incident response", anchor: "cat-detection",
      toolName: "Incident Response Playbooks", toolPath: "/tools/ir-playbooks/",
      dataName: "Finding routing reference", dataPath: "/data/finding-routing.json", dataId: null,
      extraSource: "Thresholds SLI/SLO schema with an OCSF evidence plane: " + BASE + "/thresholds/ai-srf-threshold-control.schema.json",
      contribution: "Says who leads when a boundary fails, what to demand from the party on the other side, and which evidence obligations survive the incident.",
      produce: [
        "Who leads when this layer's boundary fails, and what to demand from the party on the other side.",
        "Detection signals and SLI/SLO thresholds that evidence the boundary, each with a named owner.",
        "Evidence obligations that survive the incident and the persona accountable for preserving them."
      ]
    }
  ];

  /* ---- Owner resolver: transcribed verbatim from /data/finding-routing.json
   * ROUTING[layer][operatingModel] = { p: personaId, party: customer|provider|shared, note } */
  var ROUTING = {
    L1: {
      "AI-SaaS":    { p: "ai-system-governance", party: "customer", note: "Business governance stays with the deploying org even where the layer default is shared. The provider's own governance obligations feed in as counterparty input and do not replace it." },
      "AI-PaaS":    { p: "ai-system-governance", party: "customer", note: "Layer is customer-owned under this operating model." },
      "Agent-PaaS": { p: "ai-system-governance", party: "customer", note: "Layer is customer-owned under this operating model." },
      "IaaS":       { p: "ai-system-governance", party: "customer", note: "Layer is customer-owned under this operating model." }
    },
    L2: {
      "AI-SaaS":    { p: "data-provider", party: "shared", note: "The provider owns integrity of data behind the managed application. The customer stays accountable for context data it supplies. Name the single lead per finding rather than routing to both." },
      "AI-PaaS":    { p: "data-provider", party: "shared", note: "The customer leads for fine-tune and augmentation data it brings. The provider owns data planes it manages. Name the single lead per finding." },
      "Agent-PaaS": { p: "data-provider", party: "shared", note: "The customer leads for agent context and memory stores it populates. The provider owns integrity of managed state. Name the single lead per finding." },
      "IaaS":       { p: "data-provider", party: "customer", note: "Customer owns the entire data pipeline." }
    },
    L3: {
      "AI-SaaS":    { p: "application-developer", party: "provider", note: "Provider's application team owns input and output defenses. Customer probing of these defenses requires provider authorization; see the red team scoping tool." },
      "AI-PaaS":    { p: "application-developer", party: "customer", note: "The customer builds the application and owns injection and output defenses. The platform provider supplies guardrail primitives as a supporting input." },
      "Agent-PaaS": { p: "agentic-platform-provider", party: "provider", note: "Orchestration runtime provider leads on input mediation and tool-execution safety; customer's application-developer remains accountable for injection paths opened by its own agent definitions. Name the single lead per finding." },
      "IaaS":       { p: "application-developer", party: "customer", note: "Customer owns input confidentiality and output handling end to end." }
    },
    L4: {
      "AI-SaaS":    { p: "ai-platform-provider", party: "provider", note: "Provider owns serving-environment integrity, capacity, and rate limiting end to end." },
      "AI-PaaS":    { p: "ai-platform-provider", party: "provider", note: "The provider owns platform availability, capacity, and isolation. The customer's application-developer owns request budgeting in the application it builds." },
      "Agent-PaaS": { p: "ai-platform-provider", party: "provider", note: "The provider owns runtime availability. The customer owns bounding agent loops that can exhaust it." },
      "IaaS":       { p: "ai-platform-provider", party: "customer", note: "The customer owns serving capacity, isolation, and limits. The infrastructure provider retains obligations for underlying infrastructure only." }
    },
    L5: {
      "AI-SaaS":    { p: "model-provider", party: "provider", note: "Provider owns model robustness, training-environment security, and the model supply chain end to end." },
      "AI-PaaS":    { p: "model-provider", party: "provider", note: "The provider owns the foundation model. The customer owns model evaluation against its own use cases before and during adoption." },
      "Agent-PaaS": { p: "model-provider", party: "shared", note: "Lead sits with the model provider for the foundation model. The customer owns validating model behavior under its own agent workloads. Name the single lead per finding." },
      "IaaS":       { p: "model-provider", party: "customer", note: "Customer trains or hosts its own model and owns its robustness, provenance, and rollback." }
    }
  };

  /* ---- helpers ------------------------------------------------------------ */
  function $(sel) { return document.querySelector(sel); }
  function byId(list, id) { for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; } return null; }
  function personaName(id) { var p = byId(PERSONAS, id); return p ? p.name : id; }
  function partyWord(party) {
    if (party === "customer") return "the customer";
    if (party === "provider") return "the provider";
    return "the single lead of a shared boundary";
  }

  var state = {
    persona: PERSONAS[0].id,
    vertical: VERTICALS[0].id,
    stage: STAGES[0].id,
    model: MODELS[0].id
  };

  /* ---- build selects ------------------------------------------------------ */
  function fillSelect(sel, items, valueKey, labelFn, current) {
    sel.innerHTML = "";
    items.forEach(function (it) {
      var o = document.createElement("option");
      o.value = it[valueKey];
      o.textContent = labelFn(it);
      sel.appendChild(o);
    });
    sel.value = current;
  }

  function buildSelects() {
    fillSelect($("#f-persona"), PERSONAS, "id",
      function (p) { return p.name; }, state.persona);
    fillSelect($("#f-vertical"), VERTICALS, "id",
      function (v) { return v.name; }, state.vertical);
    fillSelect($("#f-stage"), STAGES.map(function (s) { return { id: String(s.id), name: s.name }; }), "id",
      function (s) { return String(s.id).padStart(2, "0") + " · " + s.name; }, String(state.stage));
    fillSelect($("#f-model"), MODELS, "id",
      function (m) { return m.name + " (" + m.id + ")"; }, state.model);
  }

  /* ---- resolution -------------------------------------------------------- */
  function resolve() {
    var persona = byId(PERSONAS, state.persona);
    var vertical = byId(VERTICALS, state.vertical);
    var model = byId(MODELS, state.model);
    var stage = null;
    for (var i = 0; i < STAGES.length; i++) { if (STAGES[i].id === Number(state.stage)) { stage = STAGES[i]; } }
    var layer = persona.layer;
    var route = ROUTING[layer][model.id];
    var isAgentic = model.agentic || persona.id === "agentic-platform-provider";
    return { persona: persona, vertical: vertical, model: model, stage: stage, layer: layer, route: route, isAgentic: isAgentic };
  }

  /* ---- prompt builder ---------------------------------------------------- */
  function buildPrompt(r) {
    var layer = r.layer;
    var layerName = LAYER_NAME[layer];
    var accId = r.route.p;
    var accName = personaName(accId);
    var model = r.model;
    var stage = r.stage;
    var vertical = r.vertical;

    var dataPath = stage.dataVertical ? ("/data/" + vertical.file) : stage.dataPath;
    var dataName = stage.dataVertical ? (vertical.name + " control schema") : stage.dataName;
    var dataIdTag = stage.dataId ? (" (" + stage.dataId + ")") : "";

    var L = [];
    L.push("# framework: CoSAI AI Shared Responsibility Framework v1.0");
    L.push("# framework_domain: AI Governance / Accountability");
    L.push("# lifecycle_stage: " + String(stage.id).padStart(2, "0") + " " + stage.name);
    L.push("# persona: " + r.persona.name + " (srf.role." + r.persona.id + ")");
    L.push("# layer: " + layer + " " + layerName + " (srf.layer." + layer + ")");
    L.push("# operating_model: " + model.name + " (srf.opmodel." + model.slug + ")");
    L.push("# industry: " + vertical.name);
    L.push("# purpose: lifecycle-prompt");
    L.push("# version: 2.0");
    L.push("# canonical_url: " + BASE + "/tools/prompts/lifecycle/");
    L.push("#");
    L.push("You are an expert AI Governance Analyst using the CoSAI AI Shared Responsibility Framework v2.0 (srf.framework.cosai-srf).");
    L.push("");
    L.push("Scope of this task:");
    L.push("- Lifecycle stage: " + stage.name + ". " + stage.contribution);
    L.push("- I work from the " + r.persona.name + " vantage (srf.role." + r.persona.id + "), which owns SRF layer " + layer + " " + layerName + " (srf.layer." + layer + ").");
    L.push("- Operating model: " + model.name + " (srf.opmodel." + model.slug + "). " + model.note);
    L.push("- Industry context: " + vertical.name + ". Apply these regimes: " + vertical.regs + ".");
    L.push("");
    L.push("The one accountable party (never answer \"shared\"):");
    L.push("- For layer " + layer + " under " + model.id + ", accountability resolves to exactly one party: " + accName + " (srf.role." + accId + "), acting as " + partyWord(r.route.party) + ".");
    if (r.route.party === "shared") {
      L.push("- The framework default for this layer under " + model.id + " is \"shared.\" Shared is not a valid final answer. The single lead is " + accName + " (srf.role." + accId + ").");
      L.push("- Counterparty obligation to record, not to co-own: " + r.route.note);
    } else {
      L.push("- Basis: " + r.route.note);
    }
    L.push("- Name " + accName + " as the single Accountable owner in every RACI row. Cascade responsibilities from L1 down through L2, L3, L4, to L5 (srf.concept.responsibility-cascade). Do not output \"shared\" as a final assignment (srf.concept.accountability).");
    L.push("");
    L.push("Ground every claim in these sources and cite them:");
    L.push("- Accountability resolver: " + BASE + "/data/finding-routing.json (entry for layer " + layer + ", operating model " + model.id + ").");
    L.push("- Stage data: " + BASE + dataPath + dataIdTag + " (" + dataName + ").");
    L.push("- Stage tool: " + BASE + stage.toolPath + " (" + stage.toolName + ").");
    L.push("- " + vertical.name + " controls: " + BASE + "/data/" + vertical.file + ".");
    L.push("- Lifecycle reference: " + BASE + "/framework/security-lifecycle/#" + stage.anchor + ".");
    if (stage.extraSource) { L.push("- " + stage.extraSource + "."); }
    L.push("- Canonical ID registry: " + BASE + "/ids.json. Personas: " + BASE + "/data/personas.json. Layers: " + BASE + "/data/layers.json. Matrix: " + BASE + "/data/matrix.json.");
    L.push("");
    if (r.isAgentic) {
      L.push("Autonomy and human override (agentic deployment):");
      L.push("- Classify agent autonomy on the L0 to L5 scale (srf.concept.autonomy-level) and state the required human override tier T1 to T5 (srf.concept.human-override-tier).");
      L.push("- Tie each step up in autonomy to a named override control and name the party who holds it.");
      L.push("- Cover agent identity, tool and MCP scopes, and multi-agent handoffs at this layer.");
      L.push("");
    }
    L.push("Produce, in this order:");
    stage.produce.forEach(function (p, i) { L.push((i + 1) + ". " + p); });
    L.push((stage.produce.length + 1) + ". A RACI table with exactly one Accountable party per row and no cell reading \"shared.\"");
    L.push((stage.produce.length + 2) + ". Open gaps and the residual risk owner, cited to the sources above.");
    L.push("");
    L.push("Be precise, actionable, and neutral. If the framework does not resolve an assignment, say so; do not invent one.");
    return L.join("\n");
  }

  /* ---- render ------------------------------------------------------------ */
  function render() {
    var r = resolve();

    // notes under selects
    $("#persona-note").textContent = r.persona.note;
    $("#stage-note").textContent = "Tool: " + r.stage.toolName + ". Data: " +
      (r.stage.dataVertical ? (r.vertical.name + " control schema") : r.stage.dataName) + ".";
    $("#model-note").textContent = r.model.note;

    // resolution card
    $("#r-layer").textContent = r.layer + " " + LAYER_NAME[r.layer];
    var accName = personaName(r.route.p);
    $("#r-party").textContent = accName + " as " + partyWord(r.route.party);
    var sharedEl = $("#r-shared");
    if (r.route.party === "shared") {
      sharedEl.textContent = "Default is shared. Single lead: " + accName + ". Counterparty obligation recorded, not co-owned.";
      sharedEl.className = "resolve__v resolve__v--warn";
    } else {
      sharedEl.textContent = "Not shared under this operating model. One owner already.";
      sharedEl.className = "resolve__v";
    }

    // prompt block
    var stageNum = String(r.stage.id).padStart(2, "0");
    $("#prompt-label").textContent = "Lifecycle prompt · " + r.persona.name + " · " + stageNum + " " + r.stage.name + " · " + r.model.id;
    $("#prompt-text").textContent = buildPrompt(r);
  }

  /* ---- wire -------------------------------------------------------------- */
  function wire() {
    $("#f-persona").addEventListener("change", function (e) { state.persona = e.target.value; render(); });
    $("#f-vertical").addEventListener("change", function (e) { state.vertical = e.target.value; render(); });
    $("#f-stage").addEventListener("change", function (e) { state.stage = Number(e.target.value); render(); });
    $("#f-model").addEventListener("change", function (e) { state.model = e.target.value; render(); });
  }

  function boot() {
    buildSelects();
    wire();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
