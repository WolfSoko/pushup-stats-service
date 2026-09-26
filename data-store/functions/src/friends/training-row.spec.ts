import { describe, expect, it } from '@jest/globals';
import { rebuildTrainingStats, type TrainingLine } from '@pu-stats/models';

import { metricValue } from './leaderboard';
import { trainingRowOf } from './training-row';

const TODAY = '2026-09-26';
const KEYS = {
  dailyKey: TODAY,
  weeklyKey: '2026-W39',
  monthlyKey: '2026-09',
};

function line(
  exerciseId: string,
  timestamp: string,
  value: Partial<TrainingLine>
): TrainingLine {
  return { exerciseId, timestamp, xp: 0, ...value };
}

// Fr 2026-09-25 plank, Sa 2026-09-26 run, and a pushup day a month earlier.
const STATS = rebuildTrainingStats('u1', [
  line('pushup', '2026-08-20T08:00:00+02:00', { reps: 20 }),
  line('plank.standard', '2026-09-25T08:00:00+02:00', { durationSec: 60 }),
  line('cardio.running', '2026-09-26T08:00:00+02:00', { distanceM: 3000 }),
]);

function row(period: 'daily' | 'week' | 'month' | 'allTime') {
  return {
    uid: 'u1',
    displayName: null,
    ui: undefined,
    isViewer: true,
    ...trainingRowOf(STATS, period, TODAY),
  };
}

describe('trainingRowOf', () => {
  it('should count training days of every exercise, all time', () => {
    // then
    expect(metricValue(row('allTime'), 'days', 'allTime', KEYS)).toBe(3);
  });

  it('should count the days of the current week and month from the day map', () => {
    // then — the ISO week starts on Monday 2026-09-21
    expect(metricValue(row('week'), 'days', 'week', KEYS)).toBe(2);
    expect(metricValue(row('month'), 'days', 'month', KEYS)).toBe(2);
  });

  it('should count today as a training day once anything was logged', () => {
    // then
    expect(metricValue(row('daily'), 'days', 'daily', KEYS)).toBe(1);
  });

  it('should keep a streak alive across different exercises', () => {
    // then
    expect(metricValue(row('allTime'), 'streak', 'allTime', KEYS)).toBe(2);
  });
});
