/**
 * Reader-facing labels for industry controls browsers.
 * Search keeps matching underlying ids and slugs; the UI shows plain words.
 */
(function (global) {
  "use strict";

  var CORE_PERSONA_FILTER = {
    "ai-system-governance": "AI Governance",
    "data-provider": "Data Provider",
    "application-developer": "App Developer",
    "agentic-platform-provider": "Agentic Platform",
    "ai-platform-provider": "AI Platform",
    "model-provider": "AI Model Provider",
  };

  var ACRONYMS = {
    caio: "CAIO",
    ciso: "CISO",
    cfo: "CFO",
    fda: "FDA",
    ot: "OT",
    dpo: "DPO",
    siem: "SIEM",
    fhir: "FHIR",
    ocsf: "OCSF",
    api: "API",
    iam: "IAM",
    csp: "CSP",
    crm: "CRM",
    ai: "AI",
    ca: "CA",
    cio: "CIO",
    pii: "PII",
    phi: "PHI",
    hipaa: "HIPAA",
    fedramp: "FedRAMP",
    omb: "OMB",
    nist: "NIST",
    eu: "EU",
    iec: "IEC",
    iso: "ISO",
    owasp: "OWASP",
    doi: "DoI",
    dod: "DoD",
    il: "IL",
    nss: "NSS",
    naic: "NAIC",
    nydfs: "NYDFS",
    mrm: "MRM",
    cds: "CDS",
    ehr: "EHR",
    on: "ONC",
    htm: "HTM",
    pct: "percent",
  };

  var personaFromFilters = Object.create(null);
  var personaFromData = Object.create(null);
  var readyPromise = null;

  function tokens(slug) {
    return String(slug || "")
      .trim()
      .replace(/[_\s]+/g, "-")
      .split("-")
      .filter(Boolean);
  }

  function formatToken(tok, sentence) {
    var low = tok.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ACRONYMS, low)) {
      return ACRONYMS[low];
    }
    if (/^[A-Z][A-Z0-9]{1,}$/.test(tok)) {
      return tok;
    }
    if (sentence) {
      return low;
    }
    return low.charAt(0).toUpperCase() + low.slice(1);
  }

  function formatSlugPhrase(slug, sentence) {
    sentence = !!sentence;
    var toks = tokens(slug).map(function (t) {
      return formatToken(t, sentence);
    });
    if (!toks.length) {
      return "";
    }
    var firstLow = toks[0].toLowerCase();
    if (firstLow === "notify" || firstLow === "alert" || firstLow === "page" || firstLow === "escalate") {
      var rest = toks.slice(1);
      if (rest.length && (rest[rest.length - 1].length <= 6 || rest[rest.length - 1] === rest[rest.length - 1].toUpperCase())) {
        if (rest[0] && rest[0].toLowerCase() === "to") {
          rest = ["the"].concat(rest.slice(1));
        } else if (ACRONYMS[rest[rest.length - 1].toLowerCase()]) {
          rest = rest.slice(0, -1).concat(["the", rest[rest.length - 1]]);
        }
      }
      toks = [toks[0]].concat(rest);
    }
    return toks.join(" ");
  }

  function formatBreachAction(raw) {
    if (!raw) {
      return "";
    }
    return String(raw)
      .split(";")
      .map(function (part) {
        var phrase = formatSlugPhrase(part.trim(), true);
        if (!phrase) {
          return "";
        }
        if (phrase.charAt(phrase.length - 1) !== ".") {
          phrase += ".";
        }
        return phrase.charAt(0).toUpperCase() + phrase.slice(1);
      })
      .filter(Boolean)
      .join(" ");
  }

  function formatMetric(metric) {
    if (!metric) {
      return "";
    }
    var s = String(metric);
    if (s.indexOf("_") === -1 && s.indexOf(" ") !== -1) {
      return s;
    }
    return s
      .split("_")
      .filter(Boolean)
      .map(formatToken)
      .join(" ");
  }

  function formatParamType(paramType) {
    return formatSlugPhrase(paramType);
  }

  function formatWindow(window) {
    return formatSlugPhrase(window);
  }

  function formatEvidencePointer(raw) {
    if (!raw) {
      return "";
    }
    var head = String(raw).split(":")[0].trim();
    if (head.indexOf("_") === -1 && head.indexOf("-") === -1 && head.indexOf(" ") !== -1) {
      return head;
    }
    return formatSlugPhrase(head, true);
  }

  function isParamConstant(value) {
    if (value === undefined || value === null) {
      return false;
    }
    var s = String(value).trim();
    if (!s) {
      return false;
    }
    if (s.indexOf("TIER_") === 0) {
      return true;
    }
    return /^[A-Z][A-Z0-9_]*$/.test(s);
  }

  function collectFilterPersonaLabels() {
    personaFromFilters = Object.create(null);
    if (typeof document === "undefined") {
      return;
    }
    document.querySelectorAll('.filter-btn[data-filter="persona"]').forEach(function (btn) {
      var id = btn.getAttribute("data-value");
      var label = (btn.textContent || "").replace(/\s+/g, " ").trim();
      if (id && label && label !== id) {
        personaFromFilters[id] = label;
      }
    });
  }

  function loadPersonas() {
    return fetch("/data/personas.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        personaFromData = Object.create(null);
        (data.personas || []).forEach(function (p) {
          personaFromData[p.id] = p.name;
        });
        (data.sector_specializations || []).forEach(function (p) {
          personaFromData[p.id] = p.name;
        });
        Object.keys(CORE_PERSONA_FILTER).forEach(function (id) {
          if (!personaFromData[id]) {
            personaFromData[id] = CORE_PERSONA_FILTER[id];
          }
        });
      })
      .catch(function () {
        personaFromData = Object.assign({}, CORE_PERSONA_FILTER);
      });
  }

  function ready() {
    if (!readyPromise) {
      collectFilterPersonaLabels();
      readyPromise = loadPersonas().then(function () {
        collectFilterPersonaLabels();
      });
    }
    return readyPromise;
  }

  function personaLabel(id) {
    if (!id) {
      return "";
    }
    return (
      personaFromFilters[id] ||
      CORE_PERSONA_FILTER[id] ||
      personaFromData[id] ||
      formatSlugPhrase(id)
    );
  }

  function controlSearchHaystack(control) {
    var t = control.threshold || {};
    var bits = [
      control.id,
      control.title,
      control.description,
      control.component,
      control.accountable_persona,
      personaLabel(control.accountable_persona),
      control.lifecycle_stage,
      formatSlugPhrase(control.lifecycle_stage),
      control.public_sector_stage,
      formatSlugPhrase(control.public_sector_stage),
      control.clinical_stage,
      formatSlugPhrase(control.clinical_stage),
      control.mrm_stage,
      formatSlugPhrase(control.mrm_stage),
      control.property_class,
      formatSlugPhrase(control.property_class),
    ];
    if (t.metric) {
      bits.push(t.metric, formatMetric(t.metric));
    }
    if (t.param) {
      bits.push(t.param);
    }
    if (t.breach_action) {
      bits.push(t.breach_action, formatBreachAction(t.breach_action));
    }
  if (t.operator) {
      bits.push(t.operator);
    }
    if (t.window) {
      bits.push(t.window, formatWindow(t.window));
    }
    return bits
      .filter(function (x) {
        return x !== undefined && x !== null && String(x).length > 0;
      })
      .join(" ")
      .toLowerCase();
  }

  function matchesSearch(control, query) {
    if (!query) {
      return true;
    }
    return controlSearchHaystack(control).indexOf(String(query).toLowerCase()) !== -1;
  }

  global.ControlsBrowserDisplay = {
    ready: ready,
    personaLabel: personaLabel,
    formatSlugPhrase: formatSlugPhrase,
    formatBreachAction: formatBreachAction,
    formatMetric: formatMetric,
    formatParamType: formatParamType,
    formatWindow: formatWindow,
    formatEvidencePointer: formatEvidencePointer,
    isParamConstant: isParamConstant,
    matchesSearch: matchesSearch,
    controlSearchHaystack: controlSearchHaystack,
  };
})(typeof window !== "undefined" ? window : this);