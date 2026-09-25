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

import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  LEADERBOARD_PUSHUP_ID,
  LEADERBOARD_XP_ID,
  LeaderboardData,
  LeaderboardService,
} from '@pu-stats/data-access';
import { LeaderboardStore } from './leaderboard.store';

const emptyLeaderboard: LeaderboardData = {
  daily: { top: [], current: null },
  last7: { top: [], current: null },
  last30: { top: [], current: null },
  allTime: { top: [], current: null },
  updatedAt: null,
};

function makeApiMock(): {
  load: jest.Mock<Promise<LeaderboardData>, [string?]>;
  observe: jest.Mock<Subject<LeaderboardData>, [string]>;
  board$: (boardId: string) => Subject<LeaderboardData>;
} {
  const boards = new Map<string, Subject<LeaderboardData>>();
  const board$ = (boardId: string) => {
    let subject = boards.get(boardId);
    if (!subject) {
      subject = new Subject<LeaderboardData>();
      boards.set(boardId, subject);
    }
    return subject;
  };
  return {
    load: jest.fn().mockResolvedValue(emptyLeaderboard),
    observe: jest.fn((boardId: string) => board$(boardId)),
    board$,
  };
}

function withTop(alias: string): LeaderboardData {
  return {
    ...emptyLeaderboard,
    daily: { top: [{ alias, reps: 10, rank: 1 }], current: null },
  };
}

describe('LeaderboardStore — live board updates', () => {
  function setup(platform: 'browser' | 'server' = 'browser') {
    const api = makeApiMock();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        { provide: LeaderboardService, useValue: api },
      ],
    });
    return { api, store: TestBed.inject(LeaderboardStore) };
  }

  it('should open no listener before a board is loaded', () => {
    // given / when
    const { api } = setup();

    // then
    expect(api.observe).not.toHaveBeenCalled();
  });

  it('should listen to a board once it has been loaded, one listener per board', async () => {
    // given
    const { api, store } = setup();

    // when
    await store.load(LEADERBOARD_XP_ID);
    await store.load(LEADERBOARD_XP_ID, { force: true });
    await store.load('legs.squats');

    // then
    expect(api.observe.mock.calls).toEqual([
      [LEADERBOARD_XP_ID],
      ['legs.squats'],
    ]);
  });

  it('should put an emitted board straight into the cache without re-reading', async () => {
    // given
    const { api, store } = setup();
    await store.load(LEADERBOARD_XP_ID);
    await store.load('legs.squats');
    api.load.mockClear();
    const xpTop = store.entriesForPeriod(
      () => LEADERBOARD_XP_ID,
      () => 'daily'
    );
    const squatTop = store.entriesForPeriod(
      () => 'legs.squats',
      () => 'daily'
    );

    // when
    api.board$(LEADERBOARD_XP_ID).next(withTop('Ada'));

    // then
    expect(xpTop().map((e) => e.alias)).toEqual(['Ada']);
    expect(squatTop()).toEqual([]);
    expect(api.load).not.toHaveBeenCalled();
  });

  it('should not listen on the server', async () => {
    // given
    const { api, store } = setup('server');

    // when
    await store.load(LEADERBOARD_PUSHUP_ID);

    // then
    expect(api.observe).not.toHaveBeenCalled();
  });

  it('should tear down every board listener on destroy', async () => {
    // given
    const { api, store } = setup();
    await store.load(LEADERBOARD_XP_ID);
    expect(api.board$(LEADERBOARD_XP_ID).observed).toBe(true);

    // when
    TestBed.resetTestingModule();

    // then
    expect(api.board$(LEADERBOARD_XP_ID).observed).toBe(false);
  });
});

