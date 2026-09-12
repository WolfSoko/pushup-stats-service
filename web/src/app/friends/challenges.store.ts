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
  type ChallengeView,
  type CreateChallengeInput,
} from './challenges-api.service';
import type { FriendActionReason } from './friends-api.service';

type ChallengesState = {
  challenges: ReadonlyArray<ChallengeView>;
  loading: boolean;
  lastRejection: FriendActionReason;
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
    active: computed(() =>
      store.challenges().filter((c) => c.status === 'active')
    ),
    ended: computed(() =>
      store.challenges().filter((c) => c.status === 'ended')
    ),
  })),
  withMethods(({ _api, ...store }) => {
    async function reload(): Promise<void> {
      patchState(store, { loading: true });
      try {
        patchState(store, { challenges: await _api.list(), loading: false });
      } catch {
        patchState(store, { loading: false });
      }
    }

    async function act(
      action: () => Promise<{ ok: boolean; reason?: FriendActionReason }>
    ): Promise<boolean> {
      patchState(store, { lastRejection: undefined });
      try {
        const result = await action();
        if (!result.ok) {
          patchState(store, { lastRejection: result.reason ?? 'failed' });
          return false;
        }
        await reload();
        return true;
      } catch {
        patchState(store, { lastRejection: 'failed' });
        return false;
      }
    }

    return {
      reload,
      create: (input: CreateChallengeInput) => act(() => _api.create(input)),
      leave: (id: string) => act(() => _api.leave(id)),
    };
  })
);
