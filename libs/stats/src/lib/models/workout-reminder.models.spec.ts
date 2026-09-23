import {
  localIsoDate,
  nextWorkoutReminderAt,
  previousWorkoutReminderAt,
  zonedTimeToInstant,
  type WorkoutReminderSchedule,
} from './workout-reminder-schedule';
import {
  normalizeWorkoutReminder,
  WORKOUT_REMINDER_GRACE_MS,
  workoutReminderDocument,
  workoutReminderDue,
  workoutReminderRejection,
} from './workout-reminder.models';

const BERLIN = 'Europe/Berlin';

function everyTwoDays(
  overrides: Partial<WorkoutReminderSchedule> = {}
): WorkoutReminderSchedule {
  return {
    time: '15:00',
    repeat: { kind: 'interval', everyDays: 2, startDate: '2026-09-23' },
    timezone: BERLIN,
    ...overrides,
  };
}

const MON_WED_FRI: WorkoutReminderSchedule = {
  time: '07:30',
  repeat: { kind: 'weekdays', weekdays: [1, 3, 5] },
  timezone: BERLIN,
};

describe('zonedTimeToInstant', () => {
  it('should resolve a summer wall-clock time in Berlin to UTC+2', () => {
    // when
    const at = zonedTimeToInstant('2026-09-23', '15:00', BERLIN);

    // then
    expect(at?.toISOString()).toBe('2026-09-23T13:00:00.000Z');
  });

  it('should resolve a winter wall-clock time in Berlin to UTC+1', () => {
    // when
    const at = zonedTimeToInstant('2026-12-01', '15:00', BERLIN);

    // then
    expect(at?.toISOString()).toBe('2026-12-01T14:00:00.000Z');
  });

  it('should honour zones behind UTC', () => {
    // when
    const at = zonedTimeToInstant('2026-09-23', '15:00', 'America/New_York');

    // then
    expect(at?.toISOString()).toBe('2026-09-23T19:00:00.000Z');
  });

  it('should return null for an impossible date or time', () => {
    // then
    expect(zonedTimeToInstant('2026-02-30', '15:00', BERLIN)).toBeNull();
    expect(zonedTimeToInstant('2026-09-23', '24:00', BERLIN)).toBeNull();
  });

  it('should fall back to Berlin for an unknown zone', () => {
    // when
    const at = zonedTimeToInstant('2026-09-23', '15:00', 'Mars/Olympus');

    // then
    expect(at?.toISOString()).toBe('2026-09-23T13:00:00.000Z');
  });
});

describe('localIsoDate', () => {
  it('should report the date in the zone, not in UTC', () => {
    // given 23:30 UTC is already the next day in Berlin
    const instant = new Date('2026-09-23T22:30:00.000Z');

    // then
    expect(localIsoDate(BERLIN, instant)).toBe('2026-09-24');
    expect(localIsoDate('UTC', instant)).toBe('2026-09-23');
  });
});

describe('nextWorkoutReminderAt', () => {
  it('should fire later on the start day when the time is still ahead', () => {
    // given
    const now = new Date('2026-09-23T10:00:00.000Z'); // 12:00 Berlin

    // when
    const next = nextWorkoutReminderAt(everyTwoDays(), now);

    // then
    expect(next?.toISOString()).toBe('2026-09-23T13:00:00.000Z');
  });

  it('should skip to two days later once today’s time has passed', () => {
    // given
    const now = new Date('2026-09-23T13:00:00.000Z'); // exactly 15:00

    // when
    const next = nextWorkoutReminderAt(everyTwoDays(), now);

    // then
    expect(next?.toISOString()).toBe('2026-09-25T13:00:00.000Z');
  });

  it('should keep the local time across the autumn DST switch', () => {
    // given 2026-10-25 is the switch back to CET
    const schedule = everyTwoDays({
      repeat: { kind: 'interval', everyDays: 2, startDate: '2026-10-23' },
    });
    const now = new Date('2026-10-23T14:00:00.000Z');

    // when
    const next = nextWorkoutReminderAt(schedule, now);

    // then 15:00 CET is 14:00 UTC, not 13:00
    expect(next?.toISOString()).toBe('2026-10-25T14:00:00.000Z');
  });

  it('should wait for a start date in the future', () => {
    // given
    const schedule = everyTwoDays({
      repeat: { kind: 'interval', everyDays: 3, startDate: '2027-03-10' },
    });

    // when
    const next = nextWorkoutReminderAt(
      schedule,
      new Date('2026-09-23T10:00:00.000Z')
    );

    // then
    expect(next?.toISOString()).toBe('2027-03-10T14:00:00.000Z');
  });

  it('should keep the rhythm anchored to the start date', () => {
    // given every 3 days from Sep 1: Sep 1, 4, …, 22, 25
    const schedule = everyTwoDays({
      repeat: { kind: 'interval', everyDays: 3, startDate: '2026-09-01' },
    });

    // when
    const next = nextWorkoutReminderAt(
      schedule,
      new Date('2026-09-23T10:00:00.000Z')
    );

    // then
    expect(next?.toISOString()).toBe('2026-09-25T13:00:00.000Z');
  });

  it('should find the next listed weekday', () => {
    // given Wednesday 2026-09-23, 08:00 Berlin — past 07:30
    const now = new Date('2026-09-23T06:00:00.000Z');

    // when
    const next = nextWorkoutReminderAt(MON_WED_FRI, now);

    // then Friday
    expect(next?.toISOString()).toBe('2026-09-25T05:30:00.000Z');
  });

  it('should wrap to the next week', () => {
    // given Friday evening
    const now = new Date('2026-09-25T18:00:00.000Z');

    // when
    const next = nextWorkoutReminderAt(MON_WED_FRI, now);

    // then Monday
    expect(next?.toISOString()).toBe('2026-09-28T05:30:00.000Z');
  });
});

