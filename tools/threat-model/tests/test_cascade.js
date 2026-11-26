// Headless tests for the threat model prototype.
// Run: NODE_PATH=<dir with jsdom> node tests/test_cascade.js
// Loads index.html in jsdom, then tests the engine (window.TM) and the UI.
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const assert = require("assert");

const DIR = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window;
w.alert = () => {};
w.URL.createObjectURL = () => "blob:test";
const TM = w.TM;
const example = JSON.parse(fs.readFileSync(path.join(DIR, "example-o2c.json"), "utf8"));
const clone = (x) => JSON.parse(JSON.stringify(x));
const plain = (x) => JSON.parse(JSON.stringify(x)); // jsdom arrays come from another realm

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("ok   " + name); }
  catch (e) { fail++; console.log("FAIL " + name + "\n     " + e.message); }
}
const st = (r, id) => (r.nodes[id] ? r.nodes[id].state : "not reached");

test("embedded example equals example-o2c.json", () => {
  const embedded = JSON.parse(w.document.getElementById("example-data").textContent);
  assert.deepStrictEqual(embedded, example);
});

test("only the 4 SRF operating models and the 8 SRF personas", () => {
  assert.deepStrictEqual(plain(TM.OPERATING_MODELS), ["AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS"]);
  assert.strictEqual(Object.keys(TM.PERSONAS).length, 8);
  assert.strictEqual(TM.PERSONAS["srf.role.model-provider"].name, "AI Model Provider");
  assert.strictEqual(TM.REL_TYPES.length, 9);
});

test("reasoning LLM failure, worst case: reaches orchestrator and sub-agents, not the policy service or credit step", () => {
  const r = TM.cascade(example, "cmp.reasoning-llm");
  assert.strictEqual(st(r, "cmp.llm-gateway"), "failed");
  assert.strictEqual(st(r, "cmp.orchestrator"), "failed");
  ["cmp.agent-intake", "cmp.agent-pricing", "cmp.agent-invoicing", "cmp.agent-collections", "cmp.agent-disputes"]
    .forEach((id) => assert.strictEqual(st(r, id), "failed", id));
  assert.strictEqual(st(r, "cmp.o2c-logic"), "impacted");
  assert.strictEqual(st(r, "cmp.step-pricing"), "impacted");
  assert.strictEqual(st(r, "cmp.policy-service"), "not reached");
  assert.strictEqual(st(r, "cmp.step-credit"), "not reached");
  assert.strictEqual(st(r, "cmp.o2c-process"), "impacted");
  assert.strictEqual(r.nodes["cmp.o2c-process"].rollup, true);
  assert.ok(r.byLayer.L1.impacted.length >= 7);
  assert.ok(r.byOwner["No owner"], "cash matching (no owner) shows in the per-owner view");
});

test("with controls in place: a control lowers failed to impacted, it does not stop the cascade", () => {
  const worst = TM.cascade(example, "cmp.reasoning-llm");
  assert.strictEqual(st(worst, "cmp.agent-pricing"), "failed");
  const r = TM.cascade(example, "cmp.reasoning-llm", { mode: "controls" });
  assert.deepStrictEqual(plain(r.lowered.map((c) => c.to).sort()), ["cmp.agent-disputes", "cmp.agent-pricing"]);
  // still reached, now impacted
  assert.strictEqual(st(r, "cmp.agent-pricing"), "impacted");
  assert.strictEqual(st(r, "cmp.agent-disputes"), "impacted");
  // impacted does not pass a failure on, so the steps they realize are not reached through them
  assert.strictEqual(st(r, "cmp.step-pricing"), "not reached");
  assert.deepStrictEqual(plain(r.byLayer.L3.lowered.sort()), ["cmp.agent-disputes", "cmp.agent-pricing"]);
  assert.ok(r.reached.length < worst.reached.length);
});

test("a control lowers only failures; a link that already gives impact is unchanged", () => {
  const m = clone(example);
  m.relationships.find((x) => x.id === "rel.r5").containment_control_ids = ["ctl.discount-authority"];
  const r = TM.cascade(m, "cmp.agent-pricing", { mode: "controls" });
  assert.strictEqual(st(r, "cmp.step-pricing"), "impacted");
  assert.ok(!r.lowered.some((c) => c.to === "cmp.step-pricing"));
});

test("a control that is only planned does not lower anything", () => {
  const m = clone(example);
  m.controls.find((c) => c.id === "ctl.discount-authority").status = "planned";
  const r = TM.cascade(m, "cmp.reasoning-llm", { mode: "controls" });
  assert.strictEqual(st(r, "cmp.agent-pricing"), "failed");
  assert.strictEqual(st(r, "cmp.step-pricing"), "impacted");
});

test("logic failure: realization carries it to the realizer (L1 logic -> L3 orchestrator)", () => {
  const r = TM.cascade(example, "cmp.o2c-logic");
  assert.strictEqual(st(r, "cmp.orchestrator"), "failed");
  assert.strictEqual(r.nodes["cmp.orchestrator"].via.rel, "realization");
});

test("execution failure: realizer failure lands as impact on the L1 step, not as a failure", () => {
  const r = TM.cascade(example, "cmp.agent-collections");
  assert.strictEqual(st(r, "cmp.step-collections"), "impacted");
  assert.strictEqual(st(r, "cmp.orchestrator"), "impacted"); // soft results flow
  assert.strictEqual(st(r, "cmp.agent-intake"), "not reached"); // impacted does not propagate
});

test("roll-up goes up parent-child links only, never back down", () => {
  // A failed step is a failure of its logic, so its realizer (credit scoring) fails too.
  const r = TM.cascade(example, "cmp.step-credit");
  assert.strictEqual(st(r, "cmp.credit-scoring"), "failed");
  assert.strictEqual(st(r, "cmp.o2c-process"), "impacted");
  assert.strictEqual(st(r, "cmp.step-pricing"), "impacted"); // soft triggering
  assert.strictEqual(st(r, "cmp.step-invoicing"), "not reached");
  assert.strictEqual(st(r, "cmp.o2c-logic"), "not reached");
  assert.strictEqual(r.reached.length, 4);
});

test("write access spreads tampering; read access only exposes", () => {
  const r = TM.cascade(example, "cmp.agent-invoicing");
  assert.strictEqual(st(r, "cmp.ledger"), "failed");
  assert.strictEqual(st(r, "cmp.cash-matching"), "failed");
  assert.strictEqual(st(r, "cmp.agent-collections"), "failed");
  assert.strictEqual(st(r, "cmp.customer-master"), "exposed");
});

test("serving that provides controls only exposes the consumer", () => {
  const r = TM.cascade(example, "cmp.guardrails");
  assert.deepStrictEqual(plain(r.reached.map((n) => n.id + ":" + n.state).sort()),
    ["cmp.guardrails:failed", "cmp.llm-gateway:exposed", "cmp.orchestrator:exposed"]);
});

test("soft serving degrades but does not pass the failure on", () => {
  const r = TM.cascade(example, "cmp.fallback-llm");
  assert.strictEqual(st(r, "cmp.llm-gateway"), "impacted");
  assert.strictEqual(st(r, "cmp.orchestrator"), "not reached");
});

test("candidate L4 edge/OT host is in the blast radius of the reasoning LLM", () => {
  const r = TM.cascade(example, "cmp.reasoning-llm");
  assert.strictEqual(st(r, "cmp.warehouse-edge"), "failed");
  assert.strictEqual(st(r, "cmp.warehouse-network"), "not reached");
  const r2 = TM.cascade(example, "cmp.warehouse-network");
  assert.strictEqual(st(r2, "cmp.warehouse-edge"), "failed");
  assert.ok(TM.gaps(example).some((g) => g.rule === "TM-G25" && g.refs[0] === "cmp.warehouse-edge"));
});

test("unclassified link: flagged, and skipped by the cascade when it has no type", () => {
  const r = TM.cascade(example, "cmp.credit-bureau");
  assert.strictEqual(st(r, "cmp.customer-master"), "not reached");
  assert.ok(TM.gaps(example).some((g) => g.rule === "TM-G22" && g.refs[0] === "rel.u1" && g.severity === "medium"));
  const m = clone(example);
  const u = m.relationships.find((x) => x.id === "rel.u1"); u.type = "flow"; u.cascade = "hard";
  assert.strictEqual(st(TM.cascade(m, "cmp.credit-bureau"), "cmp.customer-master"), "failed");
  assert.ok(TM.gaps(m).some((g) => g.rule === "TM-G22" && g.severity === "low"));
});

test("versioned states: the December snapshot clears gaps that the Nov 16 state has", () => {
  const rules = (m) => TM.gaps(m).filter((g) => ["TM-G01", "TM-G09", "TM-G20"].indexOf(g.rule) >= 0).map((g) => g.rule).sort();
  assert.deepStrictEqual(plain(rules(example)), ["TM-G01", "TM-G09", "TM-G20"]);
  const m = clone(example); m.system.snapshot_id = "snap.dec01";
  assert.deepStrictEqual(plain(rules(m)), []);
  m.system.snapshot_id = "snap.dec01-no-rules-update";
  assert.deepStrictEqual(plain(rules(m)), ["TM-G20"], "pin to base keeps the old logic version");
  const m2 = clone(example); m2.system.as_of = "2026-12-05";
  assert.deepStrictEqual(plain(rules(m2)), [], "a date alone also selects the state");
  const res = TM.resolve(m2);
  assert.strictEqual(res.relationships.find((x) => x.id === "rel.r2").logic_version, "2.0");
  assert.strictEqual(res.components.find((x) => x.id === "cmp.cash-matching").state_version, "2");
});

test("versioned states: the cascade runs against the chosen state", () => {
  const m = clone(example); m.system.snapshot_id = "snap.dec01";
  const r2 = TM.cascade(m, "cmp.ledger");
  assert.ok(!r2.byOwner["No owner"], "owner named in December");
  assert.ok(TM.cascade(example, "cmp.ledger").byOwner["No owner"]);
});

test("versioned states: valid_from, removed and a bad pin", () => {
  const m = clone(example);
  m.components.find((c) => c.id === "cmp.warehouse-edge").valid_from = "2027-01-01";
  assert.ok(!TM.active(m).components.some((c) => c.id === "cmp.warehouse-edge"));
  m.relationships.find((x) => x.id === "rel.f17").versions = [{ version: "gone", from: "2026-11-01", removed: true }];
  assert.ok(!TM.active(m).relationships.some((x) => x.id === "rel.f17"));
  m.snapshots.push({ id: "snap.bad", name: "bad", as_of: "2026-11-16", pins: { "rel.r2": "9" } });
  m.system.snapshot_id = "snap.bad";
  assert.ok(TM.gaps(m).some((g) => g.rule === "TM-G23"));
});

test("stakeholders: listed on threats and found by the cascade; never owners", () => {
  const r = TM.cascade(example, "cmp.agent-collections");
  assert.ok(r.stakeholders.indexOf("stk.consumer-debtors") >= 0);
  assert.ok(example.stakeholders.every((x) => !("persona_id" in x) && !("owner" in x)));
  assert.ok(TM.gaps(example).some((g) => g.rule === "TM-G24" && g.refs[0] === "thr.spoofed-po"));
  assert.strictEqual(TM.active(example).stakeholders.length, 4);
  const m = clone(example); m.system.overlays_enabled = ["banking"];
  assert.strictEqual(TM.active(m).stakeholders.length, 6);
});

