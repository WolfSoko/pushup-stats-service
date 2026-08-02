import type { ComplexGoalEntry } from '@pu-stats/models';
import {
  aggregateGoalPercent,
  allGoalsReached,
  dailyGoalFillPayload,
  dailyGoalItemViews,
  goalProgressValues,
} from './daily-goal.helpers';

function goal(overrides: Partial<ComplexGoalEntry> = {}): ComplexGoalEntry {
  return {
    id: 'g1',
    exerciseId: 'pushup',
    target: 100,
    measurement: 'reps',
    unit: 'reps',
    ...overrides,
  };
}

describe('dailyGoalItemViews', () => {
  it('should format progress, target and remaining in the goal unit', () => {
    // given a time goal that is half done
    const entries = [
      goal({
        id: 'plank',
        exerciseId: 'plank.standard',
        target: 120,
        measurement: 'time',
        unit: 's',
      }),
    ];

    // when
    const [item] = dailyGoalItemViews(entries, [60]);

    // then
    expect(item.targetDisplay).toBe('2:00');
    expect(item.progressDisplay).toBe('1:00');
    expect(item.remainingDisplay).toBe('1:00');
    expect(item.remaining).toBe(60);
    expect(item.percent).toBe(50);
    expect(item.reached).toBe(false);
  });

  it('should cap a blown-out goal at 100% and flag it reached', () => {
    // given / when
    const [item] = dailyGoalItemViews([goal()], [250]);

    // then
    expect(item.percent).toBe(100);
    expect(item.reached).toBe(true);
    expect(item.remaining).toBe(0);
  });

  it('should mark a goal whose entry needs a companion value as not fillable', () => {
    // given a run (distance + duration) and a plain rep goal
    const entries = [
      goal({
        id: 'run',
        exerciseId: 'cardio.running',
        target: 2000,
        measurement: 'distance-time',
        unit: 'm',
      }),
      goal({ id: 'pu' }),
    ];

    // when
    const items = dailyGoalItemViews(entries, [0, 0]);

    // then only the rep goal can be closed with a one-click entry
    expect(items[0].fillable).toBe(false);
    expect(items[1].fillable).toBe(true);
  });

  it('should carry the exercise name of the pushup sentinel', () => {
    // given / when
    const [item] = dailyGoalItemViews([goal()], [0]);

    // then
    expect(item.exerciseName).toBe('Liegestütze');
    expect(item.exerciseId).toBe('pushup');
  });
});

describe('goalProgressValues', () => {
  it('should read the entry field that matches each goal measurement', () => {
    // given one rep goal and one time goal
    const entries = [
      goal(),
      goal({
        id: 'plank',
        exerciseId: 'plank.standard',
        target: 120,
        measurement: 'time',
        unit: 's',
      }),
    ];

    // when
    const progress = goalProgressValues(entries, [
      { exerciseId: 'pushup', reps: 20 },
      { exerciseId: 'pushup', reps: 15 },
      { exerciseId: 'plank.standard', durationSec: 45 },
    ]);

    // then
    expect(progress).toEqual([35, 45]);
  });

  it('should count only the pinned variant when the goal names one', () => {
    // given a goal pinned to one variant
    const entries = [goal({ exerciseId: 'abs.situps', variantId: 'decline' })];

    // when
    const progress = goalProgressValues(entries, [
      { exerciseId: 'abs.situps', variantId: 'decline', reps: 10 },
      { exerciseId: 'abs.situps', reps: 30 },
    ]);

    // then
    expect(progress).toEqual([10]);
  });

  it('should count every variant when the goal pins none', () => {
    // given / when
    const progress = goalProgressValues(
      [goal({ exerciseId: 'abs.situps' })],
      [
        { exerciseId: 'abs.situps', variantId: 'decline', reps: 10 },
        { exerciseId: 'abs.situps', reps: 30 },
      ]
    );

    // then
    expect(progress).toEqual([40]);
  });
});

describe('aggregateGoalPercent', () => {
  it('should average the per-goal shares with each capped at 100%', () => {
    // given one goal massively overshot, one untouched
    // when
    const percent = aggregateGoalPercent(
      [goal(), goal({ id: 'g2' })],
      [500, 0]
    );

    // then the overshoot cannot mask the open goal
    expect(percent).toBe(50);
  });

  it('should ignore goals without a positive target', () => {
    // given / when
    const percent = aggregateGoalPercent(
      [goal(), goal({ id: 'g2', target: 0 })],
      [50, 0]
    );

    // then
    expect(percent).toBe(50);
  });
});

describe('allGoalsReached', () => {
  it('should be false while any goal is short', () => {
    expect(allGoalsReached([goal(), goal({ id: 'g2' })], [100, 99])).toBe(
      false
    );
  });

  it('should be true once every goal is covered', () => {
    expect(allGoalsReached([goal(), goal({ id: 'g2' })], [100, 120])).toBe(
      true
    );
  });

  it('should be false when no goal applies', () => {
    expect(allGoalsReached([], [])).toBe(false);
  });
});

describe('dailyGoalFillPayload', () => {
  it('should write the missing amount into the measurement field', () => {
    // given a plank goal 45 s short
    const [item] = dailyGoalItemViews(
      [
        goal({
          exerciseId: 'plank.standard',
          target: 120,
          measurement: 'time',
          unit: 's',
        }),
      ],
      [75]
    );

    // when
    const payload = dailyGoalFillPayload(item);

    // then
    expect(payload).toEqual({
      exerciseId: 'plank.standard',
      valueField: 'durationSec',
      value: 45,
      breakdownField: 'intervals',
      breakdown: [45],
    });
  });

  it('should clamp a gap larger than the exercise maximum', () => {
    // given a 900-rep pushup goal (catalog max is 500)
    const [item] = dailyGoalItemViews([goal({ target: 900 })], [0]);

    // when
    const payload = dailyGoalFillPayload(item);

    // then the entry stays writable; the rest closes on a second tick
    expect(payload?.value).toBe(500);
  });

  it('should return null for a reached goal', () => {
    // given / when
    const [item] = dailyGoalItemViews([goal()], [100]);

    // then
    expect(dailyGoalFillPayload(item)).toBeNull();
  });

  it('should return null for a goal that needs a companion value', () => {
    // given a running goal
    const [item] = dailyGoalItemViews(
      [
        goal({
          exerciseId: 'cardio.running',
          target: 2000,
          measurement: 'distance-time',
          unit: 'm',
        }),
      ],
      [0]
    );

    // then
    expect(dailyGoalFillPayload(item)).toBeNull();
  });

  it('should keep the pinned variant on the written entry', () => {
    // given / when
    const [item] = dailyGoalItemViews(
      [goal({ exerciseId: 'abs.situps', variantId: 'decline', target: 40 })],
      [10]
    );

    // then
    expect(dailyGoalFillPayload(item)).toMatchObject({
      exerciseId: 'abs.situps',
      variantId: 'decline',
      value: 30,
    });
  });
});
