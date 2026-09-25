import { inject, Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  docData,
  Firestore,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import {
  parseXpConfig,
  XP_CONFIG_DOC_PATH,
  type UserXp,
  type XpConfig,
} from '@pu-stats/models';
import { map, Observable, of } from 'rxjs';
import { PendingRequestsService } from '../pending-requests.service';

/**
 * Reads the server-derived XP state (`userXp/{uid}` and its ledger) and
 * the admin-maintained rates (`xpConfig/current`). XP itself is never
 * written from the client — only the rates, and only by admins.
 */
@Injectable({ providedIn: 'root' })
export class XpApiService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly pending = inject(PendingRequestsService);

  watchUserXp(uid: string): Observable<UserXp | null> {
    if (!this.firestore || !uid) return of(null);
    return docData(doc(this.firestore, `userXp/${uid}`)).pipe(
      map((raw) => (raw as UserXp | undefined) ?? null)
    );
  }

  /**
   * XP booked per entry id — the frozen value, not a recomputation.
   * `fromIso` limits the listener to entries on or after that date.
   */
  watchLedger(
    uid: string,
    fromIso?: string
  ): Observable<ReadonlyMap<string, number>> {
    if (!this.firestore || !uid) return of(new Map());
    const ledger = collection(this.firestore, `userXp/${uid}/xpLedger`);
    return collectionData(
      fromIso ? query(ledger, where('timestamp', '>=', fromIso)) : ledger,
      { idField: 'id' }
    ).pipe(
      map(
        (rows) =>
          new Map(
            (rows as Array<{ id: string; xp?: unknown }>).map((r) => [
              r.id,
              Number(r.xp ?? 0) || 0,
            ])
          )
      )
    );
  }

  watchConfig(): Observable<XpConfig | null> {
    if (!this.firestore) return of(null);
    return docData(doc(this.firestore, XP_CONFIG_DOC_PATH)).pipe(
      map(parseXpConfig)
    );
  }

  /** Replaces the whole rate map — never merged (nested-map clobber). */
  async saveConfig(
    rates: Readonly<Record<string, number>>,
    adminUid: string
  ): Promise<void> {
    if (!this.firestore) return;
    await this.pending.track(
      setDoc(doc(this.firestore, XP_CONFIG_DOC_PATH), {
        rates: { ...rates },
        updatedBy: adminUid,
        updatedAt: serverTimestamp(),
      })
    );
  }
}
