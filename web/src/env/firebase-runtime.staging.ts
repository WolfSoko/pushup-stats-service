import { FirebaseRuntimeConfig } from './firebase-runtime.types';

export const firebaseRuntime: FirebaseRuntimeConfig = {
  useEmulators: false,
  firestoreEmulatorUrl: 'http://127.0.0.1:8080',
  authEmulatorUrl: 'http://127.0.0.1:9099',
  // Staging VAPID public key – must match VAPID_PUBLIC_KEY secret in staging project.
  // Regenerate with: npx web-push generate-vapid-keys
  // Update this value when running infra/setup-staging.sh (it generates new keys).
  vapidPublicKey:
    'BK5wmbbOWWEro_RcT0FlpQneqSTX5xw1hPt3EYmxWAdZIuo4x-I_QSPXlTxHvSdnaEJNYmejoaOfEwvv7L1dBV8',
};
