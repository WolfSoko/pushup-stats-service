import { isPlatformBrowser } from '@angular/common';
import { effect, inject, PLATFORM_ID } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';
import {
  ExerciseDefinition,
  ExerciseEntry,
  PushupRecord,
} from '@pu-stats/models';
import {
  patchState,
  signalStore,
  withHooks,
  withProps,
  withState,
} from '@ngrx/signals';

type LiveDataState = {
  entries: PushupRecord[];
  /**
   * Live mirror of `exerciseEntries` (sit-ups, squats, …) for the
   * current user. Pushups stay on `entries` for backwards compat with
   * every existing consumer; new code reads `exerciseEntries`.
   */
  exerciseEntries: ExerciseEntry[];
  /**
   * User-defined exercise definitions — exposed as an empty signal
   * until the storage layer (Firestore collection + rules + UI) lands.
   * Consumers like the analysis page already thread this through
   * `unifiedEntryCategoryId` so that a custom exercise's category
   * resolves the moment definitions start flowing in. See issue #319.
   */
  exerciseDefinitions: ExerciseDefinition[];
  connected: boolean;
  updateTick: number;
};

export const LiveDataStore = signalStore(
  { providedIn: 'root' },
  withState<LiveDataState>({
    entries: [],
    exerciseEntries: [],
    exerciseDefinitions: [],
    connected: false,
    updateTick: 0,
  }),
  withProps(() => ({
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
    _auth: isPlatformBrowser(inject(PLATFORM_ID))
      ? inject(Auth, { optional: true })
      : null,
    _firestore: isPlatformBrowser(inject(PLATFORM_ID))
      ? inject(Firestore, { optional: true })
      : null,
  })),
  withHooks({
    onInit(store) {
      if (!store._isBrowser || !store._auth || !store._firestore) {
        return;
      }

      const fs = store._firestore;
      const user = toSignal(authState(store._auth));

      effect((onCleanup) => {
        const u = user();
        if (!u) {
          patchState(store, {
            connected: false,
            entries: [],
            exerciseEntries: [],
            exerciseDefinitions: [],
            updateTick: 0,
          });
          return;
        }
        const pushupQuery = query(
          collection(fs, 'pushups'),
          where('userId', '==', u.uid),
          orderBy('timestamp', 'asc')
        );
        const exerciseQuery = query(
          collection(fs, 'exerciseEntries'),
          where('userId', '==', u.uid),
          orderBy('timestamp', 'asc')
        );
        const unsubPushups = onSnapshot(
          pushupQuery,
          (snapshot) => {
            patchState(store, {
              connected: true,
              entries: snapshot.docs.map(
                (d) => ({ _id: d.id, ...d.data() }) as PushupRecord
              ),
              updateTick: store.updateTick() + 1,
            });
          },
          () => patchState(store, { connected: false })
        );
        const unsubExercises = onSnapshot(
          exerciseQuery,
          (snapshot) => {
            // `connected` is intentionally NOT set here — the pushup
            // subscription is the canonical liveness indicator. If we
            // also flipped it to `true` from this handler, an
            // exercise-only success would mask a concurrent pushup
            // subscription failure (the error handler on the pushup
            // stream sets `connected: false`).
            patchState(store, {
              exerciseEntries: snapshot.docs.map(
                (d) => ({ _id: d.id, ...d.data() }) as ExerciseEntry
              ),
              updateTick: store.updateTick() + 1,
            });
          },
          // A failure on the exerciseEntries subscription must not flip
          // `connected` to false either — same reason: pushups own the
          // canonical signal.
          () => undefined
        );
        onCleanup(() => {
          unsubPushups();
          unsubExercises();
        });
      });
    },
  })
);
