import { computed, type Signal } from '@angular/core';
import {
  findPlanById,
  type PublicProfile,
  type PublicProfileExercise,
} from '@pu-stats/models';

import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import {
  formatExerciseTotal,
  formatExerciseValue,
} from './exercise-total.format';
import { EXERCISE_GROUP_LABELS, WEEKDAY_LABELS } from './profile-labels';
import {
  buildExerciseGroups,
  buildHeatmapRows,
  buildRecentRows,
  type ExerciseGroup,
  type HeatmapRow,
  type RecentRow,
} from './profile-view.model';

export interface PlanView {
  readonly title: string;
  readonly slug: string;
  readonly dayLine: string;
  readonly percent: number;
  readonly paused: boolean;
}

export interface ProfileRows {
  readonly heatmapRows: Signal<ReadonlyArray<HeatmapRow>>;
  readonly exerciseGroups: Signal<ReadonlyArray<ExerciseGroup>>;
  readonly recentRows: Signal<ReadonlyArray<RecentRow>>;
  readonly plan: Signal<PlanView | null>;
}

/**
 * Everything the page renders as a list, derived from one profile.
 *
 * The three builders need the same two things — display names and the
 * locale — and the page component has enough to do with loading, photo,
 * sharing and the audience switches.
 */
export function createProfileRows(
  profile: Signal<PublicProfile | null>,
  localeId: string
): ProfileRows {
  /**
   * Every other number on this profile is bucketed in Berlin — the
   * heatmap included — so a workout must not land on a different weekday
   * here just because the visitor is in another timezone.
   */
  const time = (timestamp: string): string => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(localeId, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin',
    }).format(date);
  };

  const value = (entry: { value: number; measurement: string }): string =>
    formatExerciseValue(
      entry.value,
      entry.measurement as PublicProfileExercise['measurement'],
      localeId
    );

  return {
    plan: computed<PlanView | null>(() => {
      const progress = profile()?.plan ?? null;
      // The projection names the plan by id; title and length come from
      // the local catalog, so the visitor reads them in their language.
      const plan = progress ? findPlanById(progress.planId) : null;
      if (!progress || !plan) return null;
      return {
        title: plan.title,
        slug: plan.slug,
        dayLine: $localize`:@@publicProfile.plan.day:Tag ${progress.dayIndex}:day: von ${progress.totalDays}:total:`,
        percent: Math.round((progress.dayIndex / progress.totalDays) * 100),
        paused: progress.paused,
      };
    }),
    heatmapRows: computed(() =>
      buildHeatmapRows(profile()?.heatmap ?? {}, WEEKDAY_LABELS)
    ),
    exerciseGroups: computed(() =>
      buildExerciseGroups(
        profile()?.exercises ?? [],
        (entry) => exerciseDisplayName(entry.exerciseId),
        (entry) =>
          formatExerciseTotal(entry.total, entry.measurement, localeId),
        (kind) => EXERCISE_GROUP_LABELS[kind]
      )
    ),
    recentRows: computed(() =>
      buildRecentRows(
        profile()?.recent ?? [],
        (exerciseId) => exerciseDisplayName(exerciseId),
        value,
        time
      )
    ),
  };
}
