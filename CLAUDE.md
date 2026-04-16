# Pushup Stats Service

Angular 21 / Nx monorepo for tracking pushup statistics with Firebase backend.

## Git Workflow

- **Trunk-based development:** Push directly to `main`. No feature branches by default.
- Feature branches or worktrees only when explicitly requested.
- **Never commit secrets or user-identifiable data** (API keys, service account JSON, database UIDs, user email addresses) to the repository. Pass them as CLI arguments, environment variables, or Firebase Secrets instead.

## Quality Philosophy

If a bug reaches production, the CI pipeline wasn't good enough. Every change must be backed by tests **before** pushing to `main`:

- **Unit tests:** Cover all new/changed logic. High coverage is mandatory, not optional.
- **Smoke tests:** Ensure critical user flows don't break (dashboard loads, entries CRUD, auth flow).
- **Regression tests:** Every bugfix must include a test that reproduces the bug first (TDD red-green).
- **Rule of thumb:** If you can't prove a change works via CI, it's not ready to merge.

When making changes, always write or update relevant tests as part of the same commit. **Never push new or changed code without corresponding tests — this applies to all branches, not just `main`.** If tests for the changed code don't exist yet, write them before pushing.

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
- **Signal timing pitfall (`toSignal`):** `toSignal()` starts with `undefined` and updates via microtask. After async operations (e.g. `signInWithPopup`), signals may not yet reflect the new state. Use `auth.currentUser` (synchronous) as fallback where immediate access is needed — see `LoginUiStore`, `RegisterUiStore`, `AuthService.upgradeWithEmail()` for the pattern. For templates, use `authResolved` (= `authState() !== undefined`) to distinguish "loading" from "not authenticated".

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
  - **Note:** UserStats includes `version` field for migration support. See Cloud Functions section for versioning strategy.

## Commands

```bash
pnpm nx test <project>           # Run tests for a specific project
pnpm nx lint <project>           # Lint a specific project
pnpm nx build web --configuration=development  # Build (dev)
pnpm nx run-many --target=test   # Run all tests
pnpm nx run-many --target=lint   # Lint all projects
```

## Project Names (Nx)

| Library | Nx Project Name |
|---------|----------------|
| auth | `auth` |
| data-access | `stats-data-access` |
| models/stats | `stats-models` |
| motivation | `pus-motivation` |
| reminders | `pus-reminders` |
| quick-add | `stats-quick-add` |
| ads | `stats-ads` |
| testing | `testing` |
| tools | `tools` |
| data-store | `data-store` |
| cloud-functions | `cloud-functions` |
| web app | `web` |

## i18n / Internationalization

- **Source locale:** German (`de`), **Translation:** English (`en`)
- **Format:** XLIFF 2.0 (`web/src/locale/messages.xlf` / `messages.en.xlf`)
- **Source XLIFF (`messages.xlf`)** is auto-generated — **never edit it manually**. After changing `i18n`-marked templates, run `pnpm nx run web:extract-i18n` to regenerate it. Only manually edit the English translation file (`messages.en.xlf`).
- Templates: `i18n="@@your.id"` attribute; programmatic: `` $localize`:@@your.id:German text` ``
- `LOCALE_ID` is set automatically by Angular i18n at build time – NEVER provide it manually in `app.config.ts`
- Dynamic data (e.g. blog posts, feature descriptions) must be locale-aware too – XLIFF only covers templates and `$localize`. Use `inject(LOCALE_ID)` to select the right data at runtime.
- Date pipes: use locale-aware formats (`'longDate'`, `'short'`) – never hardcode a locale parameter like `'de'`
- **XLF maintenance:** When moving i18n-annotated text between components, update the `<source>` in both XLF files to match the new template structure. Stale `<source>` with old placeholder names (`START_BLOCK_IF`, etc.) causes production build errors.
- **Language switching:** Implemented in `app.ts` `setLanguage()` via `window.location.replace()` with locale prefix (`/de/…`, `/en/…`). Must preserve current path, query params, and hash. Root paths need trailing slash (`/de/`, `/en/`) to match Firebase hosting rewrites.

