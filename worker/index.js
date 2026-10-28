/**
 * srf-analyze — Cloudflare Worker (LLM proxy retired)
 *
 * The SRF Stress Test no longer calls this Worker for model inference.
 * GitHub Models was retired (2026-07-30). A site-owned OpenAI (or other
 * paid) API key is intentionally not used: runaway charge risk.
 *
 * The Stress Test UI builds an analysis prompt in the browser and offers
 * Copy so the user pastes it into their own chat/model. This Worker remains
 * only as a clear “unavailable” stub for any leftover clients.
 *
 * No API secrets are required. Do not put OPENAI_API_KEY or GITHUB_TOKEN
 * on this Worker for the Stress Test.
 */

const ALLOWED_ORIGINS = new Set([
  "http://localhost:8080",
  "https://aisharedresponsibility.com",
  "https://www.aisharedresponsibility.com",
]);

const RETIRED_MESSAGE =
  "LLM analysis via this Worker is unavailable. The SRF Stress Test uses a copy-prompt flow in the browser (no site-held API keys). Open /tools/srf-stress/ or /assess/srf-stress/, build the prompt, and paste it into your own model.";

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : null;
  return {
    "Access-Control-Allow-Origin":  allowed ?? "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") ?? "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed" }, 403, origin);
    }

    return json({ error: RETIRED_MESSAGE, mode: "copy_prompt" }, 501, origin);
  },
};
