import { isPlatformBrowser } from '@angular/common';
import { EnvironmentProviders, inject, PLATFORM_ID } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import {
  Firestore,
  connectFirestoreEmulator,
  getFirestore,
  provideFirestore,
} from '@angular/fire/firestore';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

type ProvideFireStoreWithFunc = ReturnType<typeof withEmulator>;

export function provideFireStore(
  ...withOptions: ProvideFireStoreWithFunc[]
): EnvironmentProviders {
  return provideFirestore(() => {
    const app = inject(FirebaseApp);
    const platformId = inject(PLATFORM_ID);

    // Enable IndexedDB-backed offline cache in browser.
    // Fallback to default Firestore instance on unsupported runtimes.
    let firestore: Firestore;
    if (isPlatformBrowser(platformId)) {
      try {
        firestore = initializeFirestore(app, {
          localCache: persistentLocalCache({}),
          ignoreUndefinedProperties: true,
        }) as unknown as Firestore;
      } catch {
        firestore = getFirestore(app);
      }
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
