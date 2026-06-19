import { sanitizeSetsArray } from './entry-sanitize';

describe('sanitizeSetsArray', () => {
  it('should return an empty array for non-array input', () => {
    // given / when / then
    expect(sanitizeSetsArray(undefined)).toEqual([]);
    expect(sanitizeSetsArray(null)).toEqual([]);
    expect(sanitizeSetsArray('10,20')).toEqual([]);
    expect(sanitizeSetsArray(42)).toEqual([]);
    expect(sanitizeSetsArray({ 0: 1 })).toEqual([]);
  });

  it('should keep finite non-negative integers unchanged', () => {
    // given
    const input = [10, 0, 25, 100];
    // when
    const result = sanitizeSetsArray(input);
    // then
    expect(result).toEqual([10, 0, 25, 100]);
  });

  it('should drop non-numeric entries', () => {
    // given
    const input = [10, '20', null, undefined, {}, [], 30];
    // when
    const result = sanitizeSetsArray(input);
    // then
    expect(result).toEqual([10, 30]);
  });

  it('should drop NaN, Infinity and -Infinity', () => {
    // given
    const input = [5, NaN, Infinity, -Infinity, 7];
    // when
    const result = sanitizeSetsArray(input);
    // then
    expect(result).toEqual([5, 7]);
  });

  it('should drop non-integer numbers', () => {
    // given
    const input = [3, 2.5, 4, 0.1];
    // when
    const result = sanitizeSetsArray(input);
    // then
    expect(result).toEqual([3, 4]);
  });

  it('should drop negative numbers', () => {
    // given
    const input = [-1, 0, -100, 8];
    // when
    const result = sanitizeSetsArray(input);
    // then
    expect(result).toEqual([0, 8]);
  });

  it('should return an empty array for an empty array', () => {
    // given / when / then
    expect(sanitizeSetsArray([])).toEqual([]);
  });
});
