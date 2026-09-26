import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { NotificationsApiService } from '@pu-stats/data-access';
import { createBusyState, createKeyedBusyState } from '@pu-stats/ui';
import { of } from 'rxjs';

import { ANNOUNCEMENTS } from '../core/feature-announcement.service';
import { UserConfigStore } from '../core/user-config.store';
import {
  buildInboxRows,
  filterInboxRows,
  unreadCount,
  type InboxFilter,
  type InboxRow,
} from './inbox-rows';

/**
 * The message inbox behind the toolbar bell.
 *
 * A Firestore listener, so an anfeuerung that arrives while the app is
 * open lands in the list without a reload — and one that arrived while
 * it was closed is there on the next visit, which is the whole point of
 * the collection.
 */
export const NotificationStore = signalStore(
  { providedIn: 'root' },
  // Unread by default: the inbox is a to-do list first and an archive second.
  withState({ inboxFilter: 'unread' as InboxFilter }),
  withProps(() => ({
    _api: inject(NotificationsApiService),
    _user: inject(UserContextService),
    _config: inject(UserConfigStore),
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
    markingAllRead: createBusyState(),
    /** Keyed `open:<id>` / `remove:<id>`, so each row spins on its own. */
    rowBusy: createKeyedBusyState<string>(),
  })),
  withProps((store) => ({
    inboxResource: rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) =>
        params.userId && store._isBrowser
          ? store._api.watch(params.userId)
          : of([]),
    }),
  })),
  withComputed((store) => {
    // Without the config, every announcement reads as unread — the bell
    // would flash a badge until `seenAnnouncements` arrives.
    const loaded = computed(
      () => store._config.loaded() && !store.inboxResource.isLoading()
    );
    const rows = computed<ReadonlyArray<InboxRow>>(() =>
      loaded()
        ? buildInboxRows(
            store.inboxResource.value() ?? [],
            ANNOUNCEMENTS,
            store._config.config()?.ui?.seenAnnouncements ?? []
          )
        : []
    );
    return {
      rows,
      /** The page's list, which the filter drives. */
      visibleRows: computed(() => filterInboxRows(rows(), store.inboxFilter())),
      /**
       * The bell's dropdown, always unread-only. A peek at what is new
       * has no use for an archive, and a filter in a popover is one
       * control too many on a phone.
       */
      unreadRows: computed(() => filterInboxRows(rows(), 'unread')),
      unreadCount: computed(() => unreadCount(rows())),
      hasUnread: computed(() => unreadCount(rows()) > 0),
      hasAny: computed(() => rows().length > 0),
      /** False until the listener's first snapshot and the user config are in, so the page shows a skeleton, not "empty". */
      loaded,
    };
  }),
  withMethods((store) => ({
    setFilter(inboxFilter: InboxFilter): void {
      patchState(store, { inboxFilter });
    },

    /**
     * Throws one entry away for good. Only real notifications have a
     * document to delete — an announcement lives in the static list, so
     * there is nothing to remove; marking it read is all it can offer.
     */
    async remove(row: InboxRow): Promise<void> {
      if (row.kind !== 'notification') return;
      const userId = store._user.userIdSafe();
      if (!userId) return;
      await store.rowBusy.run(
        `remove:${row.id}`,
        store._api.remove(userId, [row.id]).catch(() => undefined)
      );
    },

    /**
     * Marks one row read. An announcement has no document — its "read"
     * lives in `ui.seenAnnouncements`, the same flag the walkthrough
     * dialog sets, so opening it from here and from the dialog agree.
     */
    async markRead(row: InboxRow): Promise<void> {
      if (!row.unread) return;
      await store.rowBusy.run(`open:${row.id}`, async () => {
        if (row.kind === 'announcement') {
          await store._config
            .markAnnouncementSeen(row.id)
            .catch(() => undefined);
          return;
        }
        const userId = store._user.userIdSafe();
        if (!userId) return;
        await store._api.markRead(userId, [row.id]).catch(() => undefined);
      });
    },

    async markAllRead(): Promise<void> {
      await store.markingAllRead.run(async () => {
        const userId = store._user.userIdSafe();
        const unread = store.rows().filter((row) => row.unread);
        const ids = unread
          .filter((row) => row.kind === 'notification')
          .map((row) => row.id);
        if (userId && ids.length > 0) {
          await store._api.markRead(userId, ids).catch(() => undefined);
        }
        for (const row of unread.filter((r) => r.kind === 'announcement')) {
          await store._config
            .markAnnouncementSeen(row.id)
            .catch(() => undefined);
        }
      });
    },
  }))
);
