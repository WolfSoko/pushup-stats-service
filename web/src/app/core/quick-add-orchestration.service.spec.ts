import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import {
  ExerciseFirestoreService,
  PushupValidationError,
  StatsApiService,
} from '@pu-stats/data-access';
import {
  QuickAddBridgeService,
  type QuickAddSuggestion,
} from '@pu-stats/quick-add';
import { QuickAddOrchestrationService } from './quick-add-orchestration.service';
import { AppDataFacade } from './app-data.facade';
import { XpCelebrationService } from './xp/xp-celebration.service';

/**
 * These specs wait on dialogs whose components are imported lazily, so every
 * assertion below races a dynamic import. vitest's 1s `waitFor` default is not
 * enough when the production build runs in parallel on the same machine — the
 * suite failed intermittently on exactly these waits, always with "expected to
 * be called 2 times, but got 1". A longer budget costs a passing run nothing,
 * since `waitFor` polls and returns as soon as the assertion holds.
 */
const DIALOG_WAIT_TIMEOUT_MS = 10_000;

function waitForAssertion(assertion: () => void): Promise<void> {
  return vitest.waitFor(assertion, { timeout: DIALOG_WAIT_TIMEOUT_MS });
}
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
    exerciseApiMock.createEntry.mockReturnValue(of({ _id: '1' }));

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

  it('Given gap=42, When fillToGoal() is called, Then createEntry is called with exerciseId=pushup, reps=42 and source=goal-fill', () => {
    const service = setup();

    void service.fillToGoal();

    expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
    const [userId, payload] = exerciseApiMock.createEntry.mock.calls[0];
    expect(userId).toBe('u1');
    expect(payload.exerciseId).toBe('pushup');
    expect(payload.reps).toBe(42);
    expect(payload.source).toBe('goal-fill');
    expect(typeof payload.timestamp).toBe('string');
    expect(payload.timestamp.length).toBeGreaterThan(10);
  });

  it('Given gap=0, When fillToGoal() is called, Then createEntry is not called and no snackbar opens', () => {
    const service = setup();
    remainingToGoal.set(0);

    void service.fillToGoal();

    expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
    expect(snackBarMock.open).not.toHaveBeenCalled();
  });

  it('Given successful createPushup, When fillToGoal() is called, Then celebratory snackbar opens and resources reload', async () => {
    const service = setup();

    await service.fillToGoal();

    expect(snackBarMock.open).toHaveBeenCalledTimes(1);
    const message = snackBarMock.open.mock.calls[0][0] as string;
    expect(message).toContain('Tagesziel erreicht');
    expect(reloadAfterMutation).toHaveBeenCalledTimes(1);
  });

  it('Given createEntry errors, When fillToGoal() is called, Then error snackbar opens and reload is not called', async () => {
    const service = setup();
    exerciseApiMock.createEntry.mockReturnValue(
      throwError(() => new Error('x'))
    );

    await service.fillToGoal();

    expect(snackBarMock.open).toHaveBeenCalledTimes(1);
    const message = snackBarMock.open.mock.calls[0][0] as string;
    expect(message).toContain('konnte nicht');
    expect(reloadAfterMutation).not.toHaveBeenCalled();
  });

  it('Given PushupValidationError out-of-range When fillToGoal() is called Then snackbar surfaces the 1..500 cap', async () => {
    const service = setup();
    exerciseApiMock.createEntry.mockReturnValue(
      throwError(() => new PushupValidationError('reps', 'out-of-range'))
    );

    await service.fillToGoal();

    const message = snackBarMock.open.mock.calls[0][0] as string;
    expect(message).toMatch(/zwischen 1.*und 500.*liegen/);
  });

  it('should report fillToGoal busy while the write is pending, run it once and clear afterwards', async () => {
    // given
    const service = setup();
    const pending = new Subject<{ _id: string }>();
    exerciseApiMock.createEntry.mockReturnValue(pending.asObservable());

    // when
    const first = service.fillToGoal();
    void service.fillToGoal();

    // then
    expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
    expect(service.busyKeys()).toEqual(new Set(['fillToGoal']));
    expect(service.fillToGoalInFlight()).toBe(true);

    // when
    pending.next({ _id: '1' });
    pending.complete();
    await first;

    // then
    expect(service.busyKeys().size).toBe(0);
    expect(service.fillToGoalInFlight()).toBe(false);
  });

  it('Given remainingToGoal changes after call starts, Then the initial snapshot is used', () => {
    const service = setup();
    remainingToGoal.set(42);

    void service.fillToGoal();
    remainingToGoal.set(0);

    const [, payload] = exerciseApiMock.createEntry.mock.calls[0];
    expect(payload.reps).toBe(42);
  });
});

