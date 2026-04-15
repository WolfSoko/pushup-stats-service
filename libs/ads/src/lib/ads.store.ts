import { computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  fetchAndActivate,
  getBooleanChanges,
  getStringChanges,
  RemoteConfig,
} from '@angular/fire/remote-config';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { COOKIE_CONSENT_KEY } from './consent.constants';

type AdsState = {
  targetedAdsConsent: boolean;
  consentAnswered: boolean;
};

function readStoredConsent(): Pick<
  AdsState,
  'targetedAdsConsent' | 'consentAnswered'
> {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return { targetedAdsConsent: false, consentAnswered: false };
    }
    const value = globalThis.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (value === 'all')
      return { targetedAdsConsent: true, consentAnswered: true };
    if (value === 'necessary')
      return { targetedAdsConsent: false, consentAnswered: true };
    return { targetedAdsConsent: false, consentAnswered: false };
  } catch {
    return { targetedAdsConsent: false, consentAnswered: false };
  }
}

const initialState: AdsState = readStoredConsent();

export const AdsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    // On SSR, RemoteConfig observables crash because the server app's
    // _initializePromise is null. Return inert signals on the server.
    const remoteConfig = isBrowser ? inject(RemoteConfig) : null;
    return {
      _remoteConfig: remoteConfig,
      enabled: remoteConfig
        ? toSignal(getBooleanChanges(remoteConfig, 'ads_enabled'))
        : signal(undefined),
      dashboardInlineEnabled: remoteConfig
        ? toSignal(
            getBooleanChanges(remoteConfig, 'ads_dashboard_inline_enabled')
          )
        : signal(undefined),
      adClient: remoteConfig
        ? toSignal(getStringChanges(remoteConfig, 'ads_client'))
        : signal(undefined),
      dashboardInlineSlot: remoteConfig
        ? toSignal(getStringChanges(remoteConfig, 'ads_dashboard_inline_slot'))
        : signal(undefined),
      landingInlineSlot: remoteConfig
        ? toSignal(getStringChanges(remoteConfig, 'ads_landing_inline_slot'))
        : signal(undefined),
    };
  }),
  withComputed((store) => ({
    /** Ads are shown (personalized or not) once the user answered the consent banner. */
    adsAllowed: computed(() => !!store.enabled() && store.consentAnswered()),
  })),
  withMethods((store) => ({
    init: () =>
      store._remoteConfig
        ? fetchAndActivate(store._remoteConfig)
        : Promise.resolve(false),
    setTargetedAdsConsent: (value: boolean | undefined) => {
      if (typeof value !== 'boolean') return;
      patchState(store, { targetedAdsConsent: value, consentAnswered: true });
    },
    /** Re-read consent from localStorage after SSR hydration. */
    hydrateConsent: () => patchState(store, readStoredConsent()),
  })),
  withHooks((store) => {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    return {
      onInit() {
        if (isBrowser) {
          store.hydrateConsent();
        }
      },
    };
  })
);