test("data flow view across layers", () => {
  const f = TM.dataFlows(example);
  assert.ok(f.matrix.L3.L4 >= 2 && f.matrix.L4.L5 === 2, "prompts flow L3 -> L4 -> L5");
  const toLlm = f.moves.find((x) => x.rel.id === "rel.f13");
  assert.strictEqual(toLlm.boundary, "crosses");
  const read = f.moves.find((x) => x.rel.id === "rel.x1");
  assert.strictEqual(read.from, "cmp.customer-master"); // read moves data to the reader
  assert.ok(read.l1.indexOf("cmp.step-order-capture") >= 0, "move tied to the L1 step it serves");
  assert.ok(f.moves.filter((x) => x.rel.id === "rel.x4").length === 2, "readwrite moves both ways");
  assert.ok(f.paths.some((p) => p[0] === "cmp.inbound-docs" && p.indexOf("cmp.reasoning-llm") >= 0), "PO email text reaches the L5 model");
});

test("cycles terminate", () => {
  const m = clone(example);
  m.relationships.push({ id: "rel.loop1", type: "flow", from: "cmp.agent-intake", to: "cmp.agent-pricing", cascade: "hard" });
  m.relationships.push({ id: "rel.loop2", type: "flow", from: "cmp.agent-pricing", to: "cmp.agent-intake", cascade: "hard" });
  m.relationships.push({ id: "rel.loop3", type: "composition", from: "cmp.step-credit", to: "cmp.o2c-process", cascade: "hard" });
  const r = TM.cascade(m, "cmp.agent-intake");
  assert.strictEqual(st(r, "cmp.agent-pricing"), "failed");
  assert.ok(TM.gaps(m).some((g) => g.rule === "TM-G11" && g.severity === "high"));
});

test("banking overlay adds its threats only when enabled", () => {
  assert.ok(!TM.active(example).threats.some((t) => t.vertical === "banking"));
  const m = clone(example); m.system.overlays_enabled = ["banking"];
  assert.strictEqual(TM.active(m).threats.filter((t) => t.vertical === "banking").length, 2);
  assert.strictEqual(TM.active(m).obligations.filter((o) => o.vertical === "banking").length, 3);
});

test("local and inherited controls", () => {
  const o = TM.controlsFor(example, "cmp.orchestrator");
  assert.deepStrictEqual(plain(o.local.map((c) => c.id)), ["ctl.decision-log"]);
  assert.deepStrictEqual(plain(o.inherited.map((i) => i.control.id + "<" + i.how).sort()),
    ["ctl.agent-identity<assignment", "ctl.output-filter<serving (controls)"]);
  const s = TM.controlsFor(example, "cmp.step-credit");
  assert.deepStrictEqual(plain(s.inherited.map((i) => i.control.id)), ["ctl.sod"]);
});

test("Required only with a verified, binding, in-force obligation and an approved link", () => {
  assert.ok(example.controls.every((c) => !/^Required/.test(TM.controlStatus(example, c.id).label)), "nothing Required in the unverified example");
  assert.strictEqual(TM.controlStatus(example, "ctl.input-isolation").label, "Risk-driven only");
  const m = clone(example);
  const o = m.obligations.find((x) => x.id === "obl.order-policy");
  Object.assign(o, { in_force: "yes", verification: { status: "verified", method: "test", checked_on: "2026-11-01" } });
  const c = m.controls.find((x) => x.id === "ctl.shipto-verify");
  c.obligation_links = [{ obligation_id: "obl.order-policy", basis: "official_text", review_status: "approved" }];
  assert.strictEqual(TM.controlStatus(m, c.id).label, "Required");
  o.applies_if = "Only for new customers";
  assert.strictEqual(TM.controlStatus(m, c.id).label, "Required if");
  o.applies_if = null; c.obligation_links[0].basis = "recital_text";
  assert.strictEqual(TM.controlStatus(m, c.id).label, "Required (recital-based)");
  c.obligation_links[0].basis = "editorial_inference";
  assert.strictEqual(TM.controlStatus(m, c.id).label, "Recommended");
  c.obligation_links[0].basis = "official_text"; o.verification.checked_on = "2026-01-01";
  assert.strictEqual(TM.controlStatus(m, c.id).label, "Recommended", "stale after 180 days");
});

test("gap checks find the planted gaps", () => {
  const g = TM.gaps(example);
  const has = (rule, ref) => g.some((x) => x.rule === rule && x.refs.indexOf(ref) >= 0);
  assert.ok(has("TM-G01", "cmp.cash-matching"), "no owner");
  assert.ok(has("TM-G02", "cmp.step-fulfillment"), "shared owner");
  assert.ok(has("TM-G05", "thr.misapplied-cash"), "threat with no accountable");
  assert.ok(has("TM-G09", "cmp.model-settings"), "settings with no L1 approver");
  assert.ok(has("TM-G20", "rel.r2"), "stale logic version");
  assert.ok(has("TM-G04", "rel.r3"), "logic owner differs from execution owner, no approval");
  assert.ok(g.some((x) => x.rule === "TM-G04" && x.refs[0] === "rel.r1" && x.severity === "info"), "approval on file lowers severity");
  assert.ok(!g.some((x) => x.rule === "TM-G18"), "multiplicity holds in the example");
});

test("multiplicity and persona checks", () => {
  const m = clone(example);
  m.relationships.push({ id: "rel.extra", type: "realization", from: "cmp.agent-invoicing", to: "cmp.o2c-logic", cascade: "hard" });
  assert.ok(TM.gaps(m).some((x) => x.rule === "TM-G18" && x.refs.indexOf("cmp.o2c-logic") >= 0));
  m.components[0].owner.persona_id = "deployer";
  assert.ok(TM.gaps(m).some((x) => x.rule === "TM-G03" && x.severity === "high"));
});

test("boundary is derived from owner party", () => {
  const rel = (id) => example.relationships.find((r) => r.id === id);
  assert.strictEqual(TM.boundary(example, rel("rel.s1")), "crosses");   // gateway (provider) serves orchestrator (customer)
  assert.strictEqual(TM.boundary(example, rel("rel.s2")), "internal");  // model to gateway, both provider side
  assert.strictEqual(TM.boundary(example, rel("rel.r9")), "unknown");   // cash matching has no owner
});

// ---------- Bill, Nov 16, 2026 (second set): one graph, derived links, default multiplicity ----------
test("one graph: parent-child links are cascade rules, not a separate pass", () => {
  ["composition", "aggregation", "assignment", "realization", "serving", "access", "flow", "triggering"].forEach((t) =>
    assert.strictEqual(TM.REL_INFO[t].graph, "component", t));
  assert.strictEqual(TM.REL_INFO.influence.graph, "motivation");
  const pc = plain(TM.CASCADE_RULES.filter((x) => x.rel === "composition" || x.rel === "aggregation").map((x) => [x.rel, x.dir]));
  assert.deepStrictEqual(pc, [["composition", "reverse"], ["aggregation", "reverse"]]);
});

const tiny = () => ({
  tm_schema_version: "0.1.0-draft",
  system: { id: "sys.t", name: "t", operating_model: "AI-PaaS", as_of: "2026-11-16" },
  components: ["whole", "part", "src", "data"].map((n) => ({ id: "cmp." + n, name: n, layer: "L3", type: "tool",
    owner: { status: "assigned", name: n + " owner", persona_id: "srf.role.application-developer", party: "customer" } })),
  relationships: [{ id: "rel.pc", type: "composition", from: "cmp.whole", to: "cmp.part", cascade: "hard" }],
  obligations: [], controls: [], threats: []
});

test("merge change: a whole that a read link only exposed is raised to impacted when its part fails", () => {
  const m = tiny();
  m.relationships.push({ id: "rel.rd", type: "access", from: "cmp.src", to: "cmp.whole", access_mode: "read", cascade: "hard" });
  m.relationships.push({ id: "rel.sv", type: "serving", from: "cmp.src", to: "cmp.part", cascade: "hard" });
  const before = clone(m); before.relationships = before.relationships.filter((x) => x.id !== "rel.sv");
  assert.strictEqual(st(TM.cascade(before, "cmp.src"), "cmp.whole"), "exposed", "the failed component reads the whole");
  const r = TM.cascade(m, "cmp.src");
  assert.strictEqual(st(r, "cmp.part"), "failed");
  assert.strictEqual(st(r, "cmp.whole"), "impacted", "before the merge this stayed exposed");
  assert.strictEqual(r.nodes["cmp.whole"].rollup, true);
});

test("parent-child cascade field: hard rolls up impact and failure; soft rolls up only a failure", () => {
  const m = tiny();
  m.relationships.push({ id: "rel.sv", type: "serving", from: "cmp.src", to: "cmp.part", cascade: "soft" });
  assert.strictEqual(st(TM.cascade(m, "cmp.src"), "cmp.whole"), "impacted", "hard link: an impacted part rolls up");
  m.relationships[0].cascade = "soft";
  assert.strictEqual(st(TM.cascade(m, "cmp.src"), "cmp.whole"), "not reached", "soft link: an impacted part does not");
  assert.strictEqual(st(TM.cascade(m, "cmp.part"), "cmp.whole"), "impacted", "soft link: a failed part still rolls up");
  assert.strictEqual(st(TM.cascade(m, "cmp.whole"), "cmp.part"), "not reached", "nothing travels from whole to part");
});

test("merge keeps the earlier results checked by these tests", () => {
  // Numbers recorded before the merge. A one-off comparison with the old engine found no differences for any seed,
  // in both modes and both snapshots; see DESIGN.md, "One component graph."
  assert.strictEqual(TM.cascade(example, "cmp.reasoning-llm").reached.length, 23);
  assert.strictEqual(TM.cascade(example, "cmp.reasoning-llm", { mode: "controls" }).reached.length, 21);
  assert.strictEqual(TM.cascade(example, "cmp.step-credit").reached.length, 4);
});

test("derived links: approved; the cascade uses the chain, not the shortcut", () => {
  const d = example.relationships.find((r) => r.id === "rel.d1");
  assert.ok(d && d.derived && d.derived_from.length === 2);
  const r = TM.cascade(example, "cmp.reasoning-llm");
  assert.strictEqual(r.nodes["cmp.orchestrator"].via.edge, "rel.s1", "reached through the gateway, not rel.d1");
  const m = clone(example);
  m.relationships = m.relationships.filter((x) => x.id !== "rel.s1");
  assert.strictEqual(st(TM.cascade(m, "cmp.reasoning-llm"), "cmp.orchestrator"), "not reached");
  assert.strictEqual(st(TM.cascade(m, "cmp.reasoning-llm", { includeDerived: true }), "cmp.orchestrator"), "failed");
  assert.ok(TM.gaps(m).some((g) => g.rule === "TM-G27" && g.severity === "medium"), "chain link missing");
  assert.ok(TM.gaps(example).some((g) => g.rule === "TM-G27" && g.severity === "info"));
  assert.ok(!TM.dataFlows(example).moves.some((mv) => mv.rel.id === "rel.d1"));
});

test("default multiplicity MD-01 applies with no range on the link", () => {
  const m = clone(example);
  m.relationships.forEach((r) => { delete r.multiplicity; });
  assert.ok(!TM.gaps(m).some((g) => g.rule === "TM-G18"), "defaults hold in the example");
  m.relationships.push({ id: "rel.x", type: "realization", from: "cmp.agent-invoicing", to: "cmp.o2c-logic", cascade: "hard" });
  assert.ok(TM.gaps(m).some((g) => g.rule === "TM-G18" && /MD-01/.test(g.message) && g.refs[0] === "cmp.o2c-logic"));
  m.relationships = m.relationships.filter((r) => !(r.type === "realization" && r.to === "cmp.hard-rules"));
  assert.ok(TM.gaps(m).some((g) => g.rule === "TM-G18" && /MD-01/.test(g.message) && g.refs[0] === "cmp.hard-rules"), "zero realizers");
});