## CI/CD & Deployment

- **CI Pipeline** (`.github/workflows/ci.yml`): Runs lint, test, build, e2e on every push to `main` and on PRs.
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

Do NOT push if any of these fail. Fix first, then push.

## Consent & Ads

- **Cookie consent** is stored in `localStorage` key `pus_cookie_consent` (`'all'` | `'necessary'` | absent).
- **AdsStore** reads this on init: `consentAnswered` gates whether any ads render; `targetedAdsConsent` controls personalized vs. non-personalized (NPA) mode.
- **Analytics consent** lives in `pus_analytics_consent` (`'granted'` | `'denied'`), set by the consent banner alongside the cookie consent.
- **Non-personalized ads** don't require GDPR opt-in but still need a consent *notice*. The banner satisfies this.
- When testing ads components, mock `AdsStore` (not `RemoteConfig`) – see `ad-slot.component.spec.ts` for the pattern.

## Legal Pages

- `/impressum` and `/datenschutz` live under `web/src/app/marketing/legal/`.
- Both are prerendered (SSG) for crawler visibility.
- Footer links are in the app shell (`app.html`), visible on every page.
- `robots.txt` is a static file in `web/public/`.
- **`sitemap.xml` is auto-generated** from blog posts + static routes via `node tools/src/generate-sitemap.mjs` (Nx target: `pnpm nx run tools:generate-sitemap`). It runs automatically before every `web:build`. When adding new **public** routes, add them to the `staticRoutes` array in the script. Blog posts are picked up automatically from `blog-posts.data.ts`.

## Push Notifications & Service Workers

- **Two-tier reminder system:** In-app (`ReminderService` with `setInterval`) + server-side (`dispatchPushReminders` Cloud Function every 5 min via Web Push).
- **Android Chrome does NOT support `new Notification()`** — always use `ServiceWorkerRegistration.showNotification()` with a `new Notification()` fallback for desktop/dev.
- **Never use `navigator.serviceWorker.ready`** in async code paths — it hangs forever when no SW is registered (dev mode: `enabled: !isDevMode()`). Use `navigator.serviceWorker.getRegistration()` which resolves immediately with `undefined`.
- **`renotify: true`** is not in the TypeScript `NotificationOptions` type — cast with `as NotificationOptions`.
- **Push subscription ≠ reminder toggle:** They are separate actions. Auto-subscribing to push when enabling reminders must only happen on first enable (not every save) to respect explicit push opt-out.
- **VAPID keys:** Public key in `web/src/env/firebase-runtime.ts`, private key in Firebase Secrets (`VAPID_PRIVATE_KEY`).
- **Cloud Function `dispatchPushReminders`:** Uses transactional lease (`inProgress` flag) to prevent duplicate sends. Always release lease in `finally`.

## Cloud Functions (data-store/functions/)

- **Nx project `cloud-functions`:** TypeScript source in `data-store/functions/src/`, esbuild bundles to `data-store/functions-dist/`. Jest tests with `ts-jest`.
- **Firebase deploy path:** `functions.source` in `firebase.json` **must** be inside the Firebase project directory (`data-store/`). Parent-relative paths (`../dist/...`) are rejected by Firebase CLI.
- **Pure logic extraction:** Keep Cloud Function business logic in separate pure modules (e.g. `user-stats-delta.ts`) for unit testing without Firestore mocks. The trigger functions in `index.ts` are thin wrappers.
- **`defineSecret()` requires IAM setup** — when introducing a new `defineSecret('FOO')` in `data-store/functions/src/**`, the prod Cloud Functions deploy WILL fail until the runtime SA (`<project-number>-compute@developer.gserviceaccount.com`) has `roles/secretmanager.secretAccessor` on the secret. A freshly created Secret Manager secret has **zero IAM bindings** (`gcloud secrets get-iam-policy NAME` returns only `etag: ACAB`), and the prod deploy SA intentionally does NOT have `secretmanager.admin` to grant it automatically. **Fix:** add the secret name to the `SECRETS=(…)` array in `infra/setup-prod-secrets.sh` and run the script. It's idempotent and resolves the runtime SA dynamically from the project number.
- **Delta-based aggregation pitfalls:**
  - When an entry's **timestamp changes** on update, a single delta is wrong — it must be split into undo-old + apply-new. Otherwise the old day/week/month/heatmap bucket is never decremented.
  - Fields that can't be maintained incrementally (like `totalDays` — counting unique days) require heuristic tracking or periodic `rebuildFromEntries()` to stay accurate.
  - `bestDay` and `bestSingleEntry` can only grow via deltas. When entries are deleted, a rebuild is needed to find the true new best.

