/**
 * Hybrid retrieval for NIST AI RMF demo: BM25 + dense (hash-tfidf) + RRF.
 * Loads static data from ../data/. No network APIs, no keys.
 */

const STOP = new Set(
  "a an and are as at be by for from has in is it its of on or that the to with who whose how what which".split(
    " "
  )
);

/** Weak query verbs/fillers that match too broadly in NIST prose. */
const QUERY_WEAK = new Set(
  (
    "cover covers covering address addresses addressing include includes including " +
    "using based related relate regarding about provide provides ensure ensures " +
    "support supports should does did can could would may might must " +
    "before after during within without required requiring create creates creating " +
    "make makes making get gets getting take takes taking " +
    "users user mislead misleading"
  ).split(/\s+/)
);

/** Ultra-common corpus tokens; keep for matching but downweight in BM25. */
const QUERY_COMMON = new Set(
  "ai system systems risk risks management framework model models data organization organizations organizational".split(
    " "
  )
);

export function tokenize(s) {
  return (s || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]*/g)
    ?.filter((t) => !STOP.has(t) && t.length > 1) || [];
}

export function queryTerms(s) {
  return tokenize(s).filter((t) => !QUERY_WEAK.has(t));
}

function strongTerms(tokens) {
  return tokens.filter((t) => !QUERY_COMMON.has(t));
}

function termWeight(t) {
  if (QUERY_COMMON.has(t)) return 0.35;
  return 1;
}

function minHitsRequired(tokens, df, nDocs) {
  const strong = strongTerms(tokens);
  const basis = strong.length ? strong : tokens;
  const n = basis.length;
  if (n <= 1) return 1;
  if (df) {
    const rareCap = Math.max(12, Math.floor(0.05 * (nDocs || 300)));
    if (strong.some((t) => (df[t] || 0) <= rareCap)) return 1;
  }
  if (n === 2) return 2;
  return Math.max(2, Math.min(n, Math.ceil(n * 0.4)));
}

function countHits(queryTokens, docTokSet, strongOnly) {
  const strong = strongTerms(queryTokens);
  const terms = strongOnly && strong.length ? strong : queryTokens;
  let hit = 0;
  terms.forEach((t) => {
    if (docTokSet.has(t)) hit += 1;
  });
  return hit;
}

/* FNV-1a 32-bit — must match build/nist_ai_rmf/build_index.py */
function fnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function stableBucket(term, dims) {
  const h = fnv1a(term);
  const bucket = h % dims;
  const sign = (h & 1) === 0 ? 1 : -1;
  return [bucket, sign];
}

function projectQuery(tokens, projection) {
  const dims = projection.dims || 256;
  const idf = projection.idf || {};
  const tf = {};
  tokens.forEach((t) => {
    tf[t] = (tf[t] || 0) + 1;
  });
  const row = new Float32Array(dims);
  Object.entries(tf).forEach(([term, f]) => {
    if (!(term in idf)) return;
    const weight = termWeight(term) * (1 + Math.log(f)) * idf[term];
    const [h, sign] = stableBucket(term, dims);
    row[h] += sign * weight;
  });
  let n = 0;
  for (let i = 0; i < dims; i++) n += row[i] * row[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < dims; i++) row[i] /= n;
  return row;
}

