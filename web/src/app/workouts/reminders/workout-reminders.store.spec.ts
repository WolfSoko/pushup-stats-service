import { TestBed } from '@angular/core/testing';
import { UserContextService } from '@pu-auth/auth';
import { WorkoutRemindersApiService } from '@pu-stats/data-access';
import type { WorkoutReminder, WorkoutReminderInput } from '@pu-stats/models';
import { BehaviorSubject } from 'rxjs';

import { WorkoutRemindersStore } from './workout-reminders.store';

const REMINDER: WorkoutReminder = {
  workoutId: 'w1',
  ownerId: 'u1',
  enabled: true,
  time: '15:00',
  repeat: { kind: 'interval', everyDays: 2, startDate: '2026-09-23' },
  timezone: 'Europe/Berlin',
  nextAt: '2026-09-23T13:00:00.000Z',
  updatedAt: '2026-09-23T10:00:00.000Z',
};

const INPUT: WorkoutReminderInput = {
  enabled: true,
  time: '07:30',
  repeat: { kind: 'weekdays', weekdays: [1, 3, 5] },
  timezone: 'Europe/Berlin',
};

function setup(reminders: WorkoutReminder[] = [REMINDER]) {
  const list$ = new BehaviorSubject<ReadonlyArray<WorkoutReminder>>(reminders);
  const api = {
    listReminders: vitest.fn(() => list$.asObservable()),
    saveReminder: vitest.fn().mockResolvedValue(undefined),
    deleteReminder: vitest.fn().mockResolvedValue(undefined),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: WorkoutRemindersApiService, useValue: api },
      { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
    ],
  });
  return { store: TestBed.inject(WorkoutRemindersStore), api };
}

async function flush(): Promise<void> {
  TestBed.tick();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  TestBed.tick();
}

describe('WorkoutRemindersStore', () => {
  it('should mirror the reminders keyed by workout', async () => {
    // given
    const { store } = setup();

    // when
    await flush();

    // then
    expect(store.reminderFor('w1')).toEqual(REMINDER);
    expect(store.reminderFor('w2')).toBeNull();
  });

  it('should save a valid schedule through the API', async () => {
    // given
    const { store, api } = setup();

    // when
    const ok = await store.save('w2', INPUT);

    // then
    expect(ok).toBe(true);
    expect(api.saveReminder).toHaveBeenCalledWith('u1', 'w2', INPUT);
  });

  it('should refuse an invalid schedule without writing', async () => {
    // given
    const { store, api } = setup();

    // when
    const ok = await store.save('w2', { ...INPUT, time: '7:30' });

    // then
    expect(ok).toBe(false);
    expect(api.saveReminder).not.toHaveBeenCalled();
  });

  it('should report a failed write', async () => {
    // given
    const { store, api } = setup();
    api.saveReminder.mockRejectedValueOnce(new Error('denied'));

    // when
    const ok = await store.save('w2', INPUT);

    // then
    expect(ok).toBe(false);
  });

  it('should delete a known reminder', async () => {
    // given
    const { store, api } = setup();
    await flush();

    // when
    const ok = await store.remove('w1');

    // then
    expect(ok).toBe(true);
    expect(api.deleteReminder).toHaveBeenCalledWith('u1', 'w1');
  });

  it('should not touch Firestore for a workout without a reminder', async () => {
    // given
    const { store, api } = setup();
    await flush();

    // when
    const ok = await store.remove('w2');

    // then
    expect(ok).toBe(true);
    expect(api.deleteReminder).not.toHaveBeenCalled();
  });
});
