import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import {
  ExerciseFirestoreService,
  StatsApiService,
} from '@pu-stats/data-access';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import { QuickAddOrchestrationService } from './quick-add-orchestration.service';
import { AppDataFacade } from './app-data.facade';

const baseProviders = (params: {
  statsApiMock: { createPushup: ReturnType<typeof vitest.fn> };
  exerciseApiMock: { createEntry: ReturnType<typeof vitest.fn> };
  appDataMock: Partial<AppDataFacade>;
  snackBarMock: { open: ReturnType<typeof vitest.fn> };
  routerMock: { url: string; navigate: ReturnType<typeof vitest.fn> };
  bridgeMock: { requestOpenDialog: ReturnType<typeof vitest.fn> };
  userId?: string;
  dialogMock?: { open: ReturnType<typeof vitest.fn> };
}) => [
  QuickAddOrchestrationService,
  { provide: StatsApiService, useValue: params.statsApiMock },
  { provide: ExerciseFirestoreService, useValue: params.exerciseApiMock },
  {
    provide: UserContextService,
    useValue: { userIdSafe: () => params.userId ?? 'u1' },
  },
  { provide: MatSnackBar, useValue: params.snackBarMock },
  { provide: Router, useValue: params.routerMock },
  { provide: QuickAddBridgeService, useValue: params.bridgeMock },
  { provide: AppDataFacade, useValue: params.appDataMock },
  ...(params.dialogMock
    ? [{ provide: MatDialog, useValue: params.dialogMock }]
    : []),
];

describe('QuickAddOrchestrationService.fillToGoal', () => {
  const remainingToGoal = signal(42);
  const reloadAfterMutation = vitest.fn();

  const statsApiMock = { createPushup: vitest.fn() };
  const exerciseApiMock = { createEntry: vitest.fn() };
  const snackBarMock = { open: vitest.fn() };
  const routerMock = { url: '/app', navigate: vitest.fn() };
  const bridgeMock = { requestOpenDialog: vitest.fn() };

  const appDataMock: Partial<AppDataFacade> = {
    remainingToGoal: remainingToGoal.asReadonly(),
    reloadAfterMutation,
  };

  function setup(): QuickAddOrchestrationService {
    vitest.clearAllMocks();
    remainingToGoal.set(42);
    statsApiMock.createPushup.mockReturnValue(of({ _id: '1' }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: baseProviders({
        statsApiMock,
        exerciseApiMock,
        snackBarMock,
        routerMock,
        bridgeMock,
        appDataMock,
      }),
    });
    return TestBed.inject(QuickAddOrchestrationService);
  }

  it('Given gap=42, When fillToGoal() is called, Then createPushup is called with reps=42 and source=goal-fill', () => {
    const service = setup();

    service.fillToGoal();

    expect(statsApiMock.createPushup).toHaveBeenCalledTimes(1);
    const payload = statsApiMock.createPushup.mock.calls[0][0];
    expect(payload.reps).toBe(42);
    expect(payload.source).toBe('goal-fill');
    expect(typeof payload.timestamp).toBe('string');
    expect(payload.timestamp.length).toBeGreaterThan(10);
  });

  it('Given gap=0, When fillToGoal() is called, Then createPushup is not called and no snackbar opens', () => {
    const service = setup();
    remainingToGoal.set(0);

    service.fillToGoal();

    expect(statsApiMock.createPushup).not.toHaveBeenCalled();
    expect(snackBarMock.open).not.toHaveBeenCalled();
  });

  it('Given successful createPushup, When fillToGoal() is called, Then celebratory snackbar opens and resources reload', () => {
    const service = setup();

    service.fillToGoal();

    expect(snackBarMock.open).toHaveBeenCalledTimes(1);
    const message = snackBarMock.open.mock.calls[0][0] as string;
    expect(message).toContain('Tagesziel erreicht');
    expect(reloadAfterMutation).toHaveBeenCalledTimes(1);
  });

  it('Given createPushup errors, When fillToGoal() is called, Then error snackbar opens and reload is not called', () => {
    const service = setup();
    statsApiMock.createPushup.mockReturnValue(throwError(() => new Error('x')));

    service.fillToGoal();

    expect(snackBarMock.open).toHaveBeenCalledTimes(1);
    const message = snackBarMock.open.mock.calls[0][0] as string;
    expect(message).toContain('konnte nicht');
    expect(reloadAfterMutation).not.toHaveBeenCalled();
  });

  it('Given a previous fillToGoal() is still in flight, When called again, Then createPushup is called only once', () => {
    const service = setup();
    const pending = new Subject<{ _id: string }>();
    statsApiMock.createPushup.mockReturnValue(pending.asObservable());

    service.fillToGoal();
    service.fillToGoal();

    expect(statsApiMock.createPushup).toHaveBeenCalledTimes(1);
    expect(service.fillToGoalInFlight()).toBe(true);

    pending.next({ _id: '1' });
    pending.complete();

    expect(service.fillToGoalInFlight()).toBe(false);
  });

  it('Given remainingToGoal changes after call starts, Then the initial snapshot is used', () => {
    const service = setup();
    remainingToGoal.set(42);

    service.fillToGoal();
    remainingToGoal.set(0);

    const payload = statsApiMock.createPushup.mock.calls[0][0];
    expect(payload.reps).toBe(42);
  });
});

