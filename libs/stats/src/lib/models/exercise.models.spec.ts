import {
  companionFields,
  entryBreakdownField,
  measurementCompanionValueField,
  measurementValueField,
  requiredCompanionFields,
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

const distanceTimeDef: Pick<
  ExerciseDefinition,
  'measurement' | 'min' | 'max' | 'variants'
> = {
  measurement: 'distance-time',
  min: 100,
  max: 100_000,
};

describe('measurementValueField', () => {
  describe('Given each MeasurementType', () => {
    it.each<[MeasurementType, string]>([
      ['reps', 'reps'],
      ['weight', 'reps'],
      ['time', 'durationSec'],
      ['distance', 'distanceM'],
      ['distance-time', 'distanceM'],
    ])('Then %s maps to field %s', (m, expected) => {
      expect(measurementValueField(m)).toBe(expected);
    });
  });
});

describe('measurementCompanionValueField', () => {
  it.each<[MeasurementType, string | undefined]>([
    ['reps', undefined],
    ['time', undefined],
    ['distance', undefined],
    ['weight', undefined],
    ['distance-time', 'durationSec'],
  ])('Then %s maps to companion display field %s', (m, expected) => {
    expect(measurementCompanionValueField(m)).toBe(expected);
  });
});

describe('entryBreakdownField', () => {
  it.each<[MeasurementType, 'sets' | 'intervals']>([
    ['reps', 'sets'],
    ['weight', 'sets'],
    ['time', 'intervals'],
    ['distance', 'intervals'],
    ['distance-time', 'intervals'],
  ])('Then %s exposes its breakdown as %s', (m, expected) => {
    expect(entryBreakdownField(m)).toBe(expected);
  });
});

describe('companionFields', () => {
  it.each<[MeasurementType, string[]]>([
    ['reps', []],
    ['time', []],
    ['distance', ['durationSec']],
    ['distance-time', ['durationSec']],
    ['weight', ['weightKg']],
  ])('Then %s allows %p as companion fields', (m, expected) => {
    expect([...companionFields(m)]).toEqual(expected);
  });
});

describe('requiredCompanionFields', () => {
  it.each<[MeasurementType, string[]]>([
    ['reps', []],
    ['time', []],
    ['distance', []],
    ['distance-time', ['durationSec']],
    ['weight', ['weightKg']],
  ])('Then %s requires %p as companion fields', (m, expected) => {
    expect([...requiredCompanionFields(m)]).toEqual(expected);
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
        expect(validateExerciseEntry({ reps: 10, [field]: 5 }, repsDef)).toBe(
          'wrong-measurement-field'
        );
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
  it('accepts a valid distance in meters without a duration companion', () => {
    expect(validateExerciseEntry({ distanceM: 5000 }, distanceDef)).toBeNull();
  });

  it('accepts a valid distance with an optional durationSec companion (pace)', () => {
    expect(
      validateExerciseEntry({ distanceM: 5000, durationSec: 1650 }, distanceDef)
    ).toBeNull();
  });

  it('rejects a missing distance value', () => {
    expect(validateExerciseEntry({}, distanceDef)).toBe(
      'measurement-value-missing'
    );
  });

  it('rejects a non-integer durationSec companion', () => {
    expect(
      validateExerciseEntry({ distanceM: 5000, durationSec: 27.5 }, distanceDef)
    ).toBe('companion-value-invalid');
  });

  it('rejects a durationSec companion outside its bounds', () => {
    expect(
      validateExerciseEntry({ distanceM: 5000, durationSec: 0 }, distanceDef)
    ).toBe('companion-value-out-of-range');
    expect(
      validateExerciseEntry(
        { distanceM: 5000, durationSec: 100_000 },
        distanceDef
      )
    ).toBe('companion-value-out-of-range');
  });

  it('rejects companion fields not declared for distance', () => {
    expect(
      validateExerciseEntry({ distanceM: 5000, weightKg: 5 }, distanceDef)
    ).toBe('wrong-measurement-field');
  });
});

describe('validateExerciseEntry — distance-time measurement', () => {
  it('accepts a tracked run with both distance and duration', () => {
    expect(
      validateExerciseEntry(
        { distanceM: 5000, durationSec: 1500 },
        distanceTimeDef
      )
    ).toBeNull();
  });

  it('rejects when the duration companion is missing', () => {
    expect(validateExerciseEntry({ distanceM: 5000 }, distanceTimeDef)).toBe(
      'companion-value-missing'
    );
  });

  it('rejects when the primary distance is missing', () => {
    expect(validateExerciseEntry({ durationSec: 1500 }, distanceTimeDef)).toBe(
      'measurement-value-missing'
    );
  });

  it('rejects out-of-range distances against the catalog cap', () => {
    expect(
      validateExerciseEntry(
        { distanceM: 200_000, durationSec: 36_000 },
        distanceTimeDef
      )
    ).toBe('measurement-value-out-of-range');
  });

  it('rejects out-of-range durations against companion bounds', () => {
    expect(
      validateExerciseEntry(
        { distanceM: 5000, durationSec: 200_000 },
        distanceTimeDef
      )
    ).toBe('companion-value-out-of-range');
  });

  it('rejects entries that also carry an unrelated value field', () => {
    expect(
      validateExerciseEntry(
        { distanceM: 5000, durationSec: 1500, reps: 10 },
        distanceTimeDef
      )
    ).toBe('wrong-measurement-field');
  });

  it('skips the duration-required check in partial-update mode', () => {
    expect(
      validateExerciseEntry({ distanceM: 5000 }, distanceTimeDef, {
        partial: true,
      })
    ).toBeNull();
  });

  it('accepts a duration-only patch in partial-update mode (no primary)', () => {
    expect(
      validateExerciseEntry({ durationSec: 1500 }, distanceTimeDef, {
        partial: true,
      })
    ).toBeNull();
  });
});

describe('validateExerciseEntry — weight measurement', () => {
  it('accepts a valid weighted set (reps + weightKg companion)', () => {
    expect(
      validateExerciseEntry({ reps: 5, weightKg: 80 }, weightDef)
    ).toBeNull();
  });

  it('accepts a fractional weightKg companion (e.g. 2.5 kg increments)', () => {
    expect(
      validateExerciseEntry({ reps: 8, weightKg: 27.5 }, weightDef)
    ).toBeNull();
  });

  it('rejects a weighted set without weightKg', () => {
    expect(validateExerciseEntry({ reps: 5 }, weightDef)).toBe(
      'companion-value-missing'
    );
  });

  it('rejects when reps exceeds the cap', () => {
    expect(validateExerciseEntry({ reps: 999, weightKg: 80 }, weightDef)).toBe(
      'measurement-value-out-of-range'
    );
  });

  it('rejects an out-of-range weightKg', () => {
    expect(validateExerciseEntry({ reps: 5, weightKg: 0 }, weightDef)).toBe(
      'companion-value-out-of-range'
    );
    expect(validateExerciseEntry({ reps: 5, weightKg: 1000 }, weightDef)).toBe(
      'companion-value-out-of-range'
    );
  });

  it('rejects a non-finite weightKg', () => {
    expect(
      validateExerciseEntry(
        { reps: 5, weightKg: Number.POSITIVE_INFINITY },
        weightDef
      )
    ).toBe('companion-value-invalid');
  });

  it('rejects companion fields not declared for weight', () => {
    expect(
      validateExerciseEntry(
        { reps: 5, weightKg: 80, durationSec: 30 },
        weightDef
      )
    ).toBe('wrong-measurement-field');
  });
});

describe('validateExerciseEntry — partial / patch mode', () => {
  describe('Given a partial patch that omits the primary value', () => {
    it('Then a variantId-only update on a reps exercise passes', () => {
      const def: Pick<
        ExerciseDefinition,
        'measurement' | 'min' | 'max' | 'variants'
      > = {
        ...repsDef,
        variants: [{ id: 'wide', nameKey: '@@v.wide' }],
      };
      expect(
        validateExerciseEntry({ variantId: 'wide' }, def, { partial: true })
      ).toBeNull();
    });

    it('Then a partial weight patch without weightKg passes', () => {
      // Without `partial`, weight measurement requires weightKg.
      expect(
        validateExerciseEntry({}, weightDef, { partial: true })
      ).toBeNull();
    });
  });

  describe('Given a partial patch that includes invalid values', () => {
    it('Then a fractional reps patch is still rejected', () => {
      expect(
        validateExerciseEntry({ reps: 1.5 }, repsDef, { partial: true })
      ).toBe('measurement-value-not-integer');
    });

    it('Then an out-of-range patch is still rejected', () => {
      expect(
        validateExerciseEntry({ reps: 9999 }, repsDef, { partial: true })
      ).toBe('measurement-value-out-of-range');
    });

    it('Then an unknown variantId in a partial patch is still rejected', () => {
      expect(
        validateExerciseEntry({ variantId: 'unknown' }, repsDef, {
          partial: true,
        })
      ).toBe('invalid-variant');
    });
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
      validateExerciseEntry({ reps: 10, variantId: 'diamond' }, defWithVariants)
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
