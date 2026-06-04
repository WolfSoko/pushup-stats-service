import { describe, it, expect } from '@jest/globals';
import {
  pushupToExerciseEntry,
  planMigration,
  rollbackTargets,
  type PushupSourceDoc,
} from './logic';

const NOW = '2026-06-03T10:00:00.000Z';

describe('pushup-unification/logic', () => {
  describe('pushupToExerciseEntry', () => {
    it('should map a full pushup doc to a pushup exerciseEntries payload', () => {
      // given a complete source pushup doc
      const src: PushupSourceDoc = {
        id: 'doc-1',
        userId: 'user-1',
        timestamp: '2026-05-01T08:00:00.000Z',
        reps: 25,
        sets: [10, 10, 5],
        source: 'mobile',
        createdAt: '2026-05-01T07:59:00.000Z',
      };

      // when mapped
      const result = pushupToExerciseEntry(src, NOW);

      // then the dest id namespaces the source id and the payload carries
      // exerciseId:'pushup' + migratedFrom:'pushups' with source values intact
      expect(result).toEqual({
        destId: 'pushup__doc-1',
        data: {
          userId: 'user-1',
          exerciseId: 'pushup',
          timestamp: '2026-05-01T08:00:00.000Z',
          reps: 25,
          source: 'mobile',
          sets: [10, 10, 5],
          migratedFrom: 'pushups',
          createdAt: '2026-05-01T07:59:00.000Z',
          updatedAt: NOW,
        },
      });
    });

    it('should carry source timestamp, reps, sets and source unchanged', () => {
      // given a source doc with explicit values
      const src: PushupSourceDoc = {
        id: 'doc-2',
        userId: 'user-2',
        timestamp: '2026-04-02T09:30:00.000Z',
        reps: 42,
        sets: [21, 21],
        source: 'import',
      };

      // when mapped
      const result = pushupToExerciseEntry(src, NOW);

      // then the carried-over fields equal the source
      if ('skip' in result) throw new Error('expected a mapped entry');
      expect(result.destId).toBe('pushup__doc-2');
      expect(result.data.timestamp).toBe('2026-04-02T09:30:00.000Z');
      expect(result.data.reps).toBe(42);
      expect(result.data.sets).toEqual([21, 21]);
      expect(result.data.source).toBe('import');
    });

    it('should default source to web and createdAt to nowIso when absent', () => {
      // given a source doc without source or createdAt
      const src: PushupSourceDoc = {
        id: 'doc-3',
        userId: 'user-3',
        timestamp: '2026-03-03T12:00:00.000Z',
        reps: 10,
      };

      // when mapped
      const result = pushupToExerciseEntry(src, NOW);

      // then source falls back to 'web' and createdAt to nowIso
      if ('skip' in result) throw new Error('expected a mapped entry');
      expect(result.data.source).toBe('web');
      expect(result.data.createdAt).toBe(NOW);
      expect(result.data.updatedAt).toBe(NOW);
    });

    it('should omit sets when the source sets field is not an array', () => {
      // given a source doc whose sets is not an array
      const src: PushupSourceDoc = {
        id: 'doc-4',
        userId: 'user-4',
        timestamp: '2026-02-04T12:00:00.000Z',
        reps: 15,
        sets: 'not-an-array' as unknown,
      };

      // when mapped
      const result = pushupToExerciseEntry(src, NOW);

      // then the sets field is omitted entirely
      if ('skip' in result) throw new Error('expected a mapped entry');
      expect(result.data).not.toHaveProperty('sets');
    });

    it('should drop non-positive and non-integer set elements', () => {
      // given a source doc with mixed-validity set elements
      const src: PushupSourceDoc = {
        id: 'doc-5',
        userId: 'user-5',
        timestamp: '2026-01-05T12:00:00.000Z',
        reps: 30,
        sets: [10, 0, -3, 5.5, 20, NaN, '7'] as unknown,
      };

      // when mapped
      const result = pushupToExerciseEntry(src, NOW);

      // then only finite positive integers survive
      if ('skip' in result) throw new Error('expected a mapped entry');
      expect(result.data.sets).toEqual([10, 20]);
    });

    it('should omit sets when every set element is invalid', () => {
      // given a source doc whose sets are all invalid
      const src: PushupSourceDoc = {
        id: 'doc-5b',
        userId: 'user-5b',
        timestamp: '2026-01-06T12:00:00.000Z',
        reps: 30,
        sets: [0, -1, 2.5] as unknown,
      };

      // when mapped
      const result = pushupToExerciseEntry(src, NOW);

      // then the sets field is omitted entirely
      if ('skip' in result) throw new Error('expected a mapped entry');
      expect(result.data).not.toHaveProperty('sets');
    });

    it('should skip a doc missing userId', () => {
      // given a source doc without userId
      const src: PushupSourceDoc = {
        id: 'doc-6',
        timestamp: '2026-01-07T12:00:00.000Z',
        reps: 10,
      };

      // when mapped
      // then it is classified invalid
      expect(pushupToExerciseEntry(src, NOW)).toEqual({ skip: 'invalid' });
    });

    it('should skip a doc missing timestamp', () => {
      // given a source doc without timestamp
      const src: PushupSourceDoc = {
        id: 'doc-7',
        userId: 'user-7',
        reps: 10,
      };

      // when mapped
      // then it is classified invalid
      expect(pushupToExerciseEntry(src, NOW)).toEqual({ skip: 'invalid' });
    });

    it('should skip a doc with non-numeric reps', () => {
      // given a source doc whose reps is not a number
      const src: PushupSourceDoc = {
        id: 'doc-8',
        userId: 'user-8',
        timestamp: '2026-01-08T12:00:00.000Z',
        reps: '20' as unknown,
      };

      // when mapped
      // then it is classified invalid
      expect(pushupToExerciseEntry(src, NOW)).toEqual({ skip: 'invalid' });
    });

    it('should skip a doc with non-finite or non-positive reps', () => {
      // given source docs with NaN, zero and negative reps
      const nan: PushupSourceDoc = {
        id: 'doc-9a',
        userId: 'user-9',
        timestamp: '2026-01-09T12:00:00.000Z',
        reps: NaN,
      };
      const zero: PushupSourceDoc = { ...nan, id: 'doc-9b', reps: 0 };
      const negative: PushupSourceDoc = { ...nan, id: 'doc-9c', reps: -5 };

      // when mapped
      // then each is classified invalid
      expect(pushupToExerciseEntry(nan, NOW)).toEqual({ skip: 'invalid' });
      expect(pushupToExerciseEntry(zero, NOW)).toEqual({ skip: 'invalid' });
      expect(pushupToExerciseEntry(negative, NOW)).toEqual({ skip: 'invalid' });
    });

    it('should skip a doc with a non-integer reps value', () => {
      // given a source doc whose reps is fractional
      const src: PushupSourceDoc = {
        id: 'doc-9d',
        userId: 'user-9d',
        timestamp: '2026-01-09T12:00:00.000Z',
        reps: 5.5,
      };

      // when mapped
      // then it is classified invalid — the dest schema expects integer reps
      expect(pushupToExerciseEntry(src, NOW)).toEqual({ skip: 'invalid' });
    });

    it('should drop the legacy pushup variant type', () => {
      // given a source doc carrying a legacy variant type
      const src: PushupSourceDoc = {
        id: 'doc-10',
        userId: 'user-10',
        timestamp: '2026-01-10T12:00:00.000Z',
        reps: 12,
        type: 'diamond',
      };

      // when mapped
      const result = pushupToExerciseEntry(src, NOW);

      // then neither a `type` nor a `variantId` is carried over
      if ('skip' in result) throw new Error('expected a mapped entry');
      expect(result.data).not.toHaveProperty('type');
      expect(result.data).not.toHaveProperty('variantId');
    });
  });

  describe('planMigration', () => {
    it('should classify sources into copy, skip-existing and skip-invalid', () => {
      // given one writable, one already-migrated and one invalid source
      const sources: PushupSourceDoc[] = [
        {
          id: 'new-1',
          userId: 'u1',
          timestamp: '2026-05-01T08:00:00.000Z',
          reps: 10,
        },
        {
          id: 'existing-1',
          userId: 'u2',
          timestamp: '2026-05-02T08:00:00.000Z',
          reps: 20,
        },
        { id: 'invalid-1', userId: 'u3', reps: 30 },
      ];
      const existing = new Set(['pushup__existing-1']);

      // when planned
      const plan = planMigration(sources, existing, NOW);

      // then each source lands in exactly one bucket
      expect(plan.toWrite.map((w) => w.destId)).toEqual(['pushup__new-1']);
      expect(plan.skippedExisting).toEqual(['pushup__existing-1']);
      expect(plan.skippedInvalid).toEqual(['invalid-1']);
    });

    it('should write nothing when every valid source already exists', () => {
      // given valid sources whose dest ids all already exist
      const sources: PushupSourceDoc[] = [
        {
          id: 'a',
          userId: 'u1',
          timestamp: '2026-05-01T08:00:00.000Z',
          reps: 10,
        },
        {
          id: 'b',
          userId: 'u2',
          timestamp: '2026-05-02T08:00:00.000Z',
          reps: 20,
        },
      ];
      const existing = new Set(['pushup__a', 'pushup__b']);

      // when planned (idempotent re-run)
      const plan = planMigration(sources, existing, NOW);

      // then nothing new is written
      expect(plan.toWrite).toEqual([]);
      expect(plan.skippedExisting).toEqual(['pushup__a', 'pushup__b']);
      expect(plan.skippedInvalid).toEqual([]);
    });
  });

  describe('rollbackTargets', () => {
    it('should select exactly the migratedFrom pushups ids and ignore others', () => {
      // given a mix of migrated and natively-created dest docs
      const docs = [
        { id: 'mig-1', migratedFrom: 'pushups' },
        { id: 'native-1' },
        { id: 'native-2', migratedFrom: 'somewhere-else' },
        { id: 'mig-2', migratedFrom: 'pushups' },
      ];

      // when computing rollback targets
      const targets = rollbackTargets(docs);

      // then only the pushups-migrated ids are returned
      expect(targets).toEqual(['mig-1', 'mig-2']);
    });
  });
});
