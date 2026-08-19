import { TrainingPlanDay } from '@pu-stats/models';
import type { DailyGoalItemView } from '../../core/daily-goal.helpers';
import { exerciseSuggestions } from './stats-dashboard.suggestions';

function goal(exerciseId: string, reached: boolean): DailyGoalItemView {
  return {
    id: exerciseId,
    exerciseId,
    exerciseName: exerciseId,
    measurement: 'reps',
    unit: 'reps',
    target: 50,
    value: reached ? 50 : 0,
    remaining: reached ? 0 : 50,
    targetDisplay: '50',
    progressDisplay: reached ? '50' : '0',
    remainingDisplay: reached ? '0' : '50',
    percent: reached ? 100 : 0,
    reached,
    fillable: true,
  };
}

const planDay: TrainingPlanDay = {
  dayIndex: 3,
  kind: 'main',
  targetReps: 60,
  description: 'Tag 3',
  exercises: [
    { exerciseId: 'pushup', target: 60 },
    { exerciseId: 'plank.standard', target: 90 },
  ],
};

describe('exerciseSuggestions', () => {
  it('should rank plan-day exercises before daily goals', () => {
    // given / when
    const suggestions = exerciseSuggestions({
      planDay,
      dailyGoals: [goal('abs.situps', false)],
      entries: [],
    });

    // then
    expect(suggestions.plannedExerciseIds).toEqual([
      'pushup',
      'plank.standard',
      'abs.situps',
    ]);
  });

  it('should list open goals before reached ones', () => {
    // given / when
    const suggestions = exerciseSuggestions({
      planDay: null,
      dailyGoals: [goal('pushup', true), goal('abs.situps', false)],
      entries: [],
    });

    // then
    expect(suggestions.plannedExerciseIds).toEqual(['abs.situps', 'pushup']);
  });

  it('should list recently logged exercises newest first, without repeats', () => {
    // given
    const entries = [
      { exerciseId: 'abs.situps', timestamp: '2026-02-10T08:00:00+01:00' },
      { exerciseId: 'pushup', timestamp: '2026-02-11T20:00:00+01:00' },
      { exerciseId: 'abs.situps', timestamp: '2026-02-11T09:00:00+01:00' },
    ];

    // when
    const suggestions = exerciseSuggestions({
      planDay: null,
      dailyGoals: [],
      entries,
    });

    // then
    expect(suggestions.recentExerciseIds).toEqual(['pushup', 'abs.situps']);
  });

  it('should stay empty without a plan, goals or entries', () => {
    // given / when
    const suggestions = exerciseSuggestions({
      planDay: null,
      dailyGoals: [],
      entries: [],
    });

    // then
    expect(suggestions).toEqual({
      plannedExerciseIds: [],
      recentExerciseIds: [],
    });
  });

  it('should ignore a rest day', () => {
    // given
    const restDay: TrainingPlanDay = {
      dayIndex: 4,
      kind: 'rest',
      targetReps: 0,
      description: 'Pause',
    };

    // when
    const suggestions = exerciseSuggestions({
      planDay: restDay,
      dailyGoals: [],
      entries: [],
    });

    // then
    expect(suggestions.plannedExerciseIds).toEqual([]);
  });
});
