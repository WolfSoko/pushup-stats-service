import { firstValueFrom } from 'rxjs';
import {
  entryBreakdownField,
  isValidTestResult,
  measurementValueField,
  planDayByIndex,
  planDayItemId,
  planTestFields,
  planTestResult,
  type PlanTestField,
} from '@pu-stats/models';
import { appendLocalOffset } from '@pu-stats/date';
import {
  acquireWriteLock,
  dayIsWritable,
  planDayDateFor,
  releaseWriteLock,
  resolveExerciseApi,
  TrainingPlanActionsStore,
} from './training-plan-store.internals';
import { checkOffItems } from './training-plan-store.items';
import { deletePlanEntries } from './training-plan-store.reset';

type Store = TrainingPlanActionsStore;

/**
 * Recording what a max-test day measured.
 *
 * A test day is the one prescription whose numbers the *user* supplies:
 * the plan can recommend a figure, but only the attempt says what it
 * actually was. A day can measure several things — Core Foundations opens
 * with a plank hold, pushups and a hollow hold — so every value is
 * addressed by its position within the day.
 *
 * Each value is persisted on the plan doc, where the opening test's
 * values rescale every later day, and mirrored as an ordinary exercise
 * entry so the attempt counts toward stats and streaks.
 */

/**
 * Outcome of {@link recordTestResult}:
 *  - `recorded` — first value for this field
 *  - `updated` — replaced an earlier value (and the entry behind it)
 *  - `invalid` — not a usable measurement
 *  - `not-ready` — the entry mirror hasn't synced yet
 *  - `noop` / `in-flight` — nothing was written
 */
export type RecordTestResultOutcome =
  'recorded' | 'updated' | 'invalid' | 'noop' | 'in-flight' | 'not-ready';

/** Resolve one field of a test day, or null when the day has no such field. */
function testFieldAt(
  store: Store,
  dayIndex: number,
  itemIndex: number
): { field: PlanTestField; fields: ReadonlyArray<PlanTestField> } | null {
  const catalog = store.activeCatalog();
  const day = catalog ? planDayByIndex(catalog, dayIndex) : null;
  if (!day || day.kind !== 'test') return null;
  const fields = planTestFields(day);
  const field = fields.find((f) => f.itemIndex === itemIndex);
  return field ? { field, fields } : null;
}

/** The single-set entry one measured value produces. */
async function writeTestEntry(
  store: Store,
  dayIndex: number,
  field: PlanTestField,
  value: number
): Promise<void> {
  const api = resolveExerciseApi(store);
  const userId = store._user.userIdSafe();
  if (!api || !userId) return;
  await firstValueFrom(
    api.createEntry(userId, {
      exerciseId: field.exerciseId,
      ...(field.variantId ? { variantId: field.variantId } : {}),
      timestamp: appendLocalOffset(`${planDayDateFor(store, dayIndex)}T12:00`),
      // A max test is by definition one unbroken set or hold.
      [measurementValueField(field.measurement)]: value,
      [entryBreakdownField(field.measurement)]: [value],
      source: 'plan',
    })
  );
}

/**
 * Drop the entry a previous attempt at this field wrote, so a revised
 * value replaces it rather than stacking on top. The budget is the
 * earlier *recorded* value, not everything logged that day — entries the
 * user added by hand are none of this action's business.
 */
async function discardPreviousAttempt(
  store: Store,
  dayIndex: number,
  field: PlanTestField,
  previous: number | null
): Promise<void> {
  if (previous === null) return;
  await deletePlanEntries(
    store,
    planDayDateFor(store, dayIndex),
    { exerciseId: field.exerciseId, target: previous },
    previous
  );
}

/**
 * Close the test day once its fields are satisfied.
 *
 * Fields backed by a real exercise row are ticked off, which closes the
 * day through the normal fulfillment path. A day that prescribes nothing
 * measurable has no row to tick, so it is marked done directly —
 * otherwise the user would be left with a day they just completed and
 * cannot close.
 */
async function closeDayIfComplete(
  store: Store,
  dayIndex: number,
  field: PlanTestField
): Promise<void> {
  if (field.hasItem) {
    await checkOffItems(store, dayIndex, [field.itemIndex]);
    return;
  }
  if (!store.activePlan()?.completedDays.includes(dayIndex)) {
    await firstValueFrom(
      store._api.addCompletedDay(store._user.userIdSafe(), dayIndex)
    );
  }
  store.activeResource.reload();
}

/** Persist one measured value of a `test` day. */
export async function recordTestResult(
  store: Store,
  dayIndex: number,
  itemIndex: number,
  value: number
): Promise<RecordTestResultOutcome> {
  if (!dayIsWritable(store, dayIndex)) return 'noop';
  const resolved = testFieldAt(store, dayIndex, itemIndex);
  if (!resolved) return 'noop';
  const { field } = resolved;
  if (!isValidTestResult(value, field.measurement)) return 'invalid';
  // Revising a value deletes the entry behind the old one, and the mirror
  // is what says which entry that is.
  if (store._isBrowser && !store._live.exerciseEntriesLoaded()) {
    return 'not-ready';
  }
  if (!acquireWriteLock(store, dayIndex)) return 'in-flight';
  try {
    const previous = planTestResult(store.activePlan(), dayIndex, itemIndex);
    if (previous === value) return 'updated';
    const userId = store._user.userIdSafe();

    await discardPreviousAttempt(store, dayIndex, field, previous);
    await writeTestEntry(store, dayIndex, field, value);
    await firstValueFrom(
      store._api.setTestResult(userId, dayIndex, itemIndex, value)
    );
    await closeDayIfComplete(store, dayIndex, field);
    return previous === null ? 'recorded' : 'updated';
  } finally {
    releaseWriteLock(store, dayIndex);
  }
}

/**
 * Discard one measured value: the value, the entry it wrote, and the
 * day's completion. That exercise falls back to its catalog targets,
 * which is also what the user gets by skipping the test outright.
 */
export async function clearTestResult(
  store: Store,
  dayIndex: number,
  itemIndex: number
): Promise<boolean> {
  if (!dayIsWritable(store, dayIndex)) return false;
  if (store._isBrowser && !store._live.exerciseEntriesLoaded()) return false;
  const resolved = testFieldAt(store, dayIndex, itemIndex);
  if (!resolved) return false;
  const { field } = resolved;
  const previous = planTestResult(store.activePlan(), dayIndex, itemIndex);
  if (previous === null) return false;
  if (!acquireWriteLock(store, dayIndex)) return false;
  try {
    const userId = store._user.userIdSafe();
    await discardPreviousAttempt(store, dayIndex, field, previous);
    await firstValueFrom(
      store._api.removeTestResult(userId, dayIndex, itemIndex)
    );
    if (field.hasItem) {
      await firstValueFrom(
        store._api.removeCompletedItems(userId, [
          planDayItemId(dayIndex, itemIndex),
        ])
      );
    }
    if (store.activePlan()?.completedDays.includes(dayIndex)) {
      await firstValueFrom(store._api.removeCompletedDay(userId, dayIndex));
    }
    store.activeResource.reload();
    return true;
  } finally {
    releaseWriteLock(store, dayIndex);
  }
}
