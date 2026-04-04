# Pushup Stats Service

Angular 21 / Nx monorepo for tracking pushup statistics with Firebase backend.

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
- **Feature/form state:** signalStore with component-level DI (e.g., `ReminderFormStore`)
- **Async data loading:** Angular `resource()` API
- **Derived state:** `computed()`
- **Side effects:** `effect()`
- **No RxJS for state** - only in data-access layer for Firestore Observables + `toSignal()`

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
