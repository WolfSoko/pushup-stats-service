import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LiveDataStore } from '@pu-stats/data-access-state';
import type { ExerciseEntry, Workout } from '@pu-stats/models';

import { WorkoutsStore } from '../workouts.store';
import {
  WorkoutRunStateService,
  type WorkoutRunState,
} from './workout-run-state';
import { WorkoutRunStore } from './workout-run.store';

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

function entry(
  exerciseId: string,
  timestamp: string,
  value: Partial<ExerciseEntry>
): ExerciseEntry {
  return {
    _id: `${exerciseId}-${timestamp}`,
    userId: 'u1',
    exerciseId,
    timestamp,
    ...value,
  } as ExerciseEntry;
}

function setup(
  options: { saved?: WorkoutRunState | null; loaded?: boolean } = {}
) {
  const entries = signal<ExerciseEntry[]>([]);
  const state = {
    load: vitest.fn(() => options.saved ?? null),
    save: vitest.fn(),
    clear: vitest.fn(),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: WorkoutsStore,
        useValue: {
          loaded: signal(options.loaded ?? true),
          workoutById: (id: string) => (id === 'w1' ? WORKOUT : null),
        },
      },
      { provide: LiveDataStore, useValue: { exerciseEntries: entries } },
      { provide: WorkoutRunStateService, useValue: state },
      WorkoutRunStore,
    ],
  });
  return { store: TestBed.inject(WorkoutRunStore), entries, state };
}

const today = new Date().toISOString().slice(0, 10);

describe('WorkoutRunStore', () => {
  it('should present the workout as day one before anything counts', () => {
    // given
    const { store } = setup();

    // when
    store.open('w1');

    // then
    expect(store.dayIndex()).toBe(1);
    expect(store.day()?.exercises).toBe(WORKOUT.exercises);
    expect(store.started()).toBe(false);
    expect(store.dayProgress(1).map((p) => p.logged)).toEqual([0, 0]);
  });

  it('should count only entries logged after the run started', () => {
    // given — pushups from before the start, then after
    const { store, entries, state } = setup();
    store.open('w1');
    entries.set([entry('pushup', `${today}T00:00:01+02:00`, { reps: 20 })]);

    // when
    store.start();
    const startedAt = store.run()?.startedAt ?? '';
    const later = new Date(new Date(startedAt).getTime() + 60_000);
    entries.set([
      ...entries(),
      entry('pushup', later.toISOString(), { reps: 12 }),
    ]);

    // then
    expect(state.save).toHaveBeenCalledWith('w1', store.run());
    expect(store.dayProgress(1).map((p) => p.logged)).toEqual([12, 0]);
  });

  it('should close a ticked item without an entry', () => {
    // given
    const { store } = setup();
    store.open('w1');
    store.start();

    // when
    store.tick(1);
    store.tick(1);

    // then
    expect(store.run()?.checked).toEqual([1]);
    expect(store.dayProgress(1).map((p) => p.done)).toEqual([false, true]);
  });

  it('should resume a run saved earlier today', () => {
    // given
    const saved = { startedAt: `${today}T06:00:00+02:00`, checked: [0] };
    const { store, state } = setup({ saved });

    // when
    store.open('w1');

    // then
    expect(store.run()).toEqual(saved);
    expect(state.clear).not.toHaveBeenCalled();
  });

  it('should discard a run from another day', () => {
    // given
    const { store, state } = setup({
      saved: { startedAt: '2020-01-01T06:00:00+01:00', checked: [] },
    });

    // when
    store.open('w1');

    // then
    expect(store.run()).toBeNull();
    expect(state.clear).toHaveBeenCalledWith('w1');
  });

  it('should forget the run when it is finished', () => {
    // given
    const { store, state } = setup();
    store.open('w1');
    store.start();

    // when
    store.finish();

    // then
    expect(store.run()).toBeNull();
    expect(state.clear).toHaveBeenCalledWith('w1');
  });

  it('should tell an unknown id from one still loading', () => {
    const { store } = setup();
    store.open('gone');
    expect(store.missing()).toBe(true);
    expect(store.dayIndex()).toBeNull();

    const loading = setup({ loaded: false });
    loading.store.open('gone');
    expect(loading.store.missing()).toBe(false);
  });
});
