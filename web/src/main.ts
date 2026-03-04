/// <reference types="@angular/localize" />
import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AuthService } from '@pu-auth/auth';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { appBrowserConfig } from './app/app.browser.config';
import { firebaseRuntime } from './env/firebase-runtime';

bootstrapApplication(
  App,
  mergeApplicationConfig(appConfig, appBrowserConfig)
).then((appRef) => {
  // Expose auth helper for e2e tests when using emulators
  if (firebaseRuntime.useEmulators) {
    const authService = appRef.injector.get(AuthService);
    (window as any).signInAnonymouslyForE2E = () => authService.signInAnonymously();
  }
}).catch((err) => console.error(err));
