import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { StatsApiService } from '@pu-stats/data-access';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import { QuickAddOrchestrationService } from './quick-add-orchestration.service';
import { AppDataFacade } from './app-data.facade';

describe('QuickAddOrchestrationService.fillToGoal', () => {
  const remainingToGoal = signal(42);
  const reloadAfterQuickAdd = vitest.fn();

  const statsApiMock = {
    createPushup: vitest.fn(),
  };
  const snackBarMock = { open: vitest.fn() };
  const routerMock = { url: '/app', navigate: vitest.fn() };
  const bridgeMock = { requestOpenDialog: vitest.fn() };

  const appDataMock: Partial<AppDataFacade> = {
    remainingToGoal: remainingToGoal.asReadonly(),
    reloadAfterQuickAdd,
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
    expect(reloadAfterQuickAdd).toHaveBeenCalledTimes(1);
  });

  it('Given createPushup errors, When fillToGoal() is called, Then error snackbar opens and reload is not called', () => {
    const service = setup();
    statsApiMock.createPushup.mockReturnValue(throwError(() => new Error('x')));

    service.fillToGoal();

    expect(snackBarMock.open).toHaveBeenCalledTimes(1);
    const message = snackBarMock.open.mock.calls[0][0] as string;
    expect(message).toContain('konnte nicht');
    expect(reloadAfterQuickAdd).not.toHaveBeenCalled();
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
