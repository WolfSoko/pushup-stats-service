import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserContextService } from '@pu-auth/auth';
import { UserConfigApiService } from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import type { ExerciseEntry, PlanExerciseProgress } from '@pu-stats/models';
import { of } from 'rxjs';

import { TrainingPlanStore } from '../training-plans/training-plan.store';
import { ReminderGoalService } from './reminder-goal.service';

describe('ReminderGoalService', () => {
  // Frozen Berlin date so entry timestamps line up with "today".
  const frozenDate = new Date(2026, 3, 22, 12, 0);
  const today = '2026-04-22';

  const liveEntries = signal<ExerciseEntry[]>([]);
  const liveStoreMock = {
    exerciseEntries: computed(() => liveEntries()),
    connected: signal(true).asReadonly(),
  };

  const userConfigApiMock = {
    getConfig: vitest.fn().mockReturnValue(of({ userId: 'u1', dailyGoal: 0 })),
  };

  const planDayIndex = signal<number | null>(null);
  const planProgress = signal<ReadonlyArray<PlanExerciseProgress>>([]);
  const trainingPlanStoreMock = {
    hasActivePlan: computed(() => planDayIndex() !== null),
    currentDayIndex: planDayIndex.asReadonly(),
    dayProgress: (dayIndex: number) =>
      dayIndex === planDayIndex() ? planProgress() : [],
  };

  function pushupEntry(reps: number, date = today): ExerciseEntry {
    return {
      _id: `e-${reps}-${date}`,
      id: `e-${reps}-${date}`,
      userId: 'u1',
      exerciseId: 'pushup',
      source: 'manual',
      reps,
      timestamp: `${date}T10:00:00+02:00`,
    } as unknown as ExerciseEntry;
  }

  function item(
    target: number,
    logged: number,
    itemIndex = 0
  ): PlanExerciseProgress {
    return {
      itemIndex,
      exercise: { exerciseId: 'pushup', target },
      logged: Math.min(logged, target),
      fulfilledByEntries: logged >= target,
      checkedOff: false,
      done: logged >= target,
    };
  }

  function setup(config: {
    dailyGoal?: number;
    entries?: ExerciseEntry[];
    planDayIndex?: number | null;
    planProgress?: ReadonlyArray<PlanExerciseProgress>;
  }): ReminderGoalService {
    userConfigApiMock.getConfig.mockReturnValue(
      of({ userId: 'u1', dailyGoal: config.dailyGoal ?? 0 })
    );
    liveEntries.set(config.entries ?? []);
    planDayIndex.set(config.planDayIndex ?? null);
    planProgress.set(config.planProgress ?? []);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: LiveDataStore, useValue: liveStoreMock },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: TrainingPlanStore, useValue: trainingPlanStoreMock },
      ],
    });
    return TestBed.inject(ReminderGoalService);
  }

  async function flush(): Promise<void> {
    TestBed.tick();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(frozenDate);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('should report progress toward the configured daily goal', async () => {
    // given
    const service = setup({ dailyGoal: 100, entries: [pushupEntry(40)] });

    // when
    await flush();

    // then
    expect(service.goal()).toMatchObject({
      kind: 'daily',
      done: 40,
      target: 100,
      reached: false,
    });
  });

  it('should ignore reps logged on another day', async () => {
    // given
    const service = setup({
      dailyGoal: 100,
      entries: [pushupEntry(40), pushupEntry(60, '2026-04-21')],
    });

    // when
    await flush();

    // then
    expect(service.goal()).toMatchObject({ done: 40, reached: false });
  });

  it('should report the goal as reached once the daily goal is covered', async () => {
    // given
    const service = setup({ dailyGoal: 100, entries: [pushupEntry(100)] });

    // when
    await flush();

    // then
    expect(service.goal()?.reached).toBe(true);
  });

  it('should prefer the active plan day over the daily goal', async () => {
    // given — the plan day is still open while the daily goal is met
    const service = setup({
      dailyGoal: 20,
      entries: [pushupEntry(20)],
      planDayIndex: 7,
      planProgress: [item(60, 20)],
    });

    // when
    await flush();

    // then
    expect(service.goal()).toMatchObject({
      kind: 'plan',
      dayIndex: 7,
      done: 20,
      target: 60,
      reached: false,
    });
  });

  it('should fall back to the daily goal on a rest day', async () => {
    // given — an active plan whose day prescribes nothing
    const service = setup({
      dailyGoal: 100,
      entries: [pushupEntry(40)],
      planDayIndex: 4,
      planProgress: [],
    });

    // when
    await flush();

    // then
    expect(service.goal()).toMatchObject({ kind: 'daily', target: 100 });
  });

  it('should report no goal when none is configured', async () => {
    // given
    const service = setup({ dailyGoal: 0, entries: [pushupEntry(40)] });

    // when
    await flush();

    // then
    expect(service.goal()).toBeNull();
  });

  it('should report no goal before the config has loaded', () => {
    // given
    const service = setup({ dailyGoal: 100, entries: [pushupEntry(40)] });

    // when / then — no flush: the config resource has not emitted yet
    expect(service.goal()).toBeNull();
  });
});
