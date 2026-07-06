# Discussion draft: Can risks be mapped to accountability and obligations?

**Suggested category:** Ideas (or General, if Ideas is not available)

**Suggested title:** Risks already map to controls, accountability, and obligations: let's discuss the path forward (see #389)

---

## Body

There is a recurring view that AI risks cannot be tied to accountability. In other words, that you cannot connect a risk to the people who answer for it. I want to test that claim openly, because I think the data in the risk map already says otherwise.

I opened issue #389 with a worked demonstration. The short version:

- Risk to control is already a required, two-way link in the schemas. Every risk lists its controls, and every control lists its risks.
- Risk to actor is already required too. Every risk and every control lists the personas involved.
- The path to obligations is already supported. The `mappings` block on risks and controls accepts frameworks like the EU AI Act and the NIST AI RMF, and the schema says these apply to risks, controls, and personas.

So the connections are mostly built. What is missing is small and additive: a label that marks which actor is the accountable owner of a control, and filled-in mapping entries that point controls to legal and standards obligations. Neither change removes or renames anything that already works.

There is also an important point about where the accountability model comes from. CoSAI already has an accountability framework in the AI Shared Responsibility Framework (AI SRF). The AI SRF defines how responsibility is divided across actors and deployment models, which is exactly the question "who answers for this?" The risk map's personas line up with the roles the AI SRF describes. So the accountable owner label is not a new idea we are inventing here. It is the point where the risk map connects to the accountability framework CoSAI already maintains. The risk map says which actors are involved in a control, and the AI SRF says how accountability is allocated among them. Marking the owner is what joins the two.

If this holds up, it changes the conversation. The objection assumes the mapping has to be invented. The issue shows it is already about 80 percent present in committed data, the AI SRF supplies the accountability model, and the rest is a backward-compatible refinement.

I would like input on a few questions:

1. Do you agree that the accountability link already exists as data and only needs a clear owner label? Or do you see a reason the persona list should stay flat?
2. For obligations, do you prefer filling in the existing `mappings` block, or adding a separate obligations entry that points to control and persona IDs?
3. Are there risks or controls where a single accountable owner does not make sense, so we would need shared ownership with explicit interfaces instead?
4. How closely should the owner label follow the AI SRF? Should the risk map point to AI SRF roles directly, so the two stay in sync as the AI SRF develops?

The full demonstration, including a worked example and suggested next steps, is in #389. Please bring counterexamples. The goal is to find out where the model holds and where it breaks, not to declare it finished.
