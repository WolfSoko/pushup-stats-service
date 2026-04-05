# Pushup Stats Service

Angular 21 / Nx monorepo for tracking pushup statistics with Firebase backend.

## Git Workflow

- **Trunk-based development:** Push directly to `main`. No feature branches by default.
- Feature branches or worktrees only when explicitly requested.

## Quality Philosophy

If a bug reaches production, the CI pipeline wasn't good enough. Every change must be backed by tests **before** pushing to `main`:

- **Unit tests:** Cover all new/changed logic. High coverage is mandatory, not optional.
- **Smoke tests:** Ensure critical user flows don't break (dashboard loads, entries CRUD, auth flow).
- **Regression tests:** Every bugfix must include a test that reproduces the bug first (TDD red-green).
- **Rule of thumb:** If you can't prove a change works via CI, it's not ready to merge.

When making changes, always write or update relevant tests as part of the same commit. Do not push untested code to `main`.

## Tech Stack

- **Frontend:** Angular 21 (standalone, zoneless, SSR)
- **Build:** Nx 22, pnpm
- **Backend:** Firebase (Firestore, Cloud Functions, Auth)
- **State:** @ngrx/signals (signal stores)
- **UI:** Angular Material 21, Chart.js
- **Testing:** Vitest (web), Jest (libs), Playwright (e2e)

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

### Module Boundary Rules

Enforced via `@nx/enforce-module-boundaries` in `eslint.config.mjs`:
- `scope:auth` -> `scope:models` only (no data-access!)
- `scope:motivation` -> `scope:models` only (no auth!)
- `scope:data-access` -> `scope:models` only
- `scope:reminders` -> `scope:models`, `scope:data-access`, `scope:motivation` (no auth!)
- `scope:app` -> everything

### Domain Models

Split into focused files under `libs/stats/src/lib/models/`:
- `pushup.models.ts` - PushupRecord, PushupCreate, PushupUpdate
- `stats.models.ts` - StatsResponse, StatsMeta, StatsFilter
- `user-config.models.ts` - UserConfig, UserConfigUpdate, UserRole
- `reminder-config.models.ts` - ReminderConfig

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
| web app | `web` |

## i18n / Internationalization

- **Source locale:** German (`de`), **Translation:** English (`en`)
- **Format:** XLIFF 2.0 (`web/src/locale/messages.xlf` / `messages.en.xlf`)
- Templates: `i18n="@@your.id"` attribute; programmatic: `` $localize`:@@your.id:German text` ``
- `LOCALE_ID` is set automatically by Angular i18n at build time – NEVER provide it manually in `app.config.ts`
- Dynamic data (e.g. blog posts, feature descriptions) must be locale-aware too – XLIFF only covers templates and `$localize`. Use `inject(LOCALE_ID)` to select the right data at runtime.
- Date pipes: use locale-aware formats (`'longDate'`, `'short'`) – never hardcode a locale parameter like `'de'`

## CI/CD & Deployment

- **CI Pipeline** (`.github/workflows/ci.yml`): Runs lint, test, build, e2e on every push to `main` and on PRs.
- **Deploy gate:** CI fast-forwards the `deploy` branch from `main` only after all checks pass (`promote-to-deploy` job). Both deployment targets watch this branch.
- **Firebase Hosting** (static, `.github/workflows/firebase-hosting-merge.yml`): Triggers on push to `deploy` branch.
- **Firebase App Hosting** (SSR/Cloud Run, `apphosting.yaml`): Auto-deploys on push to `deploy` branch (configured in Firebase Console).
- **PR Previews** (`.github/workflows/firebase-hosting-pull-request.yml`): Deploys a preview channel on every PR (same-repo only).
- **Rule:** No deployment path should bypass CI. Both Hosting and App Hosting are gated on green CI.

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

## Workflow

- **Before pushing:** Run the pre-push checklist above.
- **After completing a feature or bugfix:** Review whether any new broadly applicable knowledge should be added to this file (general conventions, architectural decisions, i18n rules, etc.). Do NOT add low-level details about individual files unless they are a recurring pitfall.
- **After every session:** Capture reusable learnings (patterns, pitfalls, conventions discovered) via the `/evolving-loop` skill or the experience-extractor agent.
