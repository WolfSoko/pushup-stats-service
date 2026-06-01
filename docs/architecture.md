# Architecture

Detailed architecture reference for the Pushup Stats Service. AGENTS.md keeps the high-level rules; this doc holds the patterns, dependency graph, and domain-model layout.

## Library Dependency Graph

```
@pu-stats/models                (pure types, zero dependencies)
@pu-stats/date                  (date/time helpers, standalone leaf — zero dependencies)
    ^
    |--- @pu-stats/data-access        (stateless Firestore API services)
    |        ^
    |        |--- @pu-stats/data-access-state  (reactive signal stores:
    |                                           LiveDataStore, LeaderboardStore)
    |--- @pu-auth/auth                (Firebase Auth, decoupled via ports)
    |--- @pu-stats/motivation         (quote service, no auth dependency)
    |--- @pu-stats/quick-add          (FAB + adaptive suggestions)
    |--- @pu-stats/auto-count         (pose-based rep counter, ports + state machine)
    |--- @pu-stats/ads                (isolated, no lib dependencies)
    |--- @pu-push/push                (Web Push subscription state + /push/ SW)
    |--- @pu-reminders/reminders      (in-app reminders; depends on data-access,
    |                                  motivation, push for SW registration. Coupling
    |                                  to push state is via SHOULD_SKIP_IN_APP_REMINDER
    |                                  port — no compile-time knowledge of push state)
    |--- cloud-functions              (Cloud Functions, depends on models only)
```

## Module Boundary Rules

Enforced via `@nx/enforce-module-boundaries` in `eslint.config.mjs`:

- `scope:date` -> nothing (standalone leaf — pure date/time helpers, no library deps)
- `scope:auth` -> `scope:models`, `scope:date` only (no data-access!)
- `scope:motivation` -> `scope:models`, `scope:date` only (no auth!)
- `scope:data-access` -> `scope:models`, `scope:date` only
- `scope:data-access-state` -> `scope:models`, `scope:data-access`, `scope:date`
- `scope:auto-count` -> `scope:models`, `scope:date` only
- `scope:cloud-functions` -> `scope:models`, `scope:date` only
- `scope:push` -> `scope:models`, `scope:data-access`, `scope:date` (no auth, no reminders!)
- `scope:reminders` -> `scope:models`, `scope:data-access`, `scope:data-access-state`, `scope:motivation`, `scope:push`, `scope:date` (no auth!)
- `scope:sw-push` -> nothing (standalone service-worker bundle; bundling anything else would bloat the SW)
- `scope:app` -> everything

## Nx Project Names

| Library           | Nx Project Name           |
| ----------------- | ------------------------- |
| auth              | `auth`                    |
| data-access       | `stats-data-access`       |
| data-access-state | `stats-data-access-state` |
| models/stats      | `stats-models`            |
| date              | `stats-date`              |
| motivation        | `pus-motivation`          |
| reminders         | `pus-reminders`           |
| push              | `pus-push`                |
| quick-add         | `stats-quick-add`         |
| auto-count        | `auto-count`              |
| ads               | `stats-ads`               |
| testing           | `testing`                 |
| tools             | `tools`                   |
| data-store        | `data-store`              |
| cloud-functions   | `cloud-functions`         |
| web app           | `web`                     |

## Key Architectural Patterns

### Ports & Adapters (Auth <-> Data-Access)

- Auth defines `PostAuthHook` interface and `USER_PROFILE_PORT` token
- Concrete implementations (`UserProfileSyncHook`, `GuestDataMigrationHook`) live at app level
- Wired in `app.config.ts` via DI providers
- Auth has ZERO imports from `@pu-stats/data-access`

### Ports & Adapters (Reminders <-> Push)

- `@pu-reminders/reminders` defines `SHOULD_SKIP_IN_APP_REMINDER` injection token (`() => boolean`, defaults to "never skip")
- App wires it in `app.config.ts` to read `PushSubscriptionService.status() === 'subscribed'`
- Reminders has ZERO compile-time knowledge of push subscription state — the dep on `@pu-push/push` is only for `PushSwRegistrationService` (the SW used for both in-app `showNotification` and server-side push delivery)

### Ports & Adapters (Auto-Count)

- `@pu-stats/auto-count` defines port tokens (`REP_COUNTER`, `HOLD_TIMER`, `POSE_DETECTOR_FACTORY`, `POSE_FRAME_SOURCE`) and interfaces
- Concrete implementations (`PoseRepCounterService`, `PoseHoldTimerService`) live in the lib but are hidden behind `provideAutoCount()`
- Browser-specific adapters (MediaPipe detector, camera frame source) live at app level in `web/src/app/auto-count/`
- Wired in `app.browser.config.ts` via `provideAutoCount()` which combines lib-level service bindings with app-level MediaPipe/camera providers
- Lib stays platform-agnostic: no browser-only or WASM dependencies, only pure pose detection logic + state machines
- Tests substitute fakes via DI at the port token level

### State Management Conventions

