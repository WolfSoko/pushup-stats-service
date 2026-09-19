import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import type { Workout } from '@pu-stats/models';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { UserConfigStore } from '../core/user-config.store';
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
  } = {}
) {
  const workouts = signal<ReadonlyArray<Workout>>(
    options.workouts ?? [WORKOUT]
  );
  const store = {
    workouts,
    loaded: signal(options.loaded ?? true),
    busy: signal(false),
    lastRejection: signal(undefined),
    lastShared: signal(1),
    canAddMore: signal(true),
    share: vitest.fn().mockResolvedValue(true),
    setOnProfile: vitest.fn().mockResolvedValue(true),
    remove: vitest.fn().mockResolvedValue(true),
  };
  const dialog = {
    open: vitest.fn(() => ({ afterClosed: () => of(options.dialogResult) })),
  };
  const snackbar = { open: vitest.fn() };
  await render(WorkoutsPageComponent, {
    providers: [
      provideRouter([]),
      { provide: WorkoutsStore, useValue: store },
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
  return { store, dialog, snackbar };
}

describe('WorkoutsPageComponent', () => {
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
    await waitFor(() => expect(store.remove).toHaveBeenCalledWith('w1'));
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