test("default multiplicity MD-02 and MD-05, and a component override", () => {
  const m = clone(example);
  m.relationships.push({ id: "rel.x", type: "realization", from: "cmp.agent-invoicing", to: "cmp.step-collections", cascade: "hard" });
  assert.ok(TM.gaps(m).some((g) => g.rule === "TM-G18" && /MD-02/.test(g.message) && g.refs[0] === "cmp.step-collections"));
  m.relationships.push({ id: "rel.y", type: "realization", from: "cmp.agent-invoicing", to: "cmp.step-disputes", cascade: "hard" });
  assert.ok(!TM.gaps(m).some((g) => g.rule === "TM-G18" && g.refs[0] === "cmp.step-disputes"), "override allows 2");
  assert.ok(TM.gaps(m).some((g) => g.rule === "TM-G26" && g.severity === "info" && g.refs[0] === "cmp.step-disputes"));
  m.relationships.push({ id: "rel.z", type: "composition", from: "cmp.orchestrator", to: "cmp.step-pricing", cascade: "hard" });
  assert.ok(TM.gaps(m).some((g) => g.rule === "TM-G18" && g.severity === "low" && /MD-05/.test(g.message)));
});

test("MD-03 and MD-04 drive G01, G02 and G05; overrides lower them and are listed", () => {
  const m = clone(example);
  const f = m.components.find((c) => c.id === "cmp.step-fulfillment");
  const sev = (rule, ref) => (TM.gaps(m).find((g) => g.rule === rule && g.refs[0] === ref) || {}).severity;
  assert.strictEqual(sev("TM-G02", "cmp.step-fulfillment"), "high");
  f.multiplicity_overrides = [{ rule_id: "MD-03", lower: 1, upper: 2 }];
  assert.strictEqual(sev("TM-G02", "cmp.step-fulfillment"), "info");
  assert.strictEqual(sev("TM-G26", "cmp.step-fulfillment"), "low", "override with no reason");
  assert.strictEqual(sev("TM-G05", "thr.misapplied-cash"), "high");
  m.multiplicity_rules = [{ rule_id: "MD-04", off: true, reason: "test" }];
  assert.strictEqual(sev("TM-G05", "thr.misapplied-cash"), "info");
});

test("a range stated on a link wins over the default", () => {
  const m = clone(example);
  m.relationships.find((r) => r.id === "rel.r1").multiplicity = { lower: 1, upper: 2 };
  m.relationships.push({ id: "rel.x", type: "realization", from: "cmp.agent-invoicing", to: "cmp.o2c-logic", cascade: "hard" });
  assert.ok(!TM.gaps(m).some((g) => g.rule === "TM-G18" && g.refs.indexOf("cmp.o2c-logic") >= 0));
});

test("L1 step owners map to AI System Governance (approved)", () => {
  example.components.filter((c) => c.layer === "L1" && c.type === "process_step" && c.owner && c.owner.status === "assigned")
    .forEach((c) => assert.strictEqual(c.owner.persona_id, "srf.role.ai-system-governance", c.id));
});


test("embedded P2P, H2R, R2R, Case and the five new examples equal their JSON files", () => {
  ["p2p", "h2r", "r2r", "case", "l2o", "i2r", "q2a", "r2f", "p2f"].forEach((id) => {
    const embedded = JSON.parse(w.document.getElementById("example-data-" + id).textContent);
    const file = JSON.parse(fs.readFileSync(path.join(DIR, "example-" + id + ".json"), "utf8"));
    assert.deepStrictEqual(embedded, file, id);
  });
});

test("catalog_threat_id points at a real /data/threats.json entry, and external_refs copy its mappings", () => {
  const cat = JSON.parse(fs.readFileSync(path.join(DIR, "..", "..", "data", "threats.json"), "utf8"));
  const byId = {}; cat.threats.forEach((x) => { byId[x.id] = x; });
  let mapped = 0;
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas", "l2o", "i2r", "q2a", "r2f", "p2f"].forEach((id) => {
    const m = JSON.parse(fs.readFileSync(path.join(DIR, "example-" + id + ".json"), "utf8"));
    m.threats.forEach((t) => {
      if (!t.catalog_threat_id) return;
      mapped++;
      const x = byId[t.catalog_threat_id];
      assert.ok(x, id + " " + t.id + ": " + t.catalog_threat_id + " is in the catalog");
      const want = [];
      if (x.ai_exchange) want.push({ source: "owasp_ai_exchange", id: x.id, url: x.ai_exchange });
      ["owasp_llm_top10", "mitre_atlas", "owasp_dsgai", "biml_llm24"].forEach((k) => { if (x.mappings[k]) want.push({ source: k, id: x.mappings[k] }); });
      assert.deepStrictEqual(t.external_refs, want, id + " " + t.id);
    });
    const llm = m.threats.filter((t) => t.id === "thr.llm-reinterprets")[0];
    assert.strictEqual(llm.catalog_threat_id, null, id + ": reasoning-LLM threat has no catalog match");
    assert.ok(llm.catalog_note, id + ": the missing match is explained");
  });
  assert.ok(mapped >= 16, "mapped threats: " + mapped);
});
test("Q1: the reasoning-LLM threat is owned by the AI Model Provider (provider side) in every example", () => {
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas", "l2o", "i2r", "q2a", "r2f", "p2f"].forEach((id) => {
    const m = JSON.parse(fs.readFileSync(path.join(DIR, "example-" + id + ".json"), "utf8"));
    const t = m.threats.filter((x) => x.id === "thr.llm-reinterprets")[0];
    assert.strictEqual(t.accountable.persona_id, "srf.role.model-provider", id);
    const target = m.components.filter((c) => c.id === t.target_component_id)[0];
    assert.strictEqual(target.layer, "L5");
    assert.strictEqual(target.owner.persona_id, "srf.role.model-provider", id);
    assert.strictEqual(target.owner.party, "provider", id);
    assert.ok(!TM.gaps(m).some((g) => g.rule === "TM-G06" && g.refs.indexOf("thr.llm-reinterprets") >= 0), id + ": no accountable-versus-owner gap");
  });
});
test("Q5: AI-SaaS example shows the L5 N/A customer case and cascades like the Agent-PaaS version", () => {
  const saas = JSON.parse(fs.readFileSync(path.join(DIR, "example-case-saas.json"), "utf8"));
  const agent = JSON.parse(fs.readFileSync(path.join(DIR, "example-case.json"), "utf8"));
  assert.strictEqual(saas.system.operating_model, "AI-SaaS");
  assert.strictEqual(TM.MATRIX.L5["AI-SaaS"], "N/A");
  assert.deepStrictEqual(JSON.parse(w.document.getElementById("example-data-case-saas").textContent), saas, "embedded equals file");
  const g = TM.gaps(saas).filter((x) => x.rule === "TM-G17" && x.severity === "info");
  assert.ok(g.some((x) => x.refs.indexOf("cmp.reasoning-llm") >= 0), "L5 N/A is reported for the reasoning LLM");
  assert.ok(!TM.gaps(saas).some((x) => x.rule === "TM-G17" && x.severity === "medium"), "no provider owner on a customer-owned layer");
  // the vendor runs L3: every L3 owner is on the provider side
  saas.components.filter((c) => c.layer === "L3").forEach((c) => assert.strictEqual(c.owner.party, "provider", c.id));
  // the customer keeps L1 and its own L2 data
  saas.components.filter((c) => c.layer === "L1").forEach((c) => assert.strictEqual(c.owner.party, "customer", c.id));
  const a = TM.cascade(saas, "cmp.reasoning-llm"), b = TM.cascade(agent, "cmp.reasoning-llm");
  assert.deepStrictEqual(plain(Object.keys(a.nodes).sort()), plain(Object.keys(b.nodes).sort()), "same blast radius; only owners change");
  assert.strictEqual(st(a, "cmp.policy-service"), "not reached");
  assert.strictEqual(st(a, "cmp.step-identity"), "not reached");
  assert.ok(a.byOwner["SaaS vendor app team (placeholder)"], "per-owner view names the vendor");
  w.TM_UI.load(saas);
  w.TM_UI.selectComponent("cmp.reasoning-llm");
  assert.ok(w.document.getElementById("panel").textContent.indexOf("N/A: the SRF matrix gives the customer no duty at this layer under AI-SaaS") >= 0);
  assert.ok(w.document.getElementById("panel").textContent.indexOf("Model cards") >= 0, "L5 evidence help");
  w.TM_UI.load(example);
});
test("exports and example files carry the disclaimer", () => {
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas", "l2o", "i2r", "q2a", "r2f", "p2f"].forEach((id) => {
    const m = JSON.parse(fs.readFileSync(path.join(DIR, "example-" + id + ".json"), "utf8"));
    assert.strictEqual(m.system.disclaimer, TM.DISCLAIMER, id);
    assert.strictEqual(Object.keys(m.system)[0], "disclaimer", id + ": disclaimer is the first system field");
  });
  const h = w.document.querySelector("header.page-hero .draft").textContent;
  assert.strictEqual(h, TM.DISCLAIMER, "header sentence and export sentence match");
  assert.ok(w.document.querySelector("header.page-hero"));
  assert.ok(w.document.querySelector(".page-hero__eyebrow"));
  assert.ok(w.document.querySelector(".page-hero__lede"));
  assert.ok(w.document.querySelector("header.page-hero .callout.callout--warn"));
  assert.ok(w.document.querySelector(".tool-chrome"));
});

