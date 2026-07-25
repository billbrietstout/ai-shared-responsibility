# Project Instructions

## Writing style

Avoid AI writing fingerprints. Specifically:

- No em dashes (—). Use a comma, semicolon, colon, or rewrite the sentence.
- No en dashes as separators in prose. Use "to" or rewrite.
- Avoid filler phrases: "it is worth noting," "it is important to," "in order to," "at the end of the day."
- Avoid hedging openers: "certainly," "absolutely," "of course," "needless to say."
- No Oxford-comma abuse as a stylistic tic — use it where it aids clarity, not reflexively.
- Prefer concrete, direct sentences over nominalized constructions ("establish accountability" not "the establishment of accountability").

These apply to all content written for the site: HTML page copy, callout text, table content, and any markdown.

## Reference: Security Principles, Axioms, and Invariables

security_principles_reference.oscal.json is an OSCAL-format catalog covering
Saltzer and Schroeder, NIST SP 800-27, ISO 27001, CIS Controls v8/v8.1,
Microsoft's two law sets, and cloud architecture corollaries (93 entries).
Each control has a stable id, category tag, verification status, source
citation, and `related` links to equivalent principles in other frameworks.
Use this as the baseline checklist when extracting principles from a paper,
and consult the `related` links before treating a new principle as novel.
CRE-ID mapping to OpenCRE is not yet done; category tags are a starting
filter, not final mappings.