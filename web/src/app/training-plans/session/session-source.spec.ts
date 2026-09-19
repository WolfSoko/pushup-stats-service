import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TrainingPlanDay } from '@pu-stats/models';

import { TrainingPlanStore } from '../training-plan.store';
import { planSessionSource, SESSION_SOURCE } from './session-source';

const DAY: TrainingPlanDay = {
  dayIndex: 3,
  kind: 'main',
  targetReps: 15,
  description: 'Zirkel',
};

describe('planSessionSource', () => {
  it('should hand the session the active plan day and its progress', () => {
    // given
    const dayProgress = vitest.fn().mockReturnValue([]);
    const source = planSessionSource({
      currentDayIndex: signal(3),
      todayDay: signal(DAY),
      dayProgress,
    } as never);

    // when / then
    expect(source.dayIndex()).toBe(3);
    expect(source.day()).toBe(DAY);
    expect(source.dayProgress(3)).toEqual([]);
    expect(dayProgress).toHaveBeenCalledWith(3);
  });

  it('should be what the token resolves to without an override', () => {
    // given — the plan session page provides nothing of its own
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TrainingPlanStore,
          useValue: {
            currentDayIndex: signal(null),
            todayDay: () => null,
            dayProgress: () => [],
          },
        },
      ],
    });

    // when
    const source = TestBed.inject(SESSION_SOURCE);

    // then
    expect(source.dayIndex()).toBeNull();
    expect(source.day()).toBeNull();
  });
});
