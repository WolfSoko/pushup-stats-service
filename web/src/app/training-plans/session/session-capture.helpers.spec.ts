import type { SessionStep } from '@pu-stats/models';
import { describe, expect, it } from 'vitest';

import {
  captureEntryPayload,
  entryPrefillForStep,
  SESSION_ENTRY_SOURCE,
  stepValueFromDialogResult,
} from './session-capture.helpers';
import type {
  ExerciseEntryDialogResult,
  PushupEntryDialogResult,
} from '../../core/quick-add-orchestration.models';

const TS = '2026-08-24T18:30:00+02:00';

function step(overrides: Partial<SessionStep> = {}): SessionStep {
  return {
    itemIndex: 0,
    exercise: { exerciseId: 'pushup', target: 15, sets: [8, 7] },
    tool: 'auto-count',
    target: 15,
    logged: 0,
    quantified: true,
    done: false,
    roundIndex: 0,
    roundTotal: 1,
    finalRound: true,
    ...overrides,
    // A sequential step always asks for its whole target; deriving it
    // keeps a fixture that overrides `target` internally consistent.
    roundTarget: overrides.roundTarget ?? overrides.target ?? 15,
  };
}

function exerciseResult(
  overrides: Partial<ExerciseEntryDialogResult> = {}
): ExerciseEntryDialogResult {
  return {
    kind: 'exercise',
    timestamp: TS,
    exerciseId: 'abs.russiantwist',
    measurement: 'reps',
    reps: 20,
    sets: [],
    intervals: [],
    intervalDurationsSec: [],
    ...overrides,
  };
}

describe('entryPrefillForStep', () => {
  it('should prefill a pushup step with the prescribed reps and sets', () => {
    // given
    const s = step();

    // when
    const data = entryPrefillForStep(s, TS);

    // then
    expect(data).toEqual({
      kind: 'pushup',
      timestamp: TS,
      source: SESSION_ENTRY_SOURCE,
      reps: 15,
      sets: [8, 7],
    });
  });

  it('should carry a prescribed pushup variant as the dialog type', () => {
    // given
    const s = step({
      exercise: { exerciseId: 'pushup', target: 10, variantId: 'diamond' },
    });

    // when
    const data = entryPrefillForStep(s, TS);

    // then
    expect(data).toMatchObject({ kind: 'pushup', type: 'diamond' });
  });

  it('should prefill a rep exercise with sets', () => {
    // given
    const s = step({
      exercise: { exerciseId: 'abs.russiantwist', target: 20 },
      tool: 'manual',
      target: 20,
    });

    // when
    const data = entryPrefillForStep(s, TS);

    // then
    expect(data).toEqual({
      kind: 'exercise',
      timestamp: TS,
      exerciseId: 'abs.russiantwist',
      reps: 20,
      sets: [20],
    });
  });

  it('should prefill a hold with its duration as intervals', () => {
    // given
    const s = step({
      exercise: {
        exerciseId: 'plank.standard',
        target: 150,
        sets: [50, 50, 50],
      },
      tool: 'hold-timer',
      target: 150,
    });

    // when
    const data = entryPrefillForStep(s, TS);

    // then
    expect(data).toEqual({
      kind: 'exercise',
      timestamp: TS,
      exerciseId: 'plank.standard',
      durationSec: 150,
      intervals: [50, 50, 50],
    });
  });

  it('should prefill only the remainder when part of the target is logged', () => {
    // given
    const s = step({
      exercise: { exerciseId: 'abs.russiantwist', target: 20 },
      tool: 'manual',
      target: 20,
      logged: 12,
    });

    // when
    const data = entryPrefillForStep(s, TS);

    // then
    expect(data).toMatchObject({ reps: 8, sets: [8] });
  });

  it('should open an empty dialog for an unquantified step', () => {
    // given
    const s = step({
      exercise: { exerciseId: 'abs.russiantwist', target: 0 },
      target: 0,
      quantified: false,
      tool: 'manual',
    });

    // when
    const data = entryPrefillForStep(s, TS);

    // then
    expect(data).toEqual({
      kind: 'exercise',
      timestamp: TS,
      exerciseId: 'abs.russiantwist',
    });
  });

  it('should keep the prescribed variant for a catalog exercise', () => {
    // given
    const s = step({
      exercise: {
        exerciseId: 'abs.russiantwist',
        target: 20,
        variantId: 'weighted',
      },
      tool: 'manual',
      target: 20,
    });

    // when
    const data = entryPrefillForStep(s, TS);

    // then
    expect(data).toMatchObject({ variantId: 'weighted' });
  });
});

