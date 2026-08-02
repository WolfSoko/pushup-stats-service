import { Injector } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { UserContextService } from '@pu-auth/auth';
import {
  ExerciseFirestoreService,
  UserTrainingPlanApiService,
} from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  planDayByIndex,
  planDayProgress,
  PlanExerciseProgress,
  TrainingPlan,
  TrainingPlanDay,
  UserTrainingPlan,
} from '@pu-stats/models';
import {
  addToSet,
  planDayDate,
  removeFromSet,
} from './training-plan-store.math';

/**
 * Shared plumbing for the training-plan store's action modules. Lives in
 * its own file so `*.actions`, `*.items` and `*.hooks` can all reach it
 * without importing each other.
 */

/**
 * Result of `logPlanDay` / `logPlanExercise`. Lets callers tailor UI
 * feedback (snackbar message) to what actually happened: a fresh write,
 * an idempotent skip, or a rejected request.
 */
export type LogPlanDayResult =
  | 'logged' // entries created + day/exercise marked done
  | 'already-logged' // targets were already covered; only marked
  | 'noop' // pre-conditions failed (no plan, rest day, future day, …)
  | 'in-flight' // a concurrent call for the same day is still running
  | 'not-ready'; // LiveDataStore hasn't finished its first sync yet

/**
 * Subset of the `TrainingPlanStore` instance the action functions read.
 * Declared structurally so the actions live in their own modules while
 * the store stays a thin orchestrator of one-line wrappers. The full
 * store (props + computed + the in-flight-lock signal) satisfies this
 * shape.
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

/**
 * Per-exercise fulfillment for one plan day, folding the live
 * `exerciseEntries` mirror together with the manual check-offs stored on
 * the user's plan doc. Empty when there is no active plan or the day
 * prescribes nothing (rest days).
 */
export function dayProgress(
  store: Store,
  dayIndex: number
): ReadonlyArray<PlanExerciseProgress> {
  const plan = store.activePlan();
  const catalog = store.activeCatalog();
  if (!plan || !catalog) return [];
  const day = planDayByIndex(catalog, dayIndex);
  if (!day) return [];
  return planDayProgress(day, dayIndex, {
    entries: store._live.exerciseEntries(),
    dateIso: planDayDateFor(store, dayIndex),
    completedItems: plan.completedItems ?? [],
  });
}
