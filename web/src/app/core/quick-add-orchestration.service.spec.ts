import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { StatsApiService } from '@pu-stats/data-access';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import { QuickAddOrchestrationService } from './quick-add-orchestration.service';
import { AppDataFacade } from './app-data.facade';

describe('QuickAddOrchestrationService.fillToGoal', () => {
  const remainingToGoal = signal(42);
  const reloadAfterMutation = vitest.fn();

  const statsApiMock = {
    createPushup: vitest.fn(),
  };
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
      providers: [
        QuickAddOrchestrationService,
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: Router, useValue: routerMock },
        { provide: QuickAddBridgeService, useValue: bridgeMock },
        { provide: AppDataFacade, useValue: appDataMock },
      ],
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
  const snackBarMock = { open: vitest.fn() };
  const routerMock = { url: '/app', navigate: vitest.fn() };
  const bridgeMock = { requestOpenDialog: vitest.fn() };
  const appDataMock: Partial<AppDataFacade> = {
    remainingToGoal: signal(0).asReadonly(),
    reloadAfterMutation,
  };

  function setup(autoCountResult: number | null, trainingResult: unknown) {
    vitest.clearAllMocks();
    statsApiMock.createPushup.mockReturnValue(of({ _id: '1' }));

    const dialogMock = {
      open: vitest
        .fn()
        .mockReturnValueOnce({ afterClosed: () => of(autoCountResult) })
        .mockReturnValueOnce({ afterClosed: () => of(trainingResult) }),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        QuickAddOrchestrationService,
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: Router, useValue: routerMock },
        { provide: QuickAddBridgeService, useValue: bridgeMock },
        { provide: AppDataFacade, useValue: appDataMock },
        { provide: MatDialog, useValue: dialogMock },
      ],
    });
    return {
      service: TestBed.inject(QuickAddOrchestrationService),
      dialogMock,
    };
  }

  it('Given the camera dialog returns 0 reps, Then the entry dialog is not opened', async () => {
    const { service, dialogMock } = setup(null, undefined);

    await service.openAutoCount();
    await Promise.resolve();

    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    expect(statsApiMock.createPushup).not.toHaveBeenCalled();
  });

  it('Given the camera dialog returns 12 reps, Then the entry dialog opens prefilled with reps=12 and source=auto-count', async () => {
    const { service, dialogMock } = setup(12, null);

    await service.openAutoCount();
    // confirmAutoCount() awaits its own dynamic import after the
    // first afterClosed callback fires; wait until the test fixture
    // observes the resulting second `dialog.open` call.
    await vitest.waitFor(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    expect(dialogMock.open).toHaveBeenCalledTimes(2);
    const secondCall = dialogMock.open.mock.calls[1];
    const config = secondCall[1] as { data: { reps: number; source: string } };
    expect(config.data.reps).toBe(12);
    expect(config.data.source).toBe('auto-count');
  });

  it('Given the entry dialog returns a confirmed pushup, Then createPushup is called with the confirmed values', async () => {
    const trainingResult = {
      kind: 'pushup' as const,
      timestamp: '2026-05-14T10:00:00+02:00',
      reps: 15,
      sets: [15],
      source: 'auto-count',
      type: 'standard',
    };
    const { service } = setup(12, trainingResult);

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(statsApiMock.createPushup).toHaveBeenCalledTimes(1);
    });

    const payload = statsApiMock.createPushup.mock.calls[0][0];
    expect(payload.reps).toBe(15);
    expect(payload.source).toBe('auto-count');
    expect(payload.type).toBe('standard');
  });

  it('Given the entry dialog is cancelled, Then no pushup is created', async () => {
    const { service, dialogMock } = setup(12, null);

    await service.openAutoCount();
    await vitest.waitFor(() => {
      expect(dialogMock.open).toHaveBeenCalledTimes(2);
    });

    expect(statsApiMock.createPushup).not.toHaveBeenCalled();
  });
});
