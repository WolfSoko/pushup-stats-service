import {
  planExerciseEntryPayload,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  SessionStep,
  type ExerciseEntryCreate,
} from '@pu-stats/models';

import type {
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../../core/quick-add-orchestration.models';

/** Attribution every entry a guided session produces carries. */
export const SESSION_ENTRY_SOURCE = 'plan-session';

/**
 * Dialog prefill for a step's manual entry: the amount that would bring
 * the exercise up to its prescribed target, split the way the plan
 * prescribes it.
 *
 * Steps the plan doesn't quantify (HIIT rounds) and steps already
 * covered have no top-up to compute — they still open the dialog, just
 * empty, because the user may want to record what they actually did.
 */
export function entryPrefillForStep(
  step: SessionStep,
  timestamp: string
): TrainingEntryDialogData {
  const { exercise } = step;
  const isPushup = exercise.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID;
  const payload = planExerciseEntryPayload(exercise, step.logged);

  if (isPushup) {
    return {
      kind: 'pushup',
      timestamp,
      source: SESSION_ENTRY_SOURCE,
      ...(exercise.variantId ? { type: exercise.variantId } : {}),
      ...(payload ? { reps: payload.value, sets: [...payload.breakdown] } : {}),
    };
  }

  const base: TrainingEntryDialogData = {
    kind: 'exercise',
    timestamp,
    exerciseId: exercise.exerciseId,
    ...(exercise.variantId ? { variantId: exercise.variantId } : {}),
  };
  if (!payload) return base;

  const breakdown = [...payload.breakdown];
  switch (payload.valueField) {
    case 'reps':
      return { ...base, reps: payload.value, sets: breakdown };
    case 'durationSec':
      return { ...base, durationSec: payload.value, intervals: breakdown };
    case 'distanceM':
      return { ...base, distanceM: payload.value, intervals: breakdown };
    default:
      return base;
  }
}

/** A prescribed entry ready to write, plus what it contributes to the step. */
export interface PrescribedCapture {
  entry: ExerciseEntryCreate;
  value: number;
}

/**
 * Entry that writes exactly what a step still needs of its prescription,
 * with no dialog in between — the "wie vorgegeben" tap for a circuit
 * round, which must not tick the plan item off while later rounds of the
 * same exercise are still to come.
 *
 * Null when there is nothing left to write (the step is already covered,
 * or the plan doesn't quantify it).
 */
export function prescribedCaptureFor(
  step: SessionStep,
  timestamp: string
): PrescribedCapture | null {
  const payload = planExerciseEntryPayload(step.exercise, step.logged);
  if (!payload) return null;
  return {
    entry: {
      exerciseId: payload.exerciseId,
      ...(payload.variantId ? { variantId: payload.variantId } : {}),
      timestamp,
      source: SESSION_ENTRY_SOURCE,
      [payload.valueField]: payload.value,
      [payload.breakdownField]: payload.breakdown,
    } as ExerciseEntryCreate,
    value: payload.value,
  };
}

/**
 * Entry for a counted or timed capture. Writes what the tool measured —
 * not the prescription — so a set that fell three reps short is recorded
 * as what it was and leaves the step open at its real progress.
 */
export function captureEntryPayload(args: {
  exerciseId: string;
  variantId?: string;
  timestamp: string;
  /** `'reps'` for the rep counter, `'durationSec'` for the hold timer. */
  valueField: 'reps' | 'durationSec';
  value: number;
}): ExerciseEntryCreate {
  const base: ExerciseEntryCreate = {
    exerciseId: args.exerciseId,
    timestamp: args.timestamp,
    source: SESSION_ENTRY_SOURCE,
    ...(args.variantId ? { variantId: args.variantId } : {}),
  };
  return args.valueField === 'reps'
    ? { ...base, reps: args.value, sets: [args.value] }
    : { ...base, durationSec: args.value, intervals: [args.value] };
}

/**
 * How much of a dialog result counts towards the step that opened it.
 *
 * The entry dialog lets the user switch exercise mid-flow, and the
 * camera and timer dialogs both carry their own exercise toggle. What
 * the user logged is always written as-is; only an entry for the step's
 * own exercise moves that step forward, so a squat logged during a
 * pushup step is saved and still leaves the pushups open.
 */
export function stepValueFromDialogResult(
  step: SessionStep,
  result: TrainingEntryDialogResult
): number {
  if (result.kind === 'pushup') {
    return step.exercise.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID
      ? result.reps
      : 0;
  }
  if (result.exerciseId !== step.exercise.exerciseId) return 0;
  switch (result.measurement) {
    case 'time':
      return result.durationSec ?? 0;
    case 'distance':
    case 'distance-time':
      return result.distanceM ?? 0;
    default:
      return result.reps;
  }
}
