import {
  type ExerciseEntry,
  findExerciseDefinition,
  formatEntryDisplay,
  measurementValueField,
} from '@pu-stats/models';
import { appendLocalOffset } from '@pu-stats/date';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import {
  type TrainingEntryDialogData,
  type TrainingEntryDialogResult,
} from '../stats/components/training-entry-dialog/training-entry-dialog.models';

type SortValue = string | number;

/**
 * Sort accessor for the admin per-user entry table. `timestamp` sorts
 * chronologically (ISO strings order lexicographically, but the numeric
 * epoch keeps parity with the user-list accessor), `exercise` by
 * localized name, `value` by the primary measurement number, `source`
 * alphabetically.
 */
export function adminEntrySortValue(
  entry: ExerciseEntry,
  property: string
): SortValue {
  switch (property) {
    case 'timestamp': {
      // Normalise a missing or malformed timestamp to 0 — `getTime()` returns
      // NaN for an unparseable value, and NaN comparisons make MatSort's order
      // unstable.
      const time = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
      return Number.isNaN(time) ? 0 : time;
    }
    case 'exercise':
      return entryExerciseName(entry).toLowerCase();
    case 'value':
      return primaryValue(entry);
    case 'source':
      return (entry.source ?? '').toLowerCase();
    default:
      return '';
  }
}

/** Localized exercise name, falling back to the raw id for stale entries. */
export function entryExerciseName(entry: ExerciseEntry): string {
  return exerciseDisplayName(entry.exerciseId);
}

/**
 * Human-readable value for a row (e.g. `30`, `5.00 km · 25:00 (5:00 /km)`).
 * Uses the catalog definition; falls back to the raw primary number when
 * the exercise id no longer resolves.
 */
export function entryValueDisplay(entry: ExerciseEntry): string {
  const def = findExerciseDefinition(entry.exerciseId);
  if (!def) return String(primaryValue(entry));
  return formatEntryDisplay(entry, def);
}

/**
 * Raw primary measurement value. For an unknown/stale exercise id (no
 * catalog definition) it falls back to the first present numeric field
 * (`reps` → `durationSec` → `distanceM`), or 0 when none is set.
 */
export function primaryValue(entry: ExerciseEntry): number {
  const def = findExerciseDefinition(entry.exerciseId);
  if (!def) return entry.reps ?? entry.durationSec ?? entry.distanceM ?? 0;
  const field = measurementValueField(def.measurement);
  return (entry[field] as number | undefined) ?? 0;
}

/**
 * Adapt a stored admin entry into the shared {@link TrainingEntryDialogData}
 * so the admin page opens the *same* editor the history page uses. Pushup
 * rows (`exerciseId === 'pushup'`) open in pushup mode; everything else in
 * exercise mode. Mirrors the history page's `toEditDialogData`.
 *
 * The timestamp is converted to the *admin's* local wall-clock (with the local
 * offset appended) so the dialog — which seeds its `datetime-local` input from
 * `timestamp.slice(0, 16)` without converting — shows the right time even for
 * an entry stored as UTC (`…Z`) or with another user's offset. Because it still
 * carries an offset, an unchanged save round-trips to the same instant.
 */
