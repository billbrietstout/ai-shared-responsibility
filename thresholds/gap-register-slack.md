# Where SP 800-53 Cannot Hold a Number: Findings by Enterprise Architecture Layer

Draft Slack comments for the 800-53 AI overlay discussion. Each section below is written to stand alone as one comment. Findings were checked against the official machine-readable SP 800-53 Revision 5 catalog, version 5.2.0.

---

## Opening comment

We ran a simple experiment. We wrote down six operational thresholds that an organization would actually enforce on an AI system. Each threshold is a number: a target value, measured over a time window, with a tolerated amount of shortfall before someone gets paged. Then we searched SP 800-53 Revision 5 for the place where each number could live.

The result surprised us. Every threshold found a home. All twelve of the anchor controls we identified exist in the catalog, and none of them are withdrawn. Coverage is not the problem. The problem is that the organization-defined parameters (ODPs) on those controls are plain text fields or fixed menu choices. Not one of them can hold a measured target. The best any control offers is a frequency parameter, which can record how often you check something but never what value it must hold when you check it.

We will post the details one layer at a time, following standard enterprise architecture layers: business, information, application, platform, and the model supply chain. Each comment names the threshold, the anchor controls, the parameters that exist today, and the parameter that would be needed.

---

## Business layer

The threshold at the business layer is inventory coverage. Every AI system the organization runs, whether in production or in pilot, should appear in an inventory with a named accountable owner. The target we would enforce is 100 percent coverage, measured monthly, with a small tolerated gap while new systems are being onboarded. Coverage is measured by comparing the inventory register against what procurement records and network telemetry actually show running.

The anchor controls are CM-8 (System Component Inventory) and PM-5 (System Inventory). Both fit well. An AI system inventory is a specialization of the inventories these controls already require.

Here is the gap. CM-8 has two parameters: one for what information the inventory must contain, and one for how often the inventory is reviewed and updated. PM-5 has a single frequency parameter. So an organization can declare that it reviews its inventory quarterly. It cannot declare that coverage must stay at or above a target percentage, measured continuously against discovery data. The review can pass on schedule while a third of the AI systems in the building remain unlisted. The parameter that would close this gap is a coverage objective: a target value, a comparison operator, and a measurement window.

---

## Information layer

The threshold at the information layer concerns shadow AI. Employees adopt external AI services faster than any approval process can track, and each unsanctioned service is a potential data exposure. The threshold we would enforce is a triage service level: 95 percent of detected unsanctioned AI usage events get risk-assessed within seven days of detection, measured over a rolling thirty days.

The anchor controls are CM-8(3) (Automated Unauthorized Component Detection) and SI-4 (System Monitoring). Both are reasonable fits. A shadow AI service is an unauthorized component that is consumed rather than installed, and detection of unauthorized use is exactly what these controls describe.

Here is the gap. CM-8(3) carries seven parameters, and SI-4 carries six. That sounds promising until you read them. They cover which tools to use, which personnel to notify, and how often automated detection runs. One frequency parameter in each control can hold a detection cadence. Nothing can hold a triage deadline, a completion rate, or a tolerated backlog. An organization can prove it scans daily and still take six months to look at what the scans found. The missing parameter is a response-time objective with a completion target.

---

## Application layer

The threshold at the application layer is the one we consider most serious, because it concerns human override of autonomous systems. When an AI agent acts on its own, the organization must be able to interrupt it, and the interruption must be fast. The thresholds we would enforce come from override drills: an emergency halt must land within ten seconds, a pause for review within one minute, and 100 percent of drills must pass, with zero tolerated failures. Drills run quarterly for supervised agents and monthly for agents that operate with humans only monitoring exceptions.

The anchor controls are SI-17 (Fail-safe Procedures) and IR-4 (Incident Handling). SI-17 is the closest thing the catalog has to a kill switch requirement: it asks organizations to define fail-safe procedures and the failure conditions that trigger them.

Here is the gap, and it is the widest one we found. SI-17 has three parameters, all plain text: which personnel, which procedures, which conditions. None can hold a response-time number. IR-4, the control that governs the entire incident handling capability, has no parameters at all. There is no place in Revision 5 to write "the halt must complete within ten seconds" in a form a tool can check. For autonomous AI, response time is the control. A kill switch that takes an hour is documentation, not a safeguard.

---

## Platform layer

The threshold at the platform layer is guardrail coverage. Every request that reaches a production model endpoint should pass through a policy enforcement point first, where inputs are validated, outputs are filtered, and access rules apply. Requests that reach the model directly bypass every safety measure the platform team built. The threshold we would enforce is 99.9 percent coverage of inference requests, measured over thirty days, with a burn-rate alert that fires early if the error budget is being consumed too fast.

The anchor controls are SI-10 (Information Input Validation) and SI-15 (Information Output Filtering). These are precisely the right controls. Input validation and output filtering are what AI guardrails do.

Here is the gap. Each control carries exactly one parameter. SI-10 asks which inputs get validated. SI-15 asks which software programs get output filtering. Both are plain lists. Neither can express what fraction of traffic the protection must actually cover, so an organization can name every input and every program, satisfy both controls as written, and still have a quiet unprotected path serving ten percent of production traffic. The missing parameter is a coverage ratio with a window and a tolerated shortfall.

---

## Model supply chain layer

Two thresholds live at the model supply chain layer, and together they cover a model's whole life: proof of where it came from, and proof it still behaves.

The first threshold is provenance. Every model version deployed to production should carry current documentation and a valid cryptographic signature over its artifacts. The target is 100 percent, with zero tolerated exceptions, because one unattested model in production is one too many. The anchor controls are SR-4 (Provenance) and CM-14 (Signed Components), and both fit naturally. Their parameters do not. SR-4 has one plain-text parameter, CM-14 has three, and they name which systems and which software get the treatment. None can hold "100 percent of deployed model versions, verified at deployment, zero exceptions."

The second threshold is drift. A model that was safe at deployment does not stay safe by default; its inputs shift and its performance decays. In regulated settings the deployer declares performance bounds in advance and monitors weekly that the model stays inside them. The anchor control is CA-7 (Continuous Monitoring), and it contains the most frustrating parameter in this whole exercise: an ODP literally named "system-level metrics." That is exactly the right hook. But it is a free-text field. You can write "accuracy" in it. You cannot write "accuracy at or above 0.92, measured weekly, zero tolerated breaches" in any form a tool can verify. One typed parameter here would make continuous monitoring of AI models genuinely auditable.

---

## Closing comment

The pattern across all five layers is the same, and it is worth stating plainly. Revision 5 is broad enough for AI operations. Twelve out of twelve anchor controls exist. Zero out of twelve can carry a measured objective. The ceiling everywhere is a frequency parameter: how often you look, never what you must find.

Our ask for the AI overlay is narrow. Where an overlay control governs continuously measurable AI behavior, such as inventory coverage, guardrail coverage, override response time, attestation currency, and drift, define its parameters as structured objectives instead of free text. A structured objective needs four pieces: a target value, a comparison operator, a measurement window, and a tolerated shortfall. That is the difference between a control that says "monitor the model" and a control an assessor, or a pipeline, can check without interpretation. We have a worked example of this parameter shape across all five layers and are happy to share it.
