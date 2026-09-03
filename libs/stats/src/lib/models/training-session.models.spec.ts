import {
  buildSessionSteps,
  firstOpenStepIndex,
  normalizeRestSec,
  normalizeSessionMode,
  SESSION_REST_DEFAULT_SEC,
  SESSION_REST_MAX_SEC,
  SESSION_REST_MIN_SEC,
  sessionStepsDone,
  sessionToolFor,
  SessionStep,
  stepCoveredBy,
} from './training-session.models';
import { PlanExerciseProgress } from './training-plan-exercise.models';
import { TrainingPlanExercise } from './training-plan.models';

function progress(
  overrides: Partial<PlanExerciseProgress> & {
    exercise: TrainingPlanExercise;
    itemIndex: number;
  }
): PlanExerciseProgress {
  return {
    logged: 0,
    fulfilledByEntries: false,
    checkedOff: false,
    done: false,
    ...overrides,
  };
}

function step(overrides: Partial<SessionStep> = {}): SessionStep {
  return {
    itemIndex: 0,
    exercise: { exerciseId: 'pushup', target: 10 },
    tool: 'auto-count',
    target: 10,
    logged: 0,
    quantified: true,
    done: false,
    roundIndex: 0,
    roundTotal: 1,
    roundTarget: 10,
    finalRound: true,
    ...overrides,
  };
}

describe('normalizeSessionMode', () => {
  it('should keep an explicit sequential choice', () => {
    // given / when / then
    expect(normalizeSessionMode('sequential')).toBe('sequential');
  });

  it('should default to the circuit for anything else', () => {
    // given / when / then
    expect(normalizeSessionMode('circuit')).toBe('circuit');
    expect(normalizeSessionMode(undefined)).toBe('circuit');
    expect(normalizeSessionMode('zirkel')).toBe('circuit');
    expect(normalizeSessionMode(3)).toBe('circuit');
  });
});

describe('sessionToolFor', () => {
  it('should route a rep exercise with a detector profile to the camera counter', () => {
    // given / when
    const tool = sessionToolFor({ exerciseId: 'legs.squats' });

    // then
    expect(tool).toBe('auto-count');
  });

  it('should route pushups to the camera counter', () => {
    // given / when
    const tool = sessionToolFor({ exerciseId: 'pushup' });

    // then
    expect(tool).toBe('auto-count');
  });

  it('should route a proximity-only exercise to the camera counter as well', () => {
    // given / when
    const tool = sessionToolFor({ exerciseId: 'cardio.burpees' });

    // then
    expect(tool).toBe('auto-count');
  });

  it('should route an isometric hold to the hold timer', () => {
    // given / when
    const tool = sessionToolFor({ exerciseId: 'plank.standard' });

    // then
    expect(tool).toBe('hold-timer');
  });

  it('should route a timed exercise without a hold profile to the stopwatch', () => {
    // given / when
    const climbers = sessionToolFor({
      exerciseId: 'core.mountainclimbers.time',
    });
    const wallsit = sessionToolFor({ exerciseId: 'squat.wallsit' });

    // then
    expect(climbers).toBe('stopwatch');
    expect(wallsit).toBe('stopwatch');
  });

  it('should fall back to manual entry for an exercise without a profile', () => {
    // given / when
    const tool = sessionToolFor({ exerciseId: 'abs.russiantwist' });

    // then
    expect(tool).toBe('manual');
  });

  it('should fall back to manual entry for an unresolvable exercise', () => {
    // given / when
    const tool = sessionToolFor({ exerciseId: 'not.a.real.exercise' });

    // then
    expect(tool).toBe('manual');
  });
});

