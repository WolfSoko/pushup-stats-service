import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { PlanPauseService } from './plan-pause.service';
import { TrainingPlanStore } from './training-plan.store';

describe('PlanPauseService', () => {
  function setup(dayIndex: number | null) {
    const open = vitest.fn();
    const pause = vitest.fn().mockResolvedValue(undefined);
    const resume = vitest.fn().mockResolvedValue(undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatSnackBar, useValue: { open } },
        {
          provide: TrainingPlanStore,
          useValue: { currentDayIndex: signal(dayIndex), pause, resume },
        },
      ],
    });
    return { service: TestBed.inject(PlanPauseService), open, pause, resume };
  }

  it('should name the day the plan waits at when pausing', async () => {
    // given
    const { service, open, pause } = setup(12);

    // when
    await service.pause();

    // then
    expect(pause).toHaveBeenCalled();
    expect(open.mock.calls[0][0]).toContain('Tag 12');
  });

  it('should name the day training continues at when resuming', async () => {
    // given
    const { service, open, resume } = setup(12);

    // when
    await service.resume();

    // then
    expect(resume).toHaveBeenCalled();
    expect(open.mock.calls[0][0]).toContain('Tag 12');
  });

  it('should do nothing without a resolved plan day', async () => {
    // given — no plan, or one that has not started yet
    const { service, open, pause } = setup(null);

    // when
    await service.pause();

    // then
    expect(pause).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
