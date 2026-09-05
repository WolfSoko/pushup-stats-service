import {
  EXERCISE_CATALOG,
  type ExerciseDefinition,
  findExerciseDefinition,
} from '@pu-stats/models';
import type { AppDataFacade } from '../core/app-data.facade';
import type { QuickAddOrchestrationService } from '../core/quick-add-orchestration.service';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';

/**
 * Handler bodies for the AG-UI frontend tools, kept free of
 * `@copilotkit/angular` imports so they stay testable — and so the library
 * only ever loads through the assistant route's lazy chunk.
 *
 * Strings here are prompt material for the agent, not UI, so they stay
 * English and out of the XLIFF catalog.
 */
export const NAVIGATION_TARGETS = {
  dashboard: '/app',
  analysis: '/analysis',
  history: '/history',
  goals: '/settings/ziele',
  trainingPlans: '/training-plans',
  leaderboard: '/leaderboard',
  reminders: '/settings/erinnerungen',
  settings: '/settings',
} as const;

export type NavigationTarget = keyof typeof NAVIGATION_TARGETS;

export const NAVIGATION_TARGET_IDS = Object.keys(NAVIGATION_TARGETS) as [
  NavigationTarget,
  ...NavigationTarget[],
];

function isRepsExercise(definition: ExerciseDefinition): boolean {
  return definition.measurement === 'reps';
}

export interface LoggableExercise {
  readonly id: string;
  readonly name: string;
  readonly min: number;
  readonly max: number;
}

/** Rep-based catalog exercises the agent may log through `logExerciseEntry`. */
export function loggableExercises(): LoggableExercise[] {
  return EXERCISE_CATALOG.filter(isRepsExercise).map((definition) => ({
    id: definition.id,
    name: exerciseDisplayName(definition.id),
    min: definition.min,
    max: definition.max,
  }));
}

export interface TrainingSummary {
  readonly dailyGoal: number;
  readonly todayProgress: number;
  readonly remainingToGoal: number;
  readonly goalReached: boolean;
  readonly goals: readonly {
    readonly exercise: string;
    readonly target: string;
    readonly progress: string;
    readonly percent: number;
  }[];
}

export function buildTrainingSummary(appData: AppDataFacade): TrainingSummary {
  return {
    dailyGoal: appData.dailyGoal(),
    todayProgress: appData.todayProgress(),
    remainingToGoal: appData.remainingToGoal(),
    goalReached: appData.goalReached(),
    goals: appData.dailyGoalBreakdown().map((goal) => ({
      exercise: goal.exerciseName,
      target: goal.targetDisplay,
      progress: goal.progressDisplay,
      percent: goal.percent,
    })),
  };
}

export interface LogExerciseEntryResult {
  readonly ok: boolean;
  readonly exerciseId?: string;
  readonly reps?: number;
  readonly error?: string;
}

export function logExerciseEntry(
  quickAdd: QuickAddOrchestrationService,
  exerciseId: string,
  reps: number
): LogExerciseEntryResult {
  const definition = findExerciseDefinition(exerciseId);
  if (!definition || !isRepsExercise(definition)) {
    return {
      ok: false,
      error: `Unknown rep-based exercise id "${exerciseId}". Use one of the ids listed in the app context.`,
    };
  }
  if (
    !Number.isInteger(reps) ||
    reps < definition.min ||
    reps > definition.max
  ) {
    return {
      ok: false,
      error: `reps must be a whole number between ${definition.min} and ${definition.max} for "${exerciseId}".`,
    };
  }

  const name = exerciseDisplayName(exerciseId);
  // Reports success once the entry is queued, not once Firestore acknowledges
  // it — the quick-add path is fire-and-forget and surfaces write failures in
  // a snackbar rather than to the caller.
  quickAdd.addSuggestion({
    key: `ai:${exerciseId}`,
    reps,
    label: `+${reps} ${name}`,
    ariaLabel: `+${reps} ${name}`,
    exerciseId,
  });
  return { ok: true, exerciseId, reps };
}
