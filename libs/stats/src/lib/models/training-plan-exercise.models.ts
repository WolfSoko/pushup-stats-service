import {
  entryBreakdownField,
  ExerciseEntry,
  measurementValueField,
  MeasurementType,
} from './exercise.models';
import { findExerciseDefinition } from './exercise.catalog';
import {
  TrainingPlanDay,
  TrainingPlanExercise,
  trainingPlanDayExerciseId,
} from './training-plan.models';

/**
 * Per-exercise view of a training day. A day either lists its exercises
 * explicitly (multi-exercise plans: circuits, push/pull, HIIT) or is a
 * single-exercise day whose item is derived from the legacy
 * `exerciseId`/`targetReps`/`sets` triple. Everything downstream —
 * fulfillment, auto-mark, the detail UI — reads {@link planDayExercises}
 * so both shapes behave identically.
 */

/** The entry fields a plan item can be fulfilled from. */
export type PlanExerciseValueField = ReturnType<typeof measurementValueField>;

/** Minimal shape of a logged entry needed to compute fulfillment. */
export type PlanExerciseEntryLike = Pick<
  ExerciseEntry,
  'exerciseId' | 'timestamp'
> &
  Partial<Pick<ExerciseEntry, 'reps' | 'durationSec' | 'distanceM'>>;

/** Fulfillment state of one exercise item on one calendar date. */
export interface PlanExerciseProgress {
  /** 0-based position inside the day's exercise list. */
  itemIndex: number;
  exercise: TrainingPlanExercise;
  /** Amount logged on the day's date, in the exercise's unit. */
  logged: number;
  /** True when logged entries alone cover the target. */
  fulfilledByEntries: boolean;
  /** True when the user ticked this item off by hand. */
  checkedOff: boolean;
  /** `fulfilledByEntries || checkedOff`. */
  done: boolean;
}

// Derived single-item lists are cached per day object so repeated calls
// from computed signals keep referential stability — a fresh array each
// time would defeat downstream `computed()` equality checks.
const derivedItems = new WeakMap<
  TrainingPlanDay,
  ReadonlyArray<TrainingPlanExercise>
>();

const EMPTY: ReadonlyArray<TrainingPlanExercise> = [];

/**
 * Every trackable exercise of a day. Falls back to a single derived item
 * for days that don't list `exercises`, and to an empty list for rest
 * days (and any other day without a measurable prescription).
 */
export function planDayExercises(
  day: TrainingPlanDay
): ReadonlyArray<TrainingPlanExercise> {
  if (day.kind === 'rest') return EMPTY;
  if (day.exercises && day.exercises.length > 0) return day.exercises;
  if (day.targetReps <= 0) return EMPTY;
  const cached = derivedItems.get(day);
  if (cached) return cached;
  const item: TrainingPlanExercise = {
    exerciseId: trainingPlanDayExerciseId(day),
    target: day.targetReps,
    ...(day.variantId ? { variantId: day.variantId } : {}),
    ...(day.sets ? { sets: day.sets } : {}),
  };
  const list: ReadonlyArray<TrainingPlanExercise> = [item];
  derivedItems.set(day, list);
  return list;
}

/** Whether a day is ticked off by hand rather than fulfilled by metrics. */
export function isCheckoffDay(
  day: Pick<TrainingPlanDay, 'completion'>
): boolean {
  return day.completion === 'checkoff';
}

/** Stable id for one exercise item of one day, as persisted in
 *  `UserTrainingPlan.completedItems`. */
export function planDayItemId(dayIndex: number, itemIndex: number): string {
  return `${dayIndex}:${itemIndex}`;
}

/** Inverse of {@link planDayItemId}. Returns null for malformed ids. */
export function parsePlanDayItemId(
  id: string
): { dayIndex: number; itemIndex: number } | null {
  const match = /^(\d+):(\d+)$/.exec(id);
  if (!match) return null;
  return { dayIndex: Number(match[1]), itemIndex: Number(match[2]) };
}

/** Measurement type of a plan item's exercise, or null when unresolvable. */
export function planExerciseMeasurement(
  exercise: Pick<TrainingPlanExercise, 'exerciseId'>
): MeasurementType | null {
  return findExerciseDefinition(exercise.exerciseId)?.measurement ?? null;
}

/**
 * Sum of everything logged for a plan item on one local date, read from
 * the `exerciseEntries` mirror. Reads the entry field that matches the
 * exercise's measurement (reps / durationSec / distanceM), so a plank
 * target in seconds is honored by a hold-timer entry and a squat target
 * in reps by a Quick-Add entry.
 */
