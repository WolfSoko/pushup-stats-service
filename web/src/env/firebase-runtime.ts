import { FirebaseRuntimeConfig } from './firebase-runtime.types';

export const firebaseRuntime: FirebaseRuntimeConfig = {
  useEmulators: false,
  firestoreEmulatorUrl: 'http://127.0.0.1:8080',
  authEmulatorUrl: 'http://127.0.0.1:9099',
  // REPLACE with real public key from: npx web-push generate-vapid-keys
  // The private key goes into Firebase Functions secret: VAPID_PRIVATE_KEY
  vapidPublicKey: 'REPLACE_WITH_REAL_VAPID_PUBLIC_KEY',
};
