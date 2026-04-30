// Importing `LeaderboardService` indirectly pulls in `@angular/fire/firestore`,
// whose top-level evaluation hits `fetch is not defined` under Jest. Stub the
// surface used by the service so the import succeeds. See
// docs/gotchas/testing.md → "Jest ↔ Firebase".
jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(),
  docData: jest.fn(),
  collection: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));
jest.mock('@angular/fire/auth', () => ({ Auth: jest.fn() }));

import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  LeaderboardData,
  LeaderboardService,
} from '../api/leaderboard.service';
import { LeaderboardStore } from './leaderboard.store';

const emptyLeaderboard: LeaderboardData = {
  daily: { top: [], current: null },
  weekly: { top: [], current: null },
  monthly: { top: [], current: null },
};

function makeApiMock(): {
  load: jest.Mock<Promise<LeaderboardData>, []>;
  observeSnapshot: jest.Mock<Subject<unknown>, []>;
  snapshot$: Subject<unknown>;
} {
  const snapshot$ = new Subject<unknown>();
  return {
    load: jest.fn().mockResolvedValue(emptyLeaderboard),
    observeSnapshot: jest.fn().mockReturnValue(snapshot$.asObservable()),
    snapshot$,
  };
}

describe('LeaderboardStore — live snapshot reload', () => {
  describe('Given the app is running in the browser', () => {
    it('Then it subscribes to observeSnapshot on init and force-reloads on each emission', async () => {
      // Given
      const api = makeApiMock();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LeaderboardService, useValue: api },
        ],
      });
      const store = TestBed.inject(LeaderboardStore);
      // The hook subscribes synchronously during creation.
      expect(api.observeSnapshot).toHaveBeenCalledTimes(1);

      // When — Cloud Function rewrites the snapshot doc twice.
      api.snapshot$.next({ rev: 1 });
      await Promise.resolve();
      api.snapshot$.next({ rev: 2 });
      await Promise.resolve();
      // Drain the second performLoad triggered by reloadPending.
      await Promise.resolve();
      await Promise.resolve();

      // Then — the API was hit at least once per emission. With the in-flight
      // queueing in `load()` the second emission may collapse with the first
      // but is never dropped: the final fetch always reflects the latest doc.
      expect(api.load).toHaveBeenCalled();
      expect(store.loading()).toBe(false);
      expect(store.data()).toEqual(emptyLeaderboard);
    });

    it('Then it unsubscribes from observeSnapshot when the injector is destroyed', () => {
      // Given
      const api = makeApiMock();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LeaderboardService, useValue: api },
        ],
      });
      TestBed.inject(LeaderboardStore);
      expect(api.snapshot$.observed).toBe(true);

      // When
      TestBed.resetTestingModule();

      // Then — the effect's onCleanup tore down the subscription so the
      // store instance does not keep Firestore listeners alive after destroy.
      expect(api.snapshot$.observed).toBe(false);
    });

    it('Then a snapshot emission arriving while a load is in flight queues a follow-up reload', async () => {
      // Given — `_api.load()` resolves only when we pull on `release`.
      const api = makeApiMock();
      let release!: (data: LeaderboardData) => void;
      const dataA: LeaderboardData = {
        ...emptyLeaderboard,
        daily: {
          top: [{ alias: 'A', reps: 1, rank: 1 }],
          current: null,
        },
      };
      const dataB: LeaderboardData = {
        ...emptyLeaderboard,
        daily: {
          top: [{ alias: 'B', reps: 2, rank: 1 }],
          current: null,
        },
      };
      api.load.mockImplementationOnce(
        () =>
          new Promise<LeaderboardData>((resolve) => {
            release = resolve;
          })
      );
      api.load.mockResolvedValueOnce(dataB);

      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LeaderboardService, useValue: api },
        ],
      });
      const store = TestBed.inject(LeaderboardStore);

      // First emission starts a load that is still pending.
      api.snapshot$.next({ rev: 1 });
      await Promise.resolve();
      expect(store.loading()).toBe(true);

      // When — second emission arrives while the first load is still in flight.
      api.snapshot$.next({ rev: 2 });
      await Promise.resolve();
      // Now finish the first load. The store must run a second one for rev=2,
      // not silently drop it.
      release(dataA);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Then — both loads ran and the store reflects the LATER snapshot.
      expect(api.load).toHaveBeenCalledTimes(2);
      expect(store.data()).toEqual(dataB);
      expect(store.loading()).toBe(false);
    });
  });

  describe('Given the app is running on the server', () => {
    it('Then no live subscription is opened (SSR has no Firestore listener)', () => {
      // Given
      const api = makeApiMock();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: LeaderboardService, useValue: api },
        ],
      });

      // When
      TestBed.inject(LeaderboardStore);

      // Then
      expect(api.observeSnapshot).not.toHaveBeenCalled();
    });
  });
});
