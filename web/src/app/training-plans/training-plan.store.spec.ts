import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { BehaviorSubject, from, map, of } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import {
  LiveDataStore,
  StatsApiService,
  UserTrainingPlanApiService,
} from '@pu-stats/data-access';
import {
  PushupCreate,
  PushupRecord,
  toBerlinIsoDate,
  TRAINING_PLANS,
  UserTrainingPlan,
} from '@pu-stats/models';
import { TrainingPlanStore } from './training-plan.store';

const PLAN = TRAINING_PLANS.find(
  (p) => p.id === 'challenge-30d-v1'
) as (typeof TRAINING_PLANS)[number];

interface Mocks {
  apiMock: {
    getActivePlan: ReturnType<typeof vitest.fn>;
    setPlan: ReturnType<typeof vitest.fn>;
    updatePlan: ReturnType<typeof vitest.fn>;
    addCompletedDay: ReturnType<typeof vitest.fn>;
    removeCompletedDay: ReturnType<typeof vitest.fn>;
  };
  statsApiMock: {
    createPushup: ReturnType<typeof vitest.fn>;
  };
  liveMock: {
    entries: ReturnType<typeof signal<PushupRecord[]>>;
    connected: ReturnType<typeof signal<boolean>>;
    updateTick: ReturnType<typeof signal<number>>;
  };
  stream: BehaviorSubject<UserTrainingPlan | null>;
  current: UserTrainingPlan | null;
}