describe('QuickAddOrchestrationService.addSuggestion', () => {
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

  function setup(opts: { userId?: string } = {}): QuickAddOrchestrationService {
    vitest.clearAllMocks();
    statsApiMock.createPushup.mockReturnValue(of({ _id: '1' }));
    exerciseApiMock.createEntry.mockReturnValue(of({ _id: 'e1' }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: baseProviders({
        statsApiMock,
        exerciseApiMock,
        snackBarMock,
        routerMock,
        bridgeMock,
        appDataMock,
        userId: opts.userId,
      }),
    });
    return TestBed.inject(QuickAddOrchestrationService);
  }

  const pushupSuggestion: QuickAddSuggestion = {
    key: 'slot:0',
    reps: 10,
    label: '+10 Liegestütze',
    ariaLabel: '10 Liegestütze hinzufügen',
    exerciseId: 'pushup',
  };
  const situpsSuggestion: QuickAddSuggestion = {
    key: 'slot:1',
    reps: 12,
    label: '+12 Sit-ups',
    ariaLabel: '12 Sit-ups hinzufügen',
    exerciseId: 'abs.situps',
  };

  it('Given a pushup suggestion, Then createEntry is called with exerciseId=pushup, the suggestion reps and quick-add source', () => {
    const service = setup();

    void service.addSuggestion(pushupSuggestion);

    expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
    const [userId, payload] = exerciseApiMock.createEntry.mock.calls[0];
    expect(userId).toBe('u1');
    expect(payload.exerciseId).toBe('pushup');
    expect(payload.reps).toBe(10);
    expect(payload.source).toBe('quick-add');
    expect(statsApiMock.createPushup).not.toHaveBeenCalled();
  });

  it('Given a non-pushup suggestion, Then exerciseApi.createEntry is called with that exerciseId', async () => {
    const service = setup();

    void service.addSuggestion(situpsSuggestion);
    await waitForAssertion(() =>
      expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1)
    );

    const [userId, payload] = exerciseApiMock.createEntry.mock.calls[0];
    expect(userId).toBe('u1');
    expect(payload.exerciseId).toBe('abs.situps');
    expect(payload.reps).toBe(12);
    expect(payload.source).toBe('quick-add');
    expect(statsApiMock.createPushup).not.toHaveBeenCalled();
  });

  it('should report a suggestion busy under its own key while its write is pending', async () => {
    // given
    const service = setup();
    const pending = new Subject<{ _id: string }>();
    exerciseApiMock.createEntry.mockReturnValue(pending.asObservable());

    // when
    const done = service.addSuggestion(situpsSuggestion);

    // then
    expect(service.busyKeys()).toEqual(new Set(['suggestion:slot:1']));

    // when
    pending.next({ _id: 'e1' });
    pending.complete();
    await done;

    // then
    expect(service.busyKeys().size).toBe(0);
  });

  it('Given a non-pushup suggestion without a logged-in user, Then an error snackbar opens and nothing is created', async () => {
    const service = setup({ userId: '' });

    void service.addSuggestion(situpsSuggestion);
    await waitForAssertion(() =>
      expect(snackBarMock.open).toHaveBeenCalledTimes(1)
    );

    expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
    expect(snackBarMock.open.mock.calls[0][0]).toContain('konnte nicht');
  });
});