describe('buildSessionSteps', () => {
  it('should map each exercise of the day onto a step with its tool and progress', () => {
    // given
    const items = [
      progress({
        itemIndex: 0,
        exercise: { exerciseId: 'plank.standard', target: 50 },
        logged: 20,
      }),
      progress({
        itemIndex: 1,
        exercise: { exerciseId: 'abs.russiantwist', target: 20 },
      }),
      progress({
        itemIndex: 2,
        exercise: { exerciseId: 'pushup', target: 15 },
        done: true,
      }),
    ];

    // when
    const steps = buildSessionSteps(items);

    // then
    expect(steps).toEqual([
      {
        itemIndex: 0,
        exercise: { exerciseId: 'plank.standard', target: 50 },
        tool: 'hold-timer',
        target: 50,
        logged: 20,
        quantified: true,
        done: false,
        roundIndex: 0,
        roundTotal: 1,
        roundTarget: 50,
        finalRound: true,
      },
      {
        itemIndex: 1,
        exercise: { exerciseId: 'abs.russiantwist', target: 20 },
        tool: 'manual',
        target: 20,
        logged: 0,
        quantified: true,
        done: false,
        roundIndex: 0,
        roundTotal: 1,
        roundTarget: 20,
        finalRound: true,
      },
      {
        itemIndex: 2,
        exercise: { exerciseId: 'pushup', target: 15 },
        tool: 'auto-count',
        target: 15,
        logged: 0,
        quantified: true,
        done: true,
        roundIndex: 0,
        roundTotal: 1,
        roundTarget: 15,
        finalRound: true,
      },
    ]);
  });

  it('should mark an unquantified item as not quantified', () => {
    // given
    const items = [
      progress({ itemIndex: 0, exercise: { exerciseId: 'pushup', target: 0 } }),
    ];

    // when
    const steps = buildSessionSteps(items);

    // then
    expect(steps[0].quantified).toBe(false);
  });

  it('should return an empty list for a day with no exercises', () => {
    // given / when
    const steps = buildSessionSteps([]);

    // then
    expect(steps).toEqual([]);
  });
});

describe('firstOpenStepIndex', () => {
  it('should return the first step that is not done', () => {
    // given
    const steps = [step({ done: true }), step({ itemIndex: 1 })];

    // when / then
    expect(firstOpenStepIndex(steps)).toBe(1);
  });

  it('should start the search at the given offset', () => {
    // given
    const steps = [step(), step({ itemIndex: 1 }), step({ itemIndex: 2 })];

    // when / then
    expect(firstOpenStepIndex(steps, 2)).toBe(2);
  });

  it('should clamp a negative offset to the start of the list', () => {
    // given
    const steps = [step()];

    // when / then
    expect(firstOpenStepIndex(steps, -5)).toBe(0);
  });

  it('should return -1 when every remaining step is done', () => {
    // given
    const steps = [step({ done: true }), step({ itemIndex: 1, done: true })];

    // when / then
    expect(firstOpenStepIndex(steps)).toBe(-1);
  });

  it('should return -1 for an empty list', () => {
    // given / when / then
    expect(firstOpenStepIndex([])).toBe(-1);
  });
});

describe('sessionStepsDone', () => {
  it('should count the closed steps', () => {
    // given
    const steps = [
      step({ done: true }),
      step({ itemIndex: 1 }),
      step({ itemIndex: 2, done: true }),
    ];

    // when / then
    expect(sessionStepsDone(steps)).toBe(2);
  });
});

describe('normalizeRestSec', () => {
  it('should keep a value inside the supported range', () => {
    // given / when / then
    expect(normalizeRestSec(90)).toBe(90);
  });

  it('should round a fractional value', () => {
    // given / when / then
    expect(normalizeRestSec(45.6)).toBe(46);
  });

  it('should clamp below the minimum', () => {
    // given / when / then
    expect(normalizeRestSec(-10)).toBe(SESSION_REST_MIN_SEC);
  });

  it('should clamp above the maximum', () => {
    // given / when / then
    expect(normalizeRestSec(9999)).toBe(SESSION_REST_MAX_SEC);
  });

  it('should fall back to the default for a missing value', () => {
    // given / when / then
    expect(normalizeRestSec(undefined)).toBe(SESSION_REST_DEFAULT_SEC);
  });

  it('should fall back to the default for a non-numeric persisted value', () => {
    // given / when / then
    expect(normalizeRestSec('60')).toBe(SESSION_REST_DEFAULT_SEC);
  });

  it('should fall back to the default for NaN', () => {
    // given / when / then
    expect(normalizeRestSec(Number.NaN)).toBe(SESSION_REST_DEFAULT_SEC);
  });
});

describe('stepCoveredBy', () => {
  it('should close the step when the capture reaches the target', () => {
    // given
    const s = step({ target: 15, logged: 0 });

    // when / then
    expect(stepCoveredBy(s, 15)).toBe(true);
  });

  it('should close the step when the capture tops up earlier progress', () => {
    // given
    const s = step({ target: 15, logged: 10 });

    // when / then
    expect(stepCoveredBy(s, 5)).toBe(true);
  });

  it('should leave the step open when the capture falls short', () => {
    // given
    const s = step({ target: 15, logged: 0 });

    // when / then
    expect(stepCoveredBy(s, 12)).toBe(false);
  });

  it('should close an unquantified step on any capture', () => {
    // given
    const s = step({ target: 0, quantified: false });

    // when / then
    expect(stepCoveredBy(s, 0)).toBe(true);
  });
});
