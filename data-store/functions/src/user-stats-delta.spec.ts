import {
  berlinParts,
  isoWeekFromYmd,
  periodKeys,
  heatmapSlot,
  daysBetween,
  updateStreak,
  applyDelta,
  emptyUserStats,
  rebuildFromEntries,
} from './user-stats-delta';

// ─── berlinParts ──────────────────────────────────────────────────────────────

describe('berlinParts', () => {
  it('extracts Berlin-local date parts from a UTC timestamp', () => {
    // 2026-04-05 14:30 UTC = 16:30 CEST (Berlin, UTC+2 in April)
    const parts = berlinParts('2026-04-05T14:30:00.000Z');
    expect(parts.isoDate).toBe('2026-04-05');
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(4);
    expect(parts.day).toBe(5);
    expect(parts.hour).toBe(16);
    expect(parts.weekday).toBe('So'); // April 5, 2026 = Sunday
  });

  it('handles midnight UTC → 01:00 CET in Berlin', () => {
    const parts = berlinParts('2026-01-15T00:00:00.000Z');
    expect(parts.isoDate).toBe('2026-01-15');
    expect(parts.hour).toBe(1);
  });

  it('handles late-night UTC that crosses day boundary in Berlin', () => {
    // 2026-07-15 23:30 UTC = 2026-07-16 01:30 CEST
    const parts = berlinParts('2026-07-15T23:30:00.000Z');
    expect(parts.isoDate).toBe('2026-07-16');
    expect(parts.day).toBe(16);
    expect(parts.hour).toBe(1);
  });
});

// ─── isoWeekFromYmd ───────────────────────────────────────────────────────────

describe('isoWeekFromYmd', () => {
  it('returns correct ISO week for a known date', () => {
    expect(isoWeekFromYmd(2026, 1, 5)).toEqual({ year: 2026, week: 2 });
  });

  it('handles year boundary (Jan 1 2026 = ISO week 1)', () => {
    expect(isoWeekFromYmd(2026, 1, 1)).toEqual({ year: 2026, week: 1 });
  });

  it('handles ISO year rollover at end of December', () => {
    // 2025-12-29 Monday → ISO week 1 of 2026
    expect(isoWeekFromYmd(2025, 12, 29)).toEqual({ year: 2026, week: 1 });
  });
});

// ─── periodKeys ───────────────────────────────────────────────────────────────

describe('periodKeys', () => {
  it('builds correct daily, weekly, monthly keys', () => {
    const keys = periodKeys({
      isoDate: '2026-04-05',
      year: 2026,
      month: 4,
      day: 5,
    });
    expect(keys.dailyKey).toBe('2026-04-05');
    expect(keys.monthlyKey).toBe('2026-04');
    expect(keys.weeklyKey).toBe('2026-W14');
  });
});

// ─── heatmapSlot ──────────────────────────────────────────────────────────────

describe('heatmapSlot', () => {
  it('formats single-digit hours with leading zero', () => {
    expect(heatmapSlot('Mo', 8)).toBe('Mo-08');
  });

  it('formats double-digit hours', () => {
    expect(heatmapSlot('Fr', 14)).toBe('Fr-14');
  });

  it('formats midnight', () => {
    expect(heatmapSlot('So', 0)).toBe('So-00');
  });
});

// ─── daysBetween ──────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    expect(daysBetween('2026-04-05', '2026-04-05')).toBe(0);
  });

  it('returns 1 for consecutive days', () => {
    expect(daysBetween('2026-04-05', '2026-04-06')).toBe(1);
  });

  it('returns negative for reversed order', () => {
    expect(daysBetween('2026-04-06', '2026-04-05')).toBe(-1);
  });

  it('handles month boundary', () => {
    expect(daysBetween('2026-03-31', '2026-04-01')).toBe(1);
  });
});

// ─── updateStreak ─────────────────────────────────────────────────────────────

