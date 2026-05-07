/**
 * Domain-neutral read shape that unifies the legacy `pushups` collection
 * and the new `exerciseEntries` collection for read paths (history,
 * filter-bar, future analysis page). Pure model — UI components consume
 * `UnifiedEntry` rather than touching `PushupRecord` or `ExerciseEntry`
 * directly so the eventual migration of pushups into `exerciseEntries`
 * (Phase 7) becomes a single mapper change.
 *
 * Discriminated by `kind`:
 *   - `'pushup'` carries the legacy `variantType` (Diamond/Wide/…) which
 *     drives the existing dashboard wiki link and the type-pie chart.
 *   - `'exercise'` carries the catalog `exerciseId` (e.g. `'abs.situps'`)
 *     and any measurement-specific companion values that are present on
 *     the source doc.
 */

import type { ExerciseEntry } from './exercise.models';
import type { PushupRecord } from './pushup.models';

export interface UnifiedEntryBase {
  _id: string;
  timestamp: string;
  reps: number;
  sets?: number[];
  source: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedPushupEntry extends UnifiedEntryBase {
  kind: 'pushup';
  /** Pushup variant as stored on the legacy doc — canonical id, legacy
   *  English entryLabel, custom user string, or null when missing. */
  variantType: string | null;
}

export interface UnifiedExerciseEntry extends UnifiedEntryBase {
  kind: 'exercise';
  exerciseId: string;
  variantId?: string;
  durationSec?: number;
  distanceM?: number;
  weightKg?: number;
}

export type UnifiedEntry = UnifiedPushupEntry | UnifiedExerciseEntry;

/**
 * Logical filter key for the History/Analysis exercise multi-select.
 * `'pushup'` matches every legacy pushup doc regardless of variant;
 * any other value is an `ExerciseDefinition.id` from the catalog.
 */
export type UnifiedEntryFilterKey = 'pushup' | string;

export function pushupRecordToUnified(r: PushupRecord): UnifiedPushupEntry {
  return {
    kind: 'pushup',
    _id: r._id,
    timestamp: r.timestamp,
    reps: r.reps,
    ...(r.sets ? { sets: r.sets } : {}),
    source: r.source,
    variantType: r.type ?? null,
    ...(r.createdAt ? { createdAt: r.createdAt } : {}),
    ...(r.updatedAt ? { updatedAt: r.updatedAt } : {}),
  };
}

export function exerciseEntryToUnified(e: ExerciseEntry): UnifiedExerciseEntry {
  return {
    kind: 'exercise',
    _id: e._id,
    timestamp: e.timestamp,
    // For `time` / `distance` exercises `reps` is undefined on the
    // source doc — surface 0 here so the table cell stays numeric and
    // sortable. The kind discriminator + measurement-specific fields
    // tell consumers what value is actually meaningful.
    reps: e.reps ?? 0,
    ...(e.sets ? { sets: e.sets } : {}),
    source: e.source,
    exerciseId: e.exerciseId,
    ...(e.variantId ? { variantId: e.variantId } : {}),
    ...(e.durationSec !== undefined ? { durationSec: e.durationSec } : {}),
    ...(e.distanceM !== undefined ? { distanceM: e.distanceM } : {}),
    ...(e.weightKg !== undefined ? { weightKg: e.weightKg } : {}),
    ...(e.createdAt ? { createdAt: e.createdAt } : {}),
    ...(e.updatedAt ? { updatedAt: e.updatedAt } : {}),
  };
}

/**
 * Returns the filter key a UnifiedEntry contributes to the multi-select
 * filter on the history page. Pushup entries always collapse into the
 * single `'pushup'` bucket regardless of variant — the variant filter
 * stays a separate dropdown so users can still drill down to "Diamond
 * Pushups only".
 */
export function unifiedEntryFilterKey(entry: UnifiedEntry): UnifiedEntryFilterKey {
  return entry.kind === 'pushup' ? 'pushup' : entry.exerciseId;
}
