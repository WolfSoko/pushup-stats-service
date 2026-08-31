import { granularityForRange } from './chart-granularity';

describe('granularityForRange', () => {
  it('should split a single day into hours', () => {
    // given / when / then
    expect(granularityForRange('day', '2026-06-15', '2026-06-15')).toBe(
      'hourly'
    );
  });

  it('should split a week into days', () => {
    // given / when / then
    expect(granularityForRange('week', '2026-06-15', '2026-06-21')).toBe(
      'daily'
    );
  });

  it('should split a month into weeks', () => {
    // given / when / then
    expect(granularityForRange('month', '2026-06-01', '2026-06-30')).toBe(
      'weekly'
    );
  });

  it('should split a year into months', () => {
    // given / when / then
    expect(granularityForRange('year', '2026-01-01', '2026-12-31')).toBe(
      'monthly'
    );
  });

  it('should ignore the dates for a named period', () => {
    // given / when — the mode already fixes the bucket size
    const granularity = granularityForRange('year', null, null);
    // then
    expect(granularity).toBe('monthly');
  });
});

describe('granularityForRange with a custom span', () => {
  it('should keep daily bars for a span of at most five weeks', () => {
    // given / when — 35 days inclusive
    const granularity = granularityForRange(
      'custom',
      '2026-06-01',
      '2026-07-05'
    );
    // then
    expect(granularity).toBe('daily');
  });

  it('should switch to weekly bars once a span passes five weeks', () => {
    // given / when — 36 days inclusive
    const granularity = granularityForRange(
      'custom',
      '2026-06-01',
      '2026-07-06'
    );
    // then
    expect(granularity).toBe('weekly');
  });

  it('should keep weekly bars up to half a year', () => {
    // given / when — 182 days inclusive
    const granularity = granularityForRange(
      'custom',
      '2026-01-01',
      '2026-07-01'
    );
    // then
    expect(granularity).toBe('weekly');
  });

  it('should switch to monthly bars beyond half a year', () => {
    // given / when — 183 days inclusive
    const granularity = granularityForRange(
      'custom',
      '2026-01-01',
      '2026-07-02'
    );
    // then
    expect(granularity).toBe('monthly');
  });

  it('should fall back to daily bars while a bound is still missing', () => {
    // given / when
    const granularity = granularityForRange('custom', null, '2026-07-02');
    // then
    expect(granularity).toBe('daily');
  });
});
