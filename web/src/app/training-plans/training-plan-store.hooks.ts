import { DestroyRef, effect, inject } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { trainingPlanDayExerciseId } from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';
import { isRepsMeasuredPlanDay } from './training-plan-store.selectors';
import {
  acquireWriteLock,
  releaseWriteLock,
  repsLoggedOn,
  type TrainingPlanActionsStore,
} from './training-plan-store.actions';

type HooksStore = TrainingPlanActionsStore & {
  _dayTick: WritableSignal<number>;
};

/**
 * Registers the store's browser-only init side effects. Must be called from a
 * `withHooks.onInit` body so the `inject(DestroyRef)` and `effect()` calls run
 * inside the store's injection context.
 *
 * 1. A coarse one-minute day tick so the Berlin-date-based `currentDayIndex`
 *    rolls over within ~60 s of midnight even without Firestore activity.
 * 2. An auto-mark effect that flips today's `completedDays` flag (no pushup
 *    write) once reps logged elsewhere reach the plan target.
 */
export function registerTrainingPlanHooks(store: HooksStore): void {
  if (!store._isBrowser) return;
  const handle = setInterval(() => store._dayTick.update((n) => n + 1), 60_000);
  inject(DestroyRef).onDestroy(() => clearInterval(handle));

  // Auto-mark today as done when reps logged via Quick-Add / dialog reach the
  // plan target. Read-only — never creates a pushup entry, just flips the
  // `completedDays` flag so users who track in their own way still see plan
  // progress.
  effect(() => {
    const a = store.activePlan();
    const idx = store.currentDayIndex();
    const day = store.todayDay();
    if (!a || !day || idx === null) return;
    // Skip on abandoned/completed plans — the doc still exists, but writes
    // against it are noise (plus they'd drift the status-based banner state).
    if (a.status !== 'active') return;
    if (day.kind === 'rest' || day.targetReps <= 0) return;
    // Matching logPlanDay: only reps-measured days can be honored off the
    // exerciseEntries reps mirror. Auto-mark only flips the done flag (no
    // write), so the resolved-user check isn't needed here.
    if (!isRepsMeasuredPlanDay(day)) return;
    const exerciseId = trainingPlanDayExerciseId(day);
    if (a.completedDays.includes(idx)) return;
    // Same readiness guard as `logPlanDay` — without this, a pre-sync mirror
    // could appear to satisfy the target on stale state and trigger a false
    // auto-mark. Post-cutover pushups live in the `exerciseEntries` feed too,
    // so every exercise gates on `exerciseEntriesLoaded`.
    if (!store._live.exerciseEntriesLoaded()) return;
    // The same in-flight lock guards manual logPlanDay calls, so a fast
    // Quick-Add + auto-mark can't double-write.
    if (store._writingDays().has(idx)) return;
    // Reps come from the `exerciseEntries` mirror (real-time Firestore), so
    // manual logs propagate here without polling.
    const todayIso = toBerlinIsoDate(new Date());
    // Establish a tick dependency so this re-runs at midnight.
    store._dayTick();
    const todayReps = repsLoggedOn(store, todayIso, exerciseId);
    if (todayReps >= day.targetReps) {
      if (!acquireWriteLock(store, idx)) return;
      const userId = store._user.userIdSafe();
      // Use the atomic `arrayUnion` write so a concurrent manual mark for a
      // different day index (e.g. from another tab) doesn't get clobbered.
      // `effect()` is synchronous, so handle errors explicitly — an unhandled
      // rejection here would surface in the browser console without context.
      firstValueFrom(store._api.addCompletedDay(userId, idx))
        .then(() => store.activeResource.reload())
        .catch((error) => {
          console.error('Failed to auto-mark training plan day as completed.', {
            error,
            planId: a.planId,
            dayIndex: idx,
          });
        })
        .finally(() => releaseWriteLock(store, idx));
    }
  });
}
