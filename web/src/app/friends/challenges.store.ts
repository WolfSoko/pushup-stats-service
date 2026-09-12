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
  withProps(() => ({ _api: inject(ChallengesApiService) })),
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

    /** `progress: false` for a surface that only counts, like the dashboard card. */
    async function reload(options?: { progress?: boolean }): Promise<void> {
      patchState(store, { loading: true });
      try {
        patchState(store, {
          challenges: await _api.list(options),
          loading: false,
        });
      } catch {
        patchState(store, { loading: false });
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
