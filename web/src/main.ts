/// <reference types="@angular/localize" />
import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { appBrowserConfig } from './app/app.browser.config';
import { firebaseRuntime } from './env/firebase-runtime';

bootstrapApplication(App, mergeApplicationConfig(appConfig, appBrowserConfig))
  .then((appRef) => {
    // Expose auth helpers for e2e tests when using emulators.
    // Dynamic import avoids Nx static-lazy-import lint error for the auth lib.
    if (firebaseRuntime.useEmulators) {
      void import('@pu-auth/auth').then(({ AuthService }) => {
        const authService = appRef.injector.get(AuthService);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).signInAnonymouslyForE2E = () =>
          authService.signInAnonymously();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).getE2EUserId = () =>
          authService.user()?.uid ?? 'default';
      });
    }
  })
  .catch((err) => console.error(err));
