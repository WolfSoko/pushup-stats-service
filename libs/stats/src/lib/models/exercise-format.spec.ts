import {
  formatDistanceTime,
  formatEntryDisplay,
  formatEntryTotal,
  formatExerciseValue,
  formatPaceMinPerKm,
} from './exercise-format';
import type { ExerciseDefinition } from './exercise.models';

const def = (
  measurement: ExerciseDefinition['measurement'],
  unit: string
): Pick<ExerciseDefinition, 'measurement' | 'unit'> => ({ measurement, unit });

describe('formatExerciseValue', () => {
  describe('reps unit', () => {
    it.each([0, 1, 30, 500])('renders %i as a bare number', (value) => {
      expect(formatExerciseValue(value, 'reps')).toBe(String(value));
    });
  });

  describe('seconds unit', () => {
    it.each<[number, string]>([
      [0, '0:00'],
      [5, '0:05'],
      [60, '1:00'],
      [90, '1:30'],
      [125, '2:05'],
      [3600, '60:00'],
      [7200, '120:00'],
    ])('renders %i s as %s', (value, expected) => {
      expect(formatExerciseValue(value, 's')).toBe(expected);
    });

    it('returns empty for non-finite seconds', () => {
      expect(formatExerciseValue(Number.NaN, 's')).toBe('');
      expect(formatExerciseValue(Number.POSITIVE_INFINITY, 's')).toBe('');
    });
  });

  describe('kg unit', () => {
    it('renders integer weights with the unit suffix', () => {
      expect(formatExerciseValue(80, 'kg')).toBe('80 kg');
    });

    it('renders fractional weights with two decimals', () => {
      expect(formatExerciseValue(27.5, 'kg')).toBe('27.50 kg');
    });
  });

  describe('m unit', () => {
    it('renders short distances in meters', () => {
      expect(formatExerciseValue(800, 'm')).toBe('800 m');
    });

    it('switches to km at the 1000 m boundary', () => {
      expect(formatExerciseValue(1000, 'm')).toBe('1.00 km');
      expect(formatExerciseValue(5000, 'm')).toBe('5.00 km');
      expect(formatExerciseValue(5125, 'm')).toBe('5.13 km');
    });
  });

  describe('unknown unit', () => {
    it('falls back to a value + unit suffix when a unit is provided', () => {
      expect(formatExerciseValue(42, 'foo')).toBe('42 foo');
    });

    it('falls back to a bare number when no unit is provided', () => {
      expect(formatExerciseValue(42, '')).toBe('42');
    });
  });

  describe('invalid input', () => {
    it('returns an empty string for non-finite values', () => {
      expect(formatExerciseValue(Number.NaN, 'reps')).toBe('');
      expect(formatExerciseValue(Number.POSITIVE_INFINITY, 'kg')).toBe('');
    });

    it('returns an empty string for negative values across all units', () => {
      expect(formatExerciseValue(-1, 'reps')).toBe('');
      expect(formatExerciseValue(-100, 'm')).toBe('');
      expect(formatExerciseValue(-5, 'kg')).toBe('');
      expect(formatExerciseValue(-30, 's')).toBe('');
    });
  });
});

describe('formatPaceMinPerKm', () => {
  it.each<[number, number, string]>([
    [5000, 1500, '5:00 /km'],
    [5000, 1530, '5:06 /km'],
    [10_000, 3000, '5:00 /km'],
    [1000, 360, '6:00 /km'],
  ])('%i m in %i s -> %s', (distance, duration, expected) => {
    expect(formatPaceMinPerKm(distance, duration)).toBe(expected);
  });

  it.each<[number, number]>([
    [0, 1500],
    [5000, 0],
    [-100, 600],
    [Number.NaN, 600],
    [5000, Number.POSITIVE_INFINITY],
  ])('returns empty string for %p / %p', (distance, duration) => {
    expect(formatPaceMinPerKm(distance, duration)).toBe('');
  });
});

describe('formatDistanceTime', () => {
  it('renders distance, duration and pace for a tracked run', () => {
    expect(formatDistanceTime(5000, 1500)).toBe('5.00 km · 25:00 (5:00 /km)');
  });

  it('drops the pace suffix when distance is 0', () => {
    expect(formatDistanceTime(0, 600)).toBe('10:00');
  });

  it('drops the pace suffix when duration is 0', () => {
    expect(formatDistanceTime(800, 0)).toBe('800 m');
  });

  it('renders short distances in meters', () => {
    expect(formatDistanceTime(800, 240)).toBe('800 m · 4:00 (5:00 /km)');
  });

  it('returns empty string when both inputs are zero', () => {
    expect(formatDistanceTime(0, 0)).toBe('');
  });
});

describe('formatEntryDisplay', () => {
  it('routes distance-time entries through the composite formatter', () => {
    expect(
      formatEntryDisplay(
        { distanceM: 5000, durationSec: 1500 },
        def('distance-time', 'm')
      )
    ).toBe('5.00 km · 25:00 (5:00 /km)');
  });

  it('reads durationSec for time-only exercises', () => {
    expect(
      formatEntryDisplay({ durationSec: 90 }, def('time', 's'))
    ).toBe('1:30');
  });

  it('reads reps for rep-based exercises', () => {
    expect(formatEntryDisplay({ reps: 30 }, def('reps', 'reps'))).toBe('30');
  });

  it('reads reps for weight exercises (the rep count is the primary)', () => {
    expect(formatEntryDisplay({ reps: 5, weightKg: 80 }, def('weight', 'reps'))).toBe(
      '5'
    );
  });

  it('reads distanceM for plain distance exercises', () => {
    expect(formatEntryDisplay({ distanceM: 1500 }, def('distance', 'm'))).toBe(
      '1.50 km'
    );
  });

  it('treats a missing distance-time companion as zero (no pace)', () => {
    expect(
      formatEntryDisplay({ distanceM: 5000 }, def('distance-time', 'm'))
    ).toBe('5.00 km');
  });
});

describe('formatEntryTotal', () => {
  it('combines distance and duration totals for distance-time', () => {
    expect(
      formatEntryTotal(
        { primary: 42_000, companion: 12_600 },
        def('distance-time', 'm')
      )
    ).toBe('42.00 km · 210:00 (5:00 /km)');
  });

  it('falls back to single-value formatting for other measurements', () => {
    expect(formatEntryTotal({ primary: 600 }, def('reps', 'reps'))).toBe('600');
    expect(formatEntryTotal({ primary: 1800 }, def('time', 's'))).toBe('30:00');
  });

  it('handles distance-time without a companion total (cardio with 0 s)', () => {
    expect(
      formatEntryTotal({ primary: 5000 }, def('distance-time', 'm'))
    ).toBe('5.00 km');
  });
});
