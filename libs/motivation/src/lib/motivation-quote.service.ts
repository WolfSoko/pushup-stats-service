import { inject, Injectable, LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Functions, httpsCallable } from '@angular/fire/functions';

const CACHE_PREFIX = 'motivation-quotes';

@Injectable({ providedIn: 'root' })
export class MotivationQuoteService {
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly functions: Functions | null = this.isBrowser
    ? inject(Functions, { optional: true })
    : null;

  private inFlightFetch: Promise<string[]> | null = null;

  /** Returns today's first quote (deterministic, cached). Null on SSR/error. */
  async getTodayQuote(
    opts: { totalToday?: number; dailyGoal?: number; displayName?: string } = {}
  ): Promise<string | null> {
    const quotes = await this.getTodayQuotes(opts);
    if (!quotes.length) return null;
    return quotes[0];
  }

  /** Returns all cached quotes for today. Fetches if cache is empty/stale. */
  async getTodayQuotes(
    opts: { totalToday?: number; dailyGoal?: number; displayName?: string } = {}
  ): Promise<string[]> {
    const cached = this.loadCache();
    if (cached) return cached;
    const fresh = await this.fetchQuotes(opts);
    this.saveCache(fresh);
    return fresh;
  }

  private get lang(): string {
    return this.locale.startsWith('en') ? 'en' : 'de';
  }

  private cacheKey(): string {
    const today = new Date().toISOString().slice(0, 10);
    return `${CACHE_PREFIX}-${today}-${this.lang}`;
  }

  private loadCache(): string[] | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(this.cacheKey());
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    } catch {
      /* ignore */
    }
    return null;
  }

  private saveCache(quotes: string[]): void {
    if (!this.isBrowser || !quotes.length) return;
    try {
      localStorage.setItem(this.cacheKey(), JSON.stringify(quotes));
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
