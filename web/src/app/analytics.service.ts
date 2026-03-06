import { Injectable } from '@angular/core';

type AnalyticsParams = Record<
  string,
  string | number | boolean | null | undefined
>;

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'consent',
      eventOrTarget: string,
      params?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly consentKey = 'pus_analytics_consent';

  hasConsent(): boolean {
    const storage = this.storage();
    if (!storage) return false;
    return storage.getItem(this.consentKey) === 'granted';
  }

  setConsent(granted: boolean): void {
    const storage = this.storage();
    storage?.setItem(this.consentKey, granted ? 'granted' : 'denied');
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: granted ? 'granted' : 'denied',
      });
    }
  }

  trackPageView(path: string): void {
    if (!this.hasConsent()) return;
    this.track('page_view', { page_path: path });
  }

  track(eventName: string, params: AnalyticsParams = {}): void {
    if (!this.hasConsent()) return;
    if (window.gtag) {
      window.gtag('event', eventName, params);
      return;
    }
    // Fallback for local/dev observability.

    console.debug('[analytics]', eventName, params);
  }

  private storage(): Pick<Storage, 'getItem' | 'setItem'> | null {
    const storage = globalThis.localStorage;
    const hasFns =
      typeof storage?.getItem === 'function' &&
      typeof storage?.setItem === 'function';
    return hasFns ? storage : null;
  }
}
