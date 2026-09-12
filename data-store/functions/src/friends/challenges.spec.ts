import { describe, expect, it } from '@jest/globals';

import {
  activeChallengeCount,
  buildChallengeView,
  challengeEntryBounds,
  sanitizeExerciseName,
  visibleChallenges,
  type ChallengeDoc,
} from './challenges';

function doc(over: Partial<ChallengeDoc> = {}): ChallengeDoc {
  return {
    id: 'c1',
    createdBy: 'a',
    participants: ['a', 'b'],
    exerciseId: 'pushup',
    target: 500,
    from: '2026-09-14',
    to: '2026-09-20',
    createdAt: '2026-09-14T08:00:00.000Z',
    ...over,
  };
}

describe('friends/challenges', () => {
  describe('visibleChallenges', () => {
    it('should keep active ones and results up to a week old, newest first', () => {
      // given
      const docs = [
        doc({ id: 'old', to: '2026-09-01', createdAt: '2026-08-20T00:00:00Z' }),
        doc({
          id: 'recent',
          to: '2026-09-10',
          createdAt: '2026-09-04T00:00:00Z',
        }),
        doc({ id: 'active', createdAt: '2026-09-14T00:00:00Z' }),
      ];

      // when
      const visible = visibleChallenges(docs, '2026-09-15');

      // then
      expect(visible.map((d) => d.id)).toEqual(['active', 'recent']);
    });
  });

  it('should count only challenges that are still running', () => {
    // when / then
    expect(
      activeChallengeCount(
        [doc({ to: '2026-09-20' }), doc({ to: '2026-09-14' })],
        '2026-09-15'
      )
    ).toBe(1);
  });

  it('should bound the entry query by date prefixes', () => {
    // when / then — the day after `to` is exclusive
    expect(
      challengeEntryBounds({ from: '2026-09-14', to: '2026-09-20' })
    ).toEqual({
      fromInclusive: '2026-09-14',
      toExclusive: '2026-09-21',
    });
  });

  describe('sanitizeExerciseName', () => {
    it('should keep a plain label and drop markup', () => {
      // when / then
      expect(sanitizeExerciseName('Liegestütze', 'pushup')).toBe('Liegestütze');
      expect(sanitizeExerciseName('<b>Squats</b>', 'legs.squats')).toBe(
        'bSquatsb'
      );
    });

    it('should fall back to the id when nothing usable is left', () => {
      // when / then
      expect(sanitizeExerciseName('', 'pushup')).toBe('pushup');
      expect(sanitizeExerciseName(42, 'pushup')).toBe('pushup');
      expect(sanitizeExerciseName('x'.repeat(80), 'pushup')).toHaveLength(40);
    });
  });

  describe('buildChallengeView', () => {
    it('should rank participants, keep zeros and mark the viewer', () => {
      // given
      const sums = new Map([['b', 320]]);
      const names = new Map([['b', 'Bob']]);

      // when
      const view = buildChallengeView(doc(), sums, names, 'a', '2026-09-15');

      // then
      expect(view.status).toBe('active');
      expect(view.entries).toEqual([
        { uid: 'b', displayName: 'Bob', value: 320, isViewer: false },
        { uid: 'a', displayName: null, value: 0, isViewer: true },
      ]);
    });

    it('should report an ended challenge as such', () => {
      // when
      const view = buildChallengeView(
        doc({ to: '2026-09-14' }),
        new Map(),
        new Map(),
        'a',
        '2026-09-15'
      );

      // then
      expect(view.status).toBe('ended');
    });
  });
});
