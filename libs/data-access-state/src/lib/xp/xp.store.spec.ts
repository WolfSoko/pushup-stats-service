import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth, authState } from '@angular/fire/auth';
import { XpApiService } from '@pu-stats/data-access';
import type { UserXp } from '@pu-stats/models';
import { BehaviorSubject, of } from 'rxjs';
import { XpStore } from './xp.store';

jest.mock('@angular/fire/auth', () => ({
  Auth: class {},
  authState: jest.fn(),
}));
jest.mock('@pu-stats/data-access', () => ({
  XpApiService: class {},
}));

const USER_XP: UserXp = {
  userId: 'u1',
  total: 450,
  level: 3,
  dailyXp: 0,
  dailyKey: '2026-09-24',
  weeklyXp: 0,
  weeklyKey: '2026-W39',
  monthlyXp: 0,
  monthlyKey: '2026-09',
  byExercise: { pushup: 450 },
  version: 1,
};

function setup(platform: 'browser' | 'server' = 'browser') {
  const api = {
    watchConfig: jest.fn(() => of({ rates: { pushup: 2 } })),
    watchUserXp: jest.fn(() => of(USER_XP)),
    watchLedger: jest.fn(() => of(new Map([['e1', 7]]))),
  };
  const user$ = new BehaviorSubject<{ uid: string } | null>({ uid: 'u1' });
  jest.mocked(authState).mockReturnValue(user$ as never);
  TestBed.configureTestingModule({
    providers: [
      XpStore,
      { provide: PLATFORM_ID, useValue: platform },
      { provide: Auth, useValue: {} },
      { provide: XpApiService, useValue: api },
    ],
  });
  const store = TestBed.inject(XpStore);
  TestBed.tick();
  return { store, api, user$ };
}

describe('XpStore', () => {
  it('should mirror the aggregate and derive the level progress', () => {
    // given / when
    const { store } = setup();

    // then
    expect(store.loaded()).toBe(true);
    expect(store.totalXp()).toBe(450);
    expect(store.progress().level).toBe(3);
  });

  it('should preview XP with the admin rate', () => {
    // given
    const { store } = setup();

    // when
    const xp = store.previewXp({ exerciseId: 'pushup', reps: 10 });

    // then
    expect(xp).toBe(20);
  });

  it('should prefer the booked ledger value over a recomputation', () => {
    // given
    const { store } = setup();

    // then
    expect(store.xpOfEntry('e1', { exerciseId: 'pushup', reps: 10 })).toBe(7);
    expect(store.xpOfEntry('e2', { exerciseId: 'pushup', reps: 10 })).toBe(20);
  });

  it('should clear the user state on sign-out', () => {
    // given
    const { store, user$ } = setup();

    // when
    user$.next(null);
    TestBed.tick();

    // then
    expect(store.userXp()).toBeNull();
    expect(store.ledger().size).toBe(0);
  });

  it('should not subscribe on the server', () => {
    // given / when
    const { store, api } = setup('server');

    // then
    expect(api.watchConfig).not.toHaveBeenCalled();
    expect(store.totalXp()).toBe(0);
  });
});
