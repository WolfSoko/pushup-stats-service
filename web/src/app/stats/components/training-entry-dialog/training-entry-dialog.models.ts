import {
  ExerciseCategoryId,
  ExerciseDefinition,
  MeasurementType,
} from '@pu-stats/models';

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
  durationSec?: number;
  distanceM?: number;
  variantId?: string;
}

export type TrainingEntryDialogData =
  | PushupEntryDialogData
  | ExerciseEntryDialogData;

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
  | PushupEntryDialogResult
  | ExerciseEntryDialogResult;

export interface CategoryOption {
  value: ExerciseCategoryId;
  label: string;
}

export interface ExerciseOption {
  /** Catalog id, or {@link PUSHUP_EXERCISE_ID} for the pushup row. */
  value: string;
  label: string;
  definition?: ExerciseDefinition;
}

export interface PushupTypeOption {
  value: string;
  label: string;
}
