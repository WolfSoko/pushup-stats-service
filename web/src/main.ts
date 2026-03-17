/// <reference types="@angular/localize" />
import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { appBrowserConfig } from './app/app.browser.config';
import { firebaseRuntime } from './env/firebase-runtime';
import { AuthService } from '@pu-auth/auth';

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