describe('previousWorkoutReminderAt', () => {
  it('should return the occurrence at the exact moment', () => {
    // given
    const now = new Date('2026-09-23T13:00:00.000Z');

    // when
    const previous = previousWorkoutReminderAt(everyTwoDays(), now);

    // then
    expect(previous?.toISOString()).toBe('2026-09-23T13:00:00.000Z');
  });

  it('should skip days that are off the rhythm', () => {
    // given Sep 24 is not an every-2-days day
    const now = new Date('2026-09-24T16:00:00.000Z');

    // when
    const previous = previousWorkoutReminderAt(everyTwoDays(), now);

    // then
    expect(previous?.toISOString()).toBe('2026-09-23T13:00:00.000Z');
  });

  it('should return null before the start date', () => {
    // when
    const previous = previousWorkoutReminderAt(
      everyTwoDays(),
      new Date('2026-09-22T16:00:00.000Z')
    );

    // then
    expect(previous).toBeNull();
  });
});

describe('workoutReminderRejection', () => {
  it('should accept both repeat kinds', () => {
    // then
    expect(workoutReminderRejection(everyTwoDays())).toBeNull();
    expect(workoutReminderRejection(MON_WED_FRI)).toBeNull();
  });

  it.each([
    [{ time: '7:30' }, 'time'],
    [{ time: '25:00' }, 'time'],
    [{ repeat: { kind: 'monthly' } }, 'repeat'],
    [
      { repeat: { kind: 'interval', everyDays: 0, startDate: '2026-09-23' } },
      'every-days',
    ],
    [
      { repeat: { kind: 'interval', everyDays: 31, startDate: '2026-09-23' } },
      'every-days',
    ],
    [
      { repeat: { kind: 'interval', everyDays: 2, startDate: '23.09.2026' } },
      'start-date',
    ],
    [{ repeat: { kind: 'weekdays', weekdays: [] } }, 'weekdays'],
    [{ repeat: { kind: 'weekdays', weekdays: [1, 1] } }, 'weekdays'],
    [{ repeat: { kind: 'weekdays', weekdays: [7] } }, 'weekdays'],
    [{ timezone: 'Mars/Olympus' }, 'timezone'],
  ])('should reject %j as %s', (overrides, reason) => {
    // then
    expect(workoutReminderRejection({ ...everyTwoDays(), ...overrides })).toBe(
      reason
    );
  });
});

describe('workoutReminderDocument', () => {
  it('should resolve nextAt and sort the weekdays', () => {
    // given
    const now = new Date('2026-09-23T06:00:00.000Z');

    // when
    const doc = workoutReminderDocument(
      'owner',
      'w1',
      {
        ...MON_WED_FRI,
        repeat: { kind: 'weekdays', weekdays: [5, 1, 3] },
        enabled: true,
      },
      now
    );

    // then
    expect(doc).toEqual({
      ownerId: 'owner',
      workoutId: 'w1',
      enabled: true,
      time: '07:30',
      repeat: { kind: 'weekdays', weekdays: [1, 3, 5] },
      timezone: BERLIN,
      nextAt: '2026-09-25T05:30:00.000Z',
      updatedAt: '2026-09-23T06:00:00.000Z',
    });
  });
});

describe('normalizeWorkoutReminder', () => {
  it('should read a stored reminder and drop unknown fields', () => {
    // given
    const raw = {
      ...everyTwoDays(),
      ownerId: 'owner',
      enabled: true,
      nextAt: '2026-09-23T13:00:00.000Z',
      updatedAt: '2026-09-23T10:00:00.000Z',
      lastSentAt: 'x',
    };

    // when
    const reminder = normalizeWorkoutReminder('w1', raw);

    // then
    expect(reminder).toEqual({
      workoutId: 'w1',
      ownerId: 'owner',
      enabled: true,
      time: '15:00',
      repeat: { kind: 'interval', everyDays: 2, startDate: '2026-09-23' },
      timezone: BERLIN,
      nextAt: '2026-09-23T13:00:00.000Z',
      updatedAt: '2026-09-23T10:00:00.000Z',
    });
  });

  it('should refuse a document without owner or schedule', () => {
    // then
    expect(normalizeWorkoutReminder('w1', everyTwoDays())).toBeNull();
    expect(
      normalizeWorkoutReminder('w1', { ownerId: 'owner', time: '15:00' })
    ).toBeNull();
  });
});

describe('workoutReminderDue', () => {
  const nextAt = '2026-09-23T13:00:00.000Z';

  it('should wait before the time', () => {
    // then
    expect(workoutReminderDue(nextAt, new Date('2026-09-23T12:59:00Z'))).toBe(
      'not-yet'
    );
  });

  it('should send within the grace window', () => {
    // then
    expect(
      workoutReminderDue(
        nextAt,
        new Date(Date.parse(nextAt) + WORKOUT_REMINDER_GRACE_MS)
      )
    ).toBe('send');
  });

  it('should skip an occurrence past the grace window', () => {
    // then
    expect(
      workoutReminderDue(
        nextAt,
        new Date(Date.parse(nextAt) + WORKOUT_REMINDER_GRACE_MS + 1)
      )
    ).toBe('late');
  });

  it('should treat an unreadable nextAt as late so it gets repaired', () => {
    // then
    expect(workoutReminderDue('', new Date())).toBe('late');
  });
});
