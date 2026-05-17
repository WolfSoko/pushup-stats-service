import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  createErrorHandler as sentryCreateErrorHandler,
  TraceService as SentryTraceService,
} from '@sentry/angular';
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
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter, Router, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import {
  provideAuth,
  withEmulator as withAuthEmulator,
  POST_AUTH_HOOKS,
  USER_PROFILE_PORT,
} from '@pu-auth/auth';
import {
  provideFireStore,
  UserConfigApiService,
  withEmulator as withFirestoreEmulator,
} from '@pu-stats/data-access';
import { UserProfileSyncHook } from './core/auth/user-profile-sync.hook';
import { GuestDataMigrationHook } from './core/auth/guest-data-migration.hook';
import { adsConfig } from '../env/ads.config';
import { firebaseRuntime } from '../env/firebase-runtime';
import { demoUserId } from '../env/demo.config';
import { DEMO_USER_ID } from '@pu-stats/data-access';
import { PushSubscriptionService, VAPID_PUBLIC_KEY } from '@pu-push/push';
import { SHOULD_SKIP_IN_APP_REMINDER } from '@pu-reminders/reminders';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      })
    ),
    // Sentry error monitoring – production only (not in dev mode or emulator)
    ...(!firebaseRuntime.useEmulators && !isDevMode()
      ? [
          {
            provide: ErrorHandler,
            useValue: sentryCreateErrorHandler(),
          },
          {
            provide: SentryTraceService,
            deps: [Router],
          },
          {
            provide: APP_INITIALIZER,
            useFactory: () => () => undefined,
            deps: [SentryTraceService],
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
    // Chart.js providers (provideCharts) are scoped to chart components in
    // libs/stats so chart.js + ng2-charts + chartjs-chart-matrix +
    // chartjs-plugin-datalabels stay out of the eager main bundle.
    // LOCALE_ID is automatically set by Angular i18n based on the build locale
    // MAT_DATE_LOCALE follows LOCALE_ID by default when not explicitly set
    { provide: DEMO_USER_ID, useValue: demoUserId },
    // Auth ↔ Data-Access wiring: ports & adapters
    { provide: USER_PROFILE_PORT, useExisting: UserConfigApiService },
    { provide: POST_AUTH_HOOKS, useClass: UserProfileSyncHook, multi: true },
    { provide: POST_AUTH_HOOKS, useClass: GuestDataMigrationHook, multi: true },
    { provide: VAPID_PUBLIC_KEY, useValue: firebaseRuntime.vapidPublicKey },
    // Wire the reminders → push port: skip in-app notifications when server
    // Web Push is delivering the same reminder, so the user doesn't get two
    // sounds. The reminders lib has no compile-time knowledge of push.
    {
      provide: SHOULD_SKIP_IN_APP_REMINDER,
      useFactory: () => {
        const push = inject(PushSubscriptionService);
        return () => push.status() === 'subscribed';
      },
    },
    // Stock ngsw at scope `/` — handles app shell + asset caching only.
    // Push + notification logic lives in a separate worker registered at
    // `/push/` by PushSwRegistrationService (libs/push). Keeping ngsw
    // untouched means Angular updates can't accidentally break push.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:2000',
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
