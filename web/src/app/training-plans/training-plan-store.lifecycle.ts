import { firstValueFrom } from 'rxjs';
import {
  currentPlanDayIndex,
  parkedFrom,
  parsePlanDayItemId,
  planDayByIndex,
  planHasProgress,
  resumedPlanFrom,
  startDateForTargetDay,
} from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';
import { nonRestDaysBeforeTarget } from './training-plan-store.math';
import {
  acquireWriteLock,
  releaseWriteLock,
  type TrainingPlanActionsStore,
} from './training-plan-store.internals';

type Store = TrainingPlanActionsStore;

/** How `start` resolved, so the caller can tell the user what happened. */
export type StartPlanOutcome =
  | 'started' // fresh run of the plan
  | 'resumed' // picked a parked record back up
  | 'noop'; // no user, or an unknown plan id

/** What to do with the progress of the plan being switched away from. */
export interface StartPlanOptions {
  /**
   * True parks the outgoing plan's progress so the user can come back to
   * it. False discards it — and also drops any record parked earlier, so
   * "verwerfen" cannot leave an older snapshot behind to resurrect later.
   */
  keepCurrentProgress: boolean;
  /** Ignore a parked record for the incoming plan and start it over. */
  restart?: boolean;
}

/**
 * Set the outgoing plan's progress aside, or discard it. No-op when
 * there is nothing to keep — a plan the user activated and immediately
 * switched away from leaves no snapshot worth writing.
 */
async function handleOutgoingPlan(
  store: Store,
  userId: string,
  incomingPlanId: string,
  keep: boolean
): Promise<void> {
  const current = store.activePlan();
  if (!current || current.planId === incomingPlanId) return;
  if (!keep) {
    await firstValueFrom(store._api.deleteParkedPlan(userId, current.planId));
    return;
  }
  if (!planHasProgress(current)) return;
  const catalog = store._findPlanById(current.planId);
  const dayIndex =
    (catalog &&
      currentPlanDayIndex(
        catalog,
        current.startDate,
        toBerlinIsoDate(new Date())
      )) ||
    1;
  await firstValueFrom(
    store._api.parkPlan(userId, parkedFrom(current, dayIndex))
  );
}

/**
 * Activate a plan. Replaces the active-plan document, which is why the
 * outgoing plan's progress has to be dealt with first — that write is a
 * wholesale overwrite, not a merge.
 *
 * A plan the user parked earlier resumes where they left off: its
 * progress is restored and `startDate` re-anchored so today is that day
 * again, rather than the plan having silently run on during the break.
 */
export async function start(
  store: Store,
  planId: string,
  options: StartPlanOptions = { keepCurrentProgress: true }
): Promise<StartPlanOutcome> {
  const userId = store._user.userIdSafe();
  if (!userId) return 'noop';
  const plan = store._findPlanById(planId);
  if (!plan) return 'noop';

  await handleOutgoingPlan(store, userId, plan.id, options.keepCurrentProgress);

  const parked = options.restart
    ? null
    : await firstValueFrom(store._api.getParkedPlan(userId, plan.id));
  const today = toBerlinIsoDate(new Date());

  await firstValueFrom(
    store._api.setPlan(
      userId,
      parked
        ? resumedPlanFrom(parked, plan, today)
        : {
            planId: plan.id,
            startDate: today,
            status: 'active',
            completedDays: [],
            skippedDays: [],
            completedItems: [],
            testResults: [],
          }
    )
  );
  // The record is live again; leaving it behind would let a later switch
  // resume a stale snapshot over the progress made since.
  if (parked || options.restart) {
    await firstValueFrom(store._api.deleteParkedPlan(userId, plan.id));
  }
  store.activeResource.reload();
  return parked ? 'resumed' : 'started';
}

/**
 * Undo a day completion, including the per-exercise check-offs that day
 * accumulated — otherwise the day would re-open while every one of its
 * exercises still rendered as done, and the auto-mark effect would
 * immediately close it again.
 */
export async function unmarkDayDone(
  store: Store,
  dayIndex: number
): Promise<void> {
  const a = store.activePlan();
  if (!a) return;
  if (!a.completedDays.includes(dayIndex)) return;
  const userId = store._user.userIdSafe();
  const itemIds = (a.completedItems ?? []).filter(
    (id) => parsePlanDayItemId(id)?.dayIndex === dayIndex
  );
  // Clear the ticks BEFORE the day flag, under the same lock the
  // per-exercise writes take: between the two writes the doc would
  // otherwise show an open day whose exercises are all still ticked —
  // exactly the state the auto-mark effect closes again.
  if (!acquireWriteLock(store, dayIndex)) return;
  try {
    await firstValueFrom(store._api.removeCompletedItems(userId, itemIds));
    await firstValueFrom(store._api.removeCompletedDay(userId, dayIndex));
    store.activeResource.reload();
  } finally {
    releaseWriteLock(store, dayIndex);
  }
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
