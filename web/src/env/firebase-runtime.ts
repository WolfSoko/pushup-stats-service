import { FirebaseRuntimeConfig } from './firebase-runtime.types';

export const firebaseRuntime: FirebaseRuntimeConfig = {
  useEmulators: false,
  firestoreEmulatorUrl: 'http://127.0.0.1:8080',
  authEmulatorUrl: 'http://127.0.0.1:9099',
  // Generated with: npx web-push generate-vapid-keys
  // The private key goes into Firebase Functions secret: VAPID_PRIVATE_KEY
  vapidPublicKey:
    'BP8teF5pDRBlYqQF_nIP8JiWjPs0WcuL8lhvQRg_6qkNTd2RAzCCcqBFu-GxRS8THjx3hZNEuYyhE_TJE-YldH0',
};
