import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the composite indexes the `exerciseEntries` queries depend on.
 *
 * Firestore serves `where(==)…orderBy(other field)` only from a composite
 * index over (…equality fields…, orderBy field); if it is absent the query is
 * rejected at runtime with FAILED_PRECONDITION — nothing fails at build time,
 * so every such query must ship its index in `firestore.indexes.json`.
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

interface FieldOverride {
  collectionGroup: string;
  fieldPath: string;
  indexes: IndexField[];
}

const INDEXES_PATH = join(__dirname, '..', '..', 'firestore.indexes.json');

function loadConfig(): {
  indexes: CompositeIndex[];
  fieldOverrides: FieldOverride[];
} {
  const raw = JSON.parse(readFileSync(INDEXES_PATH, 'utf8')) as {
    indexes?: CompositeIndex[];
    fieldOverrides?: FieldOverride[];
  };
  return {
    indexes: raw.indexes ?? [],
    fieldOverrides: raw.fieldOverrides ?? [],
  };
}

/**
 * True when a `COLLECTION`-scoped composite index over exactly `fields`
 * (field path + order, in order) is declared for `collectionGroup`. The scope
 * check matters: every query below runs against a single collection, so a
 * `COLLECTION_GROUP` index would not satisfy it.
 */
function hasIndex(
  indexes: CompositeIndex[],
  collectionGroup: string,
  fields: ReadonlyArray<readonly [string, string]>
): boolean {
  return indexes.some(
    (idx) =>
      idx.collectionGroup === collectionGroup &&
      idx.queryScope === 'COLLECTION' &&
      idx.fields.length === fields.length &&
      idx.fields.every(
        (f, i) => f.fieldPath === fields[i][0] && f.order === fields[i][1]
      )
  );
}

describe('firestore.indexes.json ⇄ exerciseEntries queries', () => {
  const { indexes } = loadConfig();

  it('should declare the (userId, timestamp ASC) index the live entry feed reads from', () => {
    // given the widest-reaching query shape in the app —
    // `where('userId','==').orderBy('timestamp','asc')` — behind the live
    // dashboard feed (`live-data.store`), `listEntries` without an exercise
    // filter, `hasEntrySince`'s bounded range check, and the
    // `limitToLast(1)` max-timestamp recompute in `adminUserActivity`
    // when looking up its supporting composite index
    const declared = hasIndex(indexes, 'exerciseEntries', [
      ['userId', 'ASCENDING'],
      ['timestamp', 'ASCENDING'],
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
    const declared = hasIndex(indexes, 'exerciseEntries', [
      ['userId', 'ASCENDING'],
      ['exerciseId', 'ASCENDING'],
      ['timestamp', 'ASCENDING'],
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
    const declared = hasIndex(indexes, 'exerciseEntries', [
      ['userId', 'ASCENDING'],
      ['timestamp', 'DESCENDING'],
    ]);
    // then it is declared
    expect(declared).toBe(true);
  });

  it('should not declare indexes for the emptied pushups collection', () => {
    // given the pushups collection, fully migrated into exerciseEntries and
    // no longer written or queried by any live code path
    // when looking for any index still declared for it
    const declared = indexes.filter((idx) => idx.collectionGroup === 'pushups');
    // then none is
    expect(declared).toEqual([]);
  });
});

describe('firestore.indexes.json ⇄ single-field index exemptions', () => {
  const { fieldOverrides } = loadConfig();

  function isExempt(collectionGroup: string, fieldPath: string): boolean {
    return fieldOverrides.some(
      (o) =>
        o.collectionGroup === collectionGroup &&
        o.fieldPath === fieldPath &&
        o.indexes.length === 0
    );
  }

  it('should exempt the archived entry payload from automatic indexing', () => {
    // given `deletedExerciseEntries.entry`, a verbatim copy of the deleted
    // document that no code path and no client ever queries — the exemption
    // covers its subfields too, so the whole payload stays unindexed
    // when checking the declared exemptions
    // then it is exempt
    expect(isExempt('deletedExerciseEntries', 'entry')).toBe(true);
  });

  it.each(['sets', 'intervals', 'intervalDurationsSec'])(
    'should exempt the %s array from automatic indexing',
    (fieldPath) => {
      // given an entry breakdown array — automatic indexing writes one index
      // entry per element, and no query in the repo uses array-contains on it
      // when checking the declared exemptions
      // then it is exempt
      expect(isExempt('exerciseEntries', fieldPath)).toBe(true);
    }
  );
});
