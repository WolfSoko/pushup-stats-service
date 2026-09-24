import { formatNumber } from '@angular/common';
import {
  LEADERBOARD_PUSHUP_ID,
  LEADERBOARD_XP_ID,
} from '@pu-stats/data-access';
import { findExerciseDefinition, formatExerciseValue } from '@pu-stats/models';
import { exerciseDisplayName } from '../../stats/i18n/exercise-display-names';

export type PopularExercise = {
  id: string;
  label: string;
  icon: string;
};

export const XP_CHIP: PopularExercise = {
  id: LEADERBOARD_XP_ID,
  label: $localize`:@@leaderboard.xp.chip:Gesamt-XP`,
  icon: 'bolt',
};

export const PUSHUP_CHIP: PopularExercise = {
  id: LEADERBOARD_PUSHUP_ID,
  label: $localize`:@@exercise.category.pushup:Liegestütze`,
  icon: 'fitness_center',
};

/**
 * Curated, not alphabetical: XP leads because it compares everyone
 * whatever they train, pushups follow because the app is named after
 * them, then the high-traffic exercises.
 */
const POPULAR_EXERCISE_IDS: ReadonlyArray<string> = [
  'legs.squats',
  'pull.pullups',
  'plank.standard',
  'abs.crunches',
  'cardio.running',
];

export function buildPopularExercises(): ReadonlyArray<PopularExercise> {
  const rest = POPULAR_EXERCISE_IDS.flatMap((id): PopularExercise[] => {
    const def = findExerciseDefinition(id);
    if (!def) return [];
    return [
      {
        id: def.id,
        label: exerciseDisplayName(def.id),
        icon: def.icon ?? 'fitness_center',
      },
    ];
  });
  return [XP_CHIP, PUSHUP_CHIP, ...rest];
}

export function leaderboardLabel(id: string): string {
  if (id === LEADERBOARD_XP_ID) return XP_CHIP.label;
  if (id === LEADERBOARD_PUSHUP_ID) return PUSHUP_CHIP.label;
  return exerciseDisplayName(id);
}

export function formatXp(value: number, locale: string): string {
  const xp = formatNumber(value, locale, '1.0-0');
  return $localize`:@@leaderboard.xp.value:${xp}:xp: XP`;
}

/**
 * The row's display value with the unit baked in (`"30 Reps"`, `"1:30"`,
 * `"5.00 km"`, `"1.234 XP"`), so the template can use one i18n message
 * with placeholders that translators may re-order. Empty-slot
 * placeholders (`0`) stay unitless so the column does not jitter.
 */
export function formatLeaderboardValue(
  value: number,
  id: string,
  locale: string
): string {
  if (value === 0) return '0';
  if (id === LEADERBOARD_XP_ID) return formatXp(value, locale);
  const def = id === LEADERBOARD_PUSHUP_ID ? null : findExerciseDefinition(id);
  if (!def || def.unit === 'reps') {
    const repsLabel = $localize`:@@landing.leaderboard.reps:Reps`;
    return `${value} ${repsLabel}`;
  }
  return formatExerciseValue(value, def.unit);
}
