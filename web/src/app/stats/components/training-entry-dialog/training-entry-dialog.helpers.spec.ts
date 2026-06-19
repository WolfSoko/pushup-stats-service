import {
  buildCategoryOptions,
  formatKm,
  formatKmInput,
  inferExerciseCategory,
  parseDurationFromParts,
  parseKmToMeters,
  SECONDS_MAX,
  splitDurationParts,
  syntheticDefinitionFor,
} from './training-entry-dialog.helpers';
import type { ExerciseEntryDialogData } from './training-entry-dialog.models';

describe('training-entry-dialog.helpers', () => {
  describe('parseDurationFromParts', () => {
    it('should return null when both parts are empty', () => {
      // given
      const minutes = '';
      const seconds = '  ';

      // when
      const result = parseDurationFromParts(minutes, seconds);

      // then
      expect(result).toBeNull();
    });

    it('should treat an empty part as zero', () => {
      // given
      const minutes = '2';
      const seconds = '';

      // when
      const result = parseDurationFromParts(minutes, seconds);

      // then
      expect(result).toBe(120);
    });

    it('should combine minutes and seconds into total seconds', () => {
      // given
      const minutes = '1';
      const seconds = '30';

      // when
      const result = parseDurationFromParts(minutes, seconds);

      // then
      expect(result).toBe(90);
    });

    it('should reject fractional input to avoid silent truncation', () => {
      // given
      const minutes = '1.9';
      const seconds = '0';

      // when
      const result = parseDurationFromParts(minutes, seconds);

      // then
      expect(result).toBeNull();
    });

    it('should reject negative values', () => {
      // given
      const minutes = '-1';
      const seconds = '0';

      // when
      const result = parseDurationFromParts(minutes, seconds);

      // then
      expect(result).toBeNull();
    });

    it('should reject seconds above the per-field maximum', () => {
      // given
      const minutes = '0';
      const seconds = String(SECONDS_MAX + 1);

      // when
      const result = parseDurationFromParts(minutes, seconds);

      // then
      expect(result).toBeNull();
    });

    it('should accept seconds exactly at the maximum', () => {
      // given
      const minutes = '0';
      const seconds = String(SECONDS_MAX);

      // when
      const result = parseDurationFromParts(minutes, seconds);

      // then
      expect(result).toBe(SECONDS_MAX);
    });
  });

  describe('splitDurationParts', () => {
    it('should return empty strings for undefined input', () => {
      // given
      const totalSec = undefined;

      // when
      const result = splitDurationParts(totalSec);

      // then
      expect(result).toEqual({ minutes: '', seconds: '' });
    });

    it('should return empty strings for non-positive values', () => {
      // given
      const totalSec = 0;

      // when
      const result = splitDurationParts(totalSec);

      // then
      expect(result).toEqual({ minutes: '', seconds: '' });
    });

    it('should split total seconds into minutes and seconds strings', () => {
      // given
      const totalSec = 95;

      // when
      const result = splitDurationParts(totalSec);

      // then
      expect(result).toEqual({ minutes: '1', seconds: '35' });
    });

    it('should round-trip with parseDurationFromParts', () => {
      // given
      const totalSec = 754;

      // when
      const parts = splitDurationParts(totalSec);
      const back = parseDurationFromParts(parts.minutes, parts.seconds);

      // then
      expect(back).toBe(totalSec);
    });
  });

  describe('parseKmToMeters', () => {
    it('should return null for empty input', () => {
      // given
      const input = '   ';

      // when
      const result = parseKmToMeters(input);

      // then
      expect(result).toBeNull();
    });

    it('should parse a plain integer km value to meters', () => {
      // given
      const input = '5';

      // when
      const result = parseKmToMeters(input);

      // then
      expect(result).toBe(5000);
    });

    it('should accept a dot decimal separator', () => {
      // given
      const input = '1.5';

      // when
      const result = parseKmToMeters(input);

      // then
      expect(result).toBe(1500);
    });

    it('should accept a comma decimal separator', () => {
      // given
      const input = '1,5';

      // when
      const result = parseKmToMeters(input);

      // then
      expect(result).toBe(1500);
    });

    it('should tolerate grouped thousands with a decimal part', () => {
      // given
      const input = '1.234,5';

      // when
      const result = parseKmToMeters(input);

      // then
      expect(result).toBe(1234500);
    });

    it('should tolerate whitespace-grouped thousands', () => {
      // given
      const input = '1 234,5';

      // when
      const result = parseKmToMeters(input);

      // then
      expect(result).toBe(1234500);
    });

    it('should reject ambiguous multi-separator integer typos', () => {
      // given
      const input = '1.2.3';

      // when
      const result = parseKmToMeters(input);

      // then
      expect(result).toBeNull();
    });

    it('should reject a non-numeric fractional part', () => {
      // given
      const input = '1.2a';

      // when
      const result = parseKmToMeters(input);

      // then
      expect(result).toBeNull();
    });

    it('should return null for a zero distance', () => {
      // given
      const input = '0';

      // when
      const result = parseKmToMeters(input);

      // then
      expect(result).toBeNull();
    });
  });

  describe('formatKm / formatKmInput', () => {
    it('should format with two fraction digits in en-US', () => {
      // given
      const km = 5;

      // when
      const result = formatKm(km, 'en-US');

      // then
      expect(result).toBe('5.00');
    });

    it('should use the locale decimal separator', () => {
      // given
      const km = 1.5;

      // when
      const result = formatKm(km, 'de-DE');

      // then
      expect(result).toBe('1,50');
    });

    it('should return empty string for non-positive meters', () => {
      // given
      const distanceM = 0;

      // when
      const result = formatKmInput(distanceM, 'en-US');

      // then
      expect(result).toBe('');
    });

    it('should format stored meters back to a km string', () => {
      // given
      const distanceM = 1500;

      // when
      const result = formatKmInput(distanceM, 'en-US');

      // then
      expect(result).toBe('1.50');
    });

    it('should round-trip a formatted value through parseKmToMeters', () => {
      // given
      const distanceM = 2500;

      // when
      const formatted = formatKmInput(distanceM, 'de-DE');
      const back = parseKmToMeters(formatted);

      // then
      expect(back).toBe(distanceM);
    });
  });

  describe('inferExerciseCategory', () => {
    it('should map legacy abs prefix to core', () => {
      // given
      const exerciseId = 'abs.situps';

      // when
      const result = inferExerciseCategory(exerciseId);

      // then
      expect(result).toBe('core');
    });

    it('should map legacy plank prefix to core', () => {
      // given
      const exerciseId = 'plank.standard';

      // when
      const result = inferExerciseCategory(exerciseId);

      // then
      expect(result).toBe('core');
    });

    it('should map legacy legs prefix to squat', () => {
      // given
      const exerciseId = 'legs.squats';

      // when
      const result = inferExerciseCategory(exerciseId);

      // then
      expect(result).toBe('squat');
    });

    it('should resolve a known catalog category prefix', () => {
      // given
      const exerciseId = 'core.deadbug';

      // when
      const result = inferExerciseCategory(exerciseId);

      // then
      expect(result).toBe('core');
    });

    it('should never resolve an unknown id to the pushup category', () => {
      // given
      const exerciseId = 'totally-unknown-id';

      // when
      const result = inferExerciseCategory(exerciseId);

      // then
      expect(result).not.toBe('pushup');
    });
  });

  describe('syntheticDefinitionFor', () => {
    it('should infer a reps measurement when no duration or distance', () => {
      // given
      const data: ExerciseEntryDialogData = {
        kind: 'exercise',
        timestamp: '2026-01-01T10:00',
        exerciseId: 'stale.id',
        reps: 12,
      };

      // when
      const def = syntheticDefinitionFor(data, 'core');

      // then
      expect(def).toEqual({
        id: 'stale.id',
        categoryId: 'core',
        measurement: 'reps',
        min: 1,
        max: 500,
        unit: 'reps',
      });
    });

    it('should infer a time measurement from durationSec alone', () => {
      // given
      const data: ExerciseEntryDialogData = {
        kind: 'exercise',
        timestamp: '2026-01-01T10:00',
        exerciseId: 'stale.plank',
        durationSec: 60,
      };

      // when
      const def = syntheticDefinitionFor(data, 'core');

      // then
      expect(def.measurement).toBe('time');
      expect(def.unit).toBe('s');
      expect(def.max).toBe(86_400);
    });

    it('should infer distance-time when both distance and duration are present', () => {
      // given
      const data: ExerciseEntryDialogData = {
        kind: 'exercise',
        timestamp: '2026-01-01T10:00',
        exerciseId: 'stale.run',
        distanceM: 5000,
        durationSec: 1500,
      };

      // when
      const def = syntheticDefinitionFor(data, 'cardio');

      // then
      expect(def.measurement).toBe('distance-time');
      expect(def.unit).toBe('m');
      expect(def.max).toBe(100_000);
    });
  });

  describe('buildCategoryOptions', () => {
    it('should always include the pushup category', () => {
      // given
      // (catalog-backed; pushup is special-cased in)

      // when
      const options = buildCategoryOptions();

      // then
      expect(options.some((o) => o.value === 'pushup')).toBe(true);
    });

    it('should produce a non-empty label for every option', () => {
      // given
      // (catalog-backed)

      // when
      const options = buildCategoryOptions();

      // then
      expect(options.length).toBeGreaterThan(0);
      expect(options.every((o) => o.label.length > 0)).toBe(true);
    });
  });
});
