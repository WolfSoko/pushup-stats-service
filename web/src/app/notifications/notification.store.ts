import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { NotificationsApiService } from '@pu-stats/data-access';
import { of } from 'rxjs';

import { ANNOUNCEMENTS } from '../core/feature-announcement.service';
import { UserConfigStore } from '../core/user-config.store';
import { buildInboxRows, unreadCount, type InboxRow } from './inbox-rows';

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
  withProps(() => ({
    _api: inject(NotificationsApiService),
    _user: inject(UserContextService),
    _config: inject(UserConfigStore),
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
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
    const rows = computed<ReadonlyArray<InboxRow>>(() =>
      buildInboxRows(
        store.inboxResource.value() ?? [],
        ANNOUNCEMENTS,
        store._config.config()?.ui?.seenAnnouncements ?? []
      )
    );
    return {
      rows,
      unreadCount: computed(() => unreadCount(rows())),
      hasUnread: computed(() => unreadCount(rows()) > 0),
    };
  }),
  withMethods((store) => ({
    /**
     * Marks one row read. An announcement has no document — its "read"
     * lives in `ui.seenAnnouncements`, the same flag the walkthrough
     * dialog sets, so opening it from here and from the dialog agree.
     */
    async markRead(row: InboxRow): Promise<void> {
      if (!row.unread) return;
      if (row.kind === 'announcement') {
        await store._config.markAnnouncementSeen(row.id).catch(() => undefined);
        return;
      }
      const userId = store._user.userIdSafe();
      if (!userId) return;
      await store._api.markRead(userId, [row.id]).catch(() => undefined);
    },

    async markAllRead(): Promise<void> {
      const userId = store._user.userIdSafe();
      const unread = store.rows().filter((row) => row.unread);
      const ids = unread
        .filter((row) => row.kind === 'notification')
        .map((row) => row.id);
      if (userId && ids.length > 0) {
        await store._api.markRead(userId, ids).catch(() => undefined);
      }
      for (const row of unread.filter((r) => r.kind === 'announcement')) {
        await store._config.markAnnouncementSeen(row.id).catch(() => undefined);
      }
    },
  }))
);
