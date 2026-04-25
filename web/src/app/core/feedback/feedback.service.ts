import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  CollectionReference,
  DocumentData,
  Firestore,
  serverTimestamp,
} from '@angular/fire/firestore';
import { FeedbackResult } from './feedback.models';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly firestore = inject(Firestore, { optional: true });

  // Store Firebase functions as instance properties so tests can override them
  // via Object.defineProperty without relying on vi.mock module interception
  // (which is unreliable when Angular's esbuild resolves imports at compile time).
  private readonly collectionFn: (
    firestore: Firestore,
    path: string
  ) => CollectionReference = collection;
  private readonly addDocFn: (
    ref: CollectionReference,
    data: DocumentData
  ) => Promise<unknown> = addDoc;
  private readonly serverTimestampFn: () => unknown = serverTimestamp;

  async submit(feedback: FeedbackResult, userId?: string): Promise<void> {
    if (!this.firestore) {
      throw new Error('Firestore is not available.');
    }

    const feedbackRef = this.collectionFn(this.firestore, 'feedback');
    await this.addDocFn(feedbackRef, {
      name: feedback.name || null,
      email: feedback.email || null,
      message: feedback.message,
      userId: feedback.anonymous ? null : userId || null,
      createdAt: this.serverTimestampFn(),
      userAgent: globalThis.navigator?.userAgent ?? null,
    });
  }
}
