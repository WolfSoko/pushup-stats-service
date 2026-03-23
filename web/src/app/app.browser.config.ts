import {
  APP_INITIALIZER,
  ApplicationConfig,
  effect,
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { Router } from '@angular/router';
import * as Sentry from '@sentry/angular';
import { fireConfig } from '../env/fire.config';
import { firebaseRuntime } from '../env/firebase-runtime';
import { AdsConfigService, GoogleAdsService } from '@pu-stats/ads';

export const appBrowserConfig: ApplicationConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(fireConfig)),
    // Sentry Angular providers – browser only, production only (not in dev mode or emulator)
    ...(!firebaseRuntime.useEmulators && !isDevMode()
      ? [
          {
            provide: ErrorHandler,
            useFactory: () => Sentry.createErrorHandler(),
          },
          {
            provide: Sentry.TraceService,
            useClass: Sentry.TraceService,
            deps: [Router],
          },
          {
            provide: APP_INITIALIZER,
            useFactory: () => () => undefined,
            deps: [Sentry.TraceService],
            multi: true,
          },
        ]
      : []),
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
