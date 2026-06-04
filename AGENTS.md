# Pushup Stats Service — Agent Instructions

Single source of truth for all AI agents working on this repo (Claude Code, Copilot, Gemini, etc.). Claude-specific and Copilot-specific entry-point files (`CLAUDE.md`, `.github/copilot-instructions.md`) reference this file.

Angular 21 / Nx monorepo for tracking pushup statistics with Firebase backend.

> **Default rule:** if there is even a small chance a docs file under [`docs/`](docs/) is relevant to the change you are making, read it before making the change. Linking to a doc from this file is an explicit signal that the doc contains constraints not obvious from the code.

## Git Workflow

- **Trunk-based development:** Push directly to `main`. No feature branches by default.
- Feature branches or worktrees only when explicitly requested.
- **Never commit secrets or user-identifiable data** (API keys, service account JSON, database UIDs, user email addresses) to the repository. Pass them as CLI arguments, environment variables, or Firebase Secrets instead.
- **Pre-commit reformats files:** Husky + lint-staged run `eslint --fix` + `prettier --write` on every commit. Your staged files may differ from what you wrote. Re-read the file before further edits after a commit.

## Pull Requests

- **Issue work → feature branch + PR.** When implementing a tracked issue (e.g. `claude/implement-NNN-*` branches), open a PR proactively once the change is pushed and CI-ready, without waiting for an explicit ask. Link the issue with `Closes #ID`.
- **Ad-hoc trunk changes still go straight to `main`.** Only open a PR when there is an issue, when the change is risky/large, or when the user requests one.
- **After opening the PR, subscribe to its activity** via `subscribe_pr_activity` so review comments and CI failures are addressed in the same session without prompting.
- **Merge proactively once CI is green and review threads are resolved** — no need to wait for an explicit "merge it" from the user. Squash by default; preserve the issue link in the squash body. Stop only on an unresolvable review comment or a CI failure outside the change's scope, in which case report and wait.

## Development Flow (Project Board)

- Create/triage issue → add to **PUS Roadmap** project → Status = **Todo**.
- When work starts: set Status = **In Progress**.
- Open PR and link the issue using GitHub keywords (`Fixes #ID` / `Closes #ID`).
- Add the PR to the project and set Status = **Review**.
- On merge: issue auto-closes → set Status = **Done**.

## Quality Philosophy

If a bug reaches production, the CI pipeline wasn't good enough. Every change must be backed by tests **before** pushing to `main`:

- **Unit tests:** Cover all new/changed logic. High coverage is mandatory, not optional.
- **Smoke tests:** Ensure critical user flows don't break (dashboard loads, entries CRUD, auth flow).
- **Regression tests:** Every bugfix must include a test that reproduces the bug first (TDD red-green).
- **Rule of thumb:** If you can't prove a change works via CI, it's not ready to merge.

When making changes, always write or update relevant tests as part of the same commit. **Never push new or changed code without corresponding tests — this applies to all branches, not just `main`.** If tests for the changed code don't exist yet, write them before pushing.

### Testing rules for Angular libs and web

- **Never** instantiate Angular services, guards, or components with `new` when they depend on DI. Use `TestBed` or `@testing-library/angular`'s `render`.
- **Guards** must be tested in a real Angular router/TestBed context, not as plain functions.
- **Mock providers via Angular DI** (`{ provide: ..., useValue: ... }`), not by patching `inject()` directly.
- **External functions** (e.g. `deleteUser` from Firebase) are mocked on the imported module — never with dynamic `import()` or `require()`. Use `import * as ns from '@angular/fire/firestore'` and reference `ns.doc`/`ns.docData` after `jest.mock(...)`.
- **`PLATFORM_ID: 'server'`** in tests for stores that start a `setInterval` / browser-only timer in `withHooks`. Otherwise the timer leaks across `TestBed.resetTestingModule()`.
- **Given-When-Then** style tests are preferred — the test title is a `should …` sentence (`it('should …')`); `// given` / `// when` / `// then` are marker comments inside the body that flag where each phase starts, **not** part of the title. New tests follow this even in files whose older tests predate the convention.

More test pitfalls: [`docs/gotchas/testing.md`](docs/gotchas/testing.md).

## Coding Conventions

