import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the composite indexes the stats-aggregation triggers depend on.
 *
 * Both rebuild a user's lifetime aggregate with an equality-filtered query
 * ordered by timestamp. Firestore serves `where(==)…orderBy(other field)` only
 * from a composite index over (…equality fields…, orderBy field); if it is
 * absent the query is rejected and the aggregate (and everything sourced from
 * it) is never written. Any such query must ship its index in
 * `firestore.indexes.json`.
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
 * True when a `COLLECTION`-scoped ASCENDING composite index over exactly
 * `fieldPaths` (in order) is declared for `collectionGroup` — the shape a
 * plain-collection `where(==)…orderBy(asc)` rebuild query needs. The scope
 * check matters: the triggers query a single collection, so a
 * `COLLECTION_GROUP` index would not satisfy them.
 */
function hasAscendingIndex(
  indexes: CompositeIndex[],
  collectionGroup: string,
  fieldPaths: readonly string[]
): boolean {
  return indexes.some(
    (idx) =>
      idx.collectionGroup === collectionGroup &&
      idx.queryScope === 'COLLECTION' &&
      idx.fields.length === fieldPaths.length &&
      idx.fields.every(
        (f, i) => f.fieldPath === fieldPaths[i] && f.order === 'ASCENDING'
      )
  );
}

describe('firestore.indexes.json ⇄ delta-aggregation rebuild queries', () => {
  const indexes = loadIndexes();

  it('should declare the (userId, timestamp) index rebuildUserStats rebuilds from', () => {
    // given rebuildUserStats's chronological rebuild fetch from the pushups collection
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

  it('should declare the (userId ASC, timestamp DESC) index adminListUserEntries reads from', () => {
    // given adminListUserEntries' newest-first fetch
    // (where('userId','==').orderBy('timestamp','desc').limit(n)) — the
    // descending timestamp order needs its own composite index; the ascending
    // one does NOT serve it, so without this the callable throws
    // FAILED_PRECONDITION and the admin entries page can't load
    // when looking up its supporting composite index
    const declared = indexes.some(
      (idx) =>
        idx.collectionGroup === 'exerciseEntries' &&
        idx.queryScope === 'COLLECTION' &&
        idx.fields.length === 2 &&
        idx.fields[0].fieldPath === 'userId' &&
        idx.fields[0].order === 'ASCENDING' &&
        idx.fields[1].fieldPath === 'timestamp' &&
        idx.fields[1].order === 'DESCENDING'
    );
    // then it is declared
    expect(declared).toBe(true);
  });
});
