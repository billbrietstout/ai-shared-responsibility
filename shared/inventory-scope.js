/* Scope control for the slim monitor inventory.
   Native radio buttons supply the keyboard behavior. */
(function () {
  "use strict";

  var root = document.querySelector("[data-inventory]");
  if (!root) return;

  var mode = root.getAttribute("data-inventory-mode") || "render";
  var citedBox = document.getElementById("cited-sources");
  var mount = document.getElementById("inventory-mount");
  var statusEl = document.getElementById("inventory-status");
  var findInput = document.getElementById("inventory-find");
  var evidenceSet = document.getElementById("inventory-evidence-set");
  var scopeSet = document.getElementById("inventory-scope-set");
  var papers = [];
  var ready = false;

  var SCOPE_LABEL = {
    cited: "Cited in principles",
    org: "All included organization papers",
    research: "Cited research",
    all: "All papers, including cited research"
  };

  var EVIDENCE_LABEL = {
    all: "All levels",
    theoretical: "Theoretical",
    tested: "Tested",
    possibly_deployed: "Tested, possibly deployed (needs review)",
    deployed: "Deployed",
    untagged: "Not yet tagged"
  };

  var EVIDENCE_ALIASES = {
    "possibly-deployed": "possibly_deployed",
    possiblydeployed: "possibly_deployed"
  };

  var unknownEvidence = false;

  var CAPTION = {
    cited: "Papers the principles catalog cites. These are sources of the principles on this site.",
    org: "Included organization papers. Metadata only means principles have not been extracted. That row is not a source of principles.",
    research: "Cited research. Metadata only and duplicate rows are not sources of principles.",
    all: "Every inventory record. Metadata only, duplicate, and marked for removal are not sources of principles."
  };

  function selected(name) {
    var input = root.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : "";
  }

  function inScope(paper, scope) {
    if (scope === "cited") return Array.isArray(paper.cs) && paper.cs.length > 0;
    if (scope === "org") return paper.k === "org" && paper.dec === "include";
    if (scope === "research") return paper.k === "research";
    return true;
  }

  function expandCited(list) {
    var out = [];
    list.forEach(function (paper) {
      (paper.cs || []).forEach(function (item) {
        out.push({
          i: paper.i,
          n: paper.n,
          t: item.t || paper.t,
          u: item.u || paper.u,
          o: item.o || paper.o,
          dt: item.dt || paper.dt,
          dec: paper.dec,
          x: paper.x,
          k: paper.k,
          ev: paper.ev,
          ax: paper.ax,
          c: item.c,
          ord: item.ord
        });
      });
    });
    return out;
  }

  function isArxiv(paper) {
    return paper.ax === 1 || paper.k === "research" || Boolean(paper.ev);
  }

  function matchesEvidence(paper, level) {
    if (!level || level === "all") return true;
    if (level === "untagged") return !paper.ev;
    return paper.ev === level;
  }

  function matchesFind(paper, query) {
    if (!query) return true;
    var hay = [paper.i, paper.c, paper.t, paper.o, paper.dt, paper.ev]
      .join(" ")
      .toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function recordLabel(paper) {
    if (paper.dec === "duplicate") {
      return "Duplicate. Not a source of principles.";
    }
    if (paper.dec === "delete_candidate") {
      return "Marked for removal. Not a source of principles.";
    }
    if (paper.c) return "Cited in principles.";
    if (paper.x === "extracted") {
      return "Principles extracted in the inventory. This page's principle list does not cite it.";
    }
    return "Metadata only. Not a source of principles.";
  }

  function evidenceLabel(paper) {
    if (!paper.ev) return "Not yet tagged";
    return EVIDENCE_LABEL[paper.ev] || paper.ev;
  }

  function safeUrl(url) {
    return /^https?:\/\//i.test(url || "") ? url : "";
  }

  function makeLink(href, text) {
    var url = safeUrl(href);
    if (!url) {
      var span = document.createElement("span");
      span.textContent = text;
      return span;
    }
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.textContent = text;
    return anchor;
  }

  function cell(text, className) {
    var td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = text || "";
    return td;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function scopeList(scope) {
    var group = papers.filter(function (paper) {
      return inScope(paper, scope);
    });
    if (scope === "cited") return expandCited(group);
    return group;
  }

  function showEvidenceFilter(list) {
    if (!evidenceSet) return false;
    var show = list.some(isArxiv);
    if (show) evidenceSet.removeAttribute("hidden");
    else evidenceSet.setAttribute("hidden", "");
    return show;
  }

  function updateEvidenceCounts(list) {
    var buckets = {
      theoretical: 0,
      tested: 0,
      possibly_deployed: 0,
      deployed: 0,
      untagged: 0
    };
    list.forEach(function (paper) {
      if (!paper.ev) buckets.untagged += 1;
      else if (Object.prototype.hasOwnProperty.call(buckets, paper.ev)) {
        buckets[paper.ev] += 1;
      }
    });
    Object.keys(buckets).forEach(function (key) {
      var slot = root.querySelector('[data-ev-count="' + key + '"]');
      if (slot) slot.textContent = String(buckets[key]);
    });
    var untagged = root.querySelector('[data-evidence-option="untagged"]');
    if (untagged) {
      if (buckets.untagged === 0) untagged.setAttribute("hidden", "");
      else untagged.removeAttribute("hidden");
    }
    var untaggedInput = root.querySelector(
      'input[name="inventory-evidence"][value="untagged"]'
    );
    if (
      untaggedInput &&
      untaggedInput.checked &&
      buckets.untagged === 0
    ) {
      var all = root.querySelector(
        'input[name="inventory-evidence"][value="all"]'
      );
      if (all) all.checked = true;
    }
  }

  function sortPapers(list, scope) {
    return list.slice().sort(function (a, b) {
      if (scope === "cited" && a.ord != null && b.ord != null) {
        return a.ord - b.ord;
      }
      return a.i < b.i ? -1 : a.i > b.i ? 1 : 0;
    });
  }

  function filterStatic(query) {
    if (!citedBox) return 0;
    var shown = 0;
    citedBox.querySelectorAll("tbody tr").forEach(function (row) {
      var hit = !query || row.textContent.toLowerCase().indexOf(query) !== -1;
      row.hidden = !hit;
      if (hit) shown += 1;
    });
    return shown;
  }

  function renderTable(list, scope, showEvidence) {
    if (!mount) return;
    mount.replaceChildren();
    mount.hidden = false;
    var scroll = document.createElement("div");
    scroll.className = "inv-scroll";
    var table = document.createElement("table");
    table.className = "inv-table";
    var caption = document.createElement("caption");
    caption.textContent = CAPTION[scope] || "";
    table.appendChild(caption);
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var headers = ["ID", "Code", "Title", "Record"];
    if (showEvidence) headers.push("Evidence level");
    headers.push("Organization", "Date");
    headers.forEach(function (label) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    if (!list.length) {
      var empty = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = headers.length;
      td.textContent = emptyMessage(scope, showEvidence);
      empty.appendChild(td);
      tbody.appendChild(empty);
    }
    list.forEach(function (paper) {
      var tr = document.createElement("tr");
      var idCell = document.createElement("td");
      idCell.className = "inv-id";
      idCell.appendChild(
        makeLink(
          "https://github.com/billbrietstout/ai-security-whitepaper-monitor/issues/" +
            paper.n,
          paper.i
        )
      );
      tr.appendChild(idCell);
      tr.appendChild(cell(paper.c || ""));
      var titleCell = document.createElement("td");
      titleCell.appendChild(makeLink(paper.u, paper.t || paper.i));
      tr.appendChild(titleCell);
      tr.appendChild(cell(recordLabel(paper), "inv-record"));
      if (showEvidence) tr.appendChild(cell(evidenceLabel(paper)));
      tr.appendChild(cell(paper.o));
      tr.appendChild(cell(paper.dt));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    mount.appendChild(scroll);
  }

  function untaggedCount(list) {
    var n = 0;
    list.forEach(function (paper) {
      if (!paper.ev) n += 1;
    });
    return n;
  }

  function emptyMessage(scope, evidenceOn) {
    var msg = "No records match this filter.";
    if (!evidenceOn) return msg;
    var evidence = selected("inventory-evidence") || "all";
    if (evidence === "all") return msg;
    var group = scopeList(scope);
    var untagged = untaggedCount(group);
    if (untagged > 0) {
      msg +=
        " " +
        untagged +
        " of " +
        group.length +
        " records in this list are not tagged yet.";
    }
    return msg;
  }

  function describe(scope, total, shown, evidenceOn, evidence) {
    var text =
      (SCOPE_LABEL[scope] || "Records") +
      ". Showing " +
      shown +
      " of " +
      total +
      ".";
    if (unknownEvidence) {
      text += " Unknown evidence filter. Showing all levels.";
    } else if (evidenceOn && evidence && evidence !== "all") {
      text += " Evidence filter: " + (EVIDENCE_LABEL[evidence] || evidence) + ".";
      if (shown === 0) {
        var untagged = untaggedCount(scopeList(scope));
        if (untagged > 0) {
          text +=
            " " +
            untagged +
            " of " +
            total +
            " records in this list are not tagged yet.";
        }
      }
    } else if (evidenceOn) {
      text += " Evidence filter: all levels.";
      if (scope === "org" || scope === "cited") {
        var pending = untaggedCount(scopeList(scope));
        if (pending > 0) {
          text +=
            " " +
            pending +
            " of " +
            total +
            " are not tagged yet.";
        }
      }
    }
    if (scope === "cited" && citedBox) {
      text +=
        " Conference talks stay in the next table. They are not part of this count.";
    }
    if (scope === "research") {
      text +=
        " These records are not sources of the principles catalog.";
    }
    return text;
  }

  function writeUrl(scope, evidence, query) {
    var params = new URLSearchParams(window.location.search);
    if (scope && scope !== "cited") params.set("scope", scope);
    else params.delete("scope");
    if (evidence && evidence !== "all") params.set("evidence", evidence);
    else params.delete("evidence");
    if (query) params.set("q", query);
    else params.delete("q");
    var qs = params.toString();
    var next =
      window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    window.history.replaceState(null, "", next);
  }

  function render() {
    var scope = selected("inventory-scope") || "cited";
    var query = findInput ? findInput.value.trim().toLowerCase() : "";
    var group = scopeList(scope);
    var evidenceOn = showEvidenceFilter(group);
    if (!evidenceOn && evidenceSet && evidenceSet.contains(document.activeElement)) {
      var scopeChecked = root.querySelector(
        'input[name="inventory-scope"]:checked'
      );
      if (scopeChecked) scopeChecked.focus();
    }
    updateEvidenceCounts(group);
    var evidence = evidenceOn ? selected("inventory-evidence") || "all" : "all";
    var filtered = sortPapers(group, scope).filter(function (paper) {
      return matchesEvidence(paper, evidence) && matchesFind(paper, query);
    });
    var useStatic = mode === "static-cited" && scope === "cited" && citedBox;
    if (useStatic) {
      citedBox.hidden = false;
      if (mount) {
        mount.hidden = true;
        mount.replaceChildren();
      }
      var visible = filterStatic(query);
      setStatus(describe(scope, group.length || visible, visible, false, "all"));
    } else {
      if (citedBox) citedBox.hidden = true;
      renderTable(filtered, scope, evidenceOn);
      setStatus(
        describe(scope, group.length, filtered.length, evidenceOn, evidence)
      );
    }
    if (ready) writeUrl(scope, evidenceOn ? evidence : "all", query);
  }

  function applyUrl() {
    var params = new URLSearchParams(window.location.search);
    var scope = params.get("scope");
    var evidence = params.get("evidence");
    var query = params.get("q");
    unknownEvidence = false;
    if (scope) {
      var scopeInput = root.querySelector(
        'input[name="inventory-scope"][value="' + CSS.escape(scope) + '"]'
      );
      if (scopeInput) scopeInput.checked = true;
    }
    if (evidence) {
      var normalized = EVIDENCE_ALIASES[evidence] || evidence;
      var evidenceInput = root.querySelector(
        'input[name="inventory-evidence"][value="' +
          CSS.escape(normalized) +
          '"]'
      );
      if (evidenceInput) {
        evidenceInput.checked = true;
      } else {
        unknownEvidence = true;
        var allEvidence = root.querySelector(
          'input[name="inventory-evidence"][value="all"]'
        );
        if (allEvidence) allEvidence.checked = true;
      }
    }
    if (query && findInput) findInput.value = query;
  }

  function onScopeChange() {
    var all = root.querySelector(
      'input[name="inventory-evidence"][value="all"]'
    );
    if (all) all.checked = true;
    render();
  }

  if (scopeSet) {
    scopeSet.setAttribute(
      "aria-controls",
      citedBox ? "cited-sources inventory-mount" : "inventory-mount"
    );
  }
  if (evidenceSet) evidenceSet.setAttribute("aria-controls", "inventory-mount");

  root.querySelectorAll('input[name="inventory-scope"]').forEach(function (input) {
    input.addEventListener("change", onScopeChange);
  });
  root.querySelectorAll('input[name="inventory-evidence"]').forEach(function (input) {
    input.addEventListener("change", render);
  });
  if (findInput) findInput.addEventListener("input", render);

  applyUrl();
  setStatus("Loading the whitepaper inventory.");
  fetch("/data/whitepaper-inventory.slim.json", { credentials: "same-origin" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (data) {
      papers = Array.isArray(data.papers) ? data.papers : [];
      ready = true;
      render();
    })
    .catch(function () {
      ready = true;
      setStatus(
        "The inventory file did not load. The default cited list stays on this page when it is already in the HTML. The file is /data/whitepaper-inventory.slim.json."
      );
      if (mode !== "static-cited" && mount) {
        mount.hidden = false;
      }
    });
})();
