import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { UserTrainingPlanApiService } from '@pu-stats/data-access';
import {
  currentPlanDayIndex,
  findPlanById,
  isPlanCompleted,
  planDayByIndex,
  toBerlinIsoDate,
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
    _user: inject(UserContextService),
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

    const today = computed(() => toBerlinIsoDate(new Date()));

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
      const total = c.days.filter((d) => d.kind !== 'rest').length;
      if (total === 0) return 0;
      return Math.round((a.completedDays.length / total) * 100);
    });

    const isCompleted = computed(() => {
      const a = activePlan();
      const c = activeCatalog();
      if (!a || !c) return false;
      return isPlanCompleted(c, a.completedDays);
    });

    const hasActivePlan = computed(
      () => activePlan() !== null && activePlan()?.status === 'active'
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

    /** Mark today's plan day as done. Idempotent. */
    async markTodayDone(): Promise<void> {
      const a = store.activePlan();
      const idx = store.currentDayIndex();
      if (!a || idx === null) return;
      if (a.completedDays.includes(idx)) return;
      const next = [...a.completedDays, idx].sort((x, y) => x - y);
      const userId = store._user.userIdSafe();
      await firstValueFrom(
        store._api.updatePlan(userId, { completedDays: next })
      );
      store.activeResource.reload();
    },

    /** Mark a specific day as done (used from the plan detail page). */
    async markDayDone(dayIndex: number): Promise<void> {
      const a = store.activePlan();
      if (!a) return;
      if (a.completedDays.includes(dayIndex)) return;
      const next = [...a.completedDays, dayIndex].sort((x, y) => x - y);
      const userId = store._user.userIdSafe();
      await firstValueFrom(
        store._api.updatePlan(userId, { completedDays: next })
      );
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
  }))
);
