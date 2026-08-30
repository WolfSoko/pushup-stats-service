# Architecture

Detailed architecture reference for the Pushup Stats Service. CLAUDE.md keeps the high-level rules; this doc holds the patterns, dependency graph, and domain-model layout.

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

- `TrainingEntryDialogComponent` serves as the single dialog for both creating and editing entries of every exercise.
- **Exercise-first:** one autocomplete (`ExercisePickerComponent`) over the whole catalog is the entry point; the category and the rendered field set (pushup mode vs. exercise mode) are derived from the picked exercise, never chosen by hand. Options are grouped "Heute geplant" → "Zuletzt genutzt" → categories; typing filters on exercise **and** category name, diacritic-insensitive (`exercise-picker.groups.ts`).
- **Create mode:** `MAT_DIALOG_DATA` is absent or carries `{kind: 'create', suggestions}`. `ExerciseSuggestions` (today's plan-day + daily-goal exercises, recently logged exercises) rank the picker and decide which exercise the dialog opens on — the dialog itself knows nothing about plans, goals or history, the opener passes them in (`stats-dashboard.suggestions.ts`).
- **Edit mode:** Opened with a `pushup`/`exercise` payload via `MAT_DIALOG_DATA` — pre-fills timestamp, sets, type, source from the existing entry and locks the picker (moving an entry between collections is not supported). Preserves the original timestamp format when unchanged.
- Both modes return `TrainingEntryDialogResult` on submit. The stats table's `openEditDialog()` maps the result back to an update emission.
- **Sets UX:** Starts with a single "Reps" field. A "+" button adds sets (pre-filled from previous value). Multi-set mode shows "Set 1", "Set 2", etc. with remove buttons and a total display.

### Training Plans (curated catalog + active-plan state)

- **Catalog** (`libs/stats/src/lib/models/training-plan.catalog.ts`): static, versioned plan definitions with per-day `kind` (`main`/`light`/`rest`/`test`), `targetReps`, optional `sets[]`, and bilingual descriptions (`description` / `descriptionEn`). Plan IDs carry a `-vN` suffix so old `UserTrainingPlan` docs keep resolving when targets change.
- **Per-user state** (`userTrainingPlans/{userId}` in Firestore): `planId`, `startDate`, `status`, `completedDays[]`. Single active plan per user; starting another overwrites the doc.
- **Locale-aware rendering:** `localizePlan(plan, LOCALE_ID)` swaps title/summary/description fields. The catalog stores both languages because plans are structured curated data — putting them in XLIFF would lose the per-day pairing.
- **Per-exercise days:** a day either lists every exercise it prescribes in `TrainingPlanDay.exercises` (`{exerciseId, target, sets?, variantId?}`, `target` in the exercise's own unit — reps, seconds, meters) or is a single-exercise day whose item is derived from `exerciseId`/`targetReps`/`sets`. Consumers always read `planDayExercises(day)` so both shapes behave identically; `targetReps` stays the pushup portion (a guard test pins it to the pushup item) because the dashboard goal pill reads it.
- **Completion modes:** `completion: 'metrics'` (default) days are fulfilled by logged entries; `completion: 'checkoff'` days (HIIT/EMOM/Tabata) are ticked off by hand, because the real volume depends on rounds survived. Check-off days may carry unquantified items (`target: 0`); metric days may not — a zero target can never auto-fulfill.
- **Single source of truth = the entry collections:** the `completedDays` flag is a UI shortcut. `logPlanDay(idx)` writes a real `exerciseEntries` entry per open exercise (with `source: 'plan'`, the prescribed breakdown, noon timestamp on the plan day's calendar date) AND flips the flag; `logPlanExercise(idx, item)` does the same for one exercise. Without the entries, stats/streaks/leaderboard wouldn't reflect the workout.
- **Manual per-exercise ticks** live in `UserTrainingPlan.completedItems` as flat `"<dayIndex>:<itemIndex>"` ids written via `arrayUnion`/`arrayRemove` (a nested map would be clobbered by concurrent merge writes). Fulfillment is `checkedOff || covered by entries`; un-ticking an exercise re-opens the day.
- **Duplicate exercises in a day** (Plank + Side Plank both resolve to `plank.standard`) draw from one logged-total pool in list order, so 60 s of plank can't satisfy both a 150 s and a 180 s item.
- **Auto-mark via `effect()` in `withHooks`:** when `LiveDataStore.exerciseEntries()` push today's totals past every prescribed target, today's flag flips automatically — read-only, never creates a new entry. Lets the existing Quick-Add/dialog/hold-timer flows propagate plan progress without an explicit button click.
- **Day-tick signal:** Berlin-date-based `currentDayIndex()` has no inherent signal dependency, so a long-running browser tab caches the previous calendar day past midnight. The store ticks an internal `_dayTick` signal once a minute (browser-only) so derived day state recomputes within ~60 s of midnight.

### Guided training session (`/training-plans/:slug/session`)

Walks today's plan day — "50 s Plank → 20 Russian Twists → 15 Liegestütze" — and hands each step to the capture tool its measurement calls for. Lives in `web/src/app/training-plans/session/`.

- **Two orderings, picked on the start screen.** `'circuit'` ("Zirkeltraining") walks one set of every exercise, then round two — the default, and the left toggle; `'sequential'` finishes one exercise before the next. The choice persists to `UserConfig.ui.sessionMode` and is a **re-ordering only** — same prescription, same entries, same fulfillment. See "Circuit mode" below.
- **The session starts from three places.** The dashboard's plan banner, the plan page's today card and today's row in the week list all link `/training-plans/:slug/session` under the same condition: the plan is active, today isn't a rest day or already ticked off/skipped, and something on it is still open. The plan page reads that from the `DayRow` (`offersSession`); the dashboard has no row, so it checks `todayDone`/`todaySkipped` explicitly — `planDayProgress` alone doesn't know about day-level completion.
- **Today appears twice on the plan page, on purpose.** `PlanTodayCardComponent` repeats today above the week list so its prescription and session entry need no scrolling, while the week list stays complete so the plan reads as a whole. Both render `app-plan-day-exercises` off the same row, so a tick in one updates the other.
- **Steps are derived, never stored.** `buildSessionSteps(planDayProgress(...))` (`training-session.models.ts` in `@pu-stats/models`) turns the day's per-exercise fulfillment into the step list; `buildCircuitSteps(...)` (`training-session-circuit.models.ts`) does the same round by round. There is no session document: closing a step is an ordinary `exerciseEntries` write (or a plan tick), so leaving the page mid-workout and coming back resumes wherever the logged entries put the user, and stats/streaks/leaderboard see the workout like any other.
- **Tool routing is catalog-driven.** `sessionToolFor(exercise)` reads `measurement` first, then `holdTimerProfileId` / `autoCountProfileId` — `time` + hold profile ⇒ hold timer, `reps` + detector profile ⇒ camera counter, everything else ⇒ the prefilled `TrainingEntryDialogComponent`. Adding a profile to a catalog entry is all it takes for a session step to gain that tool.
- **`SessionDialogsService`** opens the three dialogs (each dynamic-imported, so MediaPipe stays out of the session chunk). It is a service, not module-level functions, because the Angular unit-test system rejects `vi.mock` on relative imports — tests substitute it through DI.
- **Captures are written as measured, not as prescribed.** A capture that falls short of the target is still saved and leaves the step open at its real progress. Only `logPlanExercise` ("Wie vorgegeben") writes the prescription verbatim. All session entries carry `source: 'plan-session'`.
- **Tool exercise switches are honoured.** The camera and timer dialogs let the user change exercise mid-flow; such an entry is saved for what it actually is and credits the current step nothing (`stepValueFromDialogResult`), so a squat logged during a pushup step doesn't close it.
- **The ordering is pinned when the session starts.** `begin()`/`goToStep()` write the effective mode into `modeOverride`. A config doc that resolves mid-workout would otherwise flip `mode()` and re-order `steps()` under a `stepIndex` that means something different per mode.
- **Rest** defaults to 60 s, is set on the session's start screen, and persists to `UserConfig.ui.sessionRestSec` (read-modify-write of the whole `ui` map — see [`gotchas/firestore.md`](gotchas/firestore.md)). `0` disables the pause. The countdown interval starts and stops with the `rest` phase rather than running for the whole session.

#### Circuit mode

- **Rounds come from the prescription.** The circuit walks `max(exercise.sets.length)` rounds, at least one. A day whose exercises prescribe no sets has nothing to circle and collapses to a single round — which is sequential, and the start screen says so.
- **Each round carries the running total it closes at.** `SessionStep.target` is the total through that round and `roundTarget` is the round's own portion; `step.exercise` is the plan item retargeted to that total, with `sets` dropped so the entry payload is always "this much, as one set". Round 2 of 3×10 is done exactly when 20 reps sit on the day. `target` is capped at `logged + roundTarget`, so skipping a round never leaves the next one demanding both.
- **Duplicated exercises are re-pooled in circuit order.** `planDayProgress` draws one logged pool per exercise down in _item_ order, but a circuit visits items in _round_ order — so reading a step's coverage off its own item would show `core-4w-v1`'s Side Plank at zero until the Plank item above it is fully covered, and the session would re-offer the round the user just finished. `buildCircuitSteps` rebuilds the pool per exercise (hand-ticked items credited in full and excluded, exactly as in `planDayProgress`) and spends it in circuit order. The day still closes at the same point: pool ≥ Σ targets either way.
- **Progress is shown per round, not cumulatively.** `buildSessionRows` derives `logged`/`percent` from `logged - (target - roundTarget)`, so a card asking for 10 doesn't read "10 / 20" underneath. Identical to the raw values in sequential mode, where `target === roundTarget`.
- **An exercise the plan quantifies only as a total** is split evenly across the rounds (remainder to the earlier ones, so the sum stays the target). Doing all of it in round one would defeat the circuit. Unquantified items (HIIT blocks) appear once and are ticked off.
- **"Wie vorgegeben" splits by round.** Only the round that closes a plan item goes through `logPlanExercise` (write remainder + tick + close the day); earlier rounds write just their portion via `SessionCaptureService.logPrescribed`, because ticking the item off would swallow the rounds still to come. "Abhaken" is per-item by design and does close an exercise's remaining rounds.

### Analysis page: per-exercise breakdown & visibility

The analysis charts draw one bar **per exercise**, not one summed bar per group. Two pieces of `AnalysisStore` state drive it, both page-wide so the overview and the category tabs never disagree:

- **`barMode`** (`'stacked' | 'grouped'`) — whether an exercise's bars share a bucket or sit side by side. Stacking answers "how much in total, and of what"; grouping answers "which exercise moved".
- **`hiddenExerciseIds`** — the exercises unchecked in `ExerciseBreakdownControlsComponent`. It is **not** a chart-only filter: `visibleRows` applies it before `viewFilteredRows`, `categorySummaries` and the trend-window rows, so best values, streaks, type shares, trends and the heatmap all follow the checkboxes.

The controls sit **with each chart**, not once per tab: a category tab renders one `AnalysisSegmentViewComponent` per measurement, and each offers only its own `exerciseOptionIds` — counted and timed exercises never share a chart, so a "Plank" checkbox above the repetitions chart would control something that chart cannot draw. The scope of the _offer_ is the chart; the scope of the _effect_ stays page-wide. The overview's comparison chart compares whole categories across measurements, so its controls keep the full range list. `exerciseOptionIds` is built from `optionRows` — the view's rows **before** the visibility filter — grouped by the same `groupRowsByMeasurement` pass the segments use, so unchecking an exercise never removes the checkbox that undoes it.

Two invariants are easy to break:

- **`unifiedRows` stays unfiltered.** The empty-state CTA, `exerciseOptions` and the overview's `hasCategorisableRows` gate all read it, so hiding every exercise renders an empty range — not "you have no data yet", and not the uncategorised-entries fallback — and a hidden exercise keeps its own checkbox. `ExerciseBreakdownControlsComponent` stays mounted while anything is hidden for the same reason: `hiddenExerciseIds` survives tab and range changes, so the reset must never go out of reach.
- **Colours come from position, not from the id.** `exerciseColor(id, order)` indexes `EXERCISE_PALETTE` using `exerciseOptions()` — derived from the unfiltered range — so an exercise keeps its colour across the trend chart, the overview comparison and the checkbox swatches, and hiding one doesn't recolour the rest. The palette opens with the type-pie's eight colours and adds eight more: a stacked segment carries no label, so two segments in one colour are indistinguishable, where the pie can fall back to a "rest" slice. The pie still ranks colours within its own slice list, so pie and bars can disagree on a tab where those ranks differ.
- **`exerciseOptions` ranks by training count, not volume.** A range mixes measurements; 5000 m outranking 500 reps would be an artefact of the unit. Ties fall back to the id so the order — and every colour with it — is stable across renders.

`buildExerciseSeries` aligns each exercise against the buckets of the aggregate series it was handed rather than re-deriving them, which is what keeps a sparsely-logged exercise on the same x positions as the day-integral and moving-average lines. Per-exercise bars replace the aggregate bar and its sets stacking — both decompose the same volume, so drawing them together would double every bucket. Below two exercises the split, the controls and the comparison-chart legend all stay hidden: a lone exercise has no parts to lay out.

## Domain Models

Split into focused files under `libs/stats/src/lib/models/`:

- `pushup.models.ts` - PushupRecord, PushupCreate, PushupUpdate
  - **Sets:** `sets?: number[]` stores per-set reps (e.g. `[10, 10, 10]`). `reps` is always the total sum. `sets` is optional for backward compatibility — old entries without sets work unchanged. All aggregation (UserStats, deltas, charts) uses `reps` only.
- `stats.models.ts` - StatsResponse, StatsMeta, StatsFilter
- `user-config.models.ts` - UserConfig, UserConfigUpdate
- `reminder-config.models.ts` - ReminderConfig
- `user-stats.models.ts` - UserStats (server-side precomputed), emptyUserStats, USERSTATS_VERSION
- `training-plan.models.ts` - TrainingPlan, TrainingPlanDay, TrainingPlanExercise, UserTrainingPlan, `planDayByIndex()`, `isPlanCompleted()`
- `training-plan-schedule.models.ts` - `currentPlanDayIndex()`, `startDateForTargetDay()`. `parseIsoDate` round-trips Y/M/D after `new Date()` to reject impossible dates like `2026-02-30`.
- `training-plan-exercise.models.ts` - `planDayExercises()`, `planDayProgress()`, `isPlanDayFulfilled()`, `planExerciseEntryPayload()`, `planDayItemId()` — the per-exercise fulfillment layer shared by the store, the auto-mark effect and the detail UI.
- `training-session.models.ts` - `buildSessionSteps()`, `sessionToolFor()`, `firstOpenStepIndex()`, `normalizeRestSec()`, `normalizeSessionMode()`, `stepCoveredBy()` — the guided-session layer over `planDayProgress()`.
- `training-session-circuit.models.ts` - `buildCircuitSteps()`, `circuitRoundCount()`, `circuitPortions()` — the same day re-ordered as a circuit.
- `training-plan.catalog.ts` - curated `TRAINING_PLANS` array + `findPlanById()` / `findPlanBySlug()` lookups. Test invariants: every plan's day indexes form a contiguous `1..totalDays` sequence, rest days have `targetReps === 0`, and every structured exercise item names a real catalog exercise/variant, stays inside its bounds, and sums its sets to its target.
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

| Shadow copy                                             | Why it can't just derive             | Guard                                                             |
| ------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `data-store/firestore.rules` exercise allowlists        | Firestore rules can't import TS      | `data-store/functions/src/exercise-rules-codegen.spec.ts` (drift) |
| `exercise-display-names.ts` (`$localize` name registry) | `$localize` needs literal call sites | `exercise-display-names.spec.ts`                                  |
| `AUTO_COUNT_QUICK_ADD_EXERCISE_IDS` + web profile maps  | profile unions are type-only in web  | `exercise.catalog.spec.ts` + derivation from the catalog          |

The web auto-count/hold-timer mapping derives from each catalog entry's `autoCountProfileId` / `holdTimerProfileId` (opaque profile-id strings the web adapter resolves to its typed unions) — no hardcoded catalog ids in the feature layer.

**`PUSHUP_DEFINITION`** is a first-class `ExerciseDefinition` that makes `'pushup'` resolvable via `findExerciseDefinition`, and post-cutover it is also a member of the iterable `EXERCISE_CATALOG` array, so catalog-iterating paths (leaderboard rebuild, goals, analysis) treat Liegestütze like any other reps exercise.

**Variants.** An entry's `variantId` is validated against its definition's `variants` list — an unlisted value fails with the `'invalid-variant'` violation, both client-side (`ExerciseFirestoreService`) and in the `adminUpdateUserEntry` callable. Pushups are the exception: their "Typ" is a free-text autocomplete over `PUSHUP_TYPES` plus whatever the user types, so `PUSHUP_DEFINITION` sets `allowsCustomVariants: true` and skips the allowlist check. The pushup dialog names the field `type` while every other exercise emits `variantId`; both persist to `ExerciseEntry.variantId` (normalized in `web/src/app/stats/entries.variant.ts`).

**When you add or change a catalog exercise:** the guard tests tell you exactly what to touch. The `firestore.rules` allowlists are **generated** from the catalog — run `pnpm nx run cloud-functions:generate-exercise-rules` after changing the catalog (the drift-guard test fails CI until the generated output matches). The display-name registry needs a new `$localize` entry (its test fails until the key set matches); everything else derives.
