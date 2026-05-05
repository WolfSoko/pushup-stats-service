import {
  measurementValueField,
  validateExerciseEntry,
  type ExerciseDefinition,
  type MeasurementType,
} from './exercise.models';

const repsDef: Pick<
  ExerciseDefinition,
  'measurement' | 'min' | 'max' | 'variants'
> = {
  measurement: 'reps',
  min: 1,
  max: 500,
};

const timeDef: Pick<
  ExerciseDefinition,
  'measurement' | 'min' | 'max' | 'variants'
> = {
  measurement: 'time',
  min: 1,
  max: 7200,
};

const distanceDef: Pick<
  ExerciseDefinition,
  'measurement' | 'min' | 'max' | 'variants'
> = {
  measurement: 'distance',
  min: 1,
  max: 100_000,
};

const weightDef: Pick<
  ExerciseDefinition,
  'measurement' | 'min' | 'max' | 'variants'
> = {
  measurement: 'weight',
  min: 1,
  max: 200,
};

describe('measurementValueField', () => {
  describe('Given each MeasurementType', () => {
    it.each<[MeasurementType, string]>([
      ['reps', 'reps'],
      ['weight', 'reps'],
      ['time', 'durationSec'],
      ['distance', 'distanceM'],
    ])('Then %s maps to field %s', (m, expected) => {
      expect(measurementValueField(m)).toBe(expected);
    });
  });
});

describe('validateExerciseEntry — reps measurement', () => {
  describe('Given a valid integer in range', () => {
    it.each([1, 50, 200, 500])('Then %i passes validation', (reps) => {
      expect(validateExerciseEntry({ reps }, repsDef)).toBeNull();
    });
  });

  describe('Given a non-integer or non-finite reps value', () => {
    it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'Then %p is rejected as not-integer',
      (reps) => {
        expect(validateExerciseEntry({ reps }, repsDef)).toBe(
          'measurement-value-not-integer'
        );
      }
    );
  });

  describe('Given an out-of-range integer', () => {
    it.each([0, -1, 501, 10_000])(
      'Then %i is rejected as out-of-range',
      (reps) => {
        expect(validateExerciseEntry({ reps }, repsDef)).toBe(
          'measurement-value-out-of-range'
        );
      }
    );
  });

  describe('Given missing reps value', () => {
    it('Then it is rejected as measurement-value-missing', () => {
      expect(validateExerciseEntry({}, repsDef)).toBe(
        'measurement-value-missing'
      );
    });
  });

  describe('Given an entry that also carries a non-reps field', () => {
    it.each(['durationSec', 'distanceM', 'weightKg'] as const)(
      'Then setting %s alongside reps is rejected as wrong-measurement-field',
      (field) => {
        expect(
          validateExerciseEntry({ reps: 10, [field]: 5 }, repsDef)
        ).toBe('wrong-measurement-field');
      }
    );
  });
});

describe('validateExerciseEntry — time measurement', () => {
  it('accepts a valid duration', () => {
    expect(validateExerciseEntry({ durationSec: 60 }, timeDef)).toBeNull();
  });

  it('rejects when reps is set instead', () => {
    expect(validateExerciseEntry({ reps: 60 }, timeDef)).toBe(
      'wrong-measurement-field'
    );
  });

  it('rejects an out-of-range duration', () => {
    expect(validateExerciseEntry({ durationSec: 0 }, timeDef)).toBe(
      'measurement-value-out-of-range'
    );
    expect(validateExerciseEntry({ durationSec: 7201 }, timeDef)).toBe(
      'measurement-value-out-of-range'
    );
  });
});

describe('validateExerciseEntry — distance measurement', () => {
  it('accepts a valid distance in meters', () => {
    expect(validateExerciseEntry({ distanceM: 5000 }, distanceDef)).toBeNull();
  });

  it('rejects a missing distance value', () => {
    expect(validateExerciseEntry({}, distanceDef)).toBe(
      'measurement-value-missing'
    );
  });
});

describe('validateExerciseEntry — weight measurement', () => {
  it('accepts a valid weight (delivered as reps for now)', () => {
    expect(validateExerciseEntry({ reps: 80 }, weightDef)).toBeNull();
  });

  it('rejects when reps exceeds the cap', () => {
    expect(validateExerciseEntry({ reps: 999 }, weightDef)).toBe(
      'measurement-value-out-of-range'
    );
  });
});

describe('validateExerciseEntry — variants', () => {
  const defWithVariants: Pick<
    ExerciseDefinition,
    'measurement' | 'min' | 'max' | 'variants'
  > = {
    ...repsDef,
    variants: [
      { id: 'standard', nameKey: '@@v.standard' },
      { id: 'wide', nameKey: '@@v.wide' },
    ],
  };

  it('accepts an entry without a variantId', () => {
    expect(validateExerciseEntry({ reps: 10 }, defWithVariants)).toBeNull();
  });

  it('accepts an entry with a known variantId', () => {
    expect(
      validateExerciseEntry({ reps: 10, variantId: 'wide' }, defWithVariants)
    ).toBeNull();
  });

  it('rejects an entry with an unknown variantId', () => {
    expect(
      validateExerciseEntry(
        { reps: 10, variantId: 'diamond' },
        defWithVariants
      )
    ).toBe('invalid-variant');
  });

  it('treats an empty variantId as not set', () => {
    expect(
      validateExerciseEntry({ reps: 10, variantId: '' }, defWithVariants)
    ).toBeNull();
  });

  it('rejects an unknown variantId on a definition without variants', () => {
    expect(
      validateExerciseEntry({ reps: 10, variantId: 'wide' }, repsDef)
    ).toBe('invalid-variant');
  });
});
