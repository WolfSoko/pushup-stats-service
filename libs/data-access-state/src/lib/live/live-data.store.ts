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
import { ExerciseDefinition, ExerciseEntry } from '@pu-stats/models';
import {
  patchState,
  signalStore,
  withHooks,
  withProps,
  withState,
} from '@ngrx/signals';

type LiveDataState = {
  /**
   * Live mirror of every `exerciseEntries` doc for the current user —
   * post Phase-7 cutover this includes pushups (`exerciseId:'pushup'`),
   * which are the sole source for pushup history now that writes land
   * here and the legacy `pushups` collection is no longer read.
   */
  exerciseEntries: ExerciseEntry[];
  /**
   * User-defined exercise definitions. Currently always empty: the
   * Firestore collection is not yet provisioned (rules forbid client
   * writes), so the signal is plumbing for the eventual storage layer.
   * The shape is fixed now so category-resolution chains can rely on
   * `id`/`categoryId` without a follow-up type change.
   */
  exerciseDefinitions: ExerciseDefinition[];
  /**
   * True once the `exerciseEntries` subscription has delivered its first
   * snapshot. Distinct from `connected` (which can flip back to false on a
   * stream error) so the training-plan store's idempotent logging can tell
   * "no entries yet" from "haven't loaded entries yet" and avoid a
   * duplicate write.
   */
  exerciseEntriesLoaded: boolean;
  /**
   * Liveness of the `exerciseEntries` subscription — the canonical "live
   * data is ready" signal for every entry-derived view (pushups included).
   */
  connected: boolean;
  updateTick: number;
};

export const LiveDataStore = signalStore(
  { providedIn: 'root' },
  withState<LiveDataState>({
    exerciseEntries: [],
    exerciseDefinitions: [],
    exerciseEntriesLoaded: false,
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

      // Tracks which uid the live subscriptions are currently mirroring.
      // A closure var, not a state signal: reading + patching a state field
      // inside this same effect would retrigger it and loop forever.
      let subscribedUid: string | null = null;

      effect((onCleanup) => {
        const u = user();
        if (!u) {
          patchState(store, {
            connected: false,
            exerciseEntries: [],
            exerciseDefinitions: [],
            exerciseEntriesLoaded: false,
            updateTick: 0,
          });
          subscribedUid = null;
          return;
        }
        // Switching signed-in users (uid A → uid B without an intervening
        // sign-out) must drop the previous account's mirrors so consumers
        // never read another uid's history before B's snapshots arrive.
        if (u.uid !== subscribedUid) {
          patchState(store, {
            connected: false,
            exerciseEntries: [],
            exerciseDefinitions: [],
            exerciseEntriesLoaded: false,
            updateTick: 0,
          });
          subscribedUid = u.uid;
        }
        const exerciseQuery = query(
          collection(fs, 'exerciseEntries'),
          where('userId', '==', u.uid),
          orderBy('timestamp', 'asc')
        );
        const unsubExercises = onSnapshot(
          exerciseQuery,
          (snapshot) => {
            // Post-cutover this feed is the single source for all entry
            // history, pushups included (`exerciseId:'pushup'`). Its first
            // snapshot is the canonical liveness signal.
            patchState(store, {
              connected: true,
              exerciseEntries: snapshot.docs.map(
                (d) => ({ _id: d.id, ...d.data() }) as ExerciseEntry
              ),
              exerciseEntriesLoaded: true,
              updateTick: store.updateTick() + 1,
            });
          },
          () => patchState(store, { connected: false })
        );
        onCleanup(() => {
          unsubExercises();
        });
      });
    },
  })
);
