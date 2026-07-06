import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AdsStore } from './ads.store';
import { ANALYTICS_CONSENT_KEY } from './consent.constants';

/** Minimal slice of the IAB TCF v2.2 TCData object. */
export interface TcData {
  eventStatus: 'tcloaded' | 'cmpuishown' | 'useractioncomplete';
  gdprApplies?: boolean;
  purpose?: { consents?: Record<number, boolean> };
  vendor?: { consents?: Record<number, boolean> };
}

export type TcfApi = (
  command: 'addEventListener',
  version: 2,
  callback: (tcData: TcData, success: boolean) => void
) => void;

declare global {
  interface Window {
    __tcfapi?: TcfApi;
    gtag?: (...args: unknown[]) => void;
    gtag_enable_tcf_support?: boolean;
    googlefc?: {
      callbackQueue?: Array<Record<string, () => void>>;
      showRevocationMessage?: () => void;
    };
  }
}

/** IAB TCF vendor id of "Google Advertising Products". */
const GOOGLE_VENDOR_ID = 755;
/** TCF purpose 1: store and/or access information on a device. */
const PURPOSE_STORAGE = 1;
/** TCF purposes 3 + 4: create and use profiles for personalised advertising. */
const PURPOSE_AD_PROFILE = 3;
const PURPOSE_AD_SELECT = 4;
/** TCF purpose 8: measure content performance. */
const PURPOSE_MEASURE_CONTENT = 8;

const TCF_POLL_INTERVAL_MS = 200;
const TCF_POLL_MAX_TRIES = 150;

/**
 * Couples the app's consent state to the TCF v2.2 CMP (Google Privacy &
 * Messaging, delivered via adsbygoogle.js): updates `AdsStore` gating,
 * Consent Mode's `analytics_storage`, and the analytics localStorage flag
 * whenever the CMP reports a TC string.
 */
@Injectable({ providedIn: 'root' })
export class TcfConsentService {
  private readonly adsStore = inject(AdsStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private started = false;

  /**
   * Registers a TCF event listener once `window.__tcfapi` shows up.
   * The stub is injected asynchronously by adsbygoogle.js, so we poll
   * briefly instead of assuming it exists at bootstrap.
   */
  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;
    this.clearLegacyConsent();
    if (this.tryRegister()) return;

    let tries = 0;
    const poll = setInterval(() => {
      if (this.tryRegister() || ++tries >= TCF_POLL_MAX_TRIES) {
        clearInterval(poll);
      }
    }, TCF_POLL_INTERVAL_MS);
  }

  /**
   * The pre-CMP banner persisted consent in localStorage; a stale 'granted'
   * must not gate analytics now that the TC string is the source of truth.
   * `publishConsent` re-writes the analytics flag on every TCF decision.
   */
  private clearLegacyConsent(): void {
    try {
      globalThis.localStorage?.removeItem(ANALYTICS_CONSENT_KEY);
      globalThis.localStorage?.removeItem('pus_cookie_consent');
    } catch {
      /* storage blocked (e.g. private browsing) */
    }
  }

  private tryRegister(): boolean {
    const tcfApi = window.__tcfapi;
    if (!tcfApi) return false;
    tcfApi('addEventListener', 2, (tcData, success) => {
      if (success) this.applyTcData(tcData);
    });
    return true;
  }

  /** Re-opens the CMP message so the user can change their consent. */
  openConsentSettings(): void {
    if (!this.isBrowser) return;
    // showRevocationMessage clears the stored EU consent record before the
    // user makes a new choice; mirror that locally so an abandoned dialog
    // cannot keep the revoked consent active. A completed choice re-publishes
    // via the TCF listener.
    this.adsStore.resetConsent();
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    this.clearLegacyConsent();
    window.googlefc = window.googlefc ?? {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue ?? [];
    window.googlefc.callbackQueue.push({
      CONSENT_DATA_READY: () => window.googlefc?.showRevocationMessage?.(),
    });
  }

  private applyTcData(tcData: TcData): void {
    if (tcData.gdprApplies === false) {
      this.publishConsent({ targetedAds: true, analytics: true });
      return;
    }
    if (
      tcData.eventStatus !== 'tcloaded' &&
      tcData.eventStatus !== 'useractioncomplete'
    ) {
      return;
    }

    const purposes = tcData.purpose?.consents ?? {};
    const vendors = tcData.vendor?.consents ?? {};
    const storage = purposes[PURPOSE_STORAGE] === true;
    this.publishConsent({
      targetedAds:
        storage &&
        purposes[PURPOSE_AD_PROFILE] === true &&
        purposes[PURPOSE_AD_SELECT] === true &&
        vendors[GOOGLE_VENDOR_ID] === true,
      analytics: storage && purposes[PURPOSE_MEASURE_CONTENT] === true,
    });
  }

  private publishConsent(consent: {
    targetedAds: boolean;
    analytics: boolean;
  }): void {
    this.adsStore.setTargetedAdsConsent(consent.targetedAds);

    // ad_* keys are intentionally omitted: gtag derives them from the TC
    // string itself (gtag_enable_tcf_support in index.html).
    window.gtag?.('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
    });

    try {
      globalThis.localStorage?.setItem(
        ANALYTICS_CONSENT_KEY,
        consent.analytics ? 'granted' : 'denied'
      );
    } catch {
      /* storage blocked (e.g. private browsing) */
    }
  }
}