export function planExerciseLoggedTotal(
  entries: ReadonlyArray<PlanExerciseEntryLike>,
  dateIso: string,
  exercise: Pick<TrainingPlanExercise, 'exerciseId'>
): number {
  const measurement = planExerciseMeasurement(exercise);
  if (!measurement) return 0;
  const field = measurementValueField(measurement);
  if (field === 'weightKg') return 0;
  return entries
    .filter(
      (e) =>
        e.exerciseId === exercise.exerciseId &&
        e.timestamp.slice(0, 10) === dateIso
    )
    .reduce((sum, e) => sum + (e[field] ?? 0), 0);
}

/**
 * Fulfillment of every exercise of a day on its calendar date.
 *
 * A day may name the same exercise twice (Plank and Side Plank both
 * resolve to `plank.standard`), so the logged total per exercise is a
 * pool drawn down in list order rather than being counted once per item
 * — otherwise 60 s of plank would satisfy both a 150 s and a 180 s item.
 * Hand-ticked items are credited in full and skip the pool entirely.
 *
 * `checkoff` days never derive fulfillment from entries: their real
 * volume depends on rounds completed, so only an explicit tick counts.
 */
export function planDayProgress(
  day: TrainingPlanDay,
  dayIndex: number,
  args: {
    entries: ReadonlyArray<PlanExerciseEntryLike>;
    dateIso: string;
    completedItems: ReadonlyArray<string>;
  }
): ReadonlyArray<PlanExerciseProgress> {
  const checked = new Set(args.completedItems);
  const metric = !isCheckoffDay(day);
  const pool = new Map<string, number>();
  return planDayExercises(day).map((exercise, itemIndex) => {
    // A hand-ticked exercise is credited in full and draws nothing from
    // the pool. Draining it would let a ticked Plank swallow the seconds
    // a following Side Plank item needs, leaving that one open on a day
    // the user has actually finished.
    if (checked.has(planDayItemId(dayIndex, itemIndex))) {
      return {
        itemIndex,
        exercise,
        logged: exercise.target,
        fulfilledByEntries: false,
        checkedOff: true,
        done: true,
      };
    }
    if (metric && !pool.has(exercise.exerciseId)) {
      pool.set(
        exercise.exerciseId,
        planExerciseLoggedTotal(args.entries, args.dateIso, exercise)
      );
    }
    const available = pool.get(exercise.exerciseId) ?? 0;
    const logged = Math.min(available, exercise.target);
    pool.set(exercise.exerciseId, available - logged);
    const fulfilledByEntries =
      metric && exercise.target > 0 && logged >= exercise.target;
    return {
      itemIndex,
      exercise,
      logged,
      fulfilledByEntries,
      checkedOff: false,
      done: fulfilledByEntries,
    };
  });
}

/** True when every exercise of the day is fulfilled (empty ⇒ false). */
export function isPlanDayFulfilled(
  progress: ReadonlyArray<PlanExerciseProgress>
): boolean {
  return progress.length > 0 && progress.every((p) => p.done);
}

/** Payload for a top-up entry write computed from what's already logged. */
export interface PlanExerciseEntryPayload {
  readonly exerciseId: string;
  readonly variantId?: string;
  /** Value field to write, matching the exercise's measurement. */
  readonly valueField: PlanExerciseValueField;
  readonly value: number;
  /** Breakdown field name (`sets` for reps/weight, `intervals` otherwise). */
  readonly breakdownField: 'sets' | 'intervals';
  readonly breakdown: number[];
}

/**
 * Entry payload that brings a plan item up to its target, or null when
 * it's already covered (or not writable — an unresolvable exercise, a
 * weight-measured one whose load the plan doesn't prescribe).
 *
 * With nothing logged yet, the prescribed breakdown is preserved. With a
 * partial amount logged, the remainder goes in as a single set/interval —
 * we don't second-guess how the user split the rest.
 */
export function planExerciseEntryPayload(
  exercise: TrainingPlanExercise,
  alreadyLogged: number
): PlanExerciseEntryPayload | null {
  const measurement = planExerciseMeasurement(exercise);
  if (!measurement || measurement === 'weight') return null;
  if (exercise.target <= 0 || alreadyLogged >= exercise.target) return null;
  const remaining = exercise.target - alreadyLogged;
  const full = alreadyLogged === 0;
  return {
    exerciseId: exercise.exerciseId,
    ...(exercise.variantId ? { variantId: exercise.variantId } : {}),
    valueField: measurementValueField(measurement),
    value: full ? exercise.target : remaining,
    breakdownField: entryBreakdownField(measurement),
    breakdown: full ? (exercise.sets ?? [exercise.target]) : [remaining],
  };
}
