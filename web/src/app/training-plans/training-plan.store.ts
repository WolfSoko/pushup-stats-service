import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  InjectionToken,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import {
  ExerciseFirestoreService,
  UserTrainingPlanApiService,
} from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  currentPlanDayIndex,
  findPlanById,
  isPlanCompleted,
  planDayByIndex,
  startDateForTargetDay,
  TrainingPlan,
  TrainingPlanDay,
  trainingPlanDayExerciseId,
  TRAINING_PLANS,
  UserTrainingPlan,
} from '@pu-stats/models';
import { appendLocalOffset, toBerlinIsoDate } from '@pu-stats/date';
import { firstValueFrom, of } from 'rxjs';
import {
  addToSet,
  computeCompletionPercent,
  nonRestDaysBeforeTarget,
  planDayDate,
  planDayRepsPayload,
  removeFromSet,
  sumRepsLoggedOn,
} from './training-plan-store.math';
import {
  dayTarget,
  isDayDone,
  isDaySkipped,
  isRepsMeasuredPlanDay,
} from './training-plan-store.selectors';

/**
 * Result of `logPlanDay` / `logTodayPlanDay`. Lets callers tailor
 * UI feedback (snackbar message) to what actually happened: a
 * fresh write, an idempotent skip, or a rejected request.
 */
export type LogPlanDayResult =
  | 'logged' // pushup entry created + day marked done
  | 'already-logged' // day was already covered by existing reps; only marked
  | 'noop' // pre-conditions failed (no plan, rest day, future day, …)
  | 'in-flight' // a concurrent call for the same day is still running
  | 'not-ready'; // LiveDataStore hasn't finished its first sync yet

/**
 * Seam for resolving a curated plan by id so tests can drive a plan the
 * shipped catalog doesn't contain (e.g. a non-pushup day). Defaults to the
 * static `findPlanById`; production never overrides it.
 */
export const TRAINING_PLAN_LOOKUP = new InjectionToken<
  (planId: string) => TrainingPlan | null
>('TRAINING_PLAN_LOOKUP', { providedIn: 'root', factory: () => findPlanById });

/**
 * Active-plan store. Keeps the live `UserTrainingPlan` doc in sync
 * via a Firestore real-time listener and exposes derived state for
 * the dashboard goal pill, the plan detail page and the training
 * plans list.
 *
 * Single active plan per user — starting a new plan replaces the
 * existing doc. (We can move the previous doc into a `history`
 * subcollection later if we want to surface completed plans.)
 */
