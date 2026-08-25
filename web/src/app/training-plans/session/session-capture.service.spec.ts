import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import type { SessionStep } from '@pu-stats/models';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataFacade } from '../../core/app-data.facade';
import { SessionCaptureService } from './session-capture.service';
import { SessionDialogsService } from './session-dialogs.service';

const openAutoCount = vi.fn();
const openHoldTimer = vi.fn();
const openEntryDialog = vi.fn();

const dialogsProvider = {
  provide: SessionDialogsService,
  useValue: {
    openAutoCount,
    openHoldTimer,
    openEntryDialog,
  },
};

function step(overrides: Partial<SessionStep> = {}): SessionStep {
  return {
    itemIndex: 0,
    exercise: { exerciseId: 'pushup', target: 15 },
    tool: 'auto-count',
    target: 15,
    logged: 0,
    quantified: true,
    done: false,
    roundIndex: 0,
    roundTotal: 1,
    roundTarget: 15,
    finalRound: true,
    ...overrides,
  };
}

const PLANK_STEP = step({
  exercise: { exerciseId: 'plank.standard', target: 50 },
  tool: 'hold-timer',
  target: 50,
  roundTarget: 50,
});

const TWIST_STEP = step({
  exercise: { exerciseId: 'abs.russiantwist', target: 20 },
  tool: 'manual',
  target: 20,
});

