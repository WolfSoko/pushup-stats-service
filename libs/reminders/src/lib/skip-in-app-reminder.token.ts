import { InjectionToken } from '@angular/core';

/**
 * Predicate the in-app reminder loop consults before showing a notification.
 * When it returns `true` the tick is skipped — used to avoid duplicate
 * notifications when server-side Web Push is delivering the same reminder.
 *
 * Default is "never skip", so the in-app tier works without any push wiring.
 * The app overrides this to read PushSubscriptionService.status().
 */
export const SHOULD_SKIP_IN_APP_REMINDER = new InjectionToken<() => boolean>(
  'SHOULD_SKIP_IN_APP_REMINDER',
  { providedIn: 'root', factory: () => () => false }
);
