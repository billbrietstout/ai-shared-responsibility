# Proposed CoSAI SRF next-version agentic extensions

Independently proposed companion extension of the CoSAI Shared Responsibility Framework. Not part of CoSAI SRF v1.0. Not endorsed by CoSAI or OASIS.

Canonical machine-readable register: `/data/srf-vnext-extensions.json`. Published page: `/papers/srf-vnext-agentic-extensions/`.

This note is about production agents, operating models, and named personas. It does not claim to solve alignment of systems more capable than their operators.

## Already in SRF v1.0

Do not re-propose these. Site copy should only make them easier to find.

- Five layers L1-L5, eight personas, four operating models
- Exactly one accountable party per activity
- Autonomy L0-L5 (Appendix A.1.3.3)
- Human override T1-T5 (Appendix A.1.3.2)
- Agent-PaaS
- Intervention authority as override tiers

Autonomy classifies how independently an agent may act. It does not move the accountable persona.

## Asks for the next CoSAI SRF paper

1. **Accountability continuity.** Delegated authority must not silently expand. A child agent's authority stays inside the parent assignment. Hook: Section 3 plus CoSAI IAM.

2. **Spawn and replication as a named activity.** Spawn authority, descendant capability narrowing, live descendant inventory, tree-wide revoke. Hook: L3 / Agent-PaaS.

3. **Fail-closed halt when the authorizer is unreachable.** For irreversible, financially material, security-control-modifying, physical, or cross-organization actions, block if halt authority cannot be reached. Hook: Appendix A.1.3.2. Do not import a named-individual brand.

4. **Persistence scope on L2.** `request | handle_scoped | durable`. Hook: L2 Information.

5. **Enforcement-plane declaration.** North-south (agent to model), east-west (agent to agent), agent-to-tool. An attribute, not a sixth layer. Hook: operating-model matrices and Appendix A.1.3.

6. **Protocol-independent evidence.** Bind evidence to principals, capability grants, delegation chains, policy versions, and state handles, not protocol session IDs. Hook: Appendix A.7.

7. **Owner coverage vs halt-authority coverage.** Both measurable. No ninth persona. Hook: Section 3 and T1-T5.

8. **Spend ceiling as a halt, not only an alert.** Named Agent-PaaS / L3-L4 control with one persona. Hook: L3 application safety / L4 platform. OWASP-STATE already requires budget limits.

9. **Control-plane location per operating model.** Where authorization is enforced, distinct from where the agent executes. Hook: operating-model chapter.

## Do not propose

A0-A6, ACT-1-4, AISM Chaos-to-Sovereignty, HEAR doctrine, Control Envelope as an SRF object.

## Sources for the borrowed mechanisms

CoSAI IAM already requires non-expanding delegation. SRF v1.0 already assigns T1-T5. OWASP-STATE already requires budget limits. AI SAFE² v3.1 states spawn, fail-closed halt, persistence vocabulary, enforcement traffic planes, and protocol-independent evidence as engineering controls. This site maps those outcomes to SRF personas and operating models. It does not ingest the SAFE² catalog.
