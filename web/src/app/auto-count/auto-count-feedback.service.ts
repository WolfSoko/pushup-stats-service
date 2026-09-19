import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  CollectionReference,
  DocumentData,
  Firestore,
  serverTimestamp,
} from '@angular/fire/firestore';
import { UserContextService } from '@pu-auth/auth';

import type { AutoCountFeedback } from './auto-count-feedback.models';

export const AUTO_COUNT_FEEDBACK_COLLECTION = 'autoCountFeedback';

/**
 * Records how well a finished auto-count run matched reality. Write-only
 * from the client (see `firestore.rules`); the numbers are read back
 * through the admin callables, same as the human feedback collection.
 *
 * Firebase functions are held as instance properties so specs can swap
 * them via `Object.defineProperty`.
 */
@Injectable({ providedIn: 'root' })
export class AutoCountFeedbackService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly user = inject(UserContextService);

  private readonly collectionFn: (
    firestore: Firestore,
    path: string
  ) => CollectionReference = collection;
  private readonly addDocFn: (
    ref: CollectionReference,
    data: DocumentData
  ) => Promise<unknown> = addDoc;
  private readonly serverTimestampFn: () => unknown = serverTimestamp;

  async submit(feedback: AutoCountFeedback): Promise<void> {
    if (!this.firestore) return;
    const ref = this.collectionFn(
      this.firestore,
      AUTO_COUNT_FEEDBACK_COLLECTION
    );
    await this.addDocFn(ref, {
      exerciseId: feedback.exerciseId,
      profileId: feedback.profileId,
      mode: feedback.mode,
      detectedReps: feedback.detectedReps,
      actualReps: feedback.actualReps,
      thresholds: { ...feedback.thresholds },
      userId: this.user.userIdSafe() || null,
      userAgent: globalThis.navigator?.userAgent ?? null,
      createdAt: this.serverTimestampFn(),
    });
  }
}
