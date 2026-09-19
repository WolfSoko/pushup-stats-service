/**
 * @jest-environment ../../../../../tools/jest/timezone-environment.cjs
 * @jest-environment-options {"timezone": "America/New_York"}
 */
import {
  planExerciseLoggedTotal,
  PlanExerciseEntryLike,
} from './training-plan-exercise.models';

/**
 * `dayActivatedAt` is stored as `toISOString()` while a plan day's date
 * and the entry timestamps are local, so west of UTC the two disagree
 * about which day an evening activation belongs to. The CI runner is
 * UTC, where that can never show — hence the pinned timezone.
 */
describe('planExerciseLoggedTotal west of UTC', () => {
  const entry = (timestamp: string, reps: number): PlanExerciseEntryLike => ({
    exerciseId: 'legs.squats',
    timestamp,
    reps,
  });

  it('should keep cutting entries off when the plan was activated in the local evening', () => {
    // given — 20:30 local on 2026-04-01 is already 2026-04-02 in UTC,
    // which is the shape `dayActivatedAt` is written in
    const activatedAt = '2026-04-02T00:30:00.000Z';
    const entries = [
      entry('2026-04-01T19:00-04:00', 20),
      entry('2026-04-01T21:00-04:00', 25),
    ];

    // when
    const total = planExerciseLoggedTotal(
      entries,
      '2026-04-01',
      { exerciseId: 'legs.squats' },
      activatedAt
    );

    // then — the reps from before the activation stay excluded
    expect(total).toBe(25);
  });
});
