import { inject, Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  docData,
  Firestore,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import {
  isValidXpRate,
  XP_CONFIG_DOC_PATH,
  type UserXp,
  type XpConfig,
} from '@pu-stats/models';
import { map, Observable, of } from 'rxjs';
import { PendingRequestsService } from '../pending-requests.service';

function toConfig(raw: unknown): XpConfig | null {
  const rates = (raw as { rates?: unknown } | undefined)?.rates;
  if (!rates || typeof rates !== 'object') return null;
  const clean: Record<string, number> = {};
  for (const [id, rate] of Object.entries(rates as Record<string, unknown>)) {
    if (isValidXpRate(rate)) clean[id] = rate;
  }
  return { rates: clean };
}

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

  /** XP booked per entry id — the frozen value, not a recomputation. */
  watchLedger(uid: string): Observable<ReadonlyMap<string, number>> {
    if (!this.firestore || !uid) return of(new Map());
    return collectionData(
      collection(this.firestore, `userXp/${uid}/xpLedger`),
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
    return docData(doc(this.firestore, XP_CONFIG_DOC_PATH)).pipe(map(toConfig));
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