### UserStats Versioning System

**Version tracking enables automatic rebuilds when calculation logic changes:**
- Every `UserStats` rebuild sets `version: USERSTATS_VERSION` (current v3)
- Cloud Function checks: `if (stored.version < USERSTATS_VERSION) → auto-rebuild`
- New users: Auto-rebuild on first entry ensures correct initialization with today's period keys

**Version changelog:**
- **v1:** Legacy (no versioning)
- **v2:** Fixed period keys to use TODAY (not last entry date in rebuild)
- **v3:** Fixed `berlinParts()` to treat offset-less timestamps as Berlin local time

**How it works:**
```typescript
// In updateUserStatsOnPushupWrite:
if (existingStats.version < USERSTATS_VERSION) {
  // Fetch all entries and call rebuildFromEntries
  // automatically applies calculation improvements
  logger.info('Auto-rebuild on version upgrade', {
    oldVersion: existingStats.version,
    newVersion: USERSTATS_VERSION,
  });
}
```

**Future deployments:** Increment `USERSTATS_VERSION` in `@pu-stats/models`. Affected users automatically rebuild on next entry without manual intervention.

### Pure Business Logic Modules

Decomposed from monolithic index.ts (1220 → ~500 lines wrapper):
- **datetime/:** Berlin timezone utilities (`berlinDateParts`, `isoWeekFromYmd`)
- **profile/:** Display name sanitization & leaderboard privacy logic
- **leaderboard/:** Ranking aggregation, period key calculations
- **authentication/:** Recaptcha response parsing & validation
- **motivation/:** Quote cache logic, Gemini fallback, name sanitization
- **push/subscription:** Subscription ID generation, payload validation
- **push/reminders:** Reminder scheduling (quiet hours, snooze, intervals)
- **admin/:** User privilege checks (Custom Claims validation), deletion validation, batch helpers

All modules include comprehensive Jest tests (no Firebase dependencies for pure logic).

### Admin Authorization

Admin access uses **Firebase Custom Claims** (`{ admin: true }`) — NOT Firestore fields. This ensures only server-side Admin SDK can grant admin privileges.

- **Cloud Functions:** `assertAdmin(request)` checks `request.auth.token.admin === true`
- **Frontend guard:** `adminGuard` reads `getIdTokenResult().claims.admin`
- **Frontend service:** `UserContextService.isAdmin` checks ID token claims via resource
- **Firestore rules:** Client writes to `role` field are blocked as defense-in-depth
- **Granting admin:** `node scripts/set-admin-claim.mjs <email-or-uid>` (requires Admin SDK credentials)
- **Token refresh:** After setting claims, user must re-login (or wait ~1h) for the token to update

## Precomputed Data Staleness

When stores consume server-side precomputed data (e.g. `UserStats`), **always validate period keys before trusting the values:**
- `dailyReps` → check `dailyKey === toBerlinIsoDate(new Date())`
- `weeklyReps` → check `weeklyKey === currentIsoWeekKey()`
- `monthlyReps` → check `monthlyKey === currentMonthKey()`
- `currentStreak` → check `lastEntryDate` is today or yesterday

Fall back to client-side computation when keys are stale. The precomputed doc is only updated on writes — it goes stale on period rollover without new entries.

