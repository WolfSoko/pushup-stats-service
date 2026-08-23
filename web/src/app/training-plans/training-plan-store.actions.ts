import { firstValueFrom } from 'rxjs';
import { planDayByIndex, TRAINING_PLANS, TrainingPlan } from '@pu-stats/models';
import { logPlanDayExercises } from './training-plan-store.items';
import {
  LogPlanDayResult,
  TrainingPlanActionsStore,
} from './training-plan-store.internals';

export type { LogPlanDayResult } from './training-plan-store.internals';

type Store = TrainingPlanActionsStore;

/** All curated plans (re-exposed for component templates). */
export function allPlans(): ReadonlyArray<TrainingPlan> {
  return TRAINING_PLANS;
}

/** Mark today's plan day as done. Idempotent. No-op on rest days. */
export async function markTodayDone(store: Store): Promise<void> {
  const idx = store.currentDayIndex();
  const day = store.todayDay();
  if (idx === null || !day) return;
  await markDayDone(store, idx);
}

/**
 * Log today's plan-prescribed exercises and mark today as done. Thin
 * wrapper around `logPlanDay(currentDayIndex)`.
 */
export async function logTodayPlanDay(store: Store): Promise<LogPlanDayResult> {
  const idx = store.currentDayIndex();
  if (idx === null) return 'noop';
  return logPlanDay(store, idx);
}

/**
 * Mark a specific day as done WITHOUT creating any entries.
 * Use this for "I already logged elsewhere" flows. For the
 * common case (mark done + log the plan-prescribed exercises) call
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
  // `arrayUnion` so concurrent writes to *different* day indexes
  // (e.g. auto-mark today + manual mark for yesterday in another
  // tab) merge correctly server-side.
  await firstValueFrom(store._api.addCompletedDay(userId, dayIndex));
  store.activeResource.reload();
}

/**
 * Log every exercise the day prescribes AND mark the day as done.
 * Idempotent: exercises already covered by entries on that calendar day
 * are skipped rather than topped up twice.
 *
 * Guards (in order):
 * - Plan must be active (status === 'active') and resolvable.
 * - Day must be a non-rest day that prescribes at least one exercise.
 * - Day must not be in the future relative to today.
 * - `LiveDataStore` must have synced at least once, otherwise we'd
 *   duplicate-write existing entries on a day-2 reload.
 * - No concurrent call for the same day index (in-flight lock).
 */
export async function logPlanDay(
  store: Store,
  dayIndex: number
): Promise<LogPlanDayResult> {
  return logPlanDayExercises(store, dayIndex);
}
