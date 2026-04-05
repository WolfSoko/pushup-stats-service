import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { doc, Firestore, getDoc, setDoc } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';

const FIRESTORE_COLLECTION = 'motivation-quotes';

@Injectable({ providedIn: 'root' })
export class MotivationQuoteService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly firestore: Firestore | null = this.isBrowser
    ? inject(Firestore, { optional: true })
    : null;
  private readonly functions: Functions | null = this.isBrowser
    ? inject(Functions, { optional: true })
    : null;

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private firestoreDocId(userId: string, lang: string): string {
    return `${userId}_${this.todayStr()}_${lang}`;
  }

  /**
   * Fetches quotes from the Cloud Function, with Firestore cache fallback
   * for authenticated users. Pure API call - no localStorage caching.
   */
  async fetchQuotes(
    locale: string,
    userId?: string,
    context?: { totalToday?: number; dailyGoal?: number; displayName?: string }
  ): Promise<string[]> {
    if (!this.isBrowser) return [];

    // Try Firestore cache first for authenticated users
    if (userId && this.firestore) {
      const cached = await this.loadFromFirestore(userId, locale);
      if (cached) return cached;
    }

    // Fetch from Cloud Function
    const quotes = await this.callCloudFunction(locale, context);

    // Save to Firestore for authenticated users
    if (userId && this.firestore && quotes.length > 0) {
      await this.saveToFirestore(userId, locale, quotes);
    }

    return quotes;
  }

  private async loadFromFirestore(
    userId: string,
    lang: string
  ): Promise<string[] | null> {
    if (!this.firestore) return null;
    try {
      const docRef = doc(
        this.firestore,
        FIRESTORE_COLLECTION,
        this.firestoreDocId(userId, lang)
      );
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as { quotes?: string[] };
        if (Array.isArray(data.quotes) && data.quotes.length > 0) {
          return data.quotes;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private async saveToFirestore(
    userId: string,
    lang: string,
    quotes: string[]
  ): Promise<void> {
    if (!this.firestore) return;
    try {
      const docRef = doc(
        this.firestore,
        FIRESTORE_COLLECTION,
        this.firestoreDocId(userId, lang)
      );
      await setDoc(docRef, {
        quotes,
        userId,
        date: this.todayStr(),
        lang,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }
  }

  private async callCloudFunction(
    lang: string,
    context?: { totalToday?: number; dailyGoal?: number; displayName?: string }
  ): Promise<string[]> {
    if (!this.functions) return [];
    const callable = httpsCallable<
      {
        language: string;
        totalToday: number;
        dailyGoal: number;
        displayName: string;
      },
      { quotes: string[] }
    >(this.functions, 'generateMotivationQuotes');

    const payload = {
      language: lang,
      totalToday: context?.totalToday ?? 0,
      dailyGoal: context?.dailyGoal ?? 100,
      displayName: context?.displayName ?? 'Champ',
    };

    try {
      const result = await callable(payload);
      return result.data?.quotes ?? [];
    } catch (err) {
      console.warn(
        'callCloudFunction(generateMotivationQuotes) failed',
        { lang, context: payload },
        err
      );
      throw err;
    }
  }
}
