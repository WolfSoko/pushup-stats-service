# Pushup Stats Service — Agent Instructions

Single source of truth for all AI agents working on this repo (Claude Code, Copilot, Gemini, etc.). Claude-specific and Copilot-specific entry-point files (`CLAUDE.md`, `.github/copilot-instructions.md`) reference this file.

Angular 21 / Nx monorepo for tracking pushup statistics with Firebase backend.

## Git Workflow

- **Trunk-based development:** Push directly to `main`. No feature branches by default.
- Feature branches or worktrees only when explicitly requested.
- **Never commit secrets or user-identifiable data** (API keys, service account JSON, database UIDs, user email addresses) to the repository. Pass them as CLI arguments, environment variables, or Firebase Secrets instead.
- **Pre-commit reformats files:** Husky + lint-staged run `eslint --fix` + `prettier --write` on every commit. Your staged files may differ from what you wrote (whitespace, line wrapping, fixable lint). Re-read the file before further edits after a commit.

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
- **External functions** (e.g. `deleteUser` from Firebase) are mocked on the imported module — never with dynamic `import()` or `require()`.
- **Given-When-Then** style tests are preferred.

## Tech Stack

- **Frontend:** Angular 21 (standalone, zoneless, SSR)
- **Build:** Nx 22, pnpm
- **Backend:** Firebase (Firestore, Cloud Functions, Auth)
- **State:** @ngrx/signals (signal stores)
- **UI:** Angular Material 21, Chart.js – **always prefer Material components** (`mat-button`, `mat-icon`, etc.) over plain HTML elements for buttons, inputs, dialogs, and other interactive controls
- **Cloud Functions:** TypeScript, esbuild bundle, Jest tests (Nx project `cloud-functions`)
- **Testing:** Vitest (web), Jest (libs + cloud-functions), Playwright (e2e)
- **Deprecated:** `@angular/animations` is deprecated and NOT a project dependency — do not use or import it. Use CSS animations/transitions instead.

## Architecture

### Library Dependency Graph

```
@pu-stats/models          (pure types, zero dependencies)
    ^
    |--- @pu-stats/data-access  (Firestore API layer)
    |--- @pu-auth/auth          (Firebase Auth, decoupled via ports)
    |--- @pu-stats/motivation   (quote service, no auth dependency)
    |--- @pu-stats/quick-add    (FAB + adaptive suggestions)
    |--- @pu-stats/ads          (isolated, no lib dependencies)
    |--- @pu-reminders/reminders (depends on data-access + motivation, NOT auth)
    |--- cloud-functions        (Cloud Functions, depends on models only)
```

### Key Architectural Patterns

**Ports & Adapters (Auth <-> Data-Access):**

- Auth defines `PostAuthHook` interface and `USER_PROFILE_PORT` token
- Concrete implementations (`UserProfileSyncHook`, `GuestDataMigrationHook`) live at app level
- Wired in `app.config.ts` via DI providers
- Auth has ZERO imports from `@pu-stats/data-access`

**State Management Conventions:**

- **Global state:** `@ngrx/signals` signalStore with `providedIn: 'root'`
  - `AdsStore` - Remote Config + consent (ads module)
  - `MotivationStore` - quote cache with user-keyed localStorage (motivation module)
  - `LiveDataStore` - Firestore real-time entries + tick (data-access, browser-only)
  - `LeaderboardStore` - shared leaderboard data with `load({ force })` (data-access)
  - `AuthStore`, `ReminderStore`, `PushSubscriptionStore`, `ThemeService` (existing)
- **Feature/form state:** signalStore with component-level DI
  - `DashboardStore` - stats, goals, ads, motivation for dashboard page
  - `AnalysisStore` - date filters, trends, breakdowns for analysis page
  - `EntriesStore` - CRUD, filters, browser/SSR hybrid for entries page
  - `ReminderFormStore`, `LoginUiStore`, `RegisterUiStore` (existing)
- **Resources:** Live inside stores via `withProps`, not in components
- **Derived state:** `computed()` inside `withComputed`
- **Side effects:** `effect()` in components or `withHooks`
- **API Services:** Stateless, return Promises/Observables - no signals, no state
- **No RxJS for state** - only in data-access layer for Firestore Observables + `toSignal()`
- **Signal timing and equality caveats** — see [`docs/gotchas/signals.md`](docs/gotchas/signals.md).

**Three-Layer Architecture:**

```
UI Component  →  Signal Store  →  API Service
(Template)       (State + Logic)   (Database)
```

- Components only do template binding + user event delegation
- Stores own all state, resources, computed signals, and domain logic
- API services are pure data access with no state

**App Root Delegation:**

