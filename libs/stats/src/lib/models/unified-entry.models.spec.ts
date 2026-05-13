import {
  exerciseEntryToUnified,
  pushupRecordToUnified,
  unifiedEntryCategoryId,
  unifiedEntryFilterKey,
  unifiedEntryMeasurement,
  unifiedEntryPrimaryValue,
} from './unified-entry.models';
import type { ExerciseDefinition, ExerciseEntry } from './exercise.models';
import type { PushupRecord } from './pushup.models';

describe('pushupRecordToUnified', () => {
  describe('Given a fully populated pushup record', () => {
    it('maps every persisted field through and tags kind as "pushup"', () => {
      const r: PushupRecord = {
        _id: 'p1',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 25,
        sets: [10, 15],
        source: 'web',
        type: 'diamond',
        createdAt: '2026-04-15T10:00:01Z',
        updatedAt: '2026-04-15T10:00:01Z',
      };
      expect(pushupRecordToUnified(r)).toEqual({
        kind: 'pushup',
        _id: 'p1',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 25,
        sets: [10, 15],
        source: 'web',
        variantType: 'diamond',
        createdAt: '2026-04-15T10:00:01Z',
        updatedAt: '2026-04-15T10:00:01Z',
      });
    });
  });

  describe('Given a pushup record without optional fields', () => {
    it('omits sets/createdAt/updatedAt and surfaces null for missing type', () => {
      const r: PushupRecord = {
        _id: 'p2',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 10,
        source: 'web',
      };
      const out = pushupRecordToUnified(r);
      expect(out.kind).toBe('pushup');
      expect(out.variantType).toBeNull();
      expect('sets' in out).toBe(false);
      expect('createdAt' in out).toBe(false);
      expect('updatedAt' in out).toBe(false);
    });
  });
});

describe('exerciseEntryToUnified', () => {
  describe('Given a reps-measured exercise entry', () => {
    it('maps reps + sets and tags kind as "exercise"', () => {
      const e: ExerciseEntry = {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'abs.situps',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 30,
        sets: [10, 10, 10],
        source: 'web',
      };
      expect(exerciseEntryToUnified(e)).toEqual({
        kind: 'exercise',
        _id: 'e1',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 30,
        sets: [10, 10, 10],
        source: 'web',
        exerciseId: 'abs.situps',
      });
    });
  });

  describe('Given an exercise entry without reps (e.g. future plank)', () => {
    it('surfaces reps as 0 so the table cell stays numeric', () => {
      const e: ExerciseEntry = {
        _id: 'e2',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-04-15T10:00:00Z',
        durationSec: 60,
        source: 'web',
      };
      const out = exerciseEntryToUnified(e);
      expect(out.reps).toBe(0);
      expect(out.durationSec).toBe(60);
    });
  });

  describe('Given an entry with measurement companions', () => {
    it('passes durationSec, distanceM, weightKg through verbatim', () => {
      const e: ExerciseEntry = {
        _id: 'e3',
        userId: 'u1',
        exerciseId: 'cardio.running',
        timestamp: '2026-04-15T10:00:00Z',
        distanceM: 5000,
        durationSec: 1650,
        source: 'web',
      };
      const out = exerciseEntryToUnified(e);
      expect(out.distanceM).toBe(5000);
      expect(out.durationSec).toBe(1650);
    });

    it('omits companions that are undefined on the source doc', () => {
      const e: ExerciseEntry = {
        _id: 'e4',
        userId: 'u1',
        exerciseId: 'abs.situps',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 10,
        source: 'web',
      };
      const out = exerciseEntryToUnified(e);
      expect('durationSec' in out).toBe(false);
      expect('distanceM' in out).toBe(false);
      expect('weightKg' in out).toBe(false);
    });
  });
});

describe('unifiedEntryFilterKey', () => {
  it('returns "pushup" for any pushup-kind entry regardless of variant', () => {
    expect(
      unifiedEntryFilterKey({
        kind: 'pushup',
        _id: 'p',
        timestamp: 't',
        reps: 1,
        source: 'web',
        variantType: 'diamond',
      })
    ).toBe('pushup');
    expect(
      unifiedEntryFilterKey({
        kind: 'pushup',
        _id: 'p',
        timestamp: 't',
        reps: 1,
        source: 'web',
        variantType: null,
      })
    ).toBe('pushup');
  });

  it('returns the exerciseId for exercise-kind entries', () => {
    expect(
      unifiedEntryFilterKey({
        kind: 'exercise',
        _id: 'e',
        timestamp: 't',
        reps: 1,
        source: 'web',
        exerciseId: 'legs.squats',
      })
    ).toBe('legs.squats');
  });
});

