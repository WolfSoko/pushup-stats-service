import {
  findExerciseDefinition,
  formatExerciseValue,
  SessionStep,
  SessionToolKind,
} from '@pu-stats/models';

import {
  exerciseDisplayName,
  variantDisplayName,
} from '../../stats/i18n/exercise-display-names';

/** View-model for one exercise as the session presents it. */
export interface SessionStepRow {
  itemIndex: number;
  /** Localized exercise name, including the variant when one is prescribed. */
  name: string;
  /** Material icon of the exercise, for the step card and the overview. */
  icon: string;
  /** Formatted target in the exercise's unit (`20`, `0:50`, `500 m`). */
  target: string;
  /** Formatted amount logged towards it today, in the same unit. */
  logged: string;
  /** Formatted set/interval breakdown, empty when there is only one. */
  sets: string;
  /** 0–100 for the step's progress bar. */
  percent: number;
  quantified: boolean;
  done: boolean;
  tool: SessionToolKind;
}

const DEFAULT_ICON = 'fitness_center';

/**
 * Pre-formats every value the session templates bind, in the exercise's
 * own unit, so no template has to branch on measurement type.
 */
export function buildSessionRows(
  steps: ReadonlyArray<SessionStep>
): SessionStepRow[] {
  return steps.map((step) => {
    const { exercise } = step;
    const def = findExerciseDefinition(exercise.exerciseId);
    const unit = def?.unit ?? 'reps';
    const variant = def?.variants?.find((v) => v.id === exercise.variantId);
    const base = exerciseDisplayName(exercise.exerciseId);
    return {
      itemIndex: step.itemIndex,
      name: variant ? `${base} · ${variantDisplayName(variant)}` : base,
      icon: def?.icon ?? DEFAULT_ICON,
      target: step.quantified ? formatExerciseValue(step.target, unit) : '',
      logged: step.quantified ? formatExerciseValue(step.logged, unit) : '',
      sets:
        exercise.sets && exercise.sets.length > 1
          ? exercise.sets.map((v) => formatExerciseValue(v, unit)).join(' · ')
          : '',
      percent: step.quantified
        ? Math.min(100, Math.round((step.logged / step.target) * 100))
        : 0,
      quantified: step.quantified,
      done: step.done,
      tool: step.tool,
    };
  });
}

/** `m:ss` for the rest countdown. */
export function formatCountdown(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}
