#!/usr/bin/env python3
"""
generate_principle_catalogs.py

Generates the two security principle catalogs used by the whitepaper
assessment workflow, plus slim projections the assessment prompt fetches:

  /data/security-principles.json         classic engineering axioms, normalized
                                         from security_principles_reference.oscal.json
  /data/security-principles.slim.json    id, statement, category, related
  /data/ai-agentic-principles.json       contemporary AI and agentic consensus,
                                         normalized from the 52-source synthesis at
                                         agentic-ai-security/agentic-security.md
  /data/ai-agentic-principles.slim.json  id, section, category, statement, gap_index

All four are derived. Do not hand-edit the generated JSON; edit the source and
regenerate. The slim files omit `src`, framework tables, and the sources
table. Fetch a full file when a mapping row needs a citation check.

Sources of truth:
  security_principles_reference.oscal.json   OSCAL 1.1.2 catalog, 93 controls
  agentic-ai-security/agentic-security.md    22-section synthesis, 135 bullets

Editorial judgment that cannot be derived from either source (stable ids,
category tags, which restatements merge, which sentences describe an absence
rather than a claim, and which classic principle each Gap note points at) lives
in the CURATION and GAP_INDEX tables below. The parser cross-checks the tables
against the markdown on every run and fails loudly when they disagree, so
editing the synthesis without updating curation cannot land silently.

Usage:
    python3 build/generate_principle_catalogs.py            # write files
    python3 build/generate_principle_catalogs.py --check    # parse only, no write
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SITE = "https://aisharedresponsibility.com"

# Fixed literal, never date.today(): the CI regeneration drift gate diffs
# generated output against what is committed, so this must be reproducible
# from committed source. Bump when publishing an update.
UPDATED = "2026-09-01"

OSCAL_SRC = "security_principles_reference.oscal.json"
SYNTH_SRC = "agentic-ai-security/agentic-security.md"


def write_json(relpath, obj):
    path = os.path.join(ROOT, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return path


def fail(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def slim_classic(classic_out):
    principles = []
    for p in classic_out["principles"]:
        row = {
            "id": p["id"],
            "statement": p["statement"],
            "category": p["category"],
        }
        if p.get("related"):
            row["related"] = p["related"]
        principles.append(row)
    return {
        "$schema_version": "1.0",
        "projection": "slim",
        "full_catalog": f"{SITE}/data/security-principles.json",
        "description": (
            "Slim projection of security-principles.json for assessment "
            "mapping: id, statement, category, and related. Fetch the full "
            "catalog for src citations and the framework table."
        ),
        "updated": classic_out["updated"],
        "count": classic_out["count"],
        "principles": principles,
    }


def slim_agentic(agentic_out):
    principles = [
        {
            "id": p["id"],
            "section": p["section"],
            "category": p["category"],
            "statement": p["statement"],
        }
        for p in agentic_out["principles"]
    ]
    gap = {
        k: {
            "classic_ids": v["classic_ids"],
            "kind": v["kind"],
            "note": v["note"],
        }
        for k, v in agentic_out["gap_index"].items()
    }
    return {
        "$schema_version": "1.0",
        "projection": "slim",
        "full_catalog": f"{SITE}/data/ai-agentic-principles.json",
        "description": (
            "Slim projection of ai-agentic-principles.json for assessment "
            "mapping: id, section, category, statement, and gap_index. Fetch "
            "the full catalog for src citations and the sources table."
        ),
        "updated": agentic_out["updated"],
        "count": agentic_out["count"],
        "gap_index_description": agentic_out["gap_index_description"],
        "gap_index": gap,
        "principles": principles,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Classic catalog: normalize the OSCAL source
# ─────────────────────────────────────────────────────────────────────────────

FRAMEWORK_KEY = {
    "saltzer-schroeder": "sch",
    "nist-sp800-27": "nist27",
    "iso-27001-2022": "iso27001",
    "cis-v8-design-principles": "cis-design",
    "cis-v8-1-controls": "cis18",
    "ms-immutable-laws-v2": "ms-immutable",
    "ms-cybersecurity-risk-laws": "ms-risk",
    "cloud-architecture-corollaries": "cloud",
}

# Entries different frameworks state as literal restatements of one principle.
# Merged into a single canonical entry citing every source. Principles that are
# merely thematically related stay separate and cross-link through `related`,
# because collapsing those would cost checklist resolution.
CLASSIC_MERGES = {
    "least-privilege": {
        "statement": "Grant only the minimum access needed to perform a task, nothing more.",
        "category": "access-control",
        "members": ["sch-1", "nist-p26"],
    },
    "economy-of-mechanism": {
        "statement": "Keep designs small and simple enough to verify and reason about.",
        "category": "design",
        "members": ["sch-4", "nist-p24"],
    },
    "psychological-acceptability": {
        "statement": "Security controls that are too painful or that hurt productivity get bypassed by real users, so ease of use is a security requirement, not a nice-to-have.",
        "category": "human-factors",
        "members": ["sch-8", "nist-p15", "ms-risk-3"],
    },
    "encryption-is-not-sufficient": {
        "statement": "Encryption is only as strong as its key management; encryption alone does not constitute a data protection program.",
        "category": "data-protection",
        "members": ["ms-immutable-7", "ms-risk-9"],
    },
    "technology-is-not-a-panacea": {
        "statement": "Technology does not solve people and process problems; it is not a substitute for governance, training, and operational discipline.",
        "category": "human-factors",
        "members": ["ms-immutable-10", "ms-risk-10"],
    },
}


def props_dict(node):
    return {p["name"]: p["value"] for p in node.get("props", [])}


def links_by_rel(node, rel):
    return [l["href"].lstrip("#") for l in node.get("links", []) if l.get("rel") == rel]


def statement_of(control):
    for part in control.get("parts", []):
        if part.get("name") == "statement":
            return part.get("prose", "").strip()
    return control.get("title", "").strip()


def build_classic():
    with open(os.path.join(ROOT, OSCAL_SRC), encoding="utf-8") as fh:
        src = json.load(fh)
    groups = src["catalog"]["groups"]

    frameworks = {}
    for g in groups:
        if g["id"] not in FRAMEWORK_KEY:
            fail(f"unknown OSCAL group id {g['id']!r}; add it to FRAMEWORK_KEY")
        p = props_dict(g)
        entry = {"name": g["title"]}
        if "publisher" in p:
            entry["publisher"] = p["publisher"]
        if "status" in p:
            entry["status"] = p["status"]
        refs = links_by_rel(g, "reference")
        if refs:
            entry["reference"] = refs[0]
        frameworks[FRAMEWORK_KEY[g["id"]]] = entry

    raw = {}

    def walk(node, fw_key, subgroup=None):
        for c in node.get("controls", []):
            entry = {
                "statement": statement_of(c),
                "category": props_dict(c).get("category"),
                "fw": fw_key,
            }
            if subgroup:
                entry["subgroup"] = subgroup
            rel = links_by_rel(c, "related")
            if rel:
                entry["related_raw"] = rel
            raw[c["id"]] = entry
        for sub in node.get("groups", []):
            walk(sub, fw_key, subgroup=sub.get("title"))

    for g in groups:
        walk(g, FRAMEWORK_KEY[g["id"]])

    canon = {}
    for cid, spec in CLASSIC_MERGES.items():
        for m in spec["members"]:
            if m not in raw:
                fail(f"merge {cid!r} names unknown control id {m!r}")
            canon[m] = cid
    for rid in raw:
        canon.setdefault(rid, rid)

    # Symmetric related graph, remapped onto canonical ids.
    adj = {}
    for rid, e in raw.items():
        for target in e.get("related_raw", []):
            if target not in raw:
                continue
            adj.setdefault(rid, set()).add(target)
            adj.setdefault(target, set()).add(rid)

    related_canon = {}
    for rid, targets in adj.items():
        me = canon[rid]
        for t in targets:
            other = canon[t]
            if other != me:
                related_canon.setdefault(me, set()).add(other)

    principles = {}
    for cid, spec in CLASSIC_MERGES.items():
        principles[cid] = {
            "id": cid,
            "statement": spec["statement"],
            "category": spec["category"],
            "src": [{"fw": raw[m]["fw"], "ref": m} for m in spec["members"]],
        }
    for rid, e in raw.items():
        if canon[rid] != rid:
            continue
        p = {
            "id": rid,
            "statement": e["statement"],
            "category": e["category"],
            "src": [{"fw": e["fw"], "ref": rid}],
        }
        if e.get("subgroup"):
            p["subgroup"] = e["subgroup"]
        principles[rid] = p

    for cid, targets in related_canon.items():
        principles[cid]["related"] = sorted(targets)

    covered = {s["ref"] for p in principles.values() for s in p["src"]}
    missing = set(raw) - covered
    if missing:
        fail(f"classic catalog lost control ids: {sorted(missing)}")

    ordered = sorted(principles.values(),
                     key=lambda p: (p["category"] or "zzz", p["id"]))
    return frameworks, ordered, len(raw)


# ─────────────────────────────────────────────────────────────────────────────
# AI-agentic catalog: parse the synthesis and apply curation
# ─────────────────────────────────────────────────────────────────────────────

# One entry per bullet, in document order, per section. Actions:
#   (id, category)        a principle in its own right
#   ("=", target-id)      a restatement the document itself calls a restatement;
#                         folded into target-id, contributing only its sources
#   ("x", reason)         a sentence describing an absence of coverage in the
#                         corpus rather than a claim any source makes; excluded
#                         from the principle list and carried in gap_index
CURATION = {
    "agent-identity": [
        ("distinct-agent-identity", "identity"),
        ("identity-claims-cryptographically-verifiable", "identity"),
        ("credentials-short-lived-task-scoped", "identity"),
        ("non-human-identity-lifecycle-management", "identity"),
        ("no-implicit-trust-between-agents", "identity"),
        ("agentic-iam-extends-existing-iam", "identity"),
    ],
    "zero-standing-privilege": [
        ("continuous-reverification", "access-control"),
        ("short-lived-scoped-revocable-credentials", "access-control"),
        ("least-privilege-extends-to-decision-layer", "access-control"),
        ("controls-scale-with-capability-and-sensitivity", "risk-management"),
        ("fine-grained-attribute-policy-access-control", "access-control"),
    ],
    "delegation-chains": [
        ("delegation-narrows-never-expands", "access-control"),
        ("no-raw-token-forwarding", "access-control"),
        ("per-hop-independent-authorization", "access-control"),
        ("delegation-traceable-to-human-principal", "monitoring"),
        ("revocation-cascades-downstream", "access-control"),
        ("retrieval-agent-never-exceeds-invoker-entitlements", "access-control"),
        ("no-self-approval-of-deployment", "access-control"),
    ],
    "ephemeral-execution": [
        ("zero-state-initialization", "design"),
        ("access-grants-expire-automatically", "access-control"),
        ("guaranteed-teardown", "design"),
        ("ephemerality-as-containment", "resilience"),
        ("default-deny-egress-bounded-swarm", "resilience"),
    ],
    "human-oversight": [
        ("intervention-capability-regardless-of-autonomy", "agent-autonomy"),
        ("approval-before-high-impact-actions", "agent-autonomy"),
        ("kill-switch-or-budget-limit", "agent-autonomy"),
        ("oversight-scales-with-autonomy-and-risk", "agent-autonomy"),
        ("override-authority-explicitly-assigned", "governance"),
        ("continuous-validation-against-purpose", "resilience"),
    ],
    "observability": [
        ("immutable-tamper-evident-logging", "monitoring"),
        ("telemetry-covers-full-decision-path", "monitoring"),
        ("execution-provenance-traceable-as-inventory", "monitoring"),
        ("observability-extends-to-goals-and-decisions", "monitoring"),
        ("extend-existing-logging-controls-to-agents", "monitoring"),
        ("agent-component-inventory-covers-full-stack", "monitoring"),
    ],
    "untrusted-input": [
        ("treat-tool-descriptions-and-content-as-untrusted", "input-validation"),
        ("validate-at-every-trust-boundary", "input-validation"),
        ("lethal-trifecta-rule-of-two", "risk-management"),
        ("chat-visibility-not-execution-control", "input-validation"),
        ("agents-amplify-not-new-vuln-class", "risk-management"),
        ("deterministic-controls-outside-reasoning-loop", "access-control"),
        ("agent-security-spans-distinct-control-layers", "design"),
    ],
    "mcp-security": [
        ("explicit-per-capability-grants", "access-control"),
        ("oauth-oidc-per-request-validation", "mcp-protocol"),
        ("dual-signoff-third-party-mcp", "governance"),
        ("containers-not-sufficient-mcp-boundary", "mcp-protocol"),
        ("isolated-sessions-no-shared-state", "mcp-protocol"),
        ("error-responses-no-internal-details", "mcp-protocol"),
        ("real-mcp-incidents-cited", "risk-management"),
    ],
    "supply-chain": [
        ("provenance-via-signed-manifests-sbom", "supply-chain"),
        ("pinned-checksum-verified-versions", "supply-chain"),
        ("signing-extends-to-runtime-dependencies", "supply-chain"),
        ("supply-chain-inseparable-from-secure-by-design", "supply-chain"),
        ("agent-skills-are-supply-chain-artifacts", "supply-chain"),
    ],
    "shared-responsibility": [
        ("exactly-one-accountable-party", "governance"),
        ("accountability-shifts-with-autonomy", "governance"),
        ("model-safety-vs-deployment-security-distinct", "governance"),
        ("accountability-depends-on-operating-model", "governance"),
        ("shared-responsibility-complements-process-frameworks", "governance"),
        ("layer-dependencies-invariant-of-org-structure", "governance"),
    ],
    "emerging-risk-models": [
        ("shadow-ai-already-present", "risk-management"),
        ("attribution-gap-structural", "identity"),
        ("safety-security-cannot-be-governed-separately", "governance"),
    ],
    "architectural-risk": [
        ("architecture-risk-analysis-before-bolt-on-fixes", "design"),
        ("classic-design-principles-apply-to-ml", "design"),
        ("training-data-curation-is-foundational", "data-protection"),
        ("skepticism-toward-redteaming-alone", "red-teaming"),
        ("recursive-pollution-guarded-against", "data-protection"),
        ("inherited-backdoor-risk-in-pretrained-models", "supply-chain"),
        ("cryptographic-grade-randomness-for-weights", "design"),
        ("process-based-security-assurance", "governance"),
    ],
    "supply-chain-provenance": [
        ("signed-artifact-tying-producer-identity", "supply-chain"),
        ("no-unsafe-serialization-formats", "supply-chain"),
        ("no-loading-unsigned-artifacts", "supply-chain"),
        ("provenance-continuously-monitored", "supply-chain"),
        ("internal-model-not-assumed-safer", "supply-chain"),
        ("staged-signature-maturity-path", "supply-chain"),
        ("aibom-is-a-governance-artifact", "supply-chain"),
        ("classification-labels-propagate", "data-protection"),
    ],
    "adversarial-ml": [
        ("attack-objective-maps-to-three-violations", "adversarial-ml"),
        ("defenses-evaluated-against-adaptive-adversaries", "adversarial-ml"),
        ("no-mitigation-absolute-guarantee", "adversarial-ml"),
        ("robustness-accuracy-tradeoff-inherent", "adversarial-ml"),
        ("predai-genai-distinct-taxonomies", "adversarial-ml"),
        ("standardized-terminology-across-communities", "governance"),
    ],
    "risk-governance": [
        ("govern-runs-continuously-through-other-functions", "governance"),
        ("unacceptable-risk-stops-the-system", "risk-management"),
        ("risk-frameworks-and-control-catalogs-differ", "governance"),
        ("control-ownership-assigned-per-role", "governance"),
        ("valid-reliable-is-base-condition", "governance"),
        ("governance-considers-whether-to-build-at-all", "governance"),
    ],
    "data-security": [
        ("sensitive-data-encrypted-always", "data-protection"),
        ("non-human-identities-rotated-periodically", "identity"),
        ("=", "classification-labels-propagate"),
        ("deletion-does-not-guarantee-model-removal", "data-protection"),
        ("each-lifecycle-stage-is-its-own-exposure-point", "data-protection"),
        ("context-window-is-flat-namespace", "data-protection"),
    ],
    "incident-response": [
        ("security-is-a-cross-role-effort", "incident-response"),
        ("five-incident-domains", "incident-response"),
        ("forensic-logging-containment-preserves-evidence", "incident-response"),
        ("every-critical-system-has-an-owner", "governance"),
        ("permanent-vulnerability-operations-capability", "incident-response"),
        ("blameless-postincident-review-fixes-root-cause", "incident-response"),
        ("contributors-accountable-for-ai-assisted-work", "governance"),
        ("blast-radius-containment-via-segmentation", "resilience"),
        ("treat-environments-as-potentially-compromised", "incident-response"),
    ],
    "red-teaming": [
        ("no-vendor-claims-full-coverage", "red-teaming"),
        ("critical-findings-require-human-verification", "red-teaming"),
        ("tool-calls-never-assumed-safe-during-testing", "red-teaming"),
        ("testing-calibrated-to-system-maturity", "red-teaming"),
        ("destructive-testing-in-sandbox-only", "red-teaming"),
        ("redteam-vendors-governed-as-privileged-third-party", "governance"),
        ("hazardous-capability-eval-is-a-release-gate", "red-teaming"),
    ],
    "llm-appsec": [
        ("untrusted-content-segregated-and-labeled", "input-validation"),
        ("access-control-never-delegated-to-model", "access-control"),
        ("tool-permissions-never-exceed-function-need", "access-control"),
        ("strict-separation-of-prompts-under-change-control", "design"),
        ("model-wrong-or-manipulated-is-constant-condition", "risk-management"),
        ("agent-controls-depend-on-model-infra-controls", "design"),
        ("assistant-instruction-files-encode-defaults", "design"),
    ],
    "enterprise-readiness": [
        ("=", "access-control-never-delegated-to-model"),
        ("complexity-is-the-enemy-of-security", "design"),
        ("blocking-ai-use-is-not-a-viable-control", "governance"),
        ("model-registries-non-negotiable", "governance"),
        ("board-level-accountability-for-ai-risk", "governance"),
        ("identity-is-the-primary-attack-surface", "identity"),
        ("guidance-is-explicitly-point-in-time", "governance"),
        ("three-track-governance-model", "governance"),
        ("programs-remain-reactive-despite-known-better", "risk-management"),
    ],
    "decommissioning-availability": [
        ("decommissioning-is-a-designed-capability", "resilience"),
        ("dos-is-its-own-threat-category", "resilience"),
        ("x", "No source addresses AI-specific disaster recovery, business continuity, or failover. The silence spans all 52 sources."),
    ],
    "human-factors": [
        ("x", "Classic security engineering treats control usability as inseparable from effectiveness. The AI-specific corpus does not engage with that warning."),
        ("simpler-architecture-easier-to-operate-correctly", "human-factors"),
        ("x", "No source examines whether friction from its own recommended controls leads operators to disable or route around them."),
    ],
}

# Each section's Gap note resolved to the classic-catalog id(s) it points at.
# kind: gap                  the classic catalog asks something the corpus does not answer
#       editorial            the document takes an explicit position rather than reporting a dispute
#       unaddressed-in-corpus the document flags an absence spanning all 52 sources
GAP_INDEX = {
    "agent-identity": (["ms-immutable-5"], "gap"),
    "zero-standing-privilege": (["sch-2"], "gap"),
    "delegation-chains": (["nist-p31"], "gap"),
    "ephemeral-execution": (["nist-p20"], "gap"),
    "human-oversight": (["nist-p7"], "gap"),
    "observability": (["nist-p4"], "gap"),
    "untrusted-input": (["cis-design-2"], "gap"),
    "mcp-security": (["encryption-is-not-sufficient"], "gap"),
    "supply-chain": (["ms-immutable-3"], "gap"),
    "shared-responsibility": (["nist-p1"], "gap"),
    "emerging-risk-models": (["corollary-2"], "gap"),
    "architectural-risk": (["sch-5"], "editorial"),
    "supply-chain-provenance": (["cis-design-3"], "gap"),
    "adversarial-ml": (["cis18-12"], "gap"),
    "risk-governance": (["cis-design-1"], "gap"),
    "data-security": (["ms-immutable-9"], "gap"),
    "incident-response": (["ms-risk-8"], "gap"),
    "red-teaming": (["cis-design-4"], "editorial"),
    "llm-appsec": (["cis18-9"], "gap"),
    "enterprise-readiness": (["ms-risk-1"], "gap"),
    "decommissioning-availability": (["cis18-11", "nist-p23"], "unaddressed-in-corpus"),
    "human-factors": (["psychological-acceptability"], "unaddressed-in-corpus"),
}

SECTION_RE = re.compile(r"^## (\d+)\. (.+?) \{#([a-z0-9-]+)\}\s*$")
CROSSWALK_RE = re.compile(r"^\*\*OpenCRE crosswalk:\*\* (.+?)\.?\s*$")
GAP_RE = re.compile(r"^\*\*(Gap[^:]*):\*\* (.+?)\s*$")
SRC_ROW_RE = re.compile(
    r"^\| ([A-Z][A-Z0-9-]+) \| (.+?) \| (.+?) \| (.+?) \| (\S+) \|$", re.M)


def parse_synthesis():
    with open(os.path.join(ROOT, SYNTH_SRC), encoding="utf-8") as fh:
        md = fh.read()

    sources = {}
    for code, title, org, date, link in SRC_ROW_RE.findall(md):
        sources[code] = {"title": title.strip(), "org": org.strip(),
                         "date": date.strip(), "url": link.strip()}

    sections = {}
    order = []
    cur = None
    for line in md.split("\n"):
        m = SECTION_RE.match(line)
        if m:
            cur = m.group(3)
            order.append(cur)
            sections[cur] = {"n": int(m.group(1)), "title": m.group(2),
                             "bullets": [], "opencre_crosswalk": [], "gap": None}
            continue
        if not cur:
            continue
        if line.startswith("- "):
            sections[cur]["bullets"].append(line[2:].strip())
            continue
        m = CROSSWALK_RE.match(line)
        if m:
            sections[cur]["opencre_crosswalk"] = [
                s.strip() for s in m.group(1).split(",") if s.strip()]
            continue
        m = GAP_RE.match(line)
        if m:
            sections[cur]["gap"] = m.group(2).strip()
    return sources, sections, order


def split_citation(bullet, known_codes):
    """Split a bullet into (statement, [source codes]).

    Citations are a trailing parenthesized group naming source codes. Some
    carry prose alongside the code ('cross-referenced with OWASP-STATE'), so
    match known codes inside the group rather than assuming a bare list.
    """
    m = re.search(r"\(([^()]*)\)\s*$", bullet)
    if not m:
        return bullet.strip(), []
    inner = m.group(1)
    codes = [c for c in re.findall(r"[A-Z][A-Z0-9-]+", inner) if c in known_codes]
    if not codes:
        return bullet.strip(), []
    return bullet[:m.start()].strip().rstrip(",;"), codes


def build_agentic():
    sources, sections, order = parse_synthesis()

    if set(CURATION) != set(sections):
        fail("CURATION sections do not match the synthesis: "
             f"only in curation {sorted(set(CURATION) - set(sections))}, "
             f"only in document {sorted(set(sections) - set(CURATION))}")
    if set(GAP_INDEX) != set(sections):
        fail("GAP_INDEX sections do not match the synthesis")

    principles = {}
    excluded = []
    raw_bullets = 0
    merged = 0

    for anchor in order:
        sec = sections[anchor]
        rules = CURATION[anchor]
        if len(rules) != len(sec["bullets"]):
            fail(f"section {anchor!r} has {len(sec['bullets'])} bullets but "
                 f"{len(rules)} curation entries; the synthesis changed, so "
                 "update CURATION to match")
        for rule, bullet in zip(rules, sec["bullets"]):
            raw_bullets += 1
            statement, codes = split_citation(bullet, sources)
            unknown = [c for c in codes if c not in sources]
            if unknown:
                fail(f"bullet in {anchor!r} cites unknown source code {unknown}")
            key, value = rule
            if key == "x":
                excluded.append({"section": anchor, "reason": value,
                                 "text": statement})
                continue
            if key == "=":
                merged += 1
                target = principles.get(value)
                if target is None:
                    fail(f"section {anchor!r} merges a bullet into {value!r}, "
                         "which is not defined earlier in document order")
                for c in codes:
                    if c not in target["src"]:
                        target["src"].append(c)
                continue
            pid, category = key, value
            if pid in principles:
                fail(f"duplicate principle id {pid!r}")
            principles[pid] = {"id": pid, "section": anchor,
                               "category": category, "statement": statement,
                               "src": list(codes)}

    ordered = sorted(principles.values(),
                     key=lambda p: (sections[p["section"]]["n"], p["id"]))

    sections_out = {a: {"n": sections[a]["n"], "title": sections[a]["title"],
                        "opencre_crosswalk": sections[a]["opencre_crosswalk"]}
                    for a in order}

    gap_out = {}
    for anchor in order:
        ids, kind = GAP_INDEX[anchor]
        note = sections[anchor]["gap"]
        if not note:
            fail(f"section {anchor!r} has no Gap note in the synthesis")
        gap_out[anchor] = {"classic_ids": ids, "kind": kind, "note": note}

    return sources, sections_out, gap_out, ordered, excluded, raw_bullets, merged


# ─────────────────────────────────────────────────────────────────────────────
# Candidate queue integrity
# ─────────────────────────────────────────────────────────────────────────────

CANDIDATES = "data/principle-candidates.json"

VALID_STATUS = {"proposed", "triaged", "accepted", "extended", "rejected", "deferred"}
VALID_RELATION = {"covers", "partial", "adjacent"}


def check_candidates(classic_ids, agentic_ids):
    """Validate the hand-maintained candidate queue against the built catalogs.

    The queue is not generated, so nothing keeps it honest automatically. Two
    things rot silently without this check: a closest_existing id pointing at a
    principle that has since been renamed or merged away, and a candidate marked
    accepted whose statement was never actually written into a source. Both
    would leave the queue quietly wrong while every other check still passes.
    """
    path = os.path.join(ROOT, CANDIDATES)
    if not os.path.exists(path):
        return {"candidates": 0, "note": "no candidate queue present"}

    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)

    cands = data.get("candidates", [])
    if data.get("count") != len(cands):
        fail(f"{CANDIDATES}: count is {data.get('count')} but there are "
             f"{len(cands)} candidates")

    seen = set()
    by_status = {}
    for c in cands:
        cid = c.get("id")
        if not cid:
            fail(f"{CANDIDATES}: a candidate has no id")
        if cid in seen:
            fail(f"{CANDIDATES}: duplicate candidate id {cid!r}")
        seen.add(cid)

        status = c.get("status")
        if status not in VALID_STATUS:
            fail(f"{CANDIDATES}: {cid} has status {status!r}; expected one of "
                 f"{sorted(VALID_STATUS)}")
        by_status[status] = by_status.get(status, 0) + 1

        for ref in c.get("closest_existing", []):
            rid, cat = ref.get("id"), ref.get("catalog")
            rel = ref.get("relation")
            if rel not in VALID_RELATION:
                fail(f"{CANDIDATES}: {cid} closest_existing {rid!r} has relation "
                     f"{rel!r}; expected one of {sorted(VALID_RELATION)}")
            pool = classic_ids if cat == "classic" else agentic_ids
            if cat not in ("classic", "agentic"):
                fail(f"{CANDIDATES}: {cid} closest_existing {rid!r} names unknown "
                     f"catalog {cat!r}")
            if rid not in pool:
                fail(f"{CANDIDATES}: {cid} closest_existing points at {rid!r}, "
                     f"which is not in the {cat} catalog. The principle was "
                     "probably renamed or merged; update the candidate.")

        # An accepted candidate must say where it landed, and a candidate that
        # has not been accepted must not claim it landed anywhere.
        landed = c.get("incorporated_into")
        if status == "accepted" and landed:
            pass
        elif status == "accepted" and not landed:
            print(f"  PENDING  {cid} is accepted but incorporated_into is null; "
                  "the statement is not in any catalog source yet")
        elif landed:
            fail(f"{CANDIDATES}: {cid} has status {status!r} but claims "
                 f"incorporated_into={landed!r}")

    return {"candidates": len(cands), "by_status": by_status}


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    check = "--check" in sys.argv

    frameworks, classic, classic_raw = build_classic()
    (agentic_sources, agentic_sections, gap_index, agentic,
     excluded, raw_bullets, merged) = build_agentic()

    # Every classic id referenced by a gap note must resolve.
    classic_ids = {p["id"] for p in classic}
    dangling = sorted({cid for g in gap_index.values()
                       for cid in g["classic_ids"] if cid not in classic_ids})
    if dangling:
        fail(f"gap_index references unknown classic principle ids: {dangling}")

    agentic_ids = {p["id"] for p in agentic}
    candidates_summary = check_candidates(classic_ids, agentic_ids)

    classic_out = {
        "$schema_version": "1.0",
        "description": (
            "Classic security engineering principles, axioms, and invariables, "
            "normalized from an OSCAL catalog into a flat checklist. Covers "
            "Saltzer and Schroeder, NIST SP 800-27, ISO 27001, CIS Controls "
            "v8/v8.1, Microsoft's two law sets, and cloud architecture "
            "corollaries. Companion catalog: ai-agentic-principles.json."),
        "updated": UPDATED,
        "generated_from": OSCAL_SRC,
        "method": (
            "Flattened from nested OSCAL catalog/group/control structure to a "
            "flat principle list with a framework lookup table. Entries that "
            "different frameworks state as literal restatements of one "
            "principle were merged into a single entry citing every source. "
            "Entries that are thematically related but analytically distinct "
            "stay separate and cross-reference through `related`, since "
            "collapsing them would cost checklist resolution. Every original "
            "control id remains traceable through `src`. CRE-ID mapping to "
            "OpenCRE is not done; category tags are a starting filter, not "
            "final mappings."),
        "source_control_count": classic_raw,
        "count": len(classic),
        "frameworks": frameworks,
        "principles": classic,
    }

    agentic_out = {
        "$schema_version": "1.0",
        "description": (
            "Contemporary AI and agentic security principles, normalized from "
            "a 52-source synthesis (BIML, CIS, CSA, CoSAI, NIST, OWASP, SANS, "
            "ETSI, ENISA, FMF, OpenSSF, AI Verify, 2019 to 2026) organized into 22 topic sections. These are current "
            "industry positions, not settled axioms; weigh disagreement with "
            "an entry here less heavily than disagreement with the classic "
            "catalog. Companion catalog: security-principles.json."),
        "updated": UPDATED,
        "generated_from": SYNTH_SRC,
        "source_document": f"{SITE}/agentic-ai-security/",
        "method": (
            "Bulleted claims transcribed per section with their original "
            "citations. Bullets the synthesis itself calls restatements of an "
            "earlier claim were merged, contributing only their sources. "
            "Sentences describing an absence of coverage in the corpus, rather "
            "than a claim any source makes, were excluded from the principle "
            "list and are carried in `gap_index` instead, so a statement about "
            "what nobody said is not represented as if somebody said it."),
        "raw_bullet_count": raw_bullets,
        "merged_restatements": merged,
        "excluded_absence_statements": len(excluded),
        "count": len(agentic),
        "gap_index_description": (
            "Each section's own Gap note, resolved to the specific principle "
            "id(s) in security-principles.json that the note points at. Treat "
            "this as a known field-wide blind spot list, not a defect in any "
            "one paper."),
        "sources": agentic_sources,
        "sections": agentic_sections,
        "gap_index": gap_index,
        "excluded_statements": excluded,
        "principles": agentic,
    }

    summary = {
        "classic_source_controls": classic_raw,
        "classic_principles": len(classic),
        "agentic_source_documents": len(agentic_sources),
        "agentic_sections": len(agentic_sections),
        "agentic_raw_bullets": raw_bullets,
        "agentic_principles": len(agentic),
        "agentic_merged": merged,
        "agentic_excluded": len(excluded),
        "gap_index_entries": len(gap_index),
        "candidate_queue": candidates_summary,
    }

    if check:
        print("CHECK OK:", json.dumps(summary))
        return

    written = [
        write_json("data/security-principles.json", classic_out),
        write_json("data/security-principles.slim.json", slim_classic(classic_out)),
        write_json("data/ai-agentic-principles.json", agentic_out),
        write_json("data/ai-agentic-principles.slim.json", slim_agentic(agentic_out)),
    ]
    print(f"Wrote {len(written)} files.")
    print("Summary:", json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
