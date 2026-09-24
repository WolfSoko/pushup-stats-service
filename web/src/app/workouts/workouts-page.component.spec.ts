import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import type { Workout, WorkoutReminder } from '@pu-stats/models';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { UserConfigStore } from '../core/user-config.store';
import { WorkoutRemindersStore } from './reminders/workout-reminders.store';
import { WorkoutsPageComponent } from './workouts-page.component';
import { WorkoutsStore } from './workouts.store';

const WORKOUT: Workout = {
  id: 'w1',
  ownerId: 'u1',
  title: 'Ganzkörper kurz',
  description: 'Drei Runden',
  exercises: [
    { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
    { exerciseId: 'plank.standard', target: 60 },
  ],
  onProfile: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

async function setup(
  options: {
    workouts?: Workout[];
    loaded?: boolean;
    dialogResult?: unknown;
    sectionLevel?: string;
    full?: number;
    canAddMore?: boolean;
    reminder?: WorkoutReminder;
  } = {}
) {
  const workouts = signal<ReadonlyArray<Workout>>(
    options.workouts ?? [WORKOUT]
  );
  const store = {
    workouts,
    loaded: signal(options.loaded ?? true),
    busyKeys: signal<ReadonlySet<string>>(new Set()),
    lastRejection: signal(undefined),
    lastShared: signal(1),
    lastShareFull: signal(options.full ?? 0),
    canAddMore: signal(options.canAddMore ?? true),
    share: vitest.fn().mockResolvedValue(true),
    setOnProfile: vitest.fn().mockResolvedValue(true),
    remove: vitest.fn().mockResolvedValue(true),
  };
  const reminders = {
    reminderFor: vitest.fn((id: string) =>
      options.reminder?.workoutId === id ? options.reminder : null
    ),
    remove: vitest.fn().mockResolvedValue(true),
  };
  const dialog = {
    open: vitest.fn(() => ({ afterClosed: () => of(options.dialogResult) })),
  };
  const snackbar = { open: vitest.fn() };
  const { fixture } = await render(WorkoutsPageComponent, {
    providers: [
      provideRouter([]),
      { provide: WorkoutsStore, useValue: store },
      { provide: WorkoutRemindersStore, useValue: reminders },
      { provide: MatDialog, useValue: dialog },
      { provide: MatSnackBar, useValue: snackbar },
      {
        provide: UserConfigStore,
        useValue: {
          config: signal({
            ui: {
              profileVisibility: options.sectionLevel
                ? { workouts: options.sectionLevel }
                : {},
            },
          }),
        },
      },
      { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
    ],
  });
  return { store, reminders, dialog, snackbar, fixture };
}

describe('WorkoutsPageComponent', () => {
  it('should hold three card skeletons and no empty card while the list loads', async () => {
    // given / when
    const { fixture } = await setup({ workouts: [], loaded: false });

    // then
    const loading = screen.getByTestId('workouts-loading');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.querySelectorAll('app-workout-card-skeleton')).toHaveLength(
      3
    );
    expect(loading.querySelector('pu-skeleton')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('mat-spinner')).toBeNull();
    expect(screen.queryByTestId('workouts-empty')).toBeNull();
    expect(screen.queryByTestId('workout-card')).toBeNull();
  });

  it('should swap the skeletons for the empty card once the list is there', async () => {
    // given
    const { store, fixture } = await setup({ workouts: [], loaded: false });

    // when
    store.loaded.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // then
    expect(screen.queryByTestId('workouts-loading')).toBeNull();
    expect(fixture.nativeElement.querySelector('pu-skeleton')).toBeNull();
    expect(screen.getByTestId('workouts-empty')).toBeTruthy();
  });

  it('should invite the user to create their first session when there is none', async () => {
    // given
    await setup({ workouts: [] });

    // then
    expect(screen.getByTestId('workouts-empty')).toBeTruthy();
    expect(screen.queryByTestId('workout-card')).toBeNull();
  });

  it('should list each workout with what it asks for', async () => {
    // given
    await setup();

    // then
    expect(screen.getByText('Ganzkörper kurz')).toBeTruthy();
    expect(screen.getByTestId('workout-summary').textContent).toBe(
      '3×10 Liegestütze · 1:00 Plank'
    );
    expect(screen.getByTestId('workout-run').getAttribute('href')).toBe(
      '/workouts/w1/run'
    );
  });

  it('should say where a received copy came from', async () => {
    // given
    await setup({
      workouts: [
        {
          ...WORKOUT,
          sharedBy: { uid: 'anna', workoutId: 'src', displayName: 'Anna' },
        },
      ],
    });

    // then
    expect(screen.getByTestId('workout-source').textContent).toContain('Anna');
  });

  it('should send the workout to the friends picked in the dialog', async () => {
    // given
    const { store, snackbar } = await setup({ dialogResult: ['f1'] });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-share'));

    // then — the dialog chunk loads lazily, so the call lands a tick later
    await waitFor(() => expect(store.share).toHaveBeenCalledWith('w1', ['f1']));
    await waitFor(() => expect(snackbar.open).toHaveBeenCalled());
  });

  it('should tell the sender about friends whose list was full', async () => {
    // given
    const { snackbar } = await setup({ dialogResult: ['f1', 'f2'], full: 1 });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-share'));

    // then
    await waitFor(() => expect(snackbar.open).toHaveBeenCalled());
    expect(String(snackbar.open.mock.calls[0][0])).toContain('keinen Platz');
  });

  it('should disable the new-session link once the list is full', async () => {
    // given
    await setup({ canAddMore: false });

    // then — a greyed-out link that still navigates would let the user
    // fill in a session only to be refused on save
    expect(
      screen.getByTestId('workouts-new').getAttribute('aria-disabled')
    ).toBe('true');
  });

  it('should not share when the dialog was dismissed', async () => {
    // given
    const { store, dialog } = await setup({ dialogResult: undefined });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-share'));
    await waitFor(() => expect(dialog.open).toHaveBeenCalled());

    // then
    expect(store.share).not.toHaveBeenCalled();
  });

  it('should flip the profile flag from the card', async () => {
    // given
    const { store } = await setup();
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-toggle-profile'));

    // then
    expect(store.setOnProfile).toHaveBeenCalledWith('w1', true);
  });

  it('should delete only after the dialog confirmed', async () => {
    // given
    const { store } = await setup({ dialogResult: true });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-delete'));

    // then
    await waitFor(() => expect(store.remove).toHaveBeenCalledWith('w1'), {
      timeout: 3000,
    });
  });

  it('should drop the session’s reminder together with the session', async () => {
    // given
    const { reminders } = await setup({ dialogResult: true });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-delete'));

    // then
    await waitFor(() => expect(reminders.remove).toHaveBeenCalledWith('w1'), {
      timeout: 3000,
    });
  });

  it('should keep the reminder when deleting the session failed', async () => {
    // given
    const { store, reminders } = await setup({ dialogResult: true });
    store.remove.mockResolvedValue(false);
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-delete'));

    // then
    await waitFor(() => expect(store.remove).toHaveBeenCalled(), {
      timeout: 3000,
    });
    expect(reminders.remove).not.toHaveBeenCalled();
  });

  it('should show the reminder rhythm on the card', async () => {
    // given / when
    await setup({
      reminder: {
        workoutId: 'w1',
        ownerId: 'u1',
        enabled: true,
        time: '15:00',
        repeat: { kind: 'interval', everyDays: 2, startDate: '2026-09-23' },
        timezone: 'Europe/Berlin',
        nextAt: '2026-09-23T13:00:00.000Z',
        updatedAt: '2026-09-23T10:00:00.000Z',
      },
    });

    // then
    expect(screen.getByTestId('workout-reminder-badge').textContent).toContain(
      'Alle 2 Tage · 15:00'
    );
    expect(
      screen.getByTestId('workout-reminder').getAttribute('aria-label')
    ).toBe('Erinnerung ändern');
  });

  it('should offer to set up a reminder on a card without one', async () => {
    // given / when
    await setup();

    // then
    expect(screen.queryByTestId('workout-reminder-badge')).toBeNull();
    expect(
      screen.getByTestId('workout-reminder').getAttribute('aria-label')
    ).toBe('Erinnerung einrichten');
  });

  it('should open the reminder dialog for the card’s session', async () => {
    // given
    const { dialog } = await setup();
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-reminder'));

    // then
    await waitFor(() =>
      expect(dialog.open).toHaveBeenCalledWith(expect.anything(), {
        data: { workoutId: 'w1', title: 'Ganzkörper kurz' },
        autoFocus: 'dialog',
      })
    );
  });

  it('should show only the pressed card action busy while it runs', async () => {
    // given
    const { store, fixture } = await setup({
      workouts: [WORKOUT, { ...WORKOUT, id: 'w2', title: 'Lang' }],
    });

    // when
    store.busyKeys.set(new Set(['remove:w1']));
    fixture.detectChanges();

    // then — this card's delete spins, its neighbours and the other card stay still
    const deletes = screen.getAllByTestId('workout-delete');
    expect(deletes[0].getAttribute('aria-busy')).toBe('true');
    expect((deletes[0] as HTMLButtonElement).disabled).toBe(false);
    expect(deletes[1].getAttribute('aria-busy')).toBeNull();
    expect(
      screen.getAllByTestId('workout-share')[0].getAttribute('aria-busy')
    ).toBeNull();
    expect(
      screen
        .getAllByTestId('workout-toggle-profile')[0]
        .getAttribute('aria-busy')
    ).toBeNull();

    // when
    store.busyKeys.set(new Set());
    fixture.detectChanges();

    // then
    expect(deletes[0].getAttribute('aria-busy')).toBeNull();
  });

  it('should point at the profile switch while a listed workout is invisible', async () => {
    // given — on the profile, but the section is still off
    await setup({ workouts: [{ ...WORKOUT, onProfile: true }] });

    // then
    expect(screen.getByTestId('workouts-profile-hint')).toBeTruthy();
  });

  it('should drop the hint once the section is open to someone', async () => {
    // given
    await setup({
      workouts: [{ ...WORKOUT, onProfile: true }],
      sectionLevel: 'friends',
    });

    // then
    expect(screen.queryByTestId('workouts-profile-hint')).toBeNull();
  });
});
