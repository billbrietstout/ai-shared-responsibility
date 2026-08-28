#!/usr/bin/env python3
"""
inject_page_metadata.py

Insert page-level machine metadata into every HTML page:

    <meta name="llm:type"         content="...">
    <meta name="llm:canonical-id" content="srf.page.<slug>">
    <meta name="llm:concepts"     content="<ontology node ids>">

llm:concepts values are real node ids from /ids.json, so an agent can pivot
straight from a page into the ontology graph. The block is wrapped in
<!-- llm:meta --> markers and is idempotent: re-running replaces it in place.

Usage:
    python3 build/inject_page_metadata.py            # apply
    python3 build/inject_page_metadata.py --check    # report only, no write
"""

import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Concept groups (all must exist in ids.json; validated below) ──────────────
LAYERS   = [f"srf.layer.L{i}" for i in range(1, 6)]
OPMODELS = ["srf.opmodel.ai-saas", "srf.opmodel.ai-paas",
            "srf.opmodel.agent-paas", "srf.opmodel.iaas"]
# Federated-Consortium is a proposed extension, so it is listed only on the pages
# that actually render it rather than folded into OPMODELS everywhere.
TAPESTRY = ["srf.opmodel.federated-consortium", "srf.concept.project-tapestry"]
TAPESTRY_ROLES = ["srf.role.sovereign-participant-node",
                  "srf.role.consortium-core-coordinator"]
ROLES8   = ["srf.role.ai-system-users", "srf.role.ai-system-governance",
            "srf.role.data-provider", "srf.role.application-developer",
            "srf.role.agentic-platform-provider", "srf.role.ai-model-serving",
            "srf.role.ai-platform-provider", "srf.role.model-provider"]
GLOSS    = ["srf.concept.accountability", "srf.concept.accountable-party",
            "srf.concept.responsibility-cascade", "srf.concept.shared-responsibility",
            "srf.concept.operating-model", "srf.concept.persona",
            "srf.concept.autonomy-level", "srf.concept.human-override-tier",
            "srf.concept.agentic-system", "srf.concept.control",
            "srf.concept.evidence-threshold", "srf.concept.ocsf",
            "srf.concept.control-schema"]
ACCT     = ["srf.concept.accountability", "srf.concept.responsibility-cascade"]
# Roles the vendor-risk pages map AI suppliers to, in page order.
VENDOR_RISK_ROLES = ["srf.role.model-provider", "srf.role.ai-platform-provider",
                     "srf.role.agentic-platform-provider", "srf.role.application-developer",
                     "srf.role.data-provider", "srf.role.ai-system-governance"]

VERTICALS = ["finance", "healthcare", "insurance",
             "public-sector", "defense", "manufacturing"]

def vertical_personas(vertical):
    """Role ids actually used by a vertical's controls."""
    data = json.load(open(os.path.join(ROOT, "data", f"{vertical}-controls.json")))
    pids = sorted({c.get("accountable_persona") for c in data["controls"]
                   if c.get("accountable_persona")})
    return [f"srf.role.{p}" for p in pids]

def ext_frameworks():
    regs = json.load(open(os.path.join(ROOT, "data", "regulations.json")))
    return [f"ext.framework.{r['id']}" for r in regs["items"]]

