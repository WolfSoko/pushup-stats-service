import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import type { Workout } from '@pu-stats/models';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { WorkoutEditorComponent } from './workout-editor.component';
import { WorkoutsStore } from './workouts.store';

const WORKOUT: Workout = {
  id: 'w1',
  ownerId: 'u1',
  title: 'Beine',
  description: 'Hart',
  exercises: [{ exerciseId: 'legs.squats', target: 30, sets: [15, 15] }],
  onProfile: true,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

async function setup(
  options: { id?: string; workouts?: Workout[]; loaded?: boolean } = {}
) {
  const params = options.id ? { id: options.id } : {};
  const store = {
    loaded: signal(options.loaded ?? true),
    busy: signal(false),
    lastRejection: signal<string | undefined>(undefined),
    workoutById: (id: string) =>
      (options.workouts ?? [WORKOUT]).find((w) => w.id === id) ?? null,
    create: vitest.fn().mockResolvedValue('new-id'),
    update: vitest.fn().mockResolvedValue(true),
  };
  const navigateByUrl = vitest.fn().mockResolvedValue(true);
  await render(WorkoutEditorComponent, {
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap(params)),
          snapshot: { paramMap: convertToParamMap(params) },
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
      { provide: WorkoutsStore, useValue: store },
    ],
  });
  return { store, navigateByUrl };
}

describe('WorkoutEditorComponent', () => {
  it('should start a new session with one pushup line', async () => {
    // given
    await setup();

    // then
    expect(screen.getByText('Neue Session')).toBeTruthy();
    expect(screen.getAllByTestId('workout-line')).toHaveLength(1);
  });

  it('should save what was typed and go back to the list', async () => {
    // given
    const { store, navigateByUrl } = await setup();
    const user = userEvent.setup();

    // when
    await user.type(screen.getByTestId('workout-title'), 'Kurz');
    await user.clear(screen.getByTestId('workout-line-target'));
    await user.type(screen.getByTestId('workout-line-target'), '25');
    await user.click(screen.getByTestId('workout-save'));

    // then
    expect(store.create).toHaveBeenCalledWith({
      title: 'Kurz',
      description: '',
      exercises: [{ exerciseId: 'pushup', target: 25 }],
      onProfile: false,
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/workouts');
  });

  it('should fill the target from the typed sets', async () => {
    // given
    const { store } = await setup();
    const user = userEvent.setup();

    // when
    await user.type(screen.getByTestId('workout-title'), 'Sätze');
    await user.type(screen.getByTestId('workout-line-sets'), '10, 10, 5');
    await user.click(screen.getByTestId('workout-save'));

    // then
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        exercises: [{ exerciseId: 'pushup', target: 25, sets: [10, 10, 5] }],
      })
    );
  });

  it('should add and remove exercise lines', async () => {
    // given
    await setup();
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-add-line'));
    expect(screen.getAllByTestId('workout-line')).toHaveLength(2);
    await user.click(screen.getAllByTestId('workout-line-remove')[0]);

    // then
    expect(screen.getAllByTestId('workout-line')).toHaveLength(1);
  });

  it('should stay on the page and show why a save was refused', async () => {
    // given
    const { store, navigateByUrl } = await setup();
    store.create.mockImplementation(async () => {
      store.lastRejection.set('title');
      return null;
    });
    const user = userEvent.setup();

    // when
    await user.click(screen.getByTestId('workout-save'));

    // then
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(screen.getByTestId('workout-editor-error').textContent).toContain(
      'Namen'
    );
  });

  it('should seed the form from the workout being edited and update it', async () => {
    // given
    const { store } = await setup({ id: 'w1' });
    const user = userEvent.setup();

    // then
    expect(screen.getByText('Session bearbeiten')).toBeTruthy();
    expect(
      (screen.getByTestId('workout-title') as HTMLInputElement).value
    ).toBe('Beine');
    expect(
      (screen.getByTestId('workout-line-sets') as HTMLInputElement).value
    ).toBe('15, 15');

    // when
    await user.click(screen.getByTestId('workout-save'));

    // then
    expect(store.update).toHaveBeenCalledWith('w1', {
      title: 'Beine',
      description: 'Hart',
      exercises: [{ exerciseId: 'legs.squats', target: 30, sets: [15, 15] }],
      onProfile: true,
    });
  });

  it('should say so when the workout to edit does not exist', async () => {
    await setup({ id: 'gone' });
    expect(screen.getByTestId('workout-editor-missing')).toBeTruthy();
  });

  it('should wait for the list before judging a workout missing', async () => {
    await setup({ id: 'w1', loaded: false, workouts: [] });
    expect(screen.queryByTestId('workout-editor-missing')).toBeNull();
    expect(screen.getByText('Session wird geladen …')).toBeTruthy();
  });
});
