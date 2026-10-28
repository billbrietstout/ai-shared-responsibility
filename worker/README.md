# srf-analyze Worker

Cloudflare Worker that proxies the SRF Stress Test wizard
(`/tools/srf-stress/`, `/assess/srf-stress/`) to the **OpenAI Chat Completions
API**. The browser never sees the API key.

Live URL: `https://srf-analyze.aisharedresponsibility.workers.dev`

## Why OpenAI (not GitHub Models)

GitHub Models was **retired on 2026-07-30**. The old Worker called
`https://models.inference.ai.azure.com/chat/completions` with a `GITHUB_TOKEN`.
That endpoint no longer serves models; failures often surface in the UI as
`GitHub Models returned 530`.

This Worker calls OpenAI directly:

| Setting | Value |
| --- | --- |
| Endpoint | `OPENAI_BASE_URL` + `/chat/completions` (default `https://api.openai.com/v1`) |
| Model | `OPENAI_MODEL` (default `gpt-4o-mini`) |
| Auth | Bearer `OPENAI_API_KEY` (Cloudflare secret) |

The wizard still expects an OpenAI-format envelope (`choices[0].message.content`).

## Secrets Bill must set (Cloudflare account)

From this `worker/` directory, logged into the Cloudflare account that owns
`srf-analyze`:

```bash
cd worker
npx wrangler login          # once per machine, if needed
npx wrangler secret put OPENAI_API_KEY
# paste a key from https://platform.openai.com/api-keys when prompted
```

Optional: remove the obsolete GitHub secret if it is still present:

```bash
npx wrangler secret delete GITHUB_TOKEN
```

Dashboard path (same effect): Cloudflare Dashboard → Workers & Pages →
`srf-analyze` → Settings → Variables and Secrets → Add `OPENAI_API_KEY`
(Encrypt / Secret).

Do **not** put the key in `wrangler.toml`, git, or the static site.

## Deploy

```bash
cd worker
npx wrangler deploy
```

Confirm non-secret vars if you override them:

```bash
npx wrangler deployments list
# or Dashboard → srf-analyze → Settings → Variables
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o-mini
```

## Local dry run (no live key required)

```bash
cd worker
node --check index.js
node verify-local.mjs    # CORS, validation, missing-secret 503; no OpenAI call
```

With a key in the environment (never commit it):

```bash
export OPENAI_API_KEY=sk-...
npx wrangler dev
# then POST from http://localhost:8080 origin only (see ALLOWED_ORIGINS)
```

## Privacy note for the UI

Scenario text leaves the browser: Cloudflare Worker → OpenAI API. Copy on the
Stress Test pages must name that path. Do not claim “nothing leaves your device”
for this tool. Retention for OpenAI API traffic follows OpenAI’s API data-use
policy for the account that owns `OPENAI_API_KEY`; Worker response bodies are
not stored by this script (no KV/Durable Object logging in `index.js`).
