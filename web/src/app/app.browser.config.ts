import {
  ApplicationConfig,
  effect,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { fireConfig } from '../env/fire.config';
import { AdsStore, GoogleAdsService } from '@pu-stats/ads';
import { provideMediaPipePoseDetector } from './auto-count/mediapipe-pose-detector';
import {
  DEFAULT_MEDIAPIPE_POSE_CONFIG,
  MEDIAPIPE_POSE_CONFIG,
} from './auto-count/mediapipe-pose.config';

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
    { provide: MEDIAPIPE_POSE_CONFIG, useValue: DEFAULT_MEDIAPIPE_POSE_CONFIG },
    provideMediaPipePoseDetector(),
  ],
};