const EXAMPLE_SPEC = {
  p2p: {
    overlay: "public-sector", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.agent-requisition", "cmp.agent-sourcing", "cmp.agent-receiving", "cmp.agent-invoice", "cmp.agent-payment"],
    offPathStep: "cmp.step-vendor-eligibility", offPathComp: "cmp.vendor-risk",
    process: "cmp.p2p-process", logic: "cmp.p2p-logic",
    lowered: ["cmp.agent-invoice", "cmp.agent-payment"],
    loweredSteps: ["cmp.step-invoice-match", "cmp.step-payment"]
  },
  h2r: {
    overlay: "employment", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.agent-sourcing", "cmp.agent-screening", "cmp.agent-offer", "cmp.agent-onboarding", "cmp.agent-offboarding"],
    offPathStep: "cmp.step-background", offPathComp: "cmp.background-check",
    process: "cmp.h2r-process", logic: "cmp.h2r-logic",
    lowered: ["cmp.agent-offer", "cmp.agent-offboarding"],
    loweredSteps: ["cmp.step-offer", "cmp.step-offboarding"]
  },
  r2r: {
    overlay: "sox", overlayThreats: 2, overlayObls: 3, reachedWorst: 20,
    agents: ["cmp.agent-journal", "cmp.agent-recon", "cmp.agent-adjustments", "cmp.agent-consolidation", "cmp.agent-reporting"],
    offPathStep: "cmp.step-anomaly", offPathComp: "cmp.anomaly-detect",
    process: "cmp.r2r-process", logic: "cmp.r2r-logic",
    lowered: ["cmp.agent-adjustments", "cmp.agent-reporting"],
    loweredSteps: ["cmp.step-adjustments", "cmp.step-reporting"]
  },
  case: {
    overlay: "consumer-protection", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.agent-intake", "cmp.agent-triage", "cmp.agent-investigate", "cmp.agent-resolve", "cmp.agent-escalate"],
    offPathStep: "cmp.step-identity", offPathComp: "cmp.id-verify",
    process: "cmp.case-process", logic: "cmp.case-logic",
    lowered: ["cmp.agent-resolve", "cmp.agent-escalate"],
    loweredSteps: ["cmp.step-resolve", "cmp.step-escalate"]
  },
  l2o: {
    overlay: "marketing-consent", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.l2o-agent-capture", "cmp.l2o-agent-qualify", "cmp.l2o-agent-proposal", "cmp.l2o-agent-quote", "cmp.l2o-agent-handoff"],
    offPathStep: "cmp.l2o-step-consent", offPathComp: "cmp.l2o-consent-check",
    process: "cmp.l2o-process", logic: "cmp.l2o-logic",
    lowered: ["cmp.l2o-agent-quote", "cmp.l2o-agent-handoff"],
    loweredSteps: ["cmp.l2o-step-quote", "cmp.l2o-step-handoff"]
  },
  i2r: {
    overlay: "customer-notice", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.i2r-agent-report", "cmp.i2r-agent-classify", "cmp.i2r-agent-diagnose", "cmp.i2r-agent-restore", "cmp.i2r-agent-notice"],
    offPathStep: "cmp.i2r-step-safety", offPathComp: "cmp.i2r-safety-score",
    process: "cmp.i2r-process", logic: "cmp.i2r-logic",
    lowered: ["cmp.i2r-agent-restore", "cmp.i2r-agent-notice"],
    loweredSteps: ["cmp.i2r-step-restore", "cmp.i2r-step-notice"]
  },
  q2a: {
    overlay: "retrieval-limits", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.q2a-agent-ask", "cmp.q2a-agent-retrieve", "cmp.q2a-agent-draft", "cmp.q2a-agent-cite", "cmp.q2a-agent-handoff"],
    offPathStep: "cmp.q2a-step-entitlement", offPathComp: "cmp.q2a-entitlement",
    process: "cmp.q2a-process", logic: "cmp.q2a-logic",
    lowered: ["cmp.q2a-agent-cite", "cmp.q2a-agent-handoff"],
    loweredSteps: ["cmp.q2a-step-cite", "cmp.q2a-step-handoff"]
  },
  r2f: {
    overlay: "privileged-access", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.r2f-agent-request", "cmp.r2f-agent-classify", "cmp.r2f-agent-plan", "cmp.r2f-agent-fulfill", "cmp.r2f-agent-exception"],
    offPathStep: "cmp.r2f-step-entitlement", offPathComp: "cmp.r2f-entitlement-score",
    process: "cmp.r2f-process", logic: "cmp.r2f-logic",
    lowered: ["cmp.r2f-agent-fulfill", "cmp.r2f-agent-exception"],
    loweredSteps: ["cmp.r2f-step-fulfill", "cmp.r2f-step-exception"]
  },
  p2f: {
    overlay: "product-hold", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.p2f-agent-demand", "cmp.p2f-agent-allocate", "cmp.p2f-agent-replenish", "cmp.p2f-agent-release", "cmp.p2f-agent-exception"],
    offPathStep: "cmp.p2f-step-eligibility", offPathComp: "cmp.p2f-lot-check",
    process: "cmp.p2f-process", logic: "cmp.p2f-logic",
    lowered: ["cmp.p2f-agent-release", "cmp.p2f-agent-exception"],
    loweredSteps: ["cmp.p2f-step-release", "cmp.p2f-step-exception"]
  }
};

["p2p", "h2r", "r2r", "case", "l2o", "i2r", "q2a", "r2f", "p2f"].forEach((exId) => {
  const spec = EXAMPLE_SPEC[exId];
  const ex = JSON.parse(fs.readFileSync(path.join(DIR, "example-" + exId + ".json"), "utf8"));
  test(exId + ": reasoning LLM failure reaches the orchestrator and sub-agents, not the policy service or the step kept off the model path", () => {
    const r = TM.cascade(ex, "cmp.reasoning-llm");
    assert.strictEqual(st(r, "cmp.llm-gateway"), "failed");
    assert.strictEqual(st(r, "cmp.orchestrator"), "failed");
    spec.agents.forEach((id) => assert.strictEqual(st(r, id), "failed", id));
    assert.strictEqual(st(r, spec.logic), "impacted");
    assert.strictEqual(st(r, spec.process), "impacted");
    assert.strictEqual(r.nodes[spec.process].rollup, true);
    assert.strictEqual(st(r, "cmp.policy-service"), "not reached");
    assert.strictEqual(st(r, spec.offPathStep), "not reached");
    assert.strictEqual(st(r, spec.offPathComp), "not reached");
    assert.strictEqual(st(r, "cmp.site-edge"), "failed");
    assert.strictEqual(st(r, "cmp.site-network"), "not reached");
    assert.strictEqual(r.reached.length, spec.reachedWorst);
  });
  test(exId + ": with controls in place, a control lowers failed to impacted and does not stop the cascade", () => {
    const worst = TM.cascade(ex, "cmp.reasoning-llm");
    const r = TM.cascade(ex, "cmp.reasoning-llm", { mode: "controls" });
    assert.deepStrictEqual(plain(r.lowered.map((c) => c.to).sort()), spec.lowered.slice().sort());
    spec.lowered.forEach((id) => assert.strictEqual(st(r, id), "impacted", id));
    spec.loweredSteps.forEach((id) => assert.strictEqual(st(r, id), "not reached", id));
    assert.ok(r.reached.length < worst.reached.length);
  });
  test(exId + ": gap checks run without errors", () => {
    const g = TM.gaps(ex);
    const high = g.filter((x) => x.severity === "high");
    assert.deepStrictEqual(plain(high.map((x) => x.rule + ": " + x.message)), []);
    assert.ok(!g.some((x) => x.rule === "TM-G08"), "no dangling references");
    assert.ok(ex.controls.every((c) => !/^Required/.test(TM.controlStatus(ex, c.id).label)), "nothing Required");
    assert.ok(ex.obligations.every((o) => o.verification && o.verification.status === "unverified"));
    assert.ok(ex.components.filter((c) => c.owner && c.owner.status === "assigned").every((c) => c.owner.placeholder));
    assert.ok(ex.components.every((c) => c.owner && c.owner.status === "assigned" && !c.owner.names), "one assigned owner");
    ex.components.filter((c) => c.layer === "L1" && c.type === "process_step" && c.owner && c.owner.status === "assigned")
      .forEach((c) => assert.strictEqual(c.owner.persona_id, "srf.role.ai-system-governance", c.id));
  });
  test(exId + ": vertical overlay is off by default and adds its threats when enabled", () => {
    assert.ok(!TM.active(ex).threats.some((t) => t.vertical === spec.overlay));
    const m = clone(ex); m.system.overlays_enabled = [spec.overlay];
    assert.strictEqual(TM.active(m).threats.filter((t) => t.vertical === spec.overlay).length, spec.overlayThreats);
    assert.strictEqual(TM.active(m).obligations.filter((o) => o.vertical === spec.overlay).length, spec.overlayObls);
  });
});

test("new examples store the fact-checked APQC rows, and the six older examples do not", () => {
  const read = (id) => JSON.parse(fs.readFileSync(path.join(DIR, "example-" + id + ".json"), "utf8"));
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas"].forEach((id) => {
    assert.ok(!read(id).system.apqc_pcf, id + " has no APQC field");
  });
  function rows(id) { return read(id).system.apqc_pcf; }
  function key(r) { return r.number + "/" + (r.element_id || "") + "/" + r.version + "/" + r.match; }
  const expect = {
    l2o: [
      "3.0//v8.0/clean", "3.3/20008/v8.0/clean", "3.5/10105/v8.0/clean",
      "3.5.1/10182/v8.0/clean", "3.5.3/11779/v8.0/clean", "3.5.4/10185/v8.0/clean"
    ],
    i2r: [
      "6.0//v8.0/partial", "6.2/10379/v8.0/partial", "6.2.2/10388/v8.0/partial",
      "6.2.3/10389/v8.0/partial", "6.2.5/12840/v8.0/partial"
    ],
    q2a: [
      "13.5/11073/v7.4/none", "13.5.1/11095/v8.0/none", "13.5.2/11096/v8.0/none",
      "13.5.3/20965/v8.0/none", "13.5.4/20969/v8.0/none", "8.4.4/20779/v8.0/none",
      "8.7.5.3/20898/v8.0/none", "6.2.2/10388/v8.0/none", "7.7.2/10523/v8.0/none"
    ],
    r2f: [
      "8.0//v8.0/partial", "8.1/20608/v8.0/partial", "8.1.5.3/20635/v8.0/partial",
      "8.3.8.3/20759/v8.0/partial", "8.7.8.3/20925/v8.0/partial"
    ],
    p2f: [
      "4.0//v8.0/partial", "4.1/10215/v7.4/partial", "4.2/10216/v7.4/partial",
      "4.3/10217/v7.4/partial", "4.4/10219/v7.4/partial", "4.4.5/21617/v8.0/partial"
    ]
  };
  Object.keys(expect).forEach((id) => {
    assert.deepStrictEqual(rows(id).map(key), expect[id], id);
    rows(id).forEach((r) => assert.ok(r.name && r.note !== "", id + " " + r.number));
  });
  const handoff = rows("l2o").filter((r) => r.number === "3.5.4")[0];
  assert.ok(/one owner/.test(handoff.note) && /Sales operations owner/.test(handoff.note));
  const l2o = read("l2o");
  const step = l2o.components.filter((c) => c.id === "cmp.l2o-step-handoff")[0];
  assert.strictEqual(step.owner.status, "assigned");
  assert.strictEqual(step.owner.name, "Sales operations owner (placeholder)");
  assert.ok(/same elements that fit Case to Resolution/.test(rows("i2r")[0].note));
  const p43 = rows("p2f").filter((r) => r.number === "4.3")[0];
  assert.strictEqual(p43.name, "Produce/Assemble/Test product");
  assert.strictEqual(p43.version, "v7.4");
  const q = read("q2a");
  assert.strictEqual(q.system.operating_model, "AI-SaaS");
  assert.ok(q.components.filter((c) => c.layer === "L3").every((c) => c.owner.party === "provider"));
  assert.ok(q.components.filter((c) => c.layer === "L1").every((c) => c.owner.party === "customer"));
  assert.ok(!q.components.some((c) => c.id === "cmp.case-process"));
  const g = TM.gaps(q).filter((x) => x.rule === "TM-G17");
  assert.ok(g.some((x) => x.severity === "info" && x.refs.indexOf("cmp.reasoning-llm") >= 0));
  assert.ok(!g.some((x) => x.severity === "medium"));
});

function generatedStatuses(model) {
  const bad = [];
  const see = (label, rec) => {
    if (!rec || typeof rec !== "object") return;
    ["record_status", "catalog_match_status"].forEach((k) => {
      if (rec[k] === "verified") bad.push(label + " " + k);
      if (rec[k] && rec[k] !== "proposed" && rec[k] !== "placeholder") bad.push(label + " " + k + "=" + rec[k]);
    });
    if (rec.review_status === "approved") bad.push(label + " review approved");
    if (rec.verification && rec.verification.status && rec.verification.status !== "unverified") bad.push(label + " verification");
  };
  model.components.forEach((c) => {
    see(c.id + " owner", c.owner);
    if (!c.owner || (c.owner.record_status !== "placeholder" && c.owner.record_status !== "proposed")) bad.push(c.id + " owner status");
  });
  model.relationships.forEach((r) => {
    see(r.id, r);
    if (r.record_status !== "placeholder" && r.record_status !== "proposed") bad.push(r.id + " link status");
  });
  (model.obligations || []).forEach((o) => see(o.id, o));
  (model.controls || []).forEach((c) => {
    see(c.id, c);
    if (c.record_status !== "placeholder" && c.record_status !== "proposed") bad.push(c.id + " control status");
    (c.obligation_links || []).forEach((l) => see(c.id, l));
  });
  (model.threats || []).forEach((t) => {
    see(t.id, t.accountable);
    if (t.catalog_match_status) see(t.id + " match", { catalog_match_status: t.catalog_match_status });
    if (t.business_response_owner) see(t.id + " response", t.business_response_owner);
    (t.control_ids || []).forEach(() => bad.push(t.id + " has a threat-to-control link"));
  });
  return bad;
}

