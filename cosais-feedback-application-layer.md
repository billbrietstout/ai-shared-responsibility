# COSAiS AI Control Overlays feedback on the Application layer

COSAiS AI Control Overlays feedback on the Application layer (applications and services that integrate AI capabilities: inference endpoints, guardrails, agents, plugins, and the tool and data integrations they invoke).

From an OSCAL perspective, there's a gap around human override responsiveness. Same flaw as the Information layer: modern agentic systems need faster, verifiable (OSCAL), continuous measurements, and the controls can only carry cadence. SI-17 (Fail-safe Procedures) has ODPs, but they are untyped, so they cannot carry a measured objective. IR-4 (Incident Handling) has no ODPs at all. So an organization can say it implements SI-17 and IR-4 for autonomous agents, but there is no measurement that a human can actually halt an agent, or how fast. That means override failure gets discovered during a live incident, which is the worst possible time. If an agent operates at human-supervised autonomy or above, "we have fail-safe procedures" is not evidence; a passed drill within a response-time target is.

Proposed enhancement: introduce a coverage objective parameter (or enhancement) on SI-17, and add typed ODPs to IR-4. It should support:

* Target value (e.g., 100% of override drills pass). For safety overrides the error budget should arguably be zero; any budget is an explicit risk acceptance.
* Tiered response-time targets (e.g., pause within 1 minute for supervised agents, hard halt within 10 seconds for safety violations), scaled to the agent's autonomy level.
* Comparison operator ( = < > >= <= )
* Measurement window (e.g., rolling 90 days). Note this is not the same as drill cadence; cadence sets how often a drill runs, the window is the period over which the pass ratio is computed.
* Verification method (e.g., drill logs joined to agent telemetry showing actual halt time, not ticket closure time).

Other AI related items at the Application layer which should also include coverage objectives:

* Agent autonomy classification coverage: percent of deployed agents with a documented L0-L5 autonomy classification, re-reviewed on a defined cadence as capabilities change. Nearest controls are CM-8/PM-5 (inventory), which have cadence-only ODPs and no parameter for an autonomy attribute. You cannot scale oversight to autonomy you have not classified.
* Tool and API entitlement register: which tools each agent may invoke, with scopes, approval, and least-privilege review; coverage = percent of agent-tool grants documented and reviewed. AC-6 and CM-7 apply but cannot carry a coverage ratio. This is the Application-layer counterpart of the non-human identity register at the Information layer: identity there, entitlement here.
* Adversarial testing coverage: percent of AI applications red-teamed against known AI attack vectors (prompt injection, tool poisoning, confused deputy) within a defined period after release or major capability change. CA-8 (Penetration Testing) is cadence-only and has no parameter for attack classes covered.
* Agentic telemetry coverage: percent of agent sessions emitting the required telemetry classes (agent identity and session context, tool/API invocations with parameters, reasoning chain where available, inter-agent communications, human override events, boundary violation attempts). AU-2/AU-12 ODPs select event types and cadence, not session coverage. This one is the keystone: every other objective in this list is only verifiable if this telemetry exists.
* Plugin and data connection provenance: register of AI plugins, connectors, and MCP servers per application, with coverage = percent sourced from the sanctioned catalog at the Information layer versus ad hoc. SA-9 (External System Services) has no per-integration inventory parameter.
* On-behalf-of authentication ratio: percent of agent-to-tool calls using per-user delegated credentials rather than shared service accounts. This is the direct confused-deputy countermeasure. IA-9 acknowledges service identification but cannot express a ratio.
* Capability change gating: percent of agent capability changes (model swap, new tool grant, prompt change, autonomy level increase) passing gated review before deployment. CM-3/CM-4 are cadence-only, and nothing in the catalog treats an autonomy increase as a change class requiring re-approval.
* Approval and guardrail bypass testing: for human-approved (L2) agents, drill-tested integrity of approval gates (can the gate be bypassed); for human-supervised (L3) agents, percent of boundary violation attempts contained. SI-10/SI-15 ODPs are untyped. This complements override responsiveness, which tests speed but not gate integrity.

Timing note: the COSAiS single-agent and multi-agent overlays are the natural home for nearly all of the above, and both are still pre-draft, so this is the right window to raise it. The structural issue is the same across layers: overlays select and tailor controls, but they cannot add typed, measurable parameters. That requires parameter-level change in the SP 800-53 catalog itself.
