import {
  NOTIFICATION_RETENTION_MS,
  notificationCategory,
  notificationDocId,
  shouldPushNotification,
} from './notification.models';

describe('notificationCategory', () => {
  it('should group a cheer with motivation, not with the social noise', () => {
    // then
    expect(notificationCategory('cheer')).toBe('motivation');
  });

  it('should group a reached goal with motivation, next to the cheer', () => {
    // then
    expect(notificationCategory('goalReached')).toBe('motivation');
  });

  it('should give an earned badge its own category', () => {
    // then
    expect(notificationCategory('achievement')).toBe('achievement');
  });

  it.each([
    'friendRequest',
    'friendAccepted',
    'challenge',
    'challengeAccepted',
    'workoutShared',
  ] as const)('should treat %s as social', (type) => {
    // then
    expect(notificationCategory(type)).toBe('social');
  });
});

describe('notificationDocId', () => {
  it('should scope a cheer to sender and day so a second cheer the same day overwrites', () => {
    // given
    const day = '2026-09-20';

    // when
    const id = notificationDocId({ type: 'cheer', actorUid: 'anna', day });

    // then
    expect(id).toBe('cheer__anna__2026-09-20');
  });

  it('should give the same sender a fresh row on the next day', () => {
    // when
    const monday = notificationDocId({
      type: 'cheer',
      actorUid: 'anna',
      day: '2026-09-20',
    });
    const tuesday = notificationDocId({
      type: 'cheer',
      actorUid: 'anna',
      day: '2026-09-21',
    });

    // then
    expect(monday).not.toBe(tuesday);
  });

  it('should scope a friend request to the actor so a re-sent request replaces the old row', () => {
    // when
    const id = notificationDocId({ type: 'friendRequest', actorUid: 'bob' });

    // then
    expect(id).toBe('friendRequest__bob');
  });

  it('should keep request and acceptance from the same actor apart', () => {
    // when
    const request = notificationDocId({
      type: 'friendRequest',
      actorUid: 'bob',
    });
    const accepted = notificationDocId({
      type: 'friendAccepted',
      actorUid: 'bob',
    });

    // then
    expect(request).not.toBe(accepted);
  });

  it('should scope an achievement to its badge so a re-award cannot duplicate it', () => {
    // when
    const id = notificationDocId({
      type: 'achievement',
      achievementId: 'plan-days-25',
    });

    // then
    expect(id).toBe('achievement__plan-days-25');
  });

  it('should scope a reached goal to its day, so only the first one counts', () => {
    // when
    const id = notificationDocId({ type: 'goalReached', day: '2026-09-20' });

    // then
    expect(id).toBe('goalReached__2026-09-20');
  });

  it.each(['challenge', 'challengeAccepted', 'workoutShared'] as const)(
    'should let Firestore assign an id for %s, where every occurrence is its own entry',
    (type) => {
      // when
      const id = notificationDocId({ type });

      // then
      expect(id).toBeNull();
    }
  );
});

describe('NOTIFICATION_RETENTION_MS', () => {
  it('should keep entries for 30 days', () => {
    // then
    expect(NOTIFICATION_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe('shouldPushNotification', () => {
  const NOON = new Date('2026-09-20T12:00:00Z');
  const NIGHT = new Date('2026-09-20T23:30:00Z');
  const QUIET = {
    reminder: {
      quietHours: [{ from: '22:00', to: '07:00' }],
      timezone: 'UTC',
    },
  };

  it('should push when nothing is configured, keeping the old default', () => {
    // then
    expect(shouldPushNotification(undefined, 'cheer', NOON)).toBe(true);
  });

  it('should push a type the user has not switched off', () => {
    // then
    expect(
      shouldPushNotification(
        { notificationPrefs: { challenge: false } },
        'cheer',
        NOON
      )
    ).toBe(true);
  });

  it('should stay silent for a type the user switched off', () => {
    // then
    expect(
      shouldPushNotification(
        { notificationPrefs: { cheer: false } },
        'cheer',
        NOON
      )
    ).toBe(false);
  });

  it('should treat an explicit true the same as unset', () => {
    // then
    expect(
      shouldPushNotification(
        { notificationPrefs: { cheer: true } },
        'cheer',
        NOON
      )
    ).toBe(true);
  });

  it('should respect the quiet hours the user set for reminders', () => {
    // then — one switch for one wish, not a second set of night hours
    expect(shouldPushNotification(QUIET, 'cheer', NIGHT)).toBe(false);
  });

  it('should push outside quiet hours', () => {
    // then
    expect(shouldPushNotification(QUIET, 'cheer', NOON)).toBe(true);
  });
});
