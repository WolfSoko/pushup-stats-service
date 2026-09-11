import { computed, type Signal } from '@angular/core';
import type { PublicProfile, PublicProfileExercise } from '@pu-stats/models';

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

export interface ProfileRows {
  readonly heatmapRows: Signal<ReadonlyArray<HeatmapRow>>;
  readonly exerciseGroups: Signal<ReadonlyArray<ExerciseGroup>>;
  readonly recentRows: Signal<ReadonlyArray<RecentRow>>;
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
  const value = (entry: { value: number; measurement: string }): string =>
    formatExerciseValue(
      entry.value,
      entry.measurement as PublicProfileExercise['measurement'],
      localeId
    );

  return {
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
        value
      )
    ),
  };
}
