#!/usr/bin/env python3
"""Reader-facing labels for industry controls browsers (shared with verify_pages)."""
import re

# Bill's short filter labels for cosai-core personas (finance controls browser).
CORE_PERSONA_FILTER = {
    "ai-system-governance": "AI Governance",
    "data-provider": "Data Provider",
    "application-developer": "App Developer",
    "agentic-platform-provider": "Agentic Platform",
    "ai-platform-provider": "AI Platform",
    "model-provider": "AI Model Provider",
}

ACRONYMS = {
    "caio": "CAIO",
    "ciso": "CISO",
    "cfo": "CFO",
    "fda": "FDA",
    "ot": "OT",
    "dpo": "DPO",
    "siem": "SIEM",
    "fhir": "FHIR",
    "ocsf": "OCSF",
    "api": "API",
    "iam": "IAM",
    "csp": "CSP",
    "crm": "CRM",
    "ai": "AI",
    "ca": "CA",
    "cio": "CIO",
    "pii": "PII",
    "phi": "PHI",
    "hipaa": "HIPAA",
    "fedramp": "FedRAMP",
    "omb": "OMB",
    "nist": "NIST",
    "eu": "EU",
    "iec": "IEC",
    "iso": "ISO",
    "owasp": "OWASP",
    "doi": "DoI",
    "dod": "DoD",
    "il": "IL",
    "nss": "NSS",
    "naic": "NAIC",
    "nydfs": "NYDFS",
    "mrm": "MRM",
    "cds": "CDS",
    "ehr": "EHR",
    "on": "ONC",
    "htm": "HTM",
    "pct": "percent",
}

ARTICLES_BEFORE = frozenset({"notify", "alert", "page", "escalate", "notifythe"})

WORD_EXPAND = {"pct": "percent", "num": "number", "max": "maximum", "min": "minimum"}


def is_param_constant(value):
    if value is None:
        return False
    s = str(value).strip()
    if not s:
        return False
    if s.startswith("TIER_"):
        return True
    return bool(re.fullmatch(r"[A-Z][A-Z0-9_]*", s))


def _tokens(slug):
    raw = re.sub(r"[_\s]+", "-", str(slug or "").strip())
    return [t for t in raw.split("-") if t]


def _format_token(tok, sentence=False):
    low = tok.lower()
    if low in ACRONYMS:
        return ACRONYMS[low]
    if re.fullmatch(r"[A-Z][A-Z0-9]{1,}", tok):
        return tok
    if low in WORD_EXPAND:
        word = WORD_EXPAND[low]
        return word if sentence else word[:1].upper() + word[1:]
    if sentence:
        return low
    return low[:1].upper() + low[1:] if low else ""


def format_slug_phrase(slug, sentence=False):
    toks = [_format_token(t, sentence=sentence) for t in _tokens(slug)]
    if not toks:
        return ""
    if toks[0].lower() in {"identify", "notify", "alert", "page", "escalate", "block",
                           "halt", "suspend", "reject", "quarantine", "void", "purge",
                           "trigger", "initiate", "convene", "assign", "complete",
                           "document", "draft", "extend", "enable", "implement",
                           "obtain", "create", "schedule", "review", "investigate",
                           "revert", "reinstate", "deprovision", "terminate", "isolate",
                           "hold", "raise", "withdraw", "apply", "deploy"}:
        pass
    else:
        return " ".join(toks)
    first = toks[0]
    rest = toks[1:]
    if rest and first.lower() in {"notify", "alert", "page", "escalate"}:
        if rest[-1] in set(ACRONYMS.values()) or rest[-1].isupper():
            if rest[0].lower() == "to":
                rest = ["the"] + rest[1:]
            elif rest[-1] in set(ACRONYMS.values()):
                rest = rest[:-1] + ["the", rest[-1]]
    return " ".join([first] + rest)


def format_breach_action(raw):
    if not raw:
        return ""
    parts = re.split(r"[;]", str(raw))
    sentences = []
    for part in parts:
        phrase = format_slug_phrase(part.strip(), sentence=True)
        if not phrase:
            continue
        if not phrase.endswith("."):
            phrase += "."
        sentences.append(phrase[0].upper() + phrase[1:] if phrase else phrase)
    return " ".join(sentences)


def format_metric(metric):
    if not metric:
        return ""
    if not re.search(r"[_]", str(metric)) and " " in str(metric):
        return str(metric)
    words = [_format_token(t) for t in re.split(r"[_]+", str(metric).strip()) if t]
    return " ".join(words)


def format_param_type(param_type):
    if not param_type:
        return ""
    return format_slug_phrase(param_type)


def format_window(window):
    if not window:
        return ""
    return format_slug_phrase(window)


INDUSTRY_CONTROLS = (
    "finance/controls/index.html",
    "healthcare/controls/index.html",
    "insurance/controls/index.html",
    "public-sector/controls/index.html",
    "defense/controls/index.html",
    "manufacturing/controls/index.html",
    "tapestry/controls/index.html",
)

FORBIDDEN_RE = [
    re.compile(r"<code>\s*'\s*\+\s*escHtml\(c\.accountable_persona\)"),
    re.compile(r"<code>\$\{escHtml\(c\.accountable_persona\)\}"),
    re.compile(r"&middot;\s*<code>'\s*\+\s*escHtml\(c\.accountable_persona\)"),
    re.compile(r"·\s*<code>\$\{escHtml\(c\.accountable_persona\)\}"),
    re.compile(r"threshold-label\">Param"),
    re.compile(r"detail-field__label\">Operator\s*/\s*Param"),
    re.compile(r"escHtml\(t\.breach_action\)\s*\+\s*'</span>'"),
    re.compile(r"escHtml\(t\.breach_action\)\}</code>"),
    re.compile(r"<strong>On breach:</strong>\s*'\s*\+\s*escHtml\(t\.breach_action\)"),
]

REQUIRED_SNIPPET = "controls-browser-display.js"
READER_CSS = "controls-browser-reader.css"
READER_BANNED = re.compile(r"responsibility split|\bshape\b", re.IGNORECASE)

REGULATION_MAPPINGS_JS = "regulation-mappings.js"
REGULATION_READER_MARKERS = ("omitFromReader", "(mapping pending)")