import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PushSubscriptionService,
  PushSwRegistrationService,
  type PushStatus,
} from '@pu-push/push';
import type { Workout, WorkoutReminder } from '@pu-stats/models';

import { WorkoutsStore } from '../workouts.store';
import { WorkoutReminderInAppService } from './workout-reminder-in-app.service';
import { WorkoutRemindersStore } from './workout-reminders.store';

const REMINDER: WorkoutReminder = {
  workoutId: 'w1',
  ownerId: 'u1',
  enabled: true,
  time: '15:00',
  repeat: { kind: 'interval', everyDays: 1, startDate: '2026-09-01' },
  timezone: 'Europe/Berlin',
  nextAt: '2026-09-23T13:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
};

const WORKOUT = { id: 'w1', title: 'Core 15' } as Workout;
const NOW = new Date('2026-09-23T13:01:00.000Z');
const SHOWN_KEY = 'pu:workout-reminder:shown:w1';

function setup(
  options: {
    pushStatus?: PushStatus;
    loaded?: boolean;
    workout?: Workout | null;
  } = {}
) {
  const showNotification = vitest.fn().mockResolvedValue(undefined);
  const push = {
    status: signal<PushStatus>(options.pushStatus ?? 'not-subscribed'),
    init: vitest.fn().mockResolvedValue(undefined),
  };
  const workouts = {
    loaded: signal(options.loaded ?? true),
    workoutById: vitest.fn(() =>
      options.workout === undefined ? WORKOUT : options.workout
    ),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: 'server' },
      {
        provide: WorkoutRemindersStore,
        useValue: { reminders: signal([REMINDER]) },
      },
      { provide: WorkoutsStore, useValue: workouts },
      { provide: PushSubscriptionService, useValue: push },
      {
        provide: PushSwRegistrationService,
        useValue: {
          getRegistration: vitest.fn().mockResolvedValue({ showNotification }),
        },
      },
    ],
  });
  return {
    service: TestBed.inject(WorkoutReminderInAppService),
    showNotification,
    push,
  };
}

describe('WorkoutReminderInAppService', () => {
  beforeEach(() => {
    localStorage.clear();
    vitest.stubGlobal('Notification', { permission: 'granted' });
  });

  afterEach(() => {
    vitest.unstubAllGlobals();
  });

  it('should show a due session once and open its run page on tap', async () => {
    // given
    const { service, showNotification } = setup();

    // when
    await service.tick(NOW);
    await service.tick(NOW);

    // then
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      '⏰ Core 15',
      expect.objectContaining({
        tag: 'workout-reminder-w1',
        data: { url: expect.stringMatching(/\/workouts\/w1\/run$/) },
      })
    );
    expect(localStorage.getItem(SHOWN_KEY)).toBe('2026-09-23T13:00:00.000Z');
  });

  it('should leave a due session to push when this device has it', async () => {
    // given
    const { service, showNotification, push } = setup({
      pushStatus: 'subscribed',
    });

    // when
    await service.tick(NOW);

    // then
    expect(push.init).toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
    expect(localStorage.getItem(SHOWN_KEY)).toBe('2026-09-23T13:00:00.000Z');
  });

  it('should wait while the push status is still being resolved', async () => {
    // given
    const { service, showNotification } = setup({ pushStatus: 'loading' });

    // when
    await service.tick(NOW);

    // then
    expect(showNotification).not.toHaveBeenCalled();
    expect(localStorage.getItem(SHOWN_KEY)).toBeNull();
  });

  it('should not ask for the push status while nothing is due', async () => {
    // given
    const { service, push } = setup();

    // when
    await service.tick(new Date('2026-09-23T10:00:00.000Z'));

    // then
    expect(push.init).not.toHaveBeenCalled();
  });

  it('should stay quiet without notification permission', async () => {
    // given
    vitest.stubGlobal('Notification', { permission: 'default' });
    const { service, showNotification } = setup();

    // when
    await service.tick(NOW);

    // then
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('should retry on the next tick while the workouts are still loading', async () => {
    // given
    const { service, showNotification } = setup({ loaded: false });

    // when
    await service.tick(NOW);

    // then
    expect(showNotification).not.toHaveBeenCalled();
    expect(localStorage.getItem(SHOWN_KEY)).toBeNull();
  });

  it('should drop the occurrence of a deleted workout for good', async () => {
    // given
    const { service, showNotification } = setup({ workout: null });

    // when
    await service.tick(NOW);

    // then
    expect(showNotification).not.toHaveBeenCalled();
    expect(localStorage.getItem(SHOWN_KEY)).toBe('2026-09-23T13:00:00.000Z');
  });
});
