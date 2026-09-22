# graphify — code knowledge graph for agents

[graphify](https://github.com/Graphify-Labs/graphify) (PyPI package `graphifyy`, CLI `graphify`) parses the repo with tree-sitter into a knowledge graph that agents query instead of grepping raw files. Code extraction is local and deterministic — no LLM, no API key, nothing leaves the machine.

## Setup

```bash
uv tool install graphifyy     # or: pipx install graphifyy
graphify update .             # build graphify-out/ (~30 s for the whole monorepo)
```

`graphify-out/` is **gitignored** (~25 MB, machine-generated). Every clone builds its own graph; a fresh clone has none until `graphify update .` runs.

## What is committed

| Path                                   | Purpose                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `.claude/skills/graphify/`             | Project-scoped `/graphify` skill (vendored from the package, version in `.graphify_version`)  |
| `CLAUDE.md` → `## graphify`            | Query-first rules for every agent reading `CLAUDE.md` (Copilot/Gemini via symlink / settings) |
| `.claude/settings.json` → `PreToolUse` | `graphify hook-guard` nudges toward `graphify query` before `Bash`/`Grep`/`Read`/`Glob` calls |

The hooks only emit a nudge when `graphify-out/graph.json` exists, and are wrapped in `command -v graphify … || true` so machines without the CLI see no hook errors. Re-running `graphify claude install` drops that guard again — restore it before committing.

## Usage

```bash
graphify query "how are push reminders dispatched?"   # scoped subgraph for a question
graphify path "dispatchPushReminders" "ReminderService"
graphify explain "TrainingPlanDay"
graphify god-nodes --top 15                             # architectural hubs
graphify update .                                       # after code changes (AST only, incremental)
```

`graphify-out/GRAPH_REPORT.md` has god nodes, communities and surprising cross-module links for broad architecture reviews; `graph.html` is the interactive view (aggregated to communities because the graph exceeds 5000 nodes).

## Upgrading

```bash
uv tool upgrade graphifyy
graphify install --project && graphify claude install --project
```

Re-running the installers rewrites the skill, the `## graphify` section in `CLAUDE.md` and the hooks in place; review the diff before committing.

**The vendored skill is locally hardened — an upgrade must keep that.** Upstream templates paste paths, questions, answers and graph labels straight into shell/Python source (command injection via `$(...)` or a stray `'`, and labels can come from cloned third-party repos). Our copy routes every dynamic value through `GRAPHIFY_*` environment variables set via quoted heredoc (see "Safe substitution" at the top of `SKILL.md`), reads the Neo4j password from `NEO4J_PASSWORD` instead of argv, and lets the directed BFS fallback in `references/query.md` follow predecessors too. After an upgrade, re-apply those changes on top of the new upstream files (`git diff` against the previous skill commit shows them).
