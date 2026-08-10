import { loadCorpus, search } from "./retrieve.js";

const EXAMPLES_AI_RMF = [
  "human oversight of AI systems",
  "third-party AI supply chain risk",
  "generative AI confabulation hallucination",
  "TEVV measurement trustworthy characteristics",
  "GOVERN inventory of AI systems",
  "GAI information security prompt injection",
  "risk tolerance go no-go deployment",
  "fairness harmful bias measurement",
];

const EXAMPLES_80053 = [
  "AC-2 account management",
  "least privilege AC-6",
  "supply chain risk management SR-3",
  "incident handling IR-4",
  "system monitoring SI-4",
  "boundary protection SC-7",
  "continuous monitoring CA-7",
  "privacy authority to process PT-2",
];

const SP80053_DOC = "sp800-53-rev5";

function highlight(text, qTokens) {
  const set = new Set(qTokens);
  return text.replace(/[a-z0-9][a-z0-9-]*/gi, (w) =>
    set.has(w.toLowerCase()) ? `<mark>${w}</mark>` : w
  );
}

function writePureJson(obj) {
  const text = JSON.stringify(obj, null, 2);
  document.open();
  document.write(text);
  document.close();
}

function controlChip(c) {
  const id = String(c || "").trim();
  if (!id) return "";
  const anchor = id.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
  const fam = anchor.split("-")[0];
  const href = `./sp800-53/sources/${fam}.md#${anchor}`;
  return `<a class="rag-chip" href="${href}">${id}</a>`;
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
  const corpusNote = result.corpus
    ? `<span class="rag-badge">${result.corpus}</span>`
    : "";

  const cards = result.matched_chunks
    .map((m) => {
      const app = m.applicability
        ? `<span class="rag-badge rag-badge--app">Profile supplements base RMF</span>`
        : "";
      const ctrls = (m.related_controls || []).map(controlChip).join("");
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
        <p class="rag-card__snippet">${highlight(m.snippet, result.query_terms || result.query.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || [])}</p>
        <p class="rag-card__scores">BM25 ${m.scores.bm25} · dense ${m.scores.dense}${m.scores.term_cover != null ? ` · terms ${m.scores.term_hits}/${(result.query_terms || []).length || "?"}` : ""}</p>
        ${ctrls ? `<p class="rag-card__ctrls">Related SP 800-53: ${ctrls}</p>` : ""}
        <a class="rag-card__cite" href="${m.source_url}">Cite: ${m.chunk_id}</a>
      </article>`;
    })
    .join("");

  out.innerHTML = `
    <div class="rag-meta">
      <span class="rag-conf">Confidence ${result.confidence.toFixed(2)}</span>
      <span class="rag-bar"><span style="width:${pct}%"></span></span>
      <span>${result.matched_chunks.length} hits · ${result.embedding_method}</span>
      ${corpusNote}
    </div>
    ${conflict}
    ${cards}`;
}

const CORPUS_CACHE = {
  "ai-rmf": null,
  "sp800-53": null,
};

function selectedCorpusKey() {
  const doc = document.getElementById("f-doc")?.value || "";
  return doc === SP80053_DOC ? "sp800-53" : "ai-rmf";
}

async function ensureCorpus(key) {
  if (CORPUS_CACHE[key]) return CORPUS_CACHE[key];
  const base = key === "sp800-53" ? "./sp800-53/data" : "./data";
  CORPUS_CACHE[key] = await loadCorpus(base);
  return CORPUS_CACHE[key];
}

function syncFilterChrome() {
  const doc = document.getElementById("f-doc")?.value || "";
  const is53 = doc === SP80053_DOC;
  const fnWrap = document.getElementById("f-fn-wrap");
  const famWrap = document.getElementById("f-fam-wrap");
  const genaiWrap = document.getElementById("f-genai-wrap");
  if (fnWrap) fnWrap.hidden = is53;
  if (famWrap) famWrap.hidden = !is53;
  if (genaiWrap) genaiWrap.hidden = is53;
  const ex = document.getElementById("rag-examples");
  if (ex) {
    const list = is53 ? EXAMPLES_80053 : EXAMPLES_AI_RMF;
    ex.innerHTML = list
      .map((q) => {
        const params = new URLSearchParams({ q });
        if (doc) params.set("doc", doc);
        return `<a href="?${params.toString()}">${q}</a>`;
      })
      .join(" ");
  }
}

async function run(query, jsonOnly) {
  const key = selectedCorpusKey();
  let corpus;
  try {
    corpus = await ensureCorpus(key);
  } catch (err) {
    const fail = {
      error: "corpus_load_failed",
      message: String(err && err.message ? err.message : err),
      query: query || null,
      matched_chunks: [],
      transport: "browser-js",
      corpus: key,
    };
    if (jsonOnly) {
      writePureJson(fail);
      return;
    }
    document.getElementById("rag-out").innerHTML =
      `<p class="rag-note">Failed to load corpus data. See <a href="llms.txt">llms.txt</a>.</p>`;
    return;
  }

  const doc = document.getElementById("f-doc")?.value || null;
  const filters = {};
  if (key === "sp800-53") {
    filters.doc_id = SP80053_DOC;
    const fam = document.getElementById("f-fam")?.value || null;
    if (fam) filters.family = fam;
  } else {
    if (doc) filters.doc_id = doc;
    const fn = document.getElementById("f-fn")?.value || null;
    if (fn) filters.function = fn;
    filters.genai_only = !!document.getElementById("f-genai")?.checked;
  }

  const result = search(corpus, query, { filters, topK: 8 });
  result.transport = "browser-js";
  result.corpus = key === "sp800-53" ? "sp800-53-rev5 (opt-in)" : "ai-rmf (default)";
  if (jsonOnly) {
    writePureJson(result);
    return;
  }
  render(result);
}

export function boot() {
  const form = document.getElementById("rag-form");
  const input = document.getElementById("rag-q");
  const params = new URLSearchParams(location.search);
  const jsonOnly = params.get("format") === "json";
  const q0 = (params.get("q") || "").trim();

  if (jsonOnly) {
    if (!q0) {
      writePureJson({
        error: "missing_query",
        message:
          "Pass ?q=... with format=json for browser-JS debug output. Agents should fetch /nist-ai-rmf/retrieve/*.json, data/chunks.json, or sp800-53/data/chunks.json instead.",
        matched_chunks: [],
        transport: "browser-js",
        agent_urls: {
          retrieve_index: "./retrieve/index.json",
          chunks_ai_rmf: "./data/chunks.json",
          chunks_sp80053: "./sp800-53/data/chunks.json",
          llms: "./llms.txt",
        },
      });
      return;
    }
    if (params.get("doc")) document.getElementById("f-doc").value = params.get("doc");
    if (params.get("fam")) document.getElementById("f-fam").value = params.get("fam");
    run(q0, true);
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    const next = new URLSearchParams({ q: v });
    const doc = document.getElementById("f-doc").value;
    if (doc) next.set("doc", doc);
    if (doc === SP80053_DOC) {
      const fam = document.getElementById("f-fam").value;
      if (fam) next.set("fam", fam);
    } else {
      if (document.getElementById("f-fn").value) next.set("fn", document.getElementById("f-fn").value);
      if (document.getElementById("f-genai").checked) next.set("genai", "1");
    }
    history.replaceState(null, "", "?" + next.toString());
    run(v, false);
  });

  document.getElementById("f-doc")?.addEventListener("change", () => {
    syncFilterChrome();
  });

  if (params.get("doc")) document.getElementById("f-doc").value = params.get("doc");
  if (params.get("fn")) document.getElementById("f-fn").value = params.get("fn");
  if (params.get("fam")) document.getElementById("f-fam").value = params.get("fam");
  if (params.get("genai") === "1") document.getElementById("f-genai").checked = true;
  syncFilterChrome();
  if (q0) {
    input.value = q0;
    run(q0, false);
  }
}
