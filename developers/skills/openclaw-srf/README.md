# OpenClaw skill: srf-accountability

An OpenClaw-native skill that grounds an OpenClaw agent in the CoSAI AI Shared
Responsibility Framework (SRF), published at aisharedresponsibility.com. It
teaches the agent to fetch the framework's published JSON and Markdown over
plain HTTPS and to enforce the framework's core rule: exactly one accountable
party per activity. "Shared" is not a valid final answer.

## What this is

This is a [SKILL.md](https://docs.openclaw.ai/tools/skills) instruction pack,
OpenClaw's native skill format, confirmed against the current OpenClaw docs
(see Sources below). It is not an Anthropic `SKILL.md` bundle repackaged for a
different runtime, and it is not a plugin: it ships no code, no tools, and no
providers. It is a folder OpenClaw loads directly.

```
openclaw-srf/
├── SKILL.md                       # required: frontmatter + agent instructions
├── reference/
│   └── data-sources.md            # offline catalog of the /data/*.json URLs
└── README.md                      # this file
```

## What it does

When the skill is eligible, OpenClaw compiles `SKILL.md` into the agent's
system prompt. The instructions tell the agent to:

1. Fetch `https://aisharedresponsibility.com/llms.txt` with the built-in
   `web_fetch` tool to confirm current URLs before using them.
2. Fetch the specific `/data/*.json` file the question needs: a vertical
   control schema (finance, healthcare, insurance, public sector, defense,
   manufacturing), the operating-model responsibility matrix, the threat
   crosswalk, or the canonical ID registry.
3. Resolve every accountability question to one named persona, never
   "shared," and cite the canonical URL or record ID behind the answer.
4. Say plainly when the framework does not resolve a question, instead of
   inventing an accountability assignment.

## What it is not

- **No MCP server.** Every fetch in this skill is a direct HTTPS GET against
  a static file already published on the site. There is no server process to
  run, configure, or trust.
- **No repository access.** The skill has no path to the source repository
  and no GitHub integration. It only reads what the site already serves
  publicly.
- **No write access.** The skill is read-only. It cannot modify the site,
  open a pull request, or authenticate as anyone.
- **No required credentials, binaries, or environment variables.** It runs on
  OpenClaw's default, built-in `web_fetch` tool, which is enabled out of the
  box.

## Install it

OpenClaw loads skills from a folder containing `SKILL.md`. Pick whichever
install path matches your setup:

**Copy into your workspace (simplest):**

```bash
cp -r openclaw-srf ~/.openclaw/workspace/skills/
```

Restart the gateway or start a new session so OpenClaw picks up the new
skill:

```bash
openclaw gateway restart
```

**Install from a local checkout with the CLI:**

```bash
openclaw skills install ./openclaw-srf --as srf-accountability
```

**Make it available to every agent on the machine**, instead of one
workspace, by adding `--global` (installs into `~/.openclaw/skills` instead
of the workspace `skills/` directory):

```bash
openclaw skills install ./openclaw-srf --as srf-accountability --global
```

**Verify it loaded:**

```bash
openclaw skills list
```

You can also invoke it explicitly at any time with `/srf-accountability`, or
let the model bring it in automatically when a question matches one of the
triggers in `SKILL.md`.

## Requirements

None beyond a working OpenClaw install with the default `web_fetch` tool
enabled (it is enabled by default; see
[Web fetch](https://docs.openclaw.ai/tools/web-fetch)). No API keys, no
binaries, no gating. The skill's frontmatter carries no `requires` block for
exactly this reason.

## Sources and confidence

The skill format above (folder + `SKILL.md`, YAML frontmatter, `name` and
`description` required fields, `metadata.openclaw` for gating, `{baseDir}`
for referencing files inside the skill folder) was confirmed directly against
the live OpenClaw documentation, fetched during authoring:

- `https://docs.openclaw.ai/tools/skills` (loading order, frontmatter keys, gating, `SKILL.md` format)
- `https://docs.openclaw.ai/tools/creating-skills` (step-by-step authoring guide, naming rules, `{baseDir}` usage)
- `https://docs.openclaw.ai/clawhub/skill-format` (on-disk layout, full frontmatter field reference, allowed file types)
- `https://docs.openclaw.ai/tools/web-fetch` (confirms `web_fetch` is a plain HTTP GET, enabled by default, no JavaScript execution)

All four pages rendered as static server-side HTML/Markdown (Mintlify docs
site) and returned full content on fetch, with no JavaScript-shell fallback
needed. Confidence in the format is high: it is drawn directly from current,
plain-text-fetchable OpenClaw documentation, not inferred or reconstructed
from memory.

## Notes on the framework itself

The base SRF (five layers, eight personas, four operating models) is CoSAI SRF
v1.0. The six vertical control schemas this skill can fetch (finance,
healthcare, insurance, public sector, defense, manufacturing) are independently
proposed extensions published on aisharedresponsibility.com and are not part of
the official CoSAI release. `SKILL.md` instructs the agent to say so rather
than presenting vertical control data as CoSAI-ratified.