# ── Per-page classification ───────────────────────────────────────────────────
# Returns (type, concepts) for a path relative to ROOT (the directory form).
def classify(rel):
    seg = rel.strip("/").split("/")
    top = seg[0] if seg and seg[0] else ""

    if rel in ("", "."):
        return "home", ["srf.framework.cosai-srf"] + LAYERS + OPMODELS + ACCT
    if rel == "llm/test":
        return "tool", ["srf.framework.cosai-srf"] + GLOSS[:6]
    if top == "framework" and len(seg) == 1:
        return "framework", LAYERS + ACCT + ["srf.concept.operating-model", "srf.concept.persona"]
    if rel == "framework/security-lifecycle":
        return "reference", ["srf.framework.cosai-srf"] + LAYERS + ["srf.data.threats"]
    if rel == "framework/nice-mapping":
        return "mapping", ROLES8 + ["srf.framework.cosai-srf"]
    if top == "operating-models":
        return "operating-models", OPMODELS + TAPESTRY + LAYERS
    if top == "tapestry" and len(seg) > 1 and seg[1] == "controls":
        return "controls", (LAYERS + TAPESTRY + TAPESTRY_ROLES
                            + ["srf.concept.control", "srf.concept.accountability"])
    if top == "personas":
        return "personas", ROLES8
    if top == "glossary":
        return "glossary", GLOSS
    if top == "compare":
        return "comparison", ["srf.framework.cosai-srf"] + ext_frameworks()
    if top == "regulations" and len(seg) == 1:
        return "regulations", ext_frameworks()
    if rel == "regulations/discovery":
        return "tool", ext_frameworks()[:6] + LAYERS
    if top == "industries":
        return "industries", ["srf.framework.cosai-srf", "srf.concept.control"] + LAYERS
    if top == "about":
        return "about", ["srf.framework.cosai-srf"]
    if top == "agentic-ai-security":
        return "reference", ["srf.framework.cosai-srf"] + ACCT + [
            "srf.concept.agentic-system", "srf.concept.autonomy-level",
            "srf.concept.human-override-tier"]
    if top == "changelog":
        return "reference", ["srf.framework.cosai-srf"]
    if rel == "developers/schema":
        return "developer", [
            "srf.framework.cosai-srf",
            "srf.concept.control",
            "srf.data.jurisdictions",
            "srf.data.moral-regulatory-hierarchy",
            "srf.moral.actor",
            "srf.moral.action",
            "srf.moral.outcome",
        ]
    if top == "developers":
        return "developer", ["srf.framework.cosai-srf", "srf.concept.control"]
    if top == "presentation":
        if len(seg) == 1:
            return "redirect", []
        return "presentation", ["srf.framework.cosai-srf"] + LAYERS
    if top in VERTICALS or top == "medical":
        v = "healthcare" if top == "medical" else top
        if top == "medical":
            return "redirect", []
        if len(seg) == 1:
            return "vertical-overview", LAYERS + vertical_personas(v) + ["srf.concept.control"]
        if seg[1] == "controls":
            return "controls", LAYERS + vertical_personas(v) + ["srf.concept.control", "srf.concept.evidence-threshold"]
        if seg[1] == "how-to":
            return "how-to", LAYERS + vertical_personas(v) + ["srf.concept.evidence-threshold"]
    if rel == "assess/layer-matrix":
        # Canonical page is /tools/layer-matrix/; this path 301-redirects there.
        return "redirect", []
    if top in ("tools", "assess", "controls"):
        leaf = seg[-1]
        if "ir-playbooks" in rel:        return "tool", LAYERS + OPMODELS
        if "vendor-risk" in rel:
            vr = LAYERS + OPMODELS + VENDOR_RISK_ROLES + ["srf.concept.evidence-threshold"]
            return ("how-to" if leaf == "how-to" else "tool"), vr
        if "layer-matrix" in rel:        return "tool", LAYERS + OPMODELS
        if "policy-pyramid" in rel:      return "tool", LAYERS + ["srf.concept.responsibility-cascade"]
        if "srf-stress" in rel:          return "tool", ACCT + LAYERS
        if "regulation-discovery" in rel:return "tool", ext_frameworks()[:6] + LAYERS
        if "redteam-scope" in rel:       return "tool", ["srf.framework.cosai-srf"] + LAYERS + ["srf.data.threats"]
        if "whitepaper-assessment" in rel:
            concepts = ["srf.framework.cosai-srf",
                        "srf.data.security-principles",
                        "srf.data.ai-agentic-principles",
                        "srf.data.threats"] + LAYERS
            if rel.rstrip("/").endswith("changes"):
                return "reference", concepts
            return "tool", concepts
        if rel.startswith("tools/prompts/threat-model"):
            return "tool", ["srf.framework.cosai-srf"] + ACCT + LAYERS + [
                "srf.data.threats",
                "srf.data.threat-sources",
            ]
        if rel == "eval/threat-model":
            return "tool", ["srf.framework.cosai-srf"] + ACCT + LAYERS + [
                "srf.data.threats",
                "srf.data.threat-sources",
            ]
        if "prompts" in rel:             return "tool", ["srf.framework.cosai-srf"] + ACCT
        if "schema" in rel:              return "tool", ["srf.framework.cosai-srf", "srf.concept.control"]
        if "security" in rel or "controls-assessment" in rel or "assessment" in rel:
            return "tool", ["srf.concept.control"] + LAYERS
        if top == "controls" and len(seg) == 1: return "controls-reference", ["srf.concept.control"] + LAYERS
        return "tool", ["srf.framework.cosai-srf"] + LAYERS
    return "page", ["srf.framework.cosai-srf"]

def canonical_id(rel):
    slug = "home" if rel in ("", ".") else rel.strip("/").replace("/", "-")
    return f"srf.page.{slug}"

# ── Injection ─────────────────────────────────────────────────────────────────
BLOCK_RE = re.compile(r"[ \t]*<!-- llm:meta -->.*?<!-- /llm:meta -->\n?", re.S)

def build_block(ptype, cid, concepts):
    lines = ['    <!-- llm:meta -->',
             f'    <meta name="llm:type" content="{ptype}" />',
             f'    <meta name="llm:canonical-id" content="{cid}" />']
    if concepts:
        lines.append(f'    <meta name="llm:concepts" content="{", ".join(concepts)}" />')
    lines.append('    <!-- /llm:meta -->')
    return "\n".join(lines) + "\n"

def page_rel(path):
    rel = os.path.relpath(os.path.dirname(path), ROOT)
    return "" if rel == "." else rel

def main():
    check = "--check" in sys.argv
    valid = {e["id"] for e in json.load(open(os.path.join(ROOT, "ids.json")))["ids"]}
    valid |= {"srf.framework.cosai-srf"}  # already a node, but be explicit

    pages = []
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in (".git", "build", "node_modules")
                   and not x.endswith(" 2")]
        if "index.html" in files:
            pages.append(os.path.join(d, "index.html"))

    changed = warned = 0
    for path in sorted(pages):
        rel = page_rel(path)
        ptype, concepts = classify(rel)
        cid = canonical_id(rel)

        bad = [c for c in concepts if c not in valid]
        if bad:
            warned += 1
            print(f"WARN  {rel or 'home'}: unknown concept ids {bad}")
            concepts = [c for c in concepts if c in valid]

        src = open(path, encoding="utf-8").read()

        # Skip hand-authored llm:meta that predates this script (no markers).
        if 'name="llm:type"' in src and "<!-- llm:meta -->" not in src:
            continue

        block = build_block(ptype, cid, concepts)
        if "<!-- llm:meta -->" in src:
            new = BLOCK_RE.sub(block, src, count=1)
        else:
            if "</head>" not in src:
                print(f"WARN  {rel}: no </head>, skipped")
                continue
            new = re.sub(r"\n[ \t]*</head>", "\n" + block + "  </head>", src, count=1)

        if new != src:
            changed += 1
            if not check:
                open(path, "w", encoding="utf-8").write(new)

    print(f"\n{'Would update' if check else 'Updated'} {changed} pages. {warned} warnings.")

if __name__ == "__main__":
    main()
