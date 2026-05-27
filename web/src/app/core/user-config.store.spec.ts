import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { UserConfigStore } from './user-config.store';
import { UserConfigApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import {
  type ComplexGoals,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  UserConfig,
  UserConfigUpdate,
} from '@pu-stats/models';

describe('UserConfigStore', () => {
  const userId = signal<string>('u1');
  let currentGoal: number;

  function makeMocks() {
    currentGoal = 100;
    const apiMock = {
      getConfig: vitest.fn((uid: string) =>
        of({ userId: uid, dailyGoal: currentGoal })
      ),
      updateConfig: vitest.fn((uid: string, patch: UserConfigUpdate) => {
        if (typeof patch.dailyGoal === 'number') currentGoal = patch.dailyGoal;
        return of({ userId: uid, ...patch });
      }),
    };
    return { apiMock };
  }

  function setup(): {
    store: InstanceType<typeof UserConfigStore>;
    apiMock: ReturnType<typeof makeMocks>['apiMock'];
  } {
    const { apiMock } = makeMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: UserConfigApiService, useValue: apiMock },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => userId() },
        },
      ],
    });
    const store = TestBed.inject(UserConfigStore);
    return { store, apiMock };
  }

  async function flush(): Promise<void> {
    TestBed.tick();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    TestBed.tick();
  }

  it('Given userId is set, When the store initializes, Then dailyGoal reflects loaded config', async () => {
    const { store } = setup();
    await flush();
    expect(store.dailyGoal()).toBe(100);
  });

  it('Given config is saved with new dailyGoal, When save resolves, Then dailyGoal signal emits the new value (reactive regression)', async () => {
    const { store, apiMock } = setup();
    await flush();

    await store.save({ dailyGoal: 137 });
    await flush();

    expect(apiMock.updateConfig).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ dailyGoal: 137 })
    );
    expect(store.dailyGoal()).toBe(137);
  });

  it('Given userId is empty, When the store initializes, Then dailyGoal is 0 and the API is not called', async () => {
    userId.set('');
    const { store, apiMock } = setup();
    await flush();

    expect(apiMock.getConfig).not.toHaveBeenCalled();
    expect(store.dailyGoal()).toBe(0);

    userId.set('u1'); // restore for other tests
  });

  it('Given only legacy numeric goals on the doc, Then goals() migrates them to single pushup-reps entries', async () => {
    const stream = new BehaviorSubject<UserConfig>({
      userId: 'u1',
      dailyGoal: 30,
      weeklyGoal: 150,
      monthlyGoal: 600,
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UserConfigApiService,
          useValue: {
            getConfig: vitest.fn(() => stream.asObservable()),
            updateConfig: vitest.fn(),
          },
        },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => 'u1' },
        },
      ],
    });
    const store = TestBed.inject(UserConfigStore);
    await flush();

    const goals = store.goals();
    expect(goals.daily).toEqual([
      {
        id: 'legacy-daily',
        exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
        target: 30,
        measurement: 'reps',
        unit: 'reps',
      },
    ]);
    expect(goals.weekly?.[0].target).toBe(150);
    expect(goals.monthly?.[0].target).toBe(600);
    // Legacy derived single-numbers still match the rep-sum.
    expect(store.dailyGoal()).toBe(30);
    expect(store.weeklyGoal()).toBe(150);
    expect(store.monthlyGoal()).toBe(600);
  });

  it('Given complex goals on the doc, Then they take precedence over the legacy numeric fields', async () => {
    const stream = new BehaviorSubject<UserConfig>({
      userId: 'u1',
      // Stale legacy field that no longer matches the new structure.
      dailyGoal: 10,
      goals: {
        daily: [
          {
            id: 'a',
            exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
            target: 50,
            measurement: 'reps',
            unit: 'reps',
            weekdays: [1, 3, 5],
          },
          {
            id: 'b',
            exerciseId: 'legs.squats',
            target: 30,
            measurement: 'reps',
            unit: 'reps',
          },
          {
            id: 'c',
            exerciseId: 'plank.standard',
            target: 60,
            measurement: 'time',
            unit: 's',
          },
        ],
      },
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UserConfigApiService,
          useValue: {
            getConfig: vitest.fn(() => stream.asObservable()),
            updateConfig: vitest.fn(),
          },
        },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => 'u1' },
        },
      ],
    });
    const store = TestBed.inject(UserConfigStore);
    await flush();

    expect(store.dailyGoalEntries()).toHaveLength(3);
    // Sum of rep-based targets only — the 60s plank is excluded.
    expect(store.dailyGoal()).toBe(80);
  });

  it('Given saveGoals(...), Then it writes goals plus the derived legacy single-numbers in a single patch', async () => {
    const { store, apiMock } = setup();
    await flush();

    const complex: ComplexGoals = {
      daily: [
        {
          id: 'a',
          exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
          target: 40,
          measurement: 'reps',
          unit: 'reps',
        },
        {
          id: 'b',
          exerciseId: 'legs.squats',
          target: 20,
          measurement: 'reps',
          unit: 'reps',
        },
      ],
      weekly: [],
      monthly: [],
    };
    await store.saveGoals(complex);
    await flush();

    expect(apiMock.updateConfig).toHaveBeenCalledTimes(1);
    const patch = apiMock.updateConfig.mock.calls[0][1];
    expect(patch.goals).toEqual({
      daily: complex.daily,
      weekly: [],
      monthly: [],
    });
    expect(patch.dailyGoal).toBe(60);
    expect(patch.weeklyGoal).toBe(0);
    expect(patch.monthlyGoal).toBe(0);
  });

  it('Given the API observable emits a new config, When no manual reload is called, Then the store reflects the update (live Firestore listener)', async () => {
    // Given — the API exposes a long-lived stream (as `docData()` does in
    // production). The store consumes it via `rxResource` and must propagate
    // every emission to the dailyGoal signal without an explicit `.reload()`.
    const stream = new BehaviorSubject<UserConfig>({
      userId: 'u1',
      dailyGoal: 100,
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UserConfigApiService,
          useValue: {
            getConfig: vitest.fn(() => stream.asObservable()),
            updateConfig: vitest.fn(),
          },
        },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => 'u1' },
        },
      ],
    });
    const store = TestBed.inject(UserConfigStore);
    await flush();
    expect(store.dailyGoal()).toBe(100);

    // When — a fresh emission arrives on the same stream (e.g. another tab
    // wrote to userConfigs/u1, or the Cloud Function rewrote it).
    stream.next({ userId: 'u1', dailyGoal: 222 });
    await flush();

    // Then — the signal updates without `store.reload()` ever being called.
    expect(store.dailyGoal()).toBe(222);
  });
});