describe('LeaderboardStore — per-exercise caching', () => {
  function setup(api: ReturnType<typeof makeApiMock>): {
    store: ReturnType<typeof TestBed.inject<typeof LeaderboardStore>>;
  } {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: LeaderboardService, useValue: api },
      ],
    });
    const store = TestBed.inject(LeaderboardStore);
    return { store };
  }

  it('Loads a different exercise into its own cache slot without evicting the pushup bucket', async () => {
    // Given — `_api.load(id)` returns a distinct dataset per exerciseId.
    const api = makeApiMock();
    const pushupData: LeaderboardData = {
      ...emptyLeaderboard,
      daily: { top: [{ alias: 'P', reps: 10, rank: 1 }], current: null },
    };
    const squatData: LeaderboardData = {
      ...emptyLeaderboard,
      daily: { top: [{ alias: 'S', reps: 20, rank: 1 }], current: null },
    };
    api.load.mockImplementation((id?: string) =>
      Promise.resolve(id === 'legs.squats' ? squatData : pushupData)
    );

    const { store } = setup(api);

    // When — load pushup, then load squats.
    await store.load(LEADERBOARD_PUSHUP_ID);
    await store.load('legs.squats');

    // Then — both buckets coexist in the cache, keyed by exerciseId.
    expect(store.data()).toEqual({
      [LEADERBOARD_PUSHUP_ID]: pushupData,
      'legs.squats': squatData,
    });

    // And — entriesForPeriod resolves from the right bucket per selection.
    const exerciseSig = signal<string>(LEADERBOARD_PUSHUP_ID);
    const periodSig = signal<'daily' | 'last7' | 'last30'>('daily');
    const entries = store.entriesForPeriod(exerciseSig, periodSig);
    expect(entries()).toEqual(pushupData.daily.top);

    exerciseSig.set('legs.squats');
    expect(entries()).toEqual(squatData.daily.top);
  });

  it('Skips the API when the requested exercise is already cached (no force flag)', async () => {
    // Given
    const api = makeApiMock();
    const { store } = setup(api);

    // When — same exerciseId loaded twice in a row.
    await store.load('plank.standard');
    await store.load('plank.standard');

    // Then — only one fetch. Caching is the whole point of per-exercise
    // entries; refetching on every tab switch would be wasteful.
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(api.load).toHaveBeenCalledWith('plank.standard');
  });

  it('Respects `force: true` even when the exercise is already cached', async () => {
    // Given
    const api = makeApiMock();
    const { store } = setup(api);

    // When
    await store.load('pull.pullups');
    await store.load('pull.pullups', { force: true });

    // Then — force reloads bypass the cache check, mirroring the
    // snapshot-driven invalidation for pushup.
    expect(api.load).toHaveBeenCalledTimes(2);
  });

  it('Defaults to the pushup sentinel when called without an exerciseId', async () => {
    // Given
    const api = makeApiMock();
    const { store } = setup(api);

    // When
    await store.load();

    // Then
    expect(api.load).toHaveBeenCalledWith(LEADERBOARD_PUSHUP_ID);
    expect(store.data()[LEADERBOARD_PUSHUP_ID]).toEqual(emptyLeaderboard);
  });

  describe('busy', () => {
    it('should flag only the loading exercise as busy until its load settles', async () => {
      // given
      const api = makeApiMock();
      let resolveLoad: (data: LeaderboardData) => void = () => undefined;
      api.load.mockImplementation(
        () =>
          new Promise<LeaderboardData>((resolve) => {
            resolveLoad = resolve;
          })
      );
      const { store } = setup(api);

      // when
      const pending = store.load('legs.squats');

      // then
      expect(store.busy.isBusy('legs.squats')).toBe(true);
      expect(store.busy.isBusy(LEADERBOARD_PUSHUP_ID)).toBe(false);

      // when
      resolveLoad(emptyLeaderboard);
      await pending;

      // then
      expect(store.busy.isBusy('legs.squats')).toBe(false);
      expect(store.busy.busy()).toBe(false);
    });
  });

  describe('lastUpdatedFor', () => {
    it('Returns null until the exercise has been loaded', () => {
      // Given — no load has happened yet, so the cache has no entry for
      // this exerciseId.
      const api = makeApiMock();
      const { store } = setup(api);

      // When
      const exerciseSig = signal<string>(LEADERBOARD_PUSHUP_ID);
      const lastUpdated = store.lastUpdatedFor(exerciseSig);

      // Then — the freshness signal stays null so the UI can hide the
      // "Zuletzt aktualisiert" line instead of rendering a meaningless
      // placeholder.
      expect(lastUpdated()).toBeNull();
    });

    it('Surfaces the loaded updatedAt and re-tracks when the selected exercise changes', async () => {
      // Given — pushup data is fresher than squat data.
      const api = makeApiMock();
      const pushupUpdatedAt = new Date('2026-05-27T12:34:00Z');
      const squatUpdatedAt = new Date('2026-05-27T08:15:00Z');
      api.load.mockImplementation((id?: string) =>
        Promise.resolve(
          id === 'legs.squats'
            ? { ...emptyLeaderboard, updatedAt: squatUpdatedAt }
            : { ...emptyLeaderboard, updatedAt: pushupUpdatedAt }
        )
      );

      const { store } = setup(api);
      await store.load(LEADERBOARD_PUSHUP_ID);
      await store.load('legs.squats');

      // When — the selector is bound to a reactive exerciseId signal.
      const exerciseSig = signal<string>(LEADERBOARD_PUSHUP_ID);
      const lastUpdated = store.lastUpdatedFor(exerciseSig);

      // Then — flipping the exercise flips the freshness, proving the
      // selector is reactive (not snapshotted at construction).
      expect(lastUpdated()).toEqual(pushupUpdatedAt);
      exerciseSig.set('legs.squats');
      expect(lastUpdated()).toEqual(squatUpdatedAt);
    });
  });
});
