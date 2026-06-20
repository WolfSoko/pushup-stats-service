import { Injector } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import {
  ExerciseFirestoreService,
  UserTrainingPlanApiService,
} from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  planDayByIndex,
  TrainingPlan,
  TrainingPlanDay,
  trainingPlanDayExerciseId,
  TRAINING_PLANS,
  UserTrainingPlan,
} from '@pu-stats/models';
import { appendLocalOffset } from '@pu-stats/date';
import {
  addToSet,
  planDayDate,
  planDayRepsPayload,
  removeFromSet,
  sumRepsLoggedOn,
} from './training-plan-store.math';
import { isRepsMeasuredPlanDay } from './training-plan-store.selectors';

/**
 * Result of `logPlanDay` / `logTodayPlanDay`. Lets callers tailor
 * UI feedback (snackbar message) to what actually happened: a
 * fresh write, an idempotent skip, or a rejected request.
 */
export type LogPlanDayResult =
  | 'logged' // pushup entry created + day marked done
  | 'already-logged' // day was already covered by existing reps; only marked
  | 'noop' // pre-conditions failed (no plan, rest day, future day, …)
  | 'in-flight' // a concurrent call for the same day is still running
  | 'not-ready'; // LiveDataStore hasn't finished its first sync yet

/**
 * Subset of the `TrainingPlanStore` instance the action functions read.
 * Declared structurally so the actions live in their own module while the
 * store stays a thin orchestrator of one-line wrappers. The full store
 * (props + computed + the in-flight-lock signal) satisfies this shape.
 */
export interface TrainingPlanActionsStore {
  _api: UserTrainingPlanApiService;
  _findPlanById: (planId: string) => TrainingPlan | null;
  _injector: Injector;
  _live: InstanceType<typeof LiveDataStore>;
  _user: UserContextService;
  _isBrowser: boolean;
  _writingDays: WritableSignal<ReadonlySet<number>>;
  activeResource: { reload: () => void };
  activePlan: () => UserTrainingPlan | null;
  activeCatalog: () => TrainingPlan | null;
  currentDayIndex: () => number | null;
  todayDay: () => TrainingPlanDay | null;
}

type Store = TrainingPlanActionsStore;

/**
 * Calendar date (`YYYY-MM-DD`) for a 1-based plan day. Falls back to today's
 * Berlin date if the plan is missing or the start date can't be parsed
 * (defensive — caller already checks).
 */
export function planDayDateFor(store: Store, dayIndex: number): string {
  return planDayDate(store.activePlan()?.startDate, dayIndex);
}

/** Sum of reps already logged on a given local date for one exercise.
 *  Reads the `exerciseEntries` mirror filtered by id — post-cutover
 *  pushups live there too (`exerciseId:'pushup'`), so no special case. */
export function repsLoggedOn(
  store: Store,
  dateIso: string,
  exerciseId: string
): number {
  return sumRepsLoggedOn(store._live.exerciseEntries(), dateIso, exerciseId);
}

/** Lazily resolve the Firestore-bound exercise API. Returns null when no
 *  provider is registered (e.g. a test harness without `Firestore`). */
export function resolveExerciseApi(
  store: Store
): ExerciseFirestoreService | null {
  return store._injector.get(ExerciseFirestoreService, null);
}

/** Acquire an in-flight lock for a day. Returns false if already held. */
export function acquireWriteLock(store: Store, dayIndex: number): boolean {
  const set = store._writingDays();
  if (set.has(dayIndex)) return false;
  store._writingDays.set(addToSet(set, dayIndex));
  return true;
}

export function releaseWriteLock(store: Store, dayIndex: number): void {
  const set = store._writingDays();
  if (!set.has(dayIndex)) return;
  store._writingDays.set(removeFromSet(set, dayIndex));
}

/** All curated plans (re-exposed for component templates). */
export function allPlans(): ReadonlyArray<TrainingPlan> {
  return TRAINING_PLANS;
}

/** Mark today's plan day as done. Idempotent. No-op on rest days. */
export async function markTodayDone(store: Store): Promise<void> {
  const a = store.activePlan();
  const idx = store.currentDayIndex();
  const day = store.todayDay();
  if (!a || idx === null || !day) return;
  // Rest days are not part of the completion set — silently skip
  // so a generic "mark today done" callback can't skew progress.
  if (day.kind === 'rest') return;
  if (a.completedDays.includes(idx)) return;
  const userId = store._user.userIdSafe();
  // `arrayUnion` so concurrent writes to *different* day indexes
  // (e.g. auto-mark today + manual mark for yesterday in another
  // tab) merge correctly server-side instead of clobbering.
  await firstValueFrom(store._api.addCompletedDay(userId, idx));
  store.activeResource.reload();
}

