import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import type { Workout } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';

import { UserContextService } from '@pu-auth/auth';

import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { UserConfigStore } from '../core/user-config.store';
import { WorkoutCardComponent } from './workout-card.component';
import { workoutRejectionMessage } from './workouts-messages';
import { WorkoutsStore } from './workouts.store';

/**
 * The user's own sessions: composed here, received from friends, or
 * copied off a profile. Every card starts, edits, shares or deletes one.
 */
@Component({
  selector: 'app-workouts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    RouterLink,
    WorkoutCardComponent,
  ],
  templateUrl: './workouts-page.component.html',
  styleUrl: './workouts-page.component.css',
})
export class WorkoutsPageComponent {
  protected readonly store = inject(WorkoutsStore);
  private readonly config = inject(UserConfigStore);
  private readonly user = inject(UserContextService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private destroyed = false;

  protected readonly rejection = computed(() =>
    workoutRejectionMessage(this.store.lastRejection())
  );

  /**
   * The profile switch for the whole section lives on the profile page;
   * a card's "show on profile" only matters once that switch is open, so
   * the page says so instead of letting the toggle look like it worked.
   */
  protected readonly profileSectionOff = computed(() => {
    const level = this.config.config()?.ui?.profileVisibility?.['workouts'];
    return level !== 'public' && level !== 'friends';
  });

  /** The switch sits on the user's own profile page, next to the section. */
  protected readonly profileUrl = computed(() => {
    const uid = this.user.userIdSafe();
    return uid ? `/u/${uid}` : '/settings/profil';
  });

  protected readonly hasProfileWorkouts = computed(() =>
    this.store.workouts().some((w) => w.onProfile)
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  protected async share(id: string): Promise<void> {
    const { WorkoutShareDialogComponent } =
      await import('./workout-share-dialog.component');
    if (this.destroyed) return;
    const ref = this.dialog.open(WorkoutShareDialogComponent, {
      autoFocus: 'dialog',
    });
    const friendUids = (await firstValueFrom(ref.afterClosed())) as
      | string[]
      | undefined;
    if (!friendUids || friendUids.length === 0) return;
    if (await this.store.share(id, friendUids)) {
      const sent = this.store.lastShared();
      this.snackbar.open(
        $localize`:@@workouts.shared:Session an ${sent}:count: Freund(e) geschickt.`,
        undefined,
        { duration: 3000 }
      );
    }
  }

  protected toggleProfile(workout: Workout): void {
    void this.store.setOnProfile(workout.id, !workout.onProfile);
  }

  protected async remove(workout: Workout): Promise<void> {
    const { WorkoutDeleteDialogComponent } =
      await import('./workout-delete-dialog.component');
    if (this.destroyed) return;
    const ref = this.dialog.open(WorkoutDeleteDialogComponent, {
      data: { title: workout.title },
      autoFocus: 'dialog',
    });
    if ((await firstValueFrom(ref.afterClosed())) !== true) return;
    await this.store.remove(workout.id);
  }
}
