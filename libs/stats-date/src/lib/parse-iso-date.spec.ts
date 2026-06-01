import { parseIsoDate } from './parse-iso-date';

describe('parseIsoDate', () => {
  it('returns a Date for a valid ISO date string', () => {
    const result = parseIsoDate('2024-03-15');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2024);
    expect(result?.getMonth()).toBe(2); // 0-indexed
    expect(result?.getDate()).toBe(15);
  });

  it('returns null for an empty string', () => {
    expect(parseIsoDate('')).toBeNull();
  });

  it('returns null when a segment is missing', () => {
    expect(parseIsoDate('2024-03')).toBeNull();
  });
});
