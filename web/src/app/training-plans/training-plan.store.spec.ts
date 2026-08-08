import { TestBed } from '@angular/core/testing';
import { computed, PLATFORM_ID, signal, type Signal } from '@angular/core';
import { BehaviorSubject, from, map, of, Subject } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import {
  ExerciseFirestoreService,
  StatsApiService,
  UserTrainingPlanApiService,
} from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  ExerciseEntry,
  ExerciseEntryCreate,
  findPlanById,
  PushupCreate,
  PushupRecord,
  TrainingPlan,
  TRAINING_PLANS,
  UserTrainingPlan,
} from '@pu-stats/models';
import { appendLocalOffset, toBerlinIsoDate } from '@pu-stats/date';
import { TRAINING_PLAN_LOOKUP, TrainingPlanStore } from './training-plan.store';

const PLAN = TRAINING_PLANS.find(
  (p) => p.id === 'challenge-30d-v1'
) as (typeof TRAINING_PLANS)[number];

/**
 * A curated plan the shipped catalog does NOT contain, used to drive the
 * non-pushup `logPlanDay` write path. Day 2 is a reps-measured catalog
 * exercise (`legs.squats`) so it routes through `ExerciseFirestoreService`.
 * Surrounding days (a day-1 main + rest days) give `currentPlanDayIndex`
 * room to resolve day 2 as "today" when the plan starts one day ago.
 */
const SQUATS_PLAN: TrainingPlan = {
  id: 'squats-plan',
  slug: 'squats-plan',
  title: 'Squats Plan',
  summary: 'Test-only plan with a non-pushup day.',
  level: 'beginner',
  totalDays: 4,
  days: [
    {
      dayIndex: 1,
      kind: 'main',
      targetReps: 20,
      sets: [20],
      description: 'd1',
    },
    {
      dayIndex: 2,
      kind: 'main',
      targetReps: 30,
      sets: [10, 10, 10],
      exerciseId: 'legs.squats',
      description: 'Squats day',
    },
    { dayIndex: 3, kind: 'rest', targetReps: 0, description: 'rest' },
    { dayIndex: 4, kind: 'rest', targetReps: 0, description: 'rest' },
  ],
};

/** Time-measured (plank) day — cannot be honored with a reps payload. */
const PLANK_PLAN: TrainingPlan = {
  id: 'plank-plan',
  slug: 'plank-plan',
  title: 'Plank Plan',
  summary: 'Test-only plan with a time-measured day.',
  level: 'beginner',
  totalDays: 4,
  days: [
    {
      dayIndex: 1,
      kind: 'main',
      targetReps: 20,
      sets: [20],
      description: 'd1',
    },
    {
      dayIndex: 2,
      kind: 'main',
      targetReps: 60,
      exerciseId: 'plank.standard',
      description: 'Plank day',
    },
    { dayIndex: 3, kind: 'rest', targetReps: 0, description: 'rest' },
    { dayIndex: 4, kind: 'rest', targetReps: 0, description: 'rest' },
  ],
};

/**
 * Multi-exercise circuit day: pushups + a reps-measured and a
 * time-measured accessory, each individually trackable.
 */