function assertScopedShape(m, layer) {
  assert.strictEqual(m.system.assessment_mode, "scoped");
  assert.strictEqual(m.system.assessment_layer, layer);
  assert.ok(m.components.some((c) => c.edge_actor), "has an edge actor");
  assert.ok(m.components.some((c) => !c.edge_actor), "has an in-layer component");
  m.components.forEach((c) => {
    assert.notStrictEqual(c.layer, "L1", c.id);
    assert.notStrictEqual(c.layer, "L3", c.id);
    assert.notStrictEqual(c.layer, "L4", c.id);
    if (c.edge_actor) {
      assert.ok(["reads", "writes", "supplies", "consumes"].indexOf(c.edge_verb) >= 0, c.id);
    } else {
      assert.strictEqual(c.layer, layer, c.id);
    }
  });
  assert.strictEqual(m.relationships.length, 0, "no relationship links");
  m.relationships.forEach((r) => {
    assert.notStrictEqual(r.type, "realization");
    assert.ok(!r.cascade);
  });
  (m.edge_links || []).forEach((e) => {
    assert.notStrictEqual(e.verb, "realization");
    assert.ok(!e.cascade);
    assert.notStrictEqual(e.record_status, "verified");
  });
  m.controls.forEach((c) => {
    assert.strictEqual(TM.controlOwnerCount(c), 1, c.id);
    assert.ok(c.party === "customer" || c.party === "provider", c.id);
    assert.notStrictEqual(c.record_status, "verified", c.id);
    assert.notStrictEqual(TM.statusWord(c), "Verified", c.id);
    assert.notStrictEqual(TM.statusWord(c.accountable), "Verified", c.id);
  });
  const stages = layer === "L5" ? TM.L5_STAGES : TM.L2_STAGES;
  assert.deepStrictEqual(m.layer_results.map((r) => r.lifecycle_stage), stages);
}

test("scoped L2 and L5 models stay on that layer, name one owner per control, and do not cascade", () => {
  const cat = JSON.parse(fs.readFileSync(path.join(DIR, "..", "..", "data", "threats.json"), "utf8"));
  const matrix = JSON.parse(fs.readFileSync(path.join(DIR, "..", "..", "data", "matrix.json"), "utf8"));
  const ids = {};
  cat.threats.forEach((t) => { ids[t.id] = t; });
  ["L2", "L5"].forEach((layer) => {
    ["AI-SaaS", "AI-PaaS", "Agent-PaaS", "IaaS"].forEach((om) => {
      assert.deepStrictEqual(plain(TM.SRF_CELLS[layer][om]), {
        customer: matrix.cells[layer][om].customer,
        provider: matrix.cells[layer][om].provider
      }, layer + " " + om);
    });
    assert.ok(!matrix.cells[layer]["Federated-Consortium"] || !TM.SRF_CELLS[layer]["Federated-Consortium"]);
  });
  const l2 = TM.scopedModel("L2", "Agent-PaaS");
  const l5 = TM.scopedModel("L5", "Agent-PaaS");
  const saas = TM.scopedModel("L5", "AI-SaaS");
  [l2, l5, saas].forEach((m) => {
    assert.strictEqual(m.tm_schema_version, "0.1.0-draft");
    assert.ok(TM.OPERATING_MODELS.indexOf(m.system.operating_model) >= 0);
    assert.deepStrictEqual(generatedStatuses(m), []);
    assertScopedShape(m, m.system.assessment_layer);
    m.threats.forEach((t) => {
      assert.ok(t.catalog_threat_id, t.id + " needs a catalog id");
      assert.ok(ids[t.catalog_threat_id], t.catalog_threat_id);
      assert.strictEqual(t.control_ids.length, 0);
      assert.notStrictEqual(t.catalog_match_status, "verified");
    });
    m.layer_results.forEach((row) => {
      if (row.catalog_threat_id) assert.ok(ids[row.catalog_threat_id], row.catalog_threat_id);
      assert.notStrictEqual(row.status, "verified");
      if (row.control_id) {
        const ctl = m.controls.filter((c) => c.id === row.control_id)[0];
        assert.ok(ctl, row.control_id);
        assert.strictEqual(row.party, ctl.party);
      }
    });
    const reached = TM.cascade(m, m.components[0].id);
    assert.strictEqual(reached.reached.length, 1, "cascade does not leave the seeded component");
  });
  assert.ok(l2.components.some((c) => c.type === "retrieval_corpus"));
  assert.ok(l2.components.some((c) => c.type === "vector_index"));
  assert.ok(!l2.components.some((c) => c.type === "sub_agent" || c.type === "business_process"));
  const pageCtl = l2.controls.filter((c) => c.id === "ctl.approved-pages")[0];
  assert.strictEqual(pageCtl.catalog_control_id, "controlRetrievalAndVectorSystemIntegrity");
  assert.strictEqual(pageCtl.party, "customer");
  assert.strictEqual(pageCtl.matrix_customer, "shared");
  assert.strictEqual(pageCtl.matrix_provider, "provider-managed");
  const l2threat = l2.threats.filter((t) => t.catalog_threat_id === "dsgai21")[0];
  const want = [];
  const entry = ids.dsgai21;
  if (entry.ai_exchange) want.push({ source: "owasp_ai_exchange", id: entry.id, url: entry.ai_exchange });
  ["owasp_llm_top10", "mitre_atlas", "owasp_dsgai", "biml_llm24"].forEach((k) => { if (entry.mappings[k]) want.push({ source: k, id: entry.mappings[k] }); });
  assert.deepStrictEqual(plain(l2threat.external_refs), want);
  const retrieve = l2.layer_results.filter((r) => r.lifecycle_stage === "retrieve")[0];
  assert.strictEqual(retrieve.status, "proposed");
  assert.strictEqual(retrieve.catalog_threat_id, "dsgai21");
  assert.strictEqual(retrieve.risk_map_id, "riskRetrievalVectorStorePoisoning");
  assert.strictEqual(retrieve.risk_map_status, "proposed");
  assert.ok(l5.components.some((c) => c.type === "base_weights" && c.locus === "external"));
  assert.ok(l5.components.some((c) => c.type === "tuned_weights"));
  assert.ok(l5.components.some((c) => c.type === "model_version"));
  assert.ok(l5.components.some((c) => c.type === "model_card"));
  assert.ok(l5.components.some((c) => c.type === "evaluation"));
  assert.ok(l5.components.some((c) => c.type === "model_registry"));
  assert.ok(l5.edge_links.some((e) => e.verb === "supplies" || e.verb === "consumes" || e.verb === "reads" || e.verb === "writes"));
  const registry = l5.controls.filter((c) => c.id === "ctl.safetensors")[0];
  assert.strictEqual(registry.party, "customer");
  assert.strictEqual(registry.catalog_control_id, "controlModelRegistryIntegrity");
  assert.notStrictEqual(registry.component_id, "cmp.base-weights");
  const retire = l5.layer_results.filter((r) => r.lifecycle_stage === "retire")[0];
  assert.strictEqual(retire.status, "placeholder");
  assert.strictEqual(retire.catalog_threat_id, null);
  assert.ok(/Placeholder, not Proposed/.test(retire.note));
  const silent = l5.scope_notes.filter((n) => n.id === "silent-version-change")[0];
  assert.strictEqual(silent.status, "placeholder");
  const loader = l5.scope_notes.filter((n) => n.id === "riskMaliciousLoaderDeserialization")[0];
  assert.strictEqual(loader.status, "proposed");
  assert.ok(!l5.threats.some((t) => t.catalog_threat_id === "riskMaliciousLoaderDeserialization"));
  const pin = saas.controls.filter((c) => c.id === "ctl.pin-version")[0];
  assert.strictEqual(pin.party, "provider");
  assert.strictEqual(pin.attestation_note, TM.ATTESTATION_NOTE);
  assert.ok(!/SOC|ISO|FedRAMP/.test(pin.attestation_note));
  const saasRow = saas.layer_results.filter((r) => r.lifecycle_stage === "update or version")[0];
  assert.strictEqual(saasRow.party, "provider");
  assert.strictEqual(saasRow.attestation_note, TM.ATTESTATION_NOTE);
  assert.strictEqual(saasRow.status, "placeholder");
  const yaml = TM.toYAML(l2);
  const again = JSON.parse(JSON.stringify(l2));
  assert.strictEqual(again.layer_results[4].party, l2.layer_results[4].party);
  assert.ok(yaml.indexOf("party: customer") >= 0);
  assert.ok(yaml.indexOf("assessment_mode: scoped") >= 0);
  fs.writeFileSync(path.join(__dirname, "out-scoped-l2.json"), JSON.stringify(l2));
  fs.writeFileSync(path.join(__dirname, "out-scoped-l5.json"), JSON.stringify(l5));
  fs.writeFileSync(path.join(__dirname, "out-scoped-l5-saas.json"), JSON.stringify(saas));
});

