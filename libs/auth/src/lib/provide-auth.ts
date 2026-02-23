import { EnvironmentProviders, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import {
  Auth,
  connectAuthEmulator,
  getAuth,
  provideAuth as provideAuthFire,
} from '@angular/fire/auth';

type ProvideAuthWithFunc = typeof withEmulator;

export function provideAuth(
  ...withOptions: ProvideAuthWithFunc[]
): EnvironmentProviders {
  return provideAuthFire(() => {
    const auth = getAuth(inject(FirebaseApp));
    withOptions.forEach((withFn) => withFn()(auth));
    return auth;
  }, FirebaseApp);
}

export function withEmulator(emulatorBaseUrl = 'http://localhost:9999') {
  return (auth: Auth) =>
    connectAuthEmulator(auth, emulatorBaseUrl, { disableWarnings: true });
}
