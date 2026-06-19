import {
  findExerciseDefinition,
  isAutoCountQuickAddExerciseId,
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
  /** Material icon name — exercise's catalog icon, with mode-aware fallbacks. */
  readonly icon: string;
  /** Translated exercise display label (e.g. `"Liegestütze"`). */
  readonly exerciseLabel: string;
  /** Fully composed button label, e.g. `"+10 Liegestütze"` / `"Auto: Sit-ups"`. */
  readonly label: string;
}

export function toQuickAddViewModel(
  config: QuickAddConfig,
  slotIndex: number
): QuickAddButtonViewModel {
  const exerciseId = config.exerciseId ?? PUSHUP_QUICK_ADD_EXERCISE_ID;
  const mode: QuickAddMode = config.mode ?? 'reps';
  // Resolve the display label for the legacy pushup sentinel separately —
  // it isn't in EXERCISE_CATALOG (lives in the pushups collection) but the
  // template needs a localised label all the same.
  const def =
    exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID
      ? null
      : findExerciseDefinition(exerciseId);
  const exerciseLabel =
    exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID
      ? $localize`:@@exercise.category.pushup:Liegestütze`
      : exerciseDisplayName(exerciseId);
  // The catalog `icon` is the natural per-exercise glyph. Pushup falls
  // back to `fitness_center`; auto-count rows override to a camera icon
  // to make the mode visually obvious.
  const icon =
    mode === 'auto-count' && isAutoCountQuickAddExerciseId(exerciseId)
      ? 'videocam'
      : (def?.icon ?? 'fitness_center');
  const repsLabel = mode === 'auto-count' ? '' : `+${config.reps} `;
  const label = `${repsLabel}${exerciseLabel}`;
  return {
    key: `slot:${slotIndex}`,
    mode,
    exerciseId,
    reps: config.reps,
    icon,
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
