import {
  displayPushupType,
  findExerciseDefinition,
  findExerciseWikiEntry,
  findPushupTypeByStoredValue,
  formatEntryDisplay,
  formatExerciseValue,
  measurementValueField,
  UnifiedEntry,
  unifiedEntryFilterKey,
} from '@pu-stats/models';
import { exerciseDisplayName } from '../../i18n/exercise-display-names';

/**
 * Whether the row set spans more than one distinct exercise. Drives the
 * "Übung" column so a uniform set (pushup-only preview, or a user who's
 * logged just squats) does not show a column where every cell repeats
 * the same label. Discrimination is by `unifiedEntryFilterKey` so all
 * pushup variants count as one entry.
 */
export function spansMultipleExercises(rows: UnifiedEntry[]): boolean {
  if (rows.length === 0) return false;
  return new Set(rows.map((r) => unifiedEntryFilterKey(r))).size > 1;
}

export function buildDisplayedColumns(opts: {
  showExercise: boolean;
  showSource: boolean;
  readOnly: boolean;
}): string[] {
  const cols: string[] = ['timestamp', 'reps'];
  if (opts.showExercise) cols.push('exercise');
  cols.push('type');
  if (opts.showSource) cols.push('source');
  if (!opts.readOnly) cols.push('actions');
  return cols;
}

/**
 * Sort key for the MatTable column `property`. The "reps" column renders
 * measurement-aware values (reps for sit-ups/squats, durationSec for
 * plank, distanceM for the composite distance-time cardio.running), so
 * it sorts by the primary measurement field — otherwise distance-time
 * rows would tie on duration and plank rows would tie on the normalized
 * 0 reps.
 */
export function sortingValue(
  item: UnifiedEntry,
  property: string,
  locale: string
): string | number {
  if (property === 'timestamp') return new Date(item.timestamp).getTime();
  if (property === 'reps') return sortValue(item);
  if (property === 'source') return item.source;
  if (property === 'type') return typeLabel(item, locale);
  if (property === 'exercise') return exerciseLabel(item);
  return '';
}

export function typeLabel(entry: UnifiedEntry, locale: string): string {
  if (entry.exerciseId === 'pushup') {
    return displayPushupType(entry.variantId ?? '', locale);
  }
  // Typ is a sub-type (variant), not the exercise itself —
  // surfacing the exercise name here would duplicate the Übung column.
  return entry.variantId ?? '';
}

export function exerciseLabel(entry: UnifiedEntry): string {
  if (entry.exerciseId === 'pushup') {
    return $localize`:@@exercise.category.pushup:Liegestütze`;
  }
  const def = findExerciseDefinition(entry.exerciseId);
  if (!def) return entry.exerciseId;
  return exerciseDisplayName(def.id);
}

/**
 * Wiki deep-link for the entry's exercise label. Pushup rows route to
 * the dedicated `/wiki/liegestuetz-typen` wiki with the variant slug
 * (when known); catalog exercise rows route to `/wiki/uebungen/<slug>`
 * when an entry exists, else to the list page so a stale catalog id
 * can't 404 the link. Always returns a usable target — every row in
 * the stats table maps to either the pushup wiki or the generic
 * exercises wiki, so the column is always rendered as a link.
 */
export function exerciseWikiLink(entry: UnifiedEntry): string[] {
  if (entry.exerciseId === 'pushup') {
    const variant = findPushupTypeByStoredValue(entry.variantId);
    return variant
      ? ['/wiki/liegestuetz-typen', variant.slug]
      : ['/wiki/liegestuetz-typen'];
  }
  const wikiEntry = findExerciseWikiEntry(entry.exerciseId);
  return wikiEntry ? ['/wiki/uebungen', wikiEntry.slug] : ['/wiki/uebungen'];
}

export function formatSets(sets: number[]): string {
  if (!sets?.length) return '';
  const allSame = sets.every((s) => s === sets[0]);
  return allSame ? `${sets.length}×${sets[0]}` : sets.join(' + ');
}

/**
 * Renders the "Reps" column for any measurement type. Pushup rows
 * fall through to the legacy reps + sets path; for catalog
 * exercises we route through {@link formatEntryDisplay} which
 * handles the composite distance-time format and the per-unit
 * formatting in one place.
 */
export function formatEntry(entry: UnifiedEntry): string {
  const def = findExerciseDefinition(entry.exerciseId);
  if (!def) return String(entry.reps);
  return formatEntryDisplay(entry, def);
}

/**
 * Sort key for the "Reps" column. Picks the primary measurement
 * field per definition: distance for cardio.running, duration for
 * plank, reps for everything else. Falls back to `entry.reps` when
 * the catalog id is missing — same fallback the table uses for
 * stale entries.
 */
export function sortValue(entry: UnifiedEntry): number {
  const def = findExerciseDefinition(entry.exerciseId);
  if (!def) return entry.reps;
  const field = measurementValueField(def.measurement);
  return (entry[field] as number | undefined) ?? entry.reps;
}

/**
 * Format a duration cell. Delegates to the unit-aware
 * `formatExerciseValue` so the same helper drives the section card,
 * the dialog cap hint, and this column — keeps display logic in one
 * place when more units (kg, m) land in later phases.
 */
export function formatDuration(totalSec: number): string {
  return formatExerciseValue(totalSec, 's');
}
