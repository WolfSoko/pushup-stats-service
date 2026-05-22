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
const where = firestoreFns.where as unknown as jest.Mock;
const collection = firestoreFns.collection as unknown as jest.Mock;

function makeSnapshot(periods: Record<string, unknown> | null): {
  exists: () => boolean;
  data: () => unknown;
} {
  return {
    exists: () => periods !== null,
    data: () => (periods ? { periods } : {}),
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

  describe('Given the snapshot still has the legacy weekly/monthly shape', () => {
    it('Then last7/last30 fall back to the client-computed top instead of empty arrays', async () => {
      // Given — legacy snapshot has only `daily` of the new keys; weekly/monthly
      // are what the old Cloud Function wrote.
      getDoc.mockResolvedValueOnce(
        makeSnapshot({
          daily: [{ alias: 'D...Y', reps: 5 }],
          weekly: [{ alias: 'W...Y', reps: 50 }],
          monthly: [{ alias: 'M...Y', reps: 500 }],
        })
      );

      // And — the client fetches some recent rows it can aggregate locally.
      const today = new Date();
      const isoToday = today.toISOString();
      getDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ userId: 'alice', reps: 12, timestamp: isoToday }) },
        ],
      });

      // When
      const result = await service.load();

      // Then — daily comes from the cached snapshot (server is authoritative).
      expect(result.daily.top).toEqual([
        expect.objectContaining({ alias: 'D...Y', reps: 5 }),
      ]);

      // And — last7/last30 use the client fallback because the snapshot
      // doesn't carry those fields yet.
      expect(result.last7.top).toEqual([
        expect.objectContaining({ alias: 'A...E', reps: 12 }),
      ]);
      expect(result.last30.top).toEqual([
        expect.objectContaining({ alias: 'A...E', reps: 12 }),
      ]);
    });
  });

  describe('Given the snapshot has the new last7/last30 shape', () => {
    it('Then top entries come from the snapshot, not the client fallback', async () => {
      // Given
      getDoc.mockResolvedValueOnce(
        makeSnapshot({
          daily: [],
          last7: [{ alias: 'S...R', reps: 100 }],
          last30: [{ alias: 'S...R', reps: 100 }],
        })
      );

      const isoToday = new Date().toISOString();
      getDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ userId: 'alice', reps: 1, timestamp: isoToday }) },
        ],
      });

      // When
      const result = await service.load();

      // Then — server values win, even though client could compute its own.
      expect(result.last7.top).toEqual([
        expect.objectContaining({ alias: 'S...R', reps: 100 }),
      ]);
      expect(result.last30.top).toEqual([
        expect.objectContaining({ alias: 'S...R', reps: 100 }),
      ]);
    });

    it('Then an explicit empty array is preserved (not replaced by fallback)', async () => {
      // Given — server says "no entries" for last7 (e.g. nobody trained).
      getDoc.mockResolvedValueOnce(
        makeSnapshot({
          daily: [],
          last7: [],
          last30: [],
        })
      );

      const isoToday = new Date().toISOString();
      getDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ userId: 'alice', reps: 99, timestamp: isoToday }) },
        ],
      });

      // When
      const result = await service.load();

      // Then — we trust the server's empty list; we don't override with stale
      // client computation.
      expect(result.last7.top).toEqual([]);
      expect(result.last30.top).toEqual([]);
    });
  });

  describe('Firestore query bound', () => {
    it('Uses a date-only YYYY-MM-DD lower bound for the timestamp filter', async () => {
      // Given — no snapshot, so `load()` triggers `fetchRows`.
      getDoc.mockResolvedValueOnce(makeSnapshot(null));

      // When
      await service.load();

      // Then — the `where` clause is called with a YYYY-MM-DD string, NOT a
      // full ISO datetime. This makes the query robust to whatever timestamp
      // format the entries carry (Z-suffix, +01:00 offset, ms or no ms).
      const lowerBoundCall = where.mock.calls.find(
        ([field, op]) => field === 'timestamp' && op === '>='
      );
      expect(lowerBoundCall).toBeDefined();
      expect(lowerBoundCall?.[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Given an exerciseId other than the legacy pushup sentinel', () => {
    it('Reads from the exerciseEntries collection filtered by exerciseId, and skips the snapshot', async () => {
      // When
      await service.load('legs.squats');

      // Then — `getDoc` (snapshot reader) must NOT fire for non-pushup
      // exerciseIds; the snapshot at `leaderboards/current` doesn't carry
      // per-exercise rankings.
      expect(getDoc).not.toHaveBeenCalled();

      // And — the collection that was queried is `exerciseEntries`.
      const collArg = collection.mock.results
        .map((r) => r.value as { __collection?: string })
        .find((v) => v.__collection === 'exerciseEntries');
      expect(collArg).toBeDefined();

      // And — there's a `where('exerciseId', '==', 'legs.squats')` clause.
      const exerciseFilter = where.mock.calls.find(
        ([field, op, value]) =>
          field === 'exerciseId' && op === '==' && value === 'legs.squats'
      );
      expect(exerciseFilter).toBeDefined();
    });

    it('Aggregates by the measurement-specific value field — reps for `reps` exercises', async () => {
      // Given — three docs from the exerciseEntries collection for two users.
      const isoToday = new Date().toISOString();
      getDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              userId: 'alice',
              exerciseId: 'legs.squats',
              reps: 20,
              timestamp: isoToday,
            }),
          },
          {
            data: () => ({
              userId: 'alice',
              exerciseId: 'legs.squats',
              reps: 30,
              timestamp: isoToday,
            }),
          },
          {
            data: () => ({
              userId: 'bob',
              exerciseId: 'legs.squats',
              reps: 40,
              timestamp: isoToday,
            }),
          },
        ],
      });

      // When
      const result = await service.load('legs.squats');

      // Then — Alice's two entries are summed (50), Bob's one (40); Alice is
      // ranked first. Aliases come from the privacy-preserving `toAlias`
      // helper (uppercase first/last letter) — no snapshot to upgrade them.
      expect(result.daily.top).toEqual([
        expect.objectContaining({ alias: 'A...E', reps: 50, rank: 1 }),
        expect.objectContaining({ alias: 'B...B', reps: 40, rank: 2 }),
      ]);
    });

    it('Reads `durationSec` for time-measured exercises like plank', async () => {
      // Given
      const isoToday = new Date().toISOString();
      getDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              userId: 'alice',
              exerciseId: 'plank.standard',
              durationSec: 90,
              timestamp: isoToday,
            }),
          },
          {
            data: () => ({
              userId: 'bob',
              exerciseId: 'plank.standard',
              durationSec: 120,
              timestamp: isoToday,
            }),
          },
        ],
      });

      // When
      const result = await service.load('plank.standard');

      // Then — Bob (120 s) outranks Alice (90 s). The `reps` field on the
      // entry semantically carries seconds for time-measured exercises —
      // wire-format compat with the pushup snapshot doc shape.
      expect(result.daily.top).toEqual([
        expect.objectContaining({ alias: 'B...B', reps: 120, rank: 1 }),
        expect.objectContaining({ alias: 'A...E', reps: 90, rank: 2 }),
      ]);
    });

    it('Reads `distanceM` for distance-time exercises like running', async () => {
      // Given
      const isoToday = new Date().toISOString();
      getDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              userId: 'alice',
              exerciseId: 'cardio.running',
              distanceM: 5000,
              durationSec: 1800,
              timestamp: isoToday,
            }),
          },
          {
            data: () => ({
              userId: 'alice',
              exerciseId: 'cardio.running',
              distanceM: 3000,
              durationSec: 1100,
              timestamp: isoToday,
            }),
          },
        ],
      });

      // When
      const result = await service.load('cardio.running');

      // Then — Alice's two runs (5000 + 3000) sum to 8000 m. Distance is
      // the primary value for `distance-time`; the duration companion is
      // ignored for the leaderboard ranking (it'd be a different metric).
      expect(result.daily.top).toEqual([
        expect.objectContaining({ alias: 'A...E', reps: 8000, rank: 1 }),
      ]);
    });

    it('Returns empty buckets when the exerciseId is not in the catalog', async () => {
      // When
      const result = await service.load('does.not.exist');

      // Then — no Firestore query, just three empty buckets so the store
      // can settle into a non-loading state.
      expect(getDocs).not.toHaveBeenCalled();
      expect(result).toEqual({
        daily: { top: [], current: null },
        last7: { top: [], current: null },
        last30: { top: [], current: null },
      });
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
