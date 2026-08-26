import { MeasurementType } from '@pu-stats/models';

/**
 * Pushups live in their own Firestore collection (`pushups`) and have no
 * catalog `ExerciseDefinition`, so the picker needs a stable sentinel id
 * to represent that row.
 */
export const PUSHUP_EXERCISE_ID = 'pushup';

export interface PushupEntryDialogData {
  kind: 'pushup';
  timestamp: string;
  reps?: number;
  sets?: number[];
  source?: string;
  type?: string;
}

export interface ExerciseEntryDialogData {
  kind: 'exercise';
  timestamp: string;
  /** May reference a stale id whose catalog entry was renamed/removed;
   *  the dialog then falls back to a synthetic definition. */
  exerciseId: string;
  reps?: number;
  /** Mutually exclusive with {@link intervals}; the matching field is
   *  picked via {@link entryBreakdownField}. */
  sets?: number[];
  intervals?: number[];
  /** Per-interval split times, `distance-time` only. Index-aligned with
   *  {@link intervals}. */
  intervalDurationsSec?: number[];
  durationSec?: number;
  distanceM?: number;
  variantId?: string;
}

export type TrainingEntryDialogData =
  PushupEntryDialogData | ExerciseEntryDialogData;

/**
 * Ranking context for the exercise picker. The dialog has no view on
 * plans, goals or history, so the opener passes in what today asks for
 * and what the user logged last, most relevant first.
 */
export interface ExerciseSuggestions {
  /** Exercises today's plan day and daily goals prescribe. */
  plannedExerciseIds?: readonly string[];
  /** Distinct exercises from recent entries, most recent first. */
  recentExerciseIds?: readonly string[];
}

/**
 * Create-mode payload: no entry to prefill, only the picker ranking
 * context. Passing nothing at all is still valid — the picker then
 * falls back to the plain catalog order.
 */
export interface TrainingEntryCreateDialogData {
  kind: 'create';
  suggestions: ExerciseSuggestions;
}

/** Everything `MAT_DIALOG_DATA` may carry for this dialog. */
export type TrainingEntryDialogInput =
  TrainingEntryDialogData | TrainingEntryCreateDialogData | null;

/** Narrows the dialog input to an entry the dialog should prefill and lock. */
export function isEntryPrefill(
  input: TrainingEntryDialogInput | undefined
): input is TrainingEntryDialogData {
  return input?.kind === 'pushup' || input?.kind === 'exercise';
}

export interface PushupEntryDialogResult {
  kind: 'pushup';
  timestamp: string;
  reps: number;
  sets: number[];
  source: string;
  type: string;
}

export interface ExerciseEntryDialogResult {
  kind: 'exercise';
  timestamp: string;
  exerciseId: string;
  measurement: MeasurementType;
  reps: number;
  /**
   * Mutually exclusive with {@link intervals}: at most one is non-empty;
   * the other is `[]` so the consumer can treat it as a clear sentinel
   * (maps to `deleteField()`) to wipe a stale breakdown on edit.
   */
  sets: number[];
  intervals: number[];
  /**
   * Per-interval split times, `distance-time` only — index-aligned with
   * {@link intervals}, `0` at an index means no split was entered there.
   * Empty when no splits were entered at all, mirroring the `intervals`
   * clear-sentinel convention.
   */
  intervalDurationsSec: number[];
  durationSec?: number;
  distanceM?: number;
  /**
   * Tri-state:
   *   - non-empty `string`: set or keep this variant.
   *   - `null`: clear an existing variant (caller maps to `deleteField()`).
   *   - `undefined`: no change / no variant in create mode.
   */
  variantId?: string | null;
}

export type TrainingEntryDialogResult =
  PushupEntryDialogResult | ExerciseEntryDialogResult;

/** One row of the exercise autocomplete. */
export interface ExercisePickerOption {
  /** Catalog id — {@link PUSHUP_EXERCISE_ID} for the pushup row. */
  id: string;
  label: string;
  categoryLabel: string;
  /** Precomputed, normalized haystack for the type-ahead filter. */
  searchText: string;
}

/** A labelled section of the autocomplete panel (`mat-optgroup`). */
export interface ExercisePickerGroup {
  /** Stable `@for` key: a category id or a suggestion-group name. */
  key: string;
  label: string;
  options: ExercisePickerOption[];
}

export interface PushupTypeOption {
  value: string;
  label: string;
}
