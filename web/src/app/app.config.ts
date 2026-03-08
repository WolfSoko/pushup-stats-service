import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localeDe from '@angular/common/locales/de';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { getAnalytics, provideAnalytics } from '@angular/fire/analytics';
import {
  connectFunctionsEmulator,
  getFunctions,
  provideFunctions,
} from '@angular/fire/functions';
import {
  getRemoteConfig,
  provideRemoteConfig,
} from '@angular/fire/remote-config';
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import {
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideAuth, withEmulator as withAuthEmulator } from '@pu-auth/auth';
import {
  provideFireStore,
  withEmulator as withFirestoreEmulator,
} from '@pu-stats/data-access';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { firebaseRuntime } from '../env/firebase-runtime';
import { AdsConfigService } from './ads/ads-config.service';
import { appRoutes } from './app.routes';

registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideRouter(appRoutes),
    provideClientHydration(
      withIncrementalHydration(),
      withEventReplay(),
      withI18nSupport()
    ),
    provideZonelessChangeDetection(),
    provideNativeDateAdapter(),
    provideCharts(withDefaultRegisterables(), {
      // Register matrix controller/element + datalabels plugin.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registerables: [MatrixController, MatrixElement, ChartDataLabels as any],
    }),
    { provide: LOCALE_ID, useValue: 'de-DE' },
    { provide: MAT_DATE_LOCALE, useValue: 'de-DE' },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    ...(firebaseRuntime.useEmulators
      ? [
          provideAuth(() => withAuthEmulator(firebaseRuntime.authEmulatorUrl)),
          provideFireStore(
            withFirestoreEmulator(firebaseRuntime.firestoreEmulatorUrl)
          ),
          provideFunctions(() => {
            const functions = getFunctions();
            connectFunctionsEmulator(functions, '127.0.0.1', 5001);
            return functions;
          }),
        ]
      : [
          provideAuth(),
          provideFireStore(),
          provideFunctions(() => getFunctions()),
          provideAnalytics(() => getAnalytics()),
          provideRemoteConfig(() => getRemoteConfig()),
        ]),
    provideAppInitializer(() => {
      return inject(AdsConfigService).init();
    }),
  ],
};
