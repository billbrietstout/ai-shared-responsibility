# SRF Accountability Skill

An Anthropic Agent Skill that grounds any Claude-family agent in the CoSAI AI Shared Responsibility Framework (SRF): who is accountable for each layer of an AI or agentic deployment, across operating models and industry verticals.

## What it does

Loading this skill teaches an agent to answer accountability questions by fetching the published SRF data from aisharedresponsibility.com instead of guessing from training data. It enforces the framework's core rule, exactly one accountable party per activity, and requires every answer to cite a canonical URL or ID from the live site.

## Where it works

The skill is a standard `SKILL.md` file with YAML frontmatter (`name` and `description`) and a markdown body. It works anywhere Anthropic's Agent Skills format is supported:

- **Claude Code**: drop it in a project's or user's skills directory.
- **Cowork**: install it as a skill in a Cowork session.
- **Claude Agent SDK**: load it like any other skill file in an SDK-based agent.

No code changes are needed for any of these. The skill is pure instruction; it carries no scripts and no dependencies.

## How to install

Copy the `srf-accountability` folder (this `SKILL.md` and this `README.md`) into your skills directory:

- **Claude Code**: place it under your project's `.claude/skills/` or your user-level skills directory as `srf-accountability/SKILL.md`.
- **Cowork**: use the skill installer to add a local or downloaded skill, pointing it at this folder.
- **Agent SDK**: add the folder to the `skills` path your agent is configured to load from.

Once installed, the agent picks up the skill automatically when a question matches its trigger description (accountability questions, "who owns this," per-vertical control lookups, and so on). No manual invocation syntax is required.

## How it works under the hood

The skill relies entirely on plain HTTPS GET requests to the already-published static files on aisharedresponsibility.com:

- `llms.txt` and `llms-full.txt` for the site inventory and full framework content.
- `data/index.json` and the per-vertical `data/{vertical}-controls.json` files for machine-readable control schemas.
- `data/matrix.json` for the operating-model x layer responsibility matrix.
- `api/glossary/{term}.json` for canonical term definitions.
- `ids.json`, `ontology/nodes.json`, and `ontology/edges.json` for canonical IDs and concept relationships.

There is no MCP server behind this skill and no GitHub or repository access of any kind. Any agent with outbound HTTPS access can use it. This also means the skill has no install-time configuration: no API keys, no connector setup, no auth.

## Keeping it current

The skill references URLs on the live site, not a bundled copy of the data. If aisharedresponsibility.com adds or renames a data file, update `SKILL.md` to match; the skill always starts by fetching `llms.txt`, so most structural site changes surface there first.