- **Comment discipline — only comment if absolutely necessary.** Default to no comments. Add a comment **only** when the _why_ is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug, or behavior that would surprise a reader. Do **not** describe _what_ the code does (well-named identifiers do that). Do **not** add task-tracking comments (`// added for X`, `// fix for #123`, `// used by Y flow`) — that belongs in the PR description and rots as the codebase evolves.
- **Prefer Angular Material components** (`mat-button`, `mat-icon`, `mat-form-field`, `mat-dialog`, etc.) over plain HTML for buttons, inputs, dialogs, and other interactive controls.
- **No `@angular/animations`** — it is deprecated and not a project dependency. Use CSS animations/transitions instead.
- **State management:** see [`docs/architecture.md`](docs/architecture.md) for the signal-store / API-service split and where state belongs. Short version: stores own state, components only bind, services are stateless.
- **Exercises & categories — one source:** `EXERCISE_CATALOG` / `EXERCISE_CATEGORIES` in `@pu-stats/models` are the only list of available exercises/categories. Goals, entries, analysis, the Cloud Function leaderboard rebuild, and training plans (`TrainingPlanDay.exerciseId`, default `'pushup'`) all read from it. Consumers that can't import it — the `firestore.rules` allowlists and the `$localize` display-name registry — are pinned to the catalog by guard tests, so adding/renaming an exercise fails CI until they match. The `firestore.rules` allowlists are **generated** (run `pnpm nx run cloud-functions:generate-exercise-rules` after changing the catalog; a drift-guard test enforces it). The `$localize` display-name registry is the one remaining consumer that needs a manual edit. Details: [`docs/architecture.md`](docs/architecture.md) → "Single source of truth: exercises & categories".
- **No RxJS for state** — RxJS is allowed only inside the data-access layer for Firestore Observables, then bridged via `toSignal()`.
- **Don't introduce backwards-compatibility shims** for code paths you are certain are unused — delete instead. No `// removed`, no re-exports of removed types, no renamed `_unused` vars.
- **Keep prod source files small — target ≤ 250 LOC.** A file over ~250 lines is a smell that it owns too much; split it into focused units **as part of the change that grows it** (don't let it grow first and refactor "later"): extract child components, sub-stores/feature slices, pure helper modules, or per-concern services. This applies to **prod source** — components, stores, services, logic, Cloud Functions. **Excluded:** `*.spec.ts`/tests, `*.generated.ts`, and static data catalogs (e.g. `*.catalog.ts`, `*-content.ts`) where the length is just data, not logic. If a file genuinely can't be split below the limit, that's a signal to rethink its responsibilities — not to silently exceed it.

## Tech Stack

- **Frontend:** Angular 21 (standalone, zoneless, SSR)
- **Build:** Nx 22, pnpm
- **Backend:** Firebase (Firestore, Cloud Functions, Auth)
- **State:** @ngrx/signals (signal stores)
- **UI:** Angular Material 21, Chart.js
- **Cloud Functions:** TypeScript, esbuild bundle, Jest tests
- **Testing:** Vitest (web), Jest (libs + cloud-functions), Playwright (e2e)

## Commands

```bash
pnpm nx test <project>           # Run tests for a specific project
pnpm nx lint <project>           # Lint a specific project
pnpm nx build web --configuration=development  # Build (dev)
pnpm nx run-many --target=test   # Run all tests
pnpm nx run-many --target=lint   # Lint all projects
```

Nx project name table → [`docs/architecture.md`](docs/architecture.md#nx-project-names).

## Pre-Push Checklist

**Before every push to `main`**, run these checks locally and ensure they pass:

```bash
pnpm nx affected -t=lint,test,build -c=production --parallel=3
```

If only specific projects were changed, targeted checks are acceptable:

```bash
pnpm nx run-many --target=lint    # Lint all projects
pnpm nx run-many --target=test    # Run all tests
pnpm nx run web:build -c production  # Production build (includes prerender)
```

Do NOT push if any of these fail. Fix first, then push. Common build/tooling flakes and one-shot script recipes: [`docs/gotchas/build-and-tooling.md`](docs/gotchas/build-and-tooling.md).

## i18n / Internationalization

- **Source locale:** German (`de`). **Developers write German only.** Do not hand-translate non-German XLIFF targets or non-German `<lang>.md` content — the [Claude translations routine](.claude/routines/translate.md) runs daily and on every push to `main` that touches the i18n source surface, detects gaps via `tools/src/detect-translation-gaps.mjs`, and opens a PR with the missing translations itself. Exceptions: fixing an outright bug in an existing translation (typo, broken placeholder, wrong meaning that a reviewer flagged) or seeding a brand-new locale code (one-shot setup per [`docs/gotchas/i18n.md`](docs/gotchas/i18n.md#adding-a-new-locale)).
- **Format:** XLIFF 2.0 (`web/src/locale/messages.xlf` source / `messages.<lang>.xlf` targets). `messages.xlf` is auto-generated by `pnpm nx run web:extract-i18n` — never edit it manually.
- **Templates:** `i18n="@@your.id"` attribute; programmatic: `` $localize`:@@your.id:German text` ``. Mark brand strings with `i18n` even when the German source already reads English.
- **After adding/changing German i18n strings,** run `pnpm nx run web:extract-i18n && node tools/src/sync-xliff-locales.mjs`. The seeded fallbacks keep production builds green; the next routine run replaces them with real translations.
- **XLIFF maintenance, locale switching, root `/` handling, dynamic data localisation, adding a new locale code, translations-routine how-to** — see [`docs/gotchas/i18n.md`](docs/gotchas/i18n.md).

## Documentation Index

Detailed reference material lives in [`docs/`](docs/). **Read the relevant doc before touching the area** — even if you think you remember the setup.

### Architecture & deployment

| Area                                                     | File                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Library deps, ports/adapters, state mgmt, training plans | [`docs/architecture.md`](docs/architecture.md)                                                                                 |
| CI/CD, deploy gate, staging environment, Firestore rules | [`docs/ci-cd.md`](docs/ci-cd.md)                                                                                               |
| Cloud Functions overview + Admin Authorization           | [`docs/cloud-functions.md`](docs/cloud-functions.md)                                                                           |
| Translatable content workflow (blog & wiki)              | [`docs/content-workflow.md`](docs/content-workflow.md)                                                                         |
| Consent banner, ads gating, legal pages, SEO/sitemap     | [`docs/consent-ads-seo.md`](docs/consent-ads-seo.md)                                                                           |
| Firebase environments + deployment                       | [`docs/Firebase_DEPLOYMENT.md`](docs/Firebase_DEPLOYMENT.md), [`docs/firebase-environments.md`](docs/firebase-environments.md) |
| Sentry source maps, releases, `SENTRY_AUTH_TOKEN` setup  | [`docs/observability/sentry.md`](docs/observability/sentry.md)                                                                 |

### Push notifications

- **Two-tier reminder system:** In-app (`ReminderService` with `setInterval`) + server-side (`dispatchPushReminders` Cloud Function every 5 min via Web Push).
- Browser API quirks, VAPID keys, subscription vs reminder toggle, Cloud Function lease handling — see [`docs/gotchas/push-and-service-workers.md`](docs/gotchas/push-and-service-workers.md).

### Gotchas & pitfalls

| Area                                                         | File                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Angular signals (`toSignal`, same-reference emissions)       | [`docs/gotchas/signals.md`](docs/gotchas/signals.md)                                   |
| Tests (mocks, spies, `resource.reload`, Jest/Vitest quirks)  | [`docs/gotchas/testing.md`](docs/gotchas/testing.md)                                   |
| Cloud Functions (secrets IAM, delta aggregation, versioning) | [`docs/gotchas/cloud-functions.md`](docs/gotchas/cloud-functions.md)                   |
| Push notifications & Service Workers                         | [`docs/gotchas/push-and-service-workers.md`](docs/gotchas/push-and-service-workers.md) |
| i18n (XLIFF, locale switching, `LOCALE_ID`)                  | [`docs/gotchas/i18n.md`](./docs/gotchas/i18n.md)                                       |
| Build & tooling (font flakes, pnpm dlx, Nx Cloud agents)     | [`docs/gotchas/build-and-tooling.md`](docs/gotchas/build-and-tooling.md)               |
| Precomputed data (period-key staleness, timestamp formats)   | [`docs/gotchas/precomputed-data.md`](docs/gotchas/precomputed-data.md)                 |
| Firestore client (`setDoc({merge:true})` nested-map clobber) | [`docs/gotchas/firestore.md`](docs/gotchas/firestore.md)                               |

## Workflow

- **Before pushing:** Run the pre-push checklist above.
- **After completing a feature or bugfix:** Review whether any new broadly applicable knowledge should be added. General conventions and architectural decisions belong in this file or `docs/architecture.md`; specific pitfalls belong in `docs/gotchas/<topic>.md`. Do NOT add low-level details about individual files unless they are a recurring pitfall.
- **After every session:** Capture reusable learnings (patterns, pitfalls, conventions discovered) via the `/evolving-loop` skill or the experience-extractor agent (when available).

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- In non-interactive shells (agents/CI), run Nx with `--tui=false --tuiAutoExit=true` so tasks always terminate cleanly and do not wait on Terminal UI state
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
