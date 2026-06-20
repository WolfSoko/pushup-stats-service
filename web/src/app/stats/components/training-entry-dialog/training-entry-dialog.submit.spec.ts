import { ExerciseDefinition } from '@pu-stats/models';
import {
  buildExerciseResult,
  buildPushupResult,
  buildVariantPatch,
  canSubmitExercise,
  canSubmitPushup,
  exerciseOverCapKind,
  normalizeSource,
  pushupOverCap,
} from './training-entry-dialog.submit';

const repsDef: ExerciseDefinition = {
  id: 'abs.situps',
  categoryId: 'core',
  measurement: 'reps',
  min: 1,
  max: 500,
  unit: 'reps',
};
const timeDef: ExerciseDefinition = {
  id: 'plank.standard',
  categoryId: 'core',
  measurement: 'time',
  min: 1,
  max: 3600,
  unit: 's',
};
const distanceTimeDef: ExerciseDefinition = {
  id: 'cardio.running',
  categoryId: 'cardio',
  measurement: 'distance-time',
  min: 100,
  max: 100000,
  unit: 'm',
};
const distanceDef: ExerciseDefinition = {
  ...distanceTimeDef,
  measurement: 'distance',
};

describe('training-entry-dialog.submit', () => {
  describe('buildPushupResult', () => {
    it('should sum the valid sets into a pushup result', () => {
      // given
      // when
      const result = buildPushupResult({
        timestamp: '2026-02-10T13:45:00+01:00',
        sets: [10, 0, 20],
        type: 'diamond',
        source: 'web',
      });

      // then
      expect(result).toEqual({
        kind: 'pushup',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 30,
        sets: [10, 20],
        type: 'diamond',
        source: 'web',
      });
    });

    it('should return null when no reps were entered', () => {
      // given / when
      const result = buildPushupResult({
        timestamp: 't',
        sets: [0, 0],
        type: 'standard',
        source: 'web',
      });

      // then
      expect(result).toBeNull();
    });
  });

  describe('buildExerciseResult — measurement branches', () => {
    it('should emit intervals + empty sets for a time measurement', () => {
      // given / when
      const result = buildExerciseResult({
        timestamp: 't',
        def: timeDef,
        variantPatch: {},
        sets: [99],
        intervals: [30, 0, 30],
        durationSec: 90,
        distanceM: null,
      });

      // then
      expect(result).toMatchObject({
        kind: 'exercise',
        exerciseId: 'plank.standard',
        measurement: 'time',
        durationSec: 90,
        intervals: [30, 30],
        sets: [],
        reps: 0,
      });
    });

    it('should return null for a time measurement without a duration', () => {
      // given / when
      const result = buildExerciseResult({
        timestamp: 't',
        def: timeDef,
        variantPatch: {},
        sets: [],
        intervals: [],
        durationSec: null,
        distanceM: null,
      });

      // then
      expect(result).toBeNull();
    });

    it('should emit distance + duration for a distance-time measurement', () => {
      // given / when
      const result = buildExerciseResult({
        timestamp: 't',
        def: distanceTimeDef,
        variantPatch: {},
        sets: [],
        intervals: [],
        durationSec: 1500,
        distanceM: 5250,
      });

      // then
      expect(result).toMatchObject({
        measurement: 'distance-time',
        distanceM: 5250,
        durationSec: 1500,
        intervals: [],
        sets: [],
        reps: 0,
      });
    });

    it('should emit distance + intervals for a pure distance measurement', () => {
      // given / when — distance has no live catalog entry but stays in
      // lockstep with the model so a future distance-only exercise works.
      const result = buildExerciseResult({
        timestamp: 't',
        def: distanceDef,
        variantPatch: {},
        sets: [],
        intervals: [400, 400],
        durationSec: null,
        distanceM: 800,
      });

      // then
      expect(result).toMatchObject({
        measurement: 'distance',
        distanceM: 800,
        intervals: [400, 400],
        sets: [],
        reps: 0,
      });
      expect((result as { durationSec?: number }).durationSec).toBeUndefined();
    });

    it('should emit sets + empty intervals for a strength measurement', () => {
      // given / when
      const result = buildExerciseResult({
        timestamp: 't',
        def: repsDef,
        variantPatch: {},
        sets: [12, 0, 8],
        intervals: [99],
        durationSec: null,
        distanceM: null,
      });

      // then
      expect(result).toMatchObject({
        measurement: 'reps',
        reps: 20,
        sets: [12, 8],
        intervals: [],
      });
    });

    it('should return null for a strength measurement with no reps', () => {
      // given / when
      const result = buildExerciseResult({
        timestamp: 't',
        def: repsDef,
        variantPatch: {},
        sets: [0],
        intervals: [],
        durationSec: null,
        distanceM: null,
      });

      // then
      expect(result).toBeNull();
    });
  });

  describe('buildVariantPatch — tri-state', () => {
    it('should emit an empty patch when the variant is unchanged', () => {
      // given / when / then
      expect(buildVariantPatch('weighted', 'weighted')).toEqual({});
      expect(buildVariantPatch('', '')).toEqual({});
    });

    it('should emit the variant id when set to a new value', () => {
      // given / when / then
      expect(buildVariantPatch('weighted', '')).toEqual({
        variantId: 'weighted',
      });
    });

    it('should emit null when an existing variant is cleared', () => {
      // given / when / then
      expect(buildVariantPatch('', 'weighted')).toEqual({ variantId: null });
    });

    it('should thread the patch through the built exercise result', () => {
      // given / when
      const result = buildExerciseResult({
        timestamp: 't',
        def: repsDef,
        variantPatch: buildVariantPatch('', 'weighted'),
        sets: [10],
        intervals: [],
        durationSec: null,
        distanceM: null,
      });

      // then
      expect(result?.variantId).toBeNull();
    });
  });

  describe('timestamp preservation', () => {
    it('should pass the supplied timestamp through verbatim', () => {
      // given
      const ts = '2026-02-10T13:45:00+01:00';

      // when
      const pushup = buildPushupResult({
        timestamp: ts,
        sets: [10],
        type: 'standard',
        source: 'web',
      });
      const exercise = buildExerciseResult({
        timestamp: ts,
        def: repsDef,
        variantPatch: {},
        sets: [10],
        intervals: [],
        durationSec: null,
        distanceM: null,
      });

      // then
      expect(pushup?.timestamp).toBe(ts);
      expect(exercise?.timestamp).toBe(ts);
    });
  });

  describe('caps & submit predicates', () => {
    it('should flag pushup over-cap above the shared 500 ceiling', () => {
      // given / when / then
      expect(pushupOverCap(500)).toBe(false);
      expect(pushupOverCap(501)).toBe(true);
      expect(canSubmitPushup(0)).toBe(false);
      expect(canSubmitPushup(20)).toBe(true);
      expect(canSubmitPushup(501)).toBe(false);
    });

    it('should classify exercise over-cap by measurement', () => {
      // given / when / then
      expect(
        exerciseOverCapKind({
          measurement: 'distance-time',
          max: 100,
          distanceM: 200,
          durationSec: 10,
          totalReps: 0,
        })
      ).toBe('distance');
      expect(
        exerciseOverCapKind({
          measurement: 'time',
          max: 60,
          distanceM: null,
          durationSec: 90,
          totalReps: 0,
        })
      ).toBe('value');
      expect(
        exerciseOverCapKind({
          measurement: 'reps',
          max: 500,
          distanceM: null,
          durationSec: null,
          totalReps: 600,
        })
      ).toBe('value');
      // distance is dead in the catalog today but stays consistent with
      // buildExerciseResult's distance branch.
      expect(
        exerciseOverCapKind({
          measurement: 'distance',
          max: 100000,
          distanceM: 150000,
          durationSec: null,
          totalReps: 0,
        })
      ).toBe('distance');
    });

    it('should gate exercise submit on the measurement minimums', () => {
      // given / when / then
      expect(
        canSubmitExercise({
          def: repsDef,
          distanceM: null,
          durationSec: null,
          totalReps: 12,
          overCap: false,
        })
      ).toBe(true);
      expect(
        canSubmitExercise({
          def: distanceTimeDef,
          distanceM: 5000,
          durationSec: 1500,
          totalReps: 0,
          overCap: false,
        })
      ).toBe(true);
      // distance gates on distanceM >= min (no duration required)
      expect(
        canSubmitExercise({
          def: distanceDef,
          distanceM: 5000,
          durationSec: null,
          totalReps: 0,
          overCap: false,
        })
      ).toBe(true);
      expect(
        canSubmitExercise({
          def: distanceDef,
          distanceM: 50,
          durationSec: null,
          totalReps: 0,
          overCap: false,
        })
      ).toBe(false);
      expect(
        canSubmitExercise({
          def: null,
          distanceM: null,
          durationSec: null,
          totalReps: 0,
          overCap: false,
        })
      ).toBe(false);
    });
  });

  describe('normalizeSource', () => {
    it('should normalise blanks and the wa alias', () => {
      // given / when / then
      expect(normalizeSource('')).toBe('web');
      expect(normalizeSource('  ')).toBe('web');
      expect(normalizeSource('wa')).toBe('whatsapp');
      expect(normalizeSource('custom')).toBe('custom');
    });
  });
});
