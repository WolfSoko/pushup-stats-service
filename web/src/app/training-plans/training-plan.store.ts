import {
  computed,
  DestroyRef,
  effect,
  inject,
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
  LiveDataStore,
  StatsApiService,
  UserTrainingPlanApiService,
} from '@pu-stats/data-access';
import {
  appendLocalOffset,
  currentPlanDayIndex,
  findPlanById,
  isPlanCompleted,
  planDayByIndex,
  toBerlinIsoDate,
  toLocalIsoDate,
  TrainingPlan,
  TrainingPlanDay,
  TRAINING_PLANS,
  UserTrainingPlan,
} from '@pu-stats/models';
import { firstValueFrom, of } from 'rxjs';

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
    _statsApi: inject(StatsApiService),
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
      return a ? findPlanById(a.planId) : null;
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

    const todayTarget = computed(() => todayDay()?.targetReps ?? 0);

    const todayDone = computed(() => {
      const idx = currentDayIndex();
      const a = activePlan();
      if (!a || idx === null) return false;
      return a.completedDays.includes(idx);
    });

    const completionPercent = computed(() => {
      const a = activePlan();
      const c = activeCatalog();
      if (!a || !c) return 0;
      const nonRestDayIndexes = new Set(
        c.days.filter((d) => d.kind !== 'rest').map((d) => d.dayIndex)
      );
      if (nonRestDayIndexes.size === 0) return 0;
      // Filter `completedDays` to only count non-rest days. Rest-day
      // entries can otherwise leak progress > 100% (e.g. via direct
      // API writes or future UI changes that mark rest days done).
      const completedNonRest = a.completedDays.filter((idx) =>
        nonRestDayIndexes.has(idx)
      ).length;
      return Math.min(
        100,
        Math.round((completedNonRest / nonRestDayIndexes.size) * 100)
      );
    });

    const isCompleted = computed(() => {
      const a = activePlan();
      const c = activeCatalog();
      if (!a || !c) return false;
      return isPlanCompleted(c, a.completedDays);
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

    return {
      activePlan,
      activeCatalog,
      currentDayIndex,
      todayDay,
      todayTarget,
      todayDone,
      completionPercent,
      isCompleted,
      hasActivePlan,
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
      const a = store.activePlan();
      if (!a) return toBerlinIsoDate(new Date());
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a.startDate);
      if (!m) return toBerlinIsoDate(new Date());
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      const start = new Date(year, month - 1, day);
      // Round-trip: `new Date(2026, 1, 30)` silently overflows to
      // March 2 instead of failing on Feb-30. Reject impossible
      // dates so a corrupt `startDate` can't shift logging into
      // the wrong calendar day.
      if (
        start.getFullYear() !== year ||
        start.getMonth() !== month - 1 ||
        start.getDate() !== day
      ) {
        return toBerlinIsoDate(new Date());
      }
      start.setHours(0, 0, 0, 0);
      const target = new Date(start);
      target.setDate(start.getDate() + (dayIndex - 1));
      return toLocalIsoDate(target);
    },

    /** Sum of reps already logged on a given local date. */
    _repsLoggedOn(dateIso: string): number {
      return store
        ._live.entries()
        .filter((e) => e.timestamp.slice(0, 10) === dateIso)
        .reduce((sum, e) => sum + e.reps, 0);
    },

    /** Acquire an in-flight lock for a day. Returns false if already held. */
    _acquireWriteLock(dayIndex: number): boolean {
      const set = store._writingDays();
      if (set.has(dayIndex)) return false;
      const next = new Set(set);
      next.add(dayIndex);
      store._writingDays.set(next);
      return true;
    },

    _releaseWriteLock(dayIndex: number): void {
      const set = store._writingDays();
      if (!set.has(dayIndex)) return;
      const next = new Set(set);
      next.delete(dayIndex);
      store._writingDays.set(next);
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
      const plan = findPlanById(planId);
      if (!plan) return;
      await firstValueFrom(
        store._api.setPlan(userId, {
          planId: plan.id,
          startDate: toBerlinIsoDate(new Date()),
          status: 'active',
          completedDays: [],
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

      const currentIdx = store.currentDayIndex();
      if (currentIdx === null || dayIndex > currentIdx) return 'noop';

      // `_live.entries()` is empty until the Firestore listener has
      // emitted at least once. Don't make a write decision off
      // pre-sync data — it would top-up a day that's already
      // covered as soon as the listener catches up.
      if (store._isBrowser && !store._live.connected()) return 'not-ready';

      if (!store._acquireWriteLock(dayIndex)) return 'in-flight';

      try {
        const dateIso = store._planDayDate(dayIndex);
        const alreadyLogged = store._repsLoggedOn(dateIso);
        let result: LogPlanDayResult;

        if (alreadyLogged < day.targetReps) {
          const remaining = day.targetReps - alreadyLogged;
          // If the user has logged nothing yet, persist the full
          // prescribed sets so the breakdown is preserved. If they
          // logged some reps already, just top up the remainder as
          // a single set — we don't try to second-guess their split.
          const sets =
            alreadyLogged === 0 ? day.sets ?? [day.targetReps] : [remaining];
          const reps = alreadyLogged === 0 ? day.targetReps : remaining;
          await firstValueFrom(
            store._statsApi.createPushup({
              timestamp: appendLocalOffset(`${dateIso}T12:00`),
              reps,
              sets,
              source: 'plan',
              type: 'Standard',
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
        if (a.completedDays.includes(idx)) return;
        // Same readiness guard as `logPlanDay` — without this, a
        // pre-sync `_live.entries()` could appear to satisfy the
        // target on stale state and trigger a false auto-mark.
        if (!store._live.connected()) return;
        // The same in-flight lock guards manual logPlanDay calls,
        // so a fast Quick-Add + auto-mark can't double-write.
        if (store._writingDays().has(idx)) return;
        // `_live.entries()` is the same source the dashboard uses;
        // it streams from Firestore in real time so manual logs
        // propagate here without polling.
        const todayIso = toBerlinIsoDate(new Date());
        // Establish a tick dependency so this re-runs at midnight.
        store._dayTick();
        const todayReps = store._repsLoggedOn(todayIso);
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