describe('TrainingPlanStore', () => {
  const userId = signal<string>('u1');

  function setup(
    initial: UserTrainingPlan | null = null,
    initialEntries: PushupRecord[] = []
  ): {
    store: InstanceType<typeof TrainingPlanStore>;
    mocks: Mocks;
  } {
    const stream = new BehaviorSubject<UserTrainingPlan | null>(initial);
    const liveEntries = signal<PushupRecord[]>(initialEntries);
    const mocks: Mocks = {
      stream,
      current: initial,
      apiMock: {
        getActivePlan: vitest.fn(() => stream.asObservable()),
        setPlan: vitest.fn((_uid: string, plan: UserTrainingPlan) => {
          mocks.current = { ...plan, userId: _uid };
          stream.next(mocks.current);
          return new BehaviorSubject(mocks.current).asObservable();
        }),
        updatePlan: vitest.fn(
          (_uid: string, patch: Partial<UserTrainingPlan>) => {
            mocks.current = {
              ...(mocks.current as UserTrainingPlan),
              ...patch,
            };
            stream.next(mocks.current);
            return new BehaviorSubject(mocks.current).asObservable();
          }
        ),
        addCompletedDay: vitest.fn((_uid: string, dayIndex: number) => {
          const cur = mocks.current as UserTrainingPlan;
          if (!cur.completedDays.includes(dayIndex)) {
            mocks.current = {
              ...cur,
              completedDays: [...cur.completedDays, dayIndex].sort(
                (x, y) => x - y
              ),
            };
            stream.next(mocks.current);
          }
          return of(void 0);
        }),
        removeCompletedDay: vitest.fn((_uid: string, dayIndex: number) => {
          const cur = mocks.current as UserTrainingPlan;
          if (cur.completedDays.includes(dayIndex)) {
            mocks.current = {
              ...cur,
              completedDays: cur.completedDays.filter((d) => d !== dayIndex),
            };
            stream.next(mocks.current);
          }
          return of(void 0);
        }),
      },
      statsApiMock: {
        createPushup: vitest.fn((payload: PushupCreate) =>
          of({
            _id: 'new',
            timestamp: payload.timestamp,
            reps: payload.reps,
            sets: payload.sets,
            source: payload.source ?? 'plan',
            type: payload.type ?? 'Standard',
          } satisfies PushupRecord)
        ),
      },
      liveMock: {
        entries: liveEntries,
        connected: signal(true),
        updateTick: signal(0),
      },
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        // Treat tests as SSR so the midnight-tick setInterval doesn't
        // start (otherwise it would leak across `resetTestingModule`).
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: UserTrainingPlanApiService, useValue: mocks.apiMock },
        { provide: StatsApiService, useValue: mocks.statsApiMock },
        { provide: LiveDataStore, useValue: mocks.liveMock },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => userId() },
        },
      ],
    });
    const store = TestBed.inject(TrainingPlanStore);
    return { store, mocks };
  }

  async function flush(): Promise<void> {
    TestBed.tick();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    TestBed.tick();
  }

  it('starts with no active plan when the doc is missing', async () => {
    const { store } = setup(null);
    await flush();
    expect(store.activePlan()).toBeNull();
    expect(store.hasActivePlan()).toBe(false);
    expect(store.todayTarget()).toBe(0);
  });

  it("exposes today's target reps once a plan is active", async () => {
    const today = toBerlinIsoDate(new Date());
    const { store } = setup({
      userId: 'u1',
      planId: PLAN.id,
      startDate: today,
      status: 'active',
      completedDays: [],
    });
    await flush();

    expect(store.hasActivePlan()).toBe(true);
    expect(store.activeCatalog()?.id).toBe(PLAN.id);
    expect(store.currentDayIndex()).toBe(1);
    expect(store.todayDay()?.kind).toBe(PLAN.days[0].kind);
    expect(store.todayTarget()).toBe(PLAN.days[0].targetReps);
  });

  it('marks today as done and updates completedDays via the API', async () => {
    const today = toBerlinIsoDate(new Date());
    const { store, mocks } = setup({
      userId: 'u1',
      planId: PLAN.id,
      startDate: today,
      status: 'active',
      completedDays: [],
    });
    await flush();

    await store.markTodayDone();
    await flush();

    expect(mocks.apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 1);
    expect(store.todayDone()).toBe(true);
  });

  it('start() overwrites the active plan with a fresh start date and empty completedDays', async () => {
    const { store, mocks } = setup({
      userId: 'u1',
      planId: 'recruit-6w-v1',
      startDate: '2026-01-01',
      status: 'active',
      completedDays: [1, 2, 3],
    });
    await flush();

    await store.start(PLAN.id);
    await flush();

    expect(mocks.apiMock.setPlan).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        planId: PLAN.id,
        completedDays: [],
        status: 'active',
      })
    );
    expect(store.activePlan()?.planId).toBe(PLAN.id);
    expect(store.activePlan()?.completedDays).toEqual([]);
  });

  it('abandon() flips status to abandoned without clearing progress', async () => {
    const today = toBerlinIsoDate(new Date());
    const { store, mocks } = setup({
      userId: 'u1',
      planId: PLAN.id,
      startDate: today,
      status: 'active',
      completedDays: [1, 2],
    });
    await flush();

    await store.abandon();
    await flush();

    expect(mocks.apiMock.updatePlan).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ status: 'abandoned' })
    );
    expect(store.hasActivePlan()).toBe(false);
  });

  it('completionPercent counts non-rest days', async () => {
    const today = toBerlinIsoDate(new Date());
    const { store } = setup({
      userId: 'u1',
      planId: PLAN.id,
      startDate: today,
      status: 'active',
      completedDays: [1, 2, 4],
    });
    await flush();

    const total = PLAN.days.filter((d) => d.kind !== 'rest').length;
    expect(store.completionPercent()).toBe(Math.round((3 / total) * 100));
  });

  it('completionPercent ignores stray rest-day entries and clamps at 100', async () => {
    const today = toBerlinIsoDate(new Date());
    // Find a rest-day index inside the catalog so we can plant it
    // into completedDays as if a stale write leaked one in.
    const restDay = PLAN.days.find((d) => d.kind === 'rest');
    if (!restDay) throw new Error('catalog invariant: plan has a rest day');
    const restDayIdx = restDay.dayIndex;
    const allNonRest = PLAN.days
      .filter((d) => d.kind !== 'rest')
      .map((d) => d.dayIndex);

    const { store } = setup({
      userId: 'u1',
      planId: PLAN.id,
      startDate: today,
      status: 'active',
      // every non-rest day completed + a phantom rest day
      completedDays: [...allNonRest, restDayIdx],
    });
    await flush();

    expect(store.completionPercent()).toBe(100);
  });

  it('markTodayDone does nothing on a rest day', async () => {
    // Recruit-6w day 2 is a rest day. Start it 1 day ago so today is
    // the rest day in the plan.
    const recruit = TRAINING_PLANS.find(
      (p) => p.id === 'recruit-6w-v1'
    ) as (typeof TRAINING_PLANS)[number];
    expect(recruit.days[1].kind).toBe('rest');
    const todayIso = toBerlinIsoDate(new Date());
    const yesterday = toBerlinIsoDate(new Date(Date.now() - 86_400_000));

    const { store, mocks } = setup({
      userId: 'u1',
      planId: recruit.id,
      startDate: yesterday,
      status: 'active',
      completedDays: [],
    });
    await flush();

    // sanity: the resolver believes today is plan-day 2 (a rest day)
    expect(store.currentDayIndex()).toBe(2);
    expect(store.todayDay()?.kind).toBe('rest');

    await store.markTodayDone();
    await flush();

    expect(mocks.apiMock.addCompletedDay).not.toHaveBeenCalled();
    expect(store.activePlan()?.completedDays).toEqual([]);
    // Reference unused param to keep tsc happy.
    void todayIso;
  });

  describe('logPlanDay', () => {
    it('creates a pushup entry with the plan sets and marks the day done', async () => {
      // Day 2 is a main day with sets [20, 20, 20] and target 60.
      // We seed startDate one day in the past so day 2 == today
      // (logPlanDay rejects future days).
      const yesterdayIso = toBerlinIsoDate(
        new Date(Date.now() - 86_400_000)
      );
      const { store, mocks } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: yesterdayIso,
        status: 'active',
        completedDays: [],
      });
      await flush();

      const day2 = PLAN.days[1];
      expect(day2.kind).toBe('main');
      expect(day2.targetReps).toBeGreaterThan(0);

      await store.logPlanDay(2);
      await flush();

      expect(mocks.statsApiMock.createPushup).toHaveBeenCalledTimes(1);
      const call = mocks.statsApiMock.createPushup.mock.calls[0][0];
      expect(call.reps).toBe(day2.targetReps);
      expect(call.sets).toEqual(day2.sets);
      expect(call.source).toBe('plan');

      expect(mocks.apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);
    });

    it('skips the pushup write when the day is already covered by existing entries', async () => {
      const today = toBerlinIsoDate(new Date());
      // Day 1 of challenge-30d is a `test` day with target 0 — pick
      // a main day instead. Day 2 has target 60.
      const day2Target = PLAN.days[1].targetReps;
      const startDate = toBerlinIsoDate(
        new Date(Date.now() - 86_400_000) // start one day ago → today is day 2
      );
      const { store, mocks } = setup(
        {
          userId: 'u1',
          planId: PLAN.id,
          startDate,
          status: 'active',
          completedDays: [],
        },
        [
          {
            _id: 'a',
            timestamp: `${today}T08:00:00.000+02:00`,
            reps: day2Target,
            source: 'web',
          },
        ]
      );
      await flush();

      await store.logPlanDay(2);
      await flush();

      // Pushup write skipped — user already had enough reps.
      expect(mocks.statsApiMock.createPushup).not.toHaveBeenCalled();
      // Plan day still gets marked done.
      expect(mocks.apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);
    });

    it('tops up only the remainder when partially logged', async () => {
      const today = toBerlinIsoDate(new Date());
      const day2Target = PLAN.days[1].targetReps;
      const startDate = toBerlinIsoDate(
        new Date(Date.now() - 86_400_000)
      );
      const { store, mocks } = setup(
        {
          userId: 'u1',
          planId: PLAN.id,
          startDate,
          status: 'active',
          completedDays: [],
        },
        [
          {
            _id: 'a',
            timestamp: `${today}T08:00:00.000+02:00`,
            reps: 20,
            source: 'web',
          },
        ]
      );
      await flush();

      await store.logPlanDay(2);
      await flush();

      const call = mocks.statsApiMock.createPushup.mock.calls[0][0];
      expect(call.reps).toBe(day2Target - 20);
      expect(call.sets).toEqual([day2Target - 20]);
    });

    it('does nothing on rest days', async () => {
      const today = toBerlinIsoDate(new Date());
      const { store, mocks } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        completedDays: [],
      });
      await flush();

      // challenge-30d day 7 is rest
      const restDay = PLAN.days.find((d) => d.kind === 'rest');
      if (!restDay) throw new Error('catalog invariant: rest day exists');

      await store.logPlanDay(restDay.dayIndex);
      await flush();

      expect(mocks.statsApiMock.createPushup).not.toHaveBeenCalled();
      expect(mocks.apiMock.addCompletedDay).not.toHaveBeenCalled();
    });

    it("returns 'not-ready' when LiveDataStore hasn't connected yet (no writes)", async () => {
      // Browser PLATFORM_ID is required for the connected check. We
      // build the store without the SSR shortcut and then assert no
      // writes happen even though target would otherwise be reached.
      const today = toBerlinIsoDate(new Date());
      const target = PLAN.days[1].targetReps;
      const startDate = toBerlinIsoDate(new Date(Date.now() - 86_400_000));
      const stream = new BehaviorSubject<UserTrainingPlan | null>({
        userId: 'u1',
        planId: PLAN.id,
        startDate,
        status: 'active',
        completedDays: [],
      });
      const apiMock = {
        getActivePlan: vitest.fn(() => stream.asObservable()),
        setPlan: vitest.fn(),
        updatePlan: vitest.fn(),
        addCompletedDay: vitest.fn(() => of(void 0)),
        removeCompletedDay: vitest.fn(() => of(void 0)),
      };
      const statsApiMock = { createPushup: vitest.fn() };
      // Pre-existing entry that DOES cover the target — but
      // `connected: false` means we shouldn't trust it.
      const liveEntries = signal<PushupRecord[]>([
        {
          _id: 'existing',
          timestamp: `${today}T08:00:00.000+02:00`,
          reps: target,
          source: 'web',
        },
      ]);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: UserTrainingPlanApiService, useValue: apiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          {
            provide: LiveDataStore,
            useValue: {
              entries: liveEntries,
              connected: signal(false),
              updateTick: signal(0),
            },
          },
          { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        ],
      });
      const store = TestBed.inject(TrainingPlanStore);
      await flush();

      const result = await store.logPlanDay(2);
      await flush();

      expect(result).toBe('not-ready');
      expect(statsApiMock.createPushup).not.toHaveBeenCalled();
      expect(apiMock.addCompletedDay).not.toHaveBeenCalled();
      TestBed.resetTestingModule();
    });

    it("returns 'in-flight' on a concurrent call for the same day (no duplicate writes)", async () => {
      // Resolver we control to keep the first call hanging until
      // the second one has had a chance to short-circuit.
      let releaseFirst: (value: void) => void = () => undefined;
      const firstWrite = new Promise<void>((res) => (releaseFirst = res));
      const today = toBerlinIsoDate(new Date());
      const startDate = toBerlinIsoDate(new Date(Date.now() - 86_400_000));
      const stream = new BehaviorSubject<UserTrainingPlan | null>({
        userId: 'u1',
        planId: PLAN.id,
        startDate,
        status: 'active',
        completedDays: [],
      });
      const apiMock = {
        getActivePlan: vitest.fn(() => stream.asObservable()),
        setPlan: vitest.fn(),
        updatePlan: vitest.fn(),
        addCompletedDay: vitest.fn(() => of(void 0)),
        removeCompletedDay: vitest.fn(() => of(void 0)),
      };
      const statsApiMock = {
        createPushup: vitest.fn(() => from(firstWrite).pipe(map(() => ({})))),
      };
      const liveEntries = signal<PushupRecord[]>([]);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          // SSR PLATFORM_ID so we don't need to also handle the
          // setInterval. The 'not-ready' branch relies on
          // _isBrowser, so we explicitly pass through that gate by
          // setting `connected: true`.
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: UserTrainingPlanApiService, useValue: apiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          {
            provide: LiveDataStore,
            useValue: {
              entries: liveEntries,
              connected: signal(true),
              updateTick: signal(0),
            },
          },
          { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        ],
      });
      const store = TestBed.inject(TrainingPlanStore);
      await flush();
      void today;

      // Kick off two parallel calls. The first is parked inside
      // createPushup; the second hits the in-flight lock.
      const firstPromise = store.logPlanDay(2);
      // Yield so the lock has been acquired.
      await Promise.resolve();
      const secondPromise = store.logPlanDay(2);

      const secondResult = await secondPromise;
      expect(secondResult).toBe('in-flight');
      expect(statsApiMock.createPushup).toHaveBeenCalledTimes(1);

      releaseFirst();
      const firstResult = await firstPromise;
      await flush();
      expect(firstResult).toBe('logged');
      expect(apiMock.addCompletedDay).toHaveBeenCalledTimes(1);
    });
  });

  describe('auto-mark effect', () => {
    it('marks today as done once daily reps reach the plan target', async () => {
      // We need a browser PLATFORM_ID for the effect to run. But
      // that would also start the setInterval — so we control the
      // setup carefully and resetTestingModule at the end.
      const today = toBerlinIsoDate(new Date());
      const target = PLAN.days[1].targetReps;
      const startDate = toBerlinIsoDate(new Date(Date.now() - 86_400_000));
      const initial: UserTrainingPlan = {
        userId: 'u1',
        planId: PLAN.id,
        startDate,
        status: 'active',
        completedDays: [],
      };
      const stream = new BehaviorSubject<UserTrainingPlan | null>(initial);
      const liveEntries = signal<PushupRecord[]>([]);
      const apiMock = {
        getActivePlan: vitest.fn(() => stream.asObservable()),
        setPlan: vitest.fn(),
        updatePlan: vitest.fn(
          (_uid: string, patch: Partial<UserTrainingPlan>) => {
            const next = { ...stream.value!, ...patch };
            stream.next(next);
            return new BehaviorSubject(next).asObservable();
          }
        ),
        addCompletedDay: vitest.fn((_uid: string, dayIndex: number) => {
          const cur = stream.value!;
          stream.next({
            ...cur,
            completedDays: [...cur.completedDays, dayIndex].sort(
              (x, y) => x - y
            ),
          });
          return of(void 0);
        }),
        removeCompletedDay: vitest.fn(() => of(void 0)),
      };
      const statsApiMock = {
        createPushup: vitest.fn(),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: UserTrainingPlanApiService, useValue: apiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          {
            provide: LiveDataStore,
            useValue: {
              entries: liveEntries,
              connected: signal(true),
              updateTick: signal(0),
            },
          },
          {
            provide: UserContextService,
            useValue: { userIdSafe: () => 'u1' },
          },
        ],
      });
      TestBed.inject(TrainingPlanStore);
      await flush();

      // Initially no entries — the effect should not have fired.
      expect(apiMock.addCompletedDay).not.toHaveBeenCalled();

      // Simulate the dashboard logging today's reps.
      liveEntries.set([
        {
          _id: 'x',
          timestamp: `${today}T10:00:00.000+02:00`,
          reps: target,
          source: 'web',
        },
      ]);
      await flush();

      expect(apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);
      // No pushup created — the auto-mark NEVER writes a new entry.
      expect(statsApiMock.createPushup).not.toHaveBeenCalled();

      // Tear down the implicit setInterval started by withHooks.
      TestBed.resetTestingModule();
    });
  });

  it('unmarkDayDone removes a day from completedDays', async () => {
    const today = toBerlinIsoDate(new Date());
    const { store, mocks } = setup({
      userId: 'u1',
      planId: PLAN.id,
      startDate: today,
      status: 'active',
      completedDays: [1, 2, 3],
    });
    await flush();

    await store.unmarkDayDone(2);
    await flush();

    expect(mocks.apiMock.removeCompletedDay).toHaveBeenCalledWith('u1', 2);
  });
});
