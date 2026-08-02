import { nextSkippedDays } from './user-training-plan.jump';

describe('nextSkippedDays', () => {
  const args = { targetDayIndex: 5, nonRestDaysBeforeTarget: [1, 3, 4] };

  it('should bulk-skip every non-rest predecessor that is not completed', () => {
    // given
    const baseline = { completedDays: [1], skippedDays: [] };
    // when
    const skipped = nextSkippedDays(baseline, args);
    // then
    expect(skipped).toEqual([3, 4]);
  });

  it('should keep prior skips that still sit before the new cursor', () => {
    // given
    const baseline = { completedDays: [], skippedDays: [2, 7] };
    // when
    const skipped = nextSkippedDays(baseline, args);
    // then
    expect(skipped).toEqual([1, 2, 3, 4]);
  });

  it('should never skip a day that is already completed', () => {
    // given
    const baseline = { completedDays: [3], skippedDays: [3] };
    // when
    const skipped = nextSkippedDays(baseline, args);
    // then
    expect(skipped).not.toContain(3);
  });

  it('should treat a missing document as an empty baseline', () => {
    // given / when
    const skipped = nextSkippedDays(null, args);
    // then
    expect(skipped).toEqual([1, 3, 4]);
  });
});
