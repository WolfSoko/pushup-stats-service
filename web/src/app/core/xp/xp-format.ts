import { formatNumber } from '@angular/common';
import type { LevelProgress } from '@pu-stats/models';

/** "1.234 XP" — the one way every XP amount is written. */
export function formatXp(value: number, locale: string): string {
  const xp = formatNumber(value, locale, '1.0-0');
  return $localize`:@@xp.value:${xp}:xp: XP`;
}

/** Progress towards the next level as a whole percentage for progress bars. */
export function levelPercent(
  progress: Pick<LevelProgress, 'fraction'>
): number {
  return Math.round(progress.fraction * 100);
}
