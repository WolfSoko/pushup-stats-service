import { firstValueFrom } from 'rxjs';
import { planDayByIndex, startDateForTargetDay } from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';
import { nonRestDaysBeforeTarget } from './training-plan-store.math';
import type { TrainingPlanActionsStore } from './training-plan-store.actions';

type Store = TrainingPlanActionsStore;

/**
 * Activate a plan starting today (Berlin date). Overwrites any
 * existing active plan — that is intentional: only one active
 * plan at a time, and the user has confirmed the switch.
 */
export async function start(store: Store, planId: string): Promise<void> {
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
}

/** Undo a day completion. */
export async function unmarkDayDone(
  store: Store,
  dayIndex: number
): Promise<void> {
  const a = store.activePlan();
  if (!a) return;
  if (!a.completedDays.includes(dayIndex)) return;
  const userId = store._user.userIdSafe();
  await firstValueFrom(store._api.removeCompletedDay(userId, dayIndex));
  store.activeResource.reload();
}

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
export async function skipDay(store: Store, dayIndex: number): Promise<void> {
  const a = store.activePlan();
  const c = store.activeCatalog();
  if (!a || !c) return;
  const day = planDayByIndex(c, dayIndex);
  if (!day || day.kind === 'rest') return;
  if ((a.skippedDays ?? []).includes(dayIndex)) return;
  const userId = store._user.userIdSafe();
  await firstValueFrom(store._api.addSkippedDay(userId, dayIndex));
  store.activeResource.reload();
}

/** Undo a skip. */
export async function unskipDay(store: Store, dayIndex: number): Promise<void> {
  const a = store.activePlan();
  if (!a) return;
  if (!(a.skippedDays ?? []).includes(dayIndex)) return;
  const userId = store._user.userIdSafe();
  await firstValueFrom(store._api.removeSkippedDay(userId, dayIndex));
  store.activeResource.reload();
}

/**
 * Re-anchor the plan so today maps to `targetDayIndex`. Adjusts
 * `startDate` accordingly and bulk-marks all earlier non-rest,
 * non-completed days as skipped so progress reflects "I jumped
 * over these" rather than counting them as still-pending.
 *
 * - `targetDayIndex` must be in `[1, totalDays]` — otherwise no-op.
 * - Days already in `completedDays` stay completed even if they're
 *   now in the future relative to the new `startDate`.
 * - Days that were previously skipped but are now `>= targetDay`
 *   are removed from `skippedDays` so re-doing them is possible.
 *
 * Delegates to `_api.jumpToDay`, which runs a Firestore transaction.
 * Recomputing `skippedDays` from the local snapshot and writing it via
 * `setDoc({merge:true})` would silently drop concurrent
 * `arrayUnion`/`arrayRemove` skip writes from another tab/device, since
 * `merge: true` does not field-merge arrays.
 */
export async function jumpToDay(
  store: Store,
  targetDayIndex: number
): Promise<void> {
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
}

/** Abandon the current plan (status → abandoned). */
export async function abandon(store: Store): Promise<void> {
  const a = store.activePlan();
  if (!a) return;
  const userId = store._user.userIdSafe();
  await firstValueFrom(store._api.updatePlan(userId, { status: 'abandoned' }));
  store.activeResource.reload();
}
