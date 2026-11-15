"""How an instrument in data/regulations.json counts as an obligation.

source_kind is one of binding, voluntary_standard, or catalog.
A catalog is not an obligation. A binding instrument or a voluntary
standard is a current obligation unless the record is draft, rescinded,
or tagged proposed, or the record sets current_obligation to false.
"""
import re

SOURCE_KINDS = ("binding", "voluntary_standard", "catalog")

# Named in the ROCA decision so a rename cannot silently turn them into duties.
REQUIRED_CATALOGS = (
    "owasp-llm-top10",
    "mitre-atlas",
    "csa-aicm",
    "cis-controls",
)


def citation_pattern(text):
    """Compile a citation_match token.

    A trailing word boundary is added only when the token ends in a letter
    or digit. A token that ends in punctuation, such as Section 4(b)(iii),
    would never match if a boundary were required after the closing
    parenthesis.
    """
    pattern = re.escape(text)
    if text and text[-1].isalnum():
        pattern += r"\b"
    return re.compile(pattern, re.I)


def current_obligation(item):
    """Return whether the map should treat this instrument as a current duty."""
    if "current_obligation" in item:
        return bool(item["current_obligation"])
    if item.get("source_kind") == "catalog":
        return False
    if item.get("lifecycle") in ("draft", "rescinded"):
        return False
    tags = item.get("tags") or []
    if "proposed" in tags:
        return False
    return item.get("source_kind") in ("binding", "voluntary_standard")
