# srf-analyze Worker

**Status: LLM proxy retired.** The SRF Stress Test does not use this Worker for
model calls. It builds an analysis prompt in the browser and offers **Copy** so
users paste into their own chat/model. The site holds **no** paid API key for
this tool (Bill declined a shared OpenAI key over runaway charge risk).

## Why

| Old path | Problem |
| --- | --- |
| GitHub Models + `GITHUB_TOKEN` | GitHub Models retired 2026-07-30; UI saw `GitHub Models returned 530` |
| Site-owned OpenAI `OPENAI_API_KEY` | Bill declined — shared key risks runaway charges |

## Current Worker behavior

Any POST from an allowed origin receives **HTTP 501** with JSON:

```json
{ "error": "LLM analysis via this Worker is unavailable…", "mode": "copy_prompt" }
```

No secrets required. Optional redeploy only to replace a still-live GitHub Models
Worker with this stub:

```bash
cd worker
npx wrangler deploy
# optional cleanup if old secrets remain:
# npx wrangler secret delete GITHUB_TOKEN
# npx wrangler secret delete OPENAI_API_KEY
```

## Product path

See `/tools/srf-stress/` and `/assess/srf-stress/`: build prompt → Copy → paste
into the user’s own model. Optional local layer sketch is deterministic and
runs only in the browser.