- **Global state:** `@ngrx/signals` signalStore with `providedIn: 'root'`
  - `AdsStore` - Remote Config + consent (ads module)
  - `MotivationStore` - quote cache with user-keyed localStorage (motivation module)
  - `LiveDataStore` - Firestore real-time entries + tick (data-access-state, browser-only)
  - `LeaderboardStore` - shared leaderboard data with `load({ force })` (data-access-state)
  - `TrainingPlanStore` - active training plan, derived "today" state, plan-day mutation methods (app-level)
  - `AuthStore`, `ReminderStore`, `PushSubscriptionService` (in `@pu-push/push`), `ThemeService` (existing)
- **Feature/form state:** signalStore with component-level DI
  - `DashboardStore` - stats, goals, ads, motivation, plan-day target override for dashboard page
  - `AnalysisStore` - date filters, trends, breakdowns for analysis page
  - `EntriesStore` - CRUD, filters, browser/SSR hybrid for entries page
  - `ReminderFormStore`, `LoginUiStore`, `RegisterUiStore` (existing)
- **Resources:** Live inside stores via `withProps`, not in components
- **Derived state:** `computed()` inside `withComputed`
- **Side effects:** `effect()` in components or `withHooks`
- **API Services:** Stateless, return Promises/Observables - no signals, no state
- **No RxJS for app-level state** - state lives in `@ngrx/signals` stores. RxJS is allowed inside `@pu-stats/data-access` for Firestore Observables, and `@pu-stats/data-access-state` signal stores may subscribe to those Observables (typically bridged via `toSignal()`, but a direct `.subscribe()` is fine for live-refresh side-effects like `LeaderboardStore`'s snapshot listener — state itself stays in signals).
- **Signal timing and equality caveats** — see [`gotchas/signals.md`](gotchas/signals.md).

### Three-Layer Architecture

```
UI Component  →  Signal Store  →  API Service
(Template)       (State + Logic)   (Database)
```

- Components only do template binding + user event delegation
- Stores own all state, resources, computed signals, and domain logic
- API services are pure data access with no state

### App Root Delegation

- `ReminderOrchestrationService` handles reminder lifecycle (auth -> config load -> start/stop)
- `AppDataFacade` consolidates app-level resources (recent entries, daily goal, progress)
- `QuickAddOrchestrationService` handles quick-add entry creation and dialog routing
- App component handles only layout, navigation, and UI events

### Shared Entry Dialog Pattern

- `CreateEntryDialogComponent` serves as the single dialog for both creating and editing entries.
- **Create mode:** Opened without `MAT_DIALOG_DATA` — starts with empty fields, default timestamp.
- **Edit mode:** Opened with `EntryDialogData` via `MAT_DIALOG_DATA` — pre-fills timestamp, sets, type, source from existing entry. Preserves original timestamp format when unchanged.
- Both modes return `CreateEntryResult` on submit. The stats table's `openEditDialog()` maps the result back to an update emission.
- **Sets UX:** Starts with a single "Reps" field. A "+" button adds sets (pre-filled from previous value). Multi-set mode shows "Set 1", "Set 2", etc. with remove buttons and a total display.

### Training Plans (curated catalog + active-plan state)

- **Catalog** (`libs/stats/src/lib/models/training-plan.catalog.ts`): static, versioned plan definitions with per-day `kind` (`main`/`light`/`rest`/`test`), `targetReps`, optional `sets[]`, and bilingual descriptions (`description` / `descriptionEn`). Plan IDs carry a `-vN` suffix so old `UserTrainingPlan` docs keep resolving when targets change.
- **Per-user state** (`userTrainingPlans/{userId}` in Firestore): `planId`, `startDate`, `status`, `completedDays[]`. Single active plan per user; starting another overwrites the doc.
- **Locale-aware rendering:** `localizePlan(plan, LOCALE_ID)` swaps title/summary/description fields. The catalog stores both languages because plans are structured curated data — putting them in XLIFF would lose the per-day pairing.
- **Single source of truth = `pushups` collection:** the `completedDays` flag is a UI shortcut. `logPlanDay(idx)` writes a real `pushups` entry (with `source: 'plan'`, plan-prescribed sets, noon timestamp on the plan day's calendar date) AND flips the flag. Without the entry, stats/streaks/leaderboard wouldn't reflect the workout.
- **Auto-mark via `effect()` in `withHooks`:** when `LiveDataStore.entries()` push today's reps past the plan target, today's flag flips automatically — read-only, never creates a new entry. Lets the existing Quick-Add/dialog flows propagate plan progress without an explicit button click.
- **Day-tick signal:** Berlin-date-based `currentDayIndex()` has no inherent signal dependency, so a long-running browser tab caches the previous calendar day past midnight. The store ticks an internal `_dayTick` signal once a minute (browser-only) so derived day state recomputes within ~60 s of midnight.

## Domain Models

Split into focused files under `libs/stats/src/lib/models/`:

- `pushup.models.ts` - PushupRecord, PushupCreate, PushupUpdate
  - **Sets:** `sets?: number[]` stores per-set reps (e.g. `[10, 10, 10]`). `reps` is always the total sum. `sets` is optional for backward compatibility — old entries without sets work unchanged. All aggregation (UserStats, deltas, charts) uses `reps` only.
- `stats.models.ts` - StatsResponse, StatsMeta, StatsFilter
- `user-config.models.ts` - UserConfig, UserConfigUpdate
- `reminder-config.models.ts` - ReminderConfig
- `user-stats.models.ts` - UserStats (server-side precomputed), emptyUserStats, USERSTATS_VERSION
- `training-plan.models.ts` - TrainingPlan, TrainingPlanDay, UserTrainingPlan, `localizePlan()`, `currentPlanDayIndex()`, `planDayByIndex()`, `isPlanCompleted()`. `parseIsoDate` round-trips Y/M/D after `new Date()` to reject impossible dates like `2026-02-30`.
- `training-plan.catalog.ts` - curated `TRAINING_PLANS` array + `findPlanById()` / `findPlanBySlug()` lookups. Test invariant: every plan's day indexes form a contiguous `1..totalDays` sequence and rest days have `targetReps === 0`.
  - UserStats includes a `version` field for migration support. See [`gotchas/cloud-functions.md`](gotchas/cloud-functions.md) for the versioning strategy.

### Generic exercise model — measurement vs. unit vs. companion

`ExerciseDefinition` separates three concerns deliberately:

- **`measurement`** - which entry field carries the primary value. Drives validation (range checks against `def.min`/`def.max`), aggregation (which field sums roll up), and storage. `MeasurementType` is `'reps' | 'time' | 'distance' | 'weight' | 'distance-time'`.
- **`unit`** - the rendering hint. `formatExerciseValue(value, unit)` switches on this string so a single measurement type can carry alternate display units later (kg vs. lb, km vs. mi). The catalog currently uses `'reps' | 's' | 'm' | 'kg'`.
- **Companion fields** - secondary values an entry may (or must) carry alongside the primary. Declared in `COMPANION_FIELDS` / `REQUIRED_COMPANIONS` per measurement. `'distance'` allows an optional `durationSec`; `'distance-time'` requires it; `'weight'` requires `weightKg`.

**Display routing.** Components don't branch on `measurement` themselves — they call `formatEntryDisplay(entry, def)` / `formatEntryTotal({ primary, companion }, def)`, which:

- For `'distance-time'`: renders the composite `"5.00 km · 25:00 (5:00 /km)"` via `formatDistanceTime`.
- For everything else: reads the field that `measurementValueField(measurement)` returns and pipes it through `formatExerciseValue(value, def.unit)`.

`measurementCompanionValueField(measurement)` returns the secondary display field for composite measurements (currently only `'durationSec'` for `'distance-time'`). Aggregation paths use it to sum a second total alongside the primary, so a 30-day card for a tracked run can show `"42.00 km · 3:30:00 (5:00 /km)"`. The first composite catalog entry is `cardio.running`; later cardio types (cycling, swimming, …) and tighter per-exercise companion bounds plug into the same path without further infrastructure work.

### Single source of truth: exercises & categories

`@pu-stats/models` owns the **only** list of available exercises and categories — `EXERCISE_CATALOG` and `EXERCISE_CATEGORIES` in `exercise.catalog.ts`, typed by `exercise.models.ts`. Everything that needs to know "which exercises/categories exist" reads from here:

- **Goals** — `ComplexGoalEntry.exerciseId` (`user-config.models.ts`).
- **User entries** — `exerciseEntries` docs carry a catalog `exerciseId`; pushups stay on the legacy `pushups` collection behind the `'pushup'` sentinel until the Phase-7 merge (see `plans/multi-exercise-roadmap.md`).
- **Analysis & statistics** — the client resolves categories via `unifiedEntryCategoryId`; the Cloud Function leaderboard rebuild iterates `EXERCISE_CATALOG` and derives each exercise's value field from `measurementValueField` (`exercise-leaderboard/logic.ts` → `exerciseValueFieldFor`).
- **Training plans** — `TrainingPlanDay.exerciseId` (defaults to `'pushup'`), resolved via `trainingPlanDayExerciseId`.

A few consumers **cannot** import the catalog at runtime, so they keep a shadow copy. Each is pinned to the catalog by a **guard test** rather than a "keep in sync" comment:

| Shadow copy                                             | Why it can't just derive             | Guard                                                    |
| ------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `data-store/firestore.rules` exercise allowlists        | Firestore rules can't import TS      | `data-store/functions/src/exercise-rules-sync.spec.ts`   |
| `exercise-display-names.ts` (`$localize` name registry) | `$localize` needs literal call sites | `exercise-display-names.spec.ts`                         |
| `AUTO_COUNT_QUICK_ADD_EXERCISE_IDS` + web profile maps  | profile unions are type-only in web  | `exercise.catalog.spec.ts` + derivation from the catalog |

The web auto-count/hold-timer mapping derives from each catalog entry's `autoCountProfileId` / `holdTimerProfileId` (opaque profile-id strings the web adapter resolves to its typed unions) — no hardcoded catalog ids in the feature layer.

**When you add or change a catalog exercise:** the guard tests tell you exactly what to touch. Only `firestore.rules` needs a manual edit (the test fails until it matches); the display-name registry needs a new `$localize` entry (its test fails until the key set matches); everything else derives.
