/**
 * Thin facade over PushSubscriptionStore.
 * Components should inject this service; the store manages all async state.
 */
export { PushSubscriptionStore as PushSubscriptionService } from './push-subscription.store';
export type { PushStatus } from './push-subscription.store';
