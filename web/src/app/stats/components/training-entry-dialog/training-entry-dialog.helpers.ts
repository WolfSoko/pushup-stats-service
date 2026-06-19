import { formatNumber } from '@angular/common';
import {
  COMPANION_BOUNDS,
  EXERCISE_CATEGORIES,
  exercisesByCategory,
  ExerciseCategoryId,
  ExerciseDefinition,
  MeasurementType,
} from '@pu-stats/models';
import type {
  CategoryOption,
  ExerciseEntryDialogData,
} from './training-entry-dialog.models';

export const SECONDS_MAX = 59;

const CATEGORY_NAMES: Record<ExerciseCategoryId, () => string> = {
  pushup: () => $localize`:@@exercise.category.pushup:Liegestütze`,
  push: () => $localize`:@@exercise.category.push:Drücken`,
  pull: () => $localize`:@@exercise.category.pull:Ziehen`,
  squat: () => $localize`:@@exercise.category.squat:Kniebeuge`,
  hinge: () => $localize`:@@exercise.category.hinge:Hüftstreckung`,
  lunge: () => $localize`:@@exercise.category.lunge:Ausfallschritt`,
  carry: () => $localize`:@@exercise.category.carry:Tragen`,
  core: () => $localize`:@@exercise.category.core:Rumpf`,
  cardio: () => $localize`:@@exercise.category.cardio:Ausdauer`,
  mobility: () => $localize`:@@exercise.category.mobility:Mobilität`,
  strength: () => $localize`:@@exercise.category.strength:Krafttraining`,
};

export function buildCategoryOptions(): ReadonlyArray<CategoryOption> {
  // Filter to categories that actually have something to log in this
  // dialog: push (always — legacy pushups handled separately) plus
  // any catalog category with at least one ExerciseDefinition.
  const byCategory = exercisesByCategory();
  return EXERCISE_CATEGORIES.filter(
    (cat) => cat.id === 'pushup' || (byCategory.get(cat.id)?.length ?? 0) > 0
  ).map((cat) => ({
    value: cat.id,
    label: (CATEGORY_NAMES[cat.id] ?? (() => cat.id))(),
  }));
}

/**
 * Combine the two number-input parts into total integer seconds.
 * Returns `null` when both parts are empty or any field is invalid, so
 * the caller can disable submit instead of writing `NaN`/`0` to
 * Firestore. Either part empty is treated as 0 — typing only minutes or
 * only seconds is a valid shortcut.
 */
export function parseDurationFromParts(
  minutesInput: string,
  secondsInput: string
): number | null {
  const minTrim = minutesInput.trim();
  const secTrim = secondsInput.trim();
  if (minTrim === '' && secTrim === '') return null;

  const minutes = minTrim === '' ? 0 : Number(minTrim);
  const seconds = secTrim === '' ? 0 : Number(secTrim);
  // Reject fractional input (e.g. "1.9") so a paste-into-the-number-field
  // doesn't silently truncate to a shorter saved duration.
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds)) return null;
  if (minutes < 0 || seconds < 0) return null;
  if (seconds > SECONDS_MAX) return null;

  return minutes * 60 + seconds;
}

/**
 * Split a stored total-seconds value into the two strings shown in the
 * minutes / seconds inputs. Empty strings when no initial value, so the
 * fields render blank in create mode.
 */
export function splitDurationParts(totalSec: number | undefined): {
  minutes: string;
  seconds: string;
} {
  if (totalSec === undefined || !Number.isFinite(totalSec) || totalSec <= 0) {
    return { minutes: '', seconds: '' };
  }
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return { minutes: String(m), seconds: String(s) };
}

/**
 * Parse a user-typed km value back to integer metres. The dialog accepts
 * either decimal separator (locale-aware) and tolerates the grouping
 * separator that `formatNumber('1.2-2')` emits for 1000+ km values —
 * `.` / `,` for de/en, narrow no-break space (U+202F) or no-break space
 * (U+00A0) for fr / no.
 *
 * Strategy: strip all whitespace (covers the space-grouped locales),
 * then take the rightmost `.` or `,` as the decimal separator. The
 * integer part must be plain digits or a properly-grouped sequence
 * (`1.234`, `1,234,567`); typos like `1.2.3` or `1,2,3` are rejected
 * so they don't silently coerce to `12.3`.
 */
