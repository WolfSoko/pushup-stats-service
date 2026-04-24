import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { UserConfigStore } from './user-config.store';
import { UserConfigApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import { UserConfigUpdate } from '@pu-stats/models';

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
});
