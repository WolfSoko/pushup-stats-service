import { firstValueFrom } from 'rxjs';
import {
  isPlanDayFulfilled,
  planDayByIndex,
  planDayItemId,
  planExerciseEntryPayload,
  PlanExerciseProgress,
  TrainingPlanExercise,
} from '@pu-stats/models';
import { appendLocalOffset } from '@pu-stats/date';
import {
  acquireWriteLock,
  dayProgress,
  LogPlanDayResult,
  planDayDateFor,
  releaseWriteLock,
  resolveExerciseApi,
  TrainingPlanActionsStore,
} from './training-plan-store.internals';

type Store = TrainingPlanActionsStore;

/** Whether a day index can be written to at all (active plan, real
 *  non-rest day, not in the future, live mirror synced). */
function dayIsWritable(store: Store, dayIndex: number): boolean {
  const plan = store.activePlan();
  const catalog = store.activeCatalog();
  if (!plan || !catalog || plan.status !== 'active') return false;
  const day = planDayByIndex(catalog, dayIndex);
  if (!day || day.kind === 'rest') return false;
  const currentIdx = store.currentDayIndex();
  return currentIdx !== null && dayIndex <= currentIdx;
}

/**
 * Persist an entry that brings one plan exercise up to its target.
 * Returns `'logged'` when an entry was written, `'already-logged'` when
 * the target was already covered (or isn't writable — an unquantified
 * HIIT item), and `'noop'` when the write path isn't available.
 *
 * The entry is timestamped at noon on the plan day's calendar date so a
 * backfill for an earlier day still lands in the correct daily bucket.
 */
async function writeExerciseEntry(
  store: Store,
  dayIndex: number,
  exercise: TrainingPlanExercise,
  alreadyLogged: number
): Promise<LogPlanDayResult> {
  const payload = planExerciseEntryPayload(exercise, alreadyLogged);
  if (!payload) return 'already-logged';
  const exerciseApi = resolveExerciseApi(store);
  const userId = store._user.userIdSafe();
  if (!exerciseApi || !userId) return 'noop';
  const dateIso = planDayDateFor(store, dayIndex);
  await firstValueFrom(
    exerciseApi.createEntry(userId, {
      exerciseId: payload.exerciseId,
      ...(payload.variantId ? { variantId: payload.variantId } : {}),
      timestamp: appendLocalOffset(`${dateIso}T12:00`),
      [payload.valueField]: payload.value,
      [payload.breakdownField]: payload.breakdown,
      source: 'plan',
    })
  );
  return 'logged';
}

/**
 * Mark the day as done once every one of its exercises is. Never
 * un-marks — only an explicit un-check does that (see `setItemDone`).
 */
async function completeDayIfFulfilled(
  store: Store,
  dayIndex: number,
  progress: ReadonlyArray<PlanExerciseProgress>
): Promise<void> {
  const plan = store.activePlan();
  if (!plan || plan.completedDays.includes(dayIndex)) return;
  if (!isPlanDayFulfilled(progress)) return;
  await firstValueFrom(
    store._api.addCompletedDay(store._user.userIdSafe(), dayIndex)
  );
}

/**
 * Log a single exercise of a plan day and tick it off. This is the
 * "einzeln" counterpart to `logPlanDay`: the other exercises of the day
 * are left untouched, and the day itself closes only once all of them
 * are done.
 *
 * Unquantified exercises (HIIT rounds, `target === 0`) have nothing to
 * write, so they are ticked off manually instead.
 */
export async function logPlanExercise(
  store: Store,
  dayIndex: number,
  itemIndex: number
): Promise<LogPlanDayResult> {
  if (!dayIsWritable(store, dayIndex)) return 'noop';
  if (store._isBrowser && !store._live.exerciseEntriesLoaded()) {
    return 'not-ready';
  }
  if (!acquireWriteLock(store, dayIndex)) return 'in-flight';
  try {
    const item = dayProgress(store, dayIndex)[itemIndex];
    if (!item) return 'noop';
    if (item.done) return 'already-logged';
    const result = await writeExerciseEntry(
      store,
      dayIndex,
      item.exercise,
      item.logged
    );
    if (result === 'noop') return 'noop';
    await checkOffItems(store, dayIndex, [itemIndex]);
    return result;
  } finally {
    releaseWriteLock(store, dayIndex);
  }
}

