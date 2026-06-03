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
   * every existing consumer; new code reads `exerciseEntries`. The staged
   * pushup→exerciseEntries migration's sentinel copies (`exerciseId:'pushup'`)
   * are filtered out of this feed until the Phase-7 cutover.
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
   * snapshot. Distinct from `connected` (pushup-stream only) so consumers
   * reasoning about non-pushup history — the training-plan store's
   * idempotent logging — can tell "no exercise entries yet" from "haven't
   * loaded exercise entries yet" and avoid a duplicate write.
   */
  exerciseEntriesLoaded: boolean;
  connected: boolean;
  updateTick: number;
};

export const LiveDataStore = signalStore(
  { providedIn: 'root' },
  withState<LiveDataState>({
    entries: [],
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
            entries: [],
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
            entries: [],
            exerciseEntries: [],
            exerciseDefinitions: [],
            exerciseEntriesLoaded: false,
            updateTick: 0,
          });
          subscribedUid = u.uid;
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
              // Staged pushup→exerciseEntries migration copies carry
              // `exerciseId:'pushup'` and must stay invisible to the live
              // feed until the Phase-7 cutover, so browser consumers that
              // union `entries()` + `exerciseEntries()` don't double-count
              // pushups. The server-side trigger guards only cover
              // aggregates/leaderboards, not browser reads.
              exerciseEntries: snapshot.docs
                .map((d) => ({ _id: d.id, ...d.data() }) as ExerciseEntry)
                .filter((e) => e.exerciseId !== 'pushup'),
              exerciseEntriesLoaded: true,
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