describe('updateStreak', () => {
  it('starts streak at 1 when no previous entry', () => {
    expect(updateStreak(0, null, '2026-04-05')).toEqual({
      currentStreak: 1,
      lastEntryDate: '2026-04-05',
    });
  });

  it('keeps streak unchanged for same-day entry', () => {
    expect(updateStreak(3, '2026-04-05', '2026-04-05')).toEqual({
      currentStreak: 3,
      lastEntryDate: '2026-04-05',
    });
  });

  it('extends streak for consecutive day', () => {
    expect(updateStreak(3, '2026-04-04', '2026-04-05')).toEqual({
      currentStreak: 4,
      lastEntryDate: '2026-04-05',
    });
  });

  it('resets streak for gap of 2+ days', () => {
    expect(updateStreak(5, '2026-04-02', '2026-04-05')).toEqual({
      currentStreak: 1,
      lastEntryDate: '2026-04-05',
    });
  });

  it('ensures streak is at least 1 for same-day with 0 streak', () => {
    expect(updateStreak(0, '2026-04-05', '2026-04-05')).toEqual({
      currentStreak: 1,
      lastEntryDate: '2026-04-05',
    });
  });
});

// ─── applyDelta ───────────────────────────────────────────────────────────────

describe('applyDelta', () => {
  const NOW = '2026-04-05T16:00:00.000Z';
  // 2026-04-05T14:30Z = 16:30 CEST → Sunday (So), hour 16
  const TIMESTAMP = '2026-04-05T14:30:00.000Z';

  describe('create (+reps)', () => {
    it('initializes stats from null on first entry', () => {
      const result = applyDelta(null, {
        userId: 'u1',
        repsDelta: 20,
        entriesDelta: 1,
        timestamp: TIMESTAMP,
        newReps: 20,
        nowIso: NOW,
      });

      expect(result.userId).toBe('u1');
      expect(result.total).toBe(20);
      expect(result.totalEntries).toBe(1);
      expect(result.dailyReps).toBe(20);
      expect(result.dailyKey).toBe('2026-04-05');
      expect(result.weeklyReps).toBe(20);
      expect(result.weeklyKey).toBe('2026-W14');
      expect(result.monthlyReps).toBe(20);
      expect(result.monthlyKey).toBe('2026-04');
      expect(result.currentStreak).toBe(1);
      expect(result.lastEntryDate).toBe('2026-04-05');
      expect(result.heatmap).toEqual({ 'So-16': 20 });
      expect(result.bestDay).toEqual({ date: '2026-04-05', total: 20 });
      expect(result.bestSingleEntry).toEqual({
        reps: 20,
        timestamp: TIMESTAMP,
      });
      expect(result.updatedAt).toBe(NOW);
    });

    it('accumulates onto existing stats for same period', () => {
      const existing = {
        ...emptyUserStats('u1'),
        total: 100,
        totalEntries: 5,
        dailyReps: 40,
        dailyKey: '2026-04-05',
        weeklyReps: 200,
        weeklyKey: '2026-W14',
        monthlyReps: 800,
        monthlyKey: '2026-04',
        currentStreak: 3,
        lastEntryDate: '2026-04-05',
        heatmap: { 'So-16': 40 },
        bestDay: { date: '2026-04-03', total: 60 },
        bestSingleEntry: {
          reps: 30,
          timestamp: '2026-04-03T10:00:00.000Z',
        },
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: 25,
        entriesDelta: 1,
        timestamp: TIMESTAMP,
        newReps: 25,
        nowIso: NOW,
      });

      expect(result.total).toBe(125);
      expect(result.totalEntries).toBe(6);
      expect(result.dailyReps).toBe(65);
      expect(result.weeklyReps).toBe(225);
      expect(result.monthlyReps).toBe(825);
      expect(result.heatmap['So-16']).toBe(65);
      // 65 > 60 → new best day
      expect(result.bestDay).toEqual({ date: '2026-04-05', total: 65 });
      // 25 < 30 → keep old best single entry
      expect(result.bestSingleEntry).toEqual({
        reps: 30,
        timestamp: '2026-04-03T10:00:00.000Z',
      });
    });

    it('resets period counters when period changes', () => {
      const existing = {
        ...emptyUserStats('u1'),
        total: 100,
        totalEntries: 5,
        dailyReps: 40,
        dailyKey: '2026-04-04', // different day
        weeklyReps: 200,
        weeklyKey: '2026-W14',
        monthlyReps: 800,
        monthlyKey: '2026-04',
        currentStreak: 1,
        lastEntryDate: '2026-04-04',
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: 15,
        entriesDelta: 1,
        timestamp: TIMESTAMP,
        newReps: 15,
        nowIso: NOW,
      });

      expect(result.total).toBe(115);
      expect(result.dailyReps).toBe(15); // reset to new day
      expect(result.dailyKey).toBe('2026-04-05');
      expect(result.weeklyReps).toBe(215); // same week → accumulate
      expect(result.monthlyReps).toBe(815); // same month → accumulate
      expect(result.currentStreak).toBe(2); // consecutive day
    });
  });

  describe('update (diff)', () => {
    it('applies positive diff when reps increase', () => {
      const existing = {
        ...emptyUserStats('u1'),
        total: 100,
        totalEntries: 5,
        dailyReps: 20,
        dailyKey: '2026-04-05',
        weeklyReps: 100,
        weeklyKey: '2026-W14',
        monthlyReps: 400,
        monthlyKey: '2026-04',
        currentStreak: 2,
        lastEntryDate: '2026-04-05',
        heatmap: { 'So-16': 20 },
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: 10, // 20 → 30
        entriesDelta: 0,
        timestamp: TIMESTAMP,
        newReps: 30,
        nowIso: NOW,
      });

      expect(result.total).toBe(110);
      expect(result.totalEntries).toBe(5); // unchanged
      expect(result.dailyReps).toBe(30);
      expect(result.heatmap['So-16']).toBe(30);
    });

    it('applies negative diff when reps decrease', () => {
      const existing = {
        ...emptyUserStats('u1'),
        total: 100,
        totalEntries: 5,
        dailyReps: 30,
        dailyKey: '2026-04-05',
        weeklyReps: 130,
        weeklyKey: '2026-W14',
        monthlyReps: 530,
        monthlyKey: '2026-04',
        currentStreak: 2,
        lastEntryDate: '2026-04-05',
        heatmap: { 'So-16': 30 },
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: -10, // 30 → 20
        entriesDelta: 0,
        timestamp: TIMESTAMP,
        newReps: 20,
        nowIso: NOW,
      });

      expect(result.total).toBe(90);
      expect(result.totalEntries).toBe(5);
      expect(result.dailyReps).toBe(20);
      expect(result.heatmap['So-16']).toBe(20);
    });
  });

  describe('delete (-reps)', () => {
    it('subtracts reps and decrements entry count', () => {
      const existing = {
        ...emptyUserStats('u1'),
        total: 100,
        totalEntries: 5,
        dailyReps: 30,
        dailyKey: '2026-04-05',
        weeklyReps: 130,
        weeklyKey: '2026-W14',
        monthlyReps: 530,
        monthlyKey: '2026-04',
        currentStreak: 2,
        lastEntryDate: '2026-04-05',
        heatmap: { 'So-16': 30 },
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: -30,
        entriesDelta: -1,
        timestamp: TIMESTAMP,
        newReps: 0,
        nowIso: NOW,
      });

      expect(result.total).toBe(70);
      expect(result.totalEntries).toBe(4);
      expect(result.dailyReps).toBe(0);
      expect(result.heatmap['So-16']).toBeUndefined();
      // Streak preserved on delete (conservative)
      expect(result.currentStreak).toBe(2);
    });

    it('floors values at zero to prevent negatives', () => {
      const existing = {
        ...emptyUserStats('u1'),
        total: 10,
        totalEntries: 1,
        dailyReps: 10,
        dailyKey: '2026-04-05',
        weeklyReps: 10,
        weeklyKey: '2026-W14',
        monthlyReps: 10,
        monthlyKey: '2026-04',
        currentStreak: 1,
        lastEntryDate: '2026-04-05',
        heatmap: { 'So-16': 10 },
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: -50, // overshoot
        entriesDelta: -1,
        timestamp: TIMESTAMP,
        newReps: 0,
        nowIso: NOW,
      });

      expect(result.total).toBe(0);
      expect(result.totalEntries).toBe(0);
      expect(result.dailyReps).toBe(0);
      expect(result.weeklyReps).toBe(0);
      expect(result.monthlyReps).toBe(0);
    });
  });

  describe('bestSingleEntry tracking', () => {
    it('sets bestSingleEntry on first create', () => {
      const result = applyDelta(null, {
        userId: 'u1',
        repsDelta: 50,
        entriesDelta: 1,
        timestamp: TIMESTAMP,
        newReps: 50,
        nowIso: NOW,
      });
      expect(result.bestSingleEntry).toEqual({
        reps: 50,
        timestamp: TIMESTAMP,
      });
    });

    it('updates bestSingleEntry when new entry exceeds old best', () => {
      const existing = emptyUserStats('u1');
      existing.bestSingleEntry = {
        reps: 30,
        timestamp: '2026-04-01T10:00:00.000Z',
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: 50,
        entriesDelta: 1,
        timestamp: TIMESTAMP,
        newReps: 50,
        nowIso: NOW,
      });
      expect(result.bestSingleEntry).toEqual({
        reps: 50,
        timestamp: TIMESTAMP,
      });
    });

    it('preserves bestSingleEntry when new entry is lower', () => {
      const existing = emptyUserStats('u1');
      existing.bestSingleEntry = {
        reps: 100,
        timestamp: '2026-04-01T10:00:00.000Z',
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: 20,
        entriesDelta: 1,
        timestamp: TIMESTAMP,
        newReps: 20,
        nowIso: NOW,
      });
      expect(result.bestSingleEntry).toEqual({
        reps: 100,
        timestamp: '2026-04-01T10:00:00.000Z',
      });
    });
  });

  describe('bestDay tracking', () => {
    it('sets bestDay on first create', () => {
      const result = applyDelta(null, {
        userId: 'u1',
        repsDelta: 30,
        entriesDelta: 1,
        timestamp: TIMESTAMP,
        newReps: 30,
        nowIso: NOW,
      });
      expect(result.bestDay).toEqual({ date: '2026-04-05', total: 30 });
    });

    it('updates bestDay when dailyReps exceeds existing best', () => {
      const existing = {
        ...emptyUserStats('u1'),
        total: 50,
        totalEntries: 2,
        dailyReps: 50,
        dailyKey: '2026-04-05',
        weeklyKey: '2026-W14',
        weeklyReps: 50,
        monthlyKey: '2026-04',
        monthlyReps: 50,
        bestDay: { date: '2026-04-03', total: 40 },
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: 20,
        entriesDelta: 1,
        timestamp: TIMESTAMP,
        newReps: 20,
        nowIso: NOW,
      });
      // dailyReps = 50 + 20 = 70 > 40 → new bestDay
      expect(result.bestDay).toEqual({ date: '2026-04-05', total: 70 });
    });

    it('updates bestDay on a NEW day that exceeds the previous best', () => {
      const existing = {
        ...emptyUserStats('u1'),
        total: 100,
        totalEntries: 3,
        dailyReps: 40,
        dailyKey: '2026-04-04', // yesterday
        weeklyKey: '2026-W14',
        weeklyReps: 100,
        monthlyKey: '2026-04',
        monthlyReps: 100,
        bestDay: { date: '2026-04-04', total: 40 },
      };

      const result = applyDelta(existing, {
        userId: 'u1',
        repsDelta: 50,
        entriesDelta: 1,
        timestamp: TIMESTAMP, // 2026-04-05
        newReps: 50,
        nowIso: NOW,
      });

      // New day with 50 reps > old best of 40 → updated
      expect(result.dailyKey).toBe('2026-04-05');
      expect(result.dailyReps).toBe(50);
      expect(result.bestDay).toEqual({ date: '2026-04-05', total: 50 });
    });
  });
});