describe('SessionCaptureService', () => {
  let createEntry: ReturnType<typeof vi.fn>;
  let reloadAfterMutation: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let service: SessionCaptureService;

  beforeEach(() => {
    openAutoCount.mockReset().mockResolvedValue(null);
    openHoldTimer.mockReset().mockResolvedValue(null);
    openEntryDialog.mockReset().mockResolvedValue(null);
    TestBed.resetTestingModule();
    createEntry = vi.fn().mockReturnValue(of({ id: 'e1' }));
    reloadAfterMutation = vi.fn();
    snackOpen = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        dialogsProvider,
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        { provide: ExerciseFirestoreService, useValue: { createEntry } },
        { provide: AppDataFacade, useValue: { reloadAfterMutation } },
        SessionCaptureService,
      ],
    });
    service = TestBed.inject(SessionCaptureService);
  });

  it('should write the counted reps and credit them to the step', async () => {
    // given
    openAutoCount.mockResolvedValue({
      exerciseId: 'pushup',
      reps: 17,
    });

    // when
    const outcome = await service.capture(step());

    // then
    expect(outcome).toEqual({ status: 'captured', value: 17 });
    expect(createEntry).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        exerciseId: 'pushup',
        reps: 17,
        sets: [17],
        source: 'plan-session',
      })
    );
    expect(reloadAfterMutation).toHaveBeenCalledTimes(1);
  });

  it('should open the camera on the step exercise', async () => {
    // given
    const spy = openAutoCount;

    // when
    await service.capture(
      step({ exercise: { exerciseId: 'legs.squats', target: 20 }, target: 20 })
    );

    // then
    expect(spy).toHaveBeenCalledWith('squat');
  });

  it('should save a capture for a different exercise without advancing the step', async () => {
    // given — the camera dialog lets the user toggle exercise mid-flow
    openAutoCount.mockResolvedValue({
      exerciseId: 'squat',
      reps: 12,
    });

    // when
    const outcome = await service.capture(step());

    // then
    expect(outcome).toEqual({ status: 'captured', value: 0 });
    expect(createEntry).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ exerciseId: 'legs.squats', reps: 12 })
    );
  });

  it('should report a cancelled camera dialog', async () => {
    // given
    openAutoCount.mockResolvedValue(null);

    // when
    const outcome = await service.capture(step());

    // then
    expect(outcome).toEqual({ status: 'cancelled', value: 0 });
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('should treat a zero-rep capture as cancelled', async () => {
    // given
    openAutoCount.mockResolvedValue({
      exerciseId: 'pushup',
      reps: 0,
    });

    // when
    const outcome = await service.capture(step());

    // then
    expect(outcome.status).toBe('cancelled');
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('should open the hold timer on the step hold with its target', async () => {
    // given
    const spy = openHoldTimer;

    // when
    await service.capture(PLANK_STEP);

    // then
    expect(spy).toHaveBeenCalledWith('plank', 50);
  });

  it('should write a held duration and credit it to the step', async () => {
    // given
    openHoldTimer.mockResolvedValue({
      exerciseId: 'plank',
      durationSec: 52,
    });

    // when
    const outcome = await service.capture(PLANK_STEP);

    // then
    expect(outcome).toEqual({ status: 'captured', value: 52 });
    expect(createEntry).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        exerciseId: 'plank.standard',
        durationSec: 52,
        intervals: [52],
      })
    );
  });

  it('should carry the prescribed variant into a matching capture', async () => {
    // given
    openHoldTimer.mockResolvedValue({
      exerciseId: 'plank',
      durationSec: 40,
    });

    // when
    await service.capture(
      step({
        exercise: {
          exerciseId: 'plank.standard',
          target: 40,
          variantId: 'side',
        },
        tool: 'hold-timer',
        target: 40,
      })
    );

    // then
    expect(createEntry).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ variantId: 'side' })
    );
  });

  it('should not carry the prescribed variant when the user switched exercise', async () => {
    // given
    openHoldTimer.mockResolvedValue({
      exerciseId: 'hollowhold',
      durationSec: 40,
    });

    // when
    await service.capture(
      step({
        exercise: {
          exerciseId: 'plank.standard',
          target: 40,
          variantId: 'side',
        },
        tool: 'hold-timer',
        target: 40,
      })
    );

    // then
    expect(createEntry).toHaveBeenCalledWith(
      'u1',
      expect.not.objectContaining({ variantId: 'side' })
    );
  });

  it('should capture a manual step through the entry dialog', async () => {
    // given
    const spy = openEntryDialog;
    spy.mockResolvedValue({
      kind: 'exercise',
      timestamp: '2026-08-24T18:00:00+02:00',
      exerciseId: 'abs.russiantwist',
      measurement: 'reps',
      reps: 20,
      sets: [],
      intervals: [],
    });

    // when
    const outcome = await service.capture(TWIST_STEP);

    // then
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: 'abs.russiantwist', reps: 20 })
    );
    expect(outcome).toEqual({ status: 'captured', value: 20 });
    expect(createEntry).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        exerciseId: 'abs.russiantwist',
        reps: 20,
        source: 'plan-session',
      })
    );
  });

  it('should fall back to the entry dialog for a rep exercise without a detector', async () => {
    // given — the step claims a camera tool its exercise has no profile for
    const spy = openEntryDialog;
    const cameraSpy = openAutoCount;

    // when
    await service.capture(
      step({
        exercise: { exerciseId: 'abs.russiantwist', target: 20 },
        tool: 'auto-count',
        target: 20,
      })
    );

    // then
    expect(cameraSpy).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should open the entry dialog on request even for a camera step', async () => {
    // given
    const spy = openEntryDialog;

    // when
    await service.captureByHand(step());

    // then
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should report an error when the entry write fails', async () => {
    // given
    openAutoCount.mockResolvedValue({
      exerciseId: 'pushup',
      reps: 15,
    });
    createEntry.mockReturnValue(throwError(() => new Error('offline')));

    // when
    const outcome = await service.capture(step());

    // then
    expect(outcome).toEqual({ status: 'error', value: 0 });
    expect(snackOpen).toHaveBeenCalled();
    expect(reloadAfterMutation).not.toHaveBeenCalled();
  });

  it('should report an error when a dialog chunk fails to load', async () => {
    // given — the dialog components are dynamic-imported
    openAutoCount.mockRejectedValue(new Error('chunk load failed'));

    // when
    const outcome = await service.capture(step());

    // then
    expect(outcome).toEqual({ status: 'error', value: 0 });
    expect(snackOpen).toHaveBeenCalled();
  });

  it('should report an error when the entry dialog throws', async () => {
    // given
    openEntryDialog.mockRejectedValue(new Error('chunk load failed'));

    // when
    const outcome = await service.captureByHand(step());

    // then
    expect(outcome).toEqual({ status: 'error', value: 0 });
  });

  it('should report an error when the hold timer throws', async () => {
    // given
    openHoldTimer.mockRejectedValue(new Error('chunk load failed'));

    // when
    const outcome = await service.capture(PLANK_STEP);

    // then
    expect(outcome).toEqual({ status: 'error', value: 0 });
  });

  it('should report an error when there is no signed-in user', async () => {
    // given
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        dialogsProvider,
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        { provide: UserContextService, useValue: { userIdSafe: () => '' } },
        { provide: ExerciseFirestoreService, useValue: { createEntry } },
        { provide: AppDataFacade, useValue: { reloadAfterMutation } },
        SessionCaptureService,
      ],
    });
    openAutoCount.mockResolvedValue({
      exerciseId: 'pushup',
      reps: 15,
    });

    // when
    const outcome = await TestBed.inject(SessionCaptureService).capture(step());

    // then
    expect(outcome).toEqual({ status: 'error', value: 0 });
    expect(createEntry).not.toHaveBeenCalled();
  });

  describe('logPrescribed', () => {
    it('should write exactly what the round prescribes, with no dialog', async () => {
      // given
      const round = step({
        exercise: { exerciseId: 'pushup', target: 20, sets: [10, 10] },
        target: 20,
        logged: 10,
        roundTarget: 10,
        roundIndex: 1,
        finalRound: false,
      });

      // when
      const outcome = await service.logPrescribed(round);

      // then
      expect(outcome).toEqual({ status: 'captured', value: 10 });
      expect(createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          exerciseId: 'pushup',
          reps: 10,
          sets: [10],
          source: 'plan-session',
        })
      );
      expect(openEntryDialog).not.toHaveBeenCalled();
    });

    it('should carry the prescribed variant', async () => {
      // given
      const round = step({
        exercise: {
          exerciseId: 'plank.standard',
          variantId: 'side',
          target: 30,
          sets: [30],
        },
        tool: 'hold-timer',
        target: 30,
        roundTarget: 30,
      });

      // when
      await service.logPrescribed(round);

      // then
      expect(createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          exerciseId: 'plank.standard',
          variantId: 'side',
          durationSec: 30,
          intervals: [30],
        })
      );
    });

    it('should write nothing for a round that is already covered', async () => {
      // given
      const covered = step({ logged: 15, target: 15, roundTarget: 15 });

      // when
      const outcome = await service.logPrescribed(covered);

      // then
      expect(outcome).toEqual({ status: 'captured', value: 0 });
      expect(createEntry).not.toHaveBeenCalled();
    });

    it('should report a failed write', async () => {
      // given
      createEntry.mockReturnValue(throwError(() => new Error('offline')));

      // when
      const outcome = await service.logPrescribed(step());

      // then
      expect(outcome.status).toBe('error');
      expect(snackOpen).toHaveBeenCalled();
    });
  });
});
