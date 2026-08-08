import {
  isCheckoffDay,
  isPlanDayFulfilled,
  parsePlanDayItemId,
  planDayExercises,
  planDayItemId,
  planDayProgress,
  planExerciseEntryPayload,
  planExerciseLoggedTotal,
  PlanExerciseEntryLike,
} from './training-plan-exercise.models';
import { TrainingPlanDay } from './training-plan.models';

const entry = (
  exerciseId: string,
  timestamp: string,
  values: Partial<Pick<PlanExerciseEntryLike, 'reps' | 'durationSec'>>
): PlanExerciseEntryLike => ({ exerciseId, timestamp, ...values });

const circuitDay: TrainingPlanDay = {
  dayIndex: 2,
  kind: 'main',
  targetReps: 30,
  sets: [10, 10, 10],
  description: 'Zirkel',
  exercises: [
    { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
    { exerciseId: 'legs.squats', target: 45, sets: [15, 15, 15] },
    { exerciseId: 'plank.standard', target: 90, sets: [30, 30, 30] },
  ],
};

describe('training-plan exercise items', () => {
  describe('planDayExercises', () => {
    it('should return the structured list when the day defines one', () => {
      // given / when
      const items = planDayExercises(circuitDay);
      // then
      expect(items).toBe(circuitDay.exercises);
    });

    it('should derive a single pushup item for a legacy single-exercise day', () => {
      // given
      const day: TrainingPlanDay = {
        dayIndex: 1,
        kind: 'main',
        targetReps: 30,
        sets: [10, 10, 10],
        description: '',
      };
      // when
      const items = planDayExercises(day);
      // then
      expect(items).toEqual([
        { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
      ]);
    });

    it('should carry the day exercise and variant into the derived item', () => {
      // given
      const day: TrainingPlanDay = {
        dayIndex: 1,
        kind: 'main',
        targetReps: 40,
        exerciseId: 'legs.squats',
        variantId: 'sumo',
        description: '',
      };
      // when
      const [item] = planDayExercises(day);
      // then
      expect(item).toEqual({
        exerciseId: 'legs.squats',
        target: 40,
        variantId: 'sumo',
      });
    });

    it('should return a stable reference for repeated derivations', () => {
      // given — computed signals re-read this; a fresh array each call would
      // defeat downstream equality checks
      const day: TrainingPlanDay = {
        dayIndex: 1,
        kind: 'main',
        targetReps: 20,
        description: '',
      };
      // when / then
      expect(planDayExercises(day)).toBe(planDayExercises(day));
    });

    it('should return nothing for rest days and zero-target days', () => {
      // given / when / then
      expect(
        planDayExercises({
          dayIndex: 3,
          kind: 'rest',
          targetReps: 0,
          description: '',
        })
      ).toEqual([]);
      expect(
        planDayExercises({
          dayIndex: 3,
          kind: 'main',
          targetReps: 0,
          description: '',
        })
      ).toEqual([]);
    });
  });

  describe('planDayItemId', () => {
    it('should round-trip through parsePlanDayItemId', () => {
      // given / when
      const id = planDayItemId(12, 3);
      // then
      expect(id).toBe('12:3');
      expect(parsePlanDayItemId(id)).toEqual({ dayIndex: 12, itemIndex: 3 });
    });

    it('should return null for malformed ids', () => {
      // given / when / then
      expect(parsePlanDayItemId('12')).toBeNull();
      expect(parsePlanDayItemId('a:b')).toBeNull();
      expect(parsePlanDayItemId('')).toBeNull();
    });
  });

  describe('planExerciseLoggedTotal', () => {
    const entries = [
      entry('legs.squats', '2026-04-01T12:00:00+02:00', { reps: 20 }),
      entry('legs.squats', '2026-04-01T18:00:00+02:00', { reps: 25 }),
      entry('legs.squats', '2026-04-02T09:00:00+02:00', { reps: 40 }),
      entry('plank.standard', '2026-04-01T12:00:00+02:00', { durationSec: 60 }),
    ];

    it('should sum reps of the matching exercise on the given date', () => {
      // given / when
      const total = planExerciseLoggedTotal(entries, '2026-04-01', {
        exerciseId: 'legs.squats',
      });
      // then
      expect(total).toBe(45);
    });

    it('should read durationSec for a time-measured exercise', () => {
      // given / when
      const total = planExerciseLoggedTotal(entries, '2026-04-01', {
        exerciseId: 'plank.standard',
      });
      // then
      expect(total).toBe(60);
    });

    it('should return 0 for an unknown exercise', () => {
      // given / when
      const total = planExerciseLoggedTotal(entries, '2026-04-01', {
        exerciseId: 'not.a.thing',
      });
      // then
      expect(total).toBe(0);
    });

    it('should exclude entries logged before dayActivatedAt when it falls on the same date', () => {
      // given — a jump/switch happened at 15:00; only reps logged after
      // that instant should count toward the day that now owns this date
      const sameDayEntries = [
        entry('legs.squats', '2026-04-01T12:00:00+02:00', { reps: 20 }),
        entry('legs.squats', '2026-04-01T16:00:00+02:00', { reps: 25 }),
      ];
      // when
      const total = planExerciseLoggedTotal(
        sameDayEntries,
        '2026-04-01',
        { exerciseId: 'legs.squats' },
        '2026-04-01T15:00:00+02:00'
      );
      // then — only the post-activation entry counts
      expect(total).toBe(25);
    });

    it('should ignore dayActivatedAt when it falls on a different date', () => {
      // given — the plan was last (re)activated on an earlier date, so
      // today's normal Quick-Add crediting is unaffected
      // when
      const total = planExerciseLoggedTotal(
        entries,
        '2026-04-01',
        { exerciseId: 'legs.squats' },
        '2026-03-30T08:00:00+02:00'
      );
      // then
      expect(total).toBe(45);
    });
  });

  describe('planDayProgress', () => {
    const args = (
      entries: PlanExerciseEntryLike[],
      completedItems: string[] = []
    ) => ({ entries, dateIso: '2026-04-01', completedItems });

    it('should fulfill items whose target is covered by logged entries', () => {
      // given
      const entries = [
        entry('legs.squats', '2026-04-01T10:00:00+02:00', { reps: 45 }),
      ];
      // when
      const progress = planDayProgress(circuitDay, 2, args(entries));
      // then
      expect(progress.map((p) => p.done)).toEqual([false, true, false]);
      expect(progress[1].fulfilledByEntries).toBe(true);
    });

    it('should treat a manually checked item as done', () => {
      // given
      const progress = planDayProgress(circuitDay, 2, args([], ['2:0']));
      // when / then
      expect(progress[0].done).toBe(true);
      expect(progress[0].checkedOff).toBe(true);
      expect(progress[0].fulfilledByEntries).toBe(false);
    });

    it('should draw duplicate exercises from one pool in list order', () => {
      // given — Plank and Side Plank both resolve to `plank.standard`
      const day: TrainingPlanDay = {
        dayIndex: 15,
        kind: 'main',
        targetReps: 0,
        description: '',
        exercises: [
          { exerciseId: 'plank.standard', target: 150 },
          { exerciseId: 'plank.standard', target: 180, variantId: 'side' },
        ],
      };
      const entries = [
        entry('plank.standard', '2026-04-01T10:00:00+02:00', {
          durationSec: 200,
        }),
      ];
      // when
      const progress = planDayProgress(day, 15, args(entries));
      // then
      expect(progress[0]).toMatchObject({ logged: 150, done: true });
      expect(progress[1]).toMatchObject({ logged: 50, done: false });
    });

    it('should not draw the pool for a hand-ticked duplicate exercise', () => {
      // given — Plank and Side Plank share `plank.standard`; the first is
      // ticked off by hand and the second is covered by logged time
      const day: TrainingPlanDay = {
        dayIndex: 15,
        kind: 'main',
        targetReps: 0,
        description: '',
        exercises: [
          { exerciseId: 'plank.standard', target: 150 },
          { exerciseId: 'plank.standard', target: 180, variantId: 'side' },
        ],
      };
      const entries = [
        entry('plank.standard', '2026-04-01T10:00:00+02:00', {
          durationSec: 180,
        }),
      ];
      // when
      const progress = planDayProgress(day, 15, args(entries, ['15:0']));
      // then — the ticked item must not swallow the seconds the second needs
      expect(progress[0]).toMatchObject({ done: true, checkedOff: true });
      expect(progress[1]).toMatchObject({ logged: 180, done: true });
    });

    it('should credit a hand-ticked exercise in full', () => {
      // given
      const progress = planDayProgress(circuitDay, 2, args([], ['2:1']));
      // when / then — the row renders as complete, not as "0 / 45"
      expect(progress[1]).toMatchObject({
        logged: 45,
        done: true,
        checkedOff: true,
        fulfilledByEntries: false,
      });
    });

    it('should never derive fulfillment on a checkoff day', () => {
      // given
      const day: TrainingPlanDay = {
        ...circuitDay,
        completion: 'checkoff',
      };
      const entries = [
        entry('legs.squats', '2026-04-01T10:00:00+02:00', { reps: 100 }),
      ];
      // when
      const progress = planDayProgress(day, 2, args(entries));
      // then
      expect(progress.every((p) => !p.done)).toBe(true);
    });

    it('should not fulfill a day from entries logged before it was activated today', () => {
      // given — the circuit day's pushup target (30) was already met by an
      // entry logged this morning, before the plan was (re)activated at
      // noon (e.g. completing yesterday's slot then jumping to this one)
      const entries = [
        entry('pushup', '2026-04-01T09:00:00+02:00', { reps: 30 }),
      ];
      // when
      const progress = planDayProgress(circuitDay, 2, {
        ...args(entries),
        dayActivatedAt: '2026-04-01T12:00:00+02:00',
      });
      // then — the pre-activation reps don't count; a fresh entry would
      const [pushupItem] = progress;
      expect(pushupItem.logged).toBe(0);
      expect(pushupItem.done).toBe(false);
    });

    it('should leave an unquantified checkoff item undone until ticked', () => {
      // given
      const day: TrainingPlanDay = {
        dayIndex: 1,
        kind: 'main',
        targetReps: 30,
        completion: 'checkoff',
        description: '',
        exercises: [
          { exerciseId: 'pushup', target: 30 },
          { exerciseId: 'cardio.burpees', target: 0 },
        ],
      };
      // when
      const progress = planDayProgress(day, 1, args([], ['1:1']));
      // then
      expect(progress.map((p) => p.done)).toEqual([false, true]);
    });
  });

  describe('isPlanDayFulfilled', () => {
    it('should be true only when every item is done', () => {
      // given
      const entries = [
        entry('pushup', '2026-04-01T10:00:00+02:00', { reps: 30 }),
        entry('legs.squats', '2026-04-01T10:00:00+02:00', { reps: 45 }),
        entry('plank.standard', '2026-04-01T10:00:00+02:00', {
          durationSec: 90,
        }),
      ];
      const dayArgs = {
        entries,
        dateIso: '2026-04-01',
        completedItems: [] as string[],
      };
      // when
      const full = planDayProgress(circuitDay, 2, dayArgs);
      const partial = planDayProgress(circuitDay, 2, {
        ...dayArgs,
        entries: entries.slice(0, 2),
      });
      // then
      expect(isPlanDayFulfilled(full)).toBe(true);
      expect(isPlanDayFulfilled(partial)).toBe(false);
    });

    it('should be false for a day without exercises', () => {
      // given / when / then
      expect(isPlanDayFulfilled([])).toBe(false);
    });
  });

  describe('isCheckoffDay', () => {
    it('should default to metrics when the day names no mode', () => {
      // given / when / then
      expect(isCheckoffDay({ completion: undefined })).toBe(false);
      expect(isCheckoffDay({ completion: 'checkoff' })).toBe(true);
    });
  });

  describe('planExerciseEntryPayload', () => {
    it('should keep the prescribed breakdown when nothing is logged', () => {
      // given / when
      const payload = planExerciseEntryPayload(
        { exerciseId: 'legs.squats', target: 45, sets: [15, 15, 15] },
        0
      );
      // then
      expect(payload).toEqual({
        exerciseId: 'legs.squats',
        valueField: 'reps',
        value: 45,
        breakdownField: 'sets',
        breakdown: [15, 15, 15],
      });
    });

    it('should top up the remainder as one set when partially logged', () => {
      // given / when
      const payload = planExerciseEntryPayload(
        { exerciseId: 'legs.squats', target: 45, sets: [15, 15, 15] },
        30
      );
      // then
      expect(payload).toMatchObject({ value: 15, breakdown: [15] });
    });

    it('should write durationSec and intervals for a time-measured item', () => {
      // given / when
      const payload = planExerciseEntryPayload(
        { exerciseId: 'plank.standard', target: 90, sets: [30, 30, 30] },
        0
      );
      // then
      expect(payload).toMatchObject({
        valueField: 'durationSec',
        value: 90,
        breakdownField: 'intervals',
        breakdown: [30, 30, 30],
      });
    });

    it('should carry the variant through to the payload', () => {
      // given / when
      const payload = planExerciseEntryPayload(
        { exerciseId: 'legs.squats', target: 20, variantId: 'sumo' },
        0
      );
      // then
      expect(payload?.variantId).toBe('sumo');
    });

    it('should return null when the item is already covered', () => {
      // given / when / then
      expect(
        planExerciseEntryPayload({ exerciseId: 'legs.squats', target: 45 }, 45)
      ).toBeNull();
    });

    it('should return null for an unquantified or unknown item', () => {
      // given / when / then
      expect(
        planExerciseEntryPayload({ exerciseId: 'cardio.burpees', target: 0 }, 0)
      ).toBeNull();
      expect(
        planExerciseEntryPayload({ exerciseId: 'not.a.thing', target: 10 }, 0)
      ).toBeNull();
    });
  });
});
