import { formatNumber } from '@angular/common';
import {
  findExerciseDefinition,
  xpRateFor,
  xpRateUnit,
  type XpConfig,
  type XpRateUnitKey,
} from '@pu-stats/models';

/** Localized rate unit suffix, e.g. "Wdh." / "Min." / "km". */
export function xpRateUnitLabel(key: XpRateUnitKey): string {
  switch (key) {
    case 'rep':
      return $localize`:@@xp.rate.unit.rep:Wdh.`;
    case 'minute':
      return $localize`:@@xp.rate.unit.minute:Min.`;
    case 'km':
      return $localize`:@@xp.rate.unit.km:km`;
  }
}

export function formatXpRate(rate: number, locale: string): string {
  return formatNumber(rate, locale, '1.0-2');
}

/**
 * "1 XP / Wdh.", "8 XP / Min.", "60 XP / km" — or `null` for exercises
 * without a rate unit (unknown ids, weight-measured exercises).
 */
export function xpRateLabel(
  exerciseId: string,
  rate: number,
  locale: string
): string | null {
  const definition = findExerciseDefinition(exerciseId);
  const unit = definition ? xpRateUnit(definition.measurement) : null;
  if (!unit) return null;
  const value = formatXpRate(rate, locale);
  const unitLabel = xpRateUnitLabel(unit.key);
  return $localize`:@@xp.rate.label:${value}:value: XP / ${unitLabel}:unit:`;
}

/**
 * Label with the effective rate. `config` is `null` during SSR and before
 * the admin overrides arrive, so the shipped default is rendered first.
 */
export function xpRateLabelFor(
  exerciseId: string,
  config: XpConfig | null,
  locale: string
): string | null {
  return xpRateLabel(exerciseId, xpRateFor(exerciseId, config), locale);
}

/** "≈ 30 XP" preview for a value that has not been saved yet. */
export function xpPreviewLabel(xp: number, locale: string): string {
  const value = formatNumber(xp, locale, '1.0-0');
  return $localize`:@@xp.preview.label:≈ ${value}:value: XP`;
}