function uiTests() {
// ---------- UI ----------
const $ = (id) => w.document.getElementById(id);
test("example picker lists eleven examples, defaults to O2C, and loads the others", () => {
  const sel = w.document.getElementById("example-pick");
  assert.strictEqual(sel.options.length, 11);
  assert.ok(Array.prototype.some.call(sel.options, (o) => o.value === "case-saas"), "AI-SaaS case example in the picker");
  assert.ok(Array.prototype.some.call(sel.options, (o) => o.value === "q2a"), "Question to Answer in the picker");
  assert.strictEqual(sel.value, "o2c");
  assert.strictEqual(w.document.getElementById("sys-name").textContent, example.system.name);
  sel.value = "p2p";
  sel.dispatchEvent(new w.Event("change"));
  assert.ok(/Procure to Pay/.test(w.document.getElementById("sys-name").textContent));
  assert.ok(w.document.querySelector('#overlay-controls input[data-overlay="public-sector"]'));
  sel.value = "o2c";
  sel.dispatchEvent(new w.Event("change"));
  assert.strictEqual(w.document.getElementById("sys-name").textContent, example.system.name);
  assert.ok(w.document.querySelector('#overlay-controls input[data-overlay="banking"]'));
});

test("UI: APQC rows show version and match quality, and partial or none is not called exact", () => {
  const read = (id) => JSON.parse(fs.readFileSync(path.join(DIR, "example-" + id + ".json"), "utf8"));
  w.TM_UI.load(read("q2a"));
  w.document.querySelector('.tab[data-tab="details"]').click();
  const qText = $("apqc-pcf").textContent;
  assert.ok(qText.indexOf("13.5 / 11073 / v7.4") >= 0, qText);
  assert.ok(qText.indexOf("No match") >= 0);
  assert.ok(qText.indexOf("Clean match") < 0);
  assert.ok(qText.indexOf("Partial match, not exact") < 0);
  w.TM_UI.load(read("i2r"));
  w.document.querySelector('.tab[data-tab="details"]').click();
  const iText = $("apqc-pcf").textContent;
  assert.ok(iText.indexOf("Partial match, not exact") >= 0);
  assert.ok(iText.indexOf("Same PCF element as Case to Resolution") >= 0);
  assert.ok(iText.indexOf("Clean match") < 0);
  w.TM_UI.load(read("l2o"));
  w.TM_UI.selectComponent("cmp.l2o-process");
  const lText = $("apqc-pcf").textContent;
  assert.ok(lText.indexOf("3.5.4 / 10185 / v8.0") >= 0);
  assert.ok(lText.indexOf("Clean match") >= 0);
  assert.ok(lText.indexOf("Partial match") < 0);
  w.TM_UI.load(read("p2f"));
  w.document.querySelector('.tab[data-tab="details"]').click();
  const pText = $("apqc-pcf").textContent;
  assert.ok(pText.indexOf("4.3 / 10217 / v7.4") >= 0);
  assert.ok(pText.indexOf("Produce/Assemble/Test product") >= 0);
  assert.ok(pText.indexOf("produce/manufacture/deliver") < 0);
  w.TM_UI.load(example);
  w.document.querySelector('.tab[data-tab="details"]').click();
  assert.ok(!$("apqc-pcf"), "O2C has no APQC list");
});

test("UI: graph renders one node per active component", () => {
  assert.strictEqual(w.document.querySelectorAll("#graph .node").length, TM.active(example).components.length);
});
test("UI: clicking a node selects it and the Cascade tab shows per-layer and per-owner tables", () => {
  const node = w.document.querySelector('#graph .node[data-id="cmp.reasoning-llm"]');
  node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  w.document.querySelector('.tab[data-tab="cascade"]').click();
  assert.ok($("cascade-by-layer"), "by-layer table");
  assert.ok($("cascade-by-owner").textContent.indexOf("No owner") >= 0);
  assert.ok($("cascade-paths").children.length >= 15);
  const failedNodes = w.document.querySelectorAll('#graph .node rect[fill="#fecaca"]').length;
  assert.ok(failedNodes >= 8, "failed nodes highlighted: " + failedNodes);
});
test("UI: mode switch shows components lowered by controls", () => {
  $("mode").value = "controls"; $("mode").dispatchEvent(new w.Event("change"));
  assert.ok($("cascade-lowered") && $("cascade-lowered").children.length === 2);
  assert.ok($("cascade-stakeholders").children.length >= 1);
  $("mode").value = "worst"; $("mode").dispatchEvent(new w.Event("change"));
});
test("UI: selecting a threat shows the ROCA chain and its stakeholders", () => {
  w.TM_UI.selectThreat("thr.collections-abuse");
  assert.ok($("roca").textContent.indexOf("Consumer debtors") >= 0);
  assert.ok($("roca").textContent.indexOf("Not personas and not owners") >= 0);
  w.TM_UI.selectThreat("thr.llm-reinterprets");
  assert.ok($("roca").textContent.indexOf("A: Accountable") >= 0);
  assert.ok($("roca").textContent.indexOf("Unverified, needs counsel") >= 0, "per-obligation counsel label");
  assert.ok($("roca").textContent.indexOf("Model vendor (placeholder)") >= 0 && $("roca").textContent.indexOf("AI Model Provider") >= 0, "Q1: AI Model Provider is accountable");
  assert.ok($("roca").textContent.indexOf("No match in /data/threats.json") >= 0, "no catalog match is stated");
  assert.strictEqual($("threats-disclaimer").textContent, TM.DISCLAIMER, "Threats tab footer disclaimer");
  w.TM_UI.selectThreat("thr.master-data-poison");
  assert.ok($("roca").textContent.indexOf("dsgai05") >= 0 && $("catalog-refs").textContent.indexOf("DSGAI05") >= 0);
});
test("UI: every obligation in the Threats tab carries the counsel label, and no citation is filled", () => {
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas", "l2o", "i2r", "q2a", "r2f", "p2f"].forEach((id) => {
    const m = JSON.parse(w.document.getElementById(id === "o2c" ? "example-data" : "example-data-" + id).textContent);
    m.obligations.forEach((o) => { assert.strictEqual(o.verification.status, "unverified", id + " " + o.id); assert.ok(!o.citation, id + " " + o.id + " citation stays empty"); });
  });
  w.TM_UI.load(example);
  w.TM_UI.selectThreat("thr.spoofed-po");
  const pills = w.document.querySelectorAll("#roca .pill.counsel").length;
  const obls = TM.active(example).threats.filter((t) => t.id === "thr.spoofed-po")[0].obligation_ids.length;
  assert.strictEqual(pills, obls);
});
test("UI: list view shows every component as text, L1 at the top down to L5", () => {
  w.TM_UI.load(example);
  $("view-toggle").click();
  assert.strictEqual($("view-toggle").getAttribute("aria-pressed"), "true");
  const rows = w.document.querySelectorAll("#list-view button[data-lv]");
  assert.strictEqual(rows.length, TM.active(example).components.length);
  const heads = Array.prototype.map.call(w.document.querySelectorAll("#list-view h2"), (h) => h.textContent.slice(0, 2));
  assert.deepStrictEqual(heads, ["L1", "L2", "L3", "L4", "L5"]);
  w.document.querySelector('#list-view button[data-lv="cmp.reasoning-llm"]').click();
  assert.strictEqual(w.TM_STATE.selected, "cmp.reasoning-llm");
  $("view-toggle").click();
  assert.ok(w.document.getElementById("graph-svg"), "back to the graph");
});
test("UI: graph accessibility: the SVG is a group, and each node's name starts with its visible text", () => {
  w.TM_UI.load(example);
  w.TM_UI.selectComponent("cmp.reasoning-llm");
  const svg = w.document.getElementById("graph-svg");
  assert.notStrictEqual(svg.getAttribute("role"), "img");
  Array.prototype.forEach.call(w.document.querySelectorAll("#graph .node"), (g) => {
    const vis = Array.prototype.map.call(g.querySelectorAll("text"), (t) => t.childNodes[0] ? t.childNodes[0].textContent : "").join(" ");
    assert.ok(g.getAttribute("aria-label").indexOf(vis) === 0, g.getAttribute("data-id") + ": " + g.getAttribute("aria-label") + " / " + vis);
  });
});
test("UI: link filters use the plain reading, with the ArchiMate term in the tooltip; ROCA glossary shown", () => {
  const lab = w.document.querySelector('#rel-filters input[data-rel="realization"]').closest("label");
  assert.ok(lab.textContent.indexOf(TM.REL_INFO.realization.plain) >= 0);
  assert.strictEqual(lab.getAttribute("title"), "ArchiMate term: realization");
  assert.strictEqual($("glossary").textContent, "ROCA = Risk, Obligation, Control, Accountable.");
  assert.strictEqual($("glossary").getAttribute("title"), null);
  assert.strictEqual($("filter-hint").textContent, "Hover a filter for its ArchiMate term.");
  assert.ok($("filter-hint").getAttribute("title").indexOf("ArchiMate") >= 0);
  assert.ok($("glossary").textContent.indexOf("ArchiMate") < 0);
});
test("UI: hovering or focusing a filter shows the ArchiMate term outside the clipped row", () => {
  const over = (el) => el.dispatchEvent(new w.MouseEvent("mouseover", { bubbles: true }));
  const out = (el, to) => el.dispatchEvent(new w.MouseEvent("mouseout", { bubbles: true, relatedTarget: to || w.document.body }));
  const lab = w.document.querySelector('#rel-filters input[data-rel="realization"]').closest("label");
  const tip = $("rel-tip");
  assert.ok(tip, "fixed tip element");
  assert.strictEqual(tip.getAttribute("role"), "tooltip");
  assert.strictEqual(tip.hidden, true);
  over(lab.querySelector("line"));
  assert.strictEqual(tip.hidden, false);
  assert.strictEqual(tip.textContent, "ArchiMate term: realization");
  assert.strictEqual(lab.getAttribute("title"), null, "native title is held aside while the tip is open");
  assert.strictEqual(lab.getAttribute("aria-describedby"), "rel-tip");
  const next = w.document.querySelector('#rel-filters input[data-rel="serving"]').closest("label");
  out(lab, next);
  over(next);
  assert.strictEqual(tip.textContent, "ArchiMate term: serving");
  assert.strictEqual(lab.getAttribute("title"), "ArchiMate term: realization");
  out(next);
  assert.strictEqual(tip.hidden, true);
  assert.strictEqual(next.getAttribute("title"), "ArchiMate term: serving");
  const gloss = $("glossary");
  over(gloss);
  assert.strictEqual(tip.hidden, true, "the ROCA line has no ArchiMate tip");
  const hint = $("filter-hint");
  over(hint);
  assert.ok(tip.textContent.indexOf("November 18, 2026") >= 0);
  assert.ok(tip.textContent.indexOf("plain reading") >= 0);
  assert.ok(tip.textContent.indexOf("ROCA") < 0);
  out(hint);
  assert.ok((hint.getAttribute("title") || "").indexOf("November 18, 2026") >= 0);
  const parent = Array.prototype.find.call(w.document.querySelectorAll("#rel-filters > .muted"), (el) => el.textContent.indexOf("Parent-child") === 0);
  over(parent);
  assert.ok(tip.textContent.indexOf("part to its whole") >= 0);
  out(parent);
  const input = lab.querySelector("input");
  input.focus();
  assert.strictEqual(tip.textContent, "ArchiMate term: realization");
  assert.strictEqual(input.getAttribute("aria-describedby"), "rel-tip");
  input.blur();
  assert.strictEqual(tip.hidden, true);
  assert.strictEqual(lab.getAttribute("title"), "ArchiMate term: realization");
  assert.strictEqual(input.getAttribute("aria-describedby"), null);
  over(lab);
  $("view-toggle").click();
  assert.strictEqual(tip.hidden, true);
  assert.strictEqual(lab.getAttribute("title"), "ArchiMate term: realization");
  $("view-toggle").click();
});
test("UI: gap table lists every finding; overlay toggle changes the model", () => {
  w.document.querySelector('.tab[data-tab="gaps"]').click();
  assert.strictEqual($("gap-table").querySelectorAll("tr").length - 1, TM.gaps(w.TM_STATE.model).length);
  const toggle = (id, on) => {
    const ov = w.document.querySelector('#overlay-controls input[data-overlay="' + id + '"]');
    assert.ok(ov, id + " overlay toggle");
    ov.checked = on; ov.dispatchEvent(new w.Event("change"));
  };
  toggle("banking", true);
  assert.deepStrictEqual(plain(w.TM_STATE.model.system.overlays_enabled), ["banking"]);
  toggle("banking", false);
});
test("UI: ownership overlay fills zero-owner and shared-owner components red", () => {
  w.TM_UI.state.selected = null; w.TM_UI.state.selectedThreat = null;
  $("owner-ov").checked = true; $("owner-ov").dispatchEvent(new w.Event("change"));
  const fill = (id) => w.document.querySelector('#graph .node[data-id="' + id + '"] rect').getAttribute("fill");
  assert.strictEqual(fill("cmp.cash-matching"), "#fee2e2");     // zero owners
  assert.strictEqual(fill("cmp.step-fulfillment"), "#fee2e2");   // two owners (shared)
  assert.notStrictEqual(fill("cmp.orchestrator"), "#fee2e2");
  $("owner-ov").checked = false; $("owner-ov").dispatchEvent(new w.Event("change"));
});
test("UI: data flow tab and snapshot selector", () => {
  w.document.querySelector('.tab[data-tab="dataflow"]').click();
  assert.ok($("df-matrix") && $("df-moves").querySelectorAll("tr").length - 1 === TM.dataFlows(w.TM_STATE.model).moves.length);
  $("df-graph").click();
  const edges = Array.prototype.map.call(w.document.querySelectorAll("#graph path.edge"), (p) => p.getAttribute("data-rel"));
  const types = new Set(edges.map((id) => (w.TM_STATE.model.relationships.find((r) => r.id === id) || {}).type));
  assert.deepStrictEqual(plain([...types].sort()), ["access", "flow"]);
  $("df-all").click();
  const before = TM.gaps(w.TM_STATE.model).length;
  $("snap").value = "snap.dec01"; $("snap").dispatchEvent(new w.Event("change"));
  assert.strictEqual(w.TM_STATE.model.system.snapshot_id, "snap.dec01");
  assert.ok(TM.gaps(w.TM_STATE.model).length < before);
  $("snap").value = ""; $("snap").dispatchEvent(new w.Event("change"));
});
test("UI: add a component and a relationship through the Edit forms", () => {
  w.document.querySelector('.tab[data-tab="edit"]').click();
  const fc = $("f-comp");
  fc.querySelector('[name="id"]').value = "cmp.test-tool";
  fc.querySelector('[name="name"]').value = "Test tool";
  fc.querySelector('[name="layer"]').value = "L3";
  fc.querySelector('[name="ostatus"]').value = "none";
  fc.dispatchEvent(new w.Event("submit", { cancelable: true }));
  assert.ok(w.TM_STATE.model.components.some((c) => c.id === "cmp.test-tool"));
  const fr = $("f-rel");
  fr.querySelector('[name="from"]').value = "cmp.test-tool";
  fr.querySelector('[name="type"]').value = "serving";
  fr.querySelector('[name="to"]').value = "cmp.orchestrator";
  fr.dispatchEvent(new w.Event("submit", { cancelable: true }));
  const r = w.TM.cascade(w.TM_STATE.model, "cmp.test-tool");
  assert.strictEqual(r.nodes["cmp.orchestrator"].state, "failed");
  assert.ok(w.TM.gaps(w.TM_STATE.model).some((g) => g.rule === "TM-G01" && g.refs[0] === "cmp.test-tool"));
});
test("UI: export JSON and YAML", () => {
  w.TM_UI.load(example);
  w.document.querySelector('.tab[data-tab="export"]').click();
  $("exp-json").click();
  assert.deepStrictEqual(JSON.parse($("export-text").value), example);
  $("exp-yaml").click();
  const y = $("export-text").value;
  assert.ok(y.indexOf("# " + TM.DISCLAIMER + "\ntm_schema_version: 0.1.0-draft") === 0, "YAML export starts with the disclaimer");
  fs.writeFileSync(path.join(__dirname, "out-export.yaml"), y);
  fs.writeFileSync(path.join(__dirname, "out-export.json"), w.TM_EXPORT("json"));
});

