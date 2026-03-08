import { isPlatformBrowser } from '@angular/common';
import { EnvironmentProviders, inject, PLATFORM_ID } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import {
  connectFirestoreEmulator,
  Firestore,
  getFirestore,
  provideFirestore,
} from '@angular/fire/firestore';

type ProvideFireStoreWithFunc = ReturnType<typeof withEmulator>;

export function provideFireStore(
  ...withOptions: ProvideFireStoreWithFunc[]
): EnvironmentProviders {
  return provideFirestore(() => {
    const app = inject(FirebaseApp);
    const platformId = inject(PLATFORM_ID);

    // Use default Firestore instance. The persistent cache initialization
    // was causing timing issues that blocked Angular's reactive form signals
    // from updating during app bootstrap, particularly affecting E2E tests.
    // TODO: Re-enable persistent cache with deferred initialization after
    // app bootstrap is complete.
    let firestore: Firestore;
    if (isPlatformBrowser(platformId)) {
      firestore = getFirestore(app);
    } else {
      firestore = getFirestore(app);
    }

    withOptions.forEach((withFn) => withFn(firestore));
    return firestore;
  }, FirebaseApp);
}

export function withEmulator(emulatorBaseUrl = 'http://127.0.0.1:8080') {
  return (firestore: Firestore) => {
    const normalizedUrl = emulatorBaseUrl.includes('://')
      ? emulatorBaseUrl
      : `http://${emulatorBaseUrl}`;
    const parsedUrl = new URL(normalizedUrl);
    const host = parsedUrl.hostname;
    const port = parsedUrl.port ? Number(parsedUrl.port) : 8080;

    return connectFirestoreEmulator(firestore, host, port);
  };
}
