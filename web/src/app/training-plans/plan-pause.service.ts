import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { TrainingPlanStore } from './training-plan.store';

/**
 * Putting a plan on hold and picking it back up, including the feedback
 * that tells the user what it cost them: nothing.
 *
 * Separate from the pages that offer it (the plan list and the detail
 * page both do) so the wording and the day the plan waits at are stated
 * in one place.
 */
@Injectable({ providedIn: 'root' })
export class PlanPauseService {
  private readonly store = inject(TrainingPlanStore);
  private readonly snackbar = inject(MatSnackBar);

  async pause(): Promise<void> {
    // Read before the write: afterwards the store reloads and this is the
    // frozen day, which is the same number — but only by coincidence.
    const day = this.store.currentDayIndex();
    if (day === null) return;
    await this.store.pause();
    this.snackbar.open(
      $localize`:@@trainingPlans.paused:Plan pausiert — er wartet bei Tag ${day}:INTERPOLATION: auf dich.`,
      undefined,
      { duration: 5000 }
    );
  }

  async resume(): Promise<void> {
    const day = this.store.currentDayIndex();
    await this.store.resume();
    if (day === null) return;
    this.snackbar.open(
      $localize`:@@trainingPlans.resumedAtDay:Weiter geht's bei Tag ${day}:INTERPOLATION:.`,
      undefined,
      { duration: 5000 }
    );
  }
}