export function entryToDialogData(
  entry: ExerciseEntry
): TrainingEntryDialogData {
  const timestamp = toLocalDialogTimestamp(entry.timestamp);
  if (entry.exerciseId === 'pushup') {
    return {
      kind: 'pushup',
      timestamp,
      reps: entry.reps,
      sets: entry.sets,
      source: entry.source,
      type: entry.variantId ?? undefined,
    };
  }
  return {
    kind: 'exercise',
    timestamp,
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

// Render a stored instant as `YYYY-MM-DDTHH:mm:ss±HH:MM` in the viewer's local
// timezone. `appendLocalOffset` supplies the DST-correct offset (the same one
// the dialog uses when the admin edits the field), so the value both displays
// correctly and denotes the original instant when saved unchanged.
function toLocalDialogTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  const localWall = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return appendLocalOffset(localWall);
}

/**
 * Translate a shared-dialog result into the *minimal* `adminUpdateUserEntry`
 * patch: only fields whose value actually changed, so a no-op save doesn't bump
 * `updatedAt` / re-trigger aggregates. Returns `{}` when nothing changed.
 *
 * The measurement branch mirrors the history page's `toUpdatePayload`, but
 * emits the plain field patch the admin callable expects (no `kind`/`id`,
 * `exerciseId` stays immutable). For exercise entries `source` is left
 * untouched; only pushup rows carry an editable source. For a stale exercise id
 * (no catalog definition) only the timestamp is patchable — the callable can't
 * catalog-validate value fields for it — matching the old admin dialog.
 */
export function dialogResultToPatch(
  entry: ExerciseEntry,
  result: TrainingEntryDialogResult
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  // The dialog echoes back a re-offset string for an unchanged timestamp, so
  // compare instants rather than strings.
  if (!sameInstant(result.timestamp, entry.timestamp)) {
    patch['timestamp'] = result.timestamp;
  }

  // Stale exercise id: timestamp-only (see doc comment). Pushup resolves in the
  // catalog, so it is unaffected by this guard.
  if (findExerciseDefinition(entry.exerciseId) === null) {
    return patch;
  }

  const proposed: Record<string, unknown> = {};
  if (result.kind === 'pushup') {
    proposed['reps'] = result.reps;
    proposed['source'] = result.source;
    // A pushup's "type" is its variant; an empty type clears the variant.
    proposed['variantId'] = result.type ? result.type : null;
    collapseBreakdown(proposed, 'sets', result.sets, entry.sets);
  } else {
    const intervals = result.intervals ?? [];
    switch (result.measurement) {
      case 'time':
        proposed['durationSec'] = result.durationSec ?? 0;
        collapseBreakdown(proposed, 'intervals', intervals, entry.intervals);
        break;
      case 'distance-time':
        proposed['distanceM'] = result.distanceM ?? 0;
        proposed['durationSec'] = result.durationSec ?? 0;
        collapseBreakdown(proposed, 'intervals', intervals, entry.intervals);
        break;
      case 'distance':
        proposed['distanceM'] = result.distanceM ?? 0;
        collapseBreakdown(proposed, 'intervals', intervals, entry.intervals);
        break;
      default:
        proposed['reps'] = result.reps;
        collapseBreakdown(proposed, 'sets', result.sets, entry.sets);
    }
    if (result.variantId !== undefined)
      proposed['variantId'] = result.variantId;
  }

  for (const [field, value] of Object.entries(proposed)) {
    if (!fieldEquals(entry, field, value)) patch[field] = value;
  }
  return patch;
}

/** True when two ISO strings denote the same instant (ignoring offset form). */
function sameInstant(a: string, b: string): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return !Number.isNaN(ta) && !Number.isNaN(tb) && ta === tb;
}

// True when a proposed patch value matches the entry's current value (so it can
// be dropped as a no-op). Handles the breakdown clear sentinel (`[]`) and the
// variant tri-state (missing variant ≡ `null`).
function fieldEquals(
  entry: ExerciseEntry,
  field: string,
  value: unknown
): boolean {
  if (field === 'variantId') return (entry.variantId ?? null) === value;
  if (field === 'sets' || field === 'intervals') {
    const cur = (entry[field] as number[] | undefined) ?? [];
    const next = (value as number[] | undefined) ?? [];
    return cur.length === next.length && cur.every((n, i) => n === next[i]);
  }
  return (entry as unknown as Record<string, unknown>)[field] === value;
}

// A multi-value breakdown collapses to a single value by clearing the stored
// array: emit `[]` (the callable maps it to `deleteField()`) only when the
// entry actually had one, so we never write a redundant empty array.
function collapseBreakdown(
  patch: Record<string, unknown>,
  field: 'sets' | 'intervals',
  next: number[],
  existing: number[] | undefined
): void {
  if (next.length > 1) patch[field] = next;
  else if (existing !== undefined) patch[field] = [];
}
