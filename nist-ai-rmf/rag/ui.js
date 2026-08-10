import { loadCorpus, search } from "./retrieve.js";

const EXAMPLES = [
  "human oversight of AI systems",
  "third-party AI supply chain risk",
  "generative AI confabulation hallucination",
  "TEVV measurement trustworthy characteristics",
  "GOVERN inventory of AI systems",
  "GAI information security prompt injection",
  "risk tolerance go no-go deployment",
  "fairness harmful bias measurement",
];

function highlight(text, qTokens) {
  const set = new Set(qTokens);
  return text.replace(/[a-z0-9][a-z0-9-]*/gi, (w) =>
    set.has(w.toLowerCase()) ? `<mark>${w}</mark>` : w
  );
}

function writePureJson(obj) {
  // Replace the whole document with raw JSON text (still text/html Content-Type on
  // Pages, but body parses as JSON for browser tools). Prefer /retrieve/*.json for agents.
  const text = JSON.stringify(obj, null, 2);
  document.open();
  document.write(text);
  document.close();
}

function render(result) {
  const out = document.getElementById("rag-out");
  const jsonEl = document.getElementById("rag-json");
  jsonEl.textContent = JSON.stringify(result, null, 2);

  if (!result.matched_chunks.length) {
    out.innerHTML = `<p class="rag-note">No chunks matched. Try a broader scenario or remove filters.</p>`;
    return;
  }

  const pct = Math.round(result.confidence * 100);
  const conflict = result.conflict_note
    ? `<p class="rag-conflict">${result.conflict_note}</p>`
    : "";

  const cards = result.matched_chunks
    .map((m) => {
      const app = m.applicability
        ? `<span class="rag-badge rag-badge--app">Profile supplements base RMF</span>`
        : "";
      const ctrls = (m.related_controls || [])
        .map((c) => `<span class="rag-chip">${c}</span>`)
        .join("");
      return `
      <article class="rag-card">
        <div class="rag-card__head">
          <h3 class="rag-card__title">${m.title}</h3>
          <span class="rag-card__score">fused ${m.scores.fused}</span>
        </div>
        <p class="rag-card__meta">
          <span class="rag-badge">${m.nist_id} v${m.version}</span>
          ${app}
          <span class="rag-path">${m.section_path}</span>
        </p>
        <p class="rag-card__snippet">${highlight(m.snippet, result.query.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || [])}</p>
        <p class="rag-card__scores">BM25 ${m.scores.bm25} · dense ${m.scores.dense}</p>
        ${ctrls ? `<p class="rag-card__ctrls">Related SP 800-53 (IDs only): ${ctrls}</p>` : ""}
        <a class="rag-card__cite" href="${m.source_url}">Cite: ${m.chunk_id}</a>
      </article>`;
    })
    .join("");

  out.innerHTML = `
    <div class="rag-meta">
      <span class="rag-conf">Confidence ${result.confidence.toFixed(2)}</span>
      <span class="rag-bar"><span style="width:${pct}%"></span></span>
      <span>${result.matched_chunks.length} hits · ${result.embedding_method}</span>
    </div>
    ${conflict}
    ${cards}`;
}

let CORPUS = null;

async function run(query, jsonOnly) {
  try {
    CORPUS = CORPUS || (await loadCorpus());
  } catch (err) {
    const fail = {
      error: "corpus_load_failed",
      message: String(err && err.message ? err.message : err),
      query: query || null,
      matched_chunks: [],
      transport: "browser-js",
    };
    if (jsonOnly) {
      writePureJson(fail);
      return;
    }
    document.getElementById("rag-out").innerHTML =
      `<p class="rag-note">Failed to load corpus data. See <a href="llms.txt">llms.txt</a>.</p>`;
    return;
  }

  const filters = {
    doc_id: document.getElementById("f-doc")?.value || null,
    function: document.getElementById("f-fn")?.value || null,
    genai_only: !!document.getElementById("f-genai")?.checked,
  };
  if (!filters.doc_id) delete filters.doc_id;
  if (!filters.function) delete filters.function;
  const result = search(CORPUS, query, { filters, topK: 8 });
  result.transport = "browser-js";
  if (jsonOnly) {
    writePureJson(result);
    return;
  }
  render(result);
}

export function boot() {
  const form = document.getElementById("rag-form");
  const input = document.getElementById("rag-q");
  const ex = document.getElementById("rag-examples");
  const params = new URLSearchParams(location.search);
  const jsonOnly = params.get("format") === "json";
  const q0 = (params.get("q") || "").trim();

  // JSON mode must not depend on form chrome; answer immediately for any ?format=json.
  if (jsonOnly) {
    if (!q0) {
      writePureJson({
        error: "missing_query",
        message:
          "Pass ?q=... with format=json for browser-JS debug output. Agents should fetch /nist-ai-rmf/retrieve/*.json or data/chunks.json instead.",
        matched_chunks: [],
        transport: "browser-js",
        agent_urls: {
          retrieve_index: "./retrieve/index.json",
          chunks: "./data/chunks.json",
          llms: "./llms.txt",
        },
      });
      return;
    }
    run(q0, true);
    return;
  }

  ex.innerHTML = EXAMPLES.map(
    (q) => `<a href="?q=${encodeURIComponent(q)}">${q}</a>`
  ).join(" ");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    const next = new URLSearchParams({ q: v });
    if (document.getElementById("f-doc").value) next.set("doc", document.getElementById("f-doc").value);
    if (document.getElementById("f-fn").value) next.set("fn", document.getElementById("f-fn").value);
    if (document.getElementById("f-genai").checked) next.set("genai", "1");
    history.replaceState(null, "", "?" + next.toString());
    run(v, false);
  });

  if (params.get("doc")) document.getElementById("f-doc").value = params.get("doc");
  if (params.get("fn")) document.getElementById("f-fn").value = params.get("fn");
  if (params.get("genai") === "1") document.getElementById("f-genai").checked = true;
  if (q0) {
    input.value = q0;
    run(q0, false);
  }
}
