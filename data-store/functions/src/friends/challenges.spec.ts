import { describe, expect, it } from '@jest/globals';

import {
  activeChallengeCount,
  buildChallengeView,
  challengeEntryBounds,
  invitedOf,
  sanitizeExerciseName,
  visibleChallenges,
  type ChallengeDoc,
} from './challenges';

function doc(over: Partial<ChallengeDoc> = {}): ChallengeDoc {
  return {
    id: 'c1',
    createdBy: 'a',
    participants: ['a', 'b'],
    invited: [],
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
    it('should say so when a sum could not be read', () => {
      // given — one participant's aggregate failed
      const view = buildChallengeView(
        doc(),
        new Map([['a', 10]]),
        new Map(),
        'a',
        '2026-09-15',
        { failedSums: new Set(['b']) }
      );

      // then
      expect(view.progressUnavailable).toBe(true);
      expect(
        buildChallengeView(doc(), new Map(), new Map(), 'a', '2026-09-15')
          .progressUnavailable
      ).toBe(false);
    });

    it('should rank participants, keep zeros and mark the viewer', () => {
      // given
      const sums = new Map([['b', 320]]);
      const names = new Map([['b', 'Bob']]);

      // when
      const view = buildChallengeView(doc(), sums, names, 'a', '2026-09-15');

      // then
      expect(view.status).toBe('active');
      expect(view.viewerInvited).toBe(false);
      expect(view.entries).toEqual([
        {
          uid: 'b',
          displayName: 'Bob',
          value: 320,
          isViewer: false,
          canCheer: false,
          cheered: false,
        },
        {
          uid: 'a',
          displayName: null,
          value: 0,
          isViewer: true,
          canCheer: false,
          cheered: false,
        },
      ]);
    });

    it('should offer a cheer only for the viewer’s friends in a running challenge', () => {
      // given — b is a friend already cheered today, c is not a friend
      const extras = {
        friendUids: new Set(['b']),
        cheeredByViewer: new Set(['b']),
      };
      const running = doc({ participants: ['a', 'b', 'c'] });

      // when
      const view = buildChallengeView(
        running,
        new Map(),
        new Map(),
        'a',
        '2026-09-15',
        extras
      );
      const ended = buildChallengeView(
        { ...running, to: '2026-09-14' },
        new Map(),
        new Map(),
        'a',
        '2026-09-15',
        extras
      );

      // then
      const byUid = new Map(view.entries.map((e) => [e.uid, e]));
      expect(byUid.get('a')).toMatchObject({ canCheer: false });
      expect(byUid.get('b')).toMatchObject({ canCheer: true, cheered: true });
      expect(byUid.get('c')).toMatchObject({ canCheer: false, cheered: false });
      expect(ended.entries.some((e) => e.canCheer)).toBe(false);
    });

    it('should show an invitee the framing but nobody’s numbers', () => {
      // given — c was asked and has not answered
      const sums = new Map([
        ['a', 100],
        ['b', 320],
      ]);
      const names = new Map([['b', 'Bob']]);

      // when
      const view = buildChallengeView(
        doc({ invited: ['c'] }),
        sums,
        names,
        'c',
        '2026-09-15'
      );

      // then
      expect(view.viewerInvited).toBe(true);
      expect(view.entries).toEqual([]);
      expect(view.invited).toEqual([{ uid: 'c', displayName: null }]);
    });

    it('should list who is still to answer for a participant', () => {
      // when
      const view = buildChallengeView(
        doc({ invited: ['c'] }),
        new Map(),
        new Map([['c', 'Cy']]),
        'a',
        '2026-09-15'
      );

      // then
      expect(view.invited).toEqual([{ uid: 'c', displayName: 'Cy' }]);
      expect(view.entries.map((e) => e.uid)).toEqual(['a', 'b']);
    });

    it('should treat a document without an invited list as having none', () => {
      // given a challenge written before invitations existed
      const legacy = doc();
      delete (legacy as { invited?: string[] }).invited;

      // when / then
      expect(invitedOf(legacy)).toEqual([]);
      expect(
        buildChallengeView(legacy, new Map(), new Map(), 'a', '2026-09-15')
          .invited
      ).toEqual([]);
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
