import { computed, inject } from '@angular/core';
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
import { COOKIE_CONSENT_KEY } from './consent.constants';

type AdsState = {
  targetedAdsConsent: boolean;
  consentAnswered: boolean;
};

function readStoredConsent(): Pick<
  AdsState,
  'targetedAdsConsent' | 'consentAnswered'
> {
  if (typeof globalThis.localStorage === 'undefined') {
    return { targetedAdsConsent: false, consentAnswered: false };
  }
  const value = globalThis.localStorage.getItem(COOKIE_CONSENT_KEY);
  if (value === 'all')
    return { targetedAdsConsent: true, consentAnswered: true };
  if (value === 'necessary')
    return { targetedAdsConsent: false, consentAnswered: true };
  return { targetedAdsConsent: false, consentAnswered: false };
}

const initialState: AdsState = readStoredConsent();

export const AdsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => {
    const remoteConfig = inject(RemoteConfig);
    return {
      _remoteConfig: remoteConfig,
      enabled: toSignal(getBooleanChanges(remoteConfig, 'ads_enabled')),
      dashboardInlineEnabled: toSignal(
        getBooleanChanges(remoteConfig, 'ads_dashboard_inline_enabled')
      ),
      adClient: toSignal(getStringChanges(remoteConfig, 'ads_client')),
      dashboardInlineSlot: toSignal(
        getStringChanges(remoteConfig, 'ads_dashboard_inline_slot')
      ),
      landingInlineSlot: toSignal(
        getStringChanges(remoteConfig, 'ads_landing_inline_slot')
      ),
    };
  }),
  withComputed((store) => ({
    /** Ads are shown (personalized or not) once the user answered the consent banner. */
    adsAllowed: computed(() => !!store.enabled() && store.consentAnswered()),
  })),
  withMethods((store) => ({
    init: () => fetchAndActivate(store._remoteConfig),
    setTargetedAdsConsent: (value: boolean | undefined) => {
      if (typeof value !== 'boolean') return;
      patchState(store, { targetedAdsConsent: value, consentAnswered: true });
    },
  }))
);
