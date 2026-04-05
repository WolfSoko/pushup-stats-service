import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { StatsDashboardComponent } from './stats-dashboard.component';
import {
  LiveDataStore,
  StatsApiService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { AdsStore } from '@pu-stats/ads';
import { signal } from '@angular/core';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { ActivatedRoute, Router } from '@angular/router';

describe('StatsDashboardComponent', () => {
  let fixture: ComponentFixture<StatsDashboardComponent>;
  // Freeze time for deterministic tests
  const frozenDate = new Date(2025, 0, 15, 12, 0); // Jan 15, 2025 12:00
  const todayTs = '2025-01-15T12:00';
  const serviceMock = {
    load: vitest.fn((filter?: { from?: string; to?: string }) => {
      if (!filter?.from && !filter?.to) {
        return of({
          meta: {
            from: null,
            to: null,
            entries: 100,
            days: 25,
            total: 1200,
            granularity: 'daily',
          },
          series: [{ bucket: '2026-01-10', total: 1200, dayIntegral: 1200 }],
        });
      }

      return of({
        meta: {
          from: filter.from ?? null,
          to: filter.to ?? null,
          entries: 2,
          days: 1,
          total: 50,
          granularity: 'daily',
        },
        series: [{ bucket: '2026-01-10', total: 50, dayIntegral: 50 }],
      });
    }),
    listPushups: vitest.fn().mockReturnValue(
      of([
        {
          _id: '1',
          timestamp: '2025-01-14T13:45:00', // Yesterday (within same week)
          reps: 8,
          source: 'wa',
          type: 'Standard',
        },
        {
          _id: '2',
          timestamp: todayTs,
          reps: 12,
          source: 'web',
          type: 'Diamond',
        },
      ])
    ),
    createPushup: vitest.fn().mockReturnValue(of({ _id: '1' })),
    updatePushup: vitest.fn().mockReturnValue(of({ _id: '1' })),
    deletePushup: vitest.fn().mockReturnValue(of({ ok: true })),
  };

  const liveTick = signal(0);
  const liveConnected = signal(false);
  const liveMock = {
    updateTick: liveTick.asReadonly(),
    connected: liveConnected.asReadonly(),
  };

  const adsConfigMock = {
    enabled: () => false,
    dashboardInlineEnabled: () => false,
    adClient: () => '',
    dashboardInlineSlot: () => '',
    landingInlineSlot: () => '',
    adsAllowed: () => false,
    targetedAdsConsent: () => true,
  };

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(frozenDate);
    vi.clearAllMocks();
    liveTick.set(0);
    liveConnected.set(false);
    window.history.replaceState({}, '', '/');

    await TestBed.configureTestingModule({
      imports: [StatsDashboardComponent],
      providers: [
        { provide: StatsApiService, useValue: serviceMock },
        { provide: LiveDataStore, useValue: liveMock },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        { provide: AdsStore, useValue: adsConfigMock },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: () => null } },
          },
        },
        {
          provide: Router,
          useValue: { navigate: () => Promise.resolve(true) },
        },
        {
          provide: UserConfigApiService,
          useValue: {
            getConfig: vitest.fn().mockReturnValue(
              of({
                userId: 'u1',
                dailyGoal: 100,
                weeklyGoal: 500,
                monthlyGoal: 2000,
                ui: { showSourceColumn: false },
              })
            ),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsDashboardComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, '', '/');
  });

  describe('Given the dashboard is rendered', () => {
    describe('When checking the page content', () => {
      it('Then it should show german title and today focus section', () => {
        // Given
        const text = fixture.nativeElement.textContent;

        // Then
        expect(text).toContain('Liegestütze Statistik');
        expect(text).toContain('Gesamt');
        expect(text).toContain('Zielfortschritt');
        expect(text).toContain('Letzter Eintrag');
      });

      it('Then it should offer quick add buttons for 10, 20 and 30 reps', () => {
        // Given
        const text = fixture.nativeElement.textContent;

        // Then
        expect(text).toContain('+10 Reps');
        expect(text).toContain('+20 Reps');
        expect(text).toContain('+30 Reps');
      });
    });
  });

  describe('Given the component initializes', () => {
    describe('When the API is called', () => {
      it('Then it should load all-time stats and entries without filters', () => {
        // Then
        expect(serviceMock.load).toHaveBeenCalledWith({});
        expect(serviceMock.listPushups).toHaveBeenCalledWith({});
      });
    });

    describe('When all-time stats are loaded', () => {
      it('Then it should compute the correct badge values', () => {
        // Given
        const component = fixture.componentInstance;

        // Then
        expect(component.allTimeTotal()).toBe(1200);
        expect(component.allTimeDays()).toBe(25);
        expect(component.allTimeEntries()).toBe(100);
        expect(component.allTimeAvg()).toBe('48.0');
      });
    });

    describe('When entries are loaded', () => {
      it('Then it should compute latest entry and latest entries list', async () => {
        // Given
        const component = fixture.componentInstance;
        await fixture.whenStable();

        // Then
        expect(component.lastEntry()?._id).toBe('2');
        expect(component.latestEntries()).toHaveLength(2);
      });
    });
  });

  describe('Given a quick entry is added', () => {
    describe('When addQuickEntry is called with 10 reps', () => {
      it('Then it should call createPushup with correct parameters', async () => {
        // Given
        const component = fixture.componentInstance;

        // When
        await component.addQuickEntry(10);

        // Then
        expect(serviceMock.createPushup).toHaveBeenCalledWith(
          expect.objectContaining({ reps: 10, source: 'web', type: 'Standard' })
        );
      });
    });
  });

  describe('Given the manual entry dialog is submitted (regression: create event was silently dropped)', () => {
    describe('When createEntry is called with a valid entry', () => {
      it('Then it should call createPushup', async () => {
        // Given — createEntry() is the handler called after the dialog closes
        const component = fixture.componentInstance;
        vi.clearAllMocks();

        // When
        await component.createEntry({
          timestamp: todayTs,
          reps: 15,
          source: 'web',
          type: 'Diamond',
        });
        await fixture.whenStable();

        // Then
        expect(serviceMock.createPushup).toHaveBeenCalledWith({
          timestamp: todayTs,
          reps: 15,
          source: 'web',
          type: 'Diamond',
        });
      });

      it('Then it should refresh the store after creation', async () => {
        // Given
        const component = fixture.componentInstance;
        vi.clearAllMocks();

        // When
        await component.createEntry({
          timestamp: todayTs,
          reps: 15,
          source: 'web',
          type: 'Diamond',
        });
        // refreshAll() triggers async resource reload — wait for it
        await fixture.whenStable();

        // Then
        expect(serviceMock.listPushups).toHaveBeenCalled();
      });
    });

    describe('When openCreateDialog is called', () => {
      it('Then MatDialog.open is invoked with CreateEntryDialogComponent', () => {
        // Given — access the same MatDialog instance used by the component
        const dialog = fixture.debugElement.injector.get(MatDialog);
        const openSpy = vitest.spyOn(dialog, 'open').mockReturnValue({
          afterClosed: () => of(undefined),
        } as unknown as ReturnType<typeof dialog.open>);

        // When
        fixture.componentInstance.openCreateDialog();

        // Then
        expect(openSpy).toHaveBeenCalledWith(
          expect.any(Function), // CreateEntryDialogComponent
          expect.objectContaining({ width: 'min(92vw, 420px)' })
        );
      });
    });
  });

  describe('Given live websocket updates', () => {
    describe('When the live tick changes', () => {
      it('Then it should reload data', async () => {
        // Given
        const initialLoadCalls = serviceMock.load.mock.calls.length;
        const initialListCalls = serviceMock.listPushups.mock.calls.length;

        // When
        liveTick.set(1);
        await fixture.whenStable();

        // Then
        expect(serviceMock.load.mock.calls.length).toBeGreaterThan(
          initialLoadCalls
        );
        expect(serviceMock.listPushups.mock.calls.length).toBeGreaterThan(
          initialListCalls
        );
      });
    });

    describe('When the connection state changes', () => {
      it('Then it should show the correct connection state', async () => {
        // When connected
        liveConnected.set(true);
        await fixture.whenStable();

        // Then
        expect(fixture.nativeElement.textContent).toContain('Live: verbunden');

        // When disconnected
        liveConnected.set(false);
        await fixture.whenStable();

        // Then
        expect(fixture.nativeElement.textContent).toContain('Live: getrennt');
      });
    });
  });

  describe('Given entries exist for the current week', () => {
    describe('When weekReps is computed', () => {
      it('Then it should sum reps from entries within the current week', async () => {
        // Given
        const component = fixture.componentInstance;
        await fixture.whenStable();

        // When
        const weekReps = component.weekReps();

        // Then - both entries are in current week (Jan 13-19, 2025)
        // Entry 1 (2025-01-14): 8 reps, Entry 2 (2025-01-15): 12 reps = 20 total
        expect(weekReps).toBe(20);
      });
    });
  });

  describe('Given weekly and monthly goals are configured', () => {
    describe('When goals are loaded from user config', () => {
      it('Then it should set weekly and monthly goals from config', async () => {
        // Given
        const component = fixture.componentInstance;
        await fixture.whenStable();

        // Then
        expect(component.weeklyGoal()).toBe(500);
        expect(component.monthlyGoal()).toBe(2000);
      });
    });

    describe('When weeklyGoalProgressPercent is computed', () => {
      it('Then it should calculate the percentage correctly', async () => {
        // Given
        const component = fixture.componentInstance;
        await fixture.whenStable();

        // When
        const percent = component.weeklyGoalProgressPercent();

        // Then - weekReps is 20, weeklyGoal is 500 => 4%
        expect(percent).toBe(4);
      });
    });

    describe('When monthReps is computed', () => {
      it('Then it should sum reps from entries in current month only', async () => {
        // Given - add an out-of-month entry
        serviceMock.listPushups.mockReturnValueOnce(
          of([
            {
              _id: '1',
              timestamp: '2025-01-14T13:45:00',
              reps: 8,
              source: 'wa',
              type: 'Standard',
            },
            {
              _id: '2',
              timestamp: '2025-01-15T12:00',
              reps: 12,
              source: 'web',
              type: 'Diamond',
            },
            {
              _id: '3',
              timestamp: '2024-12-20T10:00:00',
              reps: 50,
              source: 'web',
              type: 'Standard',
            },
          ])
        );
        const freshFixture = TestBed.createComponent(StatsDashboardComponent);
        await freshFixture.whenStable();

        // When
        const monthReps = freshFixture.componentInstance.monthReps();

        // Then - only Jan 2025 entries count (8 + 12 = 20), Dec 2024 entry excluded
        expect(monthReps).toBe(20);
      });
    });

    describe('When monthlyGoalProgressPercent is computed', () => {
      it('Then it should calculate the percentage correctly', async () => {
        // Given
        const component = fixture.componentInstance;
        await fixture.whenStable();

        // When
        const percent = component.monthlyGoalProgressPercent();

        // Then - monthReps is 20, monthlyGoal is 2000 => 1%
        expect(percent).toBe(1);
      });
    });

    describe('When reps exceed the goal', () => {
      it('Then progress percent should be capped at 100', async () => {
        // Given - entries with reps exceeding goals
        serviceMock.listPushups.mockReturnValueOnce(
          of([
            {
              _id: '1',
              timestamp: '2025-01-15T10:00',
              reps: 9999,
              source: 'web',
              type: 'Standard',
            },
          ])
        );
        const configApi = TestBed.inject(UserConfigApiService);
        (configApi.getConfig as ReturnType<typeof vitest.fn>).mockReturnValue(
          of({ userId: 'u1', dailyGoal: 10, weeklyGoal: 10, monthlyGoal: 10 })
        );
        const freshFixture = TestBed.createComponent(StatsDashboardComponent);
        await freshFixture.whenStable();
        const component = freshFixture.componentInstance;

        // Then - all progress percents capped at 100
        expect(component.goalProgressPercent()).toBe(100);
        expect(component.weeklyGoalProgressPercent()).toBe(100);
        expect(component.monthlyGoalProgressPercent()).toBe(100);
      });
    });
  });

  describe('Given goal config has zero or falsy values', () => {
    it('Then it should fall back to defaults instead of using 0', async () => {
      // Given - config returns 0 for goals
      const configApi = TestBed.inject(UserConfigApiService);
      (configApi.getConfig as ReturnType<typeof vitest.fn>).mockReturnValue(
        of({ userId: 'u1', dailyGoal: 0, weeklyGoal: 0, monthlyGoal: 0 })
      );
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();
      const component = freshFixture.componentInstance;

      // Then - should use defaults, not 0
      expect(component.dailyGoal()).toBe(10);
      expect(component.weeklyGoal()).toBe(50);
      expect(component.monthlyGoal()).toBe(200);
    });
  });

  describe('Given entries with consecutive dates', () => {
    describe('When currentStreak is computed with no recent entries', () => {
      it('Then it should return 0 when last entry is more than 1 day ago', async () => {
        // Given - mock with old entries only (more than 1 day before frozen date)
        serviceMock.listPushups.mockReturnValueOnce(
          of([
            {
              _id: '1',
              timestamp: '2025-01-10T10:00:00',
              reps: 10,
              source: 'wa',
              type: 'Standard',
            },
          ])
        );

        // When - create fresh component with old data
        const freshFixture = TestBed.createComponent(StatsDashboardComponent);
        await freshFixture.whenStable();
        const component = freshFixture.componentInstance;

        // Then
        expect(component.currentStreak()).toBe(0);
      });
    });

    describe('When currentStreak is computed with today entry', () => {
      it('Then it should count consecutive days ending today', async () => {
        // Given - component has entry for today (todayTs)
        const component = fixture.componentInstance;
        await fixture.whenStable();

        // When
        const streak = component.currentStreak();

        // Then - at minimum 1 day (today)
        expect(streak).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
