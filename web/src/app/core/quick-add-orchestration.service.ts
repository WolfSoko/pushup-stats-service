import { inject, Injectable, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StatsApiService } from '@pu-stats/data-access';
import { appendLocalOffset } from '@pu-stats/models';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import { firstValueFrom } from 'rxjs';

import { AppDataFacade } from './app-data.facade';

import type { AutoCountDialogComponent } from '../auto-count/auto-count-dialog.component';
import type {
  PushupEntryDialogData,
  TrainingEntryDialogComponent,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../stats/components/training-entry-dialog/training-entry-dialog.component';

@Injectable({ providedIn: 'root' })
export class QuickAddOrchestrationService {
  private readonly statsApi = inject(StatsApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly quickAddBridge = inject(QuickAddBridgeService);
  private readonly appData = inject(AppDataFacade);
  private readonly dialog = inject(MatDialog);

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
          this.appData.reloadAfterMutation();
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
          this.appData.reloadAfterMutation();
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

  /**
   * Admin-gated auto-counter flow. Opens the camera dialog; on a
   * non-zero result, chains into the existing training-entry dialog
   * with the counted reps prefilled so the user can confirm or correct
   * before the entry is written. Goes through `MatDialog` directly
   * (no bridge) because both dialogs are self-contained — the dashboard
   * isn't a required host. Both dialog components are dynamic-imported
   * so MediaPipe-adjacent code stays out of the initial bundle until
   * an admin opens the camera.
   */
  async openAutoCount(): Promise<void> {
    const { AutoCountDialogComponent } =
      await import('../auto-count/auto-count-dialog.component');
    this.dialog
      .open<AutoCountDialogComponent, void, number | null>(
        AutoCountDialogComponent,
        {
          width: 'min(96vw, 480px)',
          maxWidth: '96vw',
        }
      )
      .afterClosed()
      .subscribe((reps) => {
        if (typeof reps !== 'number' || reps <= 0) return;
        void this.confirmAutoCount(reps);
      });
  }

  private async confirmAutoCount(reps: number): Promise<void> {
    const { TrainingEntryDialogComponent } =
      await import('../stats/components/training-entry-dialog/training-entry-dialog.component');
    const data: PushupEntryDialogData = {
      kind: 'pushup',
      timestamp: nowLocalIso(),
      reps,
      sets: [reps],
      source: 'auto-count',
      type: 'standard',
    };

    this.dialog
      .open<
        TrainingEntryDialogComponent,
        TrainingEntryDialogData,
        TrainingEntryDialogResult
      >(TrainingEntryDialogComponent, {
        data,
        width: 'min(92vw, 420px)',
        maxWidth: '92vw',
      })
      .afterClosed()
      .subscribe(async (result) => {
        if (!result || result.kind !== 'pushup') return;
        try {
          await firstValueFrom(
            this.statsApi.createPushup({
              timestamp: result.timestamp,
              reps: result.reps,
              sets: result.sets,
              source: result.source,
              type: result.type,
            })
          );
          this.snackBar.open(
            $localize`:@@quickAdd.success.create:Eintrag gespeichert.`,
            '',
            {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            }
          );
          this.appData.reloadAfterMutation();
        } catch {
          this.snackBar.open(
            $localize`:@@quickAdd.error.create:Eintrag konnte nicht gespeichert werden.`,
            '',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            }
          );
        }
      });
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
