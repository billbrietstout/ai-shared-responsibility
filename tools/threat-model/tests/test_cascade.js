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


test("embedded P2P, H2R, R2R and Case examples equal their JSON files", () => {
  ["p2p", "h2r", "r2r", "case"].forEach((id) => {
    const embedded = JSON.parse(w.document.getElementById("example-data-" + id).textContent);
    const file = JSON.parse(fs.readFileSync(path.join(DIR, "example-" + id + ".json"), "utf8"));
    assert.deepStrictEqual(embedded, file, id);
  });
});

test("catalog_threat_id points at a real /data/threats.json entry, and external_refs copy its mappings", () => {
  const cat = JSON.parse(fs.readFileSync(path.join(DIR, "..", "..", "data", "threats.json"), "utf8"));
  const byId = {}; cat.threats.forEach((x) => { byId[x.id] = x; });
  let mapped = 0;
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas"].forEach((id) => {
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
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas"].forEach((id) => {
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
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas"].forEach((id) => {
    const m = JSON.parse(fs.readFileSync(path.join(DIR, "example-" + id + ".json"), "utf8"));
    assert.strictEqual(m.system.disclaimer, TM.DISCLAIMER, id);
    assert.strictEqual(Object.keys(m.system)[0], "disclaimer", id + ": disclaimer is the first system field");
  });
  const h = w.document.querySelector("header .draft").textContent;
  assert.strictEqual(h, TM.DISCLAIMER, "header sentence and export sentence match");
});

const EXAMPLE_SPEC = {
  p2p: {
    overlay: "public-sector", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.agent-requisition", "cmp.agent-sourcing", "cmp.agent-receiving", "cmp.agent-invoice", "cmp.agent-payment"],
    isolatedStep: "cmp.step-vendor-eligibility", isolatedComp: "cmp.vendor-risk",
    process: "cmp.p2p-process", logic: "cmp.p2p-logic",
    lowered: ["cmp.agent-invoice", "cmp.agent-payment"],
    loweredSteps: ["cmp.step-invoice-match", "cmp.step-payment"]
  },
  h2r: {
    overlay: "employment", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.agent-sourcing", "cmp.agent-screening", "cmp.agent-offer", "cmp.agent-onboarding", "cmp.agent-offboarding"],
    isolatedStep: "cmp.step-background", isolatedComp: "cmp.background-check",
    process: "cmp.h2r-process", logic: "cmp.h2r-logic",
    lowered: ["cmp.agent-offer", "cmp.agent-offboarding"],
    loweredSteps: ["cmp.step-offer", "cmp.step-offboarding"]
  },
  r2r: {
    overlay: "sox", overlayThreats: 2, overlayObls: 3, reachedWorst: 20,
    agents: ["cmp.agent-journal", "cmp.agent-recon", "cmp.agent-adjustments", "cmp.agent-consolidation", "cmp.agent-reporting"],
    isolatedStep: "cmp.step-anomaly", isolatedComp: "cmp.anomaly-detect",
    process: "cmp.r2r-process", logic: "cmp.r2r-logic",
    lowered: ["cmp.agent-adjustments", "cmp.agent-reporting"],
    loweredSteps: ["cmp.step-adjustments", "cmp.step-reporting"]
  },
  case: {
    overlay: "consumer-protection", overlayThreats: 2, overlayObls: 3, reachedWorst: 21,
    agents: ["cmp.agent-intake", "cmp.agent-triage", "cmp.agent-investigate", "cmp.agent-resolve", "cmp.agent-escalate"],
    isolatedStep: "cmp.step-identity", isolatedComp: "cmp.id-verify",
    process: "cmp.case-process", logic: "cmp.case-logic",
    lowered: ["cmp.agent-resolve", "cmp.agent-escalate"],
    loweredSteps: ["cmp.step-resolve", "cmp.step-escalate"]
  }
};

["p2p", "h2r", "r2r", "case"].forEach((exId) => {
  const spec = EXAMPLE_SPEC[exId];
  const ex = JSON.parse(fs.readFileSync(path.join(DIR, "example-" + exId + ".json"), "utf8"));
  test(exId + ": reasoning LLM failure reaches the orchestrator and sub-agents, not the policy service or isolated step", () => {
    const r = TM.cascade(ex, "cmp.reasoning-llm");
    assert.strictEqual(st(r, "cmp.llm-gateway"), "failed");
    assert.strictEqual(st(r, "cmp.orchestrator"), "failed");
    spec.agents.forEach((id) => assert.strictEqual(st(r, id), "failed", id));
    assert.strictEqual(st(r, spec.logic), "impacted");
    assert.strictEqual(st(r, spec.process), "impacted");
    assert.strictEqual(r.nodes[spec.process].rollup, true);
    assert.strictEqual(st(r, "cmp.policy-service"), "not reached");
    assert.strictEqual(st(r, spec.isolatedStep), "not reached");
    assert.strictEqual(st(r, spec.isolatedComp), "not reached");
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

function uiTests() {
// ---------- UI ----------
const $ = (id) => w.document.getElementById(id);
test("example picker lists six examples, defaults to O2C, and loads the others", () => {
  const sel = w.document.getElementById("example-pick");
  assert.strictEqual(sel.options.length, 6);
  assert.ok(Array.prototype.some.call(sel.options, (o) => o.value === "case-saas"), "AI-SaaS example in the picker");
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
  ["o2c", "p2p", "h2r", "r2r", "case", "case-saas"].forEach((id) => {
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
  assert.ok($("glossary").textContent.indexOf("ROCA = Risk, Obligation, Control, Accountable") === 0);
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

}
function finish() { console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0); }
if (w.document.readyState === "loading") w.document.addEventListener("DOMContentLoaded", () => { uiTests(); finish(); });
else { uiTests(); finish(); }
