import {
  autoCountProfileForCatalogId,
  buildAutoCountPrefill,
  buildConfirmedEntryPayload,
  buildExerciseEntryPayload,
  catalogIdForAutoCountProfile,
  catalogIdForHoldTimerProfile,
  isAutoCountProfile,
} from './quick-add-orchestration.helpers';
import type {
  AutoCountResult,
  ExerciseEntryDialogResult,
  PushupEntryDialogResult,
  TrainingEntryDialogResult,
} from './quick-add-orchestration.models';

describe('catalogIdForAutoCountProfile', () => {
  it('should map the pushup profile to the legacy sentinel id', () => {
    // given / when
    const result = catalogIdForAutoCountProfile('pushup');

    // then
    expect(result).toBe('pushup');
  });

  it('should resolve a catalog-backed profile to its catalog id', () => {
    // given / when / then
    expect(catalogIdForAutoCountProfile('squat')).toBe('legs.squats');
    expect(catalogIdForAutoCountProfile('pullup')).toBe('pull.pullups');
    expect(catalogIdForAutoCountProfile('situp')).toBe('abs.situps');
  });
});

describe('isAutoCountProfile', () => {
  it('should accept every known detector profile', () => {
    // given
    const profiles = ['pushup', 'squat', 'pullup', 'situp'];

    // when / then
    expect(profiles.every((p) => isAutoCountProfile(p))).toBe(true);
  });

  it('should reject unknown and undefined values', () => {
    // given / when / then
    expect(isAutoCountProfile('plank')).toBe(false);
    expect(isAutoCountProfile('')).toBe(false);
    expect(isAutoCountProfile(undefined)).toBe(false);
  });
});

describe('autoCountProfileForCatalogId', () => {
  it('should return the pushup profile for the legacy sentinel id', () => {
    // given / when / then
    expect(autoCountProfileForCatalogId('pushup')).toBe('pushup');
  });

  it('should round-trip a catalog id back to its detector profile', () => {
    // given / when / then
    expect(autoCountProfileForCatalogId('legs.squats')).toBe('squat');
    expect(autoCountProfileForCatalogId('pull.pullups')).toBe('pullup');
    expect(autoCountProfileForCatalogId('abs.situps')).toBe('situp');
  });

  it('should fail closed (null) for an id without a valid detector profile', () => {
    // given: plank has a hold-timer profile but no auto-count profile
    // when / then
    expect(autoCountProfileForCatalogId('plank.standard')).toBeNull();
    expect(autoCountProfileForCatalogId('does.not-exist')).toBeNull();
  });
});

describe('catalogIdForHoldTimerProfile', () => {
  it('should resolve a hold-timer profile to its catalog id', () => {
    // given / when / then
    expect(catalogIdForHoldTimerProfile('plank')).toBe('plank.standard');
    expect(catalogIdForHoldTimerProfile('hollowhold')).toBe('core.hollowhold');
  });
});

describe('buildAutoCountPrefill', () => {
  it('should build a pushup prefill for a pushup auto-count result', () => {
    // given
    const result: AutoCountResult = { exerciseId: 'pushup', reps: 12 };

    // when
    const prefill = buildAutoCountPrefill(result);

    // then
    expect(prefill).toMatchObject({
      kind: 'pushup',
      reps: 12,
      sets: [12],
      source: 'auto-count',
      type: 'standard',
    });
    expect(typeof (prefill as { timestamp: string }).timestamp).toBe('string');
  });

  it('should build an exercise prefill resolving the catalog id', () => {
    // given
    const result: AutoCountResult = { exerciseId: 'squat', reps: 8 };

    // when
    const prefill = buildAutoCountPrefill(result);

    // then
    expect(prefill).toMatchObject({
      kind: 'exercise',
      exerciseId: 'legs.squats',
      reps: 8,
      sets: [8],
    });
  });

  it('should return null when the profile has no catalog id', () => {
    // given: an unmapped profile value smuggled past the type
    const result = {
      exerciseId: 'plank',
      reps: 5,
    } as unknown as AutoCountResult;

    // when / then
    expect(buildAutoCountPrefill(result)).toBeNull();
  });
});