describe('QuickAddOrchestrationService.openAutoCount', () => {
  const reloadAfterMutation = vitest.fn();
  const statsApiMock = { createPushup: vitest.fn() };
  const exerciseApiMock = { createEntry: vitest.fn() };
  const snackBarMock = { open: vitest.fn() };
  const routerMock = { url: '/app', navigate: vitest.fn() };
  const bridgeMock = { requestOpenDialog: vitest.fn() };
  const appDataMock: Partial<AppDataFacade> = {
    remainingToGoal: signal(0).asReadonly(),
    reloadAfterMutation,
  };

  function setup(
    autoCountResult: {
      exerciseId: 'pushup' | 'squat' | 'pullup' | 'situp';
      reps: number;
    } | null,
    trainingResult: unknown,
    opts: { userId?: string } = {}
  ) {
    vitest.clearAllMocks();
    statsApiMock.createPushup.mockReturnValue(of({ _id: '1' }));
    exerciseApiMock.createEntry.mockReturnValue(of({ _id: 'e1' }));

    const dialogMock = {
      open: vitest
        .fn()
        .mockReturnValueOnce({ afterClosed: () => of(autoCountResult) })
        .mockReturnValueOnce({ afterClosed: () => of(trainingResult) }),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: baseProviders({
        statsApiMock,
        exerciseApiMock,
        snackBarMock,
        routerMock,
        bridgeMock,
        appDataMock,
        dialogMock,
        userId: opts.userId,
      }),
    });
    return {
      service: TestBed.inject(QuickAddOrchestrationService),
      dialogMock,
    };
  }

  it('Given the camera dialog returns null, Then the entry dialog is not opened', async () => {
    const { service, dialogMock } = setup(null, undefined);

    await service.openAutoCount();
    await Promise.resolve();

    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    expect(statsApiMock.createPushup).not.toHaveBeenCalled();
  });

  it('Given the camera dialog returns pushup reps, Then the entry dialog opens prefilled with kind=pushup, reps and source=auto-count', async () => {
    const { service, dialogMock } = setup(
      { exerciseId: 'pushup', reps: 12 },
      null
    );

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    const config = dialogMock.open.mock.calls[1][1] as {
      data: { kind: string; reps: number; source: string };
    };
    expect(config.data.kind).toBe('pushup');
    expect(config.data.reps).toBe(12);
    expect(config.data.source).toBe('auto-count');
  });

  it('Given the camera dialog returns squat reps, Then the entry dialog opens prefilled with kind=exercise and exerciseId legs.squats', async () => {
    const { service, dialogMock } = setup(
      { exerciseId: 'squat', reps: 8 },
      null
    );

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    const config = dialogMock.open.mock.calls[1][1] as {
      data: { kind: string; exerciseId?: string; reps: number };
    };
    expect(config.data.kind).toBe('exercise');
    expect(config.data.exerciseId).toBe('legs.squats');
    expect(config.data.reps).toBe(8);
  });

  it.each([
    ['pullup', 'pull.pullups'],
    ['situp', 'abs.situps'],
  ] as const)(
    'Given the camera dialog returns %s reps, Then the entry dialog uses catalog id %s',
    async (autoId, catalogId) => {
      const { service, dialogMock } = setup(
        { exerciseId: autoId, reps: 5 },
        null
      );

      await service.openAutoCount();
      await vitest.waitFor(() => {
        expect(dialogMock.open).toHaveBeenCalledTimes(2);
      });

      const config = dialogMock.open.mock.calls[1][1] as {
        data: { exerciseId?: string };
      };
      expect(config.data.exerciseId).toBe(catalogId);
    }
  );

  it('Given the entry dialog returns a confirmed pushup, Then createPushup is called with the confirmed values', async () => {
    const trainingResult = {
      kind: 'pushup' as const,
      timestamp: '2026-05-14T10:00:00+02:00',
      reps: 15,
      sets: [15],
      source: 'auto-count',
      type: 'standard',
    };
    const { service } = setup(
      { exerciseId: 'pushup', reps: 12 },
      trainingResult
    );

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(statsApiMock.createPushup).toHaveBeenCalledTimes(1);
    });

    const payload = statsApiMock.createPushup.mock.calls[0][0];
    expect(payload.reps).toBe(15);
    expect(payload.source).toBe('auto-count');
    expect(payload.type).toBe('standard');
  });

  it('Given the entry dialog returns a confirmed exercise, Then exerciseApi.createEntry is called with the userId and exercise payload', async () => {
    const trainingResult = {
      kind: 'exercise' as const,
      timestamp: '2026-05-14T10:00:00+02:00',
      exerciseId: 'legs.squats',
      measurement: 'reps' as const,
      reps: 9,
      sets: [9],
      variantId: 'bodyweight',
    };
    const { service } = setup(
      { exerciseId: 'squat', reps: 8 },
      trainingResult,
      { userId: 'admin-uid' }
    );

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
    });

    const [userId, payload] = exerciseApiMock.createEntry.mock.calls[0];
    expect(userId).toBe('admin-uid');
    expect(payload.exerciseId).toBe('legs.squats');
    expect(payload.reps).toBe(9);
    expect(payload.variantId).toBe('bodyweight');
    expect(payload.source).toBe('auto-count');
  });

  it('Given the entry dialog switches to a time-measurement exercise, Then durationSec is forwarded and reps is not', async () => {
    const trainingResult = {
      kind: 'exercise' as const,
      timestamp: '2026-05-14T10:00:00+02:00',
      exerciseId: 'plank.standard',
      measurement: 'time' as const,
      reps: 0,
      sets: [],
      durationSec: 45,
      variantId: 'standard',
    };
    const { service } = setup(
      { exerciseId: 'squat', reps: 8 },
      trainingResult,
      { userId: 'admin-uid' }
    );

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
    });

    const payload = exerciseApiMock.createEntry.mock.calls[0][1];
    expect(payload.exerciseId).toBe('plank.standard');
    expect(payload.durationSec).toBe(45);
    expect(payload.reps).toBeUndefined();
    expect(payload.source).toBe('auto-count');
  });

  it('Given the entry dialog switches to a distance-time exercise, Then both distanceM and durationSec are forwarded', async () => {
    const trainingResult = {
      kind: 'exercise' as const,
      timestamp: '2026-05-14T10:00:00+02:00',
      exerciseId: 'cardio.running',
      measurement: 'distance-time' as const,
      reps: 0,
      sets: [],
      durationSec: 1800,
      distanceM: 5000,
    };
    const { service } = setup(
      { exerciseId: 'squat', reps: 8 },
      trainingResult,
      { userId: 'admin-uid' }
    );

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
    });

    const payload = exerciseApiMock.createEntry.mock.calls[0][1];
    expect(payload.distanceM).toBe(5000);
    expect(payload.durationSec).toBe(1800);
    expect(payload.reps).toBeUndefined();
  });

  it('Given an exercise confirm but no logged-in user, Then no entry is created and an error snackbar opens', async () => {
    const trainingResult = {
      kind: 'exercise' as const,
      timestamp: '2026-05-14T10:00:00+02:00',
      exerciseId: 'legs.squats',
      measurement: 'reps' as const,
      reps: 9,
      sets: [9],
    };
    const { service } = setup(
      { exerciseId: 'squat', reps: 8 },
      trainingResult,
      { userId: '' }
    );

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(snackBarMock.open).toHaveBeenCalledTimes(1);
    });

    expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
    expect(snackBarMock.open.mock.calls[0][0]).toContain('konnte nicht');
  });

  it('Given the entry dialog is cancelled, Then nothing is created', async () => {
    const { service, dialogMock } = setup(
      { exerciseId: 'squat', reps: 8 },
      null
    );

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    expect(statsApiMock.createPushup).not.toHaveBeenCalled();
    expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
  });

  // Regression: the configurable Schnellaktionen card calls
  // openAutoCount(preselect) so the camera dialog lands on the right
  // detector without an extra tap. The orchestrator must forward
  // `preselect` into MAT_DIALOG_DATA as `initialExerciseId`.
  it('Given openAutoCount("situp"), Then dialog.open receives data.initialExerciseId="situp"', async () => {
    const { service, dialogMock } = setup(null, undefined);

    await service.openAutoCount('situp');

    const config = dialogMock.open.mock.calls[0][1] as
      | { data?: { initialExerciseId?: string } }
      | undefined;
    expect(config?.data?.initialExerciseId).toBe('situp');
  });

  it('Given openAutoCount() without a preselect, Then no dialog data is passed (legacy behaviour)', async () => {
    const { service, dialogMock } = setup(null, undefined);

    await service.openAutoCount();

    const config = dialogMock.open.mock.calls[0][1] as
      | { data?: unknown }
      | undefined;
    expect(config?.data).toBeUndefined();
  });
});