export const TrainingPlanStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _api: inject(UserTrainingPlanApiService),
    _findPlanById: inject(TRAINING_PLAN_LOOKUP),
    // Resolved lazily (only when a non-pushup day is logged) rather than as a
    // construction-time field. `ExerciseFirestoreService` injects `Firestore`
    // non-optionally, and this root store is pulled by `AppDataFacade` and
    // `QuickAddOrchestrationService` — both also reach the service — so an
    // eager `inject()` here forces every app-level test harness to provide
    // Firestore and trips an NG0200 resolution cycle when two of those
    // consumers request the singleton at once. A lazy `Injector.get` keeps it
    // off the construction stack; the non-pushup write path fails closed when
    // the service can't be resolved.
    _injector: inject(Injector),
    _live: inject(LiveDataStore),
    _user: inject(UserContextService),
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
    /**
     * Coarse daily tick. The Berlin date used by `currentDayIndex`
     * has no signal dependencies of its own, so without this signal
     * a long-running tab stays on the previous calendar day after
     * midnight until something else triggers recomputation. We
     * update once a minute (cheap; covers the midnight crossover
     * within 60 s).
     */
    _dayTick: signal(0),
    /**
     * Day indexes with an in-flight write. Both `logPlanDay` and
     * the auto-mark effect read pre-write state from
     * `LiveDataStore.entries()`/`activePlan()`, so back-to-back
     * invocations could otherwise race and produce duplicate
     * pushup entries or `updatePlan` writes for the same day.
     */
    _writingDays: signal<ReadonlySet<number>>(new Set()),
  })),
  withProps((store) => ({
    activeResource: rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) => {
        if (!params.userId) return of(null);
        return store._api.getActivePlan(params.userId);
      },
    }),
  })),
  withComputed((store) => {
    const activePlan = computed<UserTrainingPlan | null>(
      () => store.activeResource.value() ?? null
    );

    const activeCatalog = computed<TrainingPlan | null>(() => {
      const a = activePlan();
      return a ? store._findPlanById(a.planId) : null;
    });

    const today = computed(() => {
      // Establish a dependency on the day tick so `currentDayIndex`
      // re-evaluates after midnight.
      store._dayTick();
      return toBerlinIsoDate(new Date());
    });

    /** Current 1-based day for today, or null if not started/no plan. */
    const currentDayIndex = computed<number | null>(() => {
      const a = activePlan();
      const c = activeCatalog();
      if (!a || !c) return null;
      return currentPlanDayIndex(c, a.startDate, today());
    });

    /** Today's `TrainingPlanDay` (null when no plan or pre-start). */
    const todayDay = computed<TrainingPlanDay | null>(() => {
      const c = activeCatalog();
      const idx = currentDayIndex();
      if (!c || idx === null) return null;
      return planDayByIndex(c, idx);
    });

    const todayTarget = computed(() => dayTarget(todayDay()));

    const todayDone = computed(() =>
      isDayDone(activePlan(), currentDayIndex())
    );

    const todaySkipped = computed(() =>
      isDaySkipped(activePlan(), currentDayIndex())
    );

    const completionPercent = computed(() => {
      const a = activePlan();
      const c = activeCatalog();
      if (!a || !c) return 0;
      return computeCompletionPercent(c, a.completedDays, a.skippedDays ?? []);
    });

    const isCompleted = computed(() => {
      const a = activePlan();
      const c = activeCatalog();
      if (!a || !c) return false;
      return isPlanCompleted(c, a.completedDays, a.skippedDays ?? []);
    });

    /**
     * Active iff the user doc says so AND we can still resolve the
     * catalog entry. A stale `planId` (e.g. a plan was retired or
     * the doc was hand-edited) should fall back to the user's normal
     * goal rather than rendering an "active plan" with empty
     * title/totalDays in the dashboard banner.
     */
    const hasActivePlan = computed(
      () =>
        activePlan() !== null &&
        activePlan()?.status === 'active' &&
        activeCatalog() !== null
    );

    /**
     * True once the Firestore listener for the active plan has emitted
     * at least one value (or resolved synchronously to `null` for
     * unauthenticated users). Distinguishes "we haven't heard yet" from
     * "we know there's no active plan" — critical for one-shot
     * decisions like the auto-start effect on the detail page, which
     * would otherwise race the resource and overwrite an existing
     * active plan during the initial-emission window.
     */
    const activePlanLoaded = computed(() => {
      const status = store.activeResource.status();
      return status === 'resolved' || status === 'local';
    });

    return {
      activePlan,
      activeCatalog,
      currentDayIndex,
      todayDay,
      todayTarget,
      todayDone,
      todaySkipped,
      completionPercent,
      isCompleted,
      hasActivePlan,
      activePlanLoaded,
    };
  }),
  withMethods((store) => ({
    /**
     * Calendar date (`YYYY-MM-DD`) for a 1-based plan day. Falls
     * back to today's Berlin date if the plan is missing or the
     * start date can't be parsed (defensive — caller already
     * checks).
     */
    _planDayDate(dayIndex: number): string {
      return planDayDate(store.activePlan()?.startDate, dayIndex);
    },

    /** Sum of reps already logged on a given local date for one exercise.
     *  Reads the `exerciseEntries` mirror filtered by id — post-cutover
     *  pushups live there too (`exerciseId:'pushup'`), so no special case. */
    _repsLoggedOn(dateIso: string, exerciseId: string): number {
      return sumRepsLoggedOn(
        store._live.exerciseEntries(),
        dateIso,
        exerciseId
      );
    },

    /** Lazily resolve the Firestore-bound exercise API. Returns null when no
     *  provider is registered (e.g. a test harness without `Firestore`). */
    _resolveExerciseApi(): ExerciseFirestoreService | null {
      return store._injector.get(ExerciseFirestoreService, null);
    },

    /** Acquire an in-flight lock for a day. Returns false if already held. */
    _acquireWriteLock(dayIndex: number): boolean {
      const set = store._writingDays();
      if (set.has(dayIndex)) return false;
      store._writingDays.set(addToSet(set, dayIndex));
      return true;
    },

    _releaseWriteLock(dayIndex: number): void {
      const set = store._writingDays();
      if (!set.has(dayIndex)) return;
      store._writingDays.set(removeFromSet(set, dayIndex));
    },
  })),
  withMethods((store) => ({
    /** All curated plans (re-exposed for component templates). */
    allPlans(): ReadonlyArray<TrainingPlan> {
      return TRAINING_PLANS;
    },

    /**
     * Activate a plan starting today (Berlin date). Overwrites any
     * existing active plan — that is intentional: only one active
     * plan at a time, and the user has confirmed the switch.
     */
    async start(planId: string): Promise<void> {
      const userId = store._user.userIdSafe();
      if (!userId) return;
      const plan = store._findPlanById(planId);
      if (!plan) return;
      await firstValueFrom(
        store._api.setPlan(userId, {
          planId: plan.id,
          startDate: toBerlinIsoDate(new Date()),
          status: 'active',
          completedDays: [],
          skippedDays: [],
        })
      );
      store.activeResource.reload();
    },

    /** Mark today's plan day as done. Idempotent. No-op on rest days. */
    async markTodayDone(): Promise<void> {
      const a = store.activePlan();
      const idx = store.currentDayIndex();
      const day = store.todayDay();
      if (!a || idx === null || !day) return;
      // Rest days are not part of the completion set — silently skip
      // so a generic "mark today done" callback can't skew progress.
      if (day.kind === 'rest') return;
      if (a.completedDays.includes(idx)) return;
      const userId = store._user.userIdSafe();
      // `arrayUnion` so concurrent writes to *different* day indexes
      // (e.g. auto-mark today + manual mark for yesterday in another
      // tab) merge correctly server-side instead of clobbering.
      await firstValueFrom(store._api.addCompletedDay(userId, idx));
      store.activeResource.reload();
    },

    /**
     * Log today's plan-prescribed reps and mark today as done. Thin
     * wrapper around `logPlanDay(currentDayIndex)`.
     */
    async logTodayPlanDay(): Promise<LogPlanDayResult> {
      const idx = store.currentDayIndex();
      if (idx === null) return 'noop';
      return this.logPlanDay(idx);
    },

    /**
     * Mark a specific day as done WITHOUT creating a pushup entry.
     * Use this for "I already logged elsewhere" flows. For the
     * common case (mark done + log the plan-prescribed reps) call
     * `logPlanDay()` instead.
     */
    async markDayDone(dayIndex: number): Promise<void> {
      const a = store.activePlan();
      const c = store.activeCatalog();
      if (!a || !c) return;
      // Reject out-of-range or rest-day indexes — those should never
      // count toward completion progress.
      const day = planDayByIndex(c, dayIndex);
      if (!day || day.kind === 'rest') return;
      if (a.completedDays.includes(dayIndex)) return;
      const userId = store._user.userIdSafe();
      await firstValueFrom(store._api.addCompletedDay(userId, dayIndex));
      store.activeResource.reload();
    },

    /**
     * Log the plan-prescribed reps for a day AND mark the day as
     * done. Idempotent: skips the pushup write if the calendar day
     * is already covered by existing entries.
     *
     * The pushup entry is timestamped at noon (12:00) on the plan
     * day's calendar date so a backfill for an earlier day still
     * lands in the correct daily bucket.
     *
     * Guards (in order):
     * - Plan must be active (status === 'active') and resolvable.
     * - Day must be a non-rest, non-zero-target day in the plan.
     * - Day must not be in the future relative to today.
     * - `LiveDataStore` must have synced at least once, otherwise
     *   `_repsLoggedOn` returns 0 and we'd duplicate-write existing
     *   entries on day-2 reload.
     * - No concurrent call for the same day index (in-flight lock).
     */
    async logPlanDay(dayIndex: number): Promise<LogPlanDayResult> {
      const a = store.activePlan();
      const c = store.activeCatalog();
      if (!a || !c || a.status !== 'active') return 'noop';
      const day = planDayByIndex(c, dayIndex);
      if (!day || day.kind === 'rest' || day.targetReps <= 0) return 'noop';
      // All plan days route through exerciseEntries. Only reps-measured catalog
      // exercises map onto a plan day's targetReps/sets. A time- or distance-
      // measured day can't be honored with a reps payload, and createEntry needs
      // a resolved user plus the lazily-resolved Firestore-backed exercise API —
      // fail closed on any of these.
      if (!isRepsMeasuredPlanDay(day)) return 'noop';
      const exerciseId = trainingPlanDayExerciseId(day);
      const exerciseApi = store._resolveExerciseApi();
      if (!store._user.userIdSafe() || !exerciseApi) return 'noop';

      const currentIdx = store.currentDayIndex();
      if (currentIdx === null || dayIndex > currentIdx) return 'noop';

      // The `exerciseEntries` mirror is empty until its Firestore listener
      // has emitted at least once. Don't make a write decision off pre-sync
      // data — it would top-up a day that's already covered as soon as the
      // listener catches up. Post-cutover pushups live in that same mirror,
      // so every exercise gates on `exerciseEntriesLoaded`.
      if (store._isBrowser && !store._live.exerciseEntriesLoaded())
        return 'not-ready';

      if (!store._acquireWriteLock(dayIndex)) return 'in-flight';

      try {
        const dateIso = store._planDayDate(dayIndex);
        const alreadyLogged = store._repsLoggedOn(dateIso, exerciseId);
        const payload = planDayRepsPayload(day, alreadyLogged);
        let result: LogPlanDayResult;

        if (payload) {
          const timestamp = appendLocalOffset(`${dateIso}T12:00`);
          await firstValueFrom(
            exerciseApi.createEntry(store._user.userIdSafe(), {
              exerciseId,
              timestamp,
              reps: payload.reps,
              sets: payload.sets,
              source: 'plan',
            })
          );
          result = 'logged';
        } else {
          result = 'already-logged';
        }

        if (!a.completedDays.includes(dayIndex)) {
          const userId = store._user.userIdSafe();
          await firstValueFrom(store._api.addCompletedDay(userId, dayIndex));
        }
        store.activeResource.reload();
        return result;
      } finally {
        store._releaseWriteLock(dayIndex);
      }
    },

    /** Undo a day completion. */
    async unmarkDayDone(dayIndex: number): Promise<void> {
      const a = store.activePlan();
      if (!a) return;
      if (!a.completedDays.includes(dayIndex)) return;
      const userId = store._user.userIdSafe();
      await firstValueFrom(store._api.removeCompletedDay(userId, dayIndex));
      store.activeResource.reload();
    },

    /**
     * Mark a plan day as skipped (user chose not to do it). Skipped
     * days are excluded from the completion percent denominator and
     * the `isPlanCompleted` required-set.
     *
     * Idempotent on the skip side. Mutually exclusive with
     * `completedDays`: the API atomically removes the same index from
     * `completedDays` so a day can never be in both arrays.
     *
     * No-op for rest days (already excluded from progress) and for
     * out-of-range indexes.
     */
    async skipDay(dayIndex: number): Promise<void> {
      const a = store.activePlan();
      const c = store.activeCatalog();
      if (!a || !c) return;
      const day = planDayByIndex(c, dayIndex);
      if (!day || day.kind === 'rest') return;
      if ((a.skippedDays ?? []).includes(dayIndex)) return;
      const userId = store._user.userIdSafe();
      await firstValueFrom(store._api.addSkippedDay(userId, dayIndex));
      store.activeResource.reload();
    },

    /** Undo a skip. */
    async unskipDay(dayIndex: number): Promise<void> {
      const a = store.activePlan();
      if (!a) return;
      if (!(a.skippedDays ?? []).includes(dayIndex)) return;
      const userId = store._user.userIdSafe();
      await firstValueFrom(store._api.removeSkippedDay(userId, dayIndex));
      store.activeResource.reload();
    },

    /**
     * Re-anchor the plan so today maps to `targetDayIndex`. Adjusts
     * `startDate` accordingly and bulk-marks all earlier non-rest,
     * non-completed days as skipped so progress reflects "I jumped
     * over these" rather than counting them as still-pending.
     *
     * - `targetDayIndex` must be in `[1, totalDays]` — otherwise
     *   no-op.
     * - Days already in `completedDays` stay completed even if they're
     *   now in the future relative to the new `startDate`.
     * - Days that were previously skipped but are now `>= targetDay`
     *   are removed from `skippedDays` so re-doing them is possible.
     *
     * Delegates to `_api.jumpToDay`, which runs a Firestore
     * transaction. Recomputing `skippedDays` from the local snapshot
     * and writing it via `setDoc({merge:true})` would silently drop
     * concurrent `arrayUnion`/`arrayRemove` skip writes from another
     * tab/device, since `merge: true` does not field-merge arrays.
     */
    async jumpToDay(targetDayIndex: number): Promise<void> {
      const a = store.activePlan();
      const c = store.activeCatalog();
      if (!a || !c || a.status !== 'active') return;
      if (targetDayIndex < 1 || targetDayIndex > c.totalDays) return;

      const today = toBerlinIsoDate(new Date());
      const newStartDate = startDateForTargetDay(
        c.totalDays,
        targetDayIndex,
        today
      );
      if (!newStartDate) return;

      const userId = store._user.userIdSafe();
      await firstValueFrom(
        store._api.jumpToDay(userId, {
          newStartDate,
          targetDayIndex,
          nonRestDaysBeforeTarget: nonRestDaysBeforeTarget(c, targetDayIndex),
        })
      );
      store.activeResource.reload();
    },

    /** Abandon the current plan (status → abandoned). */
    async abandon(): Promise<void> {
      const a = store.activePlan();
      if (!a) return;
      const userId = store._user.userIdSafe();
      await firstValueFrom(
        store._api.updatePlan(userId, { status: 'abandoned' })
      );
      store.activeResource.reload();
    },

    reload(): void {
      store.activeResource.reload();
    },
  })),
  withHooks({
    onInit(store) {
      // Browser-only: tick the day signal once a minute so the
      // Berlin-date-based `currentDayIndex` updates within ~60 s of
      // midnight even if no Firestore activity refreshes the
      // `activePlan` resource.
      if (!store._isBrowser) return;
      const handle = setInterval(
        () => store._dayTick.update((n) => n + 1),
        60_000
      );
      inject(DestroyRef).onDestroy(() => clearInterval(handle));

      // Auto-mark today as done when reps logged via Quick-Add /
      // dialog reach the plan target. Read-only — never creates a
      // pushup entry, just flips the `completedDays` flag so users
      // who track in their own way still see plan progress.
      effect(() => {
        const a = store.activePlan();
        const idx = store.currentDayIndex();
        const day = store.todayDay();
        if (!a || !day || idx === null) return;
        // Skip on abandoned/completed plans — the doc still exists,
        // but writes against it are noise (plus they'd drift the
        // status-based banner state in the UI).
        if (a.status !== 'active') return;
        if (day.kind === 'rest' || day.targetReps <= 0) return;
        // Matching logPlanDay: only reps-measured days can be honored off the
        // exerciseEntries reps mirror. Auto-mark only flips the done flag (no
        // write), so the resolved-user check isn't needed here.
        if (!isRepsMeasuredPlanDay(day)) return;
        const exerciseId = trainingPlanDayExerciseId(day);
        if (a.completedDays.includes(idx)) return;
        // Same readiness guard as `logPlanDay` — without this, a pre-sync
        // mirror could appear to satisfy the target on stale state and
        // trigger a false auto-mark. Post-cutover pushups live in the
        // `exerciseEntries` feed too, so every exercise gates on
        // `exerciseEntriesLoaded`.
        if (!store._live.exerciseEntriesLoaded()) return;
        // The same in-flight lock guards manual logPlanDay calls,
        // so a fast Quick-Add + auto-mark can't double-write.
        if (store._writingDays().has(idx)) return;
        // Reps come from the `exerciseEntries` mirror (real-time Firestore),
        // so manual logs propagate here without polling.
        const todayIso = toBerlinIsoDate(new Date());
        // Establish a tick dependency so this re-runs at midnight.
        store._dayTick();
        const todayReps = store._repsLoggedOn(todayIso, exerciseId);
        if (todayReps >= day.targetReps) {
          if (!store._acquireWriteLock(idx)) return;
          const userId = store._user.userIdSafe();
          // Use the atomic `arrayUnion` write so a concurrent
          // manual mark for a different day index (e.g. from
          // another tab) doesn't get clobbered. `effect()` is
          // synchronous, so handle errors explicitly — an
          // unhandled rejection here would surface in the
          // browser console without context.
          firstValueFrom(store._api.addCompletedDay(userId, idx))
            .then(() => store.activeResource.reload())
            .catch((error) => {
              console.error(
                'Failed to auto-mark training plan day as completed.',
                { error, planId: a.planId, dayIndex: idx }
              );
            })
            .finally(() => store._releaseWriteLock(idx));
        }
      });
    },
  })
);
