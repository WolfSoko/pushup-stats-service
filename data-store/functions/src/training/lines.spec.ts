import { describe, expect, it } from '@jest/globals';

import { trainingLineOf } from './lines';

describe('trainingLineOf', () => {
  it('should price the entry at the configured rate', () => {
    // when
    const line = trainingLineOf(
      {
        exerciseId: 'pushup',
        timestamp: '2026-09-25T08:00:00+02:00',
        reps: 30,
      },
      { rates: { pushup: 2 } }
    );

    // then
    expect(line).toEqual({
      exerciseId: 'pushup',
      timestamp: '2026-09-25T08:00:00+02:00',
      reps: 30,
      durationSec: null,
      distanceM: null,
      xp: 60,
    });
  });

  it('should drop values of the wrong type', () => {
    // when
    const line = trainingLineOf(
      { exerciseId: 'pushup', timestamp: '2026-09-25T08:00:00Z', reps: '30' },
      null
    );

    // then
    expect(line?.reps).toBeNull();
    expect(line?.xp).toBe(0);
  });

  it.each([
    ['a missing document', undefined],
    ['a missing exercise', { timestamp: '2026-09-25T08:00:00Z' }],
    ['a missing timestamp', { exerciseId: 'pushup' }],
  ])('should return null for %s', (_label, entry) => {
    // then
    expect(trainingLineOf(entry, null)).toBeNull();
  });
});
