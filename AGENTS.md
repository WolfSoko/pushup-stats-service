<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# i18n (Internationalization)

**Default language**: German (`de`). Supported locales: `de`, `en`.
**Translation files**: `web/src/locale/messages.xlf` (source/de) and `web/src/locale/messages.en.xlf` (English).

## Workflow for adding/changing translatable strings

1. **Mark strings** in templates with `i18n="@@your.id"` (elements) or `i18n-attr="@@your.id"` (attributes).  
   For programmatic strings use `` $localize`:@@your.id:German text` ``.
2. **Extract** updated source strings:
   ```bash
   npx nx extract-i18n web --build-target=web:build:development
   ```
3. **Add English translations** to `web/src/locale/messages.en.xlf` — copy the new `<unit>` blocks from `messages.xlf` and add a `<target>` with the English text inside each `<segment>`.
4. **Verify** no missing-translation warnings:
   ```bash
   npx nx build web --configuration=development
   ```
   → Build must complete with **no `[WARNING] No translation found`** lines.

## Tips

- Reuse IDs (`@@shared.id`) for identical strings in multiple places.
- Use `<ng-container i18n="@@id">…</ng-container>` to wrap text nodes without adding DOM elements.
- For interpolated strings: `<span i18n="@@id">Hello {{ name }}</span>` — the placeholder becomes `{$INTERPOLATION}` in the translation target.

# Development Flow (Project Board)

- Create/triage issue → add to **PUS Roadmap** project → Status = **Todo**.
- When work starts: set Status = **In Progress**.
- Open PR and link the issue using GitHub keywords (`Fixes #ID` / `Closes #ID`).
- Add the PR to the project and set Status = **Review**.
- On merge: issue auto-closes → set Status = **Done**.
