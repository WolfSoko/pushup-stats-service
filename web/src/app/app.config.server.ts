import {
  ApplicationConfig,
  inject,
  mergeApplicationConfig,
  REQUEST,
} from '@angular/core';
import { initializeServerApp, provideFirebaseApp } from '@angular/fire/app';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { fireConfig } from '../env/fire.config';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Optional, since it's null in dev-mode and SSG
    provideFirebaseApp(() => {
      const request = inject(REQUEST, { optional: true });
      const authIdToken = request?.headers
        .get('authorization')
        ?.split('Bearer ')[1];
      return initializeServerApp(fireConfig, {
        authIdToken,
        releaseOnDeref: request || undefined,
      });
    }),
  ],
};

export const config = mergeApplicationConfig(serverConfig, appConfig);