const KM_GROUPED_INT = /^\d{1,3}(?:[.,]\d{3})+$/;
const KM_DIGITS = /^\d+$/;

export function parseKmToMeters(input: string): number | null {
  const trimmed = input.replace(/\s/g, '');
  if (!trimmed) return null;
  const decimalAt = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf(',')
  );
  const intPart = decimalAt < 0 ? trimmed : trimmed.slice(0, decimalAt);
  const fracPart = decimalAt < 0 ? '' : trimmed.slice(decimalAt + 1);
  if (intPart === '' && fracPart === '') return null;
  if (
    intPart !== '' &&
    !KM_DIGITS.test(intPart) &&
    !KM_GROUPED_INT.test(intPart)
  ) {
    return null;
  }
  if (fracPart !== '' && !KM_DIGITS.test(fracPart)) return null;
  const normalized = `${intPart.replace(/[.,]/g, '') || '0'}.${fracPart || '0'}`;
  const km = Number(normalized);
  if (!Number.isFinite(km) || km <= 0) return null;
  return Math.round(km * 1000);
}

export function formatKm(km: number, locale: string): string {
  return formatNumber(km, locale, '1.2-2');
}

export function formatKmInput(distanceM: number, locale: string): string {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return '';
  return formatKm(distanceM / 1000, locale);
}

/**
 * Infer the catalog category for a stale `exerciseId` whose catalog
 * entry has been renamed or removed. Catalog ids follow the dotted
 * convention `'<category>.<exercise>'`, so the prefix is enough to
 * recover the right dashboard mode without a registry lookup. Falls
 * back to the first non-pushup category that has at least one catalog
 * exercise so the dialog never opens in pushup mode for an
 * exercise-kind entry.
 */
export function inferExerciseCategory(
  exerciseId: string | undefined
): ExerciseCategoryId {
  const prefix = exerciseId?.split('.')[0];
  // Legacy id prefixes from before the movement-pattern restructure
  // still appear in Firestore docs — map them onto the new categories.
  const LEGACY_PREFIX_MAP: Record<string, ExerciseCategoryId> = {
    abs: 'core',
    plank: 'core',
    legs: 'squat',
  };
  if (prefix && prefix in LEGACY_PREFIX_MAP) {
    return LEGACY_PREFIX_MAP[prefix];
  }
  const known = EXERCISE_CATEGORIES.find((c) => c.id === prefix);
  if (known && known.id !== 'pushup') return known.id;
  const byCategory = exercisesByCategory();
  const fallback = EXERCISE_CATEGORIES.find(
    (c) => c.id !== 'pushup' && (byCategory.get(c.id)?.length ?? 0) > 0
  );
  return fallback?.id ?? 'core';
}

/**
 * Build a permissive `ExerciseDefinition` for a stale catalog id so
 * the edit dialog can still render an entry whose original definition
 * has been renamed or removed. Picks the measurement off the existing
 * payload (durationSec → time, distanceM+durationSec → distance-time,
 * else reps) and uses {@link COMPANION_BOUNDS} for the cap so the
 * over-cap hint and submit gate keep working.
 */
export function syntheticDefinitionFor(
  data: ExerciseEntryDialogData,
  categoryId: ExerciseCategoryId
): ExerciseDefinition {
  const measurement: MeasurementType =
    data.distanceM !== undefined && data.durationSec !== undefined
      ? 'distance-time'
      : data.durationSec !== undefined
        ? 'time'
        : 'reps';
  const bounds =
    measurement === 'reps'
      ? COMPANION_BOUNDS.reps
      : measurement === 'time'
        ? COMPANION_BOUNDS.durationSec
        : COMPANION_BOUNDS.distanceM;
  const unit =
    measurement === 'reps' ? 'reps' : measurement === 'time' ? 's' : 'm';
  return {
    id: data.exerciseId,
    categoryId,
    measurement,
    min: bounds.min,
    max: bounds.max,
    unit,
  };
}
