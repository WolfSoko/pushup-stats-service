import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  linkedSignal,
  ChangeDetectionStrategy,
  LOCALE_ID,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { LEADERBOARD_XP_ID, LeaderboardPeriod } from '@pu-stats/data-access';
import { LeaderboardStore, XpStore } from '@pu-stats/data-access-state';
import { BusyDirective, SkeletonComponent } from '@pu-stats/ui';
import {
  EXERCISE_CATEGORIES,
  type ExerciseCategoryInfo,
  type ExerciseDefinition,
  exercisesByCategory,
} from '@pu-stats/models';
import {
  categoryDisplayName,
  exerciseDisplayName,
} from '../../stats/i18n/exercise-display-names';
import { PageHeaderComponent } from '../../core/page-header/page-header.component';
import {
  buildPopularExercises,
  formatLeaderboardValue,
  leaderboardLabel,
  type PopularExercise,
} from './leaderboard-page.helpers';

@Component({
  selector: 'app-leaderboard-page',
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    RouterLink,
    PageHeaderComponent,
    BusyDirective,
    SkeletonComponent,
  ],
  templateUrl: './leaderboard-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './leaderboard-page.component.scss',
})
export class LeaderboardPageComponent {
  private readonly store = inject(LeaderboardStore);
  private readonly user = inject(UserContextService);
  private readonly auth = inject(AuthStore);
  private readonly xp = inject(XpStore);
  private readonly locale = inject(LOCALE_ID);

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
  readonly selectedExerciseId = linkedSignal<string>(() => LEADERBOARD_XP_ID);

  readonly isXpSelected = computed(
    () => this.selectedExerciseId() === LEADERBOARD_XP_ID
  );
  readonly ownLevel = computed(() =>
    this.xp.loaded() ? this.xp.progress().level : null
  );

  /**
   * Static chip row. The "Mehr ▾" entry opens a menu with the full
   * catalog by category, so every exercise stays reachable without 40+
   * chips.
   */
  readonly popularExercises: ReadonlyArray<PopularExercise> =
    buildPopularExercises();

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

  readonly selectedLabel = computed(() =>
    leaderboardLabel(this.selectedExerciseId())
  );

  readonly leaderboardEntries = this.store.entriesForPeriod(
    this.selectedExerciseId,
    this.period
  );
  readonly currentUserEntry = this.store.currentUserForPeriod(
    this.selectedExerciseId,
    this.period
  );
  readonly lastUpdated = this.store.lastUpdatedFor(this.selectedExerciseId);

  /** First load of the selection: no cached rows to show yet, so the slots are skeletons. */
  readonly listLoading = computed(
    () => this.store.loading() && this.leaderboardEntries().length === 0
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

  readonly formatValue = (value: number): string =>
    formatLeaderboardValue(value, this.selectedExerciseId(), this.locale);

  skeletonAliasWidth(rank: number): string {
    return `${45 + ((rank * 7) % 30)}%`;
  }

  selectExercise(id: string): void {
    this.selectedExerciseId.set(id);
    void this.store.load(id);
  }

  isActiveExercise(id: string): boolean {
    return this.selectedExerciseId() === id;
  }

  isExerciseBusy(id: string): boolean {
    return this.store.busy.isBusy(id);
  }

  /**
   * True when the selected exercise has its own dedicated chip in the
   * popular row. When false, the "Mehr ▾" entry should display the
   * current selection as its active label so users see what's selected
   * even if it's hidden behind the overflow menu.
   */
  readonly isOverflowSelection = computed(() => {
    const id = this.selectedExerciseId();
    return !this.popularExercises.some((chip) => chip.id === id);
  });

  constructor() {
    void this.store.load(this.selectedExerciseId());
  }

  protected readonly categoryDisplayName = categoryDisplayName;
}