describe('QuickAddOrchestrationService.openExerciseTimer', () => {
  const reloadAfterMutation = vitest.fn();
  const statsApiMock = { createPushup: vitest.fn() };
  const exerciseApiMock = { createEntry: vitest.fn() };
  const snackBarMock = { open: vitest.fn() };
  const routerMock = { url: '/app', navigate: vitest.fn() };
  const bridgeMock = { requestOpenDialog: vitest.fn() };
  const appDataMock: Partial<AppDataFacade> = {
    remainingToGoal: signal(0).asReadonly(),
    reloadAfterMutation,
  };

  function setup(
    timerResult: {
      exerciseId: 'plank' | 'hollowhold';
      durationSec: number;
    } | null,
    trainingResult: unknown
  ) {
    vitest.clearAllMocks();
    statsApiMock.createPushup.mockReturnValue(of({ _id: '1' }));
    exerciseApiMock.createEntry.mockReturnValue(of({ _id: 'e1' }));

    const dialogMock = {
      open: vitest
        .fn()
        .mockReturnValueOnce({ afterClosed: () => of(timerResult) })
        .mockReturnValueOnce({ afterClosed: () => of(trainingResult) }),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: baseProviders({
        statsApiMock,
        exerciseApiMock,
        snackBarMock,
        routerMock,
        bridgeMock,
        appDataMock,
        dialogMock,
      }),
    });
    return {
      service: TestBed.inject(QuickAddOrchestrationService),
      dialogMock,
    };
  }

  it('Given the timer dialog returns null, Then the entry dialog is not opened', async () => {
    const { service, dialogMock } = setup(null, undefined);

    await service.openExerciseTimer();
    await Promise.resolve();

    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
  });

  it('Given the timer dialog returns plank durationSec, Then the entry dialog opens prefilled with kind=exercise and exerciseId=plank.standard', async () => {
    const { service, dialogMock } = setup(
      { exerciseId: 'plank', durationSec: 45 },
      null
    );

    await service.openExerciseTimer();
    await vitest.waitFor(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    const config = dialogMock.open.mock.calls[1][1] as {
      data: { kind: string; exerciseId: string; durationSec: number };
    };
    expect(config.data.kind).toBe('exercise');
    expect(config.data.exerciseId).toBe('plank.standard');
    expect(config.data.durationSec).toBe(45);
  });

  it('Given the timer dialog returns hollow hold durationSec, Then the entry dialog uses core.hollowhold catalog id', async () => {
    const { service, dialogMock } = setup(
      { exerciseId: 'hollowhold', durationSec: 30 },
      null
    );

    await service.openExerciseTimer();
    await vitest.waitFor(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    const config = dialogMock.open.mock.calls[1][1] as {
      data: { exerciseId: string };
    };
    expect(config.data.exerciseId).toBe('core.hollowhold');
  });

  it('Given the entry dialog returns a confirmed time entry, Then exerciseApi.createEntry is called with the durationSec payload', async () => {
    const { service } = setup(
      { exerciseId: 'plank', durationSec: 60 },
      {
        kind: 'exercise',
        timestamp: '2025-01-01T08:00:00+01:00',
        exerciseId: 'plank.standard',
        measurement: 'time',
        durationSec: 60,
        reps: 0,
        sets: [],
        intervals: [],
      }
    );

    await service.openExerciseTimer();
    await vitest.waitFor(() => {
      expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
    });
    const [userId, payload] = exerciseApiMock.createEntry.mock.calls[0];
    expect(userId).toBe('u1');
    expect(payload).toMatchObject({
      exerciseId: 'plank.standard',
      durationSec: 60,
      source: 'exercise-timer',
    });
  });
});
