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

type AdsState = {
  targetedAdsConsent: boolean;
  initialized: boolean;
};

const initialState: AdsState = {
  targetedAdsConsent: true,
  initialized: false,
};

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
    adsAllowed: computed(() => !!store.enabled() && store.targetedAdsConsent()),
  })),
  withMethods((store) => ({
    init: () => fetchAndActivate(store._remoteConfig),
    setTargetedAdsConsent: (value: boolean | undefined) => {
      if (typeof value !== 'boolean') return;
      patchState(store, { targetedAdsConsent: value });
    },
  }))
);
