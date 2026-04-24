import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StatsApiService } from '@pu-stats/data-access';
import { appendLocalOffset } from '@pu-stats/models';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import { AppDataFacade } from './app-data.facade';

@Injectable({ providedIn: 'root' })
export class QuickAddOrchestrationService {
  private readonly statsApi = inject(StatsApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly quickAddBridge = inject(QuickAddBridgeService);
  private readonly appData = inject(AppDataFacade);

  private readonly _fillToGoalInFlight = signal(false);
  readonly fillToGoalInFlight = this._fillToGoalInFlight.asReadonly();

  add(reps: number): void {
    this.statsApi
      .createPushup({
        timestamp: nowLocalIso(),
        reps,
        source: 'quick-add',
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            $localize`:@@quickAdd.success.create:Eintrag gespeichert.`,
            '',
            {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            }
          );
          this.appData.reloadAfterQuickAdd();
        },
        error: () =>
          this.snackBar.open(
            $localize`:@@quickAdd.error.create:Eintrag konnte nicht gespeichert werden.`,
            '',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            }
          ),
      });
  }

  fillToGoal(): void {
    if (this._fillToGoalInFlight()) return;
    const gap = this.appData.remainingToGoal();
    if (gap <= 0) return;

    this._fillToGoalInFlight.set(true);
    this.statsApi
      .createPushup({
        timestamp: nowLocalIso(),
        reps: gap,
        source: 'goal-fill',
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            $localize`:@@quickAdd.success.goalReached:Tagesziel erreicht 🎉`,
            '',
            {
              duration: 2500,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            }
          );
          this.appData.reloadAfterQuickAdd();
          this._fillToGoalInFlight.set(false);
        },
        error: () => {
          this.snackBar.open(
            $localize`:@@quickAdd.error.create:Eintrag konnte nicht gespeichert werden.`,
            '',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            }
          );
          this._fillToGoalInFlight.set(false);
        },
      });
  }

  openDialog(): void {
    const currentPath = this.router.url.split('?')[0];
    if (currentPath === '/app' || currentPath.startsWith('/app/')) {
      this.quickAddBridge.requestOpenDialog();
    } else {
      void this.router.navigate(['/app']).then(
        (navigated) => {
          if (navigated) {
            this.quickAddBridge.requestOpenDialog();
          }
        },
        () => {
          // Navigation failed or was cancelled; do not open the dialog.
        }
      );
    }
  }
}

function nowLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return appendLocalOffset(`${y}-${m}-${d}T${hh}:${mm}`);
}
