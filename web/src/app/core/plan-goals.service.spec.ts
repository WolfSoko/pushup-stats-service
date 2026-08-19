import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PlanExerciseProgress, TrainingPlanDay } from '@pu-stats/models';

import { TrainingPlanStore } from '../training-plans/training-plan.store';
import { PlanGoalsService } from './plan-goals.service';

describe('PlanGoalsService', () => {
  const todayDay = signal<TrainingPlanDay | null>(null);
  const itemProgress = signal<PlanExerciseProgress[]>([]);
  const logPlanExercise = vitest.fn();

  const day: TrainingPlanDay = {
    dayIndex: 3,
    kind: 'main',
    targetReps: 30,
    description: 'Zirkel',
    exercises: [
      { exerciseId: 'pushup', target: 30 },
      { exerciseId: 'plank.standard', target: 150 },
      { exerciseId: 'plank.standard', variantId: 'side', target: 180 },
    ],
  };

  function progressItem(
    itemIndex: number,
    logged: number,
    done = false
  ): PlanExerciseProgress {
    return {
      itemIndex,
      exercise: day.exercises?.[itemIndex] ?? {
        exerciseId: 'pushup',
        target: 0,
      },
      logged,
      fulfilledByEntries: done,
      checkedOff: false,
      done,
    };
  }

  function setup(): PlanGoalsService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TrainingPlanStore,
          useValue: {
            hasActivePlan: computed(() => todayDay() !== null),
            todayDay: todayDay.asReadonly(),
            currentDayIndex: computed(() => todayDay()?.dayIndex ?? null),
            dayProgress: () => itemProgress(),
            logPlanExercise,
          },
        },
      ],
    });
    return TestBed.inject(PlanGoalsService);
  }

  beforeEach(() => {
    todayDay.set(day);
    itemProgress.set([
      progressItem(0, 30, true),
      progressItem(1, 60),
      progressItem(2, 0),
    ]);
    logPlanExercise.mockReset().mockResolvedValue('logged');
  });

  it('should expose one goal per exercise, merging the repeated one', () => {
    // given / when
    const service = setup();

    // then
    expect(service.entries().map((e) => e.exerciseId)).toEqual([
      'pushup',
      'plank.standard',
    ]);
    expect(service.entries()[1].target).toBe(330);
  });

  it('should sum the progress of every item behind a merged goal', () => {
    // given / when
    const service = setup();

    // then
    expect(service.progress()).toEqual([30, 60]);
  });

  it('should report no goals on a rest day', () => {
    // given
    todayDay.set({ ...day, kind: 'rest', exercises: undefined, targetReps: 0 });

    // when
    const service = setup();

    // then
    expect(service.entries()).toEqual([]);
    expect(service.progress()).toEqual([]);
  });

  it('should recognise only its own goal ids', () => {
    // given / when
    const service = setup();

    // then
    expect(service.isPlanGoal('plan-today:pushup')).toBe(true);
    expect(service.isPlanGoal('some-user-goal')).toBe(false);
  });

  it('should log every open item of a goal and skip the ones already done', async () => {
    // given a merged plank goal whose first item is done
    itemProgress.set([
      progressItem(0, 30, true),
      progressItem(1, 150, true),
      progressItem(2, 0),
    ]);
    const service = setup();

    // when
    const result = await service.complete('plan-today:plank.standard');

    // then
    expect(logPlanExercise).toHaveBeenCalledTimes(1);
    expect(logPlanExercise).toHaveBeenCalledWith(3, 2);
    expect(result).toBe('logged');
  });

  it('should report already-logged when nothing was written', async () => {
    // given
    logPlanExercise.mockResolvedValue('already-logged');
    const service = setup();

    // when
    const result = await service.complete('plan-today:plank.standard');

    // then
    expect(result).toBe('already-logged');
  });

  it('should report a rejected write as a no-op rather than already-logged', async () => {
    // given the live mirror has not synced yet
    logPlanExercise.mockResolvedValue('not-ready');
    const service = setup();

    // when
    const result = await service.complete('plan-today:plank.standard');

    // then
    expect(result).toBe('noop');
  });

  it('should no-op for a goal that is not part of today', async () => {
    // given
    const service = setup();

    // when
    const result = await service.complete('plan-today:legs.squats');

    // then
    expect(logPlanExercise).not.toHaveBeenCalled();
    expect(result).toBe('noop');
  });
});
