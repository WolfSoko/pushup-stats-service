import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { createKeyedBusyState } from '@pu-stats/ui';

import {
  ChallengesApiService,
  type ChallengeActionReason,
  type ChallengeView,
  type CreateChallengeInput,
} from './challenges-api.service';
import { withKnownProgress } from './merge-challenge-progress';
import { runStoreAction } from './store-action';

type ChallengesState = {
  challenges: ReadonlyArray<ChallengeView>;
  loading: boolean;
  /** The last reload threw — what is shown may be stale, say so. */
  loadFailed: boolean;
  lastRejection: ChallengeActionReason;
};

const initialState: ChallengesState = {
  challenges: [],
  loading: false,
  loadFailed: false,
  lastRejection: undefined,
};

/**
 * The challenges on the friends screen. Like the friends lists, every
 * action re-reads from the server: the numbers are other people's
 * entries, and a participant may have left in the meantime.
 */
export const ChallengesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _api: inject(ChallengesApiService),
    /** Ticket of the newest reload; older answers arriving later are dropped. */
    _reloadSeq: 0,
    /** The reload in flight, so several badges asking at once share one call. */
    _inFlight: null as { progress: boolean; promise: Promise<void> } | null,
    /** One flag per pressed CTA (`create`, `accept:<id>`, …), up through the re-read. */
    _busy: createKeyedBusyState<string>(),
  })),
  withComputed((store) => ({
    busyKeys: store._busy.busyKeys,
    /** Asked, not yet answered — these want a decision first. */
    invitations: computed(() =>
      store.challenges().filter((c) => c.viewerInvited)
    ),
    active: computed(() =>
      store
        .challenges()
        .filter((c) => c.status === 'active' && !c.viewerInvited)
    ),
    ended: computed(() =>
      store.challenges().filter((c) => c.status === 'ended')
    ),
  })),
  withMethods((store) => {
    const { _api } = store;

    /**
     * `progress: false` for a surface that only counts, like the dashboard
     * card. The dashboard and the friends page share this store and may
     * ask at nearly the same time; only the newest request's answer is
     * kept, so a slow count-only reply cannot overwrite the page's full
     * list after the fact.
     */
    function reload(options?: { progress?: boolean }): Promise<void> {
      const progress = options?.progress !== false;
      // A full call answers a count-only one too, so a badge asking for
      // counts joins it instead of superseding it — otherwise its ticket
      // wins the race and the page's sums are thrown away unread.
      if (store._inFlight && (store._inFlight.progress || !progress)) {
        return store._inFlight.promise;
      }
      const ticket = ++store._reloadSeq;
      patchState(store, { loading: true });
      const promise = _api
        .list(options)
        .then((fresh) => {
          if (ticket !== store._reloadSeq) return;
          const challenges = progress
            ? fresh
            : withKnownProgress(fresh, store.challenges());
          patchState(store, { challenges, loading: false, loadFailed: false });
        })
        .catch(() => {
          if (ticket === store._reloadSeq) {
            patchState(store, { loading: false, loadFailed: true });
          }
        })
        .finally(() => {
          if (store._inFlight?.promise === promise) store._inFlight = null;
        });
      store._inFlight = { progress, promise };
      return promise;
    }

    const refresh = () => reload();
    const { _busy } = store;
    return {
      reload,
      isBusy: (key: string) => _busy.isBusy(key),
      create: (input: CreateChallengeInput) =>
        _busy.run('create', () =>
          runStoreAction(store, () => _api.create(input), refresh)
        ),
      accept: (id: string) =>
        _busy.run(`accept:${id}`, () =>
          runStoreAction(store, () => _api.respond(id, true), refresh)
        ),
      decline: (id: string) =>
        _busy.run(`decline:${id}`, () =>
          runStoreAction(store, () => _api.respond(id, false), refresh)
        ),
      leave: (id: string) =>
        _busy.run(`leave:${id}`, () =>
          runStoreAction(store, () => _api.leave(id), refresh)
        ),
    };
  })
);