const CIRCUIT_PLAN: TrainingPlan = {
  id: 'circuit-plan',
  slug: 'circuit-plan',
  title: 'Circuit Plan',
  summary: 'Test-only plan with a structured multi-exercise day.',
  level: 'beginner',
  totalDays: 4,
  days: [
    {
      dayIndex: 1,
      kind: 'main',
      targetReps: 20,
      sets: [20],
      description: 'd1',
    },
    {
      dayIndex: 2,
      kind: 'main',
      targetReps: 30,
      sets: [10, 10, 10],
      description: 'Zirkel',
      exercises: [
        { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
        { exerciseId: 'legs.squats', target: 45, sets: [15, 15, 15] },
        { exerciseId: 'plank.standard', target: 90, sets: [30, 30, 30] },
      ],
    },
    { dayIndex: 3, kind: 'rest', targetReps: 0, description: 'rest' },
    // Day 4 is still in the future when day 2 is today — a real
    // exercise-bearing day, so the future-day guard is what stops a
    // write rather than the item simply not resolving.
    {
      dayIndex: 4,
      kind: 'main',
      targetReps: 30,
      sets: [10, 10, 10],
      description: 'Zirkel',
      exercises: [
        { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
        { exerciseId: 'legs.squats', target: 45, sets: [15, 15, 15] },
      ],
    },
  ],
};

/** HIIT-style interval day: ticked off by hand, one exercise unquantified. */
const HIIT_PLAN: TrainingPlan = {
  id: 'hiit-plan',
  slug: 'hiit-plan',
  title: 'HIIT Plan',
  summary: 'Test-only plan with a check-off day.',
  level: 'beginner',
  totalDays: 4,
  days: [
    {
      dayIndex: 1,
      kind: 'main',
      targetReps: 20,
      sets: [20],
      description: 'd1',
    },
    {
      dayIndex: 2,
      kind: 'main',
      targetReps: 30,
      sets: [10, 10, 10],
      description: 'HIIT',
      completion: 'checkoff',
      exercises: [
        { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
        { exerciseId: 'cardio.burpees', target: 0 },
      ],
    },
    { dayIndex: 3, kind: 'rest', targetReps: 0, description: 'rest' },
    { dayIndex: 4, kind: 'rest', targetReps: 0, description: 'rest' },
  ],
};

const circuitLookup = (id: string): TrainingPlan | null =>
  id === 'circuit-plan' ? CIRCUIT_PLAN : findPlanById(id);
const hiitLookup = (id: string): TrainingPlan | null =>
  id === 'hiit-plan' ? HIIT_PLAN : findPlanById(id);

/** Active plan whose day 2 maps to today, for the multi-exercise plans. */
function planStartedYesterday(planId: string): UserTrainingPlan {
  return {
    userId: 'u1',
    planId,
    startDate: toBerlinIsoDate(new Date(Date.now() - 86_400_000)),
    status: 'active',
    completedDays: [],
  };
}

/**
 * Lookup seam value: resolve the test-only plans by id, otherwise defer to
 * the real catalog so unrelated ids keep working.
 */
const squatsLookup = (id: string): TrainingPlan | null =>
  id === 'squats-plan' ? SQUATS_PLAN : findPlanById(id);
const plankLookup = (id: string): TrainingPlan | null =>
  id === 'plank-plan' ? PLANK_PLAN : findPlanById(id);

/** `UserTrainingPlan` whose day 2 (`legs.squats`) maps to today. */
const squatsUserPlan: UserTrainingPlan = {
  userId: 'u1',
  planId: 'squats-plan',
  startDate: toBerlinIsoDate(new Date(Date.now() - 86_400_000)),
  status: 'active',
  completedDays: [],
};

/**
 * Local ISO date the store backfills a plan day onto. Mirrors the store's
 * `_planDayDate`: `startDate` parsed as local midnight + `(dayIndex - 1)` days,
 * formatted in the test machine's local zone. Used to assert the noon-offset
 * timestamp `createEntry` receives without coupling to the runner's timezone.
 */
function planDayDateIso(startDate: string, dayIndex: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + (dayIndex - 1));
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

interface Mocks {
  apiMock: {
    getActivePlan: ReturnType<typeof vitest.fn>;
    setPlan: ReturnType<typeof vitest.fn>;
    updatePlan: ReturnType<typeof vitest.fn>;
    addCompletedDay: ReturnType<typeof vitest.fn>;
    removeCompletedDay: ReturnType<typeof vitest.fn>;
    addCompletedItems: ReturnType<typeof vitest.fn>;
    removeCompletedItems: ReturnType<typeof vitest.fn>;
    addSkippedDay: ReturnType<typeof vitest.fn>;
    removeSkippedDay: ReturnType<typeof vitest.fn>;
    jumpToDay: ReturnType<typeof vitest.fn>;
  };
  statsApiMock: {
    createPushup: ReturnType<typeof vitest.fn>;
  };
  exerciseApiMock: {
    createEntry: ReturnType<typeof vitest.fn>;
    deleteEntry: ReturnType<typeof vitest.fn>;
  };
  liveMock: {
    exerciseEntries: Signal<ExerciseEntry[]>;
    connected: ReturnType<typeof signal<boolean>>;
    exerciseEntriesLoaded: ReturnType<typeof signal<boolean>>;
    updateTick: ReturnType<typeof signal<number>>;
  };
  stream: BehaviorSubject<UserTrainingPlan | null>;
  current: UserTrainingPlan | null;
}

describe('TrainingPlanStore', () => {
  const userId = signal<string>('u1');

  function setup(
    initial: UserTrainingPlan | null = null,
    initialEntries: PushupRecord[] = [],
    initialExerciseEntries: ExerciseEntry[] = [],
    planLookup?: (planId: string) => TrainingPlan | null
  ): {
    store: InstanceType<typeof TrainingPlanStore>;
    mocks: Mocks;
  } {
    const stream = new BehaviorSubject<UserTrainingPlan | null>(initial);
    const liveEntries = signal<PushupRecord[]>(initialEntries);
    const liveExerciseEntries = signal<ExerciseEntry[]>(initialExerciseEntries);
    const mocks: Mocks = {
      stream,
      current: initial,
      apiMock: {
        getActivePlan: vitest.fn(() => stream.asObservable()),
        setPlan: vitest.fn((_uid: string, plan: UserTrainingPlan) => {
          mocks.current = {
            ...plan,
            userId: _uid,
            dayActivatedAt: new Date().toISOString(),
          };
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
          const completedHas = cur.completedDays.includes(dayIndex);
          const skippedHas = (cur.skippedDays ?? []).includes(dayIndex);
          if (!completedHas || skippedHas) {
            mocks.current = {
              ...cur,
              completedDays: completedHas
                ? cur.completedDays
                : [...cur.completedDays, dayIndex].sort((x, y) => x - y),
              skippedDays: (cur.skippedDays ?? []).filter(
                (d) => d !== dayIndex
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
        addCompletedItems: vitest.fn(
          (_uid: string, itemIds: ReadonlyArray<string>) => {
            const cur = mocks.current as UserTrainingPlan;
            mocks.current = {
              ...cur,
              completedItems: Array.from(
                new Set([...(cur.completedItems ?? []), ...itemIds])
              ),
            };
            stream.next(mocks.current);
            return of(void 0);
          }
        ),
        removeCompletedItems: vitest.fn(
          (_uid: string, itemIds: ReadonlyArray<string>) => {
            const cur = mocks.current as UserTrainingPlan;
            mocks.current = {
              ...cur,
              completedItems: (cur.completedItems ?? []).filter(
                (id) => !itemIds.includes(id)
              ),
            };
            stream.next(mocks.current);
            return of(void 0);
          }
        ),
        addSkippedDay: vitest.fn((_uid: string, dayIndex: number) => {
          const cur = mocks.current as UserTrainingPlan;
          const skippedHas = (cur.skippedDays ?? []).includes(dayIndex);
          const completedHas = cur.completedDays.includes(dayIndex);
          if (!skippedHas || completedHas) {
            mocks.current = {
              ...cur,
              completedDays: cur.completedDays.filter((d) => d !== dayIndex),
              skippedDays: skippedHas
                ? (cur.skippedDays ?? [])
                : [...(cur.skippedDays ?? []), dayIndex].sort((x, y) => x - y),
            };
            stream.next(mocks.current);
          }
          return of(void 0);
        }),
        removeSkippedDay: vitest.fn((_uid: string, dayIndex: number) => {
          const cur = mocks.current as UserTrainingPlan;
          if ((cur.skippedDays ?? []).includes(dayIndex)) {
            mocks.current = {
              ...cur,
              skippedDays: (cur.skippedDays ?? []).filter(
                (d) => d !== dayIndex
              ),
            };
            stream.next(mocks.current);
          }
          return of(void 0);
        }),
        // Mirrors the production transaction: reads the current
        // completedDays/skippedDays and rewrites both startDate and
        // skippedDays in one write. Tests rely on this matching the
        // documented invariants.
        jumpToDay: vitest.fn(
          (
            _uid: string,
            args: {
              newStartDate: string;
              targetDayIndex: number;
              nonRestDaysBeforeTarget: ReadonlyArray<number>;
            }
          ) => {
            const cur = mocks.current as UserTrainingPlan;
            const completed = new Set(cur.completedDays);
            const preservedPriorSkips = (cur.skippedDays ?? []).filter(
              (idx) => idx < args.targetDayIndex && !completed.has(idx)
            );
            const newlySkipped = args.nonRestDaysBeforeTarget.filter(
              (idx) => !completed.has(idx)
            );
            const skippedDays = Array.from(
              new Set([...preservedPriorSkips, ...newlySkipped])
            ).sort((x, y) => x - y);
            mocks.current = {
              ...cur,
              startDate: args.newStartDate,
              skippedDays,
              dayActivatedAt: new Date().toISOString(),
            };
            stream.next(mocks.current);
            return of(void 0);
          }
        ),
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
      exerciseApiMock: {
        createEntry: vitest.fn((uid: string, payload: ExerciseEntryCreate) =>
          of({
            _id: 'new-ex',
            userId: uid,
            exerciseId: payload.exerciseId,
            timestamp: payload.timestamp,
            reps: payload.reps,
            sets: payload.sets,
            source: payload.source ?? 'plan',
          } satisfies ExerciseEntry)
        ),
        // Mirrors the Firestore listener: a deleted doc disappears from
        // the live mirror the store reads its progress from.
        deleteEntry: vitest.fn((id: string) => {
          liveExerciseEntries.update((list) =>
            list.filter((e) => e._id !== id)
          );
          return of({ ok: true as const });
        }),
      },
      liveMock: {
        // Post-cutover pushups are exerciseEntries (`exerciseId:'pushup'`);
        // tests still seed `initialEntries` as pushups, merged here.
        exerciseEntries: computed<ExerciseEntry[]>(() => [
          ...liveEntries().map(
            (r) => ({ ...r, exerciseId: 'pushup' }) as ExerciseEntry
          ),
          ...liveExerciseEntries(),
        ]),
        connected: signal(true),
        exerciseEntriesLoaded: signal(true),
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
        { provide: ExerciseFirestoreService, useValue: mocks.exerciseApiMock },
        { provide: LiveDataStore, useValue: mocks.liveMock },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => userId() },
        },
        ...(planLookup
          ? [{ provide: TRAINING_PLAN_LOOKUP, useValue: planLookup }]
          : []),
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

  it('does not credit a freshly-started plan with entries logged before the switch', async () => {
    // given — the clock is pinned (via an explicit UTC offset, so this is
    // deterministic regardless of the runner's own timezone) to 18:00
    // Berlin time. The previous plan's day 1 was already fulfilled that
    // morning via logged pushups; switching to `circuit-plan` (whose day
    // 1 targets 20 pushups) must not let those same reps — logged before
    // the switch — auto-fulfill the new plan's day 1 too.
    vitest.useFakeTimers({ toFake: ['Date'] });
    try {
      vitest.setSystemTime(new Date('2026-04-15T18:00:00+02:00'));
      const today = toBerlinIsoDate(new Date());
      const { store } = setup(
        {
          userId: 'u1',
          planId: 'recruit-6w-v1',
          startDate: today,
          status: 'active',
          completedDays: [1],
        },
        [],
        [
          {
            _id: 'a',
            userId: 'u1',
            exerciseId: 'pushup',
            timestamp: '2026-04-15T09:00:00+02:00',
            reps: CIRCUIT_PLAN.days[0].targetReps,
            source: 'web',
          },
        ],
        circuitLookup
      );
      await flush();

      await store.start(CIRCUIT_PLAN.id);
      await flush();

      expect(store.currentDayIndex()).toBe(1);
      const progress = store.dayProgress(1);
      expect(progress.every((p) => p.done)).toBe(false);
    } finally {
      vitest.useRealTimers();
    }
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
      const yesterdayIso = toBerlinIsoDate(new Date(Date.now() - 86_400_000));
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

      expect(mocks.exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
      const [userId, call] = mocks.exerciseApiMock.createEntry.mock.calls[0];
      expect(userId).toBe('u1');
      expect(call.exerciseId).toBe('pushup');
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
      const startDate = toBerlinIsoDate(new Date(Date.now() - 86_400_000));
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

      const [, call] = mocks.exerciseApiMock.createEntry.mock.calls[0];
      expect(call.exerciseId).toBe('pushup');
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
        addCompletedItems: vitest.fn(() => of(void 0)),
        removeCompletedItems: vitest.fn(() => of(void 0)),
      };
      const statsApiMock = { createPushup: vitest.fn() };
      const exerciseApiMock = { createEntry: vitest.fn() };
      // Pre-existing pushup entry that DOES cover the target — but the
      // exerciseEntries feed hasn't loaded yet, so we shouldn't trust it.
      const liveExerciseEntries = signal<ExerciseEntry[]>([
        {
          _id: 'existing',
          exerciseId: 'pushup',
          timestamp: `${today}T08:00:00.000+02:00`,
          reps: target,
          source: 'web',
        } as ExerciseEntry,
      ]);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: UserTrainingPlanApiService, useValue: apiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: ExerciseFirestoreService, useValue: exerciseApiMock },
          {
            provide: LiveDataStore,
            useValue: {
              exerciseEntries: liveExerciseEntries,
              connected: signal(true),
              exerciseEntriesLoaded: signal(false),
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

    it("should return 'not-ready' for a non-pushup day when exerciseEntries haven't loaded (no writes)", async () => {
      // given — a browser-context squats plan whose day 2 maps to today.
      // `connected` (pushup-only) is true, but the exerciseEntries mirror
      // hasn't delivered its first snapshot yet, so trusting it would
      // read empty history and duplicate-write.
      const stream = new BehaviorSubject<UserTrainingPlan | null>(
        squatsUserPlan
      );
      const apiMock = {
        getActivePlan: vitest.fn(() => stream.asObservable()),
        setPlan: vitest.fn(),
        updatePlan: vitest.fn(),
        addCompletedDay: vitest.fn(() => of(void 0)),
        removeCompletedDay: vitest.fn(() => of(void 0)),
        addCompletedItems: vitest.fn(() => of(void 0)),
        removeCompletedItems: vitest.fn(() => of(void 0)),
      };
      const statsApiMock = { createPushup: vitest.fn() };
      const exerciseApiMock = { createEntry: vitest.fn() };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: UserTrainingPlanApiService, useValue: apiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: ExerciseFirestoreService, useValue: exerciseApiMock },
          {
            provide: LiveDataStore,
            useValue: {
              exerciseEntries: signal<ExerciseEntry[]>([]),
              connected: signal(true),
              exerciseEntriesLoaded: signal(false),
              updateTick: signal(0),
            },
          },
          { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
          { provide: TRAINING_PLAN_LOOKUP, useValue: squatsLookup },
        ],
      });
      const store = TestBed.inject(TrainingPlanStore);
      await flush();

      // when
      const result = await store.logPlanDay(2);
      await flush();

      // then — the non-pushup readiness guard rejects the write
      expect(result).toBe('not-ready');
      expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
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
        addCompletedItems: vitest.fn(() => of(void 0)),
        removeCompletedItems: vitest.fn(() => of(void 0)),
      };
      const statsApiMock = { createPushup: vitest.fn() };
      const exerciseApiMock = {
        createEntry: vitest.fn(() => from(firstWrite).pipe(map(() => ({})))),
      };
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
          { provide: ExerciseFirestoreService, useValue: exerciseApiMock },
          {
            provide: LiveDataStore,
            useValue: {
              exerciseEntries: signal<ExerciseEntry[]>([]),
              connected: signal(true),
              exerciseEntriesLoaded: signal(true),
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
      expect(exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);

      releaseFirst();
      const firstResult = await firstPromise;
      await flush();
      expect(firstResult).toBe('logged');
      expect(apiMock.addCompletedDay).toHaveBeenCalledTimes(1);
    });

    it('should leave the pushup path unchanged', async () => {
      // given — a real pushup plan day 2 (no exerciseId)
      const yesterdayIso = toBerlinIsoDate(new Date(Date.now() - 86_400_000));
      const { store, mocks } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: yesterdayIso,
        status: 'active',
        completedDays: [],
      });
      await flush();

      // when
      await store.logPlanDay(2);
      await flush();

      // then — pushup routes through createEntry (exerciseId:'pushup'); legacy createPushup is not called
      expect(mocks.exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
      expect(mocks.exerciseApiMock.createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ exerciseId: 'pushup' })
      );
      expect(mocks.statsApiMock.createPushup).not.toHaveBeenCalled();
    });

    it('should log a non-pushup plan day via createEntry once and mark it done', async () => {
      // given — a non-pushup (squats) plan whose day 2 maps to today
      const { store, mocks } = setup(squatsUserPlan, [], [], squatsLookup);
      await flush();

      // when
      const result = await store.logPlanDay(2);
      await flush();

      // then — the reps-measured day routes through createEntry, not createPushup
      expect(mocks.exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
      expect(mocks.exerciseApiMock.createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          exerciseId: 'legs.squats',
          reps: 30,
          sets: [10, 10, 10],
          source: 'plan',
        })
      );
      expect(mocks.statsApiMock.createPushup).not.toHaveBeenCalled();
      expect(mocks.apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);
      expect(result).toBe('logged');
      // Backfilled at noon on the plan day's calendar date.
      const call = mocks.exerciseApiMock.createEntry.mock.calls[0][1];
      expect(call.timestamp).toBe(
        appendLocalOffset(
          `${planDayDateIso(squatsUserPlan.startDate, 2)}T12:00`
        )
      );
    });

    it('should return already-logged when exerciseEntries already cover the non-pushup day', async () => {
      // given — today already has 30 squats logged in the exerciseEntries mirror
      const todayIso = toBerlinIsoDate(new Date());
      const { store, mocks } = setup(
        squatsUserPlan,
        [],
        [
          {
            _id: 'sq',
            userId: 'u1',
            exerciseId: 'legs.squats',
            timestamp: `${todayIso}T08:00:00.000+02:00`,
            reps: 30,
            source: 'web',
          },
        ],
        squatsLookup
      );
      await flush();

      // when
      const result = await store.logPlanDay(2);
      await flush();

      // then — no write, but the day is still marked done
      expect(mocks.exerciseApiMock.createEntry).not.toHaveBeenCalled();
      expect(mocks.apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);
      expect(result).toBe('already-logged');
    });

    it('should top up only the remainder for a partially-logged non-pushup day', async () => {
      // given — today already has 10 of the 30 squats logged
      const todayIso = toBerlinIsoDate(new Date());
      const { store, mocks } = setup(
        squatsUserPlan,
        [],
        [
          {
            _id: 'sq',
            userId: 'u1',
            exerciseId: 'legs.squats',
            timestamp: `${todayIso}T08:00:00.000+02:00`,
            reps: 10,
            source: 'web',
          },
        ],
        squatsLookup
      );
      await flush();

      // when
      const result = await store.logPlanDay(2);
      await flush();

      // then — only the missing 20 reps are written, as a single set
      expect(mocks.exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
      const call = mocks.exerciseApiMock.createEntry.mock.calls[0][1];
      expect(call.reps).toBe(20);
      expect(call.sets).toEqual([20]);
      expect(result).toBe('logged');
    });

    it('should log a time-measured plan day as a duration entry', async () => {
      // given — a plan whose day 2 is the time-measured plank exercise
      const plankUserPlan: UserTrainingPlan = {
        userId: 'u1',
        planId: 'plank-plan',
        startDate: toBerlinIsoDate(new Date(Date.now() - 86_400_000)),
        status: 'active',
        completedDays: [],
      };
      const { store, mocks } = setup(plankUserPlan, [], [], plankLookup);
      await flush();

      // when
      const result = await store.logPlanDay(2);
      await flush();

      // then — the hold goes in as durationSec/intervals, not reps/sets
      expect(mocks.exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
      const call = mocks.exerciseApiMock.createEntry.mock.calls[0][1];
      expect(call.exerciseId).toBe('plank.standard');
      expect(call.durationSec).toBe(60);
      expect(call.reps).toBeUndefined();
      expect(mocks.apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);
      expect(result).toBe('logged');
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
            const current = stream.value ?? initial;
            const next = { ...current, ...patch };
            stream.next(next);
            return new BehaviorSubject(next).asObservable();
          }
        ),
        addCompletedDay: vitest.fn((_uid: string, dayIndex: number) => {
          const cur = stream.value ?? initial;
          stream.next({
            ...cur,
            completedDays: [...cur.completedDays, dayIndex].sort(
              (x, y) => x - y
            ),
          });
          return of(void 0);
        }),
        removeCompletedDay: vitest.fn(() => of(void 0)),
        addCompletedItems: vitest.fn(() => of(void 0)),
        removeCompletedItems: vitest.fn(() => of(void 0)),
      };
      const statsApiMock = {
        createPushup: vitest.fn(),
      };
      const exerciseApiMock = { createEntry: vitest.fn() };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: UserTrainingPlanApiService, useValue: apiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: ExerciseFirestoreService, useValue: exerciseApiMock },
          {
            provide: LiveDataStore,
            useValue: {
              // Pushups are surfaced on the exerciseEntries feed post-cutover.
              exerciseEntries: computed<ExerciseEntry[]>(() =>
                liveEntries().map(
                  (r) => ({ ...r, exerciseId: 'pushup' }) as ExerciseEntry
                )
              ),
              connected: signal(true),
              exerciseEntriesLoaded: signal(true),
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

    it('should auto-mark a non-pushup day once exerciseEntries reach the target', async () => {
      // given — a browser-context store on the squats plan (day 2 = today),
      // with the exerciseEntries mirror initially empty
      const today = toBerlinIsoDate(new Date());
      const stream = new BehaviorSubject<UserTrainingPlan | null>(
        squatsUserPlan
      );
      const liveExerciseEntries = signal<ExerciseEntry[]>([]);
      const apiMock = {
        getActivePlan: vitest.fn(() => stream.asObservable()),
        setPlan: vitest.fn(),
        updatePlan: vitest.fn(),
        addCompletedDay: vitest.fn((_uid: string, dayIndex: number) => {
          const cur = stream.value ?? squatsUserPlan;
          stream.next({
            ...cur,
            completedDays: [...cur.completedDays, dayIndex].sort(
              (x, y) => x - y
            ),
          });
          return of(void 0);
        }),
        removeCompletedDay: vitest.fn(() => of(void 0)),
        addCompletedItems: vitest.fn(() => of(void 0)),
        removeCompletedItems: vitest.fn(() => of(void 0)),
      };
      const statsApiMock = { createPushup: vitest.fn() };
      const exerciseApiMock = { createEntry: vitest.fn() };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: UserTrainingPlanApiService, useValue: apiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: ExerciseFirestoreService, useValue: exerciseApiMock },
          {
            provide: LiveDataStore,
            useValue: {
              entries: signal<PushupRecord[]>([]),
              exerciseEntries: liveExerciseEntries,
              connected: signal(true),
              exerciseEntriesLoaded: signal(true),
              updateTick: signal(0),
            },
          },
          { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
          { provide: TRAINING_PLAN_LOOKUP, useValue: squatsLookup },
        ],
      });
      TestBed.inject(TrainingPlanStore);
      await flush();

      // Initially no entries — the effect should not have fired.
      expect(apiMock.addCompletedDay).not.toHaveBeenCalled();

      // when — the squats mirror reaches the day-2 target via an external log
      liveExerciseEntries.set([
        {
          _id: 'sq',
          userId: 'u1',
          exerciseId: 'legs.squats',
          timestamp: `${today}T10:00:00.000+02:00`,
          reps: 30,
          source: 'web',
        },
      ]);
      await flush();

      // then — the day is flagged done with no write of its own
      expect(apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);
      expect(exerciseApiMock.createEntry).not.toHaveBeenCalled();
      expect(statsApiMock.createPushup).not.toHaveBeenCalled();

      // Tear down the implicit setInterval started by withHooks.
      TestBed.resetTestingModule();
    });
  });

  describe('skipDay / unskipDay', () => {
    it('skipDay records the index in skippedDays', async () => {
      const today = toBerlinIsoDate(new Date());
      const { store, mocks } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        completedDays: [],
      });
      await flush();

      // Day 2 is a non-rest day in challenge-30d.
      await store.skipDay(2);
      await flush();

      expect(mocks.apiMock.addSkippedDay).toHaveBeenCalledWith('u1', 2);
      expect(store.activePlan()?.skippedDays).toContain(2);
    });

    it('skipDay removes the index from completedDays so a day is in at most one array', async () => {
      const today = toBerlinIsoDate(new Date());
      const { store } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        completedDays: [2, 3],
      });
      await flush();

      await store.skipDay(2);
      await flush();

      expect(store.activePlan()?.completedDays).not.toContain(2);
      expect(store.activePlan()?.skippedDays).toContain(2);
    });

    it('skipDay is a no-op for rest days', async () => {
      const today = toBerlinIsoDate(new Date());
      const { store, mocks } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        completedDays: [],
      });
      await flush();

      const restDay = PLAN.days.find((d) => d.kind === 'rest');
      if (!restDay) throw new Error('catalog invariant: rest day exists');

      await store.skipDay(restDay.dayIndex);
      await flush();

      expect(mocks.apiMock.addSkippedDay).not.toHaveBeenCalled();
    });

    it('unskipDay removes the index from skippedDays', async () => {
      const today = toBerlinIsoDate(new Date());
      const { store, mocks } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        completedDays: [],
        skippedDays: [2, 3],
      });
      await flush();

      await store.unskipDay(2);
      await flush();

      expect(mocks.apiMock.removeSkippedDay).toHaveBeenCalledWith('u1', 2);
      expect(store.activePlan()?.skippedDays).toEqual([3]);
    });

    it('marking a previously-skipped day done auto-unskips it', async () => {
      const today = toBerlinIsoDate(new Date());
      const { store } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        completedDays: [],
        skippedDays: [2],
      });
      await flush();

      await store.markDayDone(2);
      await flush();

      // The mock for addCompletedDay mirrors the API: it strips the
      // index from skippedDays so the invariant holds.
      expect(store.activePlan()?.skippedDays).not.toContain(2);
      expect(store.activePlan()?.completedDays).toContain(2);
    });
  });

  describe('completionPercent with skippedDays', () => {
    it('excludes skipped days from the denominator', async () => {
      const today = toBerlinIsoDate(new Date());
      const allNonRest = PLAN.days
        .filter((d) => d.kind !== 'rest')
        .map((d) => d.dayIndex);
      const skipIdx = allNonRest[0];
      const completedRest = allNonRest.slice(1);

      const { store } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        completedDays: completedRest,
        skippedDays: [skipIdx],
      });
      await flush();

      // All remaining required days completed → 100%.
      expect(store.completionPercent()).toBe(100);
    });
  });

  describe('jumpToDay', () => {
    it('re-anchors startDate so today maps to the target day', async () => {
      // Start a 30-day plan today, then jump to day 8.
      const today = toBerlinIsoDate(new Date());
      const { store, mocks } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        completedDays: [],
      });
      await flush();
      expect(store.currentDayIndex()).toBe(1);

      await store.jumpToDay(8);
      await flush();

      expect(mocks.apiMock.jumpToDay).toHaveBeenCalled();
      // The new startDate should make currentDayIndex return 8.
      expect(store.currentDayIndex()).toBe(8);
    });

    it('marks intervening non-rest, non-completed days as skipped', async () => {
      const today = toBerlinIsoDate(new Date());
      const { store } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        // Day 2 already done — should NOT end up skipped.
        completedDays: [2],
      });
      await flush();

      await store.jumpToDay(8);
      await flush();

      const skipped = new Set(store.activePlan()?.skippedDays ?? []);
      // Day 2 stays completed.
      expect(skipped.has(2)).toBe(false);
      expect(store.activePlan()?.completedDays).toContain(2);
      // Every other non-rest day in 1..7 should be skipped.
      for (const day of PLAN.days) {
        if (day.dayIndex >= 8) break;
        if (day.kind === 'rest') continue;
        if (day.dayIndex === 2) continue;
        expect(skipped.has(day.dayIndex)).toBe(true);
      }
      // Rest days never end up in skippedDays.
      const restIndexesBefore8 = PLAN.days
        .filter((d) => d.dayIndex < 8 && d.kind === 'rest')
        .map((d) => d.dayIndex);
      for (const restIdx of restIndexesBefore8) {
        expect(skipped.has(restIdx)).toBe(false);
      }
    });

    it('drops prior skips that are now in the future after a backward jump and preserves future-completed days', async () => {
      // Start the plan so today is plan-day 12, with day 5 previously
      // skipped and day 10 previously completed. Jump back to day 3:
      // - day 5 is now in the future → should be removed from
      //   skippedDays so the user can re-do it,
      // - day 10 stays completed even though it's now in the future
      //   (jumpToDay never strips completedDays).
      const startDate = toBerlinIsoDate(new Date(Date.now() - 11 * 86_400_000));
      const { store } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate,
        status: 'active',
        completedDays: [10],
        skippedDays: [5],
      });
      await flush();
      expect(store.currentDayIndex()).toBe(12);

      await store.jumpToDay(3);
      await flush();

      const skipped = new Set(store.activePlan()?.skippedDays ?? []);
      expect(skipped.has(5)).toBe(false);
      // Completed days that are now in the future stay completed.
      expect(store.activePlan()?.completedDays).toContain(10);
      expect(store.currentDayIndex()).toBe(3);
    });

    it('rejects out-of-range targets', async () => {
      const today = toBerlinIsoDate(new Date());
      const { store, mocks } = setup({
        userId: 'u1',
        planId: PLAN.id,
        startDate: today,
        status: 'active',
        completedDays: [],
      });
      await flush();

      await store.jumpToDay(0);
      await store.jumpToDay(PLAN.totalDays + 1);
      await flush();

      expect(mocks.apiMock.jumpToDay).not.toHaveBeenCalled();
    });

    it('does not credit the newly-jumped-to day with entries logged before the jump', async () => {
      // given — the clock is pinned (via an explicit UTC offset, so this
      // is deterministic regardless of the runner's own timezone) to
      // 18:00 Berlin time. Day 1 is done, and its pushups were logged
      // that morning. Jumping to day 2 re-anchors startDate so day 2's
      // date becomes today — the same date those entries are stamped
      // with — but strictly *after* the jump instant (18:00).
      vitest.useFakeTimers({ toFake: ['Date'] });
      try {
        vitest.setSystemTime(new Date('2026-04-15T18:00:00+02:00'));
        const today = toBerlinIsoDate(new Date());
        const day2Target = PLAN.days[1].targetReps;
        const { store } = setup(
          {
            userId: 'u1',
            planId: PLAN.id,
            startDate: today,
            status: 'active',
            completedDays: [1],
          },
          [],
          [
            {
              _id: 'a',
              userId: 'u1',
              exerciseId: 'pushup',
              timestamp: '2026-04-15T09:00:00+02:00',
              reps: day2Target,
              source: 'web',
            },
          ]
        );
        await flush();

        await store.jumpToDay(2);
        await flush();

        // when / then — day 2 is "today" now, but the only entry dated
        // today predates the jump, so it must not fulfill day 2 for free.
        expect(store.currentDayIndex()).toBe(2);
        const progress = store.dayProgress(2);
        expect(progress.every((p) => p.done)).toBe(false);
      } finally {
        vitest.useRealTimers();
      }
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
  describe('per-exercise tracking', () => {
    /** Entry mirror helper for a given exercise on today's date. */
    function loggedToday(
      exerciseId: string,
      values: Partial<ExerciseEntry>
    ): ExerciseEntry {
      return {
        _id: `${exerciseId}-e`,
        userId: 'u1',
        exerciseId,
        timestamp: `${toBerlinIsoDate(new Date())}T08:00:00.000+02:00`,
        source: 'web',
        ...values,
      } as ExerciseEntry;
    }

    it('should expose per-exercise fulfillment for a structured day', async () => {
      // given — the squat portion of today's circuit is already logged
      const { store } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [loggedToday('legs.squats', { reps: 45 })],
        circuitLookup
      );
      await flush();

      // when
      const progress = store.dayProgress(2);

      // then
      expect(progress.map((p) => p.done)).toEqual([false, true, false]);
      expect(progress[1].fulfilledByEntries).toBe(true);
    });

    it('should log one exercise of a day without touching the others', async () => {
      // given
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [],
        circuitLookup
      );
      await flush();

      // when — log only the plank (item 2)
      const result = await store.logPlanExercise(2, 2);
      await flush();

      // then — one duration entry, day not yet complete
      expect(result).toBe('logged');
      expect(mocks.exerciseApiMock.createEntry).toHaveBeenCalledTimes(1);
      const call = mocks.exerciseApiMock.createEntry.mock.calls[0][1];
      expect(call.exerciseId).toBe('plank.standard');
      expect(call.durationSec).toBe(90);
      expect(call.intervals).toEqual([30, 30, 30]);
      expect(mocks.apiMock.addCompletedItems).toHaveBeenCalledWith('u1', [
        '2:2',
      ]);
      expect(mocks.apiMock.addCompletedDay).not.toHaveBeenCalled();
    });

    it('should log every exercise of the day and close it', async () => {
      // given
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [],
        circuitLookup
      );
      await flush();

      // when
      const result = await store.logPlanDay(2);
      await flush();

      // then — one entry per exercise, then the day is marked done
      expect(result).toBe('logged');
      expect(mocks.exerciseApiMock.createEntry).toHaveBeenCalledTimes(3);
      const written = mocks.exerciseApiMock.createEntry.mock.calls.map(
        (c) => (c[1] as ExerciseEntryCreate).exerciseId
      );
      expect(written).toEqual(['pushup', 'legs.squats', 'plank.standard']);
      expect(mocks.apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);
    });

    it('should skip exercises already covered when logging the whole day', async () => {
      // given — the squats are already in the mirror
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [loggedToday('legs.squats', { reps: 45 })],
        circuitLookup
      );
      await flush();

      // when
      await store.logPlanDay(2);
      await flush();

      // then — only the two open exercises are written
      const written = mocks.exerciseApiMock.createEntry.mock.calls.map(
        (c) => (c[1] as ExerciseEntryCreate).exerciseId
      );
      expect(written).toEqual(['pushup', 'plank.standard']);
    });

    it('should close the day once the last exercise is ticked off', async () => {
      // given — pushups and squats are logged, only the plank is open
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [
          loggedToday('pushup', { reps: 30 }),
          loggedToday('legs.squats', { reps: 45 }),
        ],
        circuitLookup
      );
      await flush();

      // when — tick the plank off by hand instead of logging it
      await store.setItemDone(2, 2, true);
      await flush();

      // then
      expect(mocks.exerciseApiMock.createEntry).not.toHaveBeenCalled();
      expect(mocks.apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);
    });

    it('should re-open the day when an exercise is un-ticked', async () => {
      // given — a day closed by ticking every exercise off
      const { store, mocks } = setup(
        planStartedYesterday('hiit-plan'),
        [],
        [],
        hiitLookup
      );
      await flush();
      await store.setItemDone(2, 0, true);
      await flush();
      await store.setItemDone(2, 1, true);
      await flush();
      expect(mocks.apiMock.addCompletedDay).toHaveBeenCalledWith('u1', 2);

      // when
      await store.setItemDone(2, 1, false);
      await flush();

      // then
      expect(mocks.apiMock.removeCompletedItems).toHaveBeenCalledWith('u1', [
        '2:1',
      ]);
      expect(mocks.apiMock.removeCompletedDay).toHaveBeenCalledWith('u1', 2);
    });

    it('should never fulfill a check-off day from logged entries', async () => {
      // given — a HIIT day whose pushup target is already covered
      const { store, mocks } = setup(
        planStartedYesterday('hiit-plan'),
        [],
        [loggedToday('pushup', { reps: 30 })],
        hiitLookup
      );
      await flush();

      // when
      const progress = store.dayProgress(2);

      // then — the day stays open until the user ticks it off
      expect(progress.every((p) => !p.done)).toBe(true);
      expect(mocks.apiMock.addCompletedDay).not.toHaveBeenCalled();
    });

    it('should tick off an unquantified check-off exercise instead of writing an entry', async () => {
      // given
      const { store, mocks } = setup(
        planStartedYesterday('hiit-plan'),
        [],
        [],
        hiitLookup
      );
      await flush();

      // when — "log" the burpee rounds the plan does not quantify
      const result = await store.logPlanExercise(2, 1);
      await flush();

      // then
      expect(result).toBe('already-logged');
      expect(mocks.exerciseApiMock.createEntry).not.toHaveBeenCalled();
      expect(mocks.apiMock.addCompletedItems).toHaveBeenCalledWith('u1', [
        '2:1',
      ]);
    });

    it('should clear the day check-offs when the day completion is undone', async () => {
      // given — a fully ticked-off HIIT day
      const { store, mocks } = setup(
        planStartedYesterday('hiit-plan'),
        [],
        [],
        hiitLookup
      );
      await flush();
      await store.logPlanDay(2);
      await flush();

      // when
      await store.unmarkDayDone(2);
      await flush();

      // then — both the day flag and its per-exercise ticks are removed
      expect(mocks.apiMock.removeCompletedDay).toHaveBeenCalledWith('u1', 2);
      expect(mocks.apiMock.removeCompletedItems).toHaveBeenCalledWith('u1', [
        '2:0',
        '2:1',
      ]);
    });

    it('should refuse per-exercise writes for a future day', async () => {
      // given — day 4 prescribes exercises but is still ahead of today
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [],
        circuitLookup
      );
      await flush();

      // when
      await store.setItemDone(4, 0, true);
      await flush();

      // then
      expect(mocks.apiMock.addCompletedItems).not.toHaveBeenCalled();
    });
  });

  describe('resetPlanExercise', () => {
    /** Entry mirror helper for one exercise on the current plan day. */
    function planEntry(
      id: string,
      exerciseId: string,
      values: Partial<ExerciseEntry>
    ): ExerciseEntry {
      return {
        _id: id,
        userId: 'u1',
        exerciseId,
        timestamp: `${toBerlinIsoDate(new Date())}T12:00:00.000+02:00`,
        source: 'plan',
        ...values,
      } as ExerciseEntry;
    }

    it('should delete the entries the plan wrote and re-open the exercise', async () => {
      // given the squats item of today's circuit was logged from the plan
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [planEntry('sq-1', 'legs.squats', { reps: 45 })],
        circuitLookup
      );
      await flush();
      expect(store.dayProgress(2)[1].done).toBe(true);

      // when the user resets it
      const result = await store.resetPlanExercise(2, 1);
      await flush();

      // then the entry is gone and the exercise is open again
      expect(result).toBe('reset');
      expect(mocks.exerciseApiMock.deleteEntry).toHaveBeenCalledWith('sq-1');
      expect(store.dayProgress(2)[1].done).toBe(false);
    });

    it('should keep entries the user logged themselves and say so', async () => {
      // given the target is covered by the user's own workout, not the plan
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [planEntry('sq-own', 'legs.squats', { reps: 45, source: 'web' })],
        circuitLookup
      );
      await flush();

      // when
      const result = await store.resetPlanExercise(2, 1);
      await flush();

      // then nothing is deleted and the caller can explain why
      expect(result).toBe('kept-entries');
      expect(mocks.exerciseApiMock.deleteEntry).not.toHaveBeenCalled();
      expect(store.dayProgress(2)[1].done).toBe(true);
    });

    it('should drop a manual tick and re-open the completed day', async () => {
      // given a day closed by ticking every exercise off
      const { store, mocks } = setup(
        planStartedYesterday('hiit-plan'),
        [],
        [],
        hiitLookup
      );
      await flush();
      await store.setItemDone(2, 0, true);
      await store.setItemDone(2, 1, true);
      await flush();
      expect(store.activePlan()?.completedDays).toContain(2);

      // when one of them is reset
      const result = await store.resetPlanExercise(2, 1);
      await flush();

      // then the tick and the day completion are both undone
      expect(result).toBe('reset');
      expect(mocks.apiMock.removeCompletedItems).toHaveBeenCalledWith('u1', [
        '2:1',
      ]);
      expect(mocks.apiMock.removeCompletedDay).toHaveBeenCalledWith('u1', 2);
      expect(store.activePlan()?.completedDays).not.toContain(2);
    });

    it('should delete only as much as the reset exercise was credited', async () => {
      // given two plan entries covering pushups twice over
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [
          planEntry('pu-1', 'pushup', { reps: 30 }),
          planEntry('pu-2', 'pushup', {
            reps: 30,
            timestamp: `${toBerlinIsoDate(new Date())}T18:00:00.000+02:00`,
          }),
        ],
        circuitLookup
      );
      await flush();

      // when the single pushup item (target 30) is reset
      await store.resetPlanExercise(2, 0);
      await flush();

      // then only the newest entry is removed — the rest stays the user's
      expect(mocks.exerciseApiMock.deleteEntry).toHaveBeenCalledTimes(1);
      expect(mocks.exerciseApiMock.deleteEntry).toHaveBeenCalledWith('pu-2');
    });

    it("should return 'not-ready' before the entry mirror has synced", async () => {
      // given a browser context whose exerciseEntries listener hasn't
      // emitted yet — deleting off pre-sync data would drop the tick and
      // leave the plan's entries behind
      const stream = new BehaviorSubject<UserTrainingPlan | null>(
        planStartedYesterday('circuit-plan')
      );
      const apiMock = {
        getActivePlan: vitest.fn(() => stream.asObservable()),
        setPlan: vitest.fn(),
        updatePlan: vitest.fn(),
        addCompletedDay: vitest.fn(() => of(void 0)),
        removeCompletedDay: vitest.fn(() => of(void 0)),
        addCompletedItems: vitest.fn(() => of(void 0)),
        removeCompletedItems: vitest.fn(() => of(void 0)),
      };
      const exerciseApiMock = {
        createEntry: vitest.fn(),
        deleteEntry: vitest.fn(),
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: UserTrainingPlanApiService, useValue: apiMock },
          { provide: StatsApiService, useValue: { createPushup: vitest.fn() } },
          { provide: ExerciseFirestoreService, useValue: exerciseApiMock },
          {
            provide: LiveDataStore,
            useValue: {
              exerciseEntries: signal<ExerciseEntry[]>([]),
              connected: signal(true),
              exerciseEntriesLoaded: signal(false),
              updateTick: signal(0),
            },
          },
          { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
          { provide: TRAINING_PLAN_LOOKUP, useValue: circuitLookup },
        ],
      });
      const store = TestBed.inject(TrainingPlanStore);
      await flush();

      // when
      const result = await store.resetPlanExercise(2, 1);
      await flush();

      // then
      expect(result).toBe('not-ready');
      expect(exerciseApiMock.deleteEntry).not.toHaveBeenCalled();
      expect(apiMock.removeCompletedItems).not.toHaveBeenCalled();
      TestBed.resetTestingModule();
    });

    it("should return 'in-flight' while a reset for the same day runs", async () => {
      // given a first reset whose delete never settles
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [planEntry('sq-1', 'legs.squats', { reps: 45 })],
        circuitLookup
      );
      await flush();
      const blocked = new Subject<{ ok: true }>();
      mocks.exerciseApiMock.deleteEntry.mockReturnValueOnce(
        blocked.asObservable()
      );

      // when a second reset for the same day starts before it finishes
      const first = store.resetPlanExercise(2, 1);
      const second = await store.resetPlanExercise(2, 1);

      // then the day lock rejects it, so nothing is deleted twice
      expect(second).toBe('in-flight');
      blocked.next({ ok: true });
      blocked.complete();
      await first;
      await flush();
      expect(mocks.exerciseApiMock.deleteEntry).toHaveBeenCalledTimes(1);
    });

    it('should refuse a reset for a future day', async () => {
      // given day 4 is still ahead of today
      const { store, mocks } = setup(
        planStartedYesterday('circuit-plan'),
        [],
        [],
        circuitLookup
      );
      await flush();

      // when
      const result = await store.resetPlanExercise(4, 0);
      await flush();

      // then
      expect(result).toBe('noop');
      expect(mocks.exerciseApiMock.deleteEntry).not.toHaveBeenCalled();
      expect(mocks.apiMock.removeCompletedItems).not.toHaveBeenCalled();
    });
  });
});
