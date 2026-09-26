import { describe, expect, it } from '@jest/globals';

import { pendingTrainingUsers } from './backfill-plan';

describe('pendingTrainingUsers', () => {
  it('should list every user with entries but no current aggregate once, sorted', () => {
    // when
    const pending = pendingTrainingUsers(
      ['b', 'a', 'b', 'c'],
      new Set(['c']),
      new Set()
    );

    // then
    expect(pending).toEqual(['a', 'b']);
  });

  it('should skip excluded users and malformed ids', () => {
    // when
    const pending = pendingTrainingUsers(
      ['demo', '', undefined, 42, 'a'],
      new Set(),
      new Set(['demo'])
    );

    // then
    expect(pending).toEqual(['a']);
  });

  it('should be empty once every user has an aggregate', () => {
    // then
    expect(pendingTrainingUsers(['a'], new Set(['a']), new Set())).toEqual([]);
  });
});
