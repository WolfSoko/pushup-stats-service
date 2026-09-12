import { HttpsError } from 'firebase-functions/v2/https';

/** The caller's uid, or the `unauthenticated` error every callable throws. */
export function requireUid(auth: { uid?: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
  }
  return auth.uid;
}
