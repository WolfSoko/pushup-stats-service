import { LOCALE_ID, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PushSubscriptionService, type PushStatus } from '@pu-push/push';
import type { WorkoutReminder } from '@pu-stats/models';
import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { WorkoutReminderDialogComponent } from './workout-reminder-dialog.component';
import { WorkoutRemindersStore } from './workout-reminders.store';

const EXISTING: WorkoutReminder = {
  workoutId: 'w1',
  ownerId: 'u1',
  enabled: true,
  time: '15:00',
  repeat: { kind: 'weekdays', weekdays: [1, 3, 5] },
  timezone: 'Europe/Berlin',
  nextAt: '2026-09-25T13:00:00.000Z',
  updatedAt: '2026-09-23T10:00:00.000Z',
};

async function setup(
  options: {
    existing?: WorkoutReminder | null;
    pushStatus?: PushStatus;
    saveOk?: boolean;
  } = {}
) {
  const reminders = {
    reminderFor: vitest.fn(() => options.existing ?? null),
    busyKeys: signal<ReadonlySet<string>>(new Set()),
    save: vitest.fn().mockResolvedValue(options.saveOk ?? true),
    remove: vitest.fn().mockResolvedValue(true),
  };
  const push = {
    status: signal<PushStatus>(options.pushStatus ?? 'subscribed'),
    init: vitest.fn().mockResolvedValue(undefined),
    subscribe: vitest.fn().mockResolvedValue(true),
  };
  const dialogRef = { close: vitest.fn() };
  await render(WorkoutReminderDialogComponent, {
    providers: [
      { provide: WorkoutRemindersStore, useValue: reminders },
      { provide: PushSubscriptionService, useValue: push },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: LOCALE_ID, useValue: 'de' },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { workoutId: 'w1', title: 'Core 15' },
      },
    ],
  });
  return { reminders, push, dialogRef };
}

describe('WorkoutReminderDialogComponent', () => {
  it('should start a new reminder as every two days from today', async () => {
    // given
    const { reminders, dialogRef } = await setup();
    const user = userEvent.setup();

    // when
    fireEvent.change(screen.getByTestId('workout-reminder-time'), {
      target: { value: '15:00' },
    });
    await user.click(screen.getByTestId('workout-reminder-save'));

    // then
    await waitFor(() =>
      expect(reminders.save).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          enabled: true,
          time: '15:00',
          repeat: expect.objectContaining({ kind: 'interval', everyDays: 2 }),
        })
      )
    );
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should preview when the next reminder comes', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByTestId('workout-reminder-next').textContent).toMatch(
      /Nächste Erinnerung: \S+ \d\d\.\d\d\., 18:00/
    );
  });

  it('should load an existing weekday reminder and offer to remove it', async () => {
    // given
    const { reminders, dialogRef } = await setup({ existing: EXISTING });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-reminder-remove'));

    // then
    expect(
      (screen.getByTestId('workout-reminder-time') as HTMLInputElement).value
    ).toBe('15:00');
    expect(screen.getByTestId('workout-reminder-weekdays')).toBeTruthy();
    await waitFor(() => expect(reminders.remove).toHaveBeenCalledWith('w1'));
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should refuse to save weekdays with no day picked', async () => {
    // given
    await setup({
      existing: { ...EXISTING, repeat: { kind: 'weekdays', weekdays: [1] } },
    });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByRole('button', { name: 'Mo' }));

    // then
    expect(
      (screen.getByTestId('workout-reminder-save') as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('should explain the fallback and offer push when this device has none', async () => {
    // given
    const { push } = await setup({ pushStatus: 'not-subscribed' });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-reminder-enable-push'));

    // then
    expect(screen.getByTestId('workout-reminder-push-off')).toBeTruthy();
    expect(push.subscribe).toHaveBeenCalled();
  });

  it('should not nag about push once it is on', async () => {
    // given / when
    const { push } = await setup();

    // then
    expect(push.init).toHaveBeenCalled();
    expect(screen.queryByTestId('workout-reminder-push-off')).toBeNull();
  });

  it('should stay open and say so when the save failed', async () => {
    // given
    const { dialogRef } = await setup({ saveOk: false });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-reminder-save'));

    // then
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
