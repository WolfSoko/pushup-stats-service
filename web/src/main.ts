/// <reference types="@angular/localize" />
import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { appBrowserConfig } from './app/app.browser.config';
import { firebaseRuntime } from './env/firebase-runtime';

bootstrapApplication(
  App,
  mergeApplicationConfig(appConfig, appBrowserConfig)
).then(async (appRef) => {
  // Expose auth helpers for e2e tests when using emulators
  if (firebaseRuntime.useEmulators) {
    const { AuthService } = await import('@pu-auth/auth');
    const authService = appRef.injector.get(AuthService);
    (window as any).signInAnonymouslyForE2E = () => authService.signInAnonymously();
    (window as any).isAuthenticatedForE2E = () => authService.isAuthenticated();
  }
}).catch((err) => console.error(err));
