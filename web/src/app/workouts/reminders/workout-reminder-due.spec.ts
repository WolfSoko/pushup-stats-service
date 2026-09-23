import {
  WORKOUT_REMINDER_GRACE_MS,
  type WorkoutReminder,
} from '@pu-stats/models';

import { dueInAppOccurrence } from './workout-reminder-due';

const DAILY_15: WorkoutReminder = {
  workoutId: 'w1',
  ownerId: 'u1',
  enabled: true,
  time: '15:00',
  repeat: { kind: 'interval', everyDays: 1, startDate: '2026-09-01' },
  timezone: 'Europe/Berlin',
  nextAt: '2026-09-23T13:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
};
const AT = new Date('2026-09-23T13:00:00.000Z');

describe('dueInAppOccurrence', () => {
  it('should return the occurrence that just passed', () => {
    // when
    const due = dueInAppOccurrence(
      DAILY_15,
      new Date('2026-09-23T13:01:00.000Z'),
      null
    );

    // then
    expect(due).toEqual(AT);
  });

  it('should ignore an occurrence already shown on this device', () => {
    // when
    const due = dueInAppOccurrence(
      DAILY_15,
      new Date('2026-09-23T13:01:00.000Z'),
      AT.toISOString()
    );

    // then
    expect(due).toBeNull();
  });

  it('should ignore an occurrence past the grace window', () => {
    // when
    const due = dueInAppOccurrence(
      DAILY_15,
      new Date(AT.getTime() + WORKOUT_REMINDER_GRACE_MS + 1),
      null
    );

    // then
    expect(due).toBeNull();
  });

  it('should ignore the occurrence that passed before the reminder was saved', () => {
    // given the user set "daily 15:00" at 15:10
    const reminder = { ...DAILY_15, updatedAt: '2026-09-23T13:10:00.000Z' };

    // when
    const due = dueInAppOccurrence(
      reminder,
      new Date('2026-09-23T13:11:00.000Z'),
      null
    );

    // then
    expect(due).toBeNull();
  });

  it('should ignore a disabled reminder', () => {
    // when
    const due = dueInAppOccurrence(
      { ...DAILY_15, enabled: false },
      new Date('2026-09-23T13:01:00.000Z'),
      null
    );

    // then
    expect(due).toBeNull();
  });
});
