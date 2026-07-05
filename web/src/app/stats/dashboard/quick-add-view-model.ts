import {
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  type QuickAddConfig,
  type QuickAddMode,
} from '@pu-stats/models';
import { exerciseDisplayName } from '../i18n/exercise-display-names';

export interface QuickAddButtonViewModel {
  /**
   * Stable per-slot tracking key for `@for`. Derived from the slot index
   * (not from `reps`/`mode`/`exerciseId`) so editing an existing button
   * reuses its DOM node and duplicate buttons (same reps/exercise/mode)
   * don't collide.
   */
  readonly key: string;
  readonly mode: QuickAddMode;
  /** `'pushup'` sentinel or a rep-based catalog exerciseId. */
  readonly exerciseId: string;
  /** Rep count for `mode === 'reps'`; ignored for `'auto-count'`. */
  readonly reps: number;
  /** Translated exercise display label (e.g. `"Liegestütze"`). */
  readonly exerciseLabel: string;
  /** Fully composed button label: `"+10 Liegestütze"` in reps mode, or
   *  just the exercise label (e.g. `"Sit-ups"`) in auto-count mode. */
  readonly label: string;
}

export function toQuickAddViewModel(
  config: QuickAddConfig,
  slotIndex: number
): QuickAddButtonViewModel {
  const exerciseId = config.exerciseId ?? PUSHUP_QUICK_ADD_EXERCISE_ID;
  const mode: QuickAddMode = config.mode ?? 'reps';
  const exerciseLabel = exerciseDisplayName(exerciseId);
  const repsLabel = mode === 'auto-count' ? '' : `+${config.reps} `;
  const label = `${repsLabel}${exerciseLabel}`;
  return {
    key: `slot:${slotIndex}`,
    mode,
    exerciseId,
    reps: config.reps,
    exerciseLabel,
    label,
  };
}

/**
 * View-models for the Schnellaktionen card. User-configured buttons
 * override the defaults (three pushup-reps buttons 10/20/30).
 */
export function buildQuickAddButtons(
  configured: ReadonlyArray<QuickAddConfig>
): QuickAddButtonViewModel[] {
  if (configured.length > 0) {
    return configured.map((cfg, i) => toQuickAddViewModel(cfg, i));
  }
  return [10, 20, 30].map((reps, i) =>
    toQuickAddViewModel(
      {
        reps,
        inSpeedDial: false,
        exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
        mode: 'reps',
      },
      i
    )
  );
}
