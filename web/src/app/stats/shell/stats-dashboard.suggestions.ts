import { planDayExercises, TrainingPlanDay } from '@pu-stats/models';
import type { DailyGoalItemView } from '../../core/daily-goal.helpers';
import type { ExerciseSuggestions } from '../components/training-entry-dialog/training-entry-dialog.models';

/** Entry shape the recency ranking needs — any logged entry satisfies it. */
export interface LoggedExercise {
  exerciseId: string;
  timestamp: string;
}

interface SuggestionInput {
  /** Today's plan day, or `null` without an active plan. */
  planDay: TrainingPlanDay | null;
  /** Per-exercise daily goals with today's progress folded in. */
  dailyGoals: readonly DailyGoalItemView[];
  /** All logged entries; order does not matter, timestamps decide. */
  entries: readonly LoggedExercise[];
}

/**
 * Ranking context for the entry dialog's exercise picker.
 *
 * "Planned" is what today asks for — the active plan day first, then the
 * daily goals, open ones before the ones already reached, since a reached
 * goal is the least likely thing to be logged next. "Recent" is the
 * user's own habit, newest first, as the fallback ordering for anyone
 * without a plan or goals.
 */
export function exerciseSuggestions(
  input: SuggestionInput
): ExerciseSuggestions {
  const planned = [
    ...(input.planDay ? planDayExercises(input.planDay) : []).map(
      (exercise) => exercise.exerciseId
    ),
    ...[...input.dailyGoals]
      .sort((a, b) => Number(a.reached) - Number(b.reached))
      .map((goal) => goal.exerciseId),
  ];
  const recentExerciseIds = [...input.entries]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map((entry) => entry.exerciseId);
  return {
    plannedExerciseIds: dedupe(planned),
    recentExerciseIds: dedupe(recentExerciseIds),
  };
}

function dedupe(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
