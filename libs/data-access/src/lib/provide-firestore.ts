import { EnvironmentProviders, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import {
  Firestore,
  connectFirestoreEmulator,
  getFirestore,
  provideFirestore,
} from '@angular/fire/firestore';

type ProvideFireStoreWithFunc = ReturnType<typeof withEmulator>;

export function provideFireStore(
  ...withOptions: ProvideFireStoreWithFunc[]
): EnvironmentProviders {
  return provideFirestore(() => {
    const firestore = getFirestore(inject(FirebaseApp));
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
