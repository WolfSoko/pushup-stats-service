import '@angular/localize/init';

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
