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
import { ExerciseFirestoreService } from '@pu-stats/data-access';
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

/** Everything an entry write needs, resolved once up front. */
interface EntryWriter {
  readonly api: ExerciseFirestoreService;
  readonly userId: string;
  /** Noon on the plan day's calendar date, so a backfill for an earlier
   *  day still lands in the correct daily bucket. */
  readonly timestamp: string;
}

/**
 * Resolve the write path for a day, or null when it isn't available (no
 * signed-in user, or a harness without the Firestore-backed service).
 * Resolved once per action rather than per exercise: a multi-exercise day
 * that lost the write path halfway would leave written entries behind
 * with nothing ticked.
 */
function resolveEntryWriter(
  store: Store,
  dayIndex: number
): EntryWriter | null {
  const api = resolveExerciseApi(store);
  const userId = store._user.userIdSafe();
  if (!api || !userId) return null;
  return {
    api,
    userId,
    timestamp: appendLocalOffset(`${planDayDateFor(store, dayIndex)}T12:00`),
  };
}

/**
 * Persist an entry that brings one plan exercise up to its target.
 * Returns `'logged'` when an entry was written and `'already-logged'`
 * when the target was already covered — or when the plan doesn't
 * quantify the exercise (an unquantified HIIT round), which leaves the
 * tick as the only way to close it.
 */
async function writeExerciseEntry(
  writer: EntryWriter,
  exercise: TrainingPlanExercise,
  alreadyLogged: number
): Promise<LogPlanDayResult> {
  const payload = planExerciseEntryPayload(exercise, alreadyLogged);
  if (!payload) return 'already-logged';
  await firstValueFrom(
    writer.api.createEntry(writer.userId, {
      exerciseId: payload.exerciseId,
      ...(payload.variantId ? { variantId: payload.variantId } : {}),
      timestamp: writer.timestamp,
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
    const writer = resolveEntryWriter(store, dayIndex);
    if (!writer) return 'noop';
    const result = await writeExerciseEntry(writer, item.exercise, item.logged);
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
  const writer = resolveEntryWriter(store, dayIndex);
  if (!writer) return 'noop';
  if (!acquireWriteLock(store, dayIndex)) return 'in-flight';
  try {
    let wroteAny = false;
    for (const item of progress) {
      if (item.done) continue;
      const result = await writeExerciseEntry(
        writer,
        item.exercise,
        item.logged
      );
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
