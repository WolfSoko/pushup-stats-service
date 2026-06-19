import { UnifiedEntry } from '@pu-stats/models';
import {
  ExerciseEntryDialogResult,
  PushupEntryDialogResult,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../training-entry-dialog/training-entry-dialog.models';
import { StatsTableCreate, StatsTableUpdate } from './stats-table.models';

export function toEditDialogData(entry: UnifiedEntry): TrainingEntryDialogData {
  if (entry.exerciseId === 'pushup') {
    return {
      kind: 'pushup',
      timestamp: entry.timestamp,
      reps: entry.reps,
      sets: entry.sets,
      source: entry.source,
      type: entry.variantId ?? undefined,
    };
  }
  return {
    kind: 'exercise',
    timestamp: entry.timestamp,
    reps: entry.reps,
    sets: entry.sets,
    intervals: entry.intervals,
    ...(entry.durationSec !== undefined
      ? { durationSec: entry.durationSec }
      : {}),
    ...(entry.distanceM !== undefined ? { distanceM: entry.distanceM } : {}),
    exerciseId: entry.exerciseId,
    variantId: entry.variantId,
  };
}

export function toCreatePayload(
  result: TrainingEntryDialogResult
): StatsTableCreate {
  if (result.kind === 'pushup') {
    return pushupCreatePayload(result);
  }
  return exerciseCreatePayload(result);
}

function pushupCreatePayload(
  result: PushupEntryDialogResult
): StatsTableCreate {
  return {
    kind: 'pushup',
    timestamp: result.timestamp,
    reps: result.reps,
    ...(result.sets.length > 1 ? { sets: result.sets } : {}),
    source: result.source,
    type: result.type,
  };
}

function exerciseCreatePayload(
  result: ExerciseEntryDialogResult
): StatsTableCreate {
  // `intervals` is required on the dialog result, but the helpers
  // are also called from programmatic tests / future callers where
  // the field might be omitted. Default to `[]` so `.length` is
  // always safe.
  const intervals = result.intervals ?? [];
  return {
    kind: 'exercise',
    exerciseId: result.exerciseId,
    timestamp: result.timestamp,
    ...(result.measurement === 'time'
      ? {
          durationSec: result.durationSec ?? 0,
          ...(intervals.length > 0 ? { intervals } : {}),
        }
      : result.measurement === 'distance-time'
        ? {
            distanceM: result.distanceM ?? 0,
            durationSec: result.durationSec ?? 0,
            ...(intervals.length > 0 ? { intervals } : {}),
          }
        : result.measurement === 'distance'
          ? {
              // Pure-distance exercises don't ship in the catalog
              // yet, but the dialog emits a `distance` branch so
              // the create path must accept it; otherwise the
              // distanceM + intervals would silently fall through
              // to the strength shape and be dropped.
              distanceM: result.distanceM ?? 0,
              ...(intervals.length > 0 ? { intervals } : {}),
            }
          : {
              reps: result.reps,
              ...(result.sets.length > 1 ? { sets: result.sets } : {}),
            }),
    ...(result.variantId ? { variantId: result.variantId } : {}),
  };
}

export function toUpdatePayload(
  entry: UnifiedEntry,
  result: TrainingEntryDialogResult
): StatsTableUpdate {
  // Edit mode locks the kind picker, so dialog result kind always
  // matches the row's exercise. The exerciseId-narrowed branches keep
  // the payload type-safe even though the runtime guard is on `entry`.
  if (entry.exerciseId === 'pushup' && result.kind === 'pushup') {
    return pushupUpdatePayload(entry, result);
  }
  if (entry.exerciseId !== 'pushup' && result.kind === 'exercise') {
    return exerciseUpdatePayload(entry, result);
  }
  throw new Error(
    `toUpdatePayload: kind mismatch — exerciseId='${entry.exerciseId}', result='${result.kind}'`
  );
}

function pushupUpdatePayload(
  entry: UnifiedEntry,
  result: PushupEntryDialogResult
): StatsTableUpdate {
  return {
    kind: 'pushup',
    id: entry._id,
    timestamp: result.timestamp,
    reps: result.reps,
    // Single-set collapse: if the original doc carried a multi-set
    // breakdown, emit `[]` as the explicit clear sentinel so the
    // store maps it to a Firestore `deleteField()`; `undefined`
    // would just omit the field and leave stale sets behind.
    sets:
      result.sets.length > 1
        ? result.sets
        : entry.sets !== undefined
          ? []
          : undefined,
    source: result.source,
    type: result.type,
  };
}

function exerciseUpdatePayload(
  entry: UnifiedEntry,
  result: ExerciseEntryDialogResult
): StatsTableUpdate {
  // The dialog disables the category + exercise pickers in edit mode
  // (see `TrainingEntryDialogComponent`), so an update can never
  // change an entry's measurement type. That's why each branch below
  // only needs to handle its own breakdown field — there's no
  // strength→endurance flip where we'd have to wipe a stale `sets`
  // from an entry that just became endurance (or vice versa). If
  // measurement switches during edit ever land, this helper plus the
  // Firestore-rules mutex would need explicit opposite-side clears.
  const resultIntervals = result.intervals ?? [];
  const intervalsPatch =
    resultIntervals.length > 0
      ? { intervals: resultIntervals }
      : entry.intervals !== undefined
        ? { intervals: [] }
        : {};
  return {
    kind: 'exercise',
    id: entry._id,
    exerciseId: entry.exerciseId,
    timestamp: result.timestamp,
    source: entry.source,
    ...(result.measurement === 'time'
      ? {
          durationSec: result.durationSec ?? 0,
          ...intervalsPatch,
        }
      : result.measurement === 'distance-time'
        ? {
            distanceM: result.distanceM ?? 0,
            durationSec: result.durationSec ?? 0,
            ...intervalsPatch,
          }
        : result.measurement === 'distance'
          ? {
              distanceM: result.distanceM ?? 0,
              ...intervalsPatch,
            }
          : {
              reps: result.reps,
              sets:
                result.sets.length > 1
                  ? result.sets
                  : entry.sets !== undefined
                    ? []
                    : undefined,
            }),
    ...(result.variantId !== undefined ? { variantId: result.variantId } : {}),
  };
}
