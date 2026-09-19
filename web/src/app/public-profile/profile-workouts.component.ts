import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import type { PublicProfileWorkout } from '@pu-stats/models';

import { workoutSummary } from '../workouts/workout-summary';
import { WorkoutsStore } from '../workouts/workouts.store';
import { PROFILE_LABELS } from './profile-labels';

/**
 * The workouts an owner put on their profile, each with a "take a copy"
 * button. The copy is written by the viewer into their own list — the
 * projection is already sanitized server-side — and stays private until
 * they put it on their own profile.
 *
 * The auth stack is resolved lazily: this route renders for anonymous
 * visitors, and an anonymous click is sent to the signup page rather
 * than guarded away.
 */
@Component({
  selector: 'app-profile-workouts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <ul class="workout-list">
      @for (workout of workouts(); track workout.id) {
        <li class="workout-card" data-testid="public-profile-workout">
          <span class="workout-text">
            <strong>{{ workout.title }}</strong>
            <small>{{ summary(workout) }}</small>
            @if (workout.description) {
              <small class="workout-description">{{
                workout.description
              }}</small>
            }
          </span>
          @if (isOwner()) {
            <a mat-button routerLink="/workouts">{{ labels.workoutsOwn }}</a>
          } @else if (copied().has(workout.id)) {
            <a
              mat-button
              routerLink="/workouts"
              data-testid="profile-workout-copied"
            >
              <mat-icon>check</mat-icon>
              <span>{{ labels.workoutsCopied }}</span>
            </a>
          } @else {
            <button
              mat-stroked-button
              type="button"
              data-testid="profile-workout-copy"
              [disabled]="busy()"
              (click)="copy(workout)"
            >
              <mat-icon>content_copy</mat-icon>
              <span>{{ labels.workoutsCopy }}</span>
            </button>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    .workout-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .workout-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(128, 128, 128, 0.3));
      background: var(
        --mat-sys-surface-container-low,
        rgba(128, 128, 128, 0.06)
      );
    }
    .workout-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1 1 auto;
      min-width: 0;
    }
    .workout-description {
      opacity: 0.75;
    }
  `,
})
export class ProfileWorkoutsComponent {
  readonly workouts = input.required<ReadonlyArray<PublicProfileWorkout>>();
  readonly ownerUid = input.required<string>();
  readonly ownerName = input.required<string>();
  readonly isOwner = input(false);

  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);

  protected readonly labels = PROFILE_LABELS;
  protected readonly busy = signal(false);
  protected readonly copied = signal<ReadonlySet<string>>(new Set());

  protected summary(workout: PublicProfileWorkout): string {
    return workoutSummary(workout.exercises);
  }

  protected async copy(workout: PublicProfileWorkout): Promise<void> {
    const user = this.injector.get(UserContextService, null);
    if (!user?.userIdSafe()) {
      void this.router.navigate(['/register'], {
        queryParams: { returnUrl: `/u/${this.ownerUid()}` },
      });
      return;
    }
    const store = this.injector.get(WorkoutsStore, null);
    if (!store || this.busy()) return;
    this.busy.set(true);
    try {
      const id = await store.importWorkout(workout, {
        uid: this.ownerUid(),
        workoutId: workout.id,
        displayName: this.ownerName(),
      });
      if (id) {
        this.copied.update((set) => new Set(set).add(workout.id));
        this.snackbar.open(this.labels.workoutsCopiedNote, undefined, {
          duration: 3000,
        });
      } else {
        this.snackbar.open(this.labels.workoutsCopyFailed, undefined, {
          duration: 4000,
        });
      }
    } finally {
      this.busy.set(false);
    }
  }
}
