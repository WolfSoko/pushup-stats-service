import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  Firestore,
  serverTimestamp,
} from '@angular/fire/firestore';
import { FeedbackResult } from './feedback.models';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly firestore = inject(Firestore, { optional: true });

  async submit(feedback: FeedbackResult, userId?: string): Promise<void> {
    if (!this.firestore) {
      throw new Error('Firestore is not available.');
    }

    const feedbackRef = collection(this.firestore, 'feedback');
    await addDoc(feedbackRef, {
      name: feedback.name || null,
      email: feedback.email || null,
      message: feedback.message,
      userId: feedback.anonymous ? null : userId || null,
      createdAt: serverTimestamp(),
      userAgent: globalThis.navigator?.userAgent ?? null,
    });
  }
}
