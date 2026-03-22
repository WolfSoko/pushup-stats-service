/// <reference types="@angular/localize" />
import * as Sentry from '@sentry/angular';
import { isDevMode, mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { appBrowserConfig } from './app/app.browser.config';
import { firebaseRuntime } from './env/firebase-runtime';
import { AuthService } from '@pu-auth/auth';

if (!firebaseRuntime.useEmulators && !isDevMode()) {
  Sentry.init({
    dsn: 'https://084cd4acd3e626148eba3a831d0e4bee@o1384048.ingest.us.sentry.io/4511089937219584',
    sendDefaultPii: true,
    release: (globalThis as Record<string, unknown>)['SENTRY_RELEASE'] as
      | string
      | undefined,
    environment: 'production',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
  });
}

type E2EWindowHelpers = {
  signInAnonymouslyForE2E?: () => Promise<void>;
  isAuthenticatedForE2E?: () => boolean;
};

bootstrapApplication(App, mergeApplicationConfig(appConfig, appBrowserConfig))
  .then(async (appRef) => {
    // Expose auth helper for e2e tests when using emulators
    if (firebaseRuntime.useEmulators) {
      const authService = appRef.injector.get(AuthService);
      const e2eWindow = window as Window & E2EWindowHelpers;
      e2eWindow.signInAnonymouslyForE2E = () => authService.signInAnonymously();
      e2eWindow.isAuthenticatedForE2E = () => authService.isAuthenticated();
    }
  })
  .catch((err) => console.error(err));
