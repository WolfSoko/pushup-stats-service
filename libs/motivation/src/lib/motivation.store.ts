import { computed, inject, LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { MotivationQuoteService } from './motivation-quote.service';

const CACHE_PREFIX = 'motivation-quotes';

type MotivationState = {
  quotes: string[];
  loading: boolean;
  error: string | null;
  cacheDate: string | null;
};

const initialState: MotivationState = {
  quotes: [],
  loading: false,
  error: null,
  cacheDate: null,
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const MotivationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => {
    const locale = inject(LOCALE_ID) as string;
    const platformId = inject(PLATFORM_ID);
    return {
      _api: inject(MotivationQuoteService),
      _locale: locale,
      _lang: locale.startsWith('en') ? 'en' : 'de',
      _isBrowser: isPlatformBrowser(platformId),
    };
  }),
  withComputed((store) => ({
    todayQuote: computed(() => {
      const q = store.quotes();
      return q.length > 0 ? q[0] : null;
    }),
    hasCachedQuotes: computed(() => store.cacheDate() === todayStr()),
  })),
  withMethods(({ _api, _lang, _isBrowser, ...store }) => {
    function localStorageKey(): string {
      return `${CACHE_PREFIX}-${todayStr()}-${_lang}`;
    }

    function restoreFromCache(): void {
      if (!_isBrowser) return;
      try {
        const raw = localStorage.getItem(localStorageKey());
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          patchState(store, {
            quotes: parsed as string[],
            cacheDate: todayStr(),
          });
        }
      } catch {
        /* ignore */
      }
    }

    function saveToCache(quotes: string[]): void {
      if (!_isBrowser || !quotes.length) return;
      try {
        localStorage.setItem(localStorageKey(), JSON.stringify(quotes));
      } catch {
        /* ignore */
      }
    }

    return {
      restoreFromCache,

      async loadQuotes(userId?: string): Promise<void> {
        // Already loading - deduplicate
        if (store.loading()) return;

        // Cache is fresh for today
        if (store.cacheDate() === todayStr() && store.quotes().length > 0) {
          return;
        }

        patchState(store, { loading: true, error: null });

        try {
          const quotes = await _api.fetchQuotes(_lang, userId);
          if (quotes.length > 0) {
            saveToCache(quotes);
            patchState(store, {
              quotes,
              loading: false,
              cacheDate: todayStr(),
            });
          } else {
            patchState(store, { loading: false });
          }
        } catch (err) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.restoreFromCache();
    },
  })
);
