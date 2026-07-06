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
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

type AdsState = {
  targetedAdsConsent: boolean;
  consentAnswered: boolean;
};

// Consent starts unanswered on every load; the CMP restores a previously
// given choice via the TC string (TcfConsentService), not via localStorage.
const initialState: AdsState = {
  targetedAdsConsent: false,
  consentAnswered: false,
};

export const AdsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    // On SSR, RemoteConfig observables crash because the server app's
    // _initializePromise is null. Return inert signals on the server.
    const remoteConfig = isBrowser
      ? inject(RemoteConfig, { optional: true })
      : null;
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
    /** Ads are shown (personalized or not) once the CMP reported a consent decision. */
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
  }))
);
