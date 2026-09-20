import type { NotificationCategory } from '@pu-stats/models';
import type { StoredNotification } from '@pu-stats/data-access';

import type { FeatureAnnouncement } from '../core/feature-announcement.service';
import { notificationView } from './notification-text';

/**
 * One row in the inbox, from either source.
 *
 * Feature announcements are merged in here rather than written to
 * Firestore: a fan-out would mean one write per user per release, for
 * text that already ships in the bundle.
 */
export interface InboxRow {
  readonly id: string;
  readonly kind: 'notification' | 'announcement';
  readonly category: NotificationCategory;
  readonly icon: string;
  readonly text: string;
  /** ISO timestamp; `null` for an announcement, which has no moment. */
  readonly createdAt: string | null;
  readonly unread: boolean;
  readonly url: string;
}

/** Which rows the list shows. Unread is the default — the rest is archive. */
export type InboxFilter = 'unread' | 'all';

export function buildInboxRows(
  notifications: ReadonlyArray<StoredNotification>,
  announcements: ReadonlyArray<FeatureAnnouncement>,
  seenAnnouncementIds: ReadonlyArray<string>
): ReadonlyArray<InboxRow> {
  // Seen announcements stay in the list rather than disappearing: reading
  // something is not the same as wanting it gone. The unread filter keeps
  // them out of the way by default.
  const announced = announcements.map((a): InboxRow => ({
    id: a.id,
    kind: 'announcement',
    category: 'system',
    icon: 'auto_awesome',
    text: a.label,
    createdAt: null,
    unread: !seenAnnouncementIds.includes(a.id),
    url: a.url,
  }));

  const rows = notifications.map((notification): InboxRow => {
    const view = notificationView(notification);
    return {
      id: notification.id,
      kind: 'notification',
      category: view.category,
      icon: view.icon,
      text: view.text,
      createdAt: notification.createdAt,
      unread: notification.readAt === null,
      url: notification.url,
    };
  });

  // Announcements first: they have no timestamp to sort by, and a "what's
  // new" note is stale the moment it scrolls out of sight.
  return [...announced, ...rows];
}

export function filterInboxRows(
  rows: ReadonlyArray<InboxRow>,
  filter: InboxFilter
): ReadonlyArray<InboxRow> {
  return filter === 'unread' ? rows.filter((row) => row.unread) : rows;
}

export function unreadCount(rows: ReadonlyArray<InboxRow>): number {
  return rows.filter((row) => row.unread).length;
}
