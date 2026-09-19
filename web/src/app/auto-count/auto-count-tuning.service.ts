import { inject, Injectable } from '@angular/core';
import {
  collection,
  CollectionReference,
  doc,
  DocumentData,
  DocumentReference,
  Firestore,
  getDocs,
  QuerySnapshot,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';

import {
  sanitizeTuningValues,
  type TuningKind,
  type TuningProfileDoc,
} from './auto-count-tuning.models';

export const AUTO_COUNT_PROFILES_COLLECTION = 'autoCountProfiles';

/**
 * Reads and writes the tuned detector profiles. One document per
 * detector profile id (`pushup`, `plank`, …), readable by every signed-in
 * client so a published profile takes effect everywhere, writable only
 * by admins (enforced in `firestore.rules`, not here).
 *
 * Firebase functions are held as instance properties so specs can swap
 * them via `Object.defineProperty` — module mocking is unreliable once
 * Angular's esbuild has resolved the imports.
 */
@Injectable({ providedIn: 'root' })
export class AutoCountTuningService {
  private readonly firestore = inject(Firestore, { optional: true });

  private readonly collectionFn: (
    firestore: Firestore,
    path: string
  ) => CollectionReference = collection;
  private readonly docFn: (
    ref: CollectionReference,
    id: string
  ) => DocumentReference = doc;
  private readonly getDocsFn: (
    ref: CollectionReference
  ) => Promise<QuerySnapshot> = getDocs;
  private readonly setDocFn: (
    ref: DocumentReference,
    data: DocumentData
  ) => Promise<unknown> = setDoc;
  private readonly serverTimestampFn: () => unknown = serverTimestamp;

  async load(): Promise<ReadonlyArray<TuningProfileDoc>> {
    if (!this.firestore) return [];
    const ref = this.collectionFn(
      this.firestore,
      AUTO_COUNT_PROFILES_COLLECTION
    );
    const snapshot = await this.getDocsFn(ref);
    const profiles: TuningProfileDoc[] = [];
    for (const document of snapshot.docs) {
      const data = document.data() as Record<string, unknown>;
      const kind: TuningKind = data['kind'] === 'hold' ? 'hold' : 'angle';
      profiles.push({
        exerciseId: document.id,
        kind,
        values: sanitizeTuningValues(kind, data['values']),
        published: data['published'] === true,
      });
    }
    return profiles;
  }

  async save(profile: TuningProfileDoc, userId: string): Promise<void> {
    if (!this.firestore) {
      throw new Error('Firestore is not available.');
    }
    const ref = this.docFn(
      this.collectionFn(this.firestore, AUTO_COUNT_PROFILES_COLLECTION),
      profile.exerciseId
    );
    await this.setDocFn(ref, {
      kind: profile.kind,
      values: sanitizeTuningValues(profile.kind, profile.values),
      published: profile.published,
      updatedBy: userId,
      updatedAt: this.serverTimestampFn(),
    });
  }
}
