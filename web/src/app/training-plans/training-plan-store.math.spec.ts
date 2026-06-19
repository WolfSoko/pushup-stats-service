import { TrainingPlan, TrainingPlanDay } from '@pu-stats/models';
import { toLocalIsoDate } from '@pu-stats/date';
import {
  addToSet,
  computeCompletionPercent,
  nonRestDaysBeforeTarget,
  planDayDate,
  planDayRepsPayload,
  removeFromSet,
  sumRepsLoggedOn,
} from './training-plan-store.math';

const plan: TrainingPlan = {
  id: 'p',
  slug: 'p',
  title: 'P',
  summary: 's',
  level: 'beginner',
  totalDays: 5,
  days: [
    {
      dayIndex: 1,
      kind: 'main',
      targetReps: 10,
      sets: [10],
      description: 'd1',
    },
    { dayIndex: 2, kind: 'rest', targetReps: 0, description: 'rest' },
    {
      dayIndex: 3,
      kind: 'main',
      targetReps: 20,
      sets: [20],
      description: 'd3',
    },
    {
      dayIndex: 4,
      kind: 'main',
      targetReps: 30,
      sets: [30],
      description: 'd4',
    },
    { dayIndex: 5, kind: 'rest', targetReps: 0, description: 'rest' },
  ],
};

describe('planDayDate', () => {
  it('should resolve the calendar date for a 1-based day index', () => {
    // given a start date and a target day offset
    // when resolving the date for day 3
    const result = planDayDate('2026-06-01', 3);
    // then it is start + 2 days, formatted as a local ISO date
    expect(result).toBe(toLocalIsoDate(new Date(2026, 5, 3)));
  });

  it('should return day 1 as the start date itself', () => {
    // given a start date
    // when resolving day 1
    const result = planDayDate('2026-06-01', 1);
    // then it equals the start date
    expect(result).toBe(toLocalIsoDate(new Date(2026, 5, 1)));
  });

  it('should fall back to today when startDate is null', () => {
    // given no start date
    // when resolving any day
    const result = planDayDate(null, 4);
    // then it returns a valid ISO date (today's Berlin date)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should fall back to today when startDate is unparseable', () => {
    // given a malformed start date
    // when resolving a day
    const result = planDayDate('not-a-date', 2);
    // then it returns a valid ISO date rather than NaN
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should reject an impossible calendar date that would overflow', () => {
    // given Feb 30 (overflows to March in the Date constructor)
    // when resolving day 1
    const result = planDayDate('2026-02-30', 1);
    // then it does not silently shift into March; falls back to today
    expect(result).not.toBe(toLocalIsoDate(new Date(2026, 2, 2)));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should cross a month boundary correctly', () => {
    // given a late-month start
    // when adding enough days to spill into the next month
    const result = planDayDate('2026-01-30', 4);
    // then it lands in February
    expect(result).toBe(toLocalIsoDate(new Date(2026, 1, 2)));
  });
});

describe('sumRepsLoggedOn', () => {
  const entries = [
    { exerciseId: 'pushup', timestamp: '2026-06-01T12:00:00Z', reps: 10 },
    { exerciseId: 'pushup', timestamp: '2026-06-01T18:00:00Z', reps: 5 },
    { exerciseId: 'pushup', timestamp: '2026-06-02T12:00:00Z', reps: 7 },
    { exerciseId: 'legs.squats', timestamp: '2026-06-01T12:00:00Z', reps: 99 },
    { exerciseId: 'pushup', timestamp: '2026-06-01T09:00:00Z' },
  ];

  it('should sum reps for one exercise on one date', () => {
    // given mixed entries
    // when summing pushups on 2026-06-01
    const result = sumRepsLoggedOn(entries, '2026-06-01', 'pushup');
    // then only same-exercise, same-date reps count (missing reps -> 0)
    expect(result).toBe(15);
  });

  it('should ignore other exercises on the same date', () => {
    // given a squats entry on the date
    // when summing pushups
    const result = sumRepsLoggedOn(entries, '2026-06-01', 'pushup');
    // then the squats reps are excluded
    expect(result).not.toBe(114);
  });

  it('should return 0 when nothing matches', () => {
    // given no entries on the queried date
    // when summing
    const result = sumRepsLoggedOn(entries, '2026-12-31', 'pushup');
    // then the total is 0
    expect(result).toBe(0);
  });

  it('should treat a missing reps field as 0', () => {
    // given an entry without reps
    // when it is the only match
    const result = sumRepsLoggedOn(
      [{ exerciseId: 'pushup', timestamp: '2026-06-03T12:00:00Z' }],
      '2026-06-03',
      'pushup'
    );
    // then it contributes 0
    expect(result).toBe(0);
  });
});

