import {
  AUTO_COUNT_QUICK_ADD_EXERCISE_IDS,
  cameraCountableExercises,
  captureMethodsFor,
  isAutoCountQuickAddExerciseId,
  supportsCameraCount,
  supportsCaptureMethod,
} from './exercise-capture.models';

describe('captureMethodsFor', () => {
  it('should offer both camera detectors for a rep exercise with a pose profile and the proximity flag', () => {
    // given / when
    const methods = captureMethodsFor({
      measurement: 'reps',
      autoCountProfileId: 'pushup',
      proximityCountable: true,
    });

    // then
    expect(methods).toEqual(['pose', 'proximity', 'manual']);
  });

  it('should offer only the proximity detector for a rep exercise without a pose profile', () => {
    // given / when
    const methods = captureMethodsFor({
      measurement: 'reps',
      proximityCountable: true,
    });

    // then
    expect(methods).toEqual(['proximity', 'manual']);
  });

  it('should offer the hold timer before the stopwatch for a hold, the stopwatch alone otherwise', () => {
    // given / when / then
    expect(
      captureMethodsFor({ measurement: 'time', holdTimerProfileId: 'plank' })
    ).toEqual(['hold-timer', 'stopwatch', 'manual']);
    expect(captureMethodsFor({ measurement: 'time' })).toEqual([
      'stopwatch',
      'manual',
    ]);
  });

  it('should leave distance-time exercises on manual entry', () => {
    // given / when / then
    expect(captureMethodsFor({ measurement: 'distance-time' })).toEqual([
      'manual',
    ]);
  });
});

describe('supportsCaptureMethod / supportsCameraCount', () => {
  it('should resolve catalog ids through their flags', () => {
    // given / when / then
    expect(supportsCaptureMethod('pushup', 'pose')).toBe(true);
    expect(supportsCaptureMethod('pushup', 'proximity')).toBe(true);
    expect(supportsCaptureMethod('abs.situps', 'proximity')).toBe(false);
    expect(supportsCaptureMethod('cardio.burpees', 'pose')).toBe(false);
    expect(supportsCameraCount('cardio.burpees')).toBe(true);
    expect(supportsCameraCount('abs.russiantwist')).toBe(false);
    expect(supportsCameraCount('plank.standard')).toBe(false);
  });

  it('should treat an unknown id as manual-only', () => {
    // given / when / then
    expect(supportsCaptureMethod('nope', 'manual')).toBe(true);
    expect(supportsCaptureMethod('nope', 'pose')).toBe(false);
    expect(supportsCameraCount(undefined)).toBe(false);
  });
});

describe('cameraCountableExercises', () => {
  it('should list every rep exercise with a pose profile or the proximity flag, pushups included', () => {
    // given / when
    const ids = cameraCountableExercises().map((d) => d.id);

    // then
    expect(ids).toContain('pushup');
    expect(ids).toContain('abs.situps');
    expect(ids).toContain('cardio.burpees');
    expect(ids).not.toContain('abs.russiantwist');
    expect(ids).not.toContain('plank.standard');
    expect([...AUTO_COUNT_QUICK_ADD_EXERCISE_IDS]).toEqual(ids);
    expect(isAutoCountQuickAddExerciseId('cardio.burpees')).toBe(true);
    expect(isAutoCountQuickAddExerciseId('abs.russiantwist')).toBe(false);
    expect(isAutoCountQuickAddExerciseId(null)).toBe(false);
  });
});