/**
 * Persist manual check-offs for the given items and close the day when
 * that completes it. The freshly-written ids are folded into the local
 * progress before the completion decision — the plan doc's listener
 * hasn't echoed the write back yet, and deciding on pre-write state
 * would leave a just-finished day open.
 */
async function checkOffItems(
  store: Store,
  dayIndex: number,
  itemIndexes: ReadonlyArray<number>
): Promise<void> {
  const userId = store._user.userIdSafe();
  const ids = itemIndexes.map((i) => planDayItemId(dayIndex, i));
  await firstValueFrom(store._api.addCompletedItems(userId, ids));
  const checked = new Set([
    ...(store.activePlan()?.completedItems ?? []),
    ...ids,
  ]);
  const progress = dayProgress(store, dayIndex).map((p) =>
    checked.has(planDayItemId(dayIndex, p.itemIndex))
      ? { ...p, checkedOff: true, done: true }
      : p
  );
  await completeDayIfFulfilled(store, dayIndex, progress);
  store.activeResource.reload();
}

/**
 * Tick a single exercise off (or back on) without writing an entry —
 * the "abhaken" path HIIT days live on, and the escape hatch for
 * anything the user tracked outside the app.
 *
 * Un-ticking also re-opens the day: leaving it flagged complete while
 * one of its exercises is open would strand the user with a day they
 * can't un-finish from the exercise list.
 */
export async function setItemDone(
  store: Store,
  dayIndex: number,
  itemIndex: number,
  done: boolean
): Promise<void> {
  if (!dayIsWritable(store, dayIndex)) return;
  if (!acquireWriteLock(store, dayIndex)) return;
  try {
    if (done) {
      await checkOffItems(store, dayIndex, [itemIndex]);
      return;
    }
    const userId = store._user.userIdSafe();
    await firstValueFrom(
      store._api.removeCompletedItems(userId, [
        planDayItemId(dayIndex, itemIndex),
      ])
    );
    if (store.activePlan()?.completedDays.includes(dayIndex)) {
      await firstValueFrom(store._api.removeCompletedDay(userId, dayIndex));
    }
    store.activeResource.reload();
  } finally {
    releaseWriteLock(store, dayIndex);
  }
}

/**
 * Log every open exercise of a day and mark the day done — the "gesamt"
 * action. Exercises already covered by logged entries are skipped, and
 * ones the plan doesn't quantify are ticked off instead of written.
 *
 * Every exercise is also recorded as ticked, not just the unquantified
 * ones: the entries we just wrote aren't in the live mirror yet, so
 * deriving fulfillment from it here would leave the day open until the
 * listener catches up — and for a backfilled past day the auto-mark
 * effect (today-only) would never close it at all.
 */
export async function logPlanDayExercises(
  store: Store,
  dayIndex: number
): Promise<LogPlanDayResult> {
  if (!dayIsWritable(store, dayIndex)) return 'noop';
  const progress = dayProgress(store, dayIndex);
  if (progress.length === 0) return 'noop';
  // The `exerciseEntries` mirror is empty until its Firestore listener has
  // emitted at least once. Don't make a write decision off pre-sync data —
  // it would top up a day that's already covered on a day-2 reload.
  if (store._isBrowser && !store._live.exerciseEntriesLoaded()) {
    return 'not-ready';
  }
  if (!acquireWriteLock(store, dayIndex)) return 'in-flight';
  try {
    let wroteAny = false;
    for (const item of progress) {
      if (item.done) continue;
      const result = await writeExerciseEntry(
        store,
        dayIndex,
        item.exercise,
        item.logged
      );
      if (result === 'noop') return 'noop';
      wroteAny ||= result === 'logged';
    }
    await checkOffItems(
      store,
      dayIndex,
      progress.map((p) => p.itemIndex)
    );
    return wroteAny ? 'logged' : 'already-logged';
  } finally {
    releaseWriteLock(store, dayIndex);
  }
}
