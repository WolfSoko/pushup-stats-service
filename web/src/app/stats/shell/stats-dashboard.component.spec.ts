import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { StatsDashboardComponent } from './stats-dashboard.component';
import {
  ExerciseFirestoreService,
  LiveDataStore,
  StatsApiService,
  UserConfigApiService,
  UserStatsApiService,
  UserTrainingPlanApiService,
} from '@pu-stats/data-access';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { AdsStore } from '@pu-stats/ads';
import { signal } from '@angular/core';
import { makeAuthStoreMock } from '@pu-stats/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { QuickAddOrchestrationService } from '../../core/quick-add-orchestration.service';
import { AppDataFacade } from '../../core/app-data.facade';
import { ShareService } from '../../core/share.service';
import { UserConfigStore } from '../../core/user-config.store';
import { TrainingPlanStore } from '../../training-plans/training-plan.store';

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
  const liveEntries = signal<
    Array<{
      _id: string;
      timestamp: string;
      reps: number;
      source?: string;
      type?: string;
    }>
  >([]);
  const liveExerciseEntries = signal<
    Array<{
      _id: string;
      exerciseId: string;
      timestamp: string;
      reps?: number;
      durationSec?: number;
      distanceM?: number;
      source?: string;
    }>
  >([]);
  const liveMock = {
    updateTick: liveTick.asReadonly(),
    connected: liveConnected.asReadonly(),
    entries: liveEntries.asReadonly(),
    exerciseEntries: liveExerciseEntries.asReadonly(),
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

  const reloadAfterMutationSpy = vitest.fn();
  const appDataMock = { reloadAfterMutation: reloadAfterMutationSpy };

  const exerciseCreateSpy = vitest.fn().mockReturnValue(of({ _id: 'ex-1' }));
  const exerciseFirestoreMock = {
    listEntries: () => of([]),
    createEntry: exerciseCreateSpy,
  };

  const userContextSpy = {
    userIdSafe: vitest.fn().mockReturnValue('u1'),
  };

  const shareSpy = vitest.fn().mockResolvedValue('native' as const);
  const shareServiceMock = { share: shareSpy };

  const dialogOpenSpy = vitest.fn().mockReturnValue({
    afterClosed: () => of(null),
    close: vi.fn(),
  } as unknown as MatDialogRef<unknown>);
  const dialogMock = { open: dialogOpenSpy } as unknown as MatDialog;

  // Default to "no active plan" — same effective behaviour as the
  // unmocked service (Firestore is optional → resolves to null). Tests
  // that exercise the plan-aware UI override `getActivePlan` per case.
  const trainingPlanApiMock = {
    getActivePlan: vitest.fn().mockReturnValue(of(null)),
    setPlan: vitest.fn().mockReturnValue(of(null)),
    addCompletedDay: vitest.fn().mockReturnValue(of(null)),
    removeCompletedDay: vitest.fn().mockReturnValue(of(null)),
    updatePlan: vitest.fn().mockReturnValue(of(null)),
  };

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(frozenDate);
    vi.clearAllMocks();
    liveTick.set(0);
    liveConnected.set(false);
    liveEntries.set([]);
    liveExerciseEntries.set([]);
    window.history.replaceState({}, '', '/');

    dialogOpenSpy.mockClear();
    trainingPlanApiMock.getActivePlan.mockReset().mockReturnValue(of(null));
    exerciseCreateSpy.mockReset().mockReturnValue(of({ _id: 'ex-1' }));
    userContextSpy.userIdSafe.mockReset().mockReturnValue('u1');

    TestBed.configureTestingModule({
      imports: [StatsDashboardComponent],
      providers: [
        provideRouter([]),
        // NOTE: this spec stays on the default browser PLATFORM_ID even
        // though stores constructed by the component start `setInterval`
        // timers in `withHooks`. Pinning to `server` was suggested but
        // breaks two regression tests that explicitly verify the
        // browser-only `effect()` reacting to `LiveDataStore.updateTick`.
        // The new tests added in this PR each call `createComponent()`
        // exactly once — same shape as the cases that were already in
        // the spec — so they don't materially worsen any pre-existing
        // timer-leak budget.
        { provide: StatsApiService, useValue: serviceMock },
        {
          provide: UserStatsApiService,
          useValue: {
            getUserStats: vitest.fn().mockReturnValue(of(null)),
          },
        },
        { provide: LiveDataStore, useValue: liveMock },
        { provide: UserContextService, useValue: userContextSpy },
        { provide: AdsStore, useValue: adsConfigMock },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
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
        {
          provide: QuickAddOrchestrationService,
          useValue: {
            fillToGoal: vitest.fn(),
            fillToGoalInFlight: signal(false).asReadonly(),
          },
        },
        { provide: AppDataFacade, useValue: appDataMock },
        { provide: ShareService, useValue: shareServiceMock },
        // The unified create dialog injects ExerciseFirestoreService for
        // exercise-kind entries; the spy at the top of the suite lets
        // the exercise-branch tests below assert what was sent.
        {
          provide: ExerciseFirestoreService,
          useValue: exerciseFirestoreMock,
        },
        {
          provide: UserTrainingPlanApiService,
          useValue: trainingPlanApiMock,
        },
      ],
    });

    // Override MatDialog at the deep-injector level so that even
    // standalone-component scoped injectors resolve to our mock.
    TestBed.overrideProvider(MatDialog, { useValue: dialogMock });

    await TestBed.compileComponents();

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
        expect(text).toContain('Meine Trainingsübersicht');
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

      it('Then it should render the Schnellaktionen edit icon', () => {
        expect(
          fixture.nativeElement.querySelector(
            '[data-testid="dashboard-quick-actions-edit"]'
          )
        ).toBeTruthy();
      });

      it('Then the all-time mini-badges sit directly under the hero header', () => {
        const root = fixture.nativeElement as HTMLElement;
        const header = root.querySelector('.page-header');
        const miniBadges = root.querySelector('.mini-badges');

        expect(header).toBeTruthy();
        expect(miniBadges).toBeTruthy();
        if (!header) return;
        // Mini-badges must come right after the hero header, not after today-focus.
        expect(header.nextElementSibling).toBe(miniBadges);
      });

      it('Then the latest exercises section renders as per-entry tile links and the section is no longer a global click target', () => {
        const root = fixture.nativeElement as HTMLElement;
        const section = root.querySelector<HTMLElement>('.latest-entries');

        expect(section).toBeTruthy();
        if (!section) return;
        // The wrapping <section> no longer carries role="link" / click handler —
        // every tile is its own link so the visual affordance matches the
        // destination (Copilot review feedback on the original PR).
        expect(section.getAttribute('role')).toBeNull();
        expect(section.getAttribute('tabindex')).toBeNull();
        expect(section.querySelector('h2')?.textContent).toContain(
          'Letzte Übungen'
        );
        const grid = section.querySelector<HTMLElement>(
          '[data-testid="dashboard-recent-exercises-grid"]'
        );
        expect(grid).toBeTruthy();
        const tiles = section.querySelectorAll<HTMLAnchorElement>(
          'a[data-testid="dashboard-recent-exercise-tile"]'
        );
        expect(tiles.length).toBeGreaterThan(0);
        // Each tile's href carries the entry id as a `#entry-<id>`
        // fragment — the history page reads the fragment, finds the
        // row, and scrolls/highlights it inside the virtualized table.
        // The per-tile `data-entry-id` attribute lets E2E tests target
        // a specific tile without falling back to nth-of-type selectors.
        for (const tile of Array.from(tiles)) {
          const href = tile.getAttribute('href') ?? '';
          expect(href).toContain('/history');
          expect(href).toMatch(/#entry-[^&?]+$/);
          const entryId = tile.getAttribute('data-entry-id');
          expect(entryId).toBeTruthy();
          // Fragment id must match the data-entry-id so the dashboard
          // tile and the history-row scroll target stay in lockstep.
          expect(href).toContain(`#entry-${entryId}`);
        }
      });

      it('Then the "Zur Historie" CTA is its own routerLink', () => {
        const root = fixture.nativeElement as HTMLElement;
        const cta = root.querySelector<HTMLAnchorElement>(
          '[data-testid="dashboard-latest-entries-cta"]'
        );
        expect(cta).toBeTruthy();
        if (!cta) return;
        expect(cta.tagName).toBe('A');
        expect(cta.getAttribute('href')).toContain('/history');
        expect(cta.textContent).toContain('Zur Historie');
      });

      it('Then tileIcon distinguishes pushup entries from generic exercise entries', () => {
        const component = fixture.componentInstance;
        const pushupIcon = component.tileIcon({
          _id: 'p',
          kind: 'pushup',
          timestamp: todayTs,
          reps: 10,
        } as unknown as Parameters<typeof component.tileIcon>[0]);
        const exerciseIcon = component.tileIcon({
          _id: 'e',
          kind: 'exercise',
          exerciseId: 'plank.standard',
          timestamp: todayTs,
        } as unknown as Parameters<typeof component.tileIcon>[0]);
        // Two distinct icons keep pushup tiles visually separable from the
        // newer multi-exercise tiles — important now that the dashboard
        // mixes both kinds in the same grid.
        expect(pushupIcon).toBe('fitness_center');
        expect(exerciseIcon).toBe('sports_gymnastics');
        expect(pushupIcon).not.toBe(exerciseIcon);
      });

      it('Then the Schnellaktionen card is rendered above the today-focus section', () => {
        const root = fixture.nativeElement as HTMLElement;
        const quickActions = root.querySelector<HTMLElement>('.quick-actions');
        const todayFocus = root.querySelector<HTMLElement>('.today-focus');

        expect(quickActions).toBeTruthy();
        expect(todayFocus).toBeTruthy();
        if (!quickActions || !todayFocus) return;

        // Compare document position — quick-actions must come before today-focus
        // in DOM order so the primary entry-point sits higher on the page.
        const relation = quickActions.compareDocumentPosition(todayFocus);
        expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      });
    });

    describe('When the user has configured custom quick-add buttons', () => {
      it('Then configured reps override the defaults 10/20/30', async () => {
        const configApi = TestBed.inject(UserConfigApiService);
        (configApi.getConfig as ReturnType<typeof vitest.fn>).mockReturnValue(
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
        TestBed.inject(UserConfigStore).reload();
        const freshFixture = TestBed.createComponent(StatsDashboardComponent);
        await freshFixture.whenStable();

        const text = freshFixture.nativeElement.textContent;
        expect(text).toContain('+15 Reps');
        expect(text).toContain('+25 Reps');
        expect(text).toContain('+50 Reps');
        expect(text).not.toContain('+10 Reps');
        expect(text).not.toContain('+20 Reps');
        expect(text).not.toContain('+30 Reps');
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

    // Regression: the "Letzte Einträge" preview was previously fed only
    // by the pushups collection, so sit-ups / squats / plank entries
    // were silently hidden from the dashboard even though the History
    // page rendered them. The unified row source merges both Firestore
    // collections so every kind of workout shows up here.
    describe('When live exercise entries exist alongside pushups', () => {
      it('Then latestEntries surfaces both pushups and exercise entries', async () => {
        // Given the live store has connected with one pushup and one
        // exercise entry (sit-ups).
        liveConnected.set(true);
        liveEntries.set([
          {
            _id: 'p1',
            timestamp: '2025-01-15T10:00:00',
            reps: 10,
            source: 'web',
            type: 'Standard',
          },
        ]);
        liveExerciseEntries.set([
          {
            _id: 'e1',
            exerciseId: 'abs.situps',
            timestamp: '2025-01-15T11:00:00',
            reps: 20,
            source: 'web',
          },
        ]);
        await fixture.whenStable();
        const component = fixture.componentInstance;

        // Then both entries are part of the dashboard's recent history.
        const ids = component.latestEntries().map((e) => e._id);
        expect(ids).toEqual(expect.arrayContaining(['p1', 'e1']));
        // Latest by timestamp is the exercise entry (11:00 > 10:00) —
        // proves the unified merge isn't accidentally pushup-biased.
        expect(component.lastEntry()?._id).toBe('e1');
        expect(component.lastEntry()?.kind).toBe('exercise');
      });

      it('Then the "Letzter Eintrag" card renders the exercise label and the measurement-aware value', async () => {
        // Given the live store has a single plank entry (time-based).
        liveConnected.set(true);
        liveEntries.set([]);
        liveExerciseEntries.set([
          {
            _id: 'e1',
            exerciseId: 'plank.standard',
            timestamp: '2025-01-15T11:00:00',
            durationSec: 90,
            source: 'web',
          },
        ]);
        await fixture.whenStable();
        fixture.detectChanges();

        // Then the exercise-branch template renders the label AND the
        // measurement-aware value: a 90-second plank reads as "1:30"
        // (m:ss via formatExerciseValue), not "0 Reps" or "90".
        const root = fixture.nativeElement as HTMLElement;
        const card = root.querySelector<HTMLElement>(
          '[data-testid="dashboard-last-entry-exercise"]'
        );
        expect(card).not.toBeNull();
        if (!card) return;
        const text = card.textContent ?? '';
        expect(text).toContain('Plank');
        expect(text).toContain('1:30');
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
          expect.objectContaining({ reps: 10, source: 'web', type: 'standard' })
        );
      });
    });
  });

  describe('Given the manual entry dialog is submitted (regression: create event was silently dropped)', () => {
    describe('When createEntry is called with a pushup result', () => {
      it('Then it should call createPushup', async () => {
        // Given — createEntry() is the handler called after the dialog closes
        const component = fixture.componentInstance;
        vi.clearAllMocks();

        // When
        await component.createEntry({
          kind: 'pushup',
          timestamp: todayTs,
          reps: 15,
          sets: [15],
          source: 'web',
          type: 'diamond',
        });
        await fixture.whenStable();

        // Then
        expect(serviceMock.createPushup).toHaveBeenCalledWith({
          timestamp: todayTs,
          reps: 15,
          sets: [15],
          source: 'web',
          type: 'diamond',
        });
      });

      it('Then it should refresh the store after creation', async () => {
        // Given
        const component = fixture.componentInstance;
        vi.clearAllMocks();

        // When
        await component.createEntry({
          kind: 'pushup',
          timestamp: todayTs,
          reps: 15,
          sets: [15],
          source: 'web',
          type: 'diamond',
        });
        // refreshAll() triggers async resource reload — wait for it
        await fixture.whenStable();

        // Then
        expect(serviceMock.listPushups).toHaveBeenCalled();
      });

      it('Then it should reload AppDataFacade so the toolbar count refreshes', async () => {
        // Given
        const component = fixture.componentInstance;
        vi.clearAllMocks();

        // When
        await component.createEntry({
          kind: 'pushup',
          timestamp: todayTs,
          reps: 15,
          sets: [15],
          source: 'web',
          type: 'diamond',
        });

        // Then
        expect(reloadAfterMutationSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('When createEntry is called with an exercise result', () => {
      it('Then ExerciseFirestoreService.createEntry is invoked with the user id and the catalog payload', async () => {
        const component = fixture.componentInstance;
        vi.clearAllMocks();

        await component.createEntry({
          kind: 'exercise',
          exerciseId: 'plank.standard',
          measurement: 'time',
          timestamp: '2026-02-10T13:45+01:00',
          reps: 0,
          sets: [],
          intervals: [],
          durationSec: 90,
        });
        await fixture.whenStable();

        expect(exerciseCreateSpy).toHaveBeenCalledWith(
          'u1',
          expect.objectContaining({
            exerciseId: 'plank.standard',
            durationSec: 90,
          })
        );
        // Pushup API stays untouched on the exercise branch — would
        // otherwise leak the entry into the wrong Firestore collection.
        expect(serviceMock.createPushup).not.toHaveBeenCalled();
        expect(reloadAfterMutationSpy).toHaveBeenCalledTimes(1);
      });

      it('Then a non-empty intervals array on a time entry is forwarded to ExerciseFirestoreService.createEntry', async () => {
        // Regression for an earlier silent-drop: the createEntry helper
        // builds the payload from `result.intervals`, and the previous
        // strength-fallback shape dropped the field entirely. Pin the
        // forward so any future shape change can't silently lose
        // breakdown data again.
        const component = fixture.componentInstance;
        vi.clearAllMocks();

        await component.createEntry({
          kind: 'exercise',
          exerciseId: 'plank.standard',
          measurement: 'time',
          timestamp: '2026-02-10T13:45+01:00',
          reps: 0,
          sets: [],
          intervals: [30, 30, 30],
          durationSec: 90,
        });
        await fixture.whenStable();

        expect(exerciseCreateSpy).toHaveBeenCalledWith(
          'u1',
          expect.objectContaining({
            exerciseId: 'plank.standard',
            durationSec: 90,
            intervals: [30, 30, 30],
          })
        );
      });

      it('Then intervals are forwarded on a distance-time entry (cardio.running)', async () => {
        const component = fixture.componentInstance;
        vi.clearAllMocks();

        await component.createEntry({
          kind: 'exercise',
          exerciseId: 'cardio.running',
          measurement: 'distance-time',
          timestamp: '2026-02-10T13:45+01:00',
          reps: 0,
          sets: [],
          intervals: [400, 400, 400],
          distanceM: 1200,
          durationSec: 360,
        });
        await fixture.whenStable();

        expect(exerciseCreateSpy).toHaveBeenCalledWith(
          'u1',
          expect.objectContaining({
            exerciseId: 'cardio.running',
            distanceM: 1200,
            durationSec: 360,
            intervals: [400, 400, 400],
          })
        );
      });

      it('Then it returns early without writing when userIdSafe() is empty', async () => {
        const component = fixture.componentInstance;
        vi.clearAllMocks();
        userContextSpy.userIdSafe.mockReturnValueOnce('');

        await component.createEntry({
          kind: 'exercise',
          exerciseId: 'plank.standard',
          measurement: 'time',
          timestamp: '2026-02-10T13:45+01:00',
          reps: 0,
          sets: [],
          intervals: [],
          durationSec: 90,
        });

        // Anonymous / signed-out users must not silently land in the
        // exerciseEntries collection — the early-return guards that.
        expect(exerciseCreateSpy).not.toHaveBeenCalled();
        expect(serviceMock.createPushup).not.toHaveBeenCalled();
        expect(reloadAfterMutationSpy).not.toHaveBeenCalled();
      });
    });

    describe('When addQuickEntry is called', () => {
      it('Then it should reload AppDataFacade so the toolbar count refreshes', async () => {
        // Given
        const component = fixture.componentInstance;
        vi.clearAllMocks();

        // When
        await component.addQuickEntry(10);

        // Then
        expect(reloadAfterMutationSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('When openCreateDialog is called', () => {
      it('Then MatDialog.open is invoked with the unified TrainingEntryDialogComponent', () => {
        // Given
        dialogOpenSpy.mockClear();

        // When
        fixture.componentInstance.openCreateDialog();

        // Then
        expect(dialogOpenSpy).toHaveBeenCalledWith(
          expect.any(Function), // TrainingEntryDialogComponent
          expect.objectContaining({ width: 'min(92vw, 420px)' })
        );
      });
    });
  });

  // Regression: a `?snooze=N` deep-link arrives via the SW snooze action
  // (or via App.ts before it strips the param). The dashboard's
  // `_handleLogParam` shares the URL with App.ts's `_handleSnoozeParam`,
  // so it must defer to it — never mistake a snooze URL for a quick-log
  // or log deep-link.
  describe('Given the dashboard mounts on a snooze deep-link URL', () => {
    /**
     * Boots a fresh dashboard fixture with the given query params on the
     * `ActivatedRoute` snapshot — the only path the dashboard's
     * `_handleLogParam` reads. Resets the testing module so the override
     * is allowed (overrideProvider can't run after `createComponent`).
     */
    async function createDashboardWithQueryParams(
      params: Record<string, string>
    ): Promise<ComponentFixture<StatsDashboardComponent>> {
      TestBed.resetTestingModule();
      window.history.replaceState({}, '', '/');
      TestBed.configureTestingModule({
        imports: [StatsDashboardComponent],
        providers: [
          provideRouter([]),
          { provide: StatsApiService, useValue: serviceMock },
          {
            provide: UserStatsApiService,
            useValue: { getUserStats: vitest.fn().mockReturnValue(of(null)) },
          },
          { provide: LiveDataStore, useValue: liveMock },
          { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthStore, useValue: makeAuthStoreMock() },
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
          {
            provide: QuickAddOrchestrationService,
            useValue: {
              fillToGoal: vitest.fn(),
              fillToGoalInFlight: signal(false).asReadonly(),
            },
          },
          { provide: AppDataFacade, useValue: appDataMock },
          { provide: ShareService, useValue: shareServiceMock },
          {
            provide: ExerciseFirestoreService,
            useValue: {
              listEntries: () => of([]),
              createEntry: () => of({}),
            },
          },
          {
            provide: UserTrainingPlanApiService,
            useValue: trainingPlanApiMock,
          },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { queryParamMap: convertToParamMap(params) },
            },
          },
        ],
      });
      TestBed.overrideProvider(MatDialog, { useValue: dialogMock });
      await TestBed.compileComponents();
      const f = TestBed.createComponent(StatsDashboardComponent);
      await f.whenStable();
      return f;
    }

    describe('When the URL carries only ?snooze=30', () => {
      it('Then it must NOT call createPushup', async () => {
        // Given — fresh dashboard mounted with the snooze deep-link URL
        serviceMock.createPushup.mockClear();
        await createDashboardWithQueryParams({ snooze: '30' });

        // Then — snooze deep-links don't trigger any entry creation. The
        // SW's snooze action posts SNOOZE_REMINDER to an open client OR
        // opens this URL when no client exists; either way, the dashboard
        // must keep its hands off entry creation.
        expect(serviceMock.createPushup).not.toHaveBeenCalled();
      });

      it('Then it must NOT open the create-entry dialog', async () => {
        // Given
        dialogOpenSpy.mockClear();
        await createDashboardWithQueryParams({ snooze: '30' });

        // Then — `?log=1` opens the dialog; `?snooze=30` must not.
        expect(dialogOpenSpy).not.toHaveBeenCalled();
      });
    });

    describe('When the URL carries ?snooze=30&quickLog=20 (defense-in-depth)', () => {
      // The current SW never produces this combination, but if a future
      // change ever did, the snooze flow should win — clicking snooze
      // should never silently log push-ups even with a stale `quickLog`
      // alongside it. This test pins down the dashboard's contract:
      // a `snooze` param suppresses the quick-log deep-link.
      it('Then it must NOT call createPushup', async () => {
        // Given
        serviceMock.createPushup.mockClear();
        await createDashboardWithQueryParams({
          snooze: '30',
          quickLog: '20',
        });

        // Then
        expect(serviceMock.createPushup).not.toHaveBeenCalled();
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
        TestBed.inject(UserConfigStore).reload();
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
      TestBed.inject(UserConfigStore).reload();
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();
      const component = freshFixture.componentInstance;

      // Then - should use defaults, not 0
      expect(component.dailyGoal()).toBe(10);
      expect(component.weeklyGoal()).toBe(50);
      expect(component.monthlyGoal()).toBe(200);
    });
  });

  describe('Daily goal-fill button is removed from Zielfortschritt card', () => {
    it('Then no [data-testid="dashboard-goal-fill"] element exists in the template', async () => {
      await fixture.whenStable();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="dashboard-goal-fill"]'
        )
      ).toBeNull();
    });
  });

  describe('Daily goal-fill button in Schnellaktionen card', () => {
    function findQuickActionsGoalButton(
      fixtureEl: HTMLElement
    ): HTMLButtonElement | null {
      return fixtureEl.querySelector<HTMLButtonElement>(
        '[data-testid="dashboard-quick-actions-goal-fill"]'
      );
    }

    it('Given goal not reached, Then the button is visible with remaining reps', async () => {
      await fixture.whenStable();
      const button = findQuickActionsGoalButton(fixture.nativeElement);
      expect(button).not.toBeNull();
      if (!button) return;
      expect(button.disabled).toBe(false);
      expect(button.textContent ?? '').toContain('88');
    });

    it('Given goal reached, Then the button is disabled with erreicht label', async () => {
      const configApi = TestBed.inject(UserConfigApiService);
      (configApi.getConfig as ReturnType<typeof vitest.fn>).mockReturnValue(
        of({ userId: 'u1', dailyGoal: 5, weeklyGoal: 10, monthlyGoal: 10 })
      );
      TestBed.inject(UserConfigStore).reload();
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();

      const button = findQuickActionsGoalButton(freshFixture.nativeElement);
      expect(button).not.toBeNull();
      if (!button) return;
      expect(button.disabled).toBe(true);
      expect(button.textContent ?? '').toContain('erreicht');
    });

    it('Given goal is zero, Then the button is not rendered', async () => {
      const configApi = TestBed.inject(UserConfigApiService);
      (configApi.getConfig as ReturnType<typeof vitest.fn>).mockReturnValue(
        of({ userId: 'u1', dailyGoal: 0, weeklyGoal: 0, monthlyGoal: 0 })
      );
      TestBed.inject(UserConfigStore).reload();
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();

      expect(findQuickActionsGoalButton(freshFixture.nativeElement)).toBeNull();
    });

    it('Given the button is clicked, Then QuickAddOrchestrationService.fillToGoal is called', async () => {
      await fixture.whenStable();
      const svc = TestBed.inject(QuickAddOrchestrationService);
      const button = findQuickActionsGoalButton(fixture.nativeElement);
      expect(button).not.toBeNull();
      if (!button) return;
      button.click();
      expect(svc.fillToGoal).toHaveBeenCalledTimes(1);
    });

    it('Regression: Given live is connected, When Firestore pushes a new entry (SpeedDial flow), Then the "+X bis zum Ziel" label updates without an explicit reload', async () => {
      // Given a connected live store with one entry today (12 reps), goal 100
      liveConnected.set(true);
      liveEntries.set([
        {
          _id: '2',
          timestamp: todayTs,
          reps: 12,
          source: 'web',
          type: 'Diamond',
        },
      ]);
      await fixture.whenStable();
      fixture.detectChanges();

      let button = findQuickActionsGoalButton(fixture.nativeElement);
      expect(button).not.toBeNull();
      if (!button) return;
      expect(button.textContent ?? '').toContain('88');

      // When Firestore pushes a new 30-rep entry (the SpeedDial path) —
      // simulated by a LiveDataStore.entries update. Crucially we do NOT call
      // refreshAll(): the bug was that derived signals only updated when REST
      // resources reloaded, ignoring the live signal.
      liveEntries.update((rows) => [
        ...rows,
        {
          _id: 'new',
          timestamp: '2025-01-15T13:00:00',
          reps: 30,
          source: 'quick-add',
          type: 'Standard',
        },
      ]);
      await fixture.whenStable();
      fixture.detectChanges();

      // Then the label reflects the new total reactively (12 + 30 = 42, gap = 58)
      button = findQuickActionsGoalButton(fixture.nativeElement);
      expect(button).not.toBeNull();
      if (!button) return;
      expect(button.textContent ?? '').toContain('58');
    });
  });

  describe('Given the share button in the dashboard header', () => {
    it('Then it forwards a payload with today total + url to ShareService when clicked', async () => {
      // Given
      await fixture.whenStable();
      shareSpy.mockClear();
      const button = fixture.nativeElement.querySelector(
        '[data-testid="dashboard-share"]'
      ) as HTMLButtonElement;

      // When
      expect(button).not.toBeNull();
      button.click();
      await fixture.whenStable();

      // Then
      expect(shareSpy).toHaveBeenCalledTimes(1);
      const payload = shareSpy.mock.calls[0][0];
      expect(payload.url).toBe('https://pushup-stats.com');
      expect(payload.text).toContain('12');
      expect(payload.title).toBe('Pushup Tracker');
    });

    it('Then a multi-day streak adds the streak count to the share text', async () => {
      // Given — 3 consecutive days ending today (frozen Jan 15, 2025)
      serviceMock.listPushups.mockReturnValueOnce(
        of([
          {
            _id: 'a',
            timestamp: '2025-01-13T12:00:00',
            reps: 10,
            source: 'web',
            type: 'Standard',
          },
          {
            _id: 'b',
            timestamp: '2025-01-14T12:00:00',
            reps: 10,
            source: 'web',
            type: 'Standard',
          },
          {
            _id: 'c',
            timestamp: '2025-01-15T12:00:00',
            reps: 10,
            source: 'web',
            type: 'Standard',
          },
        ])
      );
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();
      shareSpy.mockClear();
      const button = freshFixture.nativeElement.querySelector(
        '[data-testid="dashboard-share"]'
      ) as HTMLButtonElement;

      // When
      button.click();
      await freshFixture.whenStable();

      // Then
      const payload = shareSpy.mock.calls[0][0];
      expect(payload.text).toContain('Streak');
      expect(payload.text).toContain('3');
    });

    it('Given the user has opted into a public profile, Then the share URL is the profile permalink', async () => {
      // Given — user config with `ui.publicProfile = true`. The store
      // reads UserConfigStore.config(), so the API mock must return that
      // shape; UserContextService.userIdSafe() returns 'u1' (see top of
      // describe block), so the resulting URL is /<lang>/u/u1.
      const configApi = TestBed.inject(UserConfigApiService);
      (configApi.getConfig as ReturnType<typeof vitest.fn>).mockReturnValue(
        of({
          userId: 'u1',
          dailyGoal: 100,
          weeklyGoal: 500,
          monthlyGoal: 2000,
          ui: { publicProfile: true },
        })
      );
      TestBed.inject(UserConfigStore).reload();
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();
      shareSpy.mockClear();
      const button = freshFixture.nativeElement.querySelector(
        '[data-testid="dashboard-share"]'
      ) as HTMLButtonElement;

      // When
      button.click();
      await freshFixture.whenStable();

      // Then — URL is the locale-prefixed profile permalink, and the
      // share text reads as a personal share ("schau dir mein Profil
      // an") rather than the generic "tracke deine stats" CTA.
      const payload = shareSpy.mock.calls[0][0];
      expect(payload.url).toMatch(
        /^https:\/\/pushup-stats\.com\/(de|en)\/u\/u1$/
      );
      expect(payload.text).toContain('Profil');
    });

    it('Given the user has NOT opted into a public profile, Then the share URL stays the homepage', async () => {
      // The default mock config in this spec doesn't set publicProfile,
      // so this is the existing baseline — assert it explicitly so a
      // regression flipping the default to "always link to profile"
      // (which would 404 on opted-out users) is caught.
      await fixture.whenStable();
      shareSpy.mockClear();
      const button = fixture.nativeElement.querySelector(
        '[data-testid="dashboard-share"]'
      ) as HTMLButtonElement;

      button.click();
      await fixture.whenStable();

      const payload = shareSpy.mock.calls[0][0];
      expect(payload.url).toBe('https://pushup-stats.com');
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

  describe('Given an active training plan prescribes a rest day for today', () => {
    // Frozen date is 2025-01-15 (see top of describe). The
    // `recruit-6w-v1` catalog defines day 2 as a rest day, so
    // `startDate: '2025-01-14'` puts today on a rest day.
    const restDayPlan = {
      userId: 'u1',
      planId: 'recruit-6w-v1',
      startDate: '2025-01-14',
      status: 'active' as const,
      completedDays: [] as number[],
    };

    function querySelector(
      el: HTMLElement,
      testid: string
    ): HTMLElement | null {
      return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
    }

    it('Then the Zielfortschritt card shows "Ruhetag" instead of an X / Y count', async () => {
      // Given an active plan with today as rest day
      trainingPlanApiMock.getActivePlan.mockReturnValue(of(restDayPlan));
      TestBed.inject(TrainingPlanStore).reload();

      // When the dashboard renders
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();
      freshFixture.detectChanges();

      // Then the rest-day badge is shown and the configured-goal hint
      // sits below it as a small secondary line.
      const component = freshFixture.componentInstance;
      expect(component.isPlanRestDay()).toBe(true);

      const badge = querySelector(
        freshFixture.nativeElement,
        'dashboard-rest-day-target'
      );
      expect(badge).not.toBeNull();
      if (!badge) return;
      expect(badge.textContent ?? '').toContain('Ruhetag');

      const hint = querySelector(
        freshFixture.nativeElement,
        'dashboard-rest-day-config-hint'
      );
      expect(hint).not.toBeNull();
      if (!hint) return;
      // Default mock config has dailyGoal: 100 — the configured goal
      // must remain visible (smaller, below) so the user knows what
      // their non-plan baseline is.
      expect(hint.textContent ?? '').toContain('100');
    });

    it('And the configured-goal hint is hidden when the user has no daily goal set', async () => {
      // Given an active rest day AND a user config with dailyGoal=0
      trainingPlanApiMock.getActivePlan.mockReturnValue(of(restDayPlan));
      const configApi = TestBed.inject(UserConfigApiService);
      (configApi.getConfig as ReturnType<typeof vitest.fn>).mockReturnValue(
        of({ userId: 'u1', dailyGoal: 0, weeklyGoal: 0, monthlyGoal: 0 })
      );
      TestBed.inject(UserConfigStore).reload();
      TestBed.inject(TrainingPlanStore).reload();

      // When the dashboard renders
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();
      freshFixture.detectChanges();

      // Then no stale "Konfiguriertes Tagesziel: 0" line bleeds through
      expect(
        querySelector(freshFixture.nativeElement, 'dashboard-rest-day-target')
      ).not.toBeNull();
      expect(
        querySelector(
          freshFixture.nativeElement,
          'dashboard-rest-day-config-hint'
        )
      ).toBeNull();
    });

    it('And the Schnellaktionen "+N bis zum Ziel" CTA is suppressed so it does not contradict the rest-day banner', async () => {
      // Given an active rest day with a non-zero configured daily goal
      // (default mock has dailyGoal: 100, todayTotal: 12 → remainingToGoal
      // would otherwise be 88, rendering the goal-fill CTA).
      trainingPlanApiMock.getActivePlan.mockReturnValue(of(restDayPlan));
      TestBed.inject(TrainingPlanStore).reload();

      // When the dashboard renders
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();
      freshFixture.detectChanges();

      // Then the goal-fill button is hidden — telling the user "fill
      // to goal" while the Zielfortschritt card says "Ruhetag" would
      // be contradictory guidance on the same screen.
      expect(
        freshFixture.nativeElement.querySelector(
          '[data-testid="dashboard-quick-actions-goal-fill"]'
        )
      ).toBeNull();
    });

    it('And on a non-rest plan day the Zielfortschritt card keeps the regular X / Y display', async () => {
      // Given today resolves to day 1 (a `main` day in recruit-6w-v1)
      trainingPlanApiMock.getActivePlan.mockReturnValue(
        of({ ...restDayPlan, startDate: '2025-01-15' })
      );
      TestBed.inject(TrainingPlanStore).reload();

      // When the dashboard renders
      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();
      freshFixture.detectChanges();

      // Then the rest-day badge is NOT shown — the regular daily
      // goal row is rendered instead.
      const component = freshFixture.componentInstance;
      expect(component.isPlanRestDay()).toBe(false);
      expect(
        querySelector(freshFixture.nativeElement, 'dashboard-rest-day-target')
      ).toBeNull();
    });

    it('And the plan banner "Details öffnen" CTA links to the active day so the detail page scrolls there', async () => {
      // Given today resolves to day 1 (a `main` day in recruit-6w-v1).
      trainingPlanApiMock.getActivePlan.mockReturnValue(
        of({ ...restDayPlan, startDate: '2025-01-15' })
      );
      TestBed.inject(TrainingPlanStore).reload();

      const freshFixture = TestBed.createComponent(StatsDashboardComponent);
      await freshFixture.whenStable();
      freshFixture.detectChanges();

      // When the dashboard banner CTA is rendered, its href carries
      // `?day=<currentDayIndex>` so the detail page can scroll the
      // matching `#day-<N>` row into view on arrival.
      const link: HTMLAnchorElement | null =
        freshFixture.nativeElement.querySelector(
          '.plan-banner a[mat-stroked-button]'
        );
      expect(link).not.toBeNull();
      if (!link) return;
      const href = link.getAttribute('href') ?? '';
      expect(href).toContain('/training-plans/recruit-6w');
      expect(href).toContain('day=1');
    });
  });
});
