import { signal } from '@angular/core';

import type { InboxRow } from './inbox-rows';

export const UNREAD_ROW: InboxRow = {
  id: 'n1',
  kind: 'notification',
  category: 'social',
  icon: 'favorite',
  text: 'Anna feuert dich an',
  createdAt: '2026-09-20T08:00:00.000Z',
  unread: true,
  url: '/freunde',
};

/** A `NotificationStore` stand-in whose busy flags the spec flips by hand. */
export function notificationStoreMock() {
  const markingAllRead = signal(false);
  const busyKeys = signal<ReadonlySet<string>>(new Set());
  const rows = signal<ReadonlyArray<InboxRow>>([UNREAD_ROW]);
  return {
    markingAllRead: { busy: markingAllRead.asReadonly() },
    rowBusy: { isBusy: (key: string) => busyKeys().has(key) },
    setMarkingAllRead: (busy: boolean) => markingAllRead.set(busy),
    setBusyKeys: (keys: string[]) => busyKeys.set(new Set(keys)),
    rows: rows.asReadonly(),
    visibleRows: rows.asReadonly(),
    unreadRows: rows.asReadonly(),
    unreadCount: () => rows().filter((row) => row.unread).length,
    hasUnread: () => rows().some((row) => row.unread),
    hasAny: () => rows().length > 0,
    inboxFilter: signal<'unread' | 'all'>('unread').asReadonly(),
    setFilter: vitest.fn(),
    markAllRead: vitest.fn().mockResolvedValue(undefined),
    markRead: vitest.fn().mockResolvedValue(undefined),
    remove: vitest.fn().mockResolvedValue(undefined),
  };
}
