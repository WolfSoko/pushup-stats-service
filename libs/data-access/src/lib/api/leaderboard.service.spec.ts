// Stub the Firestore SDK so its top-level evaluation doesn't pull `fetch`
// into the Jest environment. See docs/gotchas/testing.md → "Jest ↔ Firebase".
jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  docData: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(() => ({})),
  where: jest.fn(),
}));
jest.mock('@angular/fire/auth', () => ({ Auth: jest.fn() }));

import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import * as firestoreFns from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { LeaderboardService } from './leaderboard.service';

const getDoc = firestoreFns.getDoc as unknown as jest.Mock;
const getDocs = firestoreFns.getDocs as unknown as jest.Mock;
const where = firestoreFns.where as unknown as jest.Mock;

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
});
