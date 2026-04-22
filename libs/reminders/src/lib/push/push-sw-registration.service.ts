import { inject, Injectable, LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Build the locale-prefixed URL / scope for the push service worker.
 *
 * Angular i18n produces per-locale bundles served under `/de/` or `/en/`;
 * there is no root handler that serves `/push/...`, so the SW has to live
 * under the locale prefix. Scope rule: a SW script may only control a
 * scope equal to or narrower than its own path — placing the script at
 * `/{locale}/push/sw-push.js` gives the browser `/{locale}/push/` scope
 * with no `Service-Worker-Allowed` header required.
 *
 * Side effect of locale-scoping: a user who switches locale gets a
 * separate subscription per locale — same behaviour as the prior setup,
 * which registered the SW via Angular's `<base href>` (also per-locale).
 */
export function buildPushSwPaths(locale: string): {
  path: string;
  scope: string;
} {
  const normalized = locale.toLowerCase().startsWith('en') ? 'en' : 'de';
  return {
    path: `/${normalized}/push/sw-push.js`,
    scope: `/${normalized}/push/`,
  };
}

/**
 * Registers and resolves the push service worker registration.
 *
 * The Angular service worker (`ngsw-worker.js`) owns scope `/` (well, the
 * locale sub-tree once Angular's base-href kicks in) and is registered via
 * Angular's `provideServiceWorker`. This service owns the separate push
 * worker at `/{locale}/push/`. Keeping the two isolated means:
 *   - Angular's SW stays stock (no upstream merge conflicts on upgrade).
 *   - Push + notificationclick logic can change without invalidating the
 *     asset cache, and vice versa.
 *
 * All push code paths (subscribe, getSubscription, showNotification,
 * notificationclick) must resolve the registration via `getRegistration()`
 * from this service — never `navigator.serviceWorker.getRegistration()`
 * (which returns the first match, typically ngsw).
 */
@Injectable({ providedIn: 'root' })
export class PushSwRegistrationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly paths = buildPushSwPaths(inject(LOCALE_ID));

  /** Max time to wait for `register()` on a slow network / worker boot. */
  private static readonly REGISTER_TIMEOUT_MS = 15_000;

  private registrationPromise: Promise<
    ServiceWorkerRegistration | undefined
  > | null = null;

  /**
   * Resolve the push SW registration, kicking off registration on first call.
   * Returns `undefined` during SSR, when the Service Worker API is missing
   * (private mode, ancient browser), or when registration times out.
   *
   * Safe to call multiple times — the registration promise is memoised so
   * concurrent `subscribe()`/`init()`/`tick()` callers share one register.
   */
  async getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    if (!this.isBrowser || !('serviceWorker' in navigator)) return undefined;

    // Fast path: already registered (e.g. from a previous visit).
    const existing = await navigator.serviceWorker.getRegistration(
      this.paths.scope
    );
    if (existing) return existing;

    if (this.registrationPromise) return this.registrationPromise;

    this.registrationPromise = this.registerWithTimeout().catch((err) => {
      // Log once; subsequent calls will retry via getRegistration(SCOPE).
      console.error('[PushSwRegistration] register failed', err);
      this.registrationPromise = null;
      return undefined;
    });
    return this.registrationPromise;
  }

  /**
   * Force a fresh registration regardless of memoised state — useful from
   * test setups. In production code, prefer `getRegistration()`.
   */
  async forceRegister(): Promise<ServiceWorkerRegistration | undefined> {
    this.registrationPromise = null;
    return this.getRegistration();
  }

  private async registerWithTimeout(): Promise<
    ServiceWorkerRegistration | undefined
  > {
    const registerPromise = navigator.serviceWorker.register(this.paths.path, {
      scope: this.paths.scope,
      // Stock update check on each navigation — the SW file carries a git
      // SHA stamp so any build produces a byte-diff the browser will pick up.
      updateViaCache: 'none',
    });
    const timeoutPromise = new Promise<undefined>((resolve) =>
      setTimeout(
        () => resolve(undefined),
        PushSwRegistrationService.REGISTER_TIMEOUT_MS
      )
    );
    return Promise.race([registerPromise, timeoutPromise]);
  }
}
