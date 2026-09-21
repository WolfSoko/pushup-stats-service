import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import type { Workout } from '@pu-stats/models';
import { BusyDirective } from '@pu-stats/ui';

import { workoutSummary } from './workout-summary';

/** One workout in the list: what it asks for, where it came from, and the actions. */
@Component({
  selector: 'app-workout-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BusyDirective,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    RouterLink,
  ],
  template: `
    <mat-card class="workout-card" data-testid="workout-card">
      <mat-card-header>
        <mat-card-title>{{ workout().title }}</mat-card-title>
        <mat-card-subtitle>
          <span data-testid="workout-summary">{{ summary() }}</span>
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (workout().description) {
          <p class="description">{{ workout().description }}</p>
        }
        <div class="badges">
          @if (workout().sharedBy; as source) {
            <span class="badge" data-testid="workout-source">
              <mat-icon aria-hidden="true">redeem</mat-icon>
              <span i18n="@@workouts.card.from">Von {{ sourceName() }}</span>
            </span>
          }
          @if (workout().onProfile) {
            <span class="badge" data-testid="workout-on-profile">
              <mat-icon aria-hidden="true">public</mat-icon>
              <span i18n="@@workouts.card.onProfile">Auf deinem Profil</span>
            </span>
          }
        </div>
      </mat-card-content>
      <mat-card-actions class="actions">
        <a
          mat-flat-button
          color="primary"
          data-testid="workout-run"
          [routerLink]="['/workouts', workout().id, 'run']"
        >
          <mat-icon>play_arrow</mat-icon>
          <span i18n="@@workouts.card.run">Starten</span>
        </a>
        <a
          mat-stroked-button
          data-testid="workout-edit"
          [routerLink]="['/workouts', workout().id, 'edit']"
        >
          <mat-icon>edit</mat-icon>
          <span i18n="@@workouts.card.edit">Bearbeiten</span>
        </a>
        <span class="spacer"></span>
        <button
          mat-icon-button
          type="button"
          data-testid="workout-share"
          [matTooltip]="shareLabel"
          [attr.aria-label]="shareLabel"
          [puBusy]="isBusy('share')"
          (click)="share.emit(workout().id)"
        >
          <mat-icon>send</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          data-testid="workout-toggle-profile"
          [matTooltip]="profileLabel()"
          [attr.aria-label]="profileLabel()"
          [attr.aria-pressed]="workout().onProfile"
          [puBusy]="isBusy('profile')"
          (click)="toggleProfile.emit(workout())"
        >
          <mat-icon>{{
            workout().onProfile ? 'public' : 'public_off'
          }}</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          data-testid="workout-delete"
          [matTooltip]="deleteLabel"
          [attr.aria-label]="deleteLabel"
          [puBusy]="isBusy('remove')"
          (click)="remove.emit(workout())"
        >
          <mat-icon>delete</mat-icon>
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .workout-card {
      margin-bottom: 12px;
    }
    .description {
      margin: 0 0 8px;
      white-space: pre-wrap;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .spacer {
      flex: 1;
    }
  `,
})
export class WorkoutCardComponent {
  readonly workout = input.required<Workout>();
  /** The store's busy keys: `<action>:<id>` spins that button. */
  readonly busyKeys = input<ReadonlySet<string>>(new Set());

  readonly share = output<string>();
  readonly toggleProfile = output<Workout>();
  readonly remove = output<Workout>();

  protected readonly shareLabel = $localize`:@@workouts.card.share:An Freunde schicken`;
  protected readonly deleteLabel = $localize`:@@workouts.card.delete:Löschen`;

  protected readonly summary = computed(() =>
    workoutSummary(this.workout().exercises)
  );

  protected isBusy(action: 'share' | 'profile' | 'remove'): boolean {
    return this.busyKeys().has(`${action}:${this.workout().id}`);
  }

  protected readonly sourceName = computed(
    () =>
      this.workout().sharedBy?.displayName ??
      $localize`:@@friends.anonymous:Ohne Namen`
  );

  protected readonly profileLabel = computed(() =>
    this.workout().onProfile
      ? $localize`:@@workouts.card.hideFromProfile:Vom Profil nehmen`
      : $localize`:@@workouts.card.showOnProfile:Auf dem Profil zeigen`
  );
}
