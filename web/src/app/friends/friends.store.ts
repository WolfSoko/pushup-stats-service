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
import { runStoreAction } from './store-action';

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
 * The friends screen's state — and, being root-provided, the nav badge's
 * and the dashboard card's.
 *
 * Every action re-reads the lists from the server rather than patching
 * them locally: the other side may have acted in the meantime, and a
 * friendship is a two-party record whose state is not ours to guess.
 */
export const FriendsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _api: inject(FriendsApiService),
    /** The reload in flight, so two consumers mounting at once share one call. */
    _reloading: null as Promise<void> | null,
  })),
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
  withMethods((store) => {
    const { _api } = store;

    function reload(): Promise<void> {
      if (store._reloading) return store._reloading;
      patchState(store, { loading: true });
      store._reloading = _api
        .list()
        .then((lists) => {
          patchState(store, {
            friends: lists.friends,
            incoming: lists.incoming,
            outgoing: lists.outgoing,
          });
        })
        .catch(() => {
          // The page keeps whatever it had; a failed refresh is not a
          // reason to empty the screen.
        })
        .finally(() => {
          store._reloading = null;
          patchState(store, { loading: false });
        });
      return store._reloading;
    }

    /**
     * Loads the board for a period. The friends page passes the period
     * the user picked and remembers it; a preview elsewhere (the
     * dashboard card) asks with `remember: false` so it never resets the
     * chips on the friends page under the user.
     */
    async function loadBoard(
      period?: FriendsBoardPeriod,
      options: { remember?: boolean } = {}
    ): Promise<void> {
      const next = period ?? store.boardPeriod();
      if (options.remember !== false) patchState(store, { boardPeriod: next });
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
      requestFriend: (uid: string) =>
        runStoreAction(store, () => _api.request(uid), reload),
      accept: (id: string) =>
        runStoreAction(store, () => _api.respond(id, true), reload),
      decline: (id: string) =>
        runStoreAction(store, () => _api.respond(id, false), reload),
      remove: (id: string) =>
        runStoreAction(store, () => _api.remove(id), reload),
      // A cheer changes the board (the count, and the button that sent
      // it), not the lists.
      cheer: (uid: string) =>
        runStoreAction(
          store,
          () => _api.cheer(uid),
          () => loadBoard()
        ),
    };
  })
);
