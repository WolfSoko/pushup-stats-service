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
  cachedUserId: string | null;
};

const initialState: MotivationState = {
  quotes: [],
  loading: false,
  error: null,
  cacheDate: null,
  cachedUserId: null,
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
    let _inFlightPromise: Promise<void> | null = null;

    function localStorageKey(userId?: string): string {
      const userSuffix = userId ? `-${userId}` : '';
      return `${CACHE_PREFIX}-${todayStr()}-${_lang}${userSuffix}`;
    }

    function isCacheFresh(userId?: string): boolean {
      return (
        store.cacheDate() === todayStr() &&
        store.cachedUserId() === (userId ?? null) &&
        store.quotes().length > 0
      );
    }

    function restoreFromCache(userId?: string): void {
      if (!_isBrowser) return;
      try {
        const raw = localStorage.getItem(localStorageKey(userId));
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          patchState(store, {
            quotes: parsed as string[],
            cacheDate: todayStr(),
            cachedUserId: userId ?? null,
          });
        }
      } catch {
        /* ignore */
      }
    }

    function saveToCache(quotes: string[], userId?: string): void {
      if (!_isBrowser || !quotes.length) return;
      try {
        localStorage.setItem(localStorageKey(userId), JSON.stringify(quotes));
      } catch {
        /* ignore */
      }
    }

    return {
      restoreFromCache,

      async loadQuotes(userId?: string): Promise<void> {
        // Cache is fresh for today and same user
        if (isCacheFresh(userId)) return;

        // Deduplicate in-flight requests: wait for existing load
        if (_inFlightPromise) return _inFlightPromise;

        patchState(store, { loading: true, error: null });

        _inFlightPromise = (async () => {
          try {
            const quotes = await _api.fetchQuotes(_lang, userId);
            if (quotes.length > 0) {
              saveToCache(quotes, userId);
              patchState(store, {
                quotes,
                loading: false,
                cacheDate: todayStr(),
                cachedUserId: userId ?? null,
              });
            } else {
              patchState(store, { loading: false });
            }
          } catch (err) {
            patchState(store, {
              loading: false,
              error: err instanceof Error ? err.message : String(err),
            });
          } finally {
            _inFlightPromise = null;
          }
        })();

        return _inFlightPromise;
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.restoreFromCache();
    },
  })
);
