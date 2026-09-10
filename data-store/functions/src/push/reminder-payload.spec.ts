import { describe, expect, it } from '@jest/globals';
import { dailyReminderGoal } from '@pu-stats/models';

import {
  buildReminderPushPayload,
  reminderActionUrl,
  reminderBody,
} from './reminder-payload';

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.parse(
    buildReminderPushPayload({
      uid: 'u1',
      locale: 'de',
      quote: 'Los geht’s!',
      goal: null,
      quickLogReps: undefined,
      actionToken: 'tok',
      actionUrl: 'https://example.test/reminderAction',
      ...overrides,
    } as Parameters<typeof buildReminderPushPayload>[0])
  );
}

describe('push/reminder-payload', () => {
  describe('reminderBody', () => {
    it('should lead with the open goal and keep the quote below it', () => {
      // when
      const body = reminderBody(
        'de',
        'Los geht’s!',
        dailyReminderGoal(40, 100)
      );

      // then
      expect(body).toBe('Tagesziel: 40/100 – noch 60\nLos geht’s!');
    });

    it('should be the quote alone when there is no goal', () => {
      // when / then
      expect(reminderBody('de', 'Los geht’s!', null)).toBe('Los geht’s!');
    });
  });

  describe('buildReminderPushPayload', () => {
    it('should carry the goal line in the notification body', () => {
      // when
      const data = payload({ goal: dailyReminderGoal(40, 100) });

      // then
      expect(data.body).toContain('Tagesziel: 40/100');
      expect(data.title).toBe('PushUp Stats');
    });

    it('should offer the generic log action without a quick-log count', () => {
      // when
      const data = payload();

      // then
      expect(data.actions).toEqual([{ action: 'log', title: '✅ Eintragen' }]);
      expect(data.data.feedback.logged).toBeUndefined();
    });

    it('should show the same count on the button and in the feedback', () => {
      // when
      const data = payload({ quickLogReps: 25 });

      // then
      expect(data.actions).toEqual([
        { action: 'quick-log', title: '✅ 25 eintragen' },
      ]);
      expect(data.data.feedback.logged).toBe('✅ 25 Liegestütze eingetragen');
    });

    it('should hand the service worker the action token and endpoint', () => {
      // when
      const data = payload();

      // then
      expect(data.data.reminderAction).toEqual({
        uid: 'u1',
        token: 'tok',
        url: 'https://example.test/reminderAction',
      });
      expect(data.data.url).toBe('/de/app');
    });

    it('should localise body and deep link per user locale', () => {
      // when
      const data = payload({
        locale: 'en',
        goal: dailyReminderGoal(40, 100),
      });

      // then
      expect(data.body).toContain('Daily goal: 40/100');
      expect(data.data.url).toBe('/en/app');
    });
  });

  describe('reminderActionUrl', () => {
    it('should target the project the function runs in', () => {
      // given
      const previous = process.env['GCLOUD_PROJECT'];
      process.env['GCLOUD_PROJECT'] = 'pushup-stats-staging';

      // when / then
      try {
        expect(reminderActionUrl()).toBe(
          'https://europe-west3-pushup-stats-staging.cloudfunctions.net/reminderAction'
        );
      } finally {
        if (previous === undefined) delete process.env['GCLOUD_PROJECT'];
        else process.env['GCLOUD_PROJECT'] = previous;
      }
    });
  });
});
