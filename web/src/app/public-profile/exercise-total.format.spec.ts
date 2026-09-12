import {
  formatExerciseTotal,
  formatExerciseValue,
} from './exercise-total.format';

describe('formatExerciseTotal', () => {
  describe('Given a rep-counted exercise', () => {
    it('should print a plain grouped number', () => {
      expect(formatExerciseTotal(3600, 'reps', 'de-DE')).toBe('3.600');
    });
  });

  describe('Given a time-based exercise', () => {
    it.each([
      [90, '2 min'],
      [3600, '1 h'],
      [5400, '1 h 30 min'],
    ])('should render %d seconds as %s', (total, expected) => {
      // then — the stored number is seconds; printing it raw would put
      // "3.600" next to 3600 push-ups and mean something entirely different
      expect(formatExerciseTotal(total, 'time', 'de-DE')).toBe(expected);
    });
  });

  describe('Given a distance-based exercise', () => {
    it.each([
      [850, '850 m'],
      [12300, '12,3 km'],
    ])('should render %d metres as %s', (total, expected) => {
      expect(formatExerciseTotal(total, 'distance', 'de-DE')).toBe(expected);
    });

    it('should treat distance-time the same way', () => {
      expect(formatExerciseTotal(5000, 'distance-time', 'de-DE')).toBe(
        '5,0 km'
      );
    });
  });

  it('should never render the same number identically across units', () => {
    // given — this is the whole point of carrying `measurement`
    const reps = formatExerciseTotal(3600, 'reps', 'de-DE');
    const time = formatExerciseTotal(3600, 'time', 'de-DE');
    const distance = formatExerciseTotal(3600, 'distance', 'de-DE');

    // then
    expect(new Set([reps, time, distance]).size).toBe(3);
  });

  it('should follow the locale for grouping', () => {
    expect(formatExerciseTotal(3600, 'reps', 'en-US')).toBe('3,600');
  });
});

describe('formatExerciseValue', () => {
  it('should keep the seconds of a single hold', () => {
    // given — rounding 90 seconds to "2 min" would be wrong in the one
    // place the user can check it against their own memory
    expect(formatExerciseValue(90, 'time', 'de')).toBe('1:30 min');
  });

  it('should pad the seconds', () => {
    // given
    expect(formatExerciseValue(65, 'time', 'de')).toBe('1:05 min');
  });

  it('should format everything else like a total', () => {
    // given
    expect(formatExerciseValue(40, 'reps', 'de')).toBe(
      formatExerciseTotal(40, 'reps', 'de')
    );
    expect(formatExerciseValue(1500, 'distance', 'de')).toBe(
      formatExerciseTotal(1500, 'distance', 'de')
    );
  });
});
