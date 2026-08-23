/**
 * Android closed-test tester recruitment — pure logic
 * Candidate heuristic, payload validation, push notification content.
 */

import {
  ANDROID_TEST_THRESHOLD_LIMITS,
  type AndroidTestThresholds,
  DEFAULT_ANDROID_TEST_THRESHOLDS,
  normalizeReminderLocale,
  type ReminderLocale,
} from '@pu-stats/models';

export interface AndroidTestActivity {
  entryCount: number;
  lastEntry: string | null;
}

export type AndroidTestStatus =
  'candidate' | 'confirmed' | 'declined' | 'optedIn' | 'notified';

const TIMESTAMP_FIELD: Partial<Record<AndroidTestStatus, string>> = {
  confirmed: 'confirmedAt',
  optedIn: 'optedInAt',
  notified: 'notifiedAt',
};

/**
 * Builds the Firestore patch for one status transition.
 *
 * **Must stay a nested object, never dotted keys.** `set()` does not
 * interpret `'androidTest.status'` as a field path the way `update()` does —
 * it writes a literal top-level field named `` `androidTest.status` ``, so
 * every subsequent status read comes back `undefined` and the whole flow
 * silently breaks. A nested object under `{merge: true}` produces the field
 * mask `androidTest.status`, which merges leaf-wise and therefore preserves
 * the sibling timestamps written by earlier transitions.
 */
export function androidTestStatusPatch(
  status: AndroidTestStatus,
  nowIso: string
): { androidTest: Record<string, string> } {
  const field = TIMESTAMP_FIELD[status];
  return {
    androidTest: {
      status,
      ...(field ? { [field]: nowIso } : {}),
    },
  };
}

/**
 * Reads admin-supplied scan thresholds off a callable payload. Both fields
 * are optional — a scan without them runs on
 * {@link DEFAULT_ANDROID_TEST_THRESHOLDS}, so an empty payload stays valid.
 * Values must be whole numbers inside {@link ANDROID_TEST_THRESHOLD_LIMITS};
 * anything else is rejected rather than clamped, so a typo surfaces in the
 * UI instead of silently scanning with a number nobody asked for.
 */
export function validateAndroidTestThresholdsPayload(
  data: unknown
):
  | { valid: true; thresholds: AndroidTestThresholds }
  | { valid: false; error: string } {
  const obj = (data ?? {}) as Record<string, unknown>;
  if (typeof obj !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }

  const read = (
    key: keyof AndroidTestThresholds
  ): { value: number } | { error: string } => {
    const raw = obj[key];
    if (raw === undefined || raw === null) {
      return { value: DEFAULT_ANDROID_TEST_THRESHOLDS[key] };
    }
    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
      return { error: `${key} must be a whole number` };
    }
    const { min, max } = ANDROID_TEST_THRESHOLD_LIMITS[key];
    if (raw < min || raw > max) {
      return { error: `${key} must be between ${min} and ${max}` };
    }
    return { value: raw };
  };

  const minEntries = read('minEntries');
  if ('error' in minEntries) return { valid: false, error: minEntries.error };
  const activeWithinDays = read('activeWithinDays');
  if ('error' in activeWithinDays) {
    return { valid: false, error: activeWithinDays.error };
  }

  return {
    valid: true,
    thresholds: {
      minEntries: minEntries.value,
      activeWithinDays: activeWithinDays.value,
    },
  };
}

export interface AndroidTestAccount {
  /** Firebase Auth user with no linked provider. */
  anonymous: boolean;
  email: string | null;
}

/**
 * Hard eligibility gate, independent of how active the account is.
 *
 * The Play Console closed-test tester list is keyed by Google-account
 * email addresses, so an account without one can never be added as a
 * tester — inviting it would promise something we cannot deliver.
 * Anonymous accounts never have an email; a non-anonymous account can
 * still lack one (e.g. phone-only sign-in), so both are checked.
 */
export function canBeAndroidTester(account: AndroidTestAccount): boolean {
  return !account.anonymous && !!account.email;
}

