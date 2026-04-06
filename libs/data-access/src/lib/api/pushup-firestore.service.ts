import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  orderBy,
  query,
  QueryConstraint,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import {
  PushupCreate,
  PushupRecord,
  PushupUpdate,
  StatsFilter,
} from '@pu-stats/models';
import { from, map, Observable } from 'rxjs';

const PUSHUPS_COLLECTION = 'pushups';

@Injectable({ providedIn: 'root' })
export class PushupFirestoreService {
  private readonly firestore = inject(Firestore);

  listPushups(
    userId: string,
    filter?: StatsFilter
  ): Observable<PushupRecord[]> {
    const pushupsRef = collection(this.firestore, PUSHUPS_COLLECTION);
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      orderBy('timestamp', 'asc'),
    ];
    if (filter?.from) {
      constraints.push(
        where('timestamp', '>=', `${filter.from}T00:00:00.000Z`)
      );
    }
    if (filter?.to) {
      constraints.push(where('timestamp', '<=', `${filter.to}T23:59:59.999Z`));
    }

    const q = query(pushupsRef, ...constraints);

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs
          .map((d) => {
            const data = d.data() as Omit<PushupRecord, '_id'>;
            return { _id: d.id, ...data } as PushupRecord;
          })
          .filter((record) => {
            const date = record.timestamp.slice(0, 10);
            return (
              (!filter?.from || date >= filter.from) &&
              (!filter?.to || date <= filter.to)
            );
          })
      )
    );
  }

  createPushup(
    userId: string,
    payload: PushupCreate
  ): Observable<PushupRecord> {
    const pushupsRef = collection(this.firestore, PUSHUPS_COLLECTION);
    const newRef = doc(pushupsRef);
    const nowIso = new Date().toISOString();
    const record: PushupRecord & { userId: string } = {
      _id: newRef.id,
      timestamp: payload.timestamp,
      reps: payload.reps,
      ...(payload.sets?.length ? { sets: payload.sets } : {}),
      source: payload.source ?? 'web',
      type: payload.type ?? 'Standard',
      createdAt: nowIso,
      updatedAt: nowIso,
      userId,
    };

    const firestoreData: Record<string, unknown> = {
      timestamp: record.timestamp,
      reps: record.reps,
      source: record.source,
      type: record.type ?? 'Standard',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      userId,
    };
    if (payload.sets?.length) {
      firestoreData['sets'] = payload.sets;
    }

    return from(setDoc(newRef, firestoreData)).pipe(map(() => record));
  }

  updatePushup(id: string, payload: PushupUpdate): Observable<void> {
    const rowRef = doc(this.firestore, PUSHUPS_COLLECTION, id);
    // Filter out undefined values and empty arrays — Firestore rejects undefined,
    // and empty sets should be omitted to match createPushup behavior.
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(
        ([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)
      )
    );
    return from(
      updateDoc(rowRef, {
        ...cleanPayload,
        updatedAt: new Date().toISOString(),
      })
    ).pipe(map(() => void 0));
  }

  deletePushup(id: string): Observable<{ ok: true }> {
    const rowRef = doc(this.firestore, PUSHUPS_COLLECTION, id);
    return from(deleteDoc(rowRef)).pipe(map(() => ({ ok: true as const })));
  }

  /**
   * Client-side migration of pushup documents between different userIds is
   * intentionally disabled.
   *
   * With strict Firestore rules (`resource.data.userId == request.auth.uid`
   * and `request.resource.data.userId == request.auth.uid`), a client
   * authenticated as `toUserId` cannot read `fromUserId`'s documents or write
   * documents owned by a different uid. Any cross-user migration must be
   * performed in a trusted backend (e.g. Cloud Function / Admin SDK).
   *
   * Kept as a no-op for API compatibility; `AuthService.migrateGuestDataSafe`
   * wraps calls in a try/catch and only console.warns on failure.
   */

  async migrateUserData(_fromUserId: string, _toUserId: string): Promise<void> {
    // No-op by design. See comment above.
  }
}
