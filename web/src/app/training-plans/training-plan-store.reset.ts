import { firstValueFrom } from 'rxjs';
import {
  type ExerciseEntry,
  measurementValueField,
  planDayItemId,
  planExerciseLoggedTotal,
  planExerciseMeasurement,
  type TrainingPlanExercise,
} from '@pu-stats/models';
import {
  acquireWriteLock,
  dayIsWritable,
  dayProgress,
  planDayDateFor,
  releaseWriteLock,
  resolveExerciseApi,
  TrainingPlanActionsStore,
} from './training-plan-store.internals';

type Store = TrainingPlanActionsStore;

/**
 * Outcome of {@link resetPlanExercise}:
 *  - `reset` — the exercise is open again
 *  - `kept-entries` — tick and plan entries are gone, but entries the user
 *    logged themselves still cover the target, so it stays fulfilled
 *  - `noop` / `in-flight` — nothing was written
 */
export type ResetExerciseResult =
  'reset' | 'kept-entries' | 'noop' | 'in-flight';

/**
 * The plan's own entries for one exercise on one day, newest first. Only
 * `source: 'plan'` docs qualify: a reset undoes what the plan wrote, it
 * never touches a workout the user logged by hand.
 */
function planWrittenEntries(
  store: Store,
  dateIso: string,
  exercise: TrainingPlanExercise
): ExerciseEntry[] {
  return store._live
    .exerciseEntries()
    .filter(
      (e) =>
        e.source === 'plan' &&
        e.exerciseId === exercise.exerciseId &&
        e.timestamp.slice(0, 10) === dateIso
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Delete plan entries until `budget` (the amount credited to this item)
 * is covered, and return their ids. A day may name the same exercise
 * twice, so the entries are drawn down rather than wiped: resetting the
 * first Plank item must leave the second one's seconds alone.
 */
async function deletePlanEntries(
  store: Store,
  dateIso: string,
  exercise: TrainingPlanExercise,
  budget: number
): Promise<ReadonlySet<string>> {
  const api = resolveExerciseApi(store);
  const measurement = planExerciseMeasurement(exercise);
  const deleted = new Set<string>();
  if (!api || !measurement || budget <= 0) return deleted;
  const field = measurementValueField(measurement);
  let removed = 0;
  for (const entry of planWrittenEntries(store, dateIso, exercise)) {
    if (removed >= budget) break;
    await firstValueFrom(api.deleteEntry(entry._id));
    deleted.add(entry._id);
    removed += entry[field] ?? 0;
  }
  return deleted;
}

/**
 * Re-open a single exercise of a plan day: drop its manual tick, delete
 * the entries the plan wrote for it, and un-finish the day so the list
 * doesn't sit under a "done" header with an open exercise in it.
 *
 * Entries the user logged themselves survive — the reset reports
 * `kept-entries` when those alone still cover the target, so the caller
 * can explain why the row stays ticked.
 */
export async function resetPlanExercise(
  store: Store,
  dayIndex: number,
  itemIndex: number
): Promise<ResetExerciseResult> {
  if (!dayIsWritable(store, dayIndex)) return 'noop';
  if (!acquireWriteLock(store, dayIndex)) return 'in-flight';
  try {
    const item = dayProgress(store, dayIndex)[itemIndex];
    if (!item) return 'noop';
    const userId = store._user.userIdSafe();
    const dateIso = planDayDateFor(store, dayIndex);

    if (item.checkedOff) {
      await firstValueFrom(
        store._api.removeCompletedItems(userId, [
          planDayItemId(dayIndex, itemIndex),
        ])
      );
    }
    const deleted = await deletePlanEntries(
      store,
      dateIso,
      item.exercise,
      item.logged
    );
    if (store.activePlan()?.completedDays.includes(dayIndex)) {
      await firstValueFrom(store._api.removeCompletedDay(userId, dayIndex));
    }
    store.activeResource.reload();

    const target = item.exercise.target;
    if (target <= 0) return 'reset';
    const stillLogged = planExerciseLoggedTotal(
      store._live.exerciseEntries().filter((e) => !deleted.has(e._id)),
      dateIso,
      item.exercise
    );
    return stillLogged >= target ? 'kept-entries' : 'reset';
  } finally {
    releaseWriteLock(store, dayIndex);
  }
}
