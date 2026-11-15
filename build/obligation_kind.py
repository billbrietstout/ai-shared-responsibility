"""How an instrument in data/regulations.json counts as an obligation.

source_kind is one of binding, voluntary_standard, or catalog.
A catalog is not an obligation. A binding instrument or a voluntary
standard is a current obligation unless the record is draft, rescinded,
or tagged proposed, or the record sets current_obligation to false.
"""

SOURCE_KINDS = ("binding", "voluntary_standard", "catalog")

# Named in the ROCA decision so a rename cannot silently turn them into duties.
REQUIRED_CATALOGS = (
    "owasp-llm-top10",
    "mitre-atlas",
    "csa-aicm",
    "cis-controls",
)


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