describe('unifiedEntryCategoryId', () => {
  describe('Given a pushup entry', () => {
    it('returns "push" regardless of variant', () => {
      expect(
        unifiedEntryCategoryId({
          kind: 'pushup',
          _id: 'p',
          timestamp: 't',
          reps: 1,
          source: 'web',
          variantType: 'diamond',
        })
      ).toBe('push');
      expect(
        unifiedEntryCategoryId({
          kind: 'pushup',
          _id: 'p',
          timestamp: 't',
          reps: 1,
          source: 'web',
          variantType: null,
        })
      ).toBe('push');
    });
  });

  describe('Given a catalog exercise entry', () => {
    it('returns the categoryId from the catalog (core for legacy abs.* ids)', () => {
      expect(
        unifiedEntryCategoryId({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 1,
          source: 'web',
          exerciseId: 'abs.situps',
        })
      ).toBe('core');
    });

    it('returns the categoryId from the catalog (squat for legacy legs.squats)', () => {
      expect(
        unifiedEntryCategoryId({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 1,
          source: 'web',
          exerciseId: 'legs.squats',
        })
      ).toBe('squat');
    });

    it('returns the categoryId for non-reps measurements (cardio)', () => {
      expect(
        unifiedEntryCategoryId({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 0,
          source: 'web',
          exerciseId: 'cardio.running',
          distanceM: 5000,
          durationSec: 1650,
        })
      ).toBe('cardio');
    });
  });

  describe('Given an unknown exercise id', () => {
    it('returns null when the catalog has no match and no resolver is provided', () => {
      expect(
        unifiedEntryCategoryId({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 1,
          source: 'web',
          exerciseId: 'custom.unknown',
        })
      ).toBeNull();
    });
  });

  describe('Given a custom resolver', () => {
    it('uses the resolver to look up custom exercises outside the catalog', () => {
      const customDef: ExerciseDefinition = {
        id: 'custom-uuid',
        categoryId: 'mobility',
        ownerId: 'u1',
        measurement: 'reps',
        min: 1,
        max: 100,
        unit: 'reps',
        customName: 'Hip openers',
      };
      const resolver = (id: string) =>
        id === 'custom-uuid' ? customDef : null;
      expect(
        unifiedEntryCategoryId(
          {
            kind: 'exercise',
            _id: 'e',
            timestamp: 't',
            reps: 1,
            source: 'web',
            exerciseId: 'custom-uuid',
          },
          resolver
        )
      ).toBe('mobility');
    });
  });
});

describe('unifiedEntryMeasurement', () => {
  it('returns "reps" for any pushup entry', () => {
    expect(
      unifiedEntryMeasurement({
        kind: 'pushup',
        _id: 'p',
        timestamp: 't',
        reps: 1,
        source: 'web',
        variantType: null,
      })
    ).toBe('reps');
  });

  it('resolves the catalog measurement for known exercise ids', () => {
    expect(
      unifiedEntryMeasurement({
        kind: 'exercise',
        _id: 'e',
        timestamp: 't',
        reps: 0,
        source: 'web',
        exerciseId: 'plank.standard',
        durationSec: 60,
      })
    ).toBe('time');

    expect(
      unifiedEntryMeasurement({
        kind: 'exercise',
        _id: 'e',
        timestamp: 't',
        reps: 30,
        source: 'web',
        exerciseId: 'abs.situps',
      })
    ).toBe('reps');
  });

  it('returns null when the exerciseId is not in the catalog', () => {
    expect(
      unifiedEntryMeasurement({
        kind: 'exercise',
        _id: 'e',
        timestamp: 't',
        reps: 1,
        source: 'web',
        exerciseId: 'custom-uuid',
      })
    ).toBeNull();
  });
});

describe('unifiedEntryPrimaryValue', () => {
  describe('Given a reps-measured entry (pushup or catalog rep exercise)', () => {
    it('returns the reps count for pushups', () => {
      expect(
        unifiedEntryPrimaryValue({
          kind: 'pushup',
          _id: 'p',
          timestamp: 't',
          reps: 25,
          source: 'web',
          variantType: 'standard',
        })
      ).toBe(25);
    });

    it('returns the reps count for rep-measured catalog exercises', () => {
      expect(
        unifiedEntryPrimaryValue({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 30,
          source: 'web',
          exerciseId: 'abs.situps',
        })
      ).toBe(30);
    });
  });

  describe('Given a time-measured entry (plank, hollow hold, …)', () => {
    it('returns durationSec so the chart sees a non-zero contribution', () => {
      // Regression: time-measured entries used to surface as `reps = 0`
      // in the analysis chart, hiding planks/hollow holds from the
      // graph entirely. The primary value must come off `durationSec`.
      expect(
        unifiedEntryPrimaryValue({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 0,
          source: 'web',
          exerciseId: 'plank.standard',
          durationSec: 90,
        })
      ).toBe(90);
    });

    it('falls back to 0 when durationSec is missing', () => {
      expect(
        unifiedEntryPrimaryValue({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 0,
          source: 'web',
          exerciseId: 'plank.standard',
        })
      ).toBe(0);
    });
  });

  describe('Given a distance-measured entry', () => {
    it('returns distanceM for distance-time exercises like a tracked run', () => {
      expect(
        unifiedEntryPrimaryValue({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 0,
          source: 'web',
          exerciseId: 'cardio.running',
          distanceM: 5000,
          durationSec: 1650,
        })
      ).toBe(5000);
    });
  });

  describe('Given an unknown exercise id (custom user exercise not resolved)', () => {
    it('falls back to the first populated numeric field so the entry still contributes', () => {
      expect(
        unifiedEntryPrimaryValue({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 0,
          source: 'web',
          exerciseId: 'custom-uuid',
          durationSec: 120,
        })
      ).toBe(120);
    });

    it('returns 0 when no numeric field is populated', () => {
      expect(
        unifiedEntryPrimaryValue({
          kind: 'exercise',
          _id: 'e',
          timestamp: 't',
          reps: 0,
          source: 'web',
          exerciseId: 'custom-uuid',
        })
      ).toBe(0);
    });
  });

  describe('Given a custom resolver', () => {
    it('uses the resolver to pick the right value field for custom exercises', () => {
      const customDef: ExerciseDefinition = {
        id: 'custom-uuid',
        categoryId: 'core',
        ownerId: 'u1',
        measurement: 'time',
        min: 1,
        max: 1200,
        unit: 's',
        customName: 'Custom plank',
      };
      const resolver = (id: string) =>
        id === 'custom-uuid' ? customDef : null;
      expect(
        unifiedEntryPrimaryValue(
          {
            kind: 'exercise',
            _id: 'e',
            timestamp: 't',
            reps: 0,
            source: 'web',
            exerciseId: 'custom-uuid',
            durationSec: 75,
          },
          resolver
        )
      ).toBe(75);
    });
  });
});