// ─── emptyUserStats ───────────────────────────────────────────────────────────

describe('emptyUserStats', () => {
  it('returns zeroed stats', () => {
    const stats = emptyUserStats('u1');
    expect(stats.userId).toBe('u1');
    expect(stats.total).toBe(0);
    expect(stats.totalEntries).toBe(0);
    expect(stats.heatmap).toEqual({});
    expect(stats.bestDay).toBeNull();
    expect(stats.bestSingleEntry).toBeNull();
  });
});

// ─── rebuildFromEntries ──────────────────────────────────────────────────────

describe('rebuildFromEntries', () => {
  const NOW = '2026-04-05T16:00:00.000Z';

  it('returns empty stats for zero entries', () => {
    const stats = rebuildFromEntries('u1', [], NOW);
    expect(stats.total).toBe(0);
    expect(stats.totalEntries).toBe(0);
    expect(stats.heatmap).toEqual({});
    expect(stats.bestDay).toBeNull();
    expect(stats.bestSingleEntry).toBeNull();
    expect(stats.currentStreak).toBe(0);
  });

  it('correctly computes stats from a list of entries', () => {
    const entries = [
      { timestamp: '2026-04-03T08:00:00.000Z', reps: 20 }, // Fri, 10:00 CEST
      { timestamp: '2026-04-03T14:00:00.000Z', reps: 30 }, // Fri, 16:00 CEST
      { timestamp: '2026-04-04T09:00:00.000Z', reps: 15 }, // Sat, 11:00 CEST
      { timestamp: '2026-04-05T14:30:00.000Z', reps: 25 }, // Sun, 16:30 CEST
    ];

    const stats = rebuildFromEntries('u1', entries, NOW);

    expect(stats.userId).toBe('u1');
    expect(stats.total).toBe(90); // 20+30+15+25
    expect(stats.totalEntries).toBe(4);

    // Daily: last entry is 2026-04-05
    expect(stats.dailyKey).toBe('2026-04-05');
    expect(stats.dailyReps).toBe(25);

    // Weekly: all in W14
    expect(stats.weeklyKey).toBe('2026-W14');
    expect(stats.weeklyReps).toBe(90);

    // Monthly: all in April
    expect(stats.monthlyKey).toBe('2026-04');
    expect(stats.monthlyReps).toBe(90);

    // Streak: Apr 3 → 4 → 5 = 3 consecutive days
    expect(stats.currentStreak).toBe(3);
    expect(stats.lastEntryDate).toBe('2026-04-05');

    // Best day: Apr 3 has 50 reps (20+30)
    expect(stats.bestDay).toEqual({ date: '2026-04-03', total: 50 });

    // Best single entry: 30 reps
    expect(stats.bestSingleEntry).toEqual({
      reps: 30,
      timestamp: '2026-04-03T14:00:00.000Z',
    });

    // Heatmap
    expect(stats.heatmap['Fr-10']).toBe(20); // Apr 3 08:00 UTC = 10:00 CEST
    expect(stats.heatmap['Fr-16']).toBe(30); // Apr 3 14:00 UTC = 16:00 CEST
    expect(stats.heatmap['Sa-11']).toBe(15); // Apr 4 09:00 UTC = 11:00 CEST
    expect(stats.heatmap['So-16']).toBe(25); // Apr 5 14:30 UTC = 16:30 CEST

    expect(stats.updatedAt).toBe(NOW);
  });

  it('handles streak with gap (non-consecutive days)', () => {
    const entries = [
      { timestamp: '2026-04-01T10:00:00.000Z', reps: 10 }, // Wed
      { timestamp: '2026-04-02T10:00:00.000Z', reps: 10 }, // Thu
      // Gap: Apr 3
      { timestamp: '2026-04-04T10:00:00.000Z', reps: 10 }, // Sat
      { timestamp: '2026-04-05T10:00:00.000Z', reps: 10 }, // Sun
    ];

    const stats = rebuildFromEntries('u1', entries, NOW);
    expect(stats.currentStreak).toBe(2); // Apr 4-5
    expect(stats.total).toBe(40);
    expect(stats.totalEntries).toBe(4);
  });

  it('correctly identifies best day across multiple days', () => {
    const entries = [
      { timestamp: '2026-04-01T10:00:00.000Z', reps: 50 },
      { timestamp: '2026-04-02T10:00:00.000Z', reps: 20 },
      { timestamp: '2026-04-02T14:00:00.000Z', reps: 40 },
    ];

    const stats = rebuildFromEntries('u1', entries, NOW);
    // Apr 2: 20+40=60 > Apr 1: 50
    expect(stats.bestDay).toEqual({ date: '2026-04-02', total: 60 });
  });
});
