import { defineSecret } from 'firebase-functions/params';
import webpush from 'web-push';

/**
 * The VAPID pair every push-sending function needs. Declared once so a
 * function that sends push lists `VAPID_SECRETS` and calls
 * `configureWebPush()` — the only two things Web Push asks of it.
 */
export const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
export const VAPID_PUBLIC_KEY = defineSecret('VAPID_PUBLIC_KEY');
export const VAPID_SECRETS = [VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY];

/** False when the secrets are unset — the caller then skips sending. */
export function configureWebPush(): boolean {
  const vapidPrivate = VAPID_PRIVATE_KEY.value().trim();
  const vapidPublic = VAPID_PUBLIC_KEY.value().trim();
  if (!vapidPrivate || !vapidPublic) return false;
  webpush.setVapidDetails(
    'mailto:einstein-openclaw@gmail.com',
    vapidPublic,
    vapidPrivate
  );
  return true;
}