function cosine(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function bm25Search(queryTokens, chunks, bm25, k = 20) {
  const N = bm25.n_docs || chunks.length;
  const k1 = bm25.k1 ?? 1.5;
  const b = bm25.b ?? 0.75;
  const avgdl = bm25.avgdl || 1;
  const df = bm25.df || {};
  const idf = (t) => Math.log(1 + (N - (df[t] || 0) + 0.5) / ((df[t] || 0) + 0.5));
  const need = minHitsRequired(queryTokens, df, N);
  const scored = chunks.map((ch, i) => {
    const toks = bm25.tokens?.[i] || tokenize(`${ch.title}. ${ch.text}`);
    const tf = {};
    toks.forEach((t) => {
      tf[t] = (tf[t] || 0) + 1;
    });
    const tokSet = new Set(toks);
    const len = bm25.doc_lens?.[i] ?? toks.length;
    let s = 0;
    queryTokens.forEach((t) => {
      const f = tf[t] || 0;
      const denom = f + k1 * (1 - b + (b * len) / avgdl);
      s += (termWeight(t) * idf(t) * (f * (k1 + 1))) / (denom || 1);
    });
    const strongHit = countHits(queryTokens, tokSet, true);
    const allHit = countHits(queryTokens, tokSet, false);
    const basis = strongTerms(queryTokens).length || queryTokens.length || 1;
    const coord = strongHit / basis;
    s *= 0.35 + 0.65 * coord;
    return { i, score: s, hit: strongHit, allHit };
  });
  return scored
    .filter((r) => r.score > 0 && r.hit >= need)
    .sort((a, b) => b.score - a.score || b.hit - a.hit || b.allHit - a.allHit)
    .slice(0, k);
}

function denseSearch(qVec, vectors, k = 20) {
  const scored = vectors.map((v, i) => ({ i, score: cosine(qVec, v) }));
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

function rrfFuse(lists, k = 60) {
  const scores = new Map();
  lists.forEach((list) => {
    list.forEach((item, rank) => {
      const prev = scores.get(item.i) || { i: item.i, rrf: 0, parts: {} };
      const add = 1 / (k + rank + 1);
      prev.rrf += add;
      prev.parts = { ...prev.parts, ...item.parts };
      if (item.bm25 != null) prev.bm25 = item.bm25;
      if (item.dense != null) prev.dense = item.dense;
      scores.set(item.i, prev);
    });
  });
  return [...scores.values()].sort((a, b) => b.rrf - a.rrf);
}

function passesFilters(ch, filters) {
  if (!filters) return true;
  if (filters.doc_id && ch.doc_id !== filters.doc_id) return false;
  if (filters.family) {
    const fam = filters.family.toLowerCase();
    if ((ch.family || "").toLowerCase() !== fam && !(ch.anchor || "").toLowerCase().startsWith(fam + "-")) {
      return false;
    }
  }
  if (filters.function) {
    const fn = filters.function.toLowerCase();
    const path = (ch.section_path || "").toLowerCase();
    const topics = (ch.topics || []).join(" ");
    if (!path.includes(fn) && !topics.includes(fn)) return false;
  }
  if (filters.genai_only && ch.doc_id !== "nist-ai-600-1") return false;
  return true;
}

function graphBoost(chunkId, graph) {
  if (!graph?.edges) return [];
  return graph.edges
    .filter((e) => e.from === chunkId || e.to === chunkId)
    .map((e) => (e.from === chunkId ? e.to : e.from));
}

export async function loadCorpus(base = "./data") {
  const [chunks, bm25, emb, graph, manifest] = await Promise.all([
    fetch(`${base}/chunks.json`).then((r) => r.json()),
    fetch(`${base}/bm25.json`).then((r) => r.json()),
    fetch(`${base}/embeddings.json`).then((r) => r.json()),
    fetch(`${base}/graph-edges.json`).then((r) => r.json()).catch(() => ({ nodes: [], edges: [] })),
    fetch(`${base}/corpus-manifest.json`).then((r) => r.json()),
  ]);
  return { chunks, bm25, emb, graph, manifest, base };
}

export function citeUrl(ch) {
  const md = ch.source_md || "";
  // Paths are relative to /nist-ai-rmf/ (page root).
  if (md.startsWith("sp800-53/")) return `./${md}#${ch.anchor}`;
  return `./${md}#${ch.anchor}`;
}

export function search(corpus, query, opts = {}) {
  const { chunks, bm25, emb, graph } = corpus;
  const topK = opts.topK ?? 8;
  const filters = opts.filters || {};
  const q = queryTerms(query);
  if (!q.length) {
    return { query, matched_chunks: [], confidence: 0, embedding_method: emb.method };
  }

  const bm = bm25Search(q, chunks, bm25, 60);
  const qVec = projectQuery(q, emb.projection || { dims: emb.dims, idf: {} });

  // Hybrid: BM25 proposes candidates; dense reranks within that set (plus weak RRF).
  const candidateIdx = new Set(bm.map((r) => r.i));
  // Also add dense top hits so recall is not BM25-only
  const densAll = denseSearch(qVec, emb.vectors, 40);
  densAll.slice(0, 10).forEach((r) => candidateIdx.add(r.i));

  const dens = densAll.filter((r) => candidateIdx.has(r.i));
  const bmList = bm.map((r) => ({ i: r.i, bm25: r.score, hit: r.hit, parts: { bm25: true } }));
  const densList = dens.map((r) => ({ i: r.i, dense: r.score, parts: { dense: true } }));

  // Weight BM25 higher for hash-tfidf embeddings
  const bmWeight = emb.method === "hash-tfidf" ? 2.5 : 1;
  const densWeight = emb.method === "hash-tfidf" ? 0.5 : 1;
  const scores = new Map();
  const addList = (list, weight) => {
    list.forEach((item, rank) => {
      const prev = scores.get(item.i) || { i: item.i, rrf: 0 };
      prev.rrf += (weight * 1) / (60 + rank + 1);
      if (item.bm25 != null) prev.bm25 = item.bm25;
      if (item.dense != null) prev.dense = item.dense;
      if (item.hit != null) prev.hit = item.hit;
      scores.set(item.i, prev);
    });
  };
  addList(bmList, bmWeight);
  addList(densList, densWeight);
  let fused = [...scores.values()].sort((a, b) => b.rrf - a.rrf);

  const bmMap = new Map(bmList.map((r) => [r.i, r.bm25]));
  const dMap = new Map(densList.map((r) => [r.i, r.dense]));
  const hitMap = new Map(bmList.map((r) => [r.i, r.hit]));
  fused = fused.map((r) => ({
    ...r,
    bm25: bmMap.get(r.i) ?? 0,
    dense: dMap.get(r.i) ?? 0,
    hit: hitMap.get(r.i) ?? 0,
  }));

  // Deterministic boosts: title coverage, depth, risk/subcategory anchors
  const qset = new Set(q);
  const need = minHitsRequired(q, bm25.df || {}, bm25.n_docs || chunks.length);
  const basis = strongTerms(q).length || q.length || 1;
  fused = fused.map((r) => {
    const ch = chunks[r.i];
    const docToks = new Set(tokenize(`${ch.title || ""}. ${ch.text || ""}`));
    const strongHit = countHits(q, docToks, true);
    const titleToks = tokenize(ch.title || "");
    const titleStrong = strongTerms(q).filter((t) => titleToks.includes(t)).length;
    let cover = 0;
    titleToks.forEach((t) => {
      if (qset.has(t)) cover += 1;
    });
    cover = cover / (qset.size || 1);
    const termCover = strongHit / basis;
    let boost = 0.2 * cover + 0.25 * termCover;
    if ((ch.level || 1) >= 3) boost += 0.02;
    if ((ch.anchor || "").startsWith("risk-")) boost += 0.05;
    if (/^(gov|map|measure|manage)-\d/.test(ch.anchor || "")) boost += 0.03;
    if (titleStrong >= 2) boost += 0.1;
    const anchor = (ch.anchor || "").toLowerCase();
    if (anchor && qset.has(anchor)) {
      boost += anchor.includes(".") ? 0.12 : 0.22;
    }
    if (ch.applicability && filters.genai_only) boost += 0.01;
    const title = (ch.title || "").toLowerCase();
    if ((ch.level || 1) <= 1 || title.startsWith("artificial intelligence risk management framework")) {
      boost -= 0.08;
    }
    const hops = graphBoost(ch.chunk_id, graph);
    if (hops.length) boost += Math.min(0.03, hops.length * 0.005);
    const coord = 0.4 + 0.6 * termCover;
    return {
      ...r,
      hit: strongHit,
      rrf: (r.rrf + boost) * coord,
      graph_neighbors: hops,
      drop: strongHit < need && !(anchor && qset.has(anchor)),
    };
  });
  fused = fused.filter((r) => !r.drop).sort((a, b) => b.rrf - a.rrf || b.hit - a.hit);

  const filtered = fused.filter((r) => passesFilters(chunks[r.i], filters)).slice(0, topK);

  const matched = filtered.map((r) => {
    const ch = chunks[r.i];
    const parent = ch.parent_id ? chunks.find((c) => c.chunk_id === ch.parent_id) : null;
    return {
      chunk_id: ch.chunk_id,
      doc_id: ch.doc_id,
      nist_id: ch.nist_id,
      version: ch.version,
      title: ch.title,
      section_path: ch.section_path,
      anchor: ch.anchor,
      source_url: citeUrl(ch),
      applicability: ch.applicability || null,
      related_controls: ch.related_controls || [],
      topics: ch.topics || [],
      scores: {
        bm25: Math.round((r.bm25 || 0) * 1000) / 1000,
        dense: Math.round((r.dense || 0) * 1000) / 1000,
        fused: Math.round((r.rrf || 0) * 1000) / 1000,
        term_hits: r.hit,
        term_cover: Math.round(((r.hit || 0) / basis) * 100) / 100,
      },
      snippet: (ch.text || ch.title || "").replace(/\s+/g, " ").slice(0, 320),
      parent: parent
        ? { chunk_id: parent.chunk_id, title: parent.title, section_path: parent.section_path }
        : null,
      graph_neighbors: r.graph_neighbors || [],
    };
  });
  const top = matched[0];
  const cover =
    top && q.length
      ? tokenize(`${top.title} ${top.snippet}`).filter((t) => q.includes(t)).length / q.length
      : 0;
  const conf = matched.length
    ? Math.round((0.55 * Math.min(1, cover) + 0.45 * Math.min(1, top.scores.fused * 8)) * 100) /
      100
    : 0;

  // Surface version / applicability conflicts when both base + profile hit
  const docs = new Set(matched.map((m) => m.doc_id));
  const conflict_note =
    docs.has("nist-ai-100-1") && docs.has("nist-ai-600-1")
      ? "Results include both the base AI RMF (NIST.AI.100-1) and the Generative AI Profile (NIST.AI.600-1). The Profile supplements and does not replace the base Framework; verify applicability for your scenario."
      : null;

  return {
    query,
    query_terms: q,
    matched_chunks: matched,
    confidence: conf,
    embedding_method: emb.method,
    conflict_note,
  };
}
