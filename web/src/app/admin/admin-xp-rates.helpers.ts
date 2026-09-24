import {
  DEFAULT_XP_RATES,
  EXERCISE_CATEGORIES,
  exercisesByCategory,
  isValidXpRate,
  xpRateUnit,
  type ExerciseCategoryId,
  type XpConfig,
  type XpRateUnitKey,
} from '@pu-stats/models';
import {
  categoryDisplayName,
  exerciseDisplayName,
} from '../stats/i18n/exercise-display-names';

export interface XpRateRow {
  readonly id: string;
  readonly name: string;
  readonly unit: XpRateUnitKey;
  readonly defaultRate: number;
}

export interface XpRateGroup {
  readonly categoryId: ExerciseCategoryId;
  readonly label: string;
  readonly rows: ReadonlyArray<XpRateRow>;
}

/** Every rateable catalog exercise, grouped like the exercise picker. */
export function buildXpRateGroups(): XpRateGroup[] {
  const byCategory = exercisesByCategory();
  return EXERCISE_CATEGORIES.flatMap((category) => {
    const rows = (byCategory.get(category.id) ?? []).flatMap(
      (def): XpRateRow[] => {
        const unit = xpRateUnit(def.measurement);
        if (!unit) return [];
        return [
          {
            id: def.id,
            name: exerciseDisplayName(def.id),
            unit: unit.key,
            defaultRate: DEFAULT_XP_RATES[def.id] ?? 0,
          },
        ];
      }
    );
    return rows.length > 0
      ? [
          {
            categoryId: category.id,
            label: categoryDisplayName(category.id),
            rows,
          },
        ]
      : [];
  });
}

/** Effective rate per exercise: override where stored, else the default. */
export function effectiveRates(
  config: XpConfig | null
): Record<string, number> {
  const rates: Record<string, number> = { ...DEFAULT_XP_RATES };
  for (const [id, rate] of Object.entries(config?.rates ?? {})) {
    if (id in rates && isValidXpRate(rate)) rates[id] = rate;
  }
  return rates;
}

/**
 * The map that gets stored: only rates that differ from the shipped
 * default, so a later change of a default still reaches every exercise
 * the admin never touched.
 */
export function overridesFrom(
  rates: Readonly<Record<string, number>>
): Record<string, number> {
  const overrides: Record<string, number> = {};
  for (const [id, rate] of Object.entries(rates)) {
    if (!(id in DEFAULT_XP_RATES) || !isValidXpRate(rate)) continue;
    if (rate !== DEFAULT_XP_RATES[id]) overrides[id] = rate;
  }
  return overrides;
}

/** Parses an input value; `null` for anything outside 0…XP_RATE_MAX. */
export function parseXpRateInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  return isValidXpRate(value) ? value : null;
}

export function sameRates(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}
