import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { UserContextService } from '@pu-auth/auth';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import { of, Subject, throwError } from 'rxjs';

import { AppDataFacade } from './app-data.facade';
import { DailyGoalActionsService } from './daily-goal-actions.service';
import type { DailyGoalItemView } from './daily-goal.helpers';
import { PlanGoalsService } from './plan-goals.service';

function item(overrides: Partial<DailyGoalItemView> = {}): DailyGoalItemView {
  return {
    id: 'g1',
    exerciseId: 'pushup',
    exerciseName: 'Liegestütze',
    measurement: 'reps',
    unit: 'reps',
    target: 100,
    value: 40,
    remaining: 60,
    targetDisplay: '100',
    progressDisplay: '40',
    remainingDisplay: '60',
    percent: 40,
    reached: false,
    fillable: true,
    ...overrides,
  };
}

describe('DailyGoalActionsService', () => {
  const createEntry = vitest.fn();
  const snackBarOpen = vitest.fn();
  const reloadAfterMutation = vitest.fn();
  const userId = signal<string>('u1');
  const isPlanGoal = vitest.fn();
  const completePlanGoal = vitest.fn();

  function setup(): DailyGoalActionsService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ExerciseFirestoreService, useValue: { createEntry } },
        { provide: MatSnackBar, useValue: { open: snackBarOpen } },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => userId() },
        },
        {
          provide: AppDataFacade,
          useValue: {
            reloadAfterMutation,
            dailyGoalBreakdown: signal<readonly DailyGoalItemView[]>([]),
          },
        },
        {
          provide: PlanGoalsService,
          useValue: { isPlanGoal, complete: completePlanGoal },
        },
      ],
    });
    return TestBed.inject(DailyGoalActionsService);
  }

  beforeEach(() => {
    createEntry.mockReset().mockReturnValue(of({ _id: 'e1' }));
    snackBarOpen.mockReset();
    reloadAfterMutation.mockReset();
    isPlanGoal.mockReset().mockReturnValue(false);
    completePlanGoal.mockReset().mockResolvedValue('logged');
    userId.set('u1');
  });

  it('should close a plan goal through the plan action instead of a fill entry', async () => {
    // given a goal that belongs to today's training plan
    isPlanGoal.mockReturnValue(true);
    const service = setup();

    // when it is checked off
    const result = await service.complete(item({ id: 'plan-today:pushup' }));

    // then the plan logs and ticks it — no bare goal-fill entry is written
    expect(completePlanGoal).toHaveBeenCalledWith('plan-today:pushup');
    expect(createEntry).not.toHaveBeenCalled();
    expect(result).toBe('logged');
  });

  it('should surface a plan write failure as an error', async () => {
    // given
    isPlanGoal.mockReturnValue(true);
    completePlanGoal.mockRejectedValue(new Error('offline'));
    const service = setup();

    // when
    const result = await service.complete(item({ id: 'plan-today:pushup' }));

    // then
    expect(result).toBe('error');
    expect(snackBarOpen).toHaveBeenCalled();
  });

  it('should clear the pending flag after a plan check-off', async () => {
    // given
    isPlanGoal.mockReturnValue(true);
    const service = setup();

    // when
    await service.complete(item({ id: 'plan-today:pushup' }));

    // then
    expect(service.isPending('plan-today:pushup')).toBe(false);
  });

  it('should log the missing amount for the checked goal', async () => {
    // given a goal that is 60 reps short
    const service = setup();

    // when
    const result = await service.complete(item());

    // then
    expect(result).toBe('logged');
    expect(createEntry).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        exerciseId: 'pushup',
        reps: 60,
        sets: [60],
        source: 'goal-fill',
      })
    );
    expect(reloadAfterMutation).toHaveBeenCalled();
  });

  it('should write the time field for a hold goal', async () => {
    // given a plank goal 45 s short
    const service = setup();

    // when
    await service.complete(
      item({
        id: 'plank',
        exerciseId: 'plank.standard',
        measurement: 'time',
        unit: 's',
        target: 120,
        value: 75,
        remaining: 45,
      })
    );

    // then
    expect(createEntry).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ durationSec: 45, intervals: [45] })
    );
  });

  it('should not write anything for a goal that is already reached', async () => {
    // given / when
    const service = setup();
    const result = await service.complete(
      item({ value: 100, remaining: 0, reached: true })
    );

    // then
    expect(result).toBe('already-reached');
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('should refuse a goal that needs a manual entry', async () => {
    // given a run goal (distance needs a duration companion)
    const service = setup();

    // when
    const result = await service.complete(
      item({ exerciseId: 'cardio.running', fillable: false })
    );

    // then
    expect(result).toBe('noop');
    expect(createEntry).not.toHaveBeenCalled();
    expect(snackBarOpen).toHaveBeenCalled();
  });

  it('should surface a failed write and clear the pending flag', async () => {
    // given a failing Firestore write
    const service = setup();
    createEntry.mockReturnValue(throwError(() => new Error('offline')));

    // when
    const result = await service.complete(item());

    // then
    expect(result).toBe('error');
    expect(service.isPending('g1')).toBe(false);
    expect(snackBarOpen).toHaveBeenCalled();
  });

  it('should mark the goal pending while its write is in flight', async () => {
    // given a write that only completes when we let it
    const service = setup();
    const write = new Subject<{ _id: string }>();
    createEntry.mockReturnValue(write.asObservable());

    // when
    const pending = service.complete(item());
    expect(service.isPending('g1')).toBe(true);
    expect(service.anyPending()).toBe(true);
    write.next({ _id: 'e1' });
    write.complete();
    await pending;

    // then
    expect(service.isPending('g1')).toBe(false);
  });
});
