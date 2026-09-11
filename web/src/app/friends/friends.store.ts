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
  FriendsApiService,
  type FriendActionReason,
  type FriendRow,
  type FriendsBoardEntry,
  type FriendsBoardPeriod,
} from './friends-api.service';

type FriendsState = {
  friends: ReadonlyArray<FriendRow>;
  incoming: ReadonlyArray<FriendRow>;
  outgoing: ReadonlyArray<FriendRow>;
  loading: boolean;
  /** Reason the last action was refused, for the page to explain it. */
  lastRejection: FriendActionReason;
  board: ReadonlyArray<FriendsBoardEntry>;
  boardPeriod: FriendsBoardPeriod;
};

const initialState: FriendsState = {
  friends: [],
  incoming: [],
  outgoing: [],
  loading: false,
  lastRejection: undefined,
  board: [],
  boardPeriod: 'week',
};

/**
 * The friends screen's state.
 *
 * Every action re-reads the lists from the server rather than patching
 * them locally: the other side may have acted in the meantime, and a
 * friendship is a two-party record whose state is not ours to guess.
 */
export const FriendsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({ _api: inject(FriendsApiService) })),
  withComputed((store) => ({
    friendCount: computed(() => store.friends().length),
    /** Requests waiting for this user — what the nav badge counts. */
    pendingCount: computed(() => store.incoming().length),
    isEmpty: computed(
      () =>
        store.friends().length === 0 &&
        store.incoming().length === 0 &&
        store.outgoing().length === 0
    ),
  })),
  withMethods(({ _api, ...store }) => {
    async function reload(): Promise<void> {
      patchState(store, { loading: true });
      try {
        const lists = await _api.list();
        patchState(store, {
          friends: lists.friends,
          incoming: lists.incoming,
          outgoing: lists.outgoing,
          loading: false,
        });
      } catch {
        // The page keeps whatever it had; a failed refresh is not a reason
        // to empty the screen.
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

    async function loadBoard(period?: FriendsBoardPeriod): Promise<void> {
      const next = period ?? store.boardPeriod();
      patchState(store, { boardPeriod: next });
      try {
        patchState(store, { board: await _api.board(next) });
      } catch {
        // The board is the extra on this page, not the page.
        patchState(store, { board: [] });
      }
    }

    return {
      reload,
      loadBoard,
      requestFriend: (uid: string) => act(() => _api.request(uid)),
      accept: (id: string) => act(() => _api.respond(id, true)),
      decline: (id: string) => act(() => _api.respond(id, false)),
      remove: (id: string) => act(() => _api.remove(id)),
    };
  })
);
