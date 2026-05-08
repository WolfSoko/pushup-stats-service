import { formatExerciseValue } from './exercise-format';

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
  });
});
