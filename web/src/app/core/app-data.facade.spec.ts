import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { AppDataFacade } from './app-data.facade';
import { StatsApiService, UserConfigApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import { AdaptiveQuickAddService } from '@pu-stats/quick-add';

describe('AppDataFacade', () => {
  const userId = signal<string>('u1');

  const statsApiMock = {
    listPushups: vitest.fn().mockReturnValue(of([])),
    load: vitest.fn().mockReturnValue(
      of({
        meta: {
          from: null,
          to: null,
          entries: 0,
          days: 0,
          total: 0,
          granularity: 'daily',
        },
        series: [],
      })
    ),
  };

  const userConfigApiMock = {
    getConfig: vitest
      .fn()
      .mockReturnValue(of({ userId: 'u1', dailyGoal: 100 })),
  };

  function setup(
    options: {
      dailyGoal?: number;
      todayTotal?: number;
    } = {}
  ): AppDataFacade {
    vitest.clearAllMocks();
    if (options.dailyGoal !== undefined) {
      userConfigApiMock.getConfig.mockReturnValue(
        of({ userId: 'u1', dailyGoal: options.dailyGoal })
      );
    }
    if (options.todayTotal !== undefined) {
      statsApiMock.load.mockReturnValue(
        of({
          meta: {
            from: null,
            to: null,
            entries: 0,
            days: 0,
            total: options.todayTotal,
            granularity: 'daily',
          },
          series: [],
        })
      );
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => userId() },
        },
        {
          provide: AdaptiveQuickAddService,
          useValue: { compute: vitest.fn().mockReturnValue([1, 5, 10]) },
        },
      ],
    });
    return TestBed.inject(AppDataFacade);
  }

  async function flushResources(): Promise<void> {
    // Flush reactive context, then let async loaders resolve, then flush again.
    TestBed.tick();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    TestBed.tick();
  }

  describe('remainingToGoal', () => {
    it('Given progress below goal, Then returns goal minus progress', async () => {
      const facade = setup({ dailyGoal: 100, todayTotal: 58 });
      await flushResources();

      expect(facade.remainingToGoal()).toBe(42);
    });

    it('Given progress equal to goal, Then returns 0', async () => {
      const facade = setup({ dailyGoal: 100, todayTotal: 100 });
      await flushResources();

      expect(facade.remainingToGoal()).toBe(0);
    });

    it('Given progress above goal, Then returns 0 (never negative)', async () => {
      const facade = setup({ dailyGoal: 100, todayTotal: 150 });
      await flushResources();

      expect(facade.remainingToGoal()).toBe(0);
    });

    it('Given goal is zero, Then returns 0', async () => {
      const facade = setup({ dailyGoal: 0, todayTotal: 0 });
      await flushResources();

      expect(facade.remainingToGoal()).toBe(0);
    });

    it('Given config has no dailyGoal field, Then returns 0 (does not use 100 default)', async () => {
      userConfigApiMock.getConfig.mockReturnValue(of({ userId: 'u1' }));
      const facade = setup();
      await flushResources();

      expect(facade.remainingToGoal()).toBe(0);
    });
  });

  describe('goalReached', () => {
    it('Given progress below goal, Then returns false', async () => {
      const facade = setup({ dailyGoal: 100, todayTotal: 99 });
      await flushResources();

      expect(facade.goalReached()).toBe(false);
    });

    it('Given progress equal to goal, Then returns true', async () => {
      const facade = setup({ dailyGoal: 100, todayTotal: 100 });
      await flushResources();

      expect(facade.goalReached()).toBe(true);
    });

    it('Given progress above goal, Then returns true', async () => {
      const facade = setup({ dailyGoal: 100, todayTotal: 150 });
      await flushResources();

      expect(facade.goalReached()).toBe(true);
    });

    it('Given goal is zero even with progress, Then returns false', async () => {
      const facade = setup({ dailyGoal: 0, todayTotal: 50 });
      await flushResources();

      expect(facade.goalReached()).toBe(false);
    });

    it('Given config has no dailyGoal field, Then returns false (does not use 100 default)', async () => {
      userConfigApiMock.getConfig.mockReturnValue(of({ userId: 'u1' }));
      const facade = setup();
      await flushResources();

      expect(facade.goalReached()).toBe(false);
    });
  });
});
