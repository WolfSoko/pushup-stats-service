import type { StatsFilter, StatsResponse } from './stats.models';

describe('stats.models contracts', () => {
  it('supports typed stats response shape', () => {
    const sample: StatsResponse = {
      meta: {
        from: '2026-02-01',
        to: '2026-02-10',
        entries: 5,
        days: 3,
        total: 42,
        granularity: 'daily',
      },
      series: [{ bucket: '2026-02-01', total: 10, dayIntegral: 10 }],
    };

    expect(sample.meta.total).toBe(42);
  });

  it('supports optional filter dates', () => {
    const filter: StatsFilter = { from: '2026-02-01' };
    expect(filter.to).toBeUndefined();
  });
});
