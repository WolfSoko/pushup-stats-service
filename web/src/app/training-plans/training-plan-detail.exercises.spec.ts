import { findPlanBySlug, PlanExerciseProgress } from '@pu-stats/models';
import {
  asCompletedRows,
  buildExerciseRows,
  previewDayProgress,
} from './training-plan-detail.exercises';

function progress(
  overrides: Partial<PlanExerciseProgress> &
    Pick<PlanExerciseProgress, 'exercise'>
): PlanExerciseProgress {
  return {
    itemIndex: 0,
    logged: 0,
    fulfilledByEntries: false,
    checkedOff: false,
    done: false,
    ...overrides,
  };
}

describe('buildExerciseRows', () => {
  it('should format a reps target and its set breakdown', () => {
    // given
    const item = progress({
      exercise: { exerciseId: 'legs.squats', target: 45, sets: [15, 15, 15] },
      logged: 15,
    });
    // when
    const [row] = buildExerciseRows([item]);
    // then
    expect(row).toMatchObject({
      target: '45',
      logged: '15',
      sets: '15 · 15 · 15',
      percent: 33,
      quantified: true,
    });
  });

  it('should format a time target as m:ss', () => {
    // given
    const item = progress({
      exercise: {
        exerciseId: 'plank.standard',
        target: 90,
        sets: [30, 30, 30],
      },
      logged: 60,
    });
    // when
    const [row] = buildExerciseRows([item]);
    // then
    expect(row.target).toBe('1:30');
    expect(row.logged).toBe('1:00');
    expect(row.sets).toBe('0:30 · 0:30 · 0:30');
  });

  it('should append the variant to the exercise name', () => {
    // given
    const item = progress({
      exercise: { exerciseId: 'legs.squats', target: 20, variantId: 'sumo' },
    });
    // when
    const [row] = buildExerciseRows([item]);
    // then
    expect(row.name).toContain('·');
  });

  it('should omit the breakdown for a single set', () => {
    // given
    const item = progress({
      exercise: { exerciseId: 'legs.squats', target: 20, sets: [20] },
    });
    // when
    const [row] = buildExerciseRows([item]);
    // then
    expect(row.sets).toBe('');
  });

  it('should mark an unquantified exercise as such', () => {
    // given — a HIIT round the plan names but does not quantify
    const item = progress({
      exercise: { exerciseId: 'cardio.burpees', target: 0 },
    });
    // when
    const [row] = buildExerciseRows([item]);
    // then
    expect(row).toMatchObject({
      quantified: false,
      target: '',
      logged: '',
      percent: 0,
    });
  });

  it('should cap the percentage at 100 when overshooting the target', () => {
    // given
    const item = progress({
      exercise: { exerciseId: 'legs.squats', target: 20 },
      logged: 40,
    });
    // when
    const [row] = buildExerciseRows([item]);
    // then
    expect(row.percent).toBe(100);
  });

  it('should carry the fulfillment flags through to the row', () => {
    // given
    const item = progress({
      exercise: { exerciseId: 'legs.squats', target: 20 },
      logged: 20,
      fulfilledByEntries: true,
      done: true,
    });
    // when
    const [row] = buildExerciseRows([item]);
    // then
    expect(row).toMatchObject({ done: true, auto: true });
  });
});

describe('asCompletedRows', () => {
  it('should mark every row as done', () => {
    // given
    const rows = buildExerciseRows([
      progress({ exercise: { exerciseId: 'legs.squats', target: 20 } }),
      progress({
        itemIndex: 1,
        exercise: { exerciseId: 'plank.standard', target: 60 },
      }),
    ]);
    // when
    const completed = asCompletedRows(rows);
    // then
    expect(completed.every((r) => r.done)).toBe(true);
    expect(rows.every((r) => !r.done)).toBe(true);
  });
});

describe('previewDayProgress', () => {
  it('should list a day at zero progress for an unstarted plan', () => {
    // given a real catalog plan the user has not activated
    const plan = findPlanBySlug('full-body-6w');
    expect(plan).not.toBeNull();
    if (!plan) return;
    // when
    const progress = previewDayProgress(plan, 2);
    // then the prescription is visible, nothing is done
    expect(progress.length).toBeGreaterThan(1);
    expect(progress.every((p) => !p.done && p.logged === 0)).toBe(true);
  });

  it('should return nothing for a day the plan does not have', () => {
    // given
    const plan = findPlanBySlug('full-body-6w');
    if (!plan) return;
    // when / then
    expect(previewDayProgress(plan, 999)).toEqual([]);
  });
});
