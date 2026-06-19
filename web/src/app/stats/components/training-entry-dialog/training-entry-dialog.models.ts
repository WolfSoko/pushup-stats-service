import {
  ExerciseCategoryId,
  ExerciseDefinition,
  MeasurementType,
} from '@pu-stats/models';

/**
 * Synthetic id for the implicit "Liegestütze (Standard)" exercise inside
 * the pushup category. Pushups live in their own Firestore collection
 * (`pushups`) and don't have a catalog `ExerciseDefinition`, so the
 * exercise picker uses this stable sentinel to identify the row.
 */
export const PUSHUP_EXERCISE_ID = 'pushup';

/**
 * Initial / edit-mode payload for the training-entry dialog.
 *
 * Discriminated by `kind` — pushup entries live in the legacy
 * `pushups` collection, exercise entries in `exerciseEntries`. In edit
 * mode the picker rows for category and exercise are disabled — users
 * cannot move an entry between collections after the fact.
 */
export interface PushupEntryDialogData {
  kind: 'pushup';
  timestamp: string;
  /** Total reps. */
  reps?: number;
  sets?: number[];
  /** Source label (web / whatsapp / …). */
  source?: string;
  /** Variant id (e.g. `'standard'`, `'diamond'`). */
  type?: string;
}

export interface ExerciseEntryDialogData {
  kind: 'exercise';
  timestamp: string;
  /** Catalog id (e.g. `'plank.standard'`). May reference a stale id
   *  whose catalog entry was renamed/removed; the dialog falls back to
   *  a synthetic definition in that case. */
  exerciseId: string;
  /** For reps-measurement exercises: total reps. */
  reps?: number;
  /** Per-set breakdown — only meaningful for `reps` / `weight`
   *  exercises. Mutually exclusive with {@link intervals}; pick the
   *  field that matches the measurement type via
   *  {@link entryBreakdownField}. */
  sets?: number[];
  /** Per-interval breakdown — only meaningful for endurance
   *  measurements (`time` / `distance` / `distance-time`). Each
   *  entry is one repetition of the primary measurement value
   *  (seconds / meters). */
  intervals?: number[];
  /** For `'time'` and `'distance-time'` measurements. */
  durationSec?: number;
  /** For `'distance-time'` measurement (meters). */
  distanceM?: number;
  /** Variant id within the catalog definition. */
  variantId?: string;
}

export type TrainingEntryDialogData =
  | PushupEntryDialogData
  | ExerciseEntryDialogData;

export interface PushupEntryDialogResult {
  kind: 'pushup';
  timestamp: string;
  /** Total reps. */
  reps: number;
  /** Per-set breakdown — `[reps]` for a single set. */
  sets: number[];
  /** Source label. Always populated. */
  source: string;
  /** Variant id. Always populated (defaults to `'standard'`). */
  type: string;
}

export interface ExerciseEntryDialogResult {
  kind: 'exercise';
  timestamp: string;
  /** Catalog id the entry was logged against. */
  exerciseId: string;
  /** Catalog measurement — drives the consumer's payload shape. */
  measurement: MeasurementType;
  /** Total reps for reps-measurements; `0` otherwise. */
  reps: number;
  /**
   * Per-set breakdown for strength entries (`reps` / `weight`);
   * `[]` otherwise. Mutually exclusive with {@link intervals}: at
   * most one of the two is non-empty at a time; the other is `[]`
   * so the consumer can use it as a Firestore clear sentinel
   * (maps to `deleteField()`) to wipe a stale breakdown on edit.
   */
  sets: number[];
  /**
   * Per-interval breakdown for endurance entries (`time`,
   * `distance`, `distance-time`); `[]` otherwise. Each entry is
   * one repetition of the primary measurement (seconds for
   * `time`, meters for `distance` / `distance-time`).
   */
  intervals: number[];
  /** Set for `'time'` and `'distance-time'`. */
  durationSec?: number;
  /** Set for `'distance-time'`. */
  distanceM?: number;
  /**
   * Variant id tri-state:
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