describe('QuickAddOrchestrationService.openStopwatch', () => {
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
    stopwatchResult: { durationSec: number } | null,
    trainingResult: unknown
  ) {
    vitest.clearAllMocks();
    exerciseApiMock.createEntry.mockReturnValue(of({ _id: 'e1' }));
    const dialogMock = {
      open: vitest
        .fn()
        .mockReturnValueOnce({ afterClosed: () => of(stopwatchResult) })
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

  it('should open the entry dialog narrowed to timed exercises with the stopped seconds prefilled', async () => {
    // given
    const { service, dialogMock } = setup({ durationSec: 95 }, undefined);

    // when
    await service.openStopwatch();
    await waitForAssertion(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    // then — no exercise handed to the stopwatch, create mode afterwards
    const stopwatchConfig = dialogMock.open.mock.calls[0][1] as {
      data?: { exerciseId?: string };
    };
    expect(stopwatchConfig.data?.exerciseId).toBeUndefined();
    const entryConfig = dialogMock.open.mock.calls[1][1] as {
      data: {
        kind: string;
        measurements?: string[];
        durationSec?: number;
      };
    };
    expect(entryConfig.data.kind).toBe('create');
    expect(entryConfig.data.measurements).toEqual(['time', 'distance-time']);
    expect(entryConfig.data.durationSec).toBe(95);
  });

  it('should persist the confirmed timed entry with source stopwatch', async () => {
    // given
    const { service } = setup(
      { durationSec: 95 },
      {
        kind: 'exercise',
        timestamp: '2026-09-05T10:00:00+02:00',
        exerciseId: 'core.mountainclimbers.time',
        measurement: 'time',
        reps: 0,
        sets: [],
        intervals: [],
        intervalDurationsSec: [],
        durationSec: 95,
      }
    );

    // when
    await service.openStopwatch();
    await waitForAssertion(() => {
      expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
    });

    // then
    expect(exerciseApiMock.createEntry).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        exerciseId: 'core.mountainclimbers.time',
        durationSec: 95,
        source: 'stopwatch',
      })
    );
    expect(reloadAfterMutation).toHaveBeenCalledTimes(1);
  });

  it('should report stopwatch busy only until its dialog is open', async () => {
    // given
    const { service, dialogMock } = setup(null, undefined);

    // when
    const opening = service.openStopwatch();

    // then
    expect(service.busyKeys()).toEqual(new Set(['stopwatch']));
    expect(dialogMock.open).not.toHaveBeenCalled();

    // when
    await opening;

    // then
    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    expect(service.busyKeys().size).toBe(0);
  });

  it('should not open the entry dialog when the stopwatch is dismissed', async () => {
    // given
    const { service, dialogMock } = setup(null, undefined);

    // when
    await service.openStopwatch();
    await Promise.resolve();

    // then
    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
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
      exerciseId: string;
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

  it('should report autoCount busy only until the camera dialog is open', async () => {
    // given
    const { service, dialogMock } = setup(null, undefined);

    // when
    const opening = service.openAutoCount();

    // then
    expect(service.busyKeys()).toEqual(new Set(['autoCount']));
    expect(dialogMock.open).not.toHaveBeenCalled();

    // when
    await opening;

    // then
    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    expect(service.busyKeys().size).toBe(0);
  });

  it('Given the camera dialog returns pushup reps, Then the entry dialog opens prefilled with kind=pushup, reps and source=auto-count', async () => {
    const { service, dialogMock } = setup(
      { exerciseId: 'pushup', reps: 12 },
      null
    );

    await service.openAutoCount();
    await waitForAssertion(() => {
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
      { exerciseId: 'legs.squats', reps: 8 },
      null
    );

    await service.openAutoCount();
    await waitForAssertion(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    const config = dialogMock.open.mock.calls[1][1] as {
      data: { kind: string; exerciseId?: string; reps: number };
    };
    expect(config.data.kind).toBe('exercise');
    expect(config.data.exerciseId).toBe('legs.squats');
    expect(config.data.reps).toBe(8);
  });

  it.each([['pull.pullups'], ['abs.situps']] as const)(
    'Given the camera dialog returns reps for %s, Then the entry dialog keeps that catalog id',
    async (catalogId) => {
      const { service, dialogMock } = setup(
        { exerciseId: catalogId, reps: 5 },
        null
      );

      await service.openAutoCount();
      await waitForAssertion(() => {
        expect(dialogMock.open).toHaveBeenCalledTimes(2);
      });

      const config = dialogMock.open.mock.calls[1][1] as {
        data: { exerciseId?: string };
      };
      expect(config.data.exerciseId).toBe(catalogId);
    }
  );

  it('Given the entry dialog returns a confirmed pushup, Then createEntry is called with exerciseId=pushup and confirmed values', async () => {
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
    await waitForAssertion(() => {
      expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
    });

    const [userId, payload] = exerciseApiMock.createEntry.mock.calls[0];
    expect(userId).toBe('u1');
    expect(payload.exerciseId).toBe('pushup');
    expect(payload.reps).toBe(15);
    expect(payload.source).toBe('auto-count');
    // The dialog's pushup "Typ" is the entry's variant — it has to reach
    // Firestore, otherwise the Typ column, filter and edit dialog read a
    // field nothing ever writes.
    expect(payload.variantId).toBe('standard');
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
      { exerciseId: 'legs.squats', reps: 8 },
      trainingResult,
      { userId: 'admin-uid' }
    );

    await service.openAutoCount();
    await waitForAssertion(() => {
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
      { exerciseId: 'legs.squats', reps: 8 },
      trainingResult,
      { userId: 'admin-uid' }
    );

    await service.openAutoCount();
    await waitForAssertion(() => {
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
      { exerciseId: 'legs.squats', reps: 8 },
      trainingResult,
      { userId: 'admin-uid' }
    );

    await service.openAutoCount();
    await waitForAssertion(() => {
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
      { exerciseId: 'legs.squats', reps: 8 },
      trainingResult,
      { userId: '' }
    );

    await service.openAutoCount();
    await waitForAssertion(() => {
      expect(snackBarMock.open).toHaveBeenCalledTimes(1);
    });

    expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
    expect(snackBarMock.open.mock.calls[0][0]).toContain('konnte nicht');
  });

  it('Given the entry dialog is cancelled, Then nothing is created', async () => {
    const { service, dialogMock } = setup(
      { exerciseId: 'legs.squats', reps: 8 },
      null
    );

    await service.openAutoCount();
    await waitForAssertion(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    expect(statsApiMock.createPushup).not.toHaveBeenCalled();
    expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
  });

  // Regression: the configurable Schnellaktionen card calls
  // openAutoCount(preselect) so the camera dialog lands on the right
  // detector without an extra tap. The orchestrator must forward
  // `preselect` into MAT_DIALOG_DATA as `initialExerciseId`.
  it('Given openAutoCount("abs.situps"), Then dialog.open receives data.initialExerciseId="abs.situps"', async () => {
    const { service, dialogMock } = setup(null, undefined);

    await service.openAutoCount('abs.situps');

    const config = dialogMock.open.mock.calls[0][1] as
      | { data?: { initialExerciseId?: string } }
      | undefined;
    expect(config?.data?.initialExerciseId).toBe('abs.situps');
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

  it('should report exerciseTimer busy only until the timer dialog is open', async () => {
    // given
    const { service, dialogMock } = setup(null, undefined);

    // when
    const opening = service.openExerciseTimer();

    // then
    expect(service.busyKeys()).toEqual(new Set(['exerciseTimer']));
    expect(dialogMock.open).not.toHaveBeenCalled();

    // when
    await opening;

    // then
    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    expect(service.busyKeys().size).toBe(0);
  });

  it('Given the timer dialog returns plank durationSec, Then the entry dialog opens prefilled with kind=exercise and exerciseId=plank.standard', async () => {
    const { service, dialogMock } = setup(
      { exerciseId: 'plank', durationSec: 45 },
      null
    );

    await service.openExerciseTimer();
    await waitForAssertion(() => {
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
    await waitForAssertion(() => {
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
    await waitForAssertion(() => {
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

describe('QuickAddOrchestrationService.openDialog', () => {
  const statsApiMock = { createPushup: vitest.fn() };
  const exerciseApiMock = { createEntry: vitest.fn() };
  const snackBarMock = { open: vitest.fn() };
  const bridgeMock = { requestOpenDialog: vitest.fn() };
  const appDataMock: Partial<AppDataFacade> = {
    remainingToGoal: signal(0).asReadonly(),
    reloadAfterMutation: vitest.fn(),
  };

  function setup(url: string) {
    vitest.clearAllMocks();
    const routerMock = { url, navigate: vitest.fn() };
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
    return {
      service: TestBed.inject(QuickAddOrchestrationService),
      routerMock,
    };
  }

  it('should ask the dashboard to open the dialog at once when already on /app', async () => {
    // given
    const { service, routerMock } = setup('/app?tab=1');

    // when
    await service.openDialog();

    // then
    expect(bridgeMock.requestOpenDialog).toHaveBeenCalledTimes(1);
    expect(routerMock.navigate).not.toHaveBeenCalled();
    expect(service.busyKeys().size).toBe(0);
  });

  it('should report customDialog busy while navigating to /app and open the dialog once there', async () => {
    // given
    const { service, routerMock } = setup('/friends');
    let navigated!: (ok: boolean) => void;
    routerMock.navigate.mockReturnValue(
      new Promise<boolean>((resolve) => (navigated = resolve))
    );

    // when
    const opening = service.openDialog();

    // then
    expect(service.busyKeys()).toEqual(new Set(['customDialog']));
    expect(bridgeMock.requestOpenDialog).not.toHaveBeenCalled();

    // when
    navigated(true);
    await opening;

    // then
    expect(routerMock.navigate).toHaveBeenCalledWith(['/app']);
    expect(bridgeMock.requestOpenDialog).toHaveBeenCalledTimes(1);
    expect(service.busyKeys().size).toBe(0);
  });

  it('should not open the dialog when the navigation is cancelled', async () => {
    // given
    const { service, routerMock } = setup('/friends');
    routerMock.navigate.mockResolvedValue(false);

    // when
    await service.openDialog();

    // then
    expect(bridgeMock.requestOpenDialog).not.toHaveBeenCalled();
    expect(service.busyKeys().size).toBe(0);
  });
});

describe('QuickAddOrchestrationService XP celebration', () => {
  function setup(opened: boolean) {
    const exerciseApiMock = {
      createEntry: vitest.fn(() =>
        of({ _id: 'e1', exerciseId: 'pushup', reps: 10 })
      ),
    };
    const snackBarMock = { open: vitest.fn() };
    const celebrate = vitest.fn(() => opened);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ...baseProviders({
          statsApiMock: { createPushup: vitest.fn() },
          exerciseApiMock,
          snackBarMock,
          routerMock: { url: '/app', navigate: vitest.fn() },
          bridgeMock: { requestOpenDialog: vitest.fn() },
          appDataMock: {
            remainingToGoal: signal(15).asReadonly(),
            reloadAfterMutation: vitest.fn(),
          },
        }),
        { provide: XpCelebrationService, useValue: { celebrate } },
      ],
    });
    const service = TestBed.inject(QuickAddOrchestrationService);
    return { service, celebrate, snackBarMock };
  }

  it('should celebrate the saved entry instead of the success snackbar', async () => {
    // given
    const { service, celebrate, snackBarMock } = setup(true);

    // when
    await service.add(10);

    // then
    expect(celebrate).toHaveBeenCalledWith([
      { _id: 'e1', exerciseId: 'pushup', reps: 10 },
    ]);
    expect(snackBarMock.open).not.toHaveBeenCalled();
  });

  it('should fall back to the snackbar when no dialog opens', async () => {
    // given
    const { service, snackBarMock } = setup(false);

    // when
    await service.add(10);

    // then
    expect(snackBarMock.open).toHaveBeenCalledWith(
      expect.stringContaining('gespeichert'),
      '',
      expect.anything()
    );
  });

  it('should replace the goal snackbar by the XP dialog on fill to goal', async () => {
    // given
    const { service, celebrate, snackBarMock } = setup(true);

    // when
    await service.fillToGoal();

    // then
    expect(celebrate).toHaveBeenCalledTimes(1);
    expect(snackBarMock.open).not.toHaveBeenCalled();
  });
});
