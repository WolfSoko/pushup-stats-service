import { formatNumber } from '@angular/common';
import type { ProfileSection, PublicProfile } from '@pu-stats/models';

import { formatXp } from '../core/xp/xp-format';
import { formatExerciseTotal } from './exercise-total.format';
import { PROFILE_LABELS } from './profile-labels';

export interface ProfileStatCard {
  /** Unique per card; several cards can share one section switch. */
  readonly key: string;
  readonly section: ProfileSection;
  readonly label: string;
  readonly value: string;
  readonly hasContent: boolean;
}

/** The lifetime tiles, summed across every exercise by the server. */
export function buildProfileStatCards(
  profile: PublicProfile,
  locale: string
): ReadonlyArray<ProfileStatCard> {
  const card = (
    key: string,
    section: ProfileSection,
    label: string,
    raw: number | null,
    format: (value: number) => string
  ): ProfileStatCard => ({
    key,
    section,
    label,
    value: raw === null ? '' : format(raw),
    hasContent: raw !== null,
  });
  /**
   * Time and distance are left out while zero, switches or not: most
   * people never log a plank or a run, and "0 min" would read as a
   * verdict. The shared `total` switch stays reachable on the reps card.
   */
  const ifLogged = (c: ProfileStatCard, raw: number | null) =>
    raw !== null && raw > 0 ? [c] : [];
  const count = (value: number) => formatNumber(value, locale, '1.0-0');
  const xp = (value: number) => formatXp(value, locale);
  const labels = PROFILE_LABELS;

  return [
    card('reps', 'total', labels.reps, profile.total, count),
    ...ifLogged(
      card(
        'duration',
        'total',
        labels.duration,
        profile.totalDurationSec,
        (value) => formatExerciseTotal(value, 'time', locale)
      ),
      profile.totalDurationSec
    ),
    ...ifLogged(
      card(
        'distance',
        'total',
        labels.distance,
        profile.totalDistanceM,
        (value) => formatExerciseTotal(value, 'distance', locale)
      ),
      profile.totalDistanceM
    ),
    card('days', 'days', labels.days, profile.totalDays, count),
    card('streak', 'streak', labels.streak, profile.currentStreak, count),
    card('entries', 'entries', labels.entries, profile.totalEntries, count),
    card('bestEntry', 'bestSet', labels.bestEntry, profile.bestEntryXp, xp),
    card('bestDay', 'bestDay', labels.bestDay, profile.bestDayXp, xp),
  ];
}
