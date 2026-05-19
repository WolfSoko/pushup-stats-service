import { inject, Injectable, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import {
  ExerciseFirestoreService,
  pushupValidationMessage,
  StatsApiService,
} from '@pu-stats/data-access';
import {
  type ExerciseEntryCreate,
  nowLocalIsoTimestamp,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
} from '@pu-stats/models';
import {
  QuickAddBridgeService,
  type QuickAddSuggestion,
} from '@pu-stats/quick-add';
import { firstValueFrom } from 'rxjs';

import { AppDataFacade } from './app-data.facade';

import type {
  AutoCountDialogComponent,
  AutoCountExerciseId,
  AutoCountResult,
} from '../auto-count/auto-count-dialog.component';
import type {
  ExerciseTimerDialogComponent,
  ExerciseTimerExerciseId,
  ExerciseTimerResult,
} from '../auto-count/exercise-timer-dialog.component';
import type {
  ExerciseEntryDialogData,
  ExerciseEntryDialogResult,
  PushupEntryDialogData,
  TrainingEntryDialogComponent,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../stats/components/training-entry-dialog/training-entry-dialog.component';

/**
 * Maps the auto-count profile id to the catalog `exerciseId` used by
 * the training-entry dialog and `ExerciseFirestoreService`. `pushup`
 * is special because it lives in the legacy `pushups` collection and
 * is the only auto-count target that flows through `StatsApiService`.
 */
const EXERCISE_CATALOG_ID: Record<
  Exclude<AutoCountExerciseId, 'pushup'>,
  string
> = {
  squat: 'legs.squats',
  pullup: 'pull.pullups',
  situp: 'abs.situps',
};

/**
 * Inverse of {@link EXERCISE_CATALOG_ID} — resolves a catalog exerciseId
 * (or the `'pushup'` sentinel) to the auto-count profile id understood by
 * the camera dialog. Returns `null` for catalog ids without a detector
 * profile so the dashboard can fail closed instead of opening the wrong
 * detector. Kept colocated with `EXERCISE_CATALOG_ID` so the two stay in
 * sync when a new pose profile lands.
 */
export function autoCountProfileForCatalogId(
  catalogId: string
): AutoCountExerciseId | null {
  if (catalogId === PUSHUP_QUICK_ADD_EXERCISE_ID) return 'pushup';
  if (catalogId === 'legs.squats') return 'squat';
  if (catalogId === 'pull.pullups') return 'pullup';
  if (catalogId === 'abs.situps') return 'situp';
  return null;
}

/**
 * Maps the hold-timer profile id (lives in `libs/auto-count`) to the
 * catalog `exerciseId` used by `ExerciseFirestoreService`. Plank uses
 * the legacy id that was migrated into the `core` category; hollow
 * hold lives there too.
 */
const HOLD_TIMER_CATALOG_ID: Record<ExerciseTimerExerciseId, string> = {
  plank: 'plank.standard',
  hollowhold: 'core.hollowhold',
};

@Injectable({ providedIn: 'root' })
export class QuickAddOrchestrationService {
  private readonly statsApi = inject(StatsApiService);
  // Optional because the legacy fillToGoal/openDialog/quickAdd flows
  // never touch exercises and most app-level test harnesses don't
  // provide the Firestore-bound service. The auto-count exercise path
  // checks for null and surfaces an error snackbar if needed.
  private readonly exerciseApi = inject(ExerciseFirestoreService, {
    optional: true,
  });
  private readonly userContext = inject(UserContextService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly quickAddBridge = inject(QuickAddBridgeService);
  private readonly appData = inject(AppDataFacade);
  private readonly dialog = inject(MatDialog);

  private readonly _fillToGoalInFlight = signal(false);
  readonly fillToGoalInFlight = this._fillToGoalInFlight.asReadonly();

  /**
   * SpeedDial entry point — dispatches by `exerciseId`. Pushup rows flow
   * through the legacy `pushups` collection; every other catalog id is
   * written to `exerciseEntries` via `ExerciseFirestoreService`, mirroring
   * the dashboard's `addQuickEntryFromConfig` so both surfaces stay in
   * sync.
   */
  addSuggestion(suggestion: QuickAddSuggestion): void {
    if (suggestion.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID) {
      this.add(suggestion.reps);
      return;
    }
    void this.addExerciseQuickEntry(suggestion);
  }

  private async addExerciseQuickEntry(
    suggestion: QuickAddSuggestion
  ): Promise<void> {
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) {
      this.openErrorSnackbar();
      return;
    }
    try {
      await firstValueFrom(
        this.exerciseApi.createEntry(userId, {
          exerciseId: suggestion.exerciseId,
          timestamp: nowLocalIsoTimestamp(),
          reps: suggestion.reps,
          source: 'quick-add',
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
      this.openErrorSnackbar();
    }
  }

  add(reps: number): void {
    this.statsApi
      .createPushup({
        timestamp: nowLocalIsoTimestamp(),
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
        error: (err) => this.openErrorSnackbar(err),
      });
  }

  fillToGoal(): void {
    if (this._fillToGoalInFlight()) return;
    const gap = this.appData.remainingToGoal();
    if (gap <= 0) return;

    this._fillToGoalInFlight.set(true);
    this.statsApi
      .createPushup({
        timestamp: nowLocalIsoTimestamp(),
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
        error: (err) => {
          this.openErrorSnackbar(err);
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
  async openAutoCount(preselect?: AutoCountExerciseId): Promise<void> {
    const { AutoCountDialogComponent } =
      await import('../auto-count/auto-count-dialog.component');
    this.dialog
      .open<
        AutoCountDialogComponent,
        { initialExerciseId?: AutoCountExerciseId } | undefined,
        AutoCountResult | null
      >(AutoCountDialogComponent, {
        width: '100vw',
        maxWidth: '100vw',
        height: '100vh',
        maxHeight: '100vh',
        panelClass: 'auto-count-dialog-panel',
        ...(preselect ? { data: { initialExerciseId: preselect } } : {}),
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result || result.reps <= 0) return;
        void this.confirmAutoCount(result);
      });
  }

  /**
   * Timer dialog for isometric-hold exercises (plank, hollow hold). The
   * dialog is manual by default, with an optional pose-detection toggle
   * that mirrors the rep-counter flow: on a non-zero result, chain into
   * the standard training-entry dialog so the user can review and adjust
   * the captured duration before persisting.
   */
  async openExerciseTimer(): Promise<void> {
    const { ExerciseTimerDialogComponent } =
      await import('../auto-count/exercise-timer-dialog.component');
    this.dialog
      .open<ExerciseTimerDialogComponent, void, ExerciseTimerResult | null>(
        ExerciseTimerDialogComponent,
        {
          width: 'min(96vw, 480px)',
          maxWidth: '96vw',
          panelClass: 'exercise-timer-dialog-panel',
        }
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result || result.durationSec <= 0) return;
        void this.confirmExerciseTimer(result);
      });
  }

  private async confirmExerciseTimer(
    result: ExerciseTimerResult
  ): Promise<void> {
    const { TrainingEntryDialogComponent } =
      await import('../stats/components/training-entry-dialog/training-entry-dialog.component');
    const data: ExerciseEntryDialogData = {
      kind: 'exercise',
      timestamp: nowLocalIsoTimestamp(),
      exerciseId: HOLD_TIMER_CATALOG_ID[result.exerciseId],
      durationSec: result.durationSec,
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
      .subscribe((dialogResult) => {
        if (!dialogResult) return;
        void this.persistConfirmed(dialogResult, 'exercise-timer');
      });
  }

  private async confirmAutoCount(result: AutoCountResult): Promise<void> {
    const { TrainingEntryDialogComponent } =
      await import('../stats/components/training-entry-dialog/training-entry-dialog.component');
    const data = this.buildPrefill(result);

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
      .subscribe((dialogResult) => {
        if (!dialogResult) return;
        void this.persistConfirmed(dialogResult, 'auto-count');
      });
  }

  private buildPrefill(result: AutoCountResult): TrainingEntryDialogData {
    if (result.exerciseId === 'pushup') {
      return {
        kind: 'pushup',
        timestamp: nowLocalIsoTimestamp(),
        reps: result.reps,
        sets: [result.reps],
        source: 'auto-count',
        type: 'standard',
      } satisfies PushupEntryDialogData;
    }
    return {
      kind: 'exercise',
      timestamp: nowLocalIsoTimestamp(),
      exerciseId: EXERCISE_CATALOG_ID[result.exerciseId],
      reps: result.reps,
      sets: [result.reps],
    } satisfies ExerciseEntryDialogData;
  }

  private async persistConfirmed(
    result: TrainingEntryDialogResult,
    /**
     * Source attribution forwarded to the exercise-entry path. Pushup
     * results already carry their own `source` from the training-entry
     * dialog, so it is ignored there.
     */
    exerciseSource = 'web'
  ): Promise<void> {
    try {
      if (result.kind === 'pushup') {
        await firstValueFrom(
          this.statsApi.createPushup({
            timestamp: result.timestamp,
            reps: result.reps,
            sets: result.sets,
            source: result.source,
            type: result.type,
          })
        );
      } else {
        const userId = this.userContext.userIdSafe();
        if (!userId || !this.exerciseApi) {
          this.openErrorSnackbar();
          return;
        }
        await firstValueFrom(
          this.exerciseApi.createEntry(
            userId,
            buildExerciseEntryPayload(result, exerciseSource)
          )
        );
      }
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
    } catch (err) {
      this.openErrorSnackbar(err);
    }
  }

  private openErrorSnackbar(err?: unknown): void {
    this.snackBar.open(pushupValidationMessage(err), '', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}

/**
 * Map an exercise-mode `TrainingEntryDialogResult` to the
 * `ExerciseEntryCreate` payload shape, honouring the catalog's
 * measurement discriminator so a switch to a time- or distance-based
 * exercise mid-flow (e.g. plank, run) doesn't drop the required
 * companion fields and trigger `validateExerciseEntry` rejection.
 */
function buildExerciseEntryPayload(
  result: ExerciseEntryDialogResult,
  source: string
): ExerciseEntryCreate {
  const base: ExerciseEntryCreate = {
    exerciseId: result.exerciseId,
    timestamp: result.timestamp,
    source,
    ...(result.variantId ? { variantId: result.variantId } : {}),
  };
  switch (result.measurement) {
    case 'time':
      return { ...base, durationSec: result.durationSec ?? 0 };
    case 'distance-time':
      return {
        ...base,
        distanceM: result.distanceM ?? 0,
        durationSec: result.durationSec ?? 0,
      };
    default:
      return {
        ...base,
        reps: result.reps,
        ...(result.sets.length > 1 ? { sets: result.sets } : {}),
      };
  }
}
