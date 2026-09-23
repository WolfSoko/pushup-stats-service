import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { WorkoutRemindersApiService } from '@pu-stats/data-access';
import {
  workoutReminderRejection,
  type WorkoutReminder,
  type WorkoutReminderInput,
} from '@pu-stats/models';
import { createKeyedBusyState } from '@pu-stats/ui';
import { of } from 'rxjs';

/**
 * The user's session reminders, keyed by workout. Root provided: the
 * list page shows them on the cards, the dialog edits them, and the
 * in-app fallback reads them to show a local notification.
 */
export const WorkoutRemindersStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _api: inject(WorkoutRemindersApiService),
    _user: inject(UserContextService),
    /** `save:<workoutId>` / `remove:<workoutId>`. */
    _busy: createKeyedBusyState<string>(),
  })),
  withProps((store) => ({
    _resource: rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) =>
        params.userId ? store._api.listReminders(params.userId) : of([]),
    }),
  })),
  withComputed((store) => {
    const reminders = computed<ReadonlyArray<WorkoutReminder>>(
      () => store._resource.value() ?? []
    );
    return {
      reminders,
      busyKeys: store._busy.busyKeys,
      byWorkoutId: computed(
        () => new Map(reminders().map((r) => [r.workoutId, r]))
      ),
    };
  }),
  withMethods((store) => {
    function userId(): string | null {
      return store._user.userIdSafe() || null;
    }

    return {
      reminderFor: (workoutId: string): WorkoutReminder | null =>
        store.byWorkoutId().get(workoutId) ?? null,

      /** `false` when the input is not a schedule or the write failed. */
      save: (
        workoutId: string,
        input: WorkoutReminderInput
      ): Promise<boolean> =>
        store._busy.run(`save:${workoutId}`, async () => {
          const uid = userId();
          if (!uid || workoutReminderRejection(input)) return false;
          try {
            await store._api.saveReminder(uid, workoutId, input);
            return true;
          } catch {
            return false;
          }
        }),

      /**
       * Deleting a document that is not there is refused by the rules
       * (they read the owner off it), so only a known reminder is removed.
       */
      remove: (workoutId: string): Promise<boolean> =>
        store._busy.run(`remove:${workoutId}`, async () => {
          const uid = userId();
          if (!uid || !store.byWorkoutId().has(workoutId)) return true;
          try {
            await store._api.deleteReminder(uid, workoutId);
            return true;
          } catch {
            return false;
          }
        }),
    };
  })
);

export type WorkoutRemindersStoreType = InstanceType<
  typeof WorkoutRemindersStore
>;
