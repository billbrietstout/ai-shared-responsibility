# Risks already map to controls, accountability, and obligations: a worked demonstration

## Summary

Some people argue that AI risks cannot be tied to accountability. In other words, they say you cannot connect a risk to the people who answer for it. This issue shows that this is not true. The connections are already built into the data in `risk-map/`. You can start at a risk, move to the controls that reduce it, then to the actor who is accountable, and finally to the outside rule it satisfies. Two of these three connections are already complete in the repository today. The third one, accountability, also exists, but it needs a small label added to make its meaning clear.

The objection mixes up two different claims:

1. You cannot use one fixed rule to assign every risk to a single owner. This is true, but no one is asking for that.
2. You cannot link a risk to the actors who answer for fixing it. This is false. The link is already in the files.

## What the data already contains

The schemas make these connections required, not optional.

**Risk to control is required and goes both ways.** In `schemas/risks.schema.json`, every risk must have a `controls` list. In `schemas/controls.schema.json`, every control must have a `risks` list. Each one points back to the other by ID, so the mapping is already finished and a computer can check it.

```
risk.required:    [id, title, shortDescription, longDescription, category, personas, controls]
control.required: [title, description, category, personas, components, risks]
```

**Risk to actor is required.** Every risk must have a `personas` list, and every control must have a `personas` list. So each risk already names the actors involved, and each control already names the actors who carry it out. The personas file also gives each actor a `responsibilities` list and a mapping to ISO 22989 roles.

**The path to obligations is already there.** Both risks and controls have a `mappings` block, organized by framework. In `schemas/frameworks.schema.json`, the allowed frameworks include `eu-ai-act` (limited to an `Article N` format) and `nist-ai-rmf` (limited to `GOVERN`, `MAP`, `MEASURE`, and `MANAGE` functions). That same file says these frameworks apply to `risks`, `controls`, and `personas`. So outside rules are already valid targets. Right now controls point to MITRE ATLAS, OWASP LLM, and NIST AI RMF, and those are obligations in everything but the name.

The framework even talks about accountability and obligations directly. In `yaml/personas.yaml`, the `personaGovernance` actor includes these questions: "Do you assign or review accountability for AI risks and controls across multiple teams, systems, or organizational boundaries?" and "Do you monitor conformance to AI policies or external obligations over time?" The ideas are already written into the text. This issue is about turning them into clear, labeled connections.

## Worked example: Prompt Injection

Every value below comes straight from the current `develop` YAML. Nothing was added.

**Risk.** `riskPromptInjection` is in the `risksRuntimeInputSecurity` category. It lists `personas: [personaModelServing, personaApplicationDeveloper, personaEndUser]` and `controls: [controlInputValidationAndSanitization, controlAdversarialTrainingAndTesting, controlOutputValidationAndSanitization]`.

**Control link (already done).** The three controls above are the fixes. They are listed on the risk, and each control also lists `riskPromptInjection` in its own `risks` field. This link needs nothing more.

**Accountability link (already there, needs a label).** Each control already names the actors who carry it out:

| Control | Personas on the control |
|---|---|
| `controlInputValidationAndSanitization` | Platform Provider, Model Serving, Agentic Provider, Application Developer |
| `controlAdversarialTrainingAndTesting` | Model Provider, Application Developer |
| `controlOutputValidationAndSanitization` | Model Serving, Application Developer |

So the question "who answers for reducing prompt injection?" already has an answer for each control. The Application Developer handles input and output checks in the app. The Model Provider handles adversarial training. The Model Serving actor handles checks at the serving layer. What the data shows today is the full group of actors who do the work. Accountability is the next step: pick the one actor who answers for each control, the single owner, chosen from the personas already listed.

**Obligation link (already there where mappings are filled in).** The controls carry framework mappings that act as obligations:

| Control | Mapped obligations (from `mappings`) |
|---|---|
| `controlInputValidationAndSanitization` | OWASP LLM01:2025; MITRE ATLAS AML.M0010, M0015, M0020, M0024 |
| `controlAdversarialTrainingAndTesting` | MITRE ATLAS AML.M0003, M0006, M0008 |
| `controlOutputValidationAndSanitization` | OWASP LLM02, LLM05; MITRE ATLAS AML.M0020, M0024 |

The schema already accepts entries like `eu-ai-act: [Article 15]` and `nist-ai-rmf: [MANAGE-2.1]` on these same controls. Filling those in turns a fix into proof that a legal or standards rule has been met, and it points back to the accountable actor.

**The full path, start to finish:**

```
riskPromptInjection
  └─ reduced by   controlInputValidationAndSanitization        (risk.controls, present)
       ├─ owner    personaApplicationDeveloper                  (control.personas, present; needs an owner label)
       └─ meets    OWASP LLM01:2025  /  EU AI Act Art. 15       (control.mappings, present or ready to add)
```

The path is already in the data. You can pull it out today with a short join across the YAML files.

## What is actually missing

Not the connections. The connections are required fields. What is missing is two small additions that do not break anything that already works:

1. **Add an accountability label to the actor link.** Right now the `personas` list on a control is just a group of actors with no ranking. Add an optional way to mark one actor as the owner who answers for the control, next to the others who help. This labels a link that already exists, and you can adjust it by deployment setup when needed. No persona, risk, or control has to be removed or renamed.

2. **Turn framework mappings into named obligations.** The `mappings` block already supports `eu-ai-act` and `nist-ai-rmf`. Filling in legal and standards references on controls, or adding a separate obligations entry that points to control and persona IDs, makes the obligation link clear instead of something you have to figure out.

## Why this answers the objection

The objection assumes the mapping has to be built from scratch. It does not. The risk map already requires the risk-to-control link and the risk-to-actor link on every entry, and it already allows legal frameworks as mapping targets. The worked example walks from a risk, to a control, to an accountable actor, to an obligation, using only data that is already committed. The work that remains is to label the actor link and fill in the obligation references. Both are additions, not rewrites. Risks map to controls today, to responsible actors today, and to obligations wherever mappings are filled in. Accountability is one small, safe change away. It is not impossible.

## Suggested next steps

- Confirm the worked example still matches the current `develop` YAML by running a short join script over `risks.yaml`, `controls.yaml`, and `personas.yaml`.
- Open a focused proposal to add an optional owner label on the control-to-persona link.
- Fill in `eu-ai-act` and `nist-ai-rmf` mappings on a few controls to show the obligation link in committed data.