- `ReminderOrchestrationService` handles reminder lifecycle (auth -> config load -> start/stop)
- `AppDataFacade` consolidates app-level resources (recent entries, daily goal, progress)
- `QuickAddOrchestrationService` handles quick-add entry creation and dialog routing
- App component handles only layout, navigation, and UI events

**Shared Entry Dialog Pattern:**

- `CreateEntryDialogComponent` serves as the single dialog for both creating and editing entries.
- **Create mode:** Opened without `MAT_DIALOG_DATA` — starts with empty fields, default timestamp.
- **Edit mode:** Opened with `EntryDialogData` via `MAT_DIALOG_DATA` — pre-fills timestamp, sets, type, source from existing entry. Preserves original timestamp format when unchanged.
- Both modes return `CreateEntryResult` on submit. The stats table's `openEditDialog()` maps the result back to an update emission.
- **Sets UX:** Starts with a single "Reps" field. A "+" button adds sets (pre-filled from previous value). Multi-set mode shows "Set 1", "Set 2", etc. with remove buttons and a total display.

### Module Boundary Rules

Enforced via `@nx/enforce-module-boundaries` in `eslint.config.mjs`:

- `scope:auth` -> `scope:models` only (no data-access!)
- `scope:motivation` -> `scope:models` only (no auth!)
- `scope:data-access` -> `scope:models` only
- `scope:cloud-functions` -> `scope:models` only
- `scope:reminders` -> `scope:models`, `scope:data-access`, `scope:motivation` (no auth!)
- `scope:app` -> everything

### Domain Models

Split into focused files under `libs/stats/src/lib/models/`:

- `pushup.models.ts` - PushupRecord, PushupCreate, PushupUpdate
  - **Sets:** `sets?: number[]` stores per-set reps (e.g. `[10, 10, 10]`). `reps` is always the total sum. `sets` is optional for backward compatibility — old entries without sets work unchanged. All aggregation (UserStats, deltas, charts) uses `reps` only.
- `stats.models.ts` - StatsResponse, StatsMeta, StatsFilter
- `user-config.models.ts` - UserConfig, UserConfigUpdate
- `reminder-config.models.ts` - ReminderConfig
- `user-stats.models.ts` - UserStats (server-side precomputed), emptyUserStats, USERSTATS_VERSION
  - UserStats includes a `version` field for migration support. See [`docs/gotchas/cloud-functions.md`](docs/gotchas/cloud-functions.md) for the versioning strategy.

## Commands

```bash
pnpm nx test <project>           # Run tests for a specific project
pnpm nx lint <project>           # Lint a specific project
pnpm nx build web --configuration=development  # Build (dev)
pnpm nx run-many --target=test   # Run all tests
pnpm nx run-many --target=lint   # Lint all projects
```

## Project Names (Nx)

| Library         | Nx Project Name     |
| --------------- | ------------------- |
| auth            | `auth`              |
| data-access     | `stats-data-access` |
| models/stats    | `stats-models`      |
| motivation      | `pus-motivation`    |
| reminders       | `pus-reminders`     |
| quick-add       | `stats-quick-add`   |
| ads             | `stats-ads`         |
| testing         | `testing`           |
| tools           | `tools`             |
| data-store      | `data-store`        |
| cloud-functions | `cloud-functions`   |
| web app         | `web`               |

## i18n / Internationalization

- **Source locale:** German (`de`), **Translation:** English (`en`)
- **Format:** XLIFF 2.0 (`web/src/locale/messages.xlf` / `messages.en.xlf`)
- **Templates:** `i18n="@@your.id"` attribute; programmatic: `` $localize`:@@your.id:German text` ``
- **XLIFF maintenance, locale switching, root `/` handling, and dynamic data localisation** — see [`docs/gotchas/i18n.md`](docs/gotchas/i18n.md).

## CI/CD & Deployment

- **CI Pipeline** (`.github/workflows/ci.yml`): Runs lint, test, build, e2e on every push to `main` and on PRs.
- **Agent pool:** Nx Cloud dynamic distribution — see `.nx/workflows/distribution-config.yaml`. Details in [`docs/gotchas/build-and-tooling.md`](docs/gotchas/build-and-tooling.md).
- **Deploy gate:** CI fast-forwards the `deploy` branch from `main` only after all checks pass (`promote-to-deploy` job). Both deployment targets watch this branch.
- **Firebase Hosting** (static, `.github/workflows/firebase-hosting-merge.yml`): Triggers on push to `deploy` branch.
- **Firebase App Hosting** (SSR/Cloud Run, `apphosting.yaml`): Auto-deploys on push to `deploy` branch (configured in Firebase Console).
- **PR Previews** (`.github/workflows/firebase-hosting-pull-request.yml`): Full staging deployment on every PR (same-repo only) — see Staging Environment below.
- **Rule:** No deployment path should bypass CI. Both Hosting and App Hosting are gated on green CI.
- **Sentry source maps:** The deploy workflow uploads source maps to Sentry after the production build (`pnpm sentry:sourcemaps`). Requires `SENTRY_AUTH_TOKEN` GitHub secret. See Observability section below.

