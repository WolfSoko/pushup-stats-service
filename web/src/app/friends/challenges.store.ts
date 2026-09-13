import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import {
  ChallengesApiService,
  type ChallengeActionReason,
  type ChallengeView,
  type CreateChallengeInput,
} from './challenges-api.service';
import { runStoreAction } from './store-action';

type ChallengesState = {
  challenges: ReadonlyArray<ChallengeView>;
  loading: boolean;
  lastRejection: ChallengeActionReason;
};

const initialState: ChallengesState = {
  challenges: [],
  loading: false,
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
  })),
  withComputed((store) => ({
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
    async function reload(options?: { progress?: boolean }): Promise<void> {
      const ticket = ++store._reloadSeq;
      patchState(store, { loading: true });
      try {
        const challenges = await _api.list(options);
        if (ticket !== store._reloadSeq) return;
        patchState(store, { challenges, loading: false });
      } catch {
        if (ticket === store._reloadSeq) patchState(store, { loading: false });
      }
    }

    const refresh = () => reload();
    return {
      reload,
      create: (input: CreateChallengeInput) =>
        runStoreAction(store, () => _api.create(input), refresh),
      accept: (id: string) =>
        runStoreAction(store, () => _api.respond(id, true), refresh),
      decline: (id: string) =>
        runStoreAction(store, () => _api.respond(id, false), refresh),
      leave: (id: string) =>
        runStoreAction(store, () => _api.leave(id), refresh),
    };
  })
);
