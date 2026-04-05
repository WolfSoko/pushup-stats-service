import { emptyUserStats, UserStats } from './user-stats.models';

describe('UserStats model contracts', () => {
  it('emptyUserStats returns zeroed-out stats for a user', () => {
    const stats = emptyUserStats('user-1');
    expect(stats.userId).toBe('user-1');
    expect(stats.total).toBe(0);
    expect(stats.totalEntries).toBe(0);
    expect(stats.totalDays).toBe(0);
    expect(stats.dailyReps).toBe(0);
    expect(stats.dailyKey).toBe('');
    expect(stats.weeklyReps).toBe(0);
    expect(stats.weeklyKey).toBe('');
    expect(stats.monthlyReps).toBe(0);
    expect(stats.monthlyKey).toBe('');
    expect(stats.currentStreak).toBe(0);
    expect(stats.lastEntryDate).toBeNull();
    expect(stats.heatmap).toEqual({});
    expect(stats.bestDay).toBeNull();
    expect(stats.bestSingleEntry).toBeNull();
    expect(stats.updatedAt).toBeDefined();
  });

  it('supports a fully populated UserStats shape', () => {
    const stats: UserStats = {
      userId: 'user-2',
      total: 5000,
      totalEntries: 150,
      totalDays: 90,
      dailyReps: 50,
      dailyKey: '2026-04-05',
      weeklyReps: 300,
      weeklyKey: '2026-W14',
      monthlyReps: 1200,
      monthlyKey: '2026-04',
      currentStreak: 7,
      lastEntryDate: '2026-04-05',
      heatmap: { 'Mo-08': 120, 'Fr-14': 45 },
      bestDay: { date: '2026-03-15', total: 200 },
      bestSingleEntry: { reps: 100, timestamp: '2026-03-15T10:00:00.000Z' },
      updatedAt: '2026-04-05T12:00:00.000Z',
    };

    expect(stats.total).toBe(5000);
    expect(stats.heatmap['Mo-08']).toBe(120);
    expect(stats.bestDay?.total).toBe(200);
    expect(stats.bestSingleEntry?.reps).toBe(100);
  });

  it('allows heatmap to have arbitrary weekday-hour slots', () => {
    const stats = emptyUserStats('user-3');
    stats.heatmap['Di-10'] = 30;
    stats.heatmap['So-22'] = 5;
    expect(Object.keys(stats.heatmap)).toEqual(['Di-10', 'So-22']);
  });
});