### Staging Environment

A separate Firebase project (`pushup-stats-staging-867b7`) provides full isolation for PR previews:

- **PR workflow deploys:** Hosting preview + Cloud Functions + Firestore rules & indexes to the staging project.
- **Web app build:** Uses `staging` configuration (`pnpm nx run web:build -c staging`) which swaps `fire.config.ts` → `fire.config.staging.ts` and `firebase-runtime.ts` → `firebase-runtime.staging.ts` (separate VAPID key for staging push notifications).
- **Staging config:** `web/src/env/fire.config.staging.ts` points to the staging project.
- **App Hosting config:** `apphosting.staging.yaml` (reduced `maxInstances: 1`).
- **Firebase alias:** `staging` alias in `data-store/.firebaserc`.
- **GitHub Secret required:** `FIREBASE_SERVICE_ACCOUNT_PUSHUP_STATS_STAGING` — service account JSON for the staging project (must be added in GitHub repo settings).
- **Firestore region:** `europe-west3` (Frankfurt). Must match when creating the database in Firebase Console.
- **Firestore rules & indexes** are shared source files (`data-store/firestore.rules`, `data-store/firestore.indexes.json`) deployed to both projects.
- **Infra scripts:** `infra/setup-staging.sh` automates full project setup (APIs, SA, IAM, secrets); `infra/teardown-staging.sh` removes deploy resources. Both support `--dry-run`.

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

## Consent & Ads

- **Cookie consent** is stored in `localStorage` key `pus_cookie_consent` (`'all'` | `'necessary'` | absent).
- **AdsStore** reads this on init: `consentAnswered` gates whether any ads render; `targetedAdsConsent` controls personalized vs. non-personalized (NPA) mode.
- **Analytics consent** lives in `pus_analytics_consent` (`'granted'` | `'denied'`), set by the consent banner alongside the cookie consent.
- **Non-personalized ads** don't require GDPR opt-in but still need a consent _notice_. The banner satisfies this.
- When testing ads components, mock `AdsStore` (not `RemoteConfig`) – see `ad-slot.component.spec.ts` for the pattern.

## Legal Pages

- `/impressum` and `/datenschutz` live under `web/src/app/marketing/legal/`.
- Both are prerendered (SSG) for crawler visibility.
- Footer links are in the app shell (`app.html`), visible on every page.
- `robots.txt` is a static file in `web/public/`.
- **`sitemap.xml` is auto-generated** from blog posts + static routes via `node tools/src/generate-sitemap.mjs` (Nx target: `pnpm nx run tools:generate-sitemap`). It runs automatically before every `web:build`. When adding new **public** routes, add them to the `staticRoutes` array in the script. Blog posts are picked up automatically from `blog-posts.data.ts`.

## Push Notifications

- **Two-tier reminder system:** In-app (`ReminderService` with `setInterval`) + server-side (`dispatchPushReminders` Cloud Function every 5 min via Web Push).
- **Browser API quirks, VAPID keys, subscription vs reminder toggle, Cloud Function lease handling** — see [`docs/gotchas/push-and-service-workers.md`](docs/gotchas/push-and-service-workers.md).

## Cloud Functions (data-store/functions/)

- **Nx project `cloud-functions`:** TypeScript source in `data-store/functions/src/`, esbuild bundles to `data-store/functions-dist/`. Jest tests with `ts-jest`.
- **Pure logic extraction:** Keep Cloud Function business logic in separate pure modules (e.g. `user-stats-delta.ts`) for unit testing without Firestore mocks. The trigger functions in `index.ts` are thin wrappers.
- **Pure business logic modules** (decomposed from the monolithic `index.ts`):
  - **datetime/:** Berlin timezone utilities (`berlinDateParts`, `isoWeekFromYmd`)
  - **profile/:** Display name sanitization & leaderboard privacy logic
  - **leaderboard/:** Ranking aggregation, period key calculations
  - **authentication/:** Recaptcha response parsing & validation
  - **motivation/:** Quote cache logic, Gemini fallback, name sanitization
  - **push/subscription:** Subscription ID generation, payload validation
  - **push/reminders:** Reminder scheduling (quiet hours, snooze, intervals)
  - **admin/:** User privilege checks (Custom Claims validation), deletion validation, batch helpers
