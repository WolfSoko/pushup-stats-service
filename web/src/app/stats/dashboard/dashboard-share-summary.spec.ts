import type { ExerciseEntry } from '@pu-stats/models';

import { dayExerciseTotals, formatDaySummary } from './dashboard-share-summary';

const TODAY = '2026-09-10';

function entry(
  exerciseId: string,
  value: Partial<Pick<ExerciseEntry, 'reps' | 'durationSec' | 'distanceM'>>,
  date = TODAY,
  hour = '10'
): ExerciseEntry {
  return {
    _id: `${exerciseId}-${date}-${hour}`,
    userId: 'u1',
    exerciseId,
    timestamp: `${date}T${hour}:00:00+02:00`,
    source: 'manual',
    ...value,
  } as unknown as ExerciseEntry;
}

describe('dayExerciseTotals', () => {
  it('should sum every exercise logged on the day in its own unit', () => {
    // given reps, a hold and a run
    const entries = [
      entry('pushup', { reps: 20 }),
      entry('pushup', { reps: 20 }, TODAY, '18'),
      entry('plank.standard', { durationSec: 120 }),
      entry('cardio.running', { distanceM: 5000, durationSec: 1500 }),
    ];

    // when
    const totals = dayExerciseTotals(entries, TODAY);

    // then
    expect(totals).toEqual([
      { exerciseId: 'pushup', value: 40, unit: 'reps' },
      { exerciseId: 'plank.standard', value: 120, unit: 's' },
      { exerciseId: 'cardio.running', value: 5000, unit: 'm' },
    ]);
  });

  it('should ignore entries from other days', () => {
    // given
    const entries = [
      entry('pushup', { reps: 40 }),
      entry('pushup', { reps: 100 }, '2026-09-09'),
    ];

    // when / then
    expect(dayExerciseTotals(entries, TODAY)).toEqual([
      { exerciseId: 'pushup', value: 40, unit: 'reps' },
    ]);
  });

  it('should put push-ups first whatever the logging order', () => {
    // given squats logged before push-ups
    const entries = [
      entry('legs.squats', { reps: 60 }),
      entry('pushup', { reps: 10 }, TODAY, '18'),
    ];

    // when
    const totals = dayExerciseTotals(entries, TODAY);

    // then
    expect(totals.map((t) => t.exerciseId)).toEqual(['pushup', 'legs.squats']);
  });

  it('should skip exercises the catalog does not know', () => {
    // given a retired or hand-written exercise id
    const entries = [entry('legacy.unknown', { reps: 30 })];

    // when / then
    expect(dayExerciseTotals(entries, TODAY)).toEqual([]);
  });

  it('should be empty for a day without entries', () => {
    // when / then
    expect(dayExerciseTotals([], TODAY)).toEqual([]);
  });
});

describe('formatDaySummary', () => {
  it('should read as one line with each exercise in its own unit', () => {
    // given
    const totals = [
      { exerciseId: 'pushup', value: 40, unit: 'reps' },
      { exerciseId: 'legs.squats', value: 60, unit: 'reps' },
      { exerciseId: 'plank.standard', value: 120, unit: 's' },
    ];

    // when / then — the test locale is the German source locale
    expect(formatDaySummary(totals)).toBe(
      '40 Liegestütze, 60 Kniebeugen, 2:00 Plank'
    );
  });

  it('should count the rest once the line would get long', () => {
    // given five exercises
    const totals = [
      { exerciseId: 'pushup', value: 40, unit: 'reps' },
      { exerciseId: 'legs.squats', value: 60, unit: 'reps' },
      { exerciseId: 'plank.standard', value: 120, unit: 's' },
      { exerciseId: 'abs.situps', value: 30, unit: 'reps' },
      { exerciseId: 'back.pullups', value: 8, unit: 'reps' },
    ];

    // when
    const line = formatDaySummary(totals);

    // then
    expect(line).toContain('40 Liegestütze');
    expect(line).toContain('+2');
    expect(line).not.toContain('Sit-ups');
  });

  it('should be empty without totals so callers can suppress the share', () => {
    // when / then
    expect(formatDaySummary([])).toBe('');
  });
});