**Timestamp format:** Entry timestamps are stored as ISO strings. New entries include the browser's local timezone offset (e.g. `2026-04-05T22:50+02:00`). Older entries may lack the offset (e.g. `2026-04-05T22:50`). The Cloud Function's `berlinParts()` handles both: offset-less timestamps are treated as Berlin local time; timestamps with explicit offsets are converted to Berlin via `Intl`. Always use `appendLocalOffset()` when creating new timestamps from `<input type="datetime-local">` values.

**Note on period key calculations:** UserStats now rebuilds with `version: USERSTATS_VERSION` to ensure period keys are calculated for TODAY (not the last entry date). Period keys in newly built stats reflect the current period, allowing proper validation with client-side "today" calculations. Old stats (v1/v2) may have incorrect period keys; they auto-rebuild on next entry when version is detected as outdated.

## Testing Pitfalls

- **Shared signal mocks:** When tests mutate shared `signal()` mocks (e.g. `authStoreMock.error.set(...)`), always reset them in `beforeEach`. Otherwise tests become order-dependent.
- **`window.location` spies:** `vitest.spyOn(window, 'location', 'get')` is NOT restored by `clearAllMocks()`. Add `afterEach(() => vitest.restoreAllMocks())` when using getter spies.
- **Angular `resource()` reload:** `resource.reload()` is async. After calling it, use `await fixture.whenStable()` before asserting on the reloaded data.
- **`MatDialog.open` spy:** Use `fixture.debugElement.injector.get(MatDialog)` (component injector) instead of `TestBed.inject(MatDialog)` to ensure you spy on the same instance the component uses.
- **Dialog components in `imports`:** Components only opened via `MatDialog.open()` do NOT belong in the host component's `imports` array (causes NG8113 warning). Keep them as TypeScript imports only.
- **`@angular/fire/firestore` import in Jest:** Importing the module at all triggers `fetch is not defined`. Always `jest.mock('@angular/fire/firestore', () => ({...}))` at the top of the file — see `pushup-firestore.service.spec.ts` for the pattern. Use `jest.mocked(getDoc)` instead of `jest.requireMock()` for type safety.
- **Cloud Function pure logic testing:** Extract business logic to separate modules (not in Cloud Function triggers) for testability. See `user-stats-delta.ts` pattern: pure functions tested separately via Jest without Firebase mocks, triggers are thin wrappers that call the logic. This enables testing calculation correctness without mocking Firestore.
- **Version-based migrations:** When updating server-side calculation logic (e.g. UserStats), increment `USERSTATS_VERSION` constant. This triggers automatic rebuilds for affected users on their next entry. Tests must validate version is set correctly in rebuilt stats.

## Observability (Sentry)

- **SDKs:** `@sentry/angular` (browser, `web/src/main.ts`) + `@sentry/node` (SSR server, `web/src/server.ts`). Both only active in production.
- **Release identifier:** Short git SHA (e.g. `abc1234`). No semantic versioning.
  - **Browser:** Injected into HTML as `globalThis.SENTRY_RELEASE` by the upload script. Read by `Sentry.init()` in `main.ts`.
  - **Server:** Read from `process.env['GIT_SHA']` in `server.ts`.
- **Release lifecycle:** The deploy script (`scripts/upload-sentry-sourcemaps.sh`) creates a release, links commits (`set-commits --auto` for suspect commits), uploads source maps, and finalizes the release. Map files are deleted from `dist/` after upload so they are not shipped to production.
- **Config:** Org and project are set in `.sentryclirc`. DSN is hardcoded in `main.ts` and `server.ts`.
- **GitHub Secret required:** `SENTRY_AUTH_TOKEN` — Sentry auth token with scopes `org:ci`, `project:releases`, `project:write`. The deploy step is skipped gracefully when the secret is absent.

## Workflow

- **Before pushing:** Run the pre-push checklist above.
- **After completing a feature or bugfix:** Review whether any new broadly applicable knowledge should be added to this file (general conventions, architectural decisions, i18n rules, etc.). Do NOT add low-level details about individual files unless they are a recurring pitfall.
- **After every session:** Capture reusable learnings (patterns, pitfalls, conventions discovered) via the `/evolving-loop` skill or the experience-extractor agent.