- All modules include comprehensive Jest tests (no Firebase dependencies for pure logic).
- **Deploy-path rule, `defineSecret()` IAM requirements, delta-aggregation pitfalls, UserStats versioning system** — see [`docs/gotchas/cloud-functions.md`](docs/gotchas/cloud-functions.md).

### Admin Authorization

Admin access uses **Firebase Custom Claims** (`{ admin: true }`) — NOT Firestore fields. This ensures only server-side Admin SDK can grant admin privileges.

- **Cloud Functions:** `assertAdmin(request)` checks `request.auth.token.admin === true`
- **Frontend guard:** `adminGuard` reads `getIdTokenResult().claims.admin`
- **Frontend service:** `UserContextService.isAdmin` checks ID token claims via resource
- **Firestore rules:** Client writes to `role` field are blocked as defense-in-depth
- **Granting admin:** `node scripts/set-admin-claim.mjs <email-or-uid>` (requires Admin SDK credentials)
- **Token refresh:** After setting claims, user must re-login (or wait ~1h) for the token to update

## Precomputed Data

Stores consuming server-side precomputed data (e.g. `UserStats`) must validate period keys and handle timestamp-offset variations. See [`docs/gotchas/precomputed-data.md`](docs/gotchas/precomputed-data.md).

## Observability (Sentry)

- **SDKs:** `@sentry/angular` (browser, `web/src/main.ts`) + `@sentry/node` (SSR server, `web/src/server.ts` + Cloud Functions, `data-store/functions/src/index.ts`). Browser and SSR only active in production; Cloud Functions always active.
- **Release identifier:** Short git SHA (e.g. `abc1234`). No semantic versioning.
  - **Browser:** Injected into HTML as `globalThis.SENTRY_RELEASE` by the upload script. Read by `Sentry.init()` in `main.ts`.
  - **Server:** Read from `process.env['GIT_SHA']` in `server.ts`.
  - **Cloud Functions:** Read from `process.env['SENTRY_RELEASE']` — written to `data-store/functions-dist/.env` by the upload script during CI deploy.
- **Release lifecycle:** The deploy script (`scripts/upload-sentry-sourcemaps.sh`) creates a release, links commits (`set-commits --auto` for suspect commits), uploads source maps (web + Cloud Functions), and finalizes the release. Map files are deleted from build outputs after upload so they are not shipped to production.
- **Config:** Org and project are set in `.sentryclirc`. DSN is hardcoded in `main.ts`, `server.ts`, and CF `index.ts`.
- **GitHub Secret required:** `SENTRY_AUTH_TOKEN` — Sentry auth token with scopes `org:ci`, `project:releases`, `project:write`. The deploy step is skipped gracefully when the secret is absent.

## Gotchas & Pitfalls

Detailed pitfalls and their fixes live under [`docs/gotchas/`](docs/gotchas/). Check the relevant file **before** debugging a class of problem:

| Area                                                         | File                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Angular signals (`toSignal`, same-reference emissions)       | [`docs/gotchas/signals.md`](docs/gotchas/signals.md)                                   |
| Tests (mocks, spies, `resource.reload`, Jest/Vitest quirks)  | [`docs/gotchas/testing.md`](docs/gotchas/testing.md)                                   |
| Cloud Functions (secrets IAM, delta aggregation, versioning) | [`docs/gotchas/cloud-functions.md`](docs/gotchas/cloud-functions.md)                   |
| Push notifications & Service Workers                         | [`docs/gotchas/push-and-service-workers.md`](docs/gotchas/push-and-service-workers.md) |
| i18n (XLIFF, locale switching, `LOCALE_ID`)                  | [`docs/gotchas/i18n.md`](docs/gotchas/i18n.md)                                         |
| Build & tooling (font flakes, pnpm dlx, Nx Cloud agents)     | [`docs/gotchas/build-and-tooling.md`](docs/gotchas/build-and-tooling.md)               |
| Precomputed data (period-key staleness, timestamp formats)   | [`docs/gotchas/precomputed-data.md`](docs/gotchas/precomputed-data.md)                 |
| Firestore client (`setDoc({merge:true})` nested-map clobber) | [`docs/gotchas/firestore.md`](docs/gotchas/firestore.md)                               |

## Workflow

- **Before pushing:** Run the pre-push checklist above.
- **After completing a feature or bugfix:** Review whether any new broadly applicable knowledge should be added. General conventions and architectural decisions belong in this file; specific pitfalls belong in `docs/gotchas/<topic>.md`. Do NOT add low-level details about individual files unless they are a recurring pitfall.
- **After every session:** Capture reusable learnings (patterns, pitfalls, conventions discovered) via the `/evolving-loop` skill or the experience-extractor agent (when available).

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
