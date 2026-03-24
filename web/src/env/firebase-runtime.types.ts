export interface FirebaseRuntimeConfig {
  useEmulators: boolean;
  firestoreEmulatorUrl: string;
  authEmulatorUrl: string;
  /**
   * VAPID public key for Web Push subscriptions.
   * Generate with: npx web-push generate-vapid-keys
   * Keep the private key ONLY in Firebase Functions secret config.
   */
  vapidPublicKey: string;
}
