import { Timestamp } from 'firebase-admin/firestore';
import {
  NOTIFICATION_RETENTION_MS,
  type UserNotification,
} from '@pu-stats/models';

import { notificationDoc } from './logic';

const CHEER: UserNotification = {
  type: 'cheer',
  createdAt: '2026-09-20T08:00:00.000Z',
  readAt: null,
  actorUid: 'anna',
  actorName: 'Anna',
  url: '/freunde',
};

describe('notificationDoc', () => {
  it('should keep every field of the notification', () => {
    // when
    const doc = notificationDoc(CHEER, 0);

    // then
    expect(doc).toMatchObject(CHEER);
  });

  it('should expire the entry one retention period after it was written', () => {
    // given
    const nowMs = Date.parse('2026-09-20T08:00:00.000Z');

    // when
    const doc = notificationDoc(CHEER, nowMs);

    // then
    expect(doc['expiresAt']).toEqual(
      Timestamp.fromMillis(nowMs + NOTIFICATION_RETENTION_MS)
    );
  });

  it('should store the expiry as a Timestamp, because the TTL policy ignores strings', () => {
    // when
    const doc = notificationDoc(CHEER, Date.now());

    // then
    expect(doc['expiresAt']).toBeInstanceOf(Timestamp);
  });
});
