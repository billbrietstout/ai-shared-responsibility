/**
 * srf-analyze — Cloudflare Worker
 *
 * Proxies SRF Stress wizard requests to GitHub Models (Grok Mini).
 * The GITHUB_TOKEN secret is stored in Cloudflare — never in the browser.
 *
 * Secrets (set once via wrangler):
 *   wrangler secret put GITHUB_TOKEN
 *
 * Allowed origins (edit ALLOWED_ORIGINS to add staging / localhost):
 *   https://aisharedresponsibility.com
 */

const GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions";
const MODEL             = "gpt-4o-mini"; // swap for xai/grok-3-mini when available on GitHub Models
const MAX_TOKENS        = 1800;
const TEMPERATURE       = 0.3;

const ALLOWED_ORIGINS = new Set([
  "http://localhost:8080",
  "https://aisharedresponsibility.com",
  "https://www.aisharedresponsibility.com",
]);

// ── CORS helpers ─────────────────────────────────────────────────────────────

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
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only POST from allowed origins
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed" }, 403, origin);
    }

    // Parse incoming body — expect { messages: [...] }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, origin);
    }
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return json({ error: "messages array is required" }, 400, origin);
    }

    // Call GitHub Models
    let upstream;
    try {
      upstream = await fetch(GITHUB_MODELS_URL, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          model:       MODEL,
          messages:    body.messages,
          max_tokens:  MAX_TOKENS,
          temperature: TEMPERATURE,
        }),
      });
    } catch (err) {
      return json({ error: `Upstream fetch failed: ${err.message}` }, 502, origin);
    }

    // Surface upstream errors verbatim so the wizard can display them
    if (!upstream.ok) {
      const errBody = await upstream.json().catch(() => ({}));
      return json(
        { error: errBody?.error?.message ?? `GitHub Models returned ${upstream.status}` },
        upstream.status,
        origin,
      );
    }

    // Return the raw OpenAI-format response — wizard parses choices[0].message.content
    const data = await upstream.json();
    return json(data, 200, origin);
  },
};
