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
  /** Formatted target that closes the step, in the exercise's unit
   *  (`20`, `0:50`, `500 m`). Cumulative across rounds in circuit mode. */
  target: string;
  /** Formatted amount this step alone asks for. Equals `target` outside
   *  a circuit. */
  roundTarget: string;
  /** 1-based round number, for the "Runde 2 von 3" line. */
  round: number;
  /** Rounds the session walks in total; 1 outside a circuit. */
  roundTotal: number;
  /** Formatted amount logged towards the step's own round, in the same
   *  unit — the whole day's amount outside a circuit. */
  logged: string;
  /** Formatted set/interval breakdown, empty when there is only one. */
  sets: string;
  /** 0–100 for the step's progress bar, against {@link roundTarget}. */
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
    // The card asks for one round, so the progress under it has to count
    // that round — not the rounds behind it, which are already closed.
    const roundLogged = Math.max(
      0,
      step.logged - (step.target - step.roundTarget)
    );
    return {
      itemIndex: step.itemIndex,
      name: variant ? `${base} · ${variantDisplayName(variant)}` : base,
      icon: def?.icon ?? DEFAULT_ICON,
      target: step.quantified ? formatExerciseValue(step.target, unit) : '',
      roundTarget: step.quantified
        ? formatExerciseValue(step.roundTarget, unit)
        : '',
      round: step.roundIndex + 1,
      roundTotal: step.roundTotal,
      logged: step.quantified ? formatExerciseValue(roundLogged, unit) : '',
      sets:
        step.roundTotal === 1 && exercise.sets && exercise.sets.length > 1
          ? exercise.sets.map((v) => formatExerciseValue(v, unit)).join(' · ')
          : '',
      percent:
        step.quantified && step.roundTarget > 0
          ? Math.min(100, Math.round((roundLogged / step.roundTarget) * 100))
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
