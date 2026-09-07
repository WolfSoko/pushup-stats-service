import type { PublicProfileExercise } from '@pu-stats/models';

import {
  buildExerciseGroups,
  type ExerciseGroupKind,
} from './profile-view.model';

const exercise = (
  exerciseId: string,
  total: number,
  measurement: PublicProfileExercise['measurement']
): PublicProfileExercise => ({
  exerciseId,
  total,
  totalDays: 1,
  measurement,
});

const name = (e: PublicProfileExercise): string => e.exerciseId;
const value = (e: PublicProfileExercise): string => String(e.total);
const label = (kind: ExerciseGroupKind): string => `label:${kind}`;

const build = (exercises: ReadonlyArray<PublicProfileExercise>) =>
  buildExerciseGroups(exercises, name, value, label);

describe('buildExerciseGroups', () => {
  it('should split exercises into one group per measured dimension', () => {
    // given
    const exercises = [
      exercise('pushup', 100, 'reps'),
      exercise('plank.standard', 600, 'time'),
      exercise('cardio.run', 5000, 'distance'),
    ];

    // when
    const groups = build(exercises);

    // then
    expect(groups.map((g) => g.kind)).toEqual(['reps', 'time', 'distance']);
  });

  it('should order the groups reps, time, distance, weight regardless of input order', () => {
    // given — the server sends whatever order the aggregation produced
    const exercises = [
      exercise('carry', 20, 'weight'),
      exercise('cardio.run', 5000, 'distance'),
      exercise('pushup', 100, 'reps'),
      exercise('plank.standard', 600, 'time'),
    ];

    // when
    const groups = build(exercises);

    // then
    expect(groups.map((g) => g.kind)).toEqual([
      'reps',
      'time',
      'distance',
      'weight',
    ]);
  });

  it('should fold distance-time into the distance group', () => {
    // given — both store metres and format identically, so two separate
    // groups would render the same heading twice
    const exercises = [
      exercise('cardio.run', 5000, 'distance'),
      exercise('cardio.cycling', 9000, 'distance-time'),
    ];

    // when
    const groups = build(exercises);

    // then
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('distance');
    expect(groups[0].rows.map((r) => r.exerciseId)).toEqual([
      'cardio.run',
      'cardio.cycling',
    ]);
  });

  it('should scale a bar against its own group, not the whole profile', () => {
    // given — seconds of plank next to a five-digit rep count; a shared
    // denominator would render the plank bar as an invisible sliver
    const exercises = [
      exercise('pushup', 50000, 'reps'),
      exercise('plank.standard', 3000, 'time'),
    ];

    // when
    const groups = build(exercises);

    // then
    const plank = groups.find((g) => g.kind === 'time');
    expect(plank?.rows[0].percent).toBe(100);
  });

  it('should scale each row against the biggest entry of its group', () => {
    // given
    const exercises = [
      exercise('pushup', 200, 'reps'),
      exercise('abs.situps', 50, 'reps'),
    ];

    // when
    const groups = build(exercises);

    // then
    expect(groups[0].rows.map((r) => r.percent)).toEqual([100, 25]);
  });

  it('should resolve every group heading through the label resolver', () => {
    // given
    const exercises = [
      exercise('pushup', 100, 'reps'),
      exercise('plank.standard', 600, 'time'),
    ];

    // when
    const groups = build(exercises);

    // then — a raw measurement id must never reach the template
    expect(groups.map((g) => g.label)).toEqual(['label:reps', 'label:time']);
  });

  it('should render the name and value through the given resolvers', () => {
    // given
    const exercises = [exercise('pushup', 100, 'reps')];

    // when
    const [group] = build(exercises);

    // then
    expect(group.rows[0]).toMatchObject({
      exerciseId: 'pushup',
      name: 'pushup',
      value: '100',
    });
  });

  it('should return no groups when nothing was ever logged', () => {
    // when
    const groups = build([]);

    // then — an empty heading says less than no section at all
    expect(groups).toEqual([]);
  });

  it('should not divide by zero when a group totals zero', () => {
    // given — a freshly created exercise can sit at 0
    const exercises = [exercise('pushup', 0, 'reps')];

    // when
    const [group] = build(exercises);

    // then
    expect(group.rows[0].percent).toBe(0);
  });
});
