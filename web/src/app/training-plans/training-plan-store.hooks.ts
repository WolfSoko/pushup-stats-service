import { DestroyRef, effect, inject, untracked } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isPlanDayFulfilled } from '@pu-stats/models';
import {
  acquireWriteLock,
  dayProgress,
  releaseWriteLock,
  type TrainingPlanActionsStore,
} from './training-plan-store.internals';

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
 * 2. An auto-mark effect that flips today's `completedDays` flag (no entry
 *    write) once every exercise the day prescribes is fulfilled.
 */
export function registerTrainingPlanHooks(store: HooksStore): void {
  if (!store._isBrowser) return;
  const handle = setInterval(() => store._dayTick.update((n) => n + 1), 60_000);
  inject(DestroyRef).onDestroy(() => clearInterval(handle));

  // Auto-mark today as done once every prescribed exercise is covered —
  // by reps/holds logged through Quick-Add, the entry dialog or the hold
  // timer, or by a manual per-exercise tick. Read-only: it never creates an
  // entry, it just flips the `completedDays` flag so users who track in
  // their own way still see plan progress.
  effect(() => {
    const a = store.activePlan();
    const idx = store.currentDayIndex();
    const day = store.todayDay();
    if (!a || !day || idx === null) return;
    // Skip on abandoned/completed plans — the doc still exists, but writes
    // against it are noise (plus they'd drift the status-based banner state).
    if (a.status !== 'active') return;
    if (day.kind === 'rest') return;
    if (a.completedDays.includes(idx)) return;
    // Same readiness guard as `logPlanDay` — without this, a pre-sync mirror
    // could appear to satisfy the targets on stale state and trigger a false
    // auto-mark. Post-cutover pushups live in the `exerciseEntries` feed too,
    // so every exercise gates on `exerciseEntriesLoaded`.
    if (!store._live.exerciseEntriesLoaded()) return;
    // The same in-flight lock guards manual log calls, so a fast
    // Quick-Add + auto-mark can't double-write. Read and take the lock
    // untracked: this effect writes that signal through
    // acquire/releaseWriteLock, and a tracked read would make the
    // release re-run the effect — on a permanently failing write (say a
    // Firestore permission error) that is an unbounded write-and-log
    // loop, since nothing else about the state changes.
    if (untracked(() => store._writingDays()).has(idx)) return;
    // Establish a tick dependency so this re-runs at midnight.
    store._dayTick();
    if (!isPlanDayFulfilled(dayProgress(store, idx))) return;
    if (!untracked(() => acquireWriteLock(store, idx))) return;
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
  });
}
