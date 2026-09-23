import { describe, expect, it } from '@jest/globals';
import { WORKOUT_REMINDER_GRACE_MS } from '@pu-stats/models';

import { decideWorkoutReminder } from './reminder-dispatch';
import {
  buildWorkoutReminderPayload,
  workoutReminderPushOptions,
} from './reminder-push';

const DUE_AT = '2026-09-23T13:00:00.000Z'; // 15:00 Berlin

function stored(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: 'owner',
    workoutId: 'w1',
    enabled: true,
    time: '15:00',
    repeat: { kind: 'interval', everyDays: 2, startDate: '2026-09-23' },
    timezone: 'Europe/Berlin',
    nextAt: DUE_AT,
    updatedAt: '2026-09-22T10:00:00.000Z',
    ...overrides,
  };
}

describe('decideWorkoutReminder', () => {
  it('should send a due reminder and move nextAt two days on', () => {
    // given
    const now = new Date('2026-09-23T13:02:00.000Z');

    // when
    const decision = decideWorkoutReminder('w1', stored(), now);

    // then
    expect(decision).toMatchObject({
      action: 'send',
      nextAt: '2026-09-25T13:00:00.000Z',
      reminder: { workoutId: 'w1', ownerId: 'owner' },
    });
  });

  it('should advance without sending once the grace window has passed', () => {
    // given the dispatcher was down for an hour
    const now = new Date(Date.parse(DUE_AT) + WORKOUT_REMINDER_GRACE_MS + 1);

    // when
    const decision = decideWorkoutReminder('w1', stored(), now);

    // then
    expect(decision).toMatchObject({
      action: 'advance',
      nextAt: '2026-09-25T13:00:00.000Z',
    });
  });

  it('should wait when the client moved nextAt since the query', () => {
    // given
    const now = new Date('2026-09-23T13:02:00.000Z');

    // when
    const decision = decideWorkoutReminder(
      'w1',
      stored({ nextAt: '2026-09-24T13:00:00.000Z' }),
      now
    );

    // then
    expect(decision).toEqual({ action: 'wait' });
  });

  it('should wait for a reminder switched off since the query', () => {
    // when
    const decision = decideWorkoutReminder(
      'w1',
      stored({ enabled: false }),
      new Date('2026-09-23T13:02:00.000Z')
    );

    // then
    expect(decision).toEqual({ action: 'wait' });
  });

  it('should disable a document that is not a schedule', () => {
    // when
    const decision = decideWorkoutReminder(
      'w1',
      stored({ time: 'soon' }),
      new Date('2026-09-23T13:02:00.000Z')
    );

    // then
    expect(decision).toEqual({ action: 'disable' });
  });

  it('should repair an unreadable nextAt without sending', () => {
    // when
    const decision = decideWorkoutReminder(
      'w1',
      stored({ nextAt: 'garbage' }),
      new Date('2026-09-23T13:02:00.000Z')
    );

    // then
    expect(decision).toMatchObject({
      action: 'advance',
      nextAt: '2026-09-25T13:00:00.000Z',
    });
  });
});

describe('buildWorkoutReminderPayload', () => {
  it('should name the session and open its run page in the user’s locale', () => {
    // when
    const payload = JSON.parse(
      buildWorkoutReminderPayload({
        locale: 'en',
        workoutId: 'w1',
        title: 'Core 15',
      })
    );

    // then
    expect(payload).toMatchObject({
      title: '⏰ Core 15',
      body: 'Time for your session. Tap to start right away.',
      tag: 'workout-reminder-w1',
      data: { url: '/en/workouts/w1/run', locale: 'en' },
      actions: [],
    });
  });
});

describe('workoutReminderPushOptions', () => {
  it('should collapse per workout within the 32-character topic limit', () => {
    // when
    const options = workoutReminderPushOptions('a'.repeat(40));

    // then
    expect(options.topic).toBe(`wr-${'a'.repeat(29)}`);
    expect(options.topic.length).toBe(32);
    expect(options).toMatchObject({ urgency: 'high', TTL: 1800 });
  });
});