describe('computeCompletionPercent', () => {
  it('should count only non-rest, non-skipped days in the denominator', () => {
    // given a plan with 3 working days, 1 completed
    // when computing percent with no skips
    const result = computeCompletionPercent(plan, [1], []);
    // then 1 of 3 working days -> 33%
    expect(result).toBe(33);
  });

  it('should exclude skipped days from the denominator', () => {
    // given day 4 skipped and day 1 completed
    // when computing percent
    const result = computeCompletionPercent(plan, [1], [4]);
    // then 1 of 2 remaining working days -> 50%
    expect(result).toBe(50);
  });

  it('should ignore rest-day indexes leaking into completedDays', () => {
    // given a rest day (2) erroneously in completedDays
    // when computing percent
    const result = computeCompletionPercent(plan, [1, 2], []);
    // then the rest day does not inflate progress beyond 1/3
    expect(result).toBe(33);
  });

  it('should cap at 100', () => {
    // given all working days completed
    // when computing percent
    const result = computeCompletionPercent(plan, [1, 3, 4], []);
    // then it is exactly 100
    expect(result).toBe(100);
  });

  it('should return 0 when every working day is skipped', () => {
    // given all working days skipped (empty denominator)
    // when computing percent
    const result = computeCompletionPercent(plan, [], [1, 3, 4]);
    // then it is 0, not NaN
    expect(result).toBe(0);
  });
});

describe('nonRestDaysBeforeTarget', () => {
  it('should list non-rest day indexes strictly before the target', () => {
    // given a target of day 4
    // when collecting earlier non-rest days
    const result = nonRestDaysBeforeTarget(plan, 4);
    // then rest day 2 is excluded and day 4 itself is excluded
    expect(result).toEqual([1, 3]);
  });

  it('should be empty when targeting day 1', () => {
    // given the first day as target
    // when collecting earlier days
    const result = nonRestDaysBeforeTarget(plan, 1);
    // then there are none
    expect(result).toEqual([]);
  });
});

describe('addToSet / removeFromSet', () => {
  it('should add a value without mutating the original set', () => {
    // given an existing set
    const original = new Set([1, 2]);
    // when adding a value
    const next = addToSet(original, 3);
    // then a new set contains it and the original is unchanged
    expect([...next]).toEqual([1, 2, 3]);
    expect([...original]).toEqual([1, 2]);
  });

  it('should remove a value without mutating the original set', () => {
    // given an existing set
    const original = new Set([1, 2, 3]);
    // when removing a value
    const next = removeFromSet(original, 2);
    // then a new set excludes it and the original is unchanged
    expect([...next]).toEqual([1, 3]);
    expect([...original]).toEqual([1, 2, 3]);
  });
});

describe('planDayRepsPayload', () => {
  const day: TrainingPlanDay = {
    dayIndex: 1,
    kind: 'main',
    targetReps: 30,
    sets: [10, 10, 10],
    description: 'd',
  };

  it('should persist the prescribed sets when nothing is logged yet', () => {
    // given no prior reps
    // when computing the payload
    const result = planDayRepsPayload(day, 0);
    // then the full prescribed breakdown is preserved
    expect(result).toEqual({ reps: 30, sets: [10, 10, 10] });
  });

  it('should top up only the remainder as a single set when partially logged', () => {
    // given some reps already logged
    // when computing the payload
    const result = planDayRepsPayload(day, 18);
    // then it writes only the remaining 12 as one set
    expect(result).toEqual({ reps: 12, sets: [12] });
  });

  it('should fall back to a single set equal to target when sets are absent', () => {
    // given a day without an explicit set breakdown and nothing logged
    const noSets: TrainingPlanDay = {
      dayIndex: 1,
      kind: 'main',
      targetReps: 25,
      description: 'd',
    };
    // when computing the payload
    const result = planDayRepsPayload(noSets, 0);
    // then it uses one set of the full target
    expect(result).toEqual({ reps: 25, sets: [25] });
  });

  it('should return null when the day is already fully covered', () => {
    // given logged reps at or above target
    // when computing the payload
    expect(planDayRepsPayload(day, 30)).toBeNull();
    expect(planDayRepsPayload(day, 45)).toBeNull();
  });
});