/**
 * Log today's plan-prescribed reps and mark today as done. Thin
 * wrapper around `logPlanDay(currentDayIndex)`.
 */
export async function logTodayPlanDay(store: Store): Promise<LogPlanDayResult> {
  const idx = store.currentDayIndex();
  if (idx === null) return 'noop';
  return logPlanDay(store, idx);
}

/**
 * Mark a specific day as done WITHOUT creating a pushup entry.
 * Use this for "I already logged elsewhere" flows. For the
 * common case (mark done + log the plan-prescribed reps) call
 * `logPlanDay()` instead.
 */
export async function markDayDone(
  store: Store,
  dayIndex: number
): Promise<void> {
  const a = store.activePlan();
  const c = store.activeCatalog();
  if (!a || !c) return;
  // Reject out-of-range or rest-day indexes — those should never
  // count toward completion progress.
  const day = planDayByIndex(c, dayIndex);
  if (!day || day.kind === 'rest') return;
  if (a.completedDays.includes(dayIndex)) return;
  const userId = store._user.userIdSafe();
  await firstValueFrom(store._api.addCompletedDay(userId, dayIndex));
  store.activeResource.reload();
}

/**
 * Log the plan-prescribed reps for a day AND mark the day as
 * done. Idempotent: skips the pushup write if the calendar day
 * is already covered by existing entries.
 *
 * The pushup entry is timestamped at noon (12:00) on the plan
 * day's calendar date so a backfill for an earlier day still
 * lands in the correct daily bucket.
 *
 * Guards (in order):
 * - Plan must be active (status === 'active') and resolvable.
 * - Day must be a non-rest, non-zero-target day in the plan.
 * - Day must not be in the future relative to today.
 * - `LiveDataStore` must have synced at least once, otherwise
 *   `repsLoggedOn` returns 0 and we'd duplicate-write existing
 *   entries on day-2 reload.
 * - No concurrent call for the same day index (in-flight lock).
 */
export async function logPlanDay(
  store: Store,
  dayIndex: number
): Promise<LogPlanDayResult> {
  const a = store.activePlan();
  const c = store.activeCatalog();
  if (!a || !c || a.status !== 'active') return 'noop';
  const day = planDayByIndex(c, dayIndex);
  if (!day || day.kind === 'rest' || day.targetReps <= 0) return 'noop';
  // All plan days route through exerciseEntries. Only reps-measured catalog
  // exercises map onto a plan day's targetReps/sets. A time- or distance-
  // measured day can't be honored with a reps payload, and createEntry needs
  // a resolved user plus the lazily-resolved Firestore-backed exercise API —
  // fail closed on any of these.
  if (!isRepsMeasuredPlanDay(day)) return 'noop';
  const exerciseId = trainingPlanDayExerciseId(day);
  const exerciseApi = resolveExerciseApi(store);
  if (!store._user.userIdSafe() || !exerciseApi) return 'noop';

  const currentIdx = store.currentDayIndex();
  if (currentIdx === null || dayIndex > currentIdx) return 'noop';

  // The `exerciseEntries` mirror is empty until its Firestore listener
  // has emitted at least once. Don't make a write decision off pre-sync
  // data — it would top-up a day that's already covered as soon as the
  // listener catches up. Post-cutover pushups live in that same mirror,
  // so every exercise gates on `exerciseEntriesLoaded`.
  if (store._isBrowser && !store._live.exerciseEntriesLoaded())
    return 'not-ready';

  if (!acquireWriteLock(store, dayIndex)) return 'in-flight';

  try {
    const dateIso = planDayDateFor(store, dayIndex);
    const alreadyLogged = repsLoggedOn(store, dateIso, exerciseId);
    const payload = planDayRepsPayload(day, alreadyLogged);
    let result: LogPlanDayResult;

    if (payload) {
      const timestamp = appendLocalOffset(`${dateIso}T12:00`);
      await firstValueFrom(
        exerciseApi.createEntry(store._user.userIdSafe(), {
          exerciseId,
          timestamp,
          reps: payload.reps,
          sets: payload.sets,
          source: 'plan',
        })
      );
      result = 'logged';
    } else {
      result = 'already-logged';
    }

    if (!a.completedDays.includes(dayIndex)) {
      const userId = store._user.userIdSafe();
      await firstValueFrom(store._api.addCompletedDay(userId, dayIndex));
    }
    store.activeResource.reload();
    return result;
  } finally {
    releaseWriteLock(store, dayIndex);
  }
}
