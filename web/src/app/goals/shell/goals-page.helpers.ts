import {
  type ComplexGoalEntry,
  type ComplexGoals,
  EXERCISE_CATALOG,
  type ExerciseDefinition,
} from '@pu-stats/models';
import { exerciseDisplayName } from '../../stats/i18n/exercise-display-names';
import type { ExercisePickerEntry } from './goals-page.models';

function pickerFromDefinition(def: ExerciseDefinition): ExercisePickerEntry {
  return {
    id: def.id,
    label: exerciseDisplayName(def.id),
    measurement: def.measurement,
    unit: def.unit,
    min: def.min,
    max: def.max,
  };
}

export function buildExerciseOptions(): ExercisePickerEntry[] {
  return EXERCISE_CATALOG.map(pickerFromDefinition);
}

export function makeEntryId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `goal-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function findOption(
  options: readonly ExercisePickerEntry[],
  exerciseId: string
): ExercisePickerEntry | undefined {
  return options.find((o) => o.id === exerciseId);
}

export function clampTargetToOption(
  target: number,
  opt: ExercisePickerEntry
): number {
  return Math.min(opt.max, Math.max(opt.min, target || opt.min));
}

export function clampTargetForEntry(
  target: number,
  opt: ExercisePickerEntry | undefined
): number {
  const min = opt?.min ?? 1;
  const max = opt?.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, Math.trunc(target)));
}

export function normaliseWeekdays(weekdays: number[] | undefined): number[] {
  return (weekdays ?? [])
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
}

export function targetLabel(entry: ComplexGoalEntry): string {
  switch (entry.measurement) {
    case 'time':
      return $localize`:@@goals.field.target.time:Ziel (Sekunden)`;
    case 'distance':
    case 'distance-time':
      return $localize`:@@goals.field.target.distance:Ziel (Meter)`;
    case 'weight':
    case 'reps':
    default:
      return $localize`:@@goals.field.target.reps:Ziel`;
  }
}

export function targetFromInput(event: Event, fallback: number): number {
  const raw = (event.target as HTMLInputElement).value;
  if (raw === '') return fallback;
  const n = Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

function entryListEqual(
  a: readonly ComplexGoalEntry[],
  b: readonly ComplexGoalEntry[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.exerciseId !== y.exerciseId ||
      x.measurement !== y.measurement ||
      x.unit !== y.unit ||
      x.target !== y.target ||
      (x.variantId ?? '') !== (y.variantId ?? '')
    ) {
      return false;
    }
    const xw = x.weekdays ?? [];
    const yw = y.weekdays ?? [];
    if (xw.length !== yw.length) return false;
    for (let j = 0; j < xw.length; j++) {
      if (xw[j] !== yw[j]) return false;
    }
  }
  return true;
}

export function scopesEqual(a: ComplexGoals, b: ComplexGoals): boolean {
  return (
    entryListEqual(a.daily ?? [], b.daily ?? []) &&
    entryListEqual(a.weekly ?? [], b.weekly ?? []) &&
    entryListEqual(a.monthly ?? [], b.monthly ?? [])
  );
}

export function cloneGoals(goals: ComplexGoals): ComplexGoals {
  return {
    daily: [...(goals.daily ?? [])],
    weekly: [...(goals.weekly ?? [])],
    monthly: [...(goals.monthly ?? [])],
  };
}
