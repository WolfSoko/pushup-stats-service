import { inject, Injectable, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import {
  ExerciseFirestoreService,
  pushupValidationMessage,
} from '@pu-stats/data-access';
import {
  EXERCISE_CATALOG,
  type ExerciseEntryCreate,
  findExerciseDefinition,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
} from '@pu-stats/models';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
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
 * Resolves an auto-count pose-detector profile id to the catalog
 * `exerciseId` used by the training-entry dialog and
 * `ExerciseFirestoreService`. Derived from each catalog entry's
 * `autoCountProfileId`, so the profile↔catalog mapping has a single
 * source (the catalog) instead of a hardcoded id list duplicated here.
 * `'pushup'` is special: it has no catalog entry (it lives in the legacy
 * `pushups` collection), so it maps to the `PUSHUP_QUICK_ADD_EXERCISE_ID`
 * sentinel.
 */
function catalogIdForAutoCountProfile(
  profile: AutoCountExerciseId
): string | null {
  if (profile === 'pushup') return PUSHUP_QUICK_ADD_EXERCISE_ID;
  // Fail closed (null) on a profile with no catalog entry rather than
  // emitting the raw profile string as an exerciseId — a non-catalog id
  // would only fail later at save time. Callers guard before persisting.
  return (
    EXERCISE_CATALOG.find((d) => d.autoCountProfileId === profile)?.id ?? null
  );
}

/**
 * Runtime allowlist for the `AutoCountExerciseId` union (type-only in the
 * dialog component) — validates a catalog `autoCountProfileId` string before
 * it is treated as a detector profile, so an unexpected catalog value can't
 * slip through an unchecked cast and open the dialog with an invalid id.
 */
function isAutoCountProfile(
  value: string | undefined
): value is AutoCountExerciseId {
  return (
    value === 'pushup' ||
    value === 'squat' ||
    value === 'pullup' ||
    value === 'situp'
  );
}

/**
 * Inverse of {@link catalogIdForAutoCountProfile} — resolves a catalog
 * exerciseId (or the `'pushup'` sentinel) to the auto-count profile the
 * camera dialog understands, reading `autoCountProfileId` straight off the
 * catalog. Returns `null` for catalog ids without a valid detector profile
 * so the dashboard fails closed instead of opening the wrong detector.
 */
export function autoCountProfileForCatalogId(
  catalogId: string
): AutoCountExerciseId | null {
  if (catalogId === PUSHUP_QUICK_ADD_EXERCISE_ID) return 'pushup';
  const profile = findExerciseDefinition(catalogId)?.autoCountProfileId;
  return isAutoCountProfile(profile) ? profile : null;
}

/**
 * Resolves a hold-timer profile id (defined in `libs/auto-count`) to the
 * catalog `exerciseId` used by `ExerciseFirestoreService`, derived from
 * each catalog entry's `holdTimerProfileId`.
 */
function catalogIdForHoldTimerProfile(
  profile: ExerciseTimerExerciseId
): string | null {
  // Same fail-closed contract as catalogIdForAutoCountProfile.
  return (
    EXERCISE_CATALOG.find((d) => d.holdTimerProfileId === profile)?.id ?? null
  );
}

@Injectable({ providedIn: 'root' })
export class QuickAddOrchestrationService {
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
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) {
      this.openErrorSnackbar();
      return;
    }
    this.exerciseApi
      .createEntry(userId, {
        exerciseId: 'pushup',
        timestamp: nowLocalIsoTimestamp(),
        reps,
        sets: [reps],
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
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) {
      this.openErrorSnackbar();
      return;
    }

    this._fillToGoalInFlight.set(true);
    this.exerciseApi
      .createEntry(userId, {
        exerciseId: 'pushup',
        timestamp: nowLocalIsoTimestamp(),
        reps: gap,
        sets: [gap],
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
    const exerciseId = catalogIdForHoldTimerProfile(result.exerciseId);
    if (!exerciseId) {
      this.openErrorSnackbar();
      return;
    }
    const { TrainingEntryDialogComponent } =
      await import('../stats/components/training-entry-dialog/training-entry-dialog.component');
    const data: ExerciseEntryDialogData = {
      kind: 'exercise',
      timestamp: nowLocalIsoTimestamp(),
      exerciseId,
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
    const data = this.buildPrefill(result);
    if (!data) {
      this.openErrorSnackbar();
      return;
    }
    const { TrainingEntryDialogComponent } =
      await import('../stats/components/training-entry-dialog/training-entry-dialog.component');

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

  private buildPrefill(
    result: AutoCountResult
  ): TrainingEntryDialogData | null {
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
    const exerciseId = catalogIdForAutoCountProfile(result.exerciseId);
    if (!exerciseId) return null;
    return {
      kind: 'exercise',
      timestamp: nowLocalIsoTimestamp(),
      exerciseId,
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
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) {
      this.openErrorSnackbar();
      return;
    }
    try {
      if (result.kind === 'pushup') {
        await firstValueFrom(
          this.exerciseApi.createEntry(userId, {
            exerciseId: 'pushup',
            timestamp: result.timestamp,
            reps: result.reps,
            sets: result.sets,
            source: result.source,
          })
        );
      } else {
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
