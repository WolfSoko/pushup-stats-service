import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import * as Sentry from '@sentry/angular';
import { getAnalytics, provideAnalytics } from '@angular/fire/analytics';
import {
  connectFunctionsEmulator,
  getFunctions,
  provideFunctions,
} from '@angular/fire/functions';
import { FirebaseApp } from '@angular/fire/app';
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
import { provideRouter, Router } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAuth, withEmulator as withAuthEmulator } from '@pu-auth/auth';
import {
  provideFireStore,
  withEmulator as withFirestoreEmulator,
} from '@pu-stats/data-access';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { adsConfig } from '../env/ads.config';
import { firebaseRuntime } from '../env/firebase-runtime';
import { demoUserId } from '../env/demo.config';
import { DEMO_USER_ID } from '@pu-stats/data-access';
import { VAPID_PUBLIC_KEY } from '@pu-reminders/reminders';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideRouter(appRoutes),
    // Sentry error monitoring – production only (not in dev mode or emulator)
    ...(!firebaseRuntime.useEmulators && !isDevMode()
      ? [
          {
            provide: ErrorHandler,
            useValue: Sentry.createErrorHandler(),
          },
          {
            provide: Sentry.TraceService,
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
    { provide: DEMO_USER_ID, useValue: demoUserId },
    { provide: VAPID_PUBLIC_KEY, useValue: firebaseRuntime.vapidPublicKey },
    provideServiceWorker('sw-push.js', {
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
            const functions = getFunctions(inject(FirebaseApp), 'europe-west3');
            connectFunctionsEmulator(functions, '127.0.0.1', 5001);
            return functions;
          }),
        ]
      : [
          provideAuth(),
          provideFireStore(),
          provideFunctions(() =>
            getFunctions(inject(FirebaseApp), 'europe-west3')
          ),
          provideAnalytics(() => getAnalytics()),
          provideRemoteConfig(() => {
            const remoteConfig = getRemoteConfig();
            remoteConfig.defaultConfig = adsConfig;
            return remoteConfig;
          }),
        ]),
  ],
};
