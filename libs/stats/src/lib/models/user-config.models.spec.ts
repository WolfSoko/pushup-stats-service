import {
  type ComplexGoalEntry,
  complexGoalAppliesOnWeekday,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  legacyNumericGoalToEntries,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  sumRepsTarget,
  validateDisplayName,
} from './user-config.models';

describe('validateDisplayName', () => {
  describe('Given a valid name', () => {
    it.each([
      'Wolf',
      'Anna-Lena',
      'Jean.Luc',
      'Carl Sagan',
      'a_b',
      'Über_99',
      'むぎ',
      '日本語',
      'AbCdEfGhIjKlMnOpQrStUvWxYz1234',
    ])('Then %s passes', (name) => {
      expect(validateDisplayName(name)).toBeNull();
    });

    it('trims surrounding whitespace before checking length and charset', () => {
      expect(validateDisplayName('  Wolf  ')).toBeNull();
    });

    it(`accepts the lower bound (${DISPLAY_NAME_MIN_LENGTH} chars)`, () => {
      expect(validateDisplayName('AB')).toBeNull();
    });

    it(`accepts the upper bound (${DISPLAY_NAME_MAX_LENGTH} chars)`, () => {
      expect(
        validateDisplayName('A'.repeat(DISPLAY_NAME_MAX_LENGTH))
      ).toBeNull();
    });
  });

  describe('Given a too-short name', () => {
    it.each(['', ' ', 'A', '   '])('Then %p is rejected', (name) => {
      expect(validateDisplayName(name)).toBe('too-short');
    });
  });

  describe('Given a too-long name', () => {
    it('rejects names beyond the max', () => {
      expect(validateDisplayName('A'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe(
        'too-long'
      );
    });
  });

  describe('Given names with invalid characters', () => {
    it.each([
      'Wolf🚀',
      'with\nnewline',
      'wolf<script>',
      'a/b',
      'Wolf!',
      'foo@bar',
      '/u/admin',
    ])('Then %p is rejected', (name) => {
      expect(validateDisplayName(name)).toBe('invalid-characters');
    });
  });

  describe('Given a non-string value', () => {
    it.each([null, undefined, 42, true, [], {}])(
      'Then %p is rejected as invalid-characters',
      (raw) => {
        expect(validateDisplayName(raw)).toBe('invalid-characters');
      }
    );
  });
});

describe('complexGoalAppliesOnWeekday', () => {
  function entry(weekdays?: number[]): Pick<ComplexGoalEntry, 'weekdays'> {
    return { weekdays };
  }

  it('Given no filter, Then the entry applies on every weekday', () => {
    for (let d = 0; d <= 6; d++) {
      expect(complexGoalAppliesOnWeekday(entry(), d)).toBe(true);
      expect(complexGoalAppliesOnWeekday(entry([]), d)).toBe(true);
    }
  });

  it('Given a filter, Then only matching weekdays apply', () => {
    const pushPullLegs = entry([1, 3, 5]); // Mon/Wed/Fri
    expect(complexGoalAppliesOnWeekday(pushPullLegs, 1)).toBe(true);
    expect(complexGoalAppliesOnWeekday(pushPullLegs, 2)).toBe(false);
    expect(complexGoalAppliesOnWeekday(pushPullLegs, 5)).toBe(true);
    expect(complexGoalAppliesOnWeekday(pushPullLegs, 6)).toBe(false);
  });

  it('Defensively ignores out-of-range or non-integer weekday filters', () => {
    expect(complexGoalAppliesOnWeekday(entry([99, -1, 1.5 as number]), 1)).toBe(
      false
    );
    expect(
      complexGoalAppliesOnWeekday(entry([99, -1, 1.5 as number, 2]), 2)
    ).toBe(true);
  });
});

describe('sumRepsTarget', () => {
  it('sums only rep-based entries, ignoring time/distance/weight goals', () => {
    expect(
      sumRepsTarget([
        {
          id: 'a',
          exerciseId: 'pushup',
          target: 50,
          measurement: 'reps',
          unit: 'reps',
        },
        {
          id: 'b',
          exerciseId: 'legs.squats',
          target: 30,
          measurement: 'reps',
          unit: 'reps',
        },
        {
          id: 'c',
          exerciseId: 'plank.standard',
          target: 90,
          measurement: 'time',
          unit: 's',
        },
        {
          id: 'd',
          exerciseId: 'cardio.running',
          target: 5000,
          measurement: 'distance',
          unit: 'm',
        },
      ])
    ).toBe(80);
  });

  it('Skips non-positive and non-finite targets', () => {
    expect(
      sumRepsTarget([
        {
          id: 'a',
          exerciseId: 'pushup',
          target: 0,
          measurement: 'reps',
          unit: 'reps',
        },
        {
          id: 'b',
          exerciseId: 'pushup',
          target: -10,
          measurement: 'reps',
          unit: 'reps',
        },
        {
          id: 'c',
          exerciseId: 'pushup',
          target: NaN,
          measurement: 'reps',
          unit: 'reps',
        },
      ])
    ).toBe(0);
  });
});

describe('legacyNumericGoalToEntries', () => {
  it('Builds a single pushup-reps entry from a legacy positive number', () => {
    expect(legacyNumericGoalToEntries(50, 'legacy-daily')).toEqual([
      {
        id: 'legacy-daily',
        exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
        target: 50,
        measurement: 'reps',
        unit: 'reps',
      },
    ]);
  });

  it('Returns an empty list for missing/non-positive legacy values', () => {
    expect(legacyNumericGoalToEntries(undefined, 'legacy-daily')).toEqual([]);
    expect(legacyNumericGoalToEntries(0, 'legacy-daily')).toEqual([]);
    expect(legacyNumericGoalToEntries(-5, 'legacy-daily')).toEqual([]);
    expect(legacyNumericGoalToEntries(NaN, 'legacy-daily')).toEqual([]);
  });
});
