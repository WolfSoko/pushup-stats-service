import type { PushStatus } from '@pu-push/push';

const FALLBACK_TIMEZONE = 'Europe/Berlin';
const DEFAULT_QUICK_LOG_REPS = 100;

/** Read the current string value of an `<input>` from a DOM event. */
export function parseInputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

/**
 * Read a numeric `<input>` value, falling back to a sane default when the
 * field is blank or non-numeric so a transient empty box doesn't propagate
 * `NaN` into the form store.
 */
export function parseInputNumber(event: Event): number {
  const raw = (event.target as HTMLInputElement).value;
  const n = Number(raw);
  return Number.isNaN(n) ? DEFAULT_QUICK_LOG_REPS : n;
}

/**
 * Pick the timezone to persist with a reminder config: the one already stored
 * wins (so we don't silently rewrite a user who travels), then the browser's
 * resolved zone, then a fixed fallback for non-browser/edge environments.
 */
export function resolveTimezone(storedTimezone: string | undefined): string {
  return (
    storedTimezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    FALLBACK_TIMEZONE
  );
}

/**
 * Auto-subscribe to server-side push only when reminders transition from off
 * to on — never on every save — and only from a state where a subscription is
 * actually missing. Retrying on 'error' lets a prior SW-registration timeout
 * recover instead of locking the user out of auto-subscription forever.
 */
export function shouldAutoSubscribePush(
  wasEnabled: boolean,
  priorPushStatus: PushStatus
): boolean {
  return (
    !wasEnabled &&
    (priorPushStatus === 'not-subscribed' || priorPushStatus === 'error')
  );
}
