import { computed, inject } from '@angular/core';
import { rxResource, toObservable } from '@angular/core/rxjs-interop';
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
import { createKeyedBusyState } from '@pu-stats/ui';
import { filter, firstValueFrom, of, timeout } from 'rxjs';

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
  /** Friends skipped by the last share because their list is full. */
  lastShareFull: number;
}

const initialState: WorkoutsState = {
  lastRejection: undefined,
  lastShared: 0,
  lastShareFull: 0,
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
    /** One flag per pressed CTA: `create`, `<action>:<workoutId>`. */
    _busy: createKeyedBusyState<string>(),
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
      busyKeys: store._busy.busyKeys,
      loaded: computed(() => store._resource.value() !== undefined),
      count: computed(() => workouts().length),
      canAddMore: computed(() => workouts().length < MAX_WORKOUTS),
      byId: computed(() => new Map(workouts().map((w) => [w.id, w]))),
    };
  }),
  withMethods((store) => {
    const loaded$ = toObservable(store.loaded);

    function userId(): string | null {
      return store._user.userIdSafe() || null;
    }

    /**
     * The limit check counts the mirrored list, which is empty until the
     * listener delivers — and the profile's copy button can be the first
     * thing to touch this store. Bounded, so a broken listener still lets
     * the write through rather than hanging the button.
     */
    function untilLoaded(): Promise<unknown> {
      return firstValueFrom(
        loaded$.pipe(
          filter(Boolean),
          timeout({ first: 5000, with: () => of(true) })
        )
      );
    }

    function run<T>(
      key: string,
      action: () => Promise<T>,
      fallback: T
    ): Promise<T> {
      patchState(store, { lastRejection: undefined });
      return store._busy.run(key, async () => {
        try {
          return await action();
        } catch {
          patchState(store, { lastRejection: 'failed' });
          return fallback;
        }
      });
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
      isBusy: (key: string): boolean => store._busy.isBusy(key),

      /** Returns the new id, or `null` when refused or failed. */
      create: (input: WorkoutInput): Promise<string | null> =>
        run(
          'create',
          async () => {
            const uid = userId();
            if (!uid || refuse(input, null)) return null;
            return await store._api.createWorkout(uid, input);
          },
          null
        ),

      update: (id: string, input: WorkoutInput): Promise<boolean> =>
        run(
          `update:${id}`,
          async () => {
            const uid = userId();
            if (!uid || refuse(input, id)) return false;
            await store._api.updateWorkout(uid, id, input);
            return true;
          },
          false
        ),

      remove: (id: string): Promise<boolean> =>
        run(
          `remove:${id}`,
          async () => {
            const uid = userId();
            if (!uid) return false;
            await store._api.deleteWorkout(uid, id);
            return true;
          },
          false
        ),

      setOnProfile: (id: string, onProfile: boolean): Promise<boolean> =>
        run(
          `profile:${id}`,
          async () => {
            const uid = userId();
            if (!uid) return false;
            await store._api.setOnProfile(uid, id, onProfile);
            return true;
          },
          false
        ),

      /** Send a copy to confirmed friends through the callable. */
      share: (
        id: string,
        friendUids: ReadonlyArray<string>
      ): Promise<boolean> =>
        run(
          `share:${id}`,
          async () => {
            const result = await store._share.share(id, friendUids);
            if (!result.ok) {
              patchState(store, { lastRejection: result.reason ?? 'failed' });
              return false;
            }
            patchState(store, {
              lastShared: result.sent ?? 0,
              lastShareFull: result.full?.length ?? 0,
            });
            return true;
          },
          false
        ),

      /**
       * Take a workout off someone's profile into the own list. The
       * projection is already sanitized server-side; the copy is private
       * until the user puts it on their own profile.
       */
      importWorkout: (
        workout: PublicProfileWorkout,
        from: WorkoutSource
      ): Promise<string | null> =>
        run(
          `import:${workout.id}`,
          async () => {
            await untilLoaded();
            const uid = userId();
            const input: WorkoutInput = {
              title: workout.title,
              description: workout.description,
              exercises: workout.exercises,
              onProfile: false,
            };
            if (!uid || refuse(input, null)) return null;
            return await store._api.createWorkout(uid, input, from);
          },
          null
        ),
    };
  })
);

export type WorkoutsStoreType = InstanceType<typeof WorkoutsStore>;
