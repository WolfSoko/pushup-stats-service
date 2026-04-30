import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import { UserTrainingPlanApiService } from '@pu-stats/data-access';
import {
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
  };
  stream: BehaviorSubject<UserTrainingPlan | null>;
  current: UserTrainingPlan | null;
}

describe('TrainingPlanStore', () => {
  const userId = signal<string>('u1');

  function setup(initial: UserTrainingPlan | null = null): {
    store: InstanceType<typeof TrainingPlanStore>;
    mocks: Mocks;
  } {
    const stream = new BehaviorSubject<UserTrainingPlan | null>(initial);
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
            mocks.current = { ...(mocks.current as UserTrainingPlan), ...patch };
            stream.next(mocks.current);
            return new BehaviorSubject(mocks.current).asObservable();
          }
        ),
      },
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        // Treat tests as SSR so the midnight-tick setInterval doesn't
        // start (otherwise it would leak across `resetTestingModule`).
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: UserTrainingPlanApiService, useValue: mocks.apiMock },
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

  it('exposes today\'s target reps once a plan is active', async () => {
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

    expect(mocks.apiMock.updatePlan).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ completedDays: [1] })
    );
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
    const yesterday = toBerlinIsoDate(
      new Date(Date.now() - 86_400_000)
    );

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

    expect(mocks.apiMock.updatePlan).not.toHaveBeenCalled();
    expect(store.activePlan()?.completedDays).toEqual([]);
    // Reference unused param to keep tsc happy.
    void todayIso;
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

    expect(mocks.apiMock.updatePlan).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ completedDays: [1, 3] })
    );
  });
});
