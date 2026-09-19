import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { WorkoutsApiService } from '@pu-stats/data-access';
import {
  MAX_WORKOUTS,
  type PublicProfileWorkout,
  type Workout,
  type WorkoutInput,
  workoutRejection,
  type WorkoutRejection,
  type WorkoutSource,
} from '@pu-stats/models';
import { of } from 'rxjs';

import {
  WorkoutShareApiService,
  type WorkoutShareReason,
} from './workout-share-api.service';

export type WorkoutActionReason =
  | WorkoutRejection
  | WorkoutShareReason
  | 'failed'
  | undefined;

interface WorkoutsState {
  /** Why the last action was refused, for the page to explain it. */
  lastRejection: WorkoutActionReason;
  /** Friends who got the last share, for the confirmation. */
  lastShared: number;
  busy: boolean;
}

const initialState: WorkoutsState = {
  lastRejection: undefined,
  lastShared: 0,
  busy: false,
};

/**
 * The user's workouts: the live list plus every action on it. Root
 * provided — the list page, the editor, the session and the profile's
 * "copy this" button all read the same mirror, and a write shows up
 * everywhere through the Firestore listener rather than a local patch.
 */
export const WorkoutsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _api: inject(WorkoutsApiService),
    _share: inject(WorkoutShareApiService),
    _user: inject(UserContextService),
  })),
  withProps((store) => ({
    _resource: rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) =>
        params.userId ? store._api.listWorkouts(params.userId) : of([]),
    }),
  })),
  withComputed((store) => {
    const workouts = computed<ReadonlyArray<Workout>>(
      () => store._resource.value() ?? []
    );
    return {
      workouts,
      loaded: computed(() => store._resource.value() !== undefined),
      count: computed(() => workouts().length),
      canAddMore: computed(() => workouts().length < MAX_WORKOUTS),
      byId: computed(() => new Map(workouts().map((w) => [w.id, w]))),
    };
  }),
  withMethods((store) => {
    function userId(): string | null {
      return store._user.userIdSafe() || null;
    }

    async function run<T>(action: () => Promise<T>, fallback: T): Promise<T> {
      patchState(store, { lastRejection: undefined, busy: true });
      try {
        return await action();
      } catch {
        patchState(store, { lastRejection: 'failed' });
        return fallback;
      } finally {
        patchState(store, { busy: false });
      }
    }

    /** Validates like the rules would; a refusal lands in `lastRejection`. */
    function refuse(input: WorkoutInput, editingId: string | null): boolean {
      const count = store.workouts().filter((w) => w.id !== editingId).length;
      const rejection = workoutRejection(input, { count });
      if (rejection) patchState(store, { lastRejection: rejection });
      return rejection !== null;
    }

    return {
      workoutById: (id: string): Workout | null => store.byId().get(id) ?? null,

      /** Returns the new id, or `null` when refused or failed. */
      create: (input: WorkoutInput): Promise<string | null> =>
        run(async () => {
          const uid = userId();
          if (!uid || refuse(input, null)) return null;
          return await store._api.createWorkout(uid, input);
        }, null),

      update: (id: string, input: WorkoutInput): Promise<boolean> =>
        run(async () => {
          const uid = userId();
          if (!uid || refuse(input, id)) return false;
          await store._api.updateWorkout(uid, id, input);
          return true;
        }, false),

      remove: (id: string): Promise<boolean> =>
        run(async () => {
          const uid = userId();
          if (!uid) return false;
          await store._api.deleteWorkout(uid, id);
          return true;
        }, false),

      setOnProfile: (id: string, onProfile: boolean): Promise<boolean> =>
        run(async () => {
          const uid = userId();
          if (!uid) return false;
          await store._api.setOnProfile(uid, id, onProfile);
          return true;
        }, false),

      /** Send a copy to confirmed friends through the callable. */
      share: (
        id: string,
        friendUids: ReadonlyArray<string>
      ): Promise<boolean> =>
        run(async () => {
          const result = await store._share.share(id, friendUids);
          if (!result.ok) {
            patchState(store, { lastRejection: result.reason ?? 'failed' });
            return false;
          }
          patchState(store, { lastShared: result.sent ?? 0 });
          return true;
        }, false),

      /**
       * Take a workout off someone's profile into the own list. The
       * projection is already sanitized server-side; the copy is private
       * until the user puts it on their own profile.
       */
      importWorkout: (
        workout: PublicProfileWorkout,
        from: WorkoutSource
      ): Promise<string | null> =>
        run(async () => {
          const uid = userId();
          const input: WorkoutInput = {
            title: workout.title,
            description: workout.description,
            exercises: workout.exercises,
            onProfile: false,
          };
          if (!uid || refuse(input, null)) return null;
          return await store._api.createWorkout(uid, input, from);
        }, null),
    };
  })
);

export type WorkoutsStoreType = InstanceType<typeof WorkoutsStore>;
