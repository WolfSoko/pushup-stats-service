import { TrainingPlan, TrainingPlanDay } from '@pu-stats/models';
import { toBerlinIsoDate, toLocalIsoDate } from '@pu-stats/date';

/** A logged-reps entry from the `exerciseEntries` mirror. */
export interface RepsEntryLike {
  readonly exerciseId: string;
  readonly timestamp: string;
  readonly reps?: number;
}

/**
 * Calendar date (`YYYY-MM-DD`) for a 1-based plan day given the plan's
 * `startDate`. Falls back to today's Berlin date when `startDate` is
 * missing or unparseable (defensive — callers already gate on the plan
 * existing).
 */
export function planDayDate(
  startDate: string | null | undefined,
  dayIndex: number
): string {
  if (!startDate) return toBerlinIsoDate(new Date());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (!m) return toBerlinIsoDate(new Date());
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const start = new Date(year, month - 1, day);
  // Round-trip: `new Date(2026, 1, 30)` silently overflows to March 2
  // instead of failing on Feb-30. Reject impossible dates so a corrupt
  // `startDate` can't shift logging into the wrong calendar day.
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return toBerlinIsoDate(new Date());
  }
  start.setHours(0, 0, 0, 0);
  const target = new Date(start);
  target.setDate(start.getDate() + (dayIndex - 1));
  return toLocalIsoDate(target);
}

/**
 * Sum of reps already logged on a given local date for one exercise.
 * Reads the `exerciseEntries` mirror filtered by id — post-cutover
 * pushups live there too (`exerciseId:'pushup'`), so no special case.
 */
export function sumRepsLoggedOn(
  entries: ReadonlyArray<RepsEntryLike>,
  dateIso: string,
  exerciseId: string
): number {
  return entries
    .filter(
      (e) => e.exerciseId === exerciseId && e.timestamp.slice(0, 10) === dateIso
    )
    .reduce((sum, e) => sum + (e.reps ?? 0), 0);
}

/**
 * Completion percent (0–100) for a plan. Only non-rest, non-skipped days
 * count toward the denominator; rest-day or skipped-day entries leaking
 * into `completedDays` would otherwise skew progress > 100%.
 */
export function computeCompletionPercent(
  catalog: TrainingPlan,
  completedDays: ReadonlyArray<number>,
  skippedDays: ReadonlyArray<number>
): number {
  const skipped = new Set(skippedDays);
  const requiredDayIndexes = new Set(
    catalog.days
      .filter((d) => d.kind !== 'rest' && !skipped.has(d.dayIndex))
      .map((d) => d.dayIndex)
  );
  if (requiredDayIndexes.size === 0) return 0;
  const completedRequired = completedDays.filter((idx) =>
    requiredDayIndexes.has(idx)
  ).length;
  return Math.min(
    100,
    Math.round((completedRequired / requiredDayIndexes.size) * 100)
  );
}

/** Non-rest day indexes that fall before `targetDayIndex` (bulk-skip set). */
export function nonRestDaysBeforeTarget(
  catalog: TrainingPlan,
  targetDayIndex: number
): number[] {
  return catalog.days
    .filter((d) => d.dayIndex < targetDayIndex && d.kind !== 'rest')
    .map((d) => d.dayIndex);
}

/** Immutable add to a numeric set. */
export function addToSet(
  set: ReadonlySet<number>,
  value: number
): ReadonlySet<number> {
  const next = new Set(set);
  next.add(value);
  return next;
}

/** Immutable remove from a numeric set. */
export function removeFromSet(
  set: ReadonlySet<number>,
  value: number
): ReadonlySet<number> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

/** Payload for a top-up pushup write computed from prior logged reps. */
export interface PlanDayRepsPayload {
  readonly reps: number;
  readonly sets: number[];
}

/**
 * Reps/sets to persist for a plan day given what's already logged.
 * Returns null when the day is already covered (no write needed).
 *
 * If the user has logged nothing yet, persist the full prescribed sets so
 * the breakdown is preserved. If they logged some reps already, top up the
 * remainder as a single set — we don't second-guess their split.
 */
export function planDayRepsPayload(
  day: TrainingPlanDay,
  alreadyLogged: number
): PlanDayRepsPayload | null {
  if (alreadyLogged >= day.targetReps) return null;
  const remaining = day.targetReps - alreadyLogged;
  const sets =
    alreadyLogged === 0 ? (day.sets ?? [day.targetReps]) : [remaining];
  const reps = alreadyLogged === 0 ? day.targetReps : remaining;
  return { reps, sets };
}
