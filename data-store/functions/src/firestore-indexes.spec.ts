import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards `data-store/firestore.indexes.json` against the composite indexes the
 * delta-aggregation triggers rely on.
 *
 * On the first write for a (user, exercise) — and on a `USERSTATS_VERSION`
 * bump — the trigger rebuilds the lifetime aggregate from scratch by fetching
 * that user's full history ordered by timestamp:
 *
 *   updateUserStatsOnPushupWrite     pushups.where('userId','==').orderBy('timestamp')
 *   updateExerciseStatsOnEntryWrite  exerciseEntries.where('userId','==')
 *                                                    .where('exerciseId','==')
 *                                                    .orderBy('timestamp')
 *
 * Firestore serves an equality-filtered query with an `orderBy` on another
 * field only from a composite index over (…equality fields…, orderBy field).
 * If that index is absent the query throws `FAILED_PRECONDITION`, the trigger
 * never writes `userStats/{uid}/perExercise/{exerciseId}`, and every consumer
 * of that aggregate silently reads empty — most visibly the per-exercise
 * "Alle Zeit" leaderboard, which is sourced from `perExercise/*.total`.
 *
 * The `pushups (userId, timestamp)` index shipped; the matching
 * `exerciseEntries (userId, exerciseId, timestamp)` one did not — so all-time
 * was empty for every non-pushup exercise (e.g. Crunches). Pushup hid the bug
 * because its aggregate is seeded by a separate backfill, not the rebuild
 * query. This guard keeps both indexes declared.
 */

interface IndexField {
  fieldPath: string;
  order?: string;
  arrayConfig?: string;
}

interface CompositeIndex {
  collectionGroup: string;
  queryScope?: string;
  fields: IndexField[];
}

const INDEXES_PATH = join(__dirname, '..', '..', 'firestore.indexes.json');

function loadIndexes(): CompositeIndex[] {
  const raw = JSON.parse(readFileSync(INDEXES_PATH, 'utf8')) as {
    indexes?: CompositeIndex[];
  };
  return raw.indexes ?? [];
}

/**
 * True when an ASCENDING composite index over exactly `fieldPaths` (in order)
 * is declared for `collectionGroup` — the shape a `where(==)…orderBy(asc)`
 * rebuild query needs.
 */
function hasAscendingIndex(
  indexes: CompositeIndex[],
  collectionGroup: string,
  fieldPaths: readonly string[]
): boolean {
  return indexes.some(
    (idx) =>
      idx.collectionGroup === collectionGroup &&
      idx.fields.length === fieldPaths.length &&
      idx.fields.every(
        (f, i) => f.fieldPath === fieldPaths[i] && f.order === 'ASCENDING'
      )
  );
}

describe('firestore.indexes.json ⇄ delta-aggregation rebuild queries', () => {
  const indexes = loadIndexes();

  it('should declare the (userId, timestamp) index updateUserStatsOnPushupWrite rebuilds from', () => {
    // given the pushup aggregation trigger's chronological rebuild fetch
    // when looking up its supporting composite index
    const declared = hasAscendingIndex(indexes, 'pushups', [
      'userId',
      'timestamp',
    ]);
    // then it is declared
    expect(declared).toBe(true);
  });

  it('should declare the (userId, exerciseId, timestamp) index updateExerciseStatsOnEntryWrite rebuilds from', () => {
    // given the per-exercise aggregation trigger's chronological rebuild fetch
    // (where('userId','==').where('exerciseId','==').orderBy('timestamp')) —
    // without this index it throws FAILED_PRECONDITION, perExercise/{id} is
    // never written, and "Alle Zeit" stays empty for every non-pushup exercise
    // when looking up its supporting composite index
    const declared = hasAscendingIndex(indexes, 'exerciseEntries', [
      'userId',
      'exerciseId',
      'timestamp',
    ]);
    // then it is declared
    expect(declared).toBe(true);
  });
});
