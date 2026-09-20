import type { StoredNotification } from '@pu-stats/data-access';

import type { FeatureAnnouncement } from '../core/feature-announcement.service';
import { buildInboxRows, filterInboxRows } from './inbox-rows';

const ANNOUNCEMENT: FeatureAnnouncement = {
  id: 'feature-1',
  load: () => Promise.resolve(class {}),
  label: 'Neu: irgendwas',
  url: '/workouts',
};

function notification(
  overrides: Partial<StoredNotification> = {}
): StoredNotification {
  return {
    id: 'n1',
    type: 'cheer',
    createdAt: '2026-09-20T08:00:00.000Z',
    readAt: null,
    actorUid: 'anna',
    actorName: 'Anna',
    url: '/freunde',
    ...overrides,
  };
}

describe('buildInboxRows', () => {
  it('should keep a notification the user has already read', () => {
    // when
    const rows = buildInboxRows(
      [notification({ readAt: '2026-09-20T09:00:00.000Z' })],
      [],
      []
    );

    // then — reading something is not the same as wanting it gone
    expect(rows).toHaveLength(1);
    expect(rows[0].unread).toBe(false);
  });

  it('should keep an announcement the user has already seen', () => {
    // when
    const rows = buildInboxRows([], [ANNOUNCEMENT], [ANNOUNCEMENT.id]);

    // then
    expect(rows).toHaveLength(1);
    expect(rows[0].unread).toBe(false);
  });

  it('should mark an unseen announcement unread', () => {
    // when
    const rows = buildInboxRows([], [ANNOUNCEMENT], []);

    // then
    expect(rows[0].unread).toBe(true);
  });

  it('should put announcements before notifications, having no timestamp', () => {
    // when
    const rows = buildInboxRows([notification()], [ANNOUNCEMENT], []);

    // then
    expect(rows.map((r) => r.kind)).toEqual(['announcement', 'notification']);
  });
});

describe('filterInboxRows', () => {
  const rows = buildInboxRows(
    [
      notification({ id: 'unread' }),
      notification({ id: 'read', readAt: '2026-09-20T09:00:00.000Z' }),
    ],
    [ANNOUNCEMENT],
    [ANNOUNCEMENT.id]
  );

  it('should show only unread rows under the default filter', () => {
    // when
    const visible = filterInboxRows(rows, 'unread');

    // then
    expect(visible.map((r) => r.id)).toEqual(['unread']);
  });

  it('should show everything under the all filter', () => {
    // when
    const visible = filterInboxRows(rows, 'all');

    // then
    expect(visible.map((r) => r.id)).toEqual([
      ANNOUNCEMENT.id,
      'unread',
      'read',
    ]);
  });
});
