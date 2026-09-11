import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NO_PLAN_SCALING, UserTrainingPlan } from '@pu-stats/models';
import { of } from 'rxjs';

import { PlanStartService } from './plan-start.service';
import { PlanSwitchDialogService } from './plan-switch-dialog.service';
import type { PlanSwitchChoice } from './plan-switch-dialog.component';
import { TrainingPlanStore } from './training-plan.store';

const NEXT_PLAN = { id: 'recruit-6w-v1', title: '6-Wochen-Aufbau' };

function activePlan(
  overrides: Partial<UserTrainingPlan> = {}
): UserTrainingPlan {
  return {
    userId: 'u1',
    planId: 'challenge-30d-v1',
    startDate: '2026-01-01',
    status: 'active',
    completedDays: [1, 2, 3],
    ...overrides,
  };
}

interface Options {
  active?: UserTrainingPlan | null;
  hasProgress?: boolean;
  choice?: PlanSwitchChoice | null;
  outcome?: 'started' | 'resumed' | 'noop';
}

function setup(options: Options = {}) {
  const confirmSwitch = vitest
    .fn()
    .mockResolvedValue(options.choice === undefined ? 'keep' : options.choice);
  const start = vitest.fn().mockResolvedValue(options.outcome ?? 'started');
  const active = options.active === undefined ? activePlan() : options.active;
  const snackbarRef = { onAction: () => of(void 0) };
  const open = vitest.fn().mockReturnValue(snackbarRef);

  TestBed.configureTestingModule({
    providers: [
      { provide: MatSnackBar, useValue: { open } },
      { provide: PlanSwitchDialogService, useValue: { confirmSwitch } },
      {
        provide: TrainingPlanStore,
        useValue: {
          start,
          activePlan: signal(active),
          activeCatalog: signal({ title: '30-Tage-Challenge' }),
          hasActivePlan: signal(active !== null && active.status !== 'paused'),
          hasPausedPlan: signal(active?.status === 'paused'),
          activePlanHasProgress: signal(options.hasProgress ?? true),
          currentDayIndex: signal(12),
          scaleFactors: signal(NO_PLAN_SCALING),
        },
      },
    ],
  });
  return {
    service: TestBed.inject(PlanStartService),
    confirmSwitch,
    start,
    open,
  };
}

describe('PlanStartService', () => {
  it('should ask before replacing a plan that has progress', async () => {
    // given a plan the user has been working through
    const { service, confirmSwitch } = setup();

    // when another plan is started
    await service.start(NEXT_PLAN);

    // then the user is asked rather than silently losing it
    expect(confirmSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPlanTitle: '30-Tage-Challenge',
        nextPlanTitle: '6-Wochen-Aufbau',
        currentDayIndex: 12,
        completedDays: 3,
      })
    );
  });

  it('should keep the progress when the user says so', async () => {
    // given the user chooses to keep it
    const { service, start } = setup({ choice: 'keep' });

    // when the switch goes through
    await service.start(NEXT_PLAN);

    // then
    expect(start).toHaveBeenCalledWith('recruit-6w-v1', {
      keepCurrentProgress: true,
    });
  });

  it('should discard the progress when the user says so', async () => {
    // given the user chooses to discard it
    const { service, start } = setup({ choice: 'discard' });

    // when the switch goes through
    await service.start(NEXT_PLAN);

    // then
    expect(start).toHaveBeenCalledWith('recruit-6w-v1', {
      keepCurrentProgress: false,
    });
  });

  it('should write nothing when the user backs out of the prompt', async () => {
    // given a dismissed dialog
    const { service, start } = setup({ choice: null });

    // when the switch is attempted
    const result = await service.start(NEXT_PLAN);

    // then the running plan is left exactly as it was
    expect(result).toBe('cancelled');
    expect(start).not.toHaveBeenCalled();
  });

  it('should not ask when there is no active plan', async () => {
    // given a user starting their first plan
    const { service, confirmSwitch, start } = setup({ active: null });

    // when they start it
    await service.start(NEXT_PLAN);

    // then a dialog about nothing is not shown
    expect(confirmSwitch).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledWith('recruit-6w-v1', {
      keepCurrentProgress: true,
    });
  });

  it('should ask about a paused plan too — the user set it aside to return to it', async () => {
    // given
    const { service, confirmSwitch, start } = setup({
      active: activePlan({ status: 'paused', pausedDayIndex: 12 }),
    });

    // when
    await service.start({ id: 'other-plan', title: 'Anderer Plan' });

    // then
    expect(confirmSwitch).toHaveBeenCalled();
    expect(start).toHaveBeenCalledWith('other-plan', {
      keepCurrentProgress: true,
    });
  });

  it('should not ask when the active plan has nothing recorded', async () => {
    // given a plan activated and immediately abandoned
    const { service, confirmSwitch } = setup({ hasProgress: false });

    // when another is started
    await service.start(NEXT_PLAN);

    // then there is nothing at stake to ask about
    expect(confirmSwitch).not.toHaveBeenCalled();
  });

  it('should not ask when re-starting the plan already running', async () => {
    // given the active plan
    const { service, confirmSwitch } = setup();

    // when it is started again
    await service.start({ id: 'challenge-30d-v1', title: '30-Tage' });

    // then a switch to itself is not a switch
    expect(confirmSwitch).not.toHaveBeenCalled();
  });

  it('should tell the user when a plan resumed rather than started', async () => {
    // given a plan that picked a parked record back up
    const { service, open } = setup({ outcome: 'resumed' });

    // when it is started
    await service.start(NEXT_PLAN);

    // then reopening at day 12 instead of day 1 is named, with a way out
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('12'),
      'Von vorn beginnen',
      expect.anything()
    );
  });

  it('should offer starting over from the resume message', async () => {
    // given a resumed plan whose snackbar action the user taps
    const { service, start } = setup({ outcome: 'resumed' });

    // when the message is shown and acted on
    await service.start(NEXT_PLAN);
    await Promise.resolve();

    // then the plan begins again from scratch
    expect(start).toHaveBeenLastCalledWith('recruit-6w-v1', {
      keepCurrentProgress: false,
      restart: true,
    });
  });

  it('should say nothing when the store refused the start', async () => {
    // given an unknown plan id
    const { service, open } = setup({ outcome: 'noop' });

    // when it is started
    const result = await service.start(NEXT_PLAN);

    // then no success message claims something happened
    expect(result).toBe('noop');
    expect(open).not.toHaveBeenCalled();
  });
});
