import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { LiveDataStore, UserConfigApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import { of } from 'rxjs';
import { PushupRecord } from '@pu-stats/models';
import { GoalReachedNotificationService } from './goal-reached-notification.service';
import { UserConfigStore } from './user-config.store';

describe('GoalReachedNotificationService', () => {
  // Frozen Berlin date: Wed Apr 22 2026 (ISO week 17)
  const frozenDate = new Date(2026, 3, 22, 12, 0);

  const dialogOpenSpy = vitest.fn().mockReturnValue({
    afterClosed: () => of(null),
    close: vi.fn(),
  } as unknown as MatDialogRef<unknown>);
  const dialogMock = { open: dialogOpenSpy } as unknown as MatDialog;

  const liveEntries = signal<PushupRecord[]>([]);
  const liveTick = signal(0);
  const liveConnected = signal(true);
  const liveStoreMock = {
    entries: liveEntries.asReadonly(),
    updateTick: liveTick.asReadonly(),
    connected: liveConnected.asReadonly(),
  };

  const userConfigApiMock = {
    getConfig: vitest
      .fn()
      .mockReturnValue(
        of({ userId: 'u1', dailyGoal: 0, weeklyGoal: 0, monthlyGoal: 0 })
      ),
  };

  function setup(config: {
    dailyGoal?: number;
    weeklyGoal?: number;
    monthlyGoal?: number;
    entries?: PushupRecord[];
    snapQuality?: 'low' | 'middle' | 'high';
  }): GoalReachedNotificationService {
    userConfigApiMock.getConfig.mockReturnValue(
      of({
        userId: 'u1',
        dailyGoal: config.dailyGoal ?? 0,
        weeklyGoal: config.weeklyGoal ?? 0,
        monthlyGoal: config.monthlyGoal ?? 0,
        ...(config.snapQuality
          ? { ui: { snapQuality: config.snapQuality } }
          : {}),
      })
    );
    liveEntries.set(config.entries ?? []);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: dialogMock },
        { provide: LiveDataStore, useValue: liveStoreMock },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
      ],
    });
    return TestBed.inject(GoalReachedNotificationService);
  }

  async function flushAll(): Promise<void> {
    // Drain microtasks for resource() loaders, tick zoneless change detection
    // so the effect runs, then await the lazy import + microtasks for the
    // awaited continuation that calls MatDialog.open.
    TestBed.tick();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    TestBed.tick();
    await vi.dynamicImportSettled();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(frozenDate);
    dialogOpenSpy.mockClear();
    liveEntries.set([]);
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Given the daily goal becomes reached', () => {
    it('Then it opens the celebration dialog with kind=daily', async () => {
      // Given
      setup({
        dailyGoal: 10,
        entries: [
          {
            _id: '1',
            timestamp: '2026-04-22T08:00:00',
            reps: 12,
          } as PushupRecord,
        ],
      });

      // When
      await flushAll();

      // Then
      expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
      const [, config] = dialogOpenSpy.mock.calls[0];
      expect(config?.data).toMatchObject({
        kind: 'daily',
        total: 12,
        goal: 10,
      });
      expect(config?.data?.titleId).toMatch(/^goal-reached-dialog-title-\d+$/);
      expect(config?.ariaLabelledBy).toBe(config?.data?.titleId);
    });

    it('Then it persists the dismissal so a fresh service does not reopen', async () => {
      // Given — first session: goal reached, dialog opens
      setup({
        dailyGoal: 10,
        entries: [
          {
            _id: '1',
            timestamp: '2026-04-22T08:00:00',
            reps: 12,
          } as PushupRecord,
        ],
      });
      await flushAll();
      expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
      dialogOpenSpy.mockClear();

      // When — second session reload (e.g. user navigates back to dashboard)
      setup({
        dailyGoal: 10,
        entries: [
          {
            _id: '1',
            timestamp: '2026-04-22T08:00:00',
            reps: 12,
          } as PushupRecord,
        ],
      });
      await flushAll();

      // Then
      expect(dialogOpenSpy).not.toHaveBeenCalled();
    });
  });

  describe('Given the weekly goal becomes reached', () => {
    it('Then it opens the celebration dialog with kind=weekly', async () => {
      // Given — two entries within the same Berlin ISO week
      setup({
        weeklyGoal: 30,
        entries: [
          {
            _id: '1',
            timestamp: '2026-04-20T08:00:00',
            reps: 20,
          } as PushupRecord,
          {
            _id: '2',
            timestamp: '2026-04-22T08:00:00',
            reps: 15,
          } as PushupRecord,
        ],
      });

      // When
      await flushAll();

      // Then
      const weeklyCall = dialogOpenSpy.mock.calls.find((call) => {
        const config = call[1] as { data?: { kind?: string } } | undefined;
        return config?.data?.kind === 'weekly';
      });
      expect(weeklyCall).toBeDefined();
      const [, weeklyConfig] = weeklyCall!;
      expect(weeklyConfig?.data).toMatchObject({
        kind: 'weekly',
        total: 35,
        goal: 30,
      });
    });
  });

  describe('Given the monthly goal becomes reached', () => {
    it('Then it opens the celebration dialog with kind=monthly', async () => {
      // Given
      setup({
        monthlyGoal: 25,
        entries: [
          {
            _id: '1',
            timestamp: '2026-04-22T08:00:00',
            reps: 30,
          } as PushupRecord,
        ],
      });

      // When
      await flushAll();

      // Then
      const monthlyCall = dialogOpenSpy.mock.calls.find((call) => {
        const config = call[1] as { data?: { kind?: string } } | undefined;
        return config?.data?.kind === 'monthly';
      });
      expect(monthlyCall).toBeDefined();
      const [, monthlyConfig] = monthlyCall!;
      expect(monthlyConfig?.data).toMatchObject({
        kind: 'monthly',
        total: 30,
        goal: 25,
      });
    });
  });

  describe('Given no goal is configured', () => {
    it('Then it does not open the celebration dialog', async () => {
      // Given
      setup({
        entries: [
          {
            _id: '1',
            timestamp: '2026-04-22T08:00:00',
            reps: 1000,
          } as PushupRecord,
        ],
      });

      // When
      await flushAll();

      // Then
      expect(dialogOpenSpy).not.toHaveBeenCalled();
    });
  });

  describe("Given the user's snapQuality preset", () => {
    const cases: Array<{
      quality: 'low' | 'middle' | 'high' | undefined;
      maxParticleCount: number;
      label: string;
    }> = [
      { quality: 'low', maxParticleCount: 40_000, label: 'low → 40k' },
      { quality: 'middle', maxParticleCount: 120_000, label: 'middle → 120k' },
      { quality: 'high', maxParticleCount: 200_000, label: 'high → 200k' },
      {
        quality: undefined,
        maxParticleCount: 40_000,
        label: 'unset → defaults to low (40k) per DEFAULT_SNAP_QUALITY',
      },
    ];

    for (const { quality, maxParticleCount, label } of cases) {
      it(`Then ${label} is forwarded as data.maxParticleCount`, async () => {
        // Given
        setup({
          dailyGoal: 10,
          snapQuality: quality,
          entries: [
            {
              _id: '1',
              timestamp: '2026-04-22T08:00:00',
              reps: 12,
            } as PushupRecord,
          ],
        });

        // When
        await flushAll();

        // Then
        expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
        const [, config] = dialogOpenSpy.mock.calls[0];
        expect(config?.data).toMatchObject({ maxParticleCount });
      });
    }
  });

  describe('Given the daily goal is raised mid-period after the dialog already fired', () => {
    it('Then it clears the persisted flag so the celebration re-fires on crossing the new bar', async () => {
      // Given — first session: goal=10, total=12 → dialog opens, flag persisted.
      setup({
        dailyGoal: 10,
        entries: [
          {
            _id: '1',
            timestamp: '2026-04-22T08:00:00',
            reps: 12,
          } as PushupRecord,
        ],
      });
      await flushAll();
      expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('pus_goal_reached_daily_2026-04-22')).toBe(
        '1'
      );
      dialogOpenSpy.mockClear();

      // When — the user raises the goal AND adds enough reps to cross the new bar.
      liveEntries.set([
        {
          _id: '1',
          timestamp: '2026-04-22T08:00:00',
          reps: 12,
        } as PushupRecord,
        {
          _id: '2',
          timestamp: '2026-04-22T18:00:00',
          reps: 15,
        } as PushupRecord,
      ]);
      userConfigApiMock.getConfig.mockReturnValue(
        of({
          userId: 'u1',
          dailyGoal: 25,
          weeklyGoal: 0,
          monthlyGoal: 0,
        })
      );
      TestBed.inject(UserConfigStore).reload();
      await flushAll();

      // Then — flag was cleared and the dialog re-fires for the new threshold.
      expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
      const [, config] = dialogOpenSpy.mock.calls[0];
      expect(config?.data).toMatchObject({
        kind: 'daily',
        total: 27,
        goal: 25,
      });
    });

    it('Then a downward change leaves the persisted flag intact', async () => {
      // Given
      setup({
        dailyGoal: 10,
        entries: [
          {
            _id: '1',
            timestamp: '2026-04-22T08:00:00',
            reps: 12,
          } as PushupRecord,
        ],
      });
      await flushAll();
      expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
      dialogOpenSpy.mockClear();

      // When — goal is lowered (still already reached).
      userConfigApiMock.getConfig.mockReturnValue(
        of({
          userId: 'u1',
          dailyGoal: 5,
          weeklyGoal: 0,
          monthlyGoal: 0,
        })
      );
      TestBed.inject(UserConfigStore).reload();
      await flushAll();

      // Then — no second dialog, flag still set.
      expect(dialogOpenSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem('pus_goal_reached_daily_2026-04-22')).toBe(
        '1'
      );
    });
  });
});
