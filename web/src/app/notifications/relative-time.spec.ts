import { relativeTimeParts } from './relative-time';

const NOW = Date.parse('2026-09-20T12:00:00.000Z');

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe('relativeTimeParts', () => {
  it('should report seconds for something that just happened', () => {
    // when
    const parts = relativeTimeParts(ago(30_000), NOW);

    // then
    expect(parts).toEqual({ value: -30, unit: 'second' });
  });

  it('should switch to minutes once a minute has passed', () => {
    // when
    const parts = relativeTimeParts(ago(5 * 60_000), NOW);

    // then
    expect(parts).toEqual({ value: -5, unit: 'minute' });
  });

  it('should switch to hours rather than reporting hundreds of minutes', () => {
    // when
    const parts = relativeTimeParts(ago(4 * 3_600_000), NOW);

    // then
    expect(parts).toEqual({ value: -4, unit: 'hour' });
  });

  it('should report days for last week', () => {
    // when
    const parts = relativeTimeParts(ago(3 * 86_400_000), NOW);

    // then
    expect(parts).toEqual({ value: -3, unit: 'day' });
  });

  it('should report weeks for an entry near the 30-day retention limit', () => {
    // when
    const parts = relativeTimeParts(ago(29 * 86_400_000), NOW);

    // then — the oldest entry the inbox can hold still reads in weeks
    expect(parts).toEqual({ value: -4, unit: 'week' });
  });

  it('should report months once past a calendar month', () => {
    // when
    const parts = relativeTimeParts(ago(70 * 86_400_000), NOW);

    // then
    expect(parts?.unit).toBe('month');
  });

  it('should return null for a missing timestamp, so the row renders without a time', () => {
    // then
    expect(relativeTimeParts(null, NOW)).toBeNull();
    expect(relativeTimeParts(undefined, NOW)).toBeNull();
  });

  it('should return null for an unparseable timestamp instead of NaN', () => {
    // then
    expect(relativeTimeParts('not-a-date', NOW)).toBeNull();
  });
});
