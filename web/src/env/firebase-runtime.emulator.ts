import { FirebaseRuntimeConfig } from './firebase-runtime.types';

export const firebaseRuntime: FirebaseRuntimeConfig = {
  useEmulators: true,
  firestoreEmulatorUrl: 'http://127.0.0.1:8080',
  authEmulatorUrl: 'http://127.0.0.1:9099',
  vapidPublicKey: 'REPLACE_WITH_REAL_VAPID_PUBLIC_KEY',
};
