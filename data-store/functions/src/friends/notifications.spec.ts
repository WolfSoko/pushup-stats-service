import { describe, expect, it } from '@jest/globals';
import { newFriendship, SUPPORTED_REMINDER_LOCALES } from '@pu-stats/models';

import {
  buildFriendPushPayload,
  friendPushOptions,
  friendshipPushEvent,
} from './notifications';

const pending = newFriendship('a', 'b', '2026-09-14T10:00:00.000Z');
const accepted = { ...pending, status: 'accepted' as const };
const declined = { ...pending, status: 'declined' as const };

describe('friends/notifications', () => {
  describe('friendshipPushEvent', () => {
    it('should wake the person asked when a request is created', () => {
      // when / then
      expect(friendshipPushEvent(undefined, pending)).toEqual({
        kind: 'request',
        to: 'b',
        from: 'a',
      });
    });

    it('should wake the person who asked when it is accepted', () => {
      // when / then
      expect(friendshipPushEvent(pending, accepted)).toEqual({
        kind: 'accepted',
        to: 'a',
        from: 'b',
      });
    });

    it('should stay silent on declines, removals and no-op writes', () => {
      // when / then
      expect(friendshipPushEvent(pending, declined)).toBeNull();
      expect(friendshipPushEvent(accepted, undefined)).toBeNull();
      expect(friendshipPushEvent(accepted, accepted)).toBeNull();
      expect(friendshipPushEvent(undefined, accepted)).toBeNull();
    });

    it('should ignore a malformed pair', () => {
      // when / then
      expect(
        friendshipPushEvent(undefined, { ...pending, users: ['a'] })
      ).toBeNull();
    });
  });

  describe('buildFriendPushPayload', () => {
    it('should name the requester and link to the friends screen', () => {
      // when
      const data = JSON.parse(
        buildFriendPushPayload({
          kind: 'request',
          locale: 'de',
          actorName: 'Ada',
        })
      );

      // then
      expect(data.title).toContain('Freundschaftsanfrage');
      expect(data.body).toBe('Ada möchte mit dir trainieren.');
      expect(data.data).toEqual({ url: '/de/freunde', locale: 'de' });
      expect(data.tag).toBe('friend-request');
    });

    it('should ship an empty action list so the SW adds no log button', () => {
      // when
      const data = JSON.parse(
        buildFriendPushPayload({ kind: 'cheer', locale: 'en', actorName: null })
      );

      // then
      expect(data.actions).toEqual([]);
      expect(data.body).toBe('Someone is cheering you on – keep going!');
    });

    it('should spell out the challenge', () => {
      // when
      const data = JSON.parse(
        buildFriendPushPayload({
          kind: 'challenge',
          locale: 'de',
          actorName: 'Bob',
          challenge: { target: 500, exerciseName: 'Liegestütze', days: 7 },
        })
      );

      // then
      expect(data.body).toBe(
        'Bob fordert dich heraus: 500 Liegestütze in 7 Tagen.'
      );
    });

    it.each(SUPPORTED_REMINDER_LOCALES)(
      'should have every text for locale %s',
      (locale) => {
        // when / then — no locale falls through to an empty string
        for (const kind of ['request', 'accepted', 'cheer'] as const) {
          const data = JSON.parse(
            buildFriendPushPayload({ kind, locale, actorName: 'X' })
          );
          expect(data.title.length).toBeGreaterThan(0);
          expect(data.body).toContain('X');
        }
      }
    );
  });

  it('should give every kind its own collapse topic', () => {
    // when / then
    expect(friendPushOptions('request').topic).toBe('friend-request');
    expect(friendPushOptions('cheer').topic).not.toBe(
      friendPushOptions('accepted').topic
    );
  });
});
