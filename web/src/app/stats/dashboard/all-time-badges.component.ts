import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import type { TrainingSummary } from '@pu-stats/models';
import { SkeletonComponent } from '@pu-stats/ui';

import { formatExerciseTotal } from '../../public-profile/exercise-total.format';

/**
 * The badge row above the dashboard: everything the user ever logged,
 * across every exercise — the same `summarizeTraining` numbers the public
 * profile shows.
 *
 * Volume stays per unit (reps, time, distance); time and distance only
 * appear once something was logged, so a pure push-up user sees no
 * "0 min". The row is one link to the analysis page, so each badge's
 * explanation lives in its tooltip and `aria-label`.
 */
@Component({
  selector: 'app-all-time-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatIconModule,
    MatTooltipModule,
    RouterLink,
    SkeletonComponent,
  ],
  template: `
    <section class="all-time">
      <h2 class="all-time-heading">
        <mat-icon aria-hidden="true">fitness_center</mat-icon>
        <span i18n="@@dashboard.allTime.headingAll"
          >Alle Übungen seit Beginn</span
        >
      </h2>
      <a
        class="mini-badges mini-badges--link"
        routerLink="/analysis"
        data-testid="dashboard-all-time-badges-link"
        [attr.aria-busy]="loading() ? 'true' : null"
      >
        <span
          class="badge"
          data-testid="all-time-reps"
          [matTooltip]="hints.reps"
          [attr.aria-label]="hints.reps"
        >
          <small i18n="@@allTime.reps">Wiederholungen</small
          ><b>
            @if (loading()) {
              <pu-skeleton width="2.5em" />
            } @else {
              {{ summary().reps | number: '1.0-0' }}
            }
          </b>
        </span>
        @if (!loading() && summary().durationSec > 0) {
          <span
            class="badge"
            data-testid="all-time-duration"
            [matTooltip]="hints.duration"
            [attr.aria-label]="hints.duration"
          >
            <small i18n="@@allTime.duration">Zeit</small><b>{{ duration() }}</b>
          </span>
        }
        @if (!loading() && summary().distanceM > 0) {
          <span
            class="badge"
            data-testid="all-time-distance"
            [matTooltip]="hints.distance"
            [attr.aria-label]="hints.distance"
          >
            <small i18n="@@allTime.distance">Strecke</small
            ><b>{{ distance() }}</b>
          </span>
        }
        <span
          class="badge"
          data-testid="all-time-days"
          [matTooltip]="hints.days"
          [attr.aria-label]="hints.days"
        >
          <small i18n="@@allTime.days">Trainingstage</small
          ><b>
            @if (loading()) {
              <pu-skeleton width="2.5em" />
            } @else {
              {{ summary().days | number: '1.0-0' }}
            }
          </b>
        </span>
        <span
          class="badge"
          data-testid="all-time-entries"
          [matTooltip]="hints.entries"
          [attr.aria-label]="hints.entries"
        >
          <small i18n="@@allTimeEntries">Einträge</small
          ><b>
            @if (loading()) {
              <pu-skeleton width="2.5em" />
            } @else {
              {{ summary().entries | number: '1.0-0' }}
            }
          </b>
        </span>
        <span class="badges-cta">
          <mat-icon aria-hidden="true">insights</mat-icon>
          <span i18n="@@dashboard.allTimeBadges.cta">Zur Analyse</span>
        </span>
      </a>
    </section>
  `,
  styleUrl: './all-time-badges.component.scss',
})
export class AllTimeBadgesComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly summary = input.required<TrainingSummary>();
  readonly loading = input(false);

  protected readonly duration = computed(() =>
    formatExerciseTotal(this.summary().durationSec, 'time', this.locale)
  );
  protected readonly distance = computed(() =>
    formatExerciseTotal(this.summary().distanceM, 'distance', this.locale)
  );

  protected readonly hints = {
    reps: $localize`:@@dashboard.allTime.hint.reps:Alle Wiederholungen deiner Stückübungen zusammen – Liegestütze, Sit-ups, Kniebeugen und alle anderen.`,
    duration: $localize`:@@dashboard.allTime.hint.duration:Gesamte Zeit deiner Zeitübungen wie Planks und Halteübungen.`,
    distance: $localize`:@@dashboard.allTime.hint.distance:Gesamte Strecke deiner Lauf- und Streckenübungen.`,
    days: $localize`:@@dashboard.allTime.hint.trainingDays:Tage, an denen du mindestens eine Übung eingetragen hast.`,
    entries: $localize`:@@dashboard.allTime.hint.allEntries:Anzahl aller Einträge über alle Übungen – jede erfasste Serie zählt als einer.`,
  } as const;
}
