import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  collectionData,
  type CollectionReference,
  doc,
  Firestore,
  limit,
  orderBy,
  query,
  writeBatch,
} from '@angular/fire/firestore';
import type { UserNotification } from '@pu-stats/models';
import { Observable, of } from 'rxjs';
import { PendingRequestsService } from '../pending-requests.service';

export interface StoredNotification extends UserNotification {
  readonly id: string;
}

/**
 * The message inbox at `notifications/{uid}/inbox`.
 *
 * Entries are written by Cloud Functions; the only field a client may
 * touch is `readAt`, which the Firestore rules enforce. Capped at
 * {@link INBOX_LIMIT} — a bell and a list need the recent past, not the
 * archive, and the TTL policy drops entries after 30 days anyway.
 */
export const INBOX_LIMIT = 50;

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });
  private readonly pending = inject(PendingRequestsService);

  watch(userId: string): Observable<ReadonlyArray<StoredNotification>> {
    const uid = this.auth?.currentUser?.uid ?? userId;
    if (!this.firestore || !uid) return of([]);
    const ref = collection(
      this.firestore,
      `notifications/${uid}/inbox`
    ) as CollectionReference<StoredNotification>;
    return collectionData(
      query(ref, orderBy('createdAt', 'desc'), limit(INBOX_LIMIT)),
      { idField: 'id' }
    );
  }

  async remove(userId: string, ids: ReadonlyArray<string>): Promise<void> {
    const uid = this.auth?.currentUser?.uid ?? userId;
    if (!this.firestore || !uid || ids.length === 0) return;
    const batch = writeBatch(this.firestore);
    for (const id of ids) {
      batch.delete(doc(this.firestore, `notifications/${uid}/inbox/${id}`));
    }
    await this.pending.track(batch.commit());
  }

  async markRead(userId: string, ids: ReadonlyArray<string>): Promise<void> {
    const uid = this.auth?.currentUser?.uid ?? userId;
    if (!this.firestore || !uid || ids.length === 0) return;
    const readAt = new Date().toISOString();
    const batch = writeBatch(this.firestore);
    for (const id of ids) {
      batch.update(doc(this.firestore, `notifications/${uid}/inbox/${id}`), {
        readAt,
      });
    }
    await this.pending.track(batch.commit());
  }
}
