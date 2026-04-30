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
      const [, y, mo, d] = m;
      const start = new Date(Number(y), Number(mo) - 1, Number(d));
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
      const next = [...a.completedDays, idx].sort((x, y) => x - y);
      const userId = store._user.userIdSafe();
      await firstValueFrom(
        store._api.updatePlan(userId, { completedDays: next })
      );
      store.activeResource.reload();
    },

    /**
     * Log today's plan-prescribed reps and mark today as done. Thin
     * wrapper around `logPlanDay(currentDayIndex)`.
     */
    async logTodayPlanDay(): Promise<void> {
      const idx = store.currentDayIndex();
      if (idx === null) return;
      await this.logPlanDay(idx);
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
      const next = [...a.completedDays, dayIndex].sort((x, y) => x - y);
      const userId = store._user.userIdSafe();
      await firstValueFrom(
        store._api.updatePlan(userId, { completedDays: next })
      );
      store.activeResource.reload();
    },

    /**
     * Log the plan-prescribed reps for a day AND mark the day as
     * done. Skips the pushup write if the user has already logged
     * enough reps for that calendar day (so the auto-mark effect
     * and a manual button click both stay idempotent).
     *
     * The pushup entry is timestamped at noon (12:00) on the plan
     * day's calendar date so a backfill for an earlier day still
     * lands in the correct daily bucket.
     */
    async logPlanDay(dayIndex: number): Promise<void> {
      const a = store.activePlan();
      const c = store.activeCatalog();
      if (!a || !c) return;
      const day = planDayByIndex(c, dayIndex);
      if (!day || day.kind === 'rest' || day.targetReps <= 0) return;

      const dateIso = store._planDayDate(dayIndex);
      const alreadyLogged = store._repsLoggedOn(dateIso);

      if (alreadyLogged < day.targetReps) {
        const remaining = day.targetReps - alreadyLogged;
        // If the user has logged nothing yet, persist the full
        // prescribed sets so the breakdown is preserved. If they
        // logged some reps already, just top up the remainder as a
        // single set — we don't try to second-guess their split.
        const sets = alreadyLogged === 0
          ? day.sets ?? [day.targetReps]
          : [remaining];
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
      }

      if (!a.completedDays.includes(dayIndex)) {
        const next = [...a.completedDays, dayIndex].sort((x, y) => x - y);
        const userId = store._user.userIdSafe();
        await firstValueFrom(
          store._api.updatePlan(userId, { completedDays: next })
        );
      }
      store.activeResource.reload();
    },

    /** Undo a day completion. */
    async unmarkDayDone(dayIndex: number): Promise<void> {
      const a = store.activePlan();
      if (!a) return;
      if (!a.completedDays.includes(dayIndex)) return;
      const next = a.completedDays.filter((d) => d !== dayIndex);
      const userId = store._user.userIdSafe();
      await firstValueFrom(
        store._api.updatePlan(userId, { completedDays: next })
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
        if (day.kind === 'rest' || day.targetReps <= 0) return;
        if (a.completedDays.includes(idx)) return;
        // `_live.entries()` is the same source the dashboard uses;
        // it streams from Firestore in real time so manual logs
        // propagate here without polling.
        const todayIso = toBerlinIsoDate(new Date());
        // Establish a tick dependency so this re-runs at midnight.
        store._dayTick();
        const todayReps = store._repsLoggedOn(todayIso);
        if (todayReps >= day.targetReps) {
          // Fire-and-forget: the resulting `activePlan` reload will
          // re-trigger this effect, which then short-circuits via
          // the `completedDays.includes(idx)` guard above.
          const next = [...a.completedDays, idx].sort((x, y) => x - y);
          const userId = store._user.userIdSafe();
          firstValueFrom(
            store._api.updatePlan(userId, { completedDays: next })
          ).then(() => store.activeResource.reload());
        }
      });
    },
  })
);
