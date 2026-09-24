import type { Workout } from '@pu-stats/models';

import {
  emptyForm,
  emptyLine,
  formFromWorkout,
  formToInput,
  lineToExercise,
  parseSets,
  setsTotal,
  targetUnitLabel,
  variantOptions,
  formForExercise,
  isWorkoutExercise,
} from './workout-form';

const WORKOUT: Workout = {
  id: 'w1',
  ownerId: 'u1',
  title: 'Beine',
  description: 'Hart',
  exercises: [
    {
      exerciseId: 'legs.squats',
      target: 30,
      sets: [15, 15],
      variantId: 'bodyweight',
    },
    { exerciseId: 'plank.standard', target: 60 },
  ],
  onProfile: true,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

describe('parseSets', () => {
  it.each([
    ['10, 10, 10', [10, 10, 10]],
    ['10/10/10', [10, 10, 10]],
    ['10 10 10', [10, 10, 10]],
    [' 12 ,8', [12, 8]],
  ])('should read %j as %j', (text, expected) => {
    expect(parseSets(text)).toEqual(expected);
  });

  it('should treat an empty field as no breakdown', () => {
    expect(parseSets('')).toBeNull();
    expect(parseSets('   ')).toBeNull();
  });
});

describe('setsTotal', () => {
  it('should sum a valid set list', () => {
    expect(setsTotal('10, 10, 10')).toBe(30);
  });

  it('should refuse zeros, blanks and garbage', () => {
    expect(setsTotal('')).toBeNull();
    expect(setsTotal('10, 0')).toBeNull();
    expect(setsTotal('abc')).toBeNull();
  });
});

describe('formFromWorkout / formToInput', () => {
  it('should round-trip a workout through the form', () => {
    // when
    const form = formFromWorkout(WORKOUT);

    // then — sets read back as typed text, variants as ids
    expect(form.lines).toEqual([
      {
        exerciseId: 'legs.squats',
        variantId: 'bodyweight',
        target: 30,
        sets: '15, 15',
      },
      { exerciseId: 'plank.standard', variantId: '', target: 60, sets: '' },
    ]);
    expect(formToInput(form)).toEqual({
      title: 'Beine',
      description: 'Hart',
      exercises: WORKOUT.exercises,
      onProfile: true,
    });
  });

  it('should trim the title and description', () => {
    const input = formToInput({
      ...emptyForm(),
      title: '  Kurz ',
      description: ' x ',
    });
    expect(input.title).toBe('Kurz');
    expect(input.description).toBe('x');
  });

  it('should leave the sets off a line without a breakdown', () => {
    expect(lineToExercise(emptyLine())).toEqual({
      exerciseId: 'pushup',
      target: 10,
    });
  });
});

describe('emptyLine', () => {
  it('should suggest seconds for a timed exercise', () => {
    expect(emptyLine('plank.standard').target).toBe(30);
    expect(emptyLine('pushup').target).toBe(10);
  });
});

describe('isWorkoutExercise', () => {
  it('should admit rep, time and distance exercises', () => {
    expect(isWorkoutExercise('pushup')).toBe(true);
    expect(isWorkoutExercise('plank.standard')).toBe(true);
  });

  it('should refuse unknown ids', () => {
    expect(isWorkoutExercise('nope')).toBe(false);
  });
});

describe('formForExercise', () => {
  it('should open a new workout on the picked exercise and variant', () => {
    // given / when
    const form = formForExercise('legs.squats', 'bodyweight');

    // then
    expect(form.lines).toEqual([
      { ...emptyLine('legs.squats'), variantId: 'bodyweight' },
    ]);
    expect(form.title).toBe('');
  });

  it('should drop a variant the exercise does not know', () => {
    // given / when
    const form = formForExercise('legs.squats', 'made-up');

    // then
    expect(form.lines[0].variantId).toBe('');
  });

  it('should fall back to the blank form for an unknown exercise', () => {
    // given / when / then
    expect(formForExercise('nope', null)).toEqual(emptyForm());
    expect(formForExercise(null, null)).toEqual(emptyForm());
  });
});

describe('variantOptions', () => {
  it('should list the catalog variants of an exercise', () => {
    expect(variantOptions('legs.squats').map((v) => v.id)).toContain(
      'bodyweight'
    );
    expect(variantOptions('plank.standard')).toEqual(expect.any(Array));
    expect(variantOptions('nope')).toEqual([]);
  });
});

describe('targetUnitLabel', () => {
  it('should follow the measurement', () => {
    expect(targetUnitLabel('pushup')).toBe('Wdh.');
    expect(targetUnitLabel('plank.standard')).toBe('Sek.');
    expect(targetUnitLabel('cardio.running')).toBe('m');
  });
});