describe('buildExerciseEntryPayload', () => {
  const base: ExerciseEntryDialogResult = {
    kind: 'exercise',
    timestamp: '2026-05-14T10:00:00+02:00',
    exerciseId: 'legs.squats',
    measurement: 'reps',
    reps: 9,
    sets: [9],
    intervals: [],
  };

  it('should forward reps and omit single-set arrays', () => {
    // given / when
    const payload = buildExerciseEntryPayload(base, 'auto-count');

    // then
    expect(payload).toMatchObject({
      exerciseId: 'legs.squats',
      reps: 9,
      source: 'auto-count',
    });
    expect(payload.sets).toBeUndefined();
  });

  it('should keep multi-set arrays', () => {
    // given
    const result: ExerciseEntryDialogResult = { ...base, sets: [5, 4] };

    // when
    const payload = buildExerciseEntryPayload(result, 'web');

    // then
    expect(payload.sets).toEqual([5, 4]);
  });

  it('should attach variantId only when present', () => {
    // given / when / then
    expect(
      buildExerciseEntryPayload({ ...base, variantId: 'bodyweight' }, 'web')
        .variantId
    ).toBe('bodyweight');
    expect(buildExerciseEntryPayload(base, 'web').variantId).toBeUndefined();
  });

  it('should forward durationSec for time measurement and drop reps', () => {
    // given
    const result: ExerciseEntryDialogResult = {
      ...base,
      exerciseId: 'plank.standard',
      measurement: 'time',
      durationSec: 45,
    };

    // when
    const payload = buildExerciseEntryPayload(result, 'exercise-timer');

    // then
    expect(payload.durationSec).toBe(45);
    expect(payload.reps).toBeUndefined();
    expect(payload.sets).toBeUndefined();
  });

  it('should default a missing durationSec to 0 for time measurement', () => {
    // given
    const result: ExerciseEntryDialogResult = {
      ...base,
      measurement: 'time',
      durationSec: undefined,
    };

    // when
    const payload = buildExerciseEntryPayload(result, 'web');

    // then
    expect(payload.durationSec).toBe(0);
  });

  it('should forward both distanceM and durationSec for distance-time', () => {
    // given
    const result: ExerciseEntryDialogResult = {
      ...base,
      exerciseId: 'cardio.running',
      measurement: 'distance-time',
      distanceM: 5000,
      durationSec: 1800,
    };

    // when
    const payload = buildExerciseEntryPayload(result, 'web');

    // then
    expect(payload).toMatchObject({ distanceM: 5000, durationSec: 1800 });
    expect(payload.reps).toBeUndefined();
  });

  it('should default missing distance-time fields to 0', () => {
    // given
    const result: ExerciseEntryDialogResult = {
      ...base,
      measurement: 'distance-time',
      distanceM: undefined,
      durationSec: undefined,
    };

    // when
    const payload = buildExerciseEntryPayload(result, 'web');

    // then
    expect(payload).toMatchObject({ distanceM: 0, durationSec: 0 });
  });
});

describe('buildConfirmedEntryPayload', () => {
  it('should keep the dialog-supplied source for a pushup result', () => {
    // given
    const result: PushupEntryDialogResult = {
      kind: 'pushup',
      timestamp: '2026-05-14T10:00:00+02:00',
      reps: 15,
      sets: [15],
      source: 'auto-count',
      type: 'standard',
    };

    // when
    const payload = buildConfirmedEntryPayload(result, 'ignored');

    // then
    expect(payload).toEqual({
      exerciseId: 'pushup',
      timestamp: '2026-05-14T10:00:00+02:00',
      reps: 15,
      sets: [15],
      source: 'auto-count',
    });
  });

  it('should delegate to the exercise payload builder for exercise results', () => {
    // given
    const result: TrainingEntryDialogResult = {
      kind: 'exercise',
      timestamp: '2026-05-14T10:00:00+02:00',
      exerciseId: 'legs.squats',
      measurement: 'reps',
      reps: 9,
      sets: [9],
      intervals: [],
    };

    // when
    const payload = buildConfirmedEntryPayload(result, 'exercise-timer');

    // then
    expect(payload).toMatchObject({
      exerciseId: 'legs.squats',
      reps: 9,
      source: 'exercise-timer',
    });
  });
});