test("UI: derived link drawn with its own style; default multiplicity table on the Gaps tab", () => {
  w.TM_UI.load(example);
  const p = w.document.querySelector('#graph path.edge[data-rel="rel.d1"]');
  assert.ok(p && p.getAttribute("stroke") === "#94a3b8");
  assert.ok($("rel-filters").textContent.indexOf("Parent-child") >= 0 && $("rel-filters").textContent.indexOf("derived") >= 0);
  w.document.querySelector('.tab[data-tab="gaps"]').click();
  assert.strictEqual($("mult-table").querySelectorAll("tr").length, 6);
});

test("UI: SRF layers in sequence, L1 on top and L5 at the bottom (Bill's rule)", () => {
  const want = ["L1", "L2", "L3", "L4", "L5"];
  assert.deepStrictEqual(plain(TM.LAYERS.map((l) => l.id)), want);
  w.TM_UI.load(example);
  // graph bands: label order and y position
  const bands = Array.prototype.map.call(w.document.querySelectorAll("#graph text.band-id"), (t) => [t.textContent, +t.getAttribute("y")]);
  assert.deepStrictEqual(bands.map((b) => b[0]), want);
  for (let i = 1; i < bands.length; i++) assert.ok(bands[i][1] > bands[i - 1][1], "band " + bands[i][0] + " is below " + bands[i - 1][0]);
  // every node sits lower than every node of the layer above
  const comps = TM.byId(TM.active(example).components);
  const ys = {};
  Array.prototype.forEach.call(w.document.querySelectorAll("#graph .node"), (g) => {
    const L = comps[g.getAttribute("data-id")].layer, y = +g.querySelector("rect").getAttribute("y");
    (ys[L] = ys[L] || []).push(y);
  });
  for (let i = 1; i < want.length; i++) if (ys[want[i]] && ys[want[i - 1]])
    assert.ok(Math.min(...ys[want[i]]) > Math.max(...ys[want[i - 1]]), want[i] + " nodes sit below " + want[i - 1]);
  // tables and lists that show layers
  const firstCells = (sel) => Array.prototype.map.call(w.document.querySelectorAll(sel), (tr) => tr.firstElementChild.textContent.slice(0, 2)).filter((x) => /^L[1-5]$/.test(x));
  w.TM_UI.selectComponent("cmp.reasoning-llm");
  w.document.querySelector('.tab[data-tab="cascade"]').click();
  assert.deepStrictEqual(firstCells("#cascade-by-layer tr"), want, "cascade impact by layer");
  w.document.querySelector('.tab[data-tab="dataflow"]').click();
  assert.deepStrictEqual(firstCells("#df-matrix tr"), want, "data flow matrix rows");
  const cols = Array.prototype.map.call(w.document.querySelectorAll("#df-matrix tr:first-child th"), (th) => th.textContent).slice(1);
  assert.deepStrictEqual(cols, want, "data flow matrix columns");
  w.document.querySelector('.tab[data-tab="edit"]').click();
  const opts = Array.prototype.map.call(w.document.querySelectorAll('#f-comp [name="layer"] option'), (o) => o.value);
  assert.deepStrictEqual(opts, want, "layer choices in the Edit form");
});