/**
 * Heuristic for `adminComputeAndroidTestCandidates`: eligible, engaged,
 * still-active users are worth inviting; the admin confirms/declines each
 * one afterwards, so a false positive here just costs one extra admin
 * click, not a bad invite.
 */
export function isAndroidTestCandidate(
  account: AndroidTestAccount,
  activity: AndroidTestActivity | undefined,
  nowMs: number,
  thresholds: AndroidTestThresholds = DEFAULT_ANDROID_TEST_THRESHOLDS
): boolean {
  if (!canBeAndroidTester(account)) return false;
  if (!activity || activity.entryCount < thresholds.minEntries) {
    return false;
  }
  if (!activity.lastEntry) return false;
  const lastEntryMs = new Date(activity.lastEntry).getTime();
  if (!Number.isFinite(lastEntryMs)) return false;
  const activeWithinMs = thresholds.activeWithinDays * 24 * 60 * 60 * 1000;
  return nowMs - lastEntryMs <= activeWithinMs;
}

/**
 * Validates the payload for `adminConfirmAndroidTestCandidate`. Requires a
 * non-empty `uid` and a boolean `confirmed` flag — mirrors
 * `validateLeaderboardExclusionPayload` in `admin/logic.ts`.
 */
export function validateAndroidTestConfirmPayload(
  data: unknown
):
  | { valid: true; uid: string; confirmed: boolean }
  | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.uid !== 'string' || obj.uid.trim().length === 0) {
    return { valid: false, error: 'uid missing or empty' };
  }
  if (typeof obj.confirmed !== 'boolean') {
    return { valid: false, error: 'confirmed must be boolean' };
  }
  return { valid: true, uid: obj.uid.trim(), confirmed: obj.confirmed };
}

/**
 * Validates the payload for `adminMarkAndroidTesterAdded`. Requires a
 * non-empty `uid`.
 */
export function validateAndroidTesterAddedPayload(
  data: unknown
): { valid: true; uid: string } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.uid !== 'string' || obj.uid.trim().length === 0) {
    return { valid: false, error: 'uid missing or empty' };
  }
  return { valid: true, uid: obj.uid.trim() };
}

/**
 * Play Console's closed-test opt-in URL for this app's package id
 * (`mobile/android-twa/twa-manifest.json` → `applicationId`). Confirmed
 * working against the live track — see `docs/android-test-program.md`.
 */
export const ANDROID_TEST_OPT_IN_URL =
  'https://play.google.com/apps/testing/com.pushupstats.app';

const INVITE_TITLE: Record<'de' | 'en', string> = {
  de: '🎉 Du bist dabei!',
  en: '🎉 You’re in!',
};

const INVITE_BODY: Record<'de' | 'en', string> = {
  de: 'Du wurdest als Tester für die Android-App freigeschaltet. Tippe hier, um sie zu installieren.',
  en: 'You’ve been added as an Android app tester. Tap here to install it.',
};

/**
 * Only German/English copy is maintained here (unlike the recurring
 * reminder push, this is a one-off message the admin sends by hand to a
 * short, curated tester list) — every other supported reminder locale
 * falls back to English.
 */
function inviteLocale(rawLocale: unknown): 'de' | 'en' {
  const normalized: ReminderLocale = normalizeReminderLocale(rawLocale);
  return normalized === 'de' ? 'de' : 'en';
}

/**
 * Builds the Web Push payload JSON for the "you're added as a tester"
 * notification, mirroring the payload shape `dispatchPushReminders` sends
 * (title/body/icon/badge/tag/data.url) so the existing service-worker
 * handler renders it without any SW changes.
 */
export function buildAndroidTestInvitePayload(
  rawLocale: unknown,
  installUrl: string = ANDROID_TEST_OPT_IN_URL
): string {
  const locale = inviteLocale(rawLocale);
  return JSON.stringify({
    title: INVITE_TITLE[locale],
    body: INVITE_BODY[locale],
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'android-test-invite',
    renotify: true,
    data: { url: installUrl },
  });
}
