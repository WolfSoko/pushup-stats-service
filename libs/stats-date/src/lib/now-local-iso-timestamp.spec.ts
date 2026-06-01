import { nowLocalIsoTimestamp } from './now-local-iso-timestamp';

describe('nowLocalIsoTimestamp', () => {
  it('returns YYYY-MM-DDTHH:MM with a timezone offset suffix', () => {
    // Pick a fixed date in a non-DST month so any test machine produces
    // a stable offset for that local clock — the suffix shape is what we
    // care about, not the specific offset.
    const fixed = new Date(2026, 0, 15, 9, 5); // local 2026-01-15 09:05
    const out = nowLocalIsoTimestamp(fixed);
    expect(out).toMatch(/^2026-01-15T09:05([+-]\d{2}:\d{2}|Z)$/);
  });

  it('pads single-digit month/day/hour/minute', () => {
    const fixed = new Date(2026, 2, 3, 4, 7); // 2026-03-03 04:07 local
    const out = nowLocalIsoTimestamp(fixed);
    expect(out.startsWith('2026-03-03T04:07')).toBe(true);
  });

  it('uses current time when no argument is passed', () => {
    const out = nowLocalIsoTimestamp();
    // Match the same shape but allow any year/month/day/etc.
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/);
  });
});
