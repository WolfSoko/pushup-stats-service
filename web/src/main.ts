/// <reference types="@angular/localize" />
import { isDevMode, mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { appBrowserConfig } from './app/app.browser.config';
import { firebaseRuntime } from './env/firebase-runtime';
import { AuthService } from '@pu-auth/auth';
import { initSentryLazily } from './app/core/observability/sentry';

const sentryEnabled = !firebaseRuntime.useEmulators && !isDevMode();

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

    // Defer the whole Sentry SDK (core + tracing + rrweb session replay) to
    // post-bootstrap idle time so @sentry/* stays out of the eager bundle. The
    // DeferredSentryErrorHandler buffers any errors thrown in the meantime.
    // requestIdleCallback keeps it off the first-interaction path; setTimeout
    // is the fallback.
    if (sentryEnabled) {
      const loadSentry = () =>
        initSentryLazily(appRef, {
          dsn: 'https://084cd4acd3e626148eba3a831d0e4bee@o1384048.ingest.us.sentry.io/4511089937219584',
          release: (globalThis as Record<string, unknown>)['SENTRY_RELEASE'] as
            | string
            | undefined,
          environment: 'production',
          tracesSampleRate: 0.2,
          replaysSessionSampleRate: 0.05,
          replaysOnErrorSampleRate: 1.0,
        }).catch((err) => console.error('Sentry init failed', err));
      const ric = (
        window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: object) => number;
        }
      ).requestIdleCallback;
      if (typeof ric === 'function') {
        ric(loadSentry, { timeout: 4000 });
      } else {
        setTimeout(loadSentry, 2000);
      }
    }
  })
  .catch((err) => console.error(err));
