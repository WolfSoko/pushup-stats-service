import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { LiveDataStore } from '@pu-stats/data-access-state';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
import {
  planDayItemId,
  planDayProgress,
  type PlanExerciseProgress,
  type TrainingPlanDay,
  type Workout,
  workoutToPlanDay,
} from '@pu-stats/models';

import type { SessionSource } from '../../training-plans/session/session-source';
import { WorkoutsStore } from '../workouts.store';
import {
  isRunFromToday,
  runDate,
  WorkoutRunStateService,
  type WorkoutRunState,
} from './workout-run-state';

/** The one day a workout session walks. */
export const WORKOUT_DAY_INDEX = 1;

interface WorkoutRunStoreState {
  workoutId: string | null;
  run: WorkoutRunState | null;
}

/**
 * The workout session's {@link SessionSource}: the workout as a plan
 * day, with fulfillment read from the live entry mirror the same way a
 * plan day reads it. Component-scoped, like the session store it feeds.
 *
 * Before the run starts nothing counts, so the start screen shows the
 * prescription untouched; from `start()` on, entries logged since then
 * close the steps, and hand ticks live in the run state.
 */
export const WorkoutRunStore = signalStore(
  withState<WorkoutRunStoreState>({ workoutId: null, run: null }),
  withProps(() => ({
    _workouts: inject(WorkoutsStore),
    _live: inject(LiveDataStore),
    _state: inject(WorkoutRunStateService),
  })),
  withComputed((store) => {
    const workout = computed<Workout | null>(() => {
      const id = store.workoutId();
      return id ? store._workouts.workoutById(id) : null;
    });
    const day = computed<TrainingPlanDay | null>(() => {
      const w = workout();
      return w ? workoutToPlanDay(w) : null;
    });
    return {
      workout,
      day,
      dayIndex: computed<number | null>(() =>
        day() ? WORKOUT_DAY_INDEX : null
      ),
      /** True once the list has delivered but this id is not in it. */
      missing: computed(
        () =>
          store.workoutId() !== null &&
          store._workouts.loaded() &&
          workout() === null
      ),
      started: computed(() => store.run() !== null),
    };
  }),
  withMethods((store) => {
    function persist(run: WorkoutRunState): void {
      const id = store.workoutId();
      patchState(store, { run });
      if (id) store._state.save(id, run);
    }

    return {
      /** Bind to a workout and pick up today's unfinished run, if any. */
      open(workoutId: string): void {
        const saved = store._state.load(workoutId);
        const today = nowLocalIsoTimestamp().slice(0, 10);
        if (saved && !isRunFromToday(saved, today)) {
          store._state.clear(workoutId);
        }
        patchState(store, {
          workoutId,
          run: isRunFromToday(saved, today) ? saved : null,
        });
      },

      /** Start counting: entries from now on close the steps. */
      start(): void {
        if (store.run()) return;
        persist({ startedAt: nowLocalIsoTimestamp(), checked: [] });
      },

      /** Close an item without an entry. */
      tick(itemIndex: number): void {
        const run = store.run();
        if (!run || run.checked.includes(itemIndex)) return;
        persist({ ...run, checked: [...run.checked, itemIndex] });
      },

      /** The workout is done or abandoned; the next visit starts fresh. */
      finish(): void {
        const id = store.workoutId();
        patchState(store, { run: null });
        if (id) store._state.clear(id);
      },

      dayProgress(dayIndex: number): ReadonlyArray<PlanExerciseProgress> {
        const day = store.day();
        if (!day || dayIndex !== WORKOUT_DAY_INDEX) return [];
        const run = store.run();
        return planDayProgress(day, WORKOUT_DAY_INDEX, {
          entries: run ? store._live.exerciseEntries() : [],
          dateIso: run ? runDate(run) : '',
          completedItems: run
            ? run.checked.map((i) => planDayItemId(WORKOUT_DAY_INDEX, i))
            : [],
          dayActivatedAt: run?.startedAt,
        });
      },
    };
  })
);

export type WorkoutRunStoreType = InstanceType<typeof WorkoutRunStore>;

// The store is handed to the session through `SESSION_SOURCE`; this
// assignment fails to compile the moment it stops satisfying the contract.
export function asSessionSource(store: WorkoutRunStoreType): SessionSource {
  return store;
}
