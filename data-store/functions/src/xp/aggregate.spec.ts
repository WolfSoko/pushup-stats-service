import { describe, expect, it } from '@jest/globals';

import { applyXpChange, emptyUserXp, rebuildUserXp } from './aggregate';

const NOW = '2026-09-24T12:00:00+02:00';
const TODAY = '2026-09-24T08:00:00+02:00';
const LAST_MONTH = '2026-08-10T08:00:00+02:00';

describe('applyXpChange', () => {
  it('should add a booking to total, level, periods and exercise', () => {
    // given
    const current = emptyUserXp('u1', NOW);

    // when
    const next = applyXpChange(
      current,
      null,
      { exerciseId: 'pushup', timestamp: TODAY, xp: 150 },
      NOW
    );

    // then
    expect(next).toEqual(
      expect.objectContaining({
        total: 150,
        level: 2,
        dailyXp: 150,
        weeklyXp: 150,
        monthlyXp: 150,
        byExercise: { pushup: 150 },
      })
    );
  });

  it('should only count an old entry towards the total', () => {
    // when
    const next = applyXpChange(
      emptyUserXp('u1', NOW),
      null,
      { exerciseId: 'pushup', timestamp: LAST_MONTH, xp: 40 },
      NOW
    );

    // then
    expect(next.total).toBe(40);
    expect(next.dailyXp).toBe(0);
    expect(next.monthlyXp).toBe(0);
  });

  it('should move XP between periods when the timestamp changes', () => {
    // given
    const line = { exerciseId: 'pushup', timestamp: TODAY, xp: 30 };
    const booked = applyXpChange(emptyUserXp('u1', NOW), null, line, NOW);

    // when
    const moved = applyXpChange(
      booked,
      line,
      { ...line, timestamp: LAST_MONTH },
      NOW
    );

    // then
    expect(moved.total).toBe(30);
    expect(moved.dailyXp).toBe(0);
  });

  it('should drop an exercise when its XP is cancelled', () => {
    // given
    const line = { exerciseId: 'pushup', timestamp: TODAY, xp: 30 };
    const booked = applyXpChange(emptyUserXp('u1', NOW), null, line, NOW);

    // when
    const cancelled = applyXpChange(booked, line, null, NOW);

    // then
    expect(cancelled.total).toBe(0);
    expect(cancelled.byExercise).toEqual({});
  });

  it('should reset a stale daily bucket before adding', () => {
    // given — the aggregate was last written yesterday
    const yesterday = {
      ...emptyUserXp('u1', '2026-09-23T12:00:00+02:00'),
      dailyXp: 99,
    };

    // when
    const next = applyXpChange(
      yesterday,
      null,
      { exerciseId: 'pushup', timestamp: TODAY, xp: 5 },
      NOW
    );

    // then
    expect(next.dailyXp).toBe(5);
    expect(next.dailyKey).toBe('2026-09-24');
  });
});

describe('rebuildUserXp', () => {
  it('should sum every ledger line', () => {
    // when
    const xp = rebuildUserXp(
      'u1',
      [
        { exerciseId: 'pushup', timestamp: TODAY, xp: 100 },
        { exerciseId: 'pull.pullups', timestamp: LAST_MONTH, xp: 200 },
      ],
      NOW
    );

    // then
    expect(xp).toEqual(
      expect.objectContaining({
        total: 300,
        level: 3,
        dailyXp: 100,
        byExercise: { pushup: 100, 'pull.pullups': 200 },
      })
    );
  });
});