describe('captureEntryPayload', () => {
  it('should write a counted capture as reps with a single set', () => {
    // given / when
    const entry = captureEntryPayload({
      exerciseId: 'legs.squats',
      timestamp: TS,
      valueField: 'reps',
      value: 17,
    });

    // then
    expect(entry).toEqual({
      exerciseId: 'legs.squats',
      timestamp: TS,
      source: SESSION_ENTRY_SOURCE,
      reps: 17,
      sets: [17],
    });
  });

  it('should write a timed capture as a duration with a single interval', () => {
    // given / when
    const entry = captureEntryPayload({
      exerciseId: 'plank.standard',
      variantId: 'side',
      timestamp: TS,
      valueField: 'durationSec',
      value: 52,
    });

    // then
    expect(entry).toEqual({
      exerciseId: 'plank.standard',
      variantId: 'side',
      timestamp: TS,
      source: SESSION_ENTRY_SOURCE,
      durationSec: 52,
      intervals: [52],
    });
  });
});

describe('stepValueFromDialogResult', () => {
  it('should credit a pushup result to a pushup step', () => {
    // given
    const result: PushupEntryDialogResult = {
      kind: 'pushup',
      timestamp: TS,
      reps: 15,
      sets: [15],
      source: SESSION_ENTRY_SOURCE,
      type: 'standard',
    };

    // when / then
    expect(stepValueFromDialogResult(step(), result)).toBe(15);
  });

  it('should not credit a pushup result to a step for another exercise', () => {
    // given
    const s = step({ exercise: { exerciseId: 'legs.squats', target: 20 } });
    const result: PushupEntryDialogResult = {
      kind: 'pushup',
      timestamp: TS,
      reps: 15,
      sets: [15],
      source: SESSION_ENTRY_SOURCE,
      type: 'standard',
    };

    // when / then
    expect(stepValueFromDialogResult(s, result)).toBe(0);
  });

  it('should credit reps logged for the step exercise', () => {
    // given
    const s = step({
      exercise: { exerciseId: 'abs.russiantwist', target: 20 },
    });

    // when / then
    expect(stepValueFromDialogResult(s, exerciseResult())).toBe(20);
  });

  it('should credit a duration for a time-measured step', () => {
    // given
    const s = step({ exercise: { exerciseId: 'plank.standard', target: 50 } });
    const result = exerciseResult({
      exerciseId: 'plank.standard',
      measurement: 'time',
      reps: 0,
      durationSec: 50,
    });

    // when / then
    expect(stepValueFromDialogResult(s, result)).toBe(50);
  });

  it('should credit a distance for a distance-measured step', () => {
    // given
    const s = step({
      exercise: { exerciseId: 'cardio.running', target: 1000 },
    });
    const result = exerciseResult({
      exerciseId: 'cardio.running',
      measurement: 'distance-time',
      reps: 0,
      distanceM: 1000,
      durationSec: 300,
    });

    // when / then
    expect(stepValueFromDialogResult(s, result)).toBe(1000);
  });

  it('should credit nothing when the user switched to another exercise', () => {
    // given
    const s = step({
      exercise: { exerciseId: 'abs.russiantwist', target: 20 },
    });
    const result = exerciseResult({ exerciseId: 'legs.squats' });

    // when / then
    expect(stepValueFromDialogResult(s, result)).toBe(0);
  });
});
