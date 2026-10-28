/**
 * Offline checks for srf-analyze (no OpenAI key, no network to OpenAI).
 * Run: node verify-local.mjs
 */
import worker from "./index.js";

const ORIGIN = "https://aisharedresponsibility.com";

async function call(method, init = {}, env = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Origin")) headers.set("Origin", ORIGIN);
  const req = new Request("https://srf-analyze.example/analyze", {
    method,
    ...init,
    headers,
  });
  return worker.fetch(req, env);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const cases = [];

async function test(name, fn) {
  try {
    await fn();
    cases.push({ name, ok: true });
    console.log(`ok  ${name}`);
  } catch (err) {
    cases.push({ name, ok: false, err: err.message });
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

await test("OPTIONS returns 204", async () => {
  const res = await call("OPTIONS");
  assert(res.status === 204, `status ${res.status}`);
});

await test("GET returns 405", async () => {
  const res = await call("GET");
  assert(res.status === 405, `status ${res.status}`);
});

await test("disallowed origin returns 403", async () => {
  const res = await call("POST", {
    headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
  assert(res.status === 403, `status ${res.status}`);
});

await test("missing OPENAI_API_KEY returns 503", async () => {
  const res = await call(
    "POST",
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    },
    {},
  );
  assert(res.status === 503, `status ${res.status}`);
  const body = await res.json();
  assert(/OPENAI_API_KEY/i.test(body.error || ""), `body ${JSON.stringify(body)}`);
});

await test("empty messages returns 400", async () => {
  const res = await call(
    "POST",
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    },
    { OPENAI_API_KEY: "sk-test-not-used-for-network" },
  );
  assert(res.status === 400, `status ${res.status}`);
});

await test("resolveUpstream defaults stay OpenAI", async () => {
  // Smoke: with a fake key, fetch will hit the network — skip live call.
  // Instead assert active constants (comments may still name the retired endpoint).
  const src = await (await import("node:fs/promises")).readFile("./index.js", "utf8");
  assert(src.includes('const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"'), "default base URL missing");
  assert(src.includes('const DEFAULT_MODEL           = "gpt-4o-mini"') || src.includes('DEFAULT_MODEL = "gpt-4o-mini"'), "default model missing");
  assert(!/GITHUB_MODELS_URL\s*=/.test(src), "GITHUB_MODELS_URL constant still defined");
  assert(!src.includes("env.GITHUB_TOKEN"), "GITHUB_TOKEN still referenced at runtime");
  assert(src.includes("env.OPENAI_API_KEY") || src.includes("OPENAI_API_KEY"), "OPENAI_API_KEY not referenced");
});

const failed = cases.filter((c) => !c.ok);
console.log(`\n${cases.length - failed.length}/${cases.length} checks passed`);
if (failed.length) process.exit(1);
