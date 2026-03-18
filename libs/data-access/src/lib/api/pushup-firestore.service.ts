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
  writeBatch,
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
      source: payload.source ?? 'web',
      type: payload.type ?? 'Standard',
      createdAt: nowIso,
      updatedAt: nowIso,
      userId,
    };

    return from(
      setDoc(newRef, {
        timestamp: record.timestamp,
        reps: record.reps,
        source: record.source,
        type: record.type ?? 'Standard',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        userId,
      })
    ).pipe(map(() => record));
  }

  updatePushup(id: string, payload: PushupUpdate): Observable<void> {
    const rowRef = doc(this.firestore, PUSHUPS_COLLECTION, id);
    return from(
      updateDoc(rowRef, {
        ...payload,
        updatedAt: new Date().toISOString(),
      })
    ).pipe(map(() => void 0));
  }

  deletePushup(id: string): Observable<{ ok: true }> {
    const rowRef = doc(this.firestore, PUSHUPS_COLLECTION, id);
    return from(deleteDoc(rowRef)).pipe(map(() => ({ ok: true as const })));
  }

  /**
   * Migrates all pushup documents from `fromUserId` to `toUserId`.
   * Used when a guest signs into an existing account (UIDs differ).
   * Reads docs as `fromUserId`, batch-writes them under `toUserId`,
   * then deletes the originals.
   *
   * Firestore batch limit is 500 ops. Each doc = 1 write + 1 delete = 2 ops,
   * so we process up to 250 docs per batch.
   */
  async migrateUserData(fromUserId: string, toUserId: string): Promise<void> {
    if (fromUserId === toUserId) return;
    const pushupsRef = collection(this.firestore, PUSHUPS_COLLECTION);
    const q = query(pushupsRef, where('userId', '==', fromUserId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const BATCH_SIZE = 250;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(this.firestore);
      for (const d of chunk) {
        const newRef = doc(pushupsRef);
        batch.set(newRef, { ...d.data(), userId: toUserId });
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  }
}
