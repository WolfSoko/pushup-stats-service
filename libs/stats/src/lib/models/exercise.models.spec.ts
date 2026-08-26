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

describe('validateExerciseEntry — breakdown field mutex', () => {
  it('accepts sets on a reps exercise', () => {
    expect(
      validateExerciseEntry({ reps: 30, sets: [10, 10, 10] }, repsDef)
    ).toBeNull();
  });

  it('rejects intervals on a reps exercise', () => {
    expect(
      validateExerciseEntry({ reps: 30, intervals: [30, 30, 30] }, repsDef)
    ).toBe('wrong-measurement-field');
  });

  it('accepts intervals on a time exercise', () => {
    expect(
      validateExerciseEntry(
        { durationSec: 90, intervals: [30, 30, 30] },
        timeDef
      )
    ).toBeNull();
  });

  it('rejects sets on a time exercise', () => {
    expect(
      validateExerciseEntry({ durationSec: 90, sets: [10, 10, 10] }, timeDef)
    ).toBe('wrong-measurement-field');
  });

  it('rejects sets on a distance exercise', () => {
    expect(
      validateExerciseEntry(
        { distanceM: 5000, sets: [10, 10, 10] },
        distanceDef
      )
    ).toBe('wrong-measurement-field');
  });

  it('accepts intervals on a distance exercise', () => {
    expect(
      validateExerciseEntry(
        { distanceM: 1200, intervals: [400, 400, 400] },
        distanceDef
      )
    ).toBeNull();
  });

  it('rejects intervals on a weight exercise (strength uses sets)', () => {
    expect(
      validateExerciseEntry(
        { reps: 5, weightKg: 80, intervals: [5, 5, 5] },
        weightDef
      )
    ).toBe('wrong-measurement-field');
  });

  it('allows an empty wrong-side array as the clear sentinel', () => {
    // `[]` is the deleteField sentinel used by updateEntry — it must
    // pass through the validator even on the "wrong" side so a caller
    // wiping a stale field doesn't have to know the measurement type.
    expect(
      validateExerciseEntry({ reps: 30, intervals: [] }, repsDef)
    ).toBeNull();
    expect(
      validateExerciseEntry({ durationSec: 60, sets: [] }, timeDef)
    ).toBeNull();
  });
});

describe('validateExerciseEntry — intervalDurationsSec (interval split times)', () => {
  it('accepts index-aligned split times on a distance-time exercise', () => {
    expect(
      validateExerciseEntry(
        {
          distanceM: 3000,
          durationSec: 900,
          intervals: [1000, 1000, 1000],
          intervalDurationsSec: [270, 265, 280],
        },
        distanceTimeDef
      )
    ).toBeNull();
  });

  it('accepts 0 as the "no split entered" sentinel for some intervals', () => {
    expect(
      validateExerciseEntry(
        {
          distanceM: 2000,
          durationSec: 600,
          intervals: [1000, 1000],
          intervalDurationsSec: [270, 0],
        },
        distanceTimeDef
      )
    ).toBeNull();
  });

  it('allows an empty array as the clear sentinel', () => {
    expect(
      validateExerciseEntry(
        {
          distanceM: 2000,
          durationSec: 600,
          intervals: [1000, 1000],
          intervalDurationsSec: [],
        },
        distanceTimeDef
      )
    ).toBeNull();
  });

  it('rejects split times on a plain time exercise (no distance to pair with)', () => {
    expect(
      validateExerciseEntry(
        {
          durationSec: 90,
          intervals: [30, 30, 30],
          intervalDurationsSec: [30, 30, 30],
        },
        timeDef
      )
    ).toBe('wrong-measurement-field');
  });

  it('rejects split times on a plain distance exercise (no aligned intervals concept)', () => {
    expect(
      validateExerciseEntry(
        {
          distanceM: 1200,
          intervals: [400, 400, 400],
          intervalDurationsSec: [120, 120, 120],
        },
        distanceDef
      )
    ).toBe('wrong-measurement-field');
  });

  it('rejects a length mismatch against intervals', () => {
    expect(
      validateExerciseEntry(
        {
          distanceM: 3000,
          durationSec: 900,
          intervals: [1000, 1000, 1000],
          intervalDurationsSec: [270, 265],
        },
        distanceTimeDef
      )
    ).toBe('interval-durations-length-mismatch');
  });

  it('rejects a non-integer split time', () => {
    expect(
      validateExerciseEntry(
        {
          distanceM: 1000,
          durationSec: 300,
          intervals: [1000],
          intervalDurationsSec: [270.5],
        },
        distanceTimeDef
      )
    ).toBe('companion-value-invalid');
  });

  it('rejects an out-of-range split time', () => {
    expect(
      validateExerciseEntry(
        {
          distanceM: 1000,
          durationSec: 300,
          intervals: [1000],
          intervalDurationsSec: [100_000],
        },
        distanceTimeDef
      )
    ).toBe('companion-value-out-of-range');
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

describe('validateExerciseEntry — free-form variants', () => {
  const freeFormDef: Pick<
    ExerciseDefinition,
    'measurement' | 'min' | 'max' | 'variants' | 'allowsCustomVariants'
  > = {
    ...repsDef,
    allowsCustomVariants: true,
    variants: [{ id: 'standard', nameKey: '@@v.standard' }],
  };

  it('should accept a catalogued variantId', () => {
    // given a definition whose variant list is only a suggestion
    // when the entry uses one of the listed variants
    // then it validates
    expect(
      validateExerciseEntry({ reps: 10, variantId: 'standard' }, freeFormDef)
    ).toBeNull();
  });

  it('should accept a user-typed variantId that is not in the list', () => {
    // given a definition that allows custom variants
    // when the entry carries a free-text variant
    // then it validates instead of failing with invalid-variant
    expect(
      validateExerciseEntry({ reps: 10, variantId: 'Sphinx' }, freeFormDef)
    ).toBeNull();
  });

  it('should accept a free-form variantId on a definition without a variant list', () => {
    // given a definition that allows custom variants and lists none
    const noListDef = { ...repsDef, allowsCustomVariants: true };
    // when the entry carries any variant
    // then it validates
    expect(
      validateExerciseEntry({ reps: 10, variantId: 'diamond' }, noListDef)
    ).toBeNull();
  });
});
