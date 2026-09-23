import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { toBerlinIsoDate } from '@pu-stats/date';
import { createKeyedBusyState } from '@pu-stats/ui';

import {
  FriendsApiService,
  type FriendActionReason,
} from './friends-api.service';

type CheerState = {
  /** Berlin day the `sent` list belongs to; a new day starts empty. */
  day: string;
  sent: ReadonlyArray<string>;
  lastRejection: FriendActionReason;
};

const initialState: CheerState = {
  day: '',
  sent: [],
  lastRejection: undefined,
};

function today(): string {
  return toBerlinIsoDate(new Date());
}

/**
 * Cheers sent from anywhere but the friends board: a challenge card, the
 * dashboard's mini board, a friend's profile. Those surfaces read the
 * "already cheered" flag once with their data; this store remembers what
 * was sent since, so a flame lit on one surface is lit on all of them
 * without re-reading challenge sums or a profile for it.
 */
export const CheerStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _api: inject(FriendsApiService),
    _busy: createKeyedBusyState<string>(),
  })),
  withMethods((store) => {
    function sentToday(): ReadonlyArray<string> {
      return store.day() === today() ? store.sent() : [];
    }

    function markCheered(uid: string): void {
      const sent = sentToday();
      if (!sent.includes(uid)) {
        patchState(store, { day: today(), sent: [...sent, uid] });
      }
    }

    async function send(uid: string): Promise<boolean> {
      patchState(store, { lastRejection: undefined });
      try {
        const result = await store._api.cheer(uid);
        // `already` means a cheer from another tab or device got there
        // first — the flame should show that, not stay tappable.
        if (result.ok || result.reason === 'already') markCheered(uid);
        if (!result.ok) {
          patchState(store, { lastRejection: result.reason ?? 'failed' });
        }
        return result.ok;
      } catch {
        patchState(store, { lastRejection: 'failed' });
        return false;
      }
    }

    return {
      markCheered,
      hasCheered: (uid: string) => sentToday().includes(uid),
      isCheering: (uid: string) => store._busy.isBusy(uid),
      cheer: (uid: string) => store._busy.run(uid, () => send(uid)),
    };
  })
);