test("UI: the page scrolls, the graph keeps its height, and drawer close restores width classes", () => {
  const css = Array.prototype.map.call(w.document.querySelectorAll("style"), (s) => s.textContent).join("\n");
  assert.ok(/main\s*\{[^}]*flex:\s*1\s+1\s+auto/.test(css), "main grows in the body column");
  assert.ok(/body\s*\{[^}]*overflow:\s*visible/.test(css), "the window scrolls the page");
  assert.ok(/#graph-scroll\s*\{[^}]*overflow:\s*visible/.test(css), "the graph keeps its own height");
  assert.ok(/#rel-filters\s*\{[^}]*flex-wrap:\s*nowrap/.test(css), "filters stay on one row");
  assert.ok(/#rel-filters\s*\{[^}]*overflow-x:\s*auto/.test(css), "filters scroll sideways instead of wrapping tall");
  assert.ok(!$("assessment-mode").open, "Options panel stays closed by default");
  w.TM_UI.load(example);
  const main = w.document.querySelector("main");
  assert.ok(main.classList.contains("drawer-closed"));
  assert.ok($("pane-handle").hidden, "resize handle hidden while Details closed");
  w.TM_UI.selectComponent("cmp.reasoning-llm");
  assert.ok(main.classList.contains("drawer-open"));
  assert.ok(!$("pane-handle").hidden, "resize handle shown while Details open");
  $("drawer-close").click();
  assert.ok(main.classList.contains("drawer-closed"));
  assert.ok(!main.classList.contains("drawer-open"));
  assert.ok($("pane-handle").hidden);
});

test("UI: diagram fits by viewBox, and details open, close, and return focus", () => {
  w.TM_UI.load(example);
  const main = w.document.querySelector("main");
  assert.ok(main.classList.contains("drawer-closed"));
  assert.strictEqual($("side").getAttribute("aria-hidden"), "true");
  assert.strictEqual($("open-drawer").hidden, false);
  const svg = $("graph-svg");
  assert.ok(/^0 0 \d+ \d+$/.test(svg.getAttribute("viewBox")), svg.getAttribute("viewBox"));
  assert.strictEqual(svg.getAttribute("width"), null);
  assert.strictEqual(svg.getAttribute("role"), "group");
  assert.strictEqual(w.TM_UI.columnCount(11, 0), 6, "headless fallback keeps 6 boxes on a row");
  assert.strictEqual(w.TM_UI.columnCount(11, 1366), 7);
  assert.strictEqual(w.TM_UI.columnCount(11, 1280), 6);
  assert.strictEqual(w.TM_UI.columnCount(11, 900), 4);
  assert.strictEqual(w.TM_UI.columnCount(11, 390), 1);
  const vbWide = svg.getAttribute("viewBox").match(/\S+/g);
  assert.strictEqual($("graph").style.getPropertyValue("--diagram-w"), vbWide[2] + "px");
  const node = w.document.querySelector('#graph .node[data-id="cmp.reasoning-llm"]');
  node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  assert.ok(main.classList.contains("drawer-open"));
  assert.strictEqual($("side").getAttribute("aria-hidden"), "false");
  assert.strictEqual(w.document.activeElement, $("drawer-close"));
  assert.ok($("panel").textContent.indexOf("Reasoning LLM") >= 0, "details show the clicked component");
  $("drawer-close").click();
  assert.ok(main.classList.contains("drawer-closed"));
  assert.strictEqual(w.document.activeElement.getAttribute("data-id"), "cmp.reasoning-llm");
  w.document.querySelector('#graph .node[data-id="cmp.reasoning-llm"]').dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.ok(main.classList.contains("drawer-open"));
  assert.strictEqual(w.document.activeElement, $("drawer-close"));
  w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.ok(main.classList.contains("drawer-closed"));
  assert.strictEqual(w.document.activeElement.getAttribute("data-id"), "cmp.reasoning-llm");
  $("open-drawer").click();
  assert.ok(main.classList.contains("drawer-open"));
  assert.strictEqual(w.document.activeElement, $("drawer-close"));
  $("drawer-close").click();
  assert.strictEqual(w.document.activeElement, $("open-drawer"));
});

test("UI: a scoped L5 canvas is HTML cards that wrap, with no SVG and no fixed width", () => {
  w.TM_UI.setAssessment("L5");
  assert.ok(!$("graph-svg"));
  assert.ok($("graph").querySelector(".scoped-canvas"));
  assert.strictEqual($("graph").style.getPropertyValue("--diagram-w"), "");
  assert.ok(w.document.querySelectorAll("#graph .node").length < 15);
  assert.ok(w.document.querySelector("#graph .node[data-id='cmp.edge-hub']"));
  assert.ok($("example-wrap").hidden && $("cascade-wrap").hidden, "Example and Cascade controls are hidden when scoped");
  assert.ok(!/IaaS: customer customer/.test($("graph").textContent));
  assert.ok(/IaaS: the customer owns it; the provider manages it\./.test($("graph").textContent));
  assert.ok(!/Under AI-SaaS/.test($("results-lead").textContent), "attestation note only under AI-SaaS");
  $("om").value = "AI-SaaS";
  $("om").dispatchEvent(new w.Event("change"));
  assert.ok(/Under AI-SaaS/.test($("results-lead").textContent));
  $("om").value = "Agent-PaaS";
  $("om").dispatchEvent(new w.Event("change"));
  w.TM_UI.setAssessment("holistic");
  assert.ok(!$("example-wrap").hidden && !$("cascade-wrap").hidden);
  assert.ok($("graph-svg"));
  assert.ok(w.document.querySelector("#graph text.band-id"), "holistic bands return");
});

test("UI: cascade state does not sit on the owner line", () => {
  w.TM_UI.load(example);
  $("mode").value = "worst";
  $("mode").dispatchEvent(new w.Event("change"));
  w.TM_UI.selectComponent("cmp.reasoning-llm");
  const reached = Array.prototype.filter.call(w.document.querySelectorAll("#graph .node"), (n) => n.querySelector("text.nstate"));
  assert.ok(reached.length >= 2, "seed cascade paints state on more than one node");
  reached.forEach((node) => {
    const owner = node.querySelector("text.nowner");
    const state = node.querySelector("text.nstate");
    const status = node.querySelector("text.nstatus");
    assert.ok(owner && state && status, node.getAttribute("data-id"));
    assert.notStrictEqual(owner.getAttribute("y"), state.getAttribute("y"), node.getAttribute("data-id") + ": owner and state must not share a row");
    assert.strictEqual(state.getAttribute("y"), status.getAttribute("y"), node.getAttribute("data-id") + ": state shares the status row");
    assert.ok(/impacted|failed|exposed/.test(state.textContent), state.textContent);
  });
});

test("a placeholder owner is not shown or exported as verified", () => {
  assert.strictEqual(TM.statusWord({ record_status: "placeholder", placeholder: true }), "Placeholder");
  assert.strictEqual(TM.statusWord({ record_status: "verified", placeholder: true, approved_by: "Bill Stout", approved_on: "2026-11-18" }), "Placeholder");
  assert.notStrictEqual(TM.statusWord({ record_status: "verified", placeholder: true, approved_by: "Bill Stout", approved_on: "2026-11-18" }), "Verified");
  const m = clone(example);
  const owner = m.components.filter((c) => c.owner && c.owner.placeholder)[0];
  owner.owner.record_status = "verified";
  owner.owner.approved_by = "Bill Stout";
  owner.owner.approved_on = "2026-11-18";
  w.TM_UI.load(m);
  const node = w.document.querySelector('#graph .node[data-id="' + owner.id + '"]');
  assert.ok(node.textContent.indexOf("Placeholder") >= 0, node.textContent);
  assert.ok(node.textContent.indexOf("Verified") < 0, node.textContent);
  w.document.querySelector('.tab[data-tab="export"]').click();
  const exported = JSON.parse(w.TM_EXPORT("json"));
  const exOwner = exported.components.filter((c) => c.id === owner.id)[0].owner;
  assert.strictEqual(exOwner.placeholder, true);
  assert.notStrictEqual(TM.statusWord(exOwner), "Verified");
  assert.ok(w.TM_EXPORT("yaml").indexOf("name: " + exOwner.name) >= 0);
  w.TM_UI.load(example);
  w.document.querySelector('.tab[data-tab="export"]').click();
  const clean = JSON.parse(w.TM_EXPORT("json"));
  clean.components.forEach((c) => {
    if (!c.owner) return;
    assert.notStrictEqual(c.owner.record_status, "verified", c.id);
    assert.notStrictEqual(TM.statusWord(c.owner), "Verified", c.id);
  });
  Array.prototype.forEach.call(w.document.querySelectorAll("#graph .node"), (g) => {
    assert.ok(g.textContent.indexOf("Placeholder") >= 0, g.getAttribute("data-id"));
    assert.ok(g.textContent.indexOf("Verified") < 0, g.getAttribute("data-id") + " " + g.textContent);
  });
});

test("a control-ownership gap stays visible on the canvas, in the drawer, and in the list", () => {
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas", "l2o", "i2r", "q2a", "r2f", "p2f"].forEach((id) => {
    const m = JSON.parse(fs.readFileSync(path.join(DIR, "example-" + id + ".json"), "utf8"));
    w.TM_UI.load(m);
    const gaps = m.threats.filter((t) => t.control_ownership_gap === true);
    const calm = m.threats.filter((t) => t.catalog_threat_id && !t.control_ownership_gap);
    if (id === "r2r") assert.strictEqual(gaps.length, 0, "r2r has no control-ownership gap");
    gaps.forEach((t) => {
      const node = w.document.querySelector('#graph .node[data-id="' + t.target_component_id + '"]');
      assert.ok(node && node.textContent.indexOf(TM.CONTROL_GAP_MARK) >= 0, id + " canvas " + t.id + " " + (node && node.textContent));
      w.TM_UI.selectThreat(t.id);
      const row = w.document.querySelector('[data-thr-row="' + t.id + '"]');
      assert.ok(row.textContent.indexOf(TM.CONTROL_GAP_MARK) >= 0, id + " threat row " + t.id);
      const roca = $("roca").textContent;
      assert.ok(roca.indexOf(TM.CONTROL_GAP_MARK) >= 0, id + " drawer mark");
      assert.ok(roca.indexOf(TM.CONTROL_GAP_LINE) >= 0, id + " drawer line");
      assert.ok(roca.indexOf("Placeholder") >= 0, id + " accountable status");
      assert.ok(roca.indexOf("Proposed") >= 0, id + " catalog status");
      assert.ok(roca.indexOf("Verified") < 0, id + " drawer must not say Verified");
    });
    $("view-toggle").click();
    gaps.forEach((t) => {
      const row = w.document.querySelector('[data-lv-row="' + t.target_component_id + '"]');
      assert.ok(row && row.textContent.indexOf(TM.CONTROL_GAP_MARK) >= 0, id + " list " + t.target_component_id);
      assert.ok(row.textContent.indexOf("Placeholder") >= 0, id + " list status");
    });
    if (calm.length) {
      w.TM_UI.selectThreat(calm[0].id);
      const row = w.document.querySelector('[data-thr-row="' + calm[0].id + '"]');
      assert.ok(row.textContent.indexOf(TM.CONTROL_GAP_MARK) < 0, id + " non-gap row shows a gap");
    }
    $("view-toggle").click();
  });
  w.TM_UI.load(example);
});

test("UI: list view selection opens details and close returns to that row", () => {
  w.TM_UI.load(example);
  $("view-toggle").click();
  w.document.querySelector('#list-view button[data-lv="cmp.orchestrator"]').click();
  assert.ok(w.document.querySelector("main").classList.contains("drawer-open"));
  assert.strictEqual(w.TM_STATE.selected, "cmp.orchestrator");
  $("drawer-close").click();
  assert.strictEqual(w.document.activeElement.getAttribute("data-lv"), "cmp.orchestrator");
  $("view-toggle").click();
  assert.ok($("graph-svg"));
});

test("UI: assessment offers Holistic, Scoped L2, and Scoped L5", () => {
  const radios = w.document.querySelectorAll('input[name="assessment-mode"]');
  assert.strictEqual(radios.length, 3);
  assert.deepStrictEqual(Array.prototype.map.call(radios, (r) => r.value), ["holistic", "L2", "L5"]);
  assert.ok(/Holistic/.test(radios[0].parentNode.textContent));
  assert.ok(/Scoped: L2 AI Information/.test(radios[1].parentNode.textContent));
  assert.ok(/Scoped: L5 AI Model Provider/.test(radios[2].parentNode.textContent));
  const note = $("start-l34");
  assert.ok(/mature threat-modeling practice/.test(note.textContent));
  assert.ok(note.textContent.indexOf("application layer (L3)") >= 0);
  assert.ok(note.textContent.indexOf("platform layer (L4)") >= 0);
  ["https://genai.owasp.org/llm-top-10/", "https://owaspai.org/", "https://atlas.mitre.org/", "https://github.com/cosai-oasis/secure-ai-tooling/tree/main/risk-map"].forEach((url) => {
    assert.ok(note.innerHTML.indexOf(url) >= 0, url);
  });
  const why = $("mode-why").textContent;
  assert.ok(/on its own/.test(why));
  assert.ok(/L3 and L4/.test(why));
  assert.ok(/feed into the holistic view/.test(why));
  assert.ok(!$("assessment-mode").open);
  assert.ok(w.document.querySelector("a.skip-link").getAttribute("href") === "#main");
  assert.ok(w.document.querySelector("site-nav"));
  assert.ok(w.document.querySelector("site-footer"));
  assert.strictEqual($("example-pick").options.length, 11);
  radios[1].checked = true;
  radios[1].dispatchEvent(new w.Event("change"));
  assert.ok(w.document.querySelector('#graph .node[data-id="cmp.policy-kb"]'));
  assert.ok(w.document.querySelector('#graph .node[data-id="cmp.edge-resolve"]'));
  assert.ok(!w.document.querySelector("#cascade-by-layer"));
  assert.ok($("results-main"));
  assert.ok(/dsgai21/.test($("results-main").textContent));
  assert.ok(/Customer/.test($("results-main").textContent));
  assert.strictEqual($("example-pick").selectedIndex, -1);
  $("example-pick").value = "o2c";
  $("example-pick").dispatchEvent(new w.Event("change"));
  assert.strictEqual($("sys-name").textContent, example.system.name);
  assert.ok(w.document.querySelector('#graph .node[data-id="cmp.reasoning-llm"]'));
  assert.ok(!$("results-wrap") || $("results-wrap").hidden);
  assert.strictEqual($("glossary").getAttribute("title"), null);
  assert.ok(($("filter-hint").getAttribute("title") || "").indexOf("November 18, 2026") >= 0);
  assert.ok($("rel-filters").textContent.indexOf("part cannot exist alone") >= 0);
  assert.strictEqual(TM.REL_TYPES.length, 9);
});

test("UI: scoped L5 shows edge actors, boundaries, and a results table, then Holistic restores the example", () => {
  w.TM_UI.setAssessment("L5");
  assert.ok(w.document.querySelector("#graph .b-customer"));
  assert.ok(w.document.querySelector("#graph .b-provider"));
  assert.ok(/Outside this layer/.test($("graph").textContent));
  assert.ok(w.document.querySelector('#graph .node[data-id="cmp.edge-gateway"]'));
  assert.ok(!w.document.querySelector('#graph text.band-id'));
  const table = $("results-main").textContent;
  assert.ok(/supplymodelpoison/.test(table));
  assert.ok(/retire/.test($("results-none").textContent) && /Placeholder/.test($("results-none").textContent));
  assert.ok(($("results-main").querySelectorAll("tbody tr").length) < w.TM_STATE.model.layer_results.length, "no-threat rows are collapsed into one line");
  assert.ok(/Provider/.test($("graph").textContent) && /Customer/.test($("graph").textContent));
  w.document.querySelector('.tab[data-tab="export"]').click();
  $("exp-json").click();
  const exported = JSON.parse($("export-text").value);
  w.TM_UI.load(exported);
  w.document.querySelector('.tab[data-tab="export"]').click();
  $("exp-json").click();
  assert.deepStrictEqual(JSON.parse($("export-text").value), exported);
  $("exp-yaml").click();
  const yaml = $("export-text").value;
  assert.ok(yaml.indexOf("party: customer") >= 0 || yaml.indexOf("party: provider") >= 0);
  assert.ok(yaml.indexOf("# " + TM.DISCLAIMER) === 0);
  w.TM_UI.setAssessment("holistic");
  assert.strictEqual($("sys-name").textContent, example.system.name);
  assert.strictEqual(w.TM_UI.state.selected, null);
});

test("UI: the Options panel remembers open or closed", () => {
  $("assessment-mode").open = true;
  $("assessment-mode").dispatchEvent(new w.Event("toggle"));
  assert.strictEqual(w.localStorage.getItem("srf.threat-model.assessment-open"), "1");
  $("assessment-mode").open = false;
  $("assessment-mode").dispatchEvent(new w.Event("toggle"));
  assert.strictEqual(w.localStorage.getItem("srf.threat-model.assessment-open"), "0");
});

}
function finish() { console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0); }
if (w.document.readyState === "loading") w.document.addEventListener("DOMContentLoaded", () => { uiTests(); finish(); });
else { uiTests(); finish(); }
