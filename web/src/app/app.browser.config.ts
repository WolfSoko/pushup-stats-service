import {
  ApplicationConfig,
  effect,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { fireConfig } from '../env/fire.config';
import { AdsStore, GoogleAdsService } from '@pu-stats/ads';

export const appBrowserConfig: ApplicationConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(fireConfig)),
    provideAppInitializer(() => {
      const adsStore = inject(AdsStore);
      const googleAds = inject(GoogleAdsService);
      const effectRef = effect(async () => {
        await adsStore.init();
        const adClient = adsStore.adClient();
        if (adsStore.enabled() && adClient) {
          await googleAds.initialize(adClient);
          effectRef.destroy();
        }
      });
    }),
  ],
};
