import { inject, Injectable, LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { doc, Firestore, getDoc, setDoc } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';

const CACHE_PREFIX = 'motivation-quotes';
const FIRESTORE_COLLECTION = 'motivation-quotes';

@Injectable({ providedIn: 'root' })
export class MotivationQuoteService {
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly firestore: Firestore | null = this.isBrowser
    ? inject(Firestore, { optional: true })
    : null;
  private readonly functions: Functions | null = this.isBrowser
    ? inject(Functions, { optional: true })
    : null;

  private inFlightFetch: Promise<string[]> | null = null;

  /** Returns today's first quote (deterministic, cached). Null on SSR/error. */
  async getTodayQuote(
    opts: {
      userId?: string;
      totalToday?: number;
      dailyGoal?: number;
      displayName?: string;
    } = {}
  ): Promise<string | null> {
    const quotes = await this.getTodayQuotes(opts);
    if (!quotes.length) return null;
    return quotes[0];
  }

  /** Returns all cached quotes for today. Fetches if cache is empty/stale. */
  async getTodayQuotes(
    opts: {
      userId?: string;
      totalToday?: number;
      dailyGoal?: number;
      displayName?: string;
    } = {}
  ): Promise<string[]> {
    const cached = await this.loadCache(opts.userId);
    if (cached) return cached;
    const fresh = await this.fetchQuotes(opts);
    await this.saveCache(fresh, opts.userId);
    return fresh;
  }

  private get lang(): string {
    return this.locale.startsWith('en') ? 'en' : 'de';
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private localStorageKey(): string {
    return `${CACHE_PREFIX}-${this.todayStr()}-${this.lang}`;
  }

  private firestoreDocId(userId: string): string {
    return `${userId}_${this.todayStr()}_${this.lang}`;
  }

  private async loadCache(userId?: string): Promise<string[] | null> {
    if (!this.isBrowser) return null;

    if (userId && this.firestore) {
      return this.loadFromFirestore(userId);
    }
    return this.loadFromLocalStorage();
  }

  private async saveCache(quotes: string[], userId?: string): Promise<void> {
    if (!this.isBrowser || !quotes.length) return;

    if (userId && this.firestore) {
      await this.saveToFirestore(userId, quotes);
    } else {
      this.saveToLocalStorage(quotes);
    }
  }

  private async loadFromFirestore(userId: string): Promise<string[] | null> {
    if (!this.firestore) return null;
    try {
      const docRef = doc(
        this.firestore,
        FIRESTORE_COLLECTION,
        this.firestoreDocId(userId)
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
    quotes: string[]
  ): Promise<void> {
    if (!this.firestore) return;
    try {
      const docRef = doc(
        this.firestore,
        FIRESTORE_COLLECTION,
        this.firestoreDocId(userId)
      );
      await setDoc(docRef, {
        quotes,
        userId,
        date: this.todayStr(),
        lang: this.lang,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }
  }

  private loadFromLocalStorage(): string[] | null {
    try {
      const raw = localStorage.getItem(this.localStorageKey());
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    } catch {
      /* ignore */
    }
    return null;
  }

  private saveToLocalStorage(quotes: string[]): void {
    try {
      localStorage.setItem(this.localStorageKey(), JSON.stringify(quotes));
    } catch {
      /* ignore */
    }
  }

  private fetchQuotes(opts: {
    totalToday?: number;
    dailyGoal?: number;
    displayName?: string;
  }): Promise<string[]> {
    if (this.inFlightFetch) return this.inFlightFetch;
    if (!this.functions) return Promise.resolve([]);

    this.inFlightFetch = (async () => {
      try {
        const callable = httpsCallable<
          {
            language: string;
            totalToday: number;
            dailyGoal: number;
            displayName: string;
          },
          { quotes: string[] }
        >(this.functions!, 'generateMotivationQuotes');

        const result = await callable({
          language: this.lang,
          totalToday: opts.totalToday ?? 0,
          dailyGoal: opts.dailyGoal ?? 100,
          displayName: opts.displayName ?? 'Champ',
        });
        return result.data?.quotes ?? [];
      } catch {
        return [];
      } finally {
        this.inFlightFetch = null;
      }
    })();

    return this.inFlightFetch;
  }
}
