import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ANONYMIZED_QUERIES,
  OWNED_QUERIES,
  UID_KEYED_COLLECTIONS,
  UID_PREFIXED_COLLECTIONS,
} from './plan';

const RULES_PATH = join(__dirname, '..', '..', '..', 'firestore.rules');

/** Collections that hold nothing about an individual user. */
const NOT_USER_DATA = new Set([
  'leaderboards',
  'autoCountProfiles',
  'xpConfig',
  'deletedAccounts',
]);

/** Handled by a dedicated step in `purge.ts` rather than by the tables. */
const SPECIAL_CASED = new Set(['challenges']);

/** `match` blocks directly under `/databases/{database}/documents`. */
function topLevelCollections(rules: string): string[] {
  const names = [...rules.matchAll(/^ {4}match \/([A-Za-z]+)\/\{/gm)].map(
    (m) => m[1]
  );
  return [...new Set(names)].sort();
}

describe('account purge inventory ⇄ firestore.rules', () => {
  it('should cover every collection the rules open up', () => {
    // given every top-level collection that has its own rule
    const collections = topLevelCollections(readFileSync(RULES_PATH, 'utf8'));
    const covered = new Set<string>([
      ...UID_KEYED_COLLECTIONS,
      ...UID_PREFIXED_COLLECTIONS,
      ...UID_PREFIXED_COLLECTIONS,
      ...OWNED_QUERIES.map((q) => q.collection),
      ...ANONYMIZED_QUERIES.map((q) => q.collection),
      ...SPECIAL_CASED,
      ...NOT_USER_DATA,
    ]);

    // when the ones the purge does not know about are collected
    const unknown = collections.filter((c) => !covered.has(c));

    // then there are none — a new per-user collection has to be added to
    // `account-deletion/plan.ts`, or it survives every deleted account
    expect(unknown).toEqual([]);
  });

  it('should find the collections in the rules file at all', () => {
    // given / when
    const collections = topLevelCollections(readFileSync(RULES_PATH, 'utf8'));

    // then the parser is not silently matching nothing
    expect(collections).toEqual(
      expect.arrayContaining(['exerciseEntries', 'userConfigs', 'workouts'])
    );
  });
});
