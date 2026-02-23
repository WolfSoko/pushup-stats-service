import { ApplicationConfig } from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth } from '@pu-auth/auth';
import { fireConfig } from '../env/fire.config';

export const appBrowserConfig: ApplicationConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(fireConfig)),

  ],
};
