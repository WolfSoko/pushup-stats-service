import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { FIREBASE_AUTH_CONFIG } from './firebase-auth.config';

export function provideAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: FIREBASE_AUTH_CONFIG,
      useFactory: () => {
        const config = (
          globalThis as { __PUS_FIREBASE_AUTH__?: Record<string, string> }
        ).__PUS_FIREBASE_AUTH__;
        return {
          apiKey: config?.['apiKey'] ?? '',
          authDomain: config?.['authDomain'] ?? '',
          projectId: config?.['projectId'] ?? '',
          storageBucket: config?.['storageBucket'] ?? '',
          messagingSenderId: config?.['messagingSenderId'] ?? '',
          appId: config?.['appId'] ?? '',
          measurementId: config?.['measurementId'] ?? '',
        };
      },
    },
  ]);
}
