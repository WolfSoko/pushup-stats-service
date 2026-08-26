import { ExerciseDefinition } from '@pu-stats/models';
import {
  buildPushupResult,
  buildVariantPatch,
  canSubmitExercise,
  canSubmitPushup,
  exerciseOverCapKind,
  normalizeSource,
  pushupOverCap,
} from './training-entry-dialog.submit';
import { buildExerciseResult } from './exercise-result.builder';

const repsDef: ExerciseDefinition = {
  id: 'abs.situps',
  categoryId: 'core',
  measurement: 'reps',
  min: 1,
  max: 500,
  unit: 'reps',
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
        intervalDurationsSec: [],
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
