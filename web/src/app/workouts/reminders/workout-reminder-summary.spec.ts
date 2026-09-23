import type { WorkoutReminderSchedule } from '@pu-stats/models';

import { workoutReminderSummary } from './workout-reminder-summary';

function schedule(
  repeat: WorkoutReminderSchedule['repeat'],
  time = '15:00'
): WorkoutReminderSchedule {
  return { time, repeat, timezone: 'Europe/Berlin' };
}

describe('workoutReminderSummary', () => {
  it('should describe an every-N-days rhythm', () => {
    // when
    const text = workoutReminderSummary(
      schedule({ kind: 'interval', everyDays: 2, startDate: '2026-09-23' })
    );

    // then
    expect(text).toBe('Alle 2 Tage · 15:00');
  });

  it('should call every single day daily', () => {
    // then
    expect(
      workoutReminderSummary(
        schedule({ kind: 'interval', everyDays: 1, startDate: '2026-09-23' })
      )
    ).toBe('Täglich · 15:00');
    expect(
      workoutReminderSummary(
        schedule({ kind: 'weekdays', weekdays: [0, 1, 2, 3, 4, 5, 6] })
      )
    ).toBe('Täglich · 15:00');
  });

  it('should list weekdays Monday first', () => {
    // when
    const text = workoutReminderSummary(
      schedule({ kind: 'weekdays', weekdays: [0, 3, 1] }, '07:30')
    );

    // then
    expect(text).toBe('Mo, Mi, So · 07:30');
  });
});
