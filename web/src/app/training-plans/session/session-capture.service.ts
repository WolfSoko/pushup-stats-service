import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import type { ExerciseEntryCreate, SessionStep } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';

import { AppDataFacade } from '../../core/app-data.facade';
import {
  autoCountProfileForCatalogId,
  buildConfirmedEntryPayload,
  catalogIdForAutoCountProfile,
  catalogIdForHoldTimerProfile,
  holdTimerProfileForCatalogId,
} from '../../core/quick-add-orchestration.helpers';
import { notifyError } from '../../core/quick-add-notify';
import { SessionDialogsService } from './session-dialogs.service';
import {
  captureEntryPayload,
  entryPrefillForStep,
  prescribedCaptureFor,
  SESSION_ENTRY_SOURCE,
  stepValueFromDialogResult,
} from './session-capture.helpers';

export type SessionCaptureStatus = 'captured' | 'cancelled' | 'error';

export interface SessionCaptureOutcome {
  status: SessionCaptureStatus;
  /**
   * Amount the capture contributed to the step's own exercise, in that
   * exercise's unit. Zero when the user logged something else, which is
   * saved but doesn't advance the session.
   */
  value: number;
}

const CANCELLED: SessionCaptureOutcome = { status: 'cancelled', value: 0 };
const FAILED: SessionCaptureOutcome = { status: 'error', value: 0 };

/**
 * Hands one session step to the capture tool its exercise deserves and
 * writes what came back.
 *
 * The tool result is written directly rather than routed through a
 * second confirmation dialog: inside a session the user already
 * confirmed by pressing "save" in the camera or the timer, and an extra
 * dialog per exercise would sit between every set. The manual path is
 * the exception — there the dialog *is* the capture.
 */
@Injectable()
export class SessionCaptureService {
  private readonly dialogs = inject(SessionDialogsService);
  private readonly exerciseApi = inject(ExerciseFirestoreService, {
    optional: true,
  });
  private readonly userContext = inject(UserContextService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly appData = inject(AppDataFacade);

  /** Run the step's primary tool. */
  capture(step: SessionStep): Promise<SessionCaptureOutcome> {
    switch (step.tool) {
      case 'auto-count':
        return this.guard(() => this.captureReps(step));
      case 'hold-timer':
        return this.guard(() => this.captureHold(step));
      default:
        return this.guard(() => this.captureManual(step));
    }
  }

  /** Open the entry dialog for a step regardless of its primary tool. */
  captureByHand(step: SessionStep): Promise<SessionCaptureOutcome> {
    return this.guard(() => this.captureManual(step));
  }

  /**
   * Write what the step prescribes, without a dialog and without ticking
   * the plan item off — the one-tap path for a circuit round that has
   * later rounds of the same exercise behind it.
   */
  logPrescribed(step: SessionStep): Promise<SessionCaptureOutcome> {
    return this.guard(async () => {
      const prescribed = prescribedCaptureFor(step, nowLocalIsoTimestamp());
      // Nothing left to write means the round is already covered — the
      // session should move on, not sit on a step it can't advance past.
      if (!prescribed) return { status: 'captured', value: 0 };
      return this.write(prescribed.entry, prescribed.value);
    });
  }

  /**
   * Turn any throw into a reported `'error'` outcome. The dialog
   * components are dynamic-imported, so a chunk that fails to load
   * rejects here — and a session step whose promise rejects would
   * otherwise surface as an unhandled rejection with the page stuck on
   * the exercise and no explanation.
   */
  private async guard(
    run: () => Promise<SessionCaptureOutcome>
  ): Promise<SessionCaptureOutcome> {
    try {
      return await run();
    } catch (err) {
      return this.fail(err);
    }
  }

  private async captureReps(step: SessionStep): Promise<SessionCaptureOutcome> {
    const profile = autoCountProfileForCatalogId(step.exercise.exerciseId);
    // No detector for this exercise after all — the entry dialog is the
    // honest fallback rather than opening the camera on the wrong one.
    if (!profile) return this.captureManual(step);

    const result = await this.dialogs.openAutoCount(profile);
    if (!result || result.reps <= 0) return CANCELLED;

    const exerciseId = catalogIdForAutoCountProfile(result.exerciseId);
    if (!exerciseId) return this.fail();
    return this.persistCapture(step, exerciseId, 'reps', result.reps);
  }

  private async captureHold(step: SessionStep): Promise<SessionCaptureOutcome> {
    const profile = holdTimerProfileForCatalogId(step.exercise.exerciseId);
    if (!profile) return this.captureManual(step);

    const result = await this.dialogs.openHoldTimer(profile, step.roundTarget);
    if (!result || result.durationSec <= 0) return CANCELLED;

    const exerciseId = catalogIdForHoldTimerProfile(result.exerciseId);
    if (!exerciseId) return this.fail();
    return this.persistCapture(
      step,
      exerciseId,
      'durationSec',
      result.durationSec
    );
  }

  private async captureManual(
    step: SessionStep
  ): Promise<SessionCaptureOutcome> {
    const result = await this.dialogs.openEntryDialog(
      entryPrefillForStep(step, nowLocalIsoTimestamp())
    );
    if (!result) return CANCELLED;
    return this.write(
      buildConfirmedEntryPayload(result, SESSION_ENTRY_SOURCE),
      stepValueFromDialogResult(step, result)
    );
  }

  /**
   * Persist a tool capture. The plan's variant rides along only when the
   * user stayed on the step's exercise — a tool toggled to a different
   * exercise has nothing to do with the prescribed variant.
   */
  private persistCapture(
    step: SessionStep,
    exerciseId: string,
    valueField: 'reps' | 'durationSec',
    value: number
  ): Promise<SessionCaptureOutcome> {
    const matchesStep = exerciseId === step.exercise.exerciseId;
    return this.write(
      captureEntryPayload({
        exerciseId,
        ...(matchesStep && step.exercise.variantId
          ? { variantId: step.exercise.variantId }
          : {}),
        timestamp: nowLocalIsoTimestamp(),
        valueField,
        value,
      }),
      matchesStep ? value : 0
    );
  }

  private async write(
    entry: ExerciseEntryCreate,
    value: number
  ): Promise<SessionCaptureOutcome> {
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) return this.fail();
    try {
      await firstValueFrom(this.exerciseApi.createEntry(userId, entry));
    } catch (err) {
      return this.fail(err);
    }
    this.appData.reloadAfterMutation();
    return { status: 'captured', value };
  }

  private fail(err?: unknown): SessionCaptureOutcome {
    notifyError(this.snackBar, err);
    return FAILED;
  }
}
