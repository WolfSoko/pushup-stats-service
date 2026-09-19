import type { HoldPhase } from '@pu-stats/auto-count';

export type ExerciseTimerExerciseId = 'plank' | 'hollowhold';

export interface ExerciseTimerResult {
  readonly exerciseId: ExerciseTimerExerciseId;
  /** Final hold time in whole seconds. */
  readonly durationSec: number;
}

/**
 * Optional dialog data. `initialExerciseId` selects which hold is active
 * when the dialog opens, `targetSec` renders the prescription the caller
 * is working towards. Used by the guided training session so a "50 s
 * Plank" step opens on the right hold with its target in view — the
 * timer never stops itself, because cutting a hold short at the target
 * would throw away the seconds the user actually managed.
 */
export interface ExerciseTimerDialogData {
  readonly initialExerciseId?: ExerciseTimerExerciseId;
  readonly targetSec?: number;
}

export interface ExerciseTimerOption {
  readonly id: ExerciseTimerExerciseId;
  readonly icon: string;
  readonly label: string;
}

export function buildHoldExerciseOptions(): ReadonlyArray<ExerciseTimerOption> {
  return [
    {
      id: 'plank',
      icon: 'horizontal_rule',
      label: $localize`:@@exerciseTimer.exercise.plank:Plank`,
    },
    {
      id: 'hollowhold',
      icon: 'self_improvement',
      label: $localize`:@@exerciseTimer.exercise.hollowhold:Hollow Hold`,
    },
  ];
}

/** Phase caption shared by the camera timer and the manual stopwatch. */
export function holdPhaseLabel(phase: HoldPhase): string {
  switch (phase) {
    case 'holding':
      return $localize`:@@exerciseTimer.phase.holding:Halten`;
    case 'paused':
      return $localize`:@@exerciseTimer.phase.paused:Pause`;
    default:
      return $localize`:@@exerciseTimer.phase.ready:Bereit`;
  }
}
