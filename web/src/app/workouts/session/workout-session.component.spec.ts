import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LiveDataStore } from '@pu-stats/data-access-state';
import type { Workout } from '@pu-stats/models';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { UserConfigStore } from '../../core/user-config.store';
import { SessionCaptureService } from '../../training-plans/session/session-capture.service';
import { WorkoutsStore } from '../workouts.store';
import { WorkoutRunStateService } from './workout-run-state';
import { WorkoutSessionComponent } from './workout-session.component';

const WORKOUT: Workout = {
  id: 'w1',
  ownerId: 'u1',
  title: 'Kurz',
  description: 'Zwei Übungen',
  exercises: [
    { exerciseId: 'pushup', target: 20 },
    { exerciseId: 'plank.standard', target: 60 },
  ],
  onProfile: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

async function setup(options: { id?: string; loaded?: boolean } = {}) {
  const id = options.id ?? 'w1';
  const capture = vitest
    .fn()
    .mockResolvedValue({ status: 'captured', value: 999 });
  const logPrescribed = vitest.fn().mockResolvedValue({
    status: 'captured',
    value: 999,
  });
  const navigateByUrl = vitest.fn().mockResolvedValue(true);
  const state = {
    load: vitest.fn(() => null),
    save: vitest.fn(),
    clear: vitest.fn(),
  };
  await render(WorkoutSessionComponent, {
    providers: [
      { provide: PLATFORM_ID, useValue: 'server' },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ id })),
          snapshot: { paramMap: convertToParamMap({ id }) },
        },
      },
      {
        provide: Router,
        useValue: {
          navigateByUrl,
          createUrlTree: () => ({}),
          serializeUrl: () => '',
          events: of(),
        },
      },
      { provide: MatSnackBar, useValue: { open: vitest.fn() } },
      {
        provide: WorkoutsStore,
        useValue: {
          loaded: signal(options.loaded ?? true),
          workoutById: (wid: string) => (wid === 'w1' ? WORKOUT : null),
        },
      },
      { provide: LiveDataStore, useValue: { exerciseEntries: signal([]) } },
      { provide: WorkoutRunStateService, useValue: state },
      {
        provide: UserConfigStore,
        useValue: {
          sessionRestSec: signal(0),
          saveSessionRestSec: vitest.fn().mockResolvedValue(undefined),
          sessionMode: signal('sequential'),
          saveSessionMode: vitest.fn().mockResolvedValue(undefined),
        },
      },
    ],
    componentProviders: [
      {
        provide: SessionCaptureService,
        useValue: { capture, captureByHand: capture, logPrescribed },
      },
    ],
  });
  return { capture, logPrescribed, navigateByUrl, state };
}

describe('WorkoutSessionComponent', () => {
  it('should list the workout on the start screen', async () => {
    // given
    await setup();

    // then
    expect(screen.getByText('Session · Kurz')).toBeTruthy();
    expect(screen.getByText('Liegestütze')).toBeTruthy();
    expect(screen.getByText('Plank')).toBeTruthy();
    expect(screen.getByTestId('session-start')).toBeTruthy();
  });

  it('should start the run and walk the first exercise', async () => {
    // given
    const { state } = await setup();
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('session-start'));

    // then — the run is persisted so leaving the page keeps it
    expect(state.save).toHaveBeenCalledWith(
      'w1',
      expect.objectContaining({ checked: [] })
    );
    expect(screen.getByText('Liegestütze')).toBeTruthy();
    expect(screen.getByText(/Übung 1 von 2/)).toBeTruthy();
  });

  it('should log a prescribed step without a plan tick and move on', async () => {
    // given
    const { logPrescribed } = await setup();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('session-start'));

    // when
    await user.click(screen.getByTestId('session-log-prescribed'));

    // then
    expect(logPrescribed).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Übung 2 von 2/)).toBeTruthy();
  });

  it('should tick a step off into the run and finish back on the list', async () => {
    // given
    const { state, navigateByUrl } = await setup();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('session-start'));

    // when
    await user.click(screen.getByTestId('session-check-off'));
    await user.click(screen.getByTestId('session-check-off'));

    // then — both ticked, the run is cleared on the way out
    expect(state.save).toHaveBeenLastCalledWith(
      'w1',
      expect.objectContaining({ checked: [0, 1] })
    );
    expect(screen.getByText('Session geschafft')).toBeTruthy();
    await user.click(screen.getByTestId('session-finish'));
    expect(state.clear).toHaveBeenCalledWith('w1');
    expect(navigateByUrl).toHaveBeenCalledWith('/workouts');
  });

  it('should say so when the workout does not exist', async () => {
    await setup({ id: 'gone' });
    expect(screen.getByText('Diese Session gibt es nicht.')).toBeTruthy();
  });
});
