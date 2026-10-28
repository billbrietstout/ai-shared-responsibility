/**
 * Offline checks for retired srf-analyze stub.
 * Run: node verify-local.mjs
 */
import worker from "./index.js";

const ORIGIN = "https://aisharedresponsibility.com";

async function call(method, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Origin")) headers.set("Origin", ORIGIN);
  const req = new Request("https://srf-analyze.example/analyze", {
    method,
    ...init,
    headers,
  });
  return worker.fetch(req);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

await (async () => {
  const opt = await call("OPTIONS");
  assert(opt.status === 204, `OPTIONS ${opt.status}`);

  const get = await call("GET");
  assert(get.status === 405, `GET ${get.status}`);

  const badOrigin = await call("POST", {
    headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    body: "{}",
  });
  assert(badOrigin.status === 403, `origin ${badOrigin.status}`);

  const retired = await call("POST", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
  assert(retired.status === 501, `retired ${retired.status}`);
  const body = await retired.json();
  assert(body.mode === "copy_prompt", "mode");
  assert(/copy-prompt|copy prompt/i.test(body.error || ""), "error text");

  const src = await (await import("node:fs/promises")).readFile("./index.js", "utf8");
  assert(!src.includes("models.inference.ai.azure.com"), "no GitHub Models URL");
  assert(!src.includes("api.openai.com"), "no OpenAI URL");
  assert(!src.includes("env.OPENAI_API_KEY"), "no runtime OPENAI_API_KEY");
  assert(!src.includes("env.GITHUB_TOKEN"), "no runtime GITHUB_TOKEN");
  assert(!/Bearer \$\{/.test(src), "no Bearer token upstream call");

  console.log("ok  retired Worker stub (5 checks)");
})().catch((err) => {
  console.error("FAIL", err.message);
  process.exit(1);
});
