// Stub the Firestore SDK so its top-level evaluation doesn't pull `fetch`
// into the Jest environment. See docs/gotchas/testing.md → "Jest ↔ Firebase".
jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn((_db: unknown, name: string) => ({ __collection: name })),
  doc: jest.fn(() => ({})),
  docData: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(
    (ref: { __collection?: string } | unknown, ...constraints: unknown[]) => ({
      __ref: ref,
      __constraints: constraints,
    })
  ),
  where: jest.fn((field: string, op: string, value: unknown) => ({
    __where: { field, op, value },
  })),
}));
jest.mock('@angular/fire/auth', () => ({ Auth: jest.fn() }));

import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import * as firestoreFns from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import {
  LEADERBOARD_PUSHUP_ID,
  LeaderboardService,
} from './leaderboard.service';

const getDoc = firestoreFns.getDoc as unknown as jest.Mock;
const getDocs = firestoreFns.getDocs as unknown as jest.Mock;

function makeSnapshot(
  periods: Record<string, unknown> | null,
  extra: Record<string, unknown> = {}
): {
  exists: () => boolean;
  data: () => unknown;
} {
  return {
    exists: () => periods !== null,
    data: () => (periods ? { periods, ...extra } : { ...extra }),
  };
}

describe('LeaderboardService — load() merging', () => {
  let service: LeaderboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LeaderboardService,
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: null } },
      ],
    });
    service = TestBed.inject(LeaderboardService);

    // Default: no rows from Firestore
    getDocs.mockResolvedValue({ docs: [] });
  });

  describe('Given an exerciseId other than the legacy pushup sentinel', () => {
    function makeExerciseSnapshot(
      byExercise: Record<
        string,
        {
          periods: Partial<
            Record<
              'daily' | 'last7' | 'last30' | 'allTime',
              Array<{ alias: string; reps: number; uid?: string }>
            >
          >;
        }
      > | null
    ): { exists: () => boolean; data: () => unknown } {
      return {
        exists: () => byExercise !== null,
        data: () => (byExercise ? { byExercise } : {}),
      };
    }

    it('Reads `leaderboards/exercises` snapshot (not `exerciseEntries`) and surfaces ranks', async () => {
      // Given — snapshot contains a ranked top for legs.squats.
      getDoc.mockResolvedValueOnce(
        makeExerciseSnapshot({
          'legs.squats': {
            periods: {
              daily: [
                { alias: 'Alice', reps: 50, uid: 'alice' },
                { alias: 'Bob', reps: 40, uid: 'bob' },
              ],
              last7: [],
              last30: [],
            },
          },
        })
      );

      // When
      const result = await service.load('legs.squats');

      // Then — the client never touches `exerciseEntries` directly
      // (Firestore rule would block cross-user reads). It only reads
      // the precomputed snapshot the Cloud Function writes.
      expect(getDocs).not.toHaveBeenCalled();

      // And — ranks come from the snapshot order, isCurrent stays
      // false because no auth user matches.
      expect(result.daily.top).toEqual([
        expect.objectContaining({
          alias: 'Alice',
          reps: 50,
          rank: 1,
          uid: 'alice',
          isCurrent: false,
        }),
        expect.objectContaining({
          alias: 'Bob',
          reps: 40,
          rank: 2,
          uid: 'bob',
          isCurrent: false,
        }),
      ]);
    });

    it('Returns empty buckets when the snapshot doc does not exist yet', async () => {
      // Given — the Cloud Function hasn't run since deploy.
      getDoc.mockResolvedValueOnce(makeExerciseSnapshot(null));

      // When
      const result = await service.load('legs.squats');

      // Then — empty buckets, not a wedged loading state. `updatedAt`
      // stays null because there's no doc to read a timestamp from.
      expect(result).toEqual({
        daily: { top: [], current: null },
        last7: { top: [], current: null },
        last30: { top: [], current: null },
        allTime: { top: [], current: null },
        updatedAt: null,
      });
    });

    it('Returns empty buckets when the exerciseId is missing from byExercise', async () => {
      // Given — snapshot exists but has no entry for this exercise
      // (no recent activity, or all users opted out of publicProfile).
      getDoc.mockResolvedValueOnce(
        makeExerciseSnapshot({
          'plank.standard': {
            periods: { daily: [{ alias: 'X', reps: 1, uid: 'x' }] },
          },
        })
      );

      // When
      const result = await service.load('legs.squats');

      // Then
      expect(result.daily.top).toEqual([]);
      expect(result.last7.top).toEqual([]);
      expect(result.last30.top).toEqual([]);
    });

    it('Surfaces the allTime bucket from the snapshot when present', async () => {
      // Given — snapshot carries an allTime ranking for legs.squats
      // (top contributors by lifetime totals).
      getDoc.mockResolvedValueOnce(
        makeExerciseSnapshot({
          'legs.squats': {
            periods: {
              daily: [],
              last7: [],
              last30: [],
              allTime: [
                { alias: 'Carol', reps: 12000, uid: 'carol' },
                { alias: 'Dave', reps: 8000, uid: 'dave' },
              ],
            },
          },
        })
      );

      // When
      const result = await service.load('legs.squats');

      // Then — ranks come from the snapshot order, mirroring the
      // windowed buckets. No client-side cumulative computation
      // happens because the Firestore rule blocks cross-user reads.
      expect(result.allTime.top).toEqual([
        expect.objectContaining({
          alias: 'Carol',
          reps: 12000,
          rank: 1,
          uid: 'carol',
        }),
        expect.objectContaining({
          alias: 'Dave',
          reps: 8000,
          rank: 2,
          uid: 'dave',
        }),
      ]);
    });

    it('Falls back to an empty allTime bucket when the snapshot omits it (legacy doc)', async () => {
      // Given — a writer that hasn't shipped allTime yet still produces
      // a valid snapshot. The empty fallback is the only honest
      // surface (no client cross-user query is available to synthesise
      // lifetime totals).
      getDoc.mockResolvedValueOnce(
        makeExerciseSnapshot({
          'legs.squats': {
            periods: { daily: [], last7: [], last30: [] },
          },
        })
      );

      // When
      const result = await service.load('legs.squats');

      // Then
      expect(result.allTime.top).toEqual([]);
      expect(result.allTime.current).toBeNull();
    });

    it('Returns empty buckets when the exerciseId is not in the catalog', async () => {
      // When
      const result = await service.load('does.not.exist');

      // Then — no Firestore read at all; the catalog gate short-circuits.
      expect(getDoc).not.toHaveBeenCalled();
      expect(getDocs).not.toHaveBeenCalled();
      expect(result).toEqual({
        daily: { top: [], current: null },
        last7: { top: [], current: null },
        last30: { top: [], current: null },
        allTime: { top: [], current: null },
        updatedAt: null,
      });
    });

    it('Flags isCurrent + populates currentUserEntry when the snapshot row matches the auth uid', async () => {
      // Given — Bob is the currently signed-in user.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          LeaderboardService,
          { provide: Firestore, useValue: {} },
          { provide: Auth, useValue: { currentUser: { uid: 'bob' } } },
        ],
      });
      const userScopedService = TestBed.inject(LeaderboardService);

      getDoc.mockResolvedValueOnce(
        makeExerciseSnapshot({
          'legs.squats': {
            periods: {
              daily: [
                { alias: 'Alice', reps: 50, uid: 'alice' },
                { alias: 'Bob', reps: 40, uid: 'bob' },
              ],
            },
          },
        })
      );

      // When
      const result = await userScopedService.load('legs.squats');

      // Then — Bob's row carries isCurrent, and `current` resolves
      // to the same entry for the "Deine Position" badge.
      const bobRow = result.daily.top.find((e) => e.uid === 'bob');
      expect(bobRow?.isCurrent).toBe(true);
      expect(result.daily.current?.uid).toBe('bob');
    });
  });

  describe('Given the snapshot carries a Firestore Timestamp `updatedAt`', () => {
    it('Surfaces it as a JS Date on the merged result so the UI can render "Zuletzt aktualisiert"', async () => {
      // Given — Firestore client decodes server timestamps as objects with
      // a `.toDate()` accessor; the service must coerce them, not pass
      // them through raw (the template can't format a Timestamp).
      const serverInstant = new Date('2026-05-27T12:34:00Z');
      getDoc.mockResolvedValueOnce(
        makeSnapshot(
          { daily: [], last7: [], last30: [] },
          { updatedAt: { toDate: () => serverInstant } }
        )
      );

      // When
      const result = await service.load();

      // Then
      expect(result.updatedAt).toEqual(serverInstant);
    });

    it('Accepts the `{seconds, nanoseconds}` wire shape (admin SDK / cached emissions)', async () => {
      // Given — same instant, expressed as the raw wire encoding.
      const serverInstant = new Date('2026-05-27T12:34:00Z');
      getDoc.mockResolvedValueOnce(
        makeSnapshot(
          { daily: [], last7: [], last30: [] },
          {
            updatedAt: {
              seconds: Math.floor(serverInstant.getTime() / 1000),
              nanoseconds: 0,
            },
          }
        )
      );

      // When
      const result = await service.load();

      // Then
      expect(result.updatedAt).toEqual(serverInstant);
    });

    it('Preserves epoch 0 — the Unix epoch is a valid timestamp, not "absent"', async () => {
      // Given — a snapshot whose `updatedAt` is the Unix epoch (millis = 0).
      // Naïve `if (!value) return null` would treat that as missing and
      // drop a perfectly valid timestamp.
      getDoc.mockResolvedValueOnce(
        makeSnapshot({ daily: [], last7: [], last30: [] }, { updatedAt: 0 })
      );

      // When
      const result = await service.load();

      // Then — the epoch survives coercion and reaches the UI as a real
      // Date instance.
      expect(result.updatedAt).toEqual(new Date(0));
    });
  });

  describe('Given the snapshot has no `updatedAt` (legacy or in-flight write)', () => {
    it('Surfaces `updatedAt: null` so the UI hides the freshness line instead of mislabelling stale data', async () => {
      // Given — a snapshot doc exists (so we render server-computed
      // buckets) but lacks the timestamp field. Filling in the browser
      // clock here would falsely claim "fresh now" for ranks that may
      // have been computed hours earlier — the legacy snapshot has no
      // way to tell us when it was written.
      getDoc.mockResolvedValueOnce(
        makeSnapshot({ daily: [], last7: [], last30: [] })
      );

      // When
      const result = await service.load();

      // Then — null so the UI's `@if (lastUpdated())` hides the line
      // rather than lying.
      expect(result.updatedAt).toBeNull();
    });
  });

  describe('Given a per-exercise leaderboard', () => {
    it('Surfaces the per-exercise snapshot `updatedAt` so the UI freshness line matches the actual rebuild time', async () => {
      // Given — per-exercise snapshot doc with a known timestamp and
      // one ranked exercise.
      const serverInstant = new Date('2026-05-27T12:34:00Z');
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          updatedAt: { toDate: () => serverInstant },
          byExercise: {
            'legs.squats': {
              periods: { daily: [], last7: [], last30: [] },
            },
          },
        }),
      });

      // When
      const result = await service.load('legs.squats');

      // Then — the doc-level `updatedAt` propagates through
      // `loadExerciseSnapshot`, not a client-time stamp.
      expect(result.updatedAt).toEqual(serverInstant);
    });

    it('Surfaces `updatedAt` even when the requested exercise has no snapshot entry yet', async () => {
      // Given — snapshot exists with a timestamp but no entry for the
      // requested exerciseId (e.g. nobody has logged that exercise yet).
      const serverInstant = new Date('2026-05-27T12:34:00Z');
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          updatedAt: { toDate: () => serverInstant },
          byExercise: {},
        }),
      });

      // When
      const result = await service.load('legs.squats');

      // Then — buckets are empty, but the freshness line still reflects
      // when the snapshot was last rebuilt.
      expect(result.daily.top).toEqual([]);
      expect(result.updatedAt).toEqual(serverInstant);
    });
  });

  describe('Given the explicit pushup sentinel', () => {
    it('Behaves identically to the default (no-arg) call', async () => {
      // Given — same snapshot for both paths.
      getDoc
        .mockResolvedValueOnce(
          makeSnapshot({
            daily: [{ alias: 'S...R', reps: 7 }],
            last7: [],
            last30: [],
          })
        )
        .mockResolvedValueOnce(
          makeSnapshot({
            daily: [{ alias: 'S...R', reps: 7 }],
            last7: [],
            last30: [],
          })
        );

      // When
      const defaulted = await service.load();
      const explicit = await service.load(LEADERBOARD_PUSHUP_ID);

      // Then — both routes return the same daily top.
      expect(defaulted.daily.top).toEqual(explicit.daily.top);
    });
  });
});
