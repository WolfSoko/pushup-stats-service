import type {
  StatsFilter,
  StatsResponse,
  UserConfig,
  UserConfigUpdate,
} from './stats.models';

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

describe('UserConfig reminder field', () => {
  it('accepts a full reminder config', () => {
    const config: UserConfig = {
      userId: 'u1',
      reminder: {
        enabled: true,
        intervalMinutes: 60,
        quietHours: [{ from: '22:00', to: '07:00' }],
        timezone: 'Europe/Berlin',
        language: 'de',
        lastQuoteFetchAt: '2026-03-23T10:00:00.000Z',
      },
    };
    expect(config.reminder?.enabled).toBe(true);
    expect(config.reminder?.intervalMinutes).toBe(60);
    expect(config.reminder?.quietHours).toHaveLength(1);
    expect(config.reminder?.timezone).toBe('Europe/Berlin');
    expect(config.reminder?.language).toBe('de');
    expect(config.reminder?.lastQuoteFetchAt).toBeDefined();
  });

  it('allows reminder to be omitted', () => {
    const config: UserConfig = { userId: 'u2' };
    expect(config.reminder).toBeUndefined();
  });

  it('allows lastQuoteFetchAt to be omitted', () => {
    const config: UserConfig = {
      userId: 'u3',
      reminder: {
        enabled: false,
        intervalMinutes: 30,
        quietHours: [],
        timezone: 'UTC',
        language: 'en',
      },
    };
    expect(config.reminder?.lastQuoteFetchAt).toBeUndefined();
  });

  it('allows multiple quiet-hour windows', () => {
    const config: UserConfig = {
      userId: 'u4',
      reminder: {
        enabled: true,
        intervalMinutes: 120,
        quietHours: [
          { from: '22:00', to: '07:00' },
          { from: '12:00', to: '13:00' },
        ],
        timezone: 'Europe/Berlin',
        language: 'en',
      },
    };
    expect(config.reminder?.quietHours).toHaveLength(2);
  });
});

describe('UserConfigUpdate reminder field', () => {
  it('accepts reminder as a partial update', () => {
    const update: UserConfigUpdate = {
      reminder: {
        enabled: true,
        intervalMinutes: 30,
        quietHours: [],
        timezone: 'Europe/Berlin',
        language: 'de',
      },
    };
    expect(update.reminder?.enabled).toBe(true);
  });

  it('allows reminder to be omitted in update', () => {
    const update: UserConfigUpdate = { dailyGoal: 100 };
    expect(update.reminder).toBeUndefined();
  });
});
