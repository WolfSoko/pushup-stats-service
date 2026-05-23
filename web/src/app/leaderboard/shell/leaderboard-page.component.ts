import { Component, computed, inject, linkedSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import {
  LEADERBOARD_PUSHUP_ID,
  LeaderboardPeriod,
} from '@pu-stats/data-access';
import { LeaderboardStore } from '@pu-stats/data-access-state';
import {
  EXERCISE_CATEGORIES,
  type ExerciseCategoryInfo,
  type ExerciseDefinition,
  findExerciseDefinition,
  exercisesByCategory,
  formatExerciseValue,
} from '@pu-stats/models';
import {
  categoryDisplayName,
  exerciseDisplayName,
} from '../../stats/i18n/exercise-display-names';
import { PageHeaderComponent } from '../../core/page-header/page-header.component';

/**
 * Exercises surfaced as one-tap chips above the leaderboard list.
 * Order is curated, not alphabetical, so the most-used variants stay
 * left of the picker overflow. Pushups lead because the app is named
 * after them and they have the only server-precomputed snapshot today.
 */
type PopularExercise = {
  id: string;
  /** Resolved label — pushup id needs the category label, others the catalog name. */
  label: string;
  icon: string;
};

const PUSHUP_CHIP: PopularExercise = {
  id: LEADERBOARD_PUSHUP_ID,
  label: $localize`:@@exercise.category.pushup:Liegestütze`,
  icon: 'fitness_center',
};

const POPULAR_EXERCISE_IDS: ReadonlyArray<string> = [
  'legs.squats',
  'pull.pullups',
  'plank.standard',
  'abs.crunches',
  'cardio.running',
];

@Component({
  selector: 'app-leaderboard-page',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    RouterLink,
    PageHeaderComponent,
  ],
  templateUrl: './leaderboard-page.component.html',
  styleUrl: './leaderboard-page.component.scss',
})
export class LeaderboardPageComponent {
  private readonly store = inject(LeaderboardStore);
  private readonly user = inject(UserContextService);
  private readonly auth = inject(AuthStore);

  readonly currentUserId = this.user.userIdSafe;
  /**
   * Suppress the hint while auth is still bootstrapping. Otherwise an
   * authenticated user briefly sees the "sign in" CTA on cold load before
   * `currentUserId` populates.
   */
  readonly authResolved = this.auth.authResolved;
  readonly isLoggedIn = computed(
    () => this.currentUserId() !== '' && !this.user.isGuest()
  );

  readonly period = linkedSignal<LeaderboardPeriod>(() => 'daily');
  readonly selectedExerciseId = linkedSignal<string>(
    () => LEADERBOARD_PUSHUP_ID
  );

  readonly selectedDefinition = computed(() => {
    const id = this.selectedExerciseId();
    if (id === LEADERBOARD_PUSHUP_ID) return null;
    return findExerciseDefinition(id);
  });

  /**
   * Static chip row. The "Mehr ▾" entry below opens a menu with the
   * full catalog by category so users can still reach any exercise
   * without polluting the chip row with 40+ entries.
   */
  readonly popularExercises = computed<ReadonlyArray<PopularExercise>>(() => {
    const rest = POPULAR_EXERCISE_IDS.map<PopularExercise | null>((id) => {
      const def = findExerciseDefinition(id);
      if (!def) return null;
      return {
        id: def.id,
        label: exerciseDisplayName(def.id),
        icon: def.icon ?? 'fitness_center',
      };
    }).filter((c): c is PopularExercise => c !== null);
    return [PUSHUP_CHIP, ...rest];
  });

  /**
   * Catalog grouped by category for the overflow menu. Empty categories
   * are dropped so the menu doesn't render section headers without any
   * entries below them (forward-compat for future categories whose
   * picker entries haven't shipped yet).
   */
  readonly categorySections = computed<
    ReadonlyArray<{
      category: ExerciseCategoryInfo;
      exercises: ReadonlyArray<{ id: string; label: string }>;
    }>
  >(() => {
    const grouped = exercisesByCategory();
    return EXERCISE_CATEGORIES.flatMap((category) => {
      const defs = grouped.get(category.id) ?? [];
      const exercises = defs.map((def: ExerciseDefinition) => ({
        id: def.id,
        label: exerciseDisplayName(def.id),
      }));
      return exercises.length > 0 ? [{ category, exercises }] : [];
    });
  });

  readonly selectedLabel = computed(() => {
    const id = this.selectedExerciseId();
    if (id === LEADERBOARD_PUSHUP_ID) return PUSHUP_CHIP.label;
    return exerciseDisplayName(id);
  });

  readonly leaderboardEntries = this.store.entriesForPeriod(
    this.selectedExerciseId,
    this.period
  );
  readonly currentUserEntry = this.store.currentUserForPeriod(
    this.selectedExerciseId,
    this.period
  );

  readonly leaderboardSlots = computed(() => {
    const top = this.leaderboardEntries();
    return Array.from({ length: 25 }, (_, index) => {
      const entry = top[index];
      return (
        entry ?? {
          alias: '—',
          reps: 0,
          rank: index + 1,
        }
      );
    });
  });

  /**
   * Returns the row's display value with the unit baked in
   * (`"30 Reps"` / `"1:30"` / `"5.00 km"`). Keeping value+unit in one
   * string lets the template use a single i18n message with
   * placeholders — splitting them would block translators from
   * re-ordering the pieces. Empty-slot placeholders (`reps === 0`)
   * stay unitless so the column alignment doesn't jitter.
   */
  readonly formatValue = (value: number): string => {
    const def = this.selectedDefinition();
    if (value === 0) return '0';
    if (!def || def.unit === 'reps') {
      const repsLabel = $localize`:@@landing.leaderboard.reps:Reps`;
      return `${value} ${repsLabel}`;
    }
    return formatExerciseValue(value, def.unit);
  };

  selectExercise(id: string): void {
    this.selectedExerciseId.set(id);
    void this.store.load(id);
  }

  isActiveExercise(id: string): boolean {
    return this.selectedExerciseId() === id;
  }

  /**
   * True when the selected exercise has its own dedicated chip in the
   * popular row. When false, the "Mehr ▾" entry should display the
   * current selection as its active label so users see what's selected
   * even if it's hidden behind the overflow menu.
   */
  readonly isOverflowSelection = computed(() => {
    const id = this.selectedExerciseId();
    return !this.popularExercises().some((chip) => chip.id === id);
  });

  constructor() {
    void this.store.load(this.selectedExerciseId());
  }

  protected readonly categoryDisplayName = categoryDisplayName;
}
