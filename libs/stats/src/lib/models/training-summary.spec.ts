import {
  EMPTY_TRAINING_SUMMARY,
  summarizeTraining,
  type TrainingSummaryEntry,
} from './training-summary';

const TODAY = '2026-09-26';

function entry(
  exerciseId: string,
  timestamp: string,
  value: Partial<TrainingSummaryEntry> = {}
): TrainingSummaryEntry {
  return { exerciseId, timestamp, ...value };
}

describe('summarizeTraining', () => {
  it('should return the empty summary when nothing was logged', () => {
    // when
    const summary = summarizeTraining([], TODAY);

    // then
    expect(summary).toEqual(EMPTY_TRAINING_SUMMARY);
  });

  it('should sum reps, seconds and metres per unit across exercises', () => {
    // given
    const entries = [
      entry('pushup', '2026-09-20T08:00:00+02:00', { reps: 30 }),
      entry('abs.situps', '2026-09-21T08:00:00+02:00', { reps: 20 }),
      entry('plank.standard', '2026-09-21T09:00:00+02:00', {
        durationSec: 90,
      }),
      entry('cardio.running', '2026-09-22T18:00:00+02:00', {
        distanceM: 5000,
        durationSec: 1800,
      }),
    ];

    // when
    const summary = summarizeTraining(entries, TODAY);

    // then
    expect(summary.reps).toBe(50);
    expect(summary.durationSec).toBe(90);
    expect(summary.distanceM).toBe(5000);
    expect(summary.entries).toBe(4);
    expect(summary.days).toBe(3);
  });

  it('should count a training day once however many exercises it holds', () => {
    // given
    const entries = [
      entry('pushup', '2026-09-25T08:00:00+02:00', { reps: 10 }),
      entry('abs.situps', '2026-09-25T20:00:00+02:00', { reps: 10 }),
    ];

    // when
    const summary = summarizeTraining(entries, TODAY);

    // then
    expect(summary.days).toBe(1);
    expect(summary.entries).toBe(2);
  });

  it('should bucket days in Berlin time', () => {
    // given
    const lateUtc = entry('pushup', '2026-09-24T22:30:00Z', { reps: 10 });

    // when
    const summary = summarizeTraining([lateUtc], '2026-09-25');

    // then
    expect(summary.currentStreak).toBe(1);
  });

  it('should keep a streak alive across different exercises', () => {
    // given
    const entries = [
      entry('pushup', '2026-09-23T08:00:00+02:00', { reps: 10 }),
      entry('plank.standard', '2026-09-24T08:00:00+02:00', {
        durationSec: 60,
      }),
      entry('cardio.running', '2026-09-25T08:00:00+02:00', {
        distanceM: 3000,
      }),
    ];

    // when
    const summary = summarizeTraining(entries, TODAY);

    // then
    expect(summary.currentStreak).toBe(3);
  });

  it('should drop the streak when the last training day is older than yesterday', () => {
    // given
    const entries = [
      entry('pushup', '2026-09-23T08:00:00+02:00', { reps: 10 }),
    ];

    // when
    const summary = summarizeTraining(entries, TODAY);

    // then
    expect(summary.currentStreak).toBe(0);
  });

  it('should skip unknown exercises and unparsable timestamps', () => {
    // given
    const entries = [
      entry('retired.exercise', '2026-09-25T08:00:00+02:00', { reps: 10 }),
      entry('pushup', 'not-a-date', { reps: 10 }),
    ];

    // when
    const summary = summarizeTraining(entries, TODAY);

    // then
    expect(summary).toEqual(EMPTY_TRAINING_SUMMARY);
  });

  it('should report the best entry and the best day in XP', () => {
    // given
    const entries = [
      entry('pushup', '2026-09-24T08:00:00+02:00', { reps: 40 }),
      entry('pushup', '2026-09-25T08:00:00+02:00', { reps: 30 }),
      entry('pushup', '2026-09-25T18:00:00+02:00', { reps: 30 }),
    ];

    // when
    const summary = summarizeTraining(entries, TODAY, (e) => e.reps ?? 0);

    // then
    expect(summary.bestEntryXp).toBe(40);
    expect(summary.bestDayXp).toBe(60);
  });
});
