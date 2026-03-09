import {
  ApplicationConfig,
  effect,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { fireConfig } from '../env/fire.config';
import { AdsConfigService } from './ads/ads-config.service';
import { GoogleAdsService } from './ads/google-ads.service';

export const appBrowserConfig: ApplicationConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(fireConfig)),
    provideAppInitializer(() => {
      const adsConfig = inject(AdsConfigService);
      const googleAds = inject(GoogleAdsService);
      const effectRef = effect(async () => {
        await adsConfig.init();
        const adClient = adsConfig.adClient();
        if (adsConfig.enabled() && adClient) {
          await googleAds.initialize(adClient);
          effectRef.destroy();
        }
      });
    }),
  ],
};
