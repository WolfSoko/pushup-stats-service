import {
  computed,
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
import { UserTrainingPlanApiService } from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  currentPlanDayIndex,
  findPlanById,
  isPlanCompleted,
  planDayByIndex,
  TrainingPlan,
  TrainingPlanDay,
  UserTrainingPlan,
} from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';
import { of } from 'rxjs';
import { computeCompletionPercent } from './training-plan-store.math';
import {
  dayTarget,
  isDayDone,
  isDaySkipped,
} from './training-plan-store.selectors';
import * as actions from './training-plan-store.actions';
import * as lifecycle from './training-plan-store.lifecycle';
import { registerTrainingPlanHooks } from './training-plan-store.hooks';

export type { LogPlanDayResult } from './training-plan-store.actions';

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
    /** All curated plans (re-exposed for component templates). */
    allPlans: () => actions.allPlans(),
    start: (planId: string) => lifecycle.start(store, planId),
    markTodayDone: () => actions.markTodayDone(store),
    logTodayPlanDay: () => actions.logTodayPlanDay(store),
    markDayDone: (dayIndex: number) => actions.markDayDone(store, dayIndex),
    logPlanDay: (dayIndex: number) => actions.logPlanDay(store, dayIndex),
    unmarkDayDone: (dayIndex: number) =>
      lifecycle.unmarkDayDone(store, dayIndex),
    skipDay: (dayIndex: number) => lifecycle.skipDay(store, dayIndex),
    unskipDay: (dayIndex: number) => lifecycle.unskipDay(store, dayIndex),
    jumpToDay: (targetDayIndex: number) =>
      lifecycle.jumpToDay(store, targetDayIndex),
    abandon: () => lifecycle.abandon(store),
    reload: () => store.activeResource.reload(),
  })),
  withHooks({
    onInit: (store) => registerTrainingPlanHooks(store),
  })
);
