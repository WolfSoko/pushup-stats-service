import { FirebaseRuntimeConfig } from './firebase-runtime.types';

export const firebaseRuntime: FirebaseRuntimeConfig = {
  useEmulators: false,
  firestoreEmulatorUrl: 'http://127.0.0.1:8080',
  authEmulatorUrl: 'http://127.0.0.1:9099',
};
