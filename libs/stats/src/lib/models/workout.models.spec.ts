import { planDayProgress } from './training-plan-exercise.models';
import {
  MAX_WORKOUTS,
  normalizeWorkout,
  Workout,
  WORKOUT_MAX_EXERCISES,
  WORKOUT_TITLE_MAX,
  workoutExerciseRejection,
  workoutRejection,
  workoutToPlanDay,
} from './workout.models';

const VALID = {
  title: 'Ganzkörper kurz',
  description: 'Drei Runden',
  exercises: [
    { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
    { exerciseId: 'plank.standard', target: 60 },
    { exerciseId: 'legs.squats', target: 40, variantId: 'bodyweight' },
  ],
  onProfile: false,
};

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'w1',
    ownerId: 'owner',
    ...VALID,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('workoutRejection', () => {
  it('should accept a workout of catalog exercises with targets', () => {
    expect(workoutRejection(VALID, { count: 0 })).toBeNull();
  });

  it.each([
    ['', 'title'],
    ['   ', 'title'],
    ['x'.repeat(WORKOUT_TITLE_MAX + 1), 'title'],
  ])('should refuse the title %j', (title, expected) => {
    expect(workoutRejection({ ...VALID, title }, { count: 0 })).toBe(expected);
  });

  it('should refuse a description that is not a string', () => {
    expect(workoutRejection({ ...VALID, description: 42 }, { count: 0 })).toBe(
      'description'
    );
  });

  it('should require at least one exercise and cap the list', () => {
    expect(workoutRejection({ ...VALID, exercises: [] }, { count: 0 })).toBe(
      'no-exercises'
    );
    const many = Array.from({ length: WORKOUT_MAX_EXERCISES + 1 }, () => ({
      exerciseId: 'pushup',
      target: 5,
    }));
    expect(workoutRejection({ ...VALID, exercises: many }, { count: 0 })).toBe(
      'too-many-exercises'
    );
  });

  it('should refuse the workout once the owner keeps the maximum', () => {
    // then — the count is what the owner already has, so the limit
    // itself is the first refused number
    expect(workoutRejection(VALID, { count: MAX_WORKOUTS })).toBe('limit');
    expect(workoutRejection(VALID, { count: MAX_WORKOUTS - 1 })).toBeNull();
  });

  it('should treat a non-object as a missing title', () => {
    expect(workoutRejection(null, { count: 0 })).toBe('title');
  });
});

describe('workoutExerciseRejection', () => {
  it('should refuse an exercise the catalog does not know', () => {
    expect(workoutExerciseRejection({ exerciseId: 'nope', target: 10 })).toBe(
      'exercise'
    );
  });

  it('should refuse a variant the exercise does not have', () => {
    expect(
      workoutExerciseRejection({
        exerciseId: 'legs.squats',
        variantId: 'invented',
        target: 10,
      })
    ).toBe('exercise');
  });

  it('should let pushups carry a free-text variant', () => {
    // then — the pushup picker is an autocomplete, so its variants are
    // whatever the user typed
    expect(
      workoutExerciseRejection({
        exerciseId: 'pushup',
        variantId: 'archer',
        target: 10,
      })
    ).toBeNull();
  });

  it.each([[0], [-1], [1.5], ['10'], [10_001]])(
    'should refuse the target %j',
    (target) => {
      expect(workoutExerciseRejection({ exerciseId: 'pushup', target })).toBe(
        'target'
      );
    }
  );

  it('should cap a timed target at the rule backstop', () => {
    expect(
      workoutExerciseRejection({ exerciseId: 'plank.standard', target: 7_201 })
    ).toBe('target');
    expect(
      workoutExerciseRejection({ exerciseId: 'plank.standard', target: 7_200 })
    ).toBeNull();
  });

  it('should require sets to sum to the target', () => {
    expect(
      workoutExerciseRejection({
        exerciseId: 'pushup',
        target: 30,
        sets: [10, 10],
      })
    ).toBe('sets');
    expect(
      workoutExerciseRejection({
        exerciseId: 'pushup',
        target: 30,
        sets: [10, 0, 20],
      })
    ).toBe('sets');
    expect(
      workoutExerciseRejection({ exerciseId: 'pushup', target: 30, sets: [] })
    ).toBe('sets');
  });
});

describe('normalizeWorkout', () => {
  it('should read a valid document back, dropping unknown fields', () => {
    // given
    const raw = {
      ...VALID,
      ownerId: 'owner',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
      surprise: 'field',
      sharedBy: { uid: 'friend', workoutId: 'src', displayName: 'Anna' },
    };

    // when
    const result = normalizeWorkout('w1', raw);

    // then
    expect(result).toEqual({
      id: 'w1',
      ownerId: 'owner',
      ...VALID,
      sharedBy: { uid: 'friend', workoutId: 'src', displayName: 'Anna' },
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    });
    expect(result).not.toHaveProperty('surprise');
  });

  it('should return null for a document that does not validate', () => {
    // then — the owner can write anything into their own document, and
    // a visitor's page must not break on it
    expect(
      normalizeWorkout('w1', { ...VALID, ownerId: 'owner', exercises: [] })
    ).toBeNull();
    expect(normalizeWorkout('w1', { ...VALID })).toBeNull();
    expect(normalizeWorkout('w1', 'nope')).toBeNull();
  });

  it('should drop a malformed source rather than the workout', () => {
    const result = normalizeWorkout('w1', {
      ...VALID,
      ownerId: 'owner',
      sharedBy: { uid: 42 },
    });
    expect(result?.sharedBy).toBeUndefined();
  });
});

describe('workoutToPlanDay', () => {
  it('should present the workout as day one of a plan', () => {
    // when
    const day = workoutToPlanDay(workout());

    // then — pushups make up `targetReps`, everything is listed
    expect(day.dayIndex).toBe(1);
    expect(day.kind).toBe('main');
    expect(day.targetReps).toBe(30);
    expect(day.exercises).toBe(VALID.exercises);
    expect(day.description).toBe('Drei Runden');
  });

  it('should return the same day object for the same workout', () => {
    const w = workout();
    expect(workoutToPlanDay(w)).toBe(workoutToPlanDay(w));
  });

  it('should be walkable by the plan fulfillment layer', () => {
    // given — a plank entry after the session started
    const progress = planDayProgress(workoutToPlanDay(workout()), 1, {
      entries: [
        {
          exerciseId: 'plank.standard',
          durationSec: 60,
          timestamp: '2026-09-05T10:30:00+02:00',
        },
      ],
      dateIso: '2026-09-05',
      completedItems: [],
      dayActivatedAt: '2026-09-05T10:00:00+02:00',
    });

    // then
    expect(progress.map((p) => p.done)).toEqual([false, true, false]);
  });
});
