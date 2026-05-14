import '@angular/localize/init';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeFr from '@angular/common/locales/fr';

// `formatNumber` / `DecimalPipe` and friends look the active locale up
// in Angular's static locale registry. The production build bakes the
// locale data into each `localize`-d bundle, but tests run against the
// raw bundle — without this registration any spec that pins
// `LOCALE_ID: 'de-DE'` would silently fall back to en-US formatting.
//
// `fr` is here so specs can exercise the space-grouped (NBSP) format
// path that the km parser must tolerate for 1000+ km round-trips.
registerLocaleData(localeDe);
registerLocaleData(localeDe, 'de-DE');
registerLocaleData(localeFr);
registerLocaleData(localeFr, 'fr-FR');

// Polyfill Node.js globals für Firebase SDK in Browser-Tests
globalThis.process =
  globalThis.process || ({ env: {} } as { env: Record<string, unknown> });
// Ersetze 'any' durch einen spezifischeren Typ für bessere Lint-Konformität

// jsdom doesn't ship IntersectionObserver; @defer (on viewport) and
// @defer (hydrate on viewport) rely on it. Stub fires immediately so deferred
// content renders synchronously in tests.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    private readonly callback: IntersectionObserverCallback;
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}
