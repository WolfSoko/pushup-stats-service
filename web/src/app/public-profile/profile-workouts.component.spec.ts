import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { WorkoutsStore } from '../workouts/workouts.store';
import { ProfileWorkoutsComponent } from './profile-workouts.component';

const WORKOUTS = [
  {
    id: 'w1',
    title: 'Ganzkörper kurz',
    description: 'Drei Runden',
    exercises: [{ exerciseId: 'pushup', target: 30, sets: [10, 10, 10] }],
  },
];

async function setup(options: { userId?: string; isOwner?: boolean } = {}) {
  const store = { importWorkout: vitest.fn().mockResolvedValue('new-id') };
  const snackbar = { open: vitest.fn() };
  await render(ProfileWorkoutsComponent, {
    inputs: {
      workouts: WORKOUTS,
      ownerUid: 'owner',
      ownerName: 'Wolfi',
      isOwner: options.isOwner ?? false,
    },
    providers: [
      provideRouter([]),
      { provide: WorkoutsStore, useValue: store },
      { provide: MatSnackBar, useValue: snackbar },
      {
        provide: UserContextService,
        useValue: { userIdSafe: () => options.userId ?? 'viewer' },
      },
    ],
  });
  const navigate = vitest
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockResolvedValue(true);
  return { store, snackbar, navigate };
}

describe('ProfileWorkoutsComponent', () => {
  it('should copy a session into the viewer’s own list with its source', async () => {
    // given
    const { store, snackbar } = await setup();
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('profile-workout-copy'));

    // then
    expect(store.importWorkout).toHaveBeenCalledWith(WORKOUTS[0], {
      uid: 'owner',
      workoutId: 'w1',
      displayName: 'Wolfi',
    });
    await waitFor(() =>
      expect(screen.getByTestId('profile-workout-copied')).toBeTruthy()
    );
    expect(snackbar.open).toHaveBeenCalled();
  });

  it('should send an anonymous visitor to the signup page instead', async () => {
    // given
    const { store, navigate } = await setup({ userId: '' });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('profile-workout-copy'));

    // then
    expect(store.importWorkout).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/register'], {
      queryParams: { returnUrl: '/u/owner' },
    });
  });

  it('should link the owner to their list instead of offering a copy', async () => {
    await setup({ isOwner: true });
    expect(screen.queryByTestId('profile-workout-copy')).toBeNull();
    expect(screen.getByText('Zu meinen Sessions')).toBeTruthy();
  });
});
