import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { AppDataFacade } from './app-data.facade';
import {
  LiveDataStore,
  StatsApiService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import { AdaptiveQuickAddService } from '@pu-stats/quick-add';
import type { PushupRecord } from '@pu-stats/models';

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

  // Default LiveDataStore mock: disconnected (browser uses SSR fallback path).
  // Tests that exercise the live-reactive path opt in by providing connected.
  let liveConnected = signal(false);
  let liveEntries = signal<PushupRecord[]>([]);

  function setup(
    options: {
      dailyGoal?: number;
      todayTotal?: number;
      live?: { connected: boolean; entries: PushupRecord[] };
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

    liveConnected = signal(options.live?.connected ?? false);
    liveEntries = signal<PushupRecord[]>(options.live?.entries ?? []);

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
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnected.asReadonly(),
            entries: liveEntries.asReadonly(),
            updateTick: signal(0).asReadonly(),
          },
        },
      ],
    });
    return TestBed.inject(AppDataFacade);
  }

  async function flushResources(): Promise<void> {
    // Three resources with `firstValueFrom(of(...))` loaders: each needs one
    // microtask to resolve + one for the resource to propagate the value.
    // Tick before and after so zoneless change detection picks up the new
    // resource values and re-evaluates any dependent computed signals.
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

  describe('quickAddSuggestions', () => {
    it('Given no configured quickAdds, Then adaptive suggestions are used', async () => {
      userConfigApiMock.getConfig.mockReturnValue(
        of({ userId: 'u1', dailyGoal: 100 })
      );
      const facade = setup();
      await flushResources();

      expect(facade.quickAddSuggestions()).toEqual([1, 5, 10]);
    });

    it('Given configured quickAdds, Then only entries with inSpeedDial=true are returned', async () => {
      userConfigApiMock.getConfig.mockReturnValue(
        of({
          userId: 'u1',
          dailyGoal: 100,
          ui: {
            quickAdds: [
              { reps: 15, inSpeedDial: true },
              { reps: 25, inSpeedDial: false },
              { reps: 50, inSpeedDial: true },
            ],
          },
        })
      );
      const facade = setup();
      await flushResources();

      expect(facade.quickAddSuggestions()).toEqual([15, 50]);
    });

    it('Given configured quickAdds with none in SpeedDial, Then returns empty array (no adaptive fallback)', async () => {
      userConfigApiMock.getConfig.mockReturnValue(
        of({
          userId: 'u1',
          dailyGoal: 100,
          ui: {
            quickAdds: [{ reps: 15, inSpeedDial: false }],
          },
        })
      );
      const facade = setup();
      await flushResources();

      expect(facade.quickAddSuggestions()).toEqual([]);
    });
  });

  describe('Firestore live reactivity (regression: SpeedDial → fill-to-goal button stale)', () => {
    function todayBerlinIsoDate(): string {
      // Match the AppDataFacade implementation (toBerlinIsoDate(new Date())).
      const date = new Date();
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
      const m = parts.find((p) => p.type === 'month')?.value ?? '01';
      const d = parts.find((p) => p.type === 'day')?.value ?? '01';
      return `${y}-${m}-${d}`;
    }

    it('Given live is connected, When a new pushup arrives via Firestore, Then todayProgress, remainingToGoal and goalReached update reactively without an explicit reload', async () => {
      // Given a connected LiveDataStore with no entries today and a 100-rep goal
      const facade = setup({
        dailyGoal: 100,
        live: { connected: true, entries: [] },
      });
      await flushResources();

      expect(facade.todayProgress()).toBe(0);
      expect(facade.remainingToGoal()).toBe(100);
      expect(facade.goalReached()).toBe(false);

      // When Firestore pushes a new entry (simulates the SpeedDial flow:
      // user taps quick-add → CF writes to Firestore → onSnapshot fires →
      // LiveDataStore.entries updates → derived signals must follow)
      liveEntries.set([
        {
          _id: 'live-1',
          userId: 'u1',
          timestamp: `${todayBerlinIsoDate()}T08:30:00`,
          reps: 30,
          source: 'quick-add',
        } as PushupRecord,
      ]);

      // Then the goal-related signals reflect the new entry without anyone
      // calling reloadAfterMutation()
      expect(facade.todayProgress()).toBe(30);
      expect(facade.remainingToGoal()).toBe(70);
      expect(facade.goalReached()).toBe(false);

      // And after another live update that fills the goal:
      liveEntries.update((rows) => [
        ...rows,
        {
          _id: 'live-2',
          userId: 'u1',
          timestamp: `${todayBerlinIsoDate()}T09:00:00`,
          reps: 70,
          source: 'quick-add',
        } as PushupRecord,
      ]);

      expect(facade.todayProgress()).toBe(100);
      expect(facade.remainingToGoal()).toBe(0);
      expect(facade.goalReached()).toBe(true);
    });

    it('Given live is connected, When entries change, Then quickAddSuggestions recompute from the updated live entries', async () => {
      // Given the adaptive service echoes the entry count for assertion
      const adaptive = {
        compute: vitest.fn((rows: PushupRecord[]) => {
          const len = rows.length;
          return [len, len * 2, len * 3] as [number, number, number];
        }),
      };

      vitest.clearAllMocks();
      userConfigApiMock.getConfig.mockReturnValue(
        of({ userId: 'u1', dailyGoal: 100 })
      );
      liveConnected = signal(true);
      liveEntries = signal<PushupRecord[]>([]);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: UserConfigApiService, useValue: userConfigApiMock },
          {
            provide: UserContextService,
            useValue: { userIdSafe: () => userId() },
          },
          { provide: AdaptiveQuickAddService, useValue: adaptive },
          {
            provide: LiveDataStore,
            useValue: {
              connected: liveConnected.asReadonly(),
              entries: liveEntries.asReadonly(),
              updateTick: signal(0).asReadonly(),
            },
          },
        ],
      });
      const facade = TestBed.inject(AppDataFacade);
      await flushResources();

      expect(facade.quickAddSuggestions()).toEqual([0, 0, 0]);

      // When live data arrives
      liveEntries.set([
        {
          _id: '1',
          userId: 'u1',
          timestamp: `${todayBerlinIsoDate()}T08:00:00`,
          reps: 10,
          source: 'web',
        } as PushupRecord,
      ]);

      // Then suggestions recompute
      expect(facade.quickAddSuggestions()).toEqual([1, 2, 3]);
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
