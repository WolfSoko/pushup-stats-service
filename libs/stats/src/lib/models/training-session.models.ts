import { findExerciseDefinition } from './exercise.catalog';
import { TrainingPlanExercise } from './training-plan.models';
import { PlanExerciseProgress } from './training-plan-exercise.models';

/**
 * A guided training session walks the exercises of one plan day one at a
 * time, hands each to the capture tool that fits its measurement, and
 * rests in between. The step list is derived from the same
 * {@link PlanExerciseProgress} the plan detail page renders, so a session
 * never invents state: finishing a step is an ordinary entry write and
 * the day closes through the existing fulfillment path.
 */

/** Rest between two exercises, in seconds, when the user hasn't chosen. */
export const SESSION_REST_DEFAULT_SEC = 60;
export const SESSION_REST_MIN_SEC = 0;
export const SESSION_REST_MAX_SEC = 300;
/** Granularity of the rest stepper in the session UI. */
export const SESSION_REST_STEP_SEC = 15;

/**
 * How a session orders the exercises of a day.
 *
 * - `'sequential'` — finish one exercise completely, then the next.
 * - `'circuit'` — one set of every exercise, then round two, and so on
 *   ("Zirkeltraining"). See `training-session-circuit.models.ts`.
 */
export type SessionMode = 'sequential' | 'circuit';

export const SESSION_MODE_DEFAULT: SessionMode = 'sequential';

/** Coerce a persisted config value — user data, so anything — to a mode. */
export function normalizeSessionMode(value: unknown): SessionMode {
  return value === 'circuit' ? 'circuit' : SESSION_MODE_DEFAULT;
}

/**
 * Capture tool a step offers as its primary action.
 *
 * - `'auto-count'` — the camera rep counter, for rep exercises the
 *   catalog gives an `autoCountProfileId`.
 * - `'hold-timer'` — the hold timer, for isometric holds with a
 *   `holdTimerProfileId`.
 * - `'manual'` — everything else: the prefilled entry dialog.
 */
export type SessionToolKind = 'auto-count' | 'hold-timer' | 'manual';

/** One exercise of the day, as the session walks it. */
export interface SessionStep {
  /** 0-based position inside the day's exercise list — the item index
   *  every `TrainingPlanStore` per-exercise method takes. */
  itemIndex: number;
  /**
   * The prescription this step captures against. In circuit mode this
   * is the plan item narrowed to the rounds walked so far, so every
   * consumer that reads `target`/`sets` off it — the entry prefill above
   * all — sees the round's portion instead of the whole day.
   */
  exercise: TrainingPlanExercise;
  tool: SessionToolKind;
  /** Target in the exercise's own unit that closes the step; 0 for
   *  unquantified items. Cumulative across rounds in circuit mode. */
  target: number;
  /** Amount already logged towards it today. */
  logged: number;
  /** False for items the plan names but doesn't quantify (HIIT rounds). */
  quantified: boolean;
  done: boolean;
  /** 0-based round this step belongs to; always 0 in sequential mode. */
  roundIndex: number;
  /** Rounds the whole session walks; 1 in sequential mode. */
  roundTotal: number;
  /** What this step alone asks for. Equals `target` sequentially. */
  roundTarget: number;
  /** True when closing this step closes its plan item for the day. */
  finalRound: boolean;
}

/**
 * Which capture tool fits an exercise. Branches on the catalog's
 * `measurement` first and only then on the profile ids, so a definition
 * that ever carries both profiles still routes to the tool that matches
 * how the exercise is actually measured.
 */
export function sessionToolFor(
  exercise: Pick<TrainingPlanExercise, 'exerciseId'>
): SessionToolKind {
  const def = findExerciseDefinition(exercise.exerciseId);
  if (!def) return 'manual';
  if (def.measurement === 'time' && def.holdTimerProfileId) {
    return 'hold-timer';
  }
  if (def.measurement === 'reps' && def.autoCountProfileId) {
    return 'auto-count';
  }
  return 'manual';
}

/** The day's exercises as session steps, in prescription order. */
export function buildSessionSteps(
  progress: ReadonlyArray<PlanExerciseProgress>
): ReadonlyArray<SessionStep> {
  return progress.map((item) => ({
    itemIndex: item.itemIndex,
    exercise: item.exercise,
    tool: sessionToolFor(item.exercise),
    target: item.exercise.target,
    logged: item.logged,
    quantified: item.exercise.target > 0,
    done: item.done,
    roundIndex: 0,
    roundTotal: 1,
    roundTarget: item.exercise.target,
    finalRound: true,
  }));
}

/**
 * Position of the first step that still needs work, at or after `from`.
 * Returns `-1` when the rest of the list is done — the session's signal
 * that there is nothing left to advance to.
 */
export function firstOpenStepIndex(
  steps: ReadonlyArray<SessionStep>,
  from = 0
): number {
  for (let i = Math.max(0, from); i < steps.length; i++) {
    if (!steps[i].done) return i;
  }
  return -1;
}

/** How many steps of the session are closed, for the header progress. */
export function sessionStepsDone(steps: ReadonlyArray<SessionStep>): number {
  return steps.filter((s) => s.done).length;
}

/**
 * Clamp a rest duration into the supported range, rejecting non-finite
 * input. A persisted config value is user data and may be anything.
 */
export function normalizeRestSec(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return SESSION_REST_DEFAULT_SEC;
  }
  const rounded = Math.round(value);
  if (rounded < SESSION_REST_MIN_SEC) return SESSION_REST_MIN_SEC;
  if (rounded > SESSION_REST_MAX_SEC) return SESSION_REST_MAX_SEC;
  return rounded;
}

/**
 * Whether a captured amount closes the step. Capture tools report what
 * the user actually did, which may fall short of the target — the step
 * then stays open at its new partial progress instead of advancing.
 */
export function stepCoveredBy(step: SessionStep, captured: number): boolean {
  if (!step.quantified) return true;
  return step.logged + captured >= step.target;
}
