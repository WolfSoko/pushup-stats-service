/**
 * Android closed-test tester recruitment — pure logic
 * Candidate heuristic, payload validation, push notification content.
 */

import { normalizeReminderLocale, type ReminderLocale } from '@pu-stats/models';

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
 * Minimum total entries a user needs before being considered an Android
 * closed-test candidate — filters out brand-new accounts that haven't
 * shown real engagement yet.
 */
export const ANDROID_TEST_MIN_ENTRIES = 15;

/** A candidate must have logged something within this many days. */
export const ANDROID_TEST_ACTIVE_WITHIN_DAYS = 30;

/**
 * Heuristic for `adminComputeAndroidTestCandidates`: engaged, still-active
 * users are worth inviting; the admin confirms/declines each one afterwards,
 * so a false positive here just costs one extra admin click, not a bad
 * invite.
 */
export function isAndroidTestCandidate(
  activity: AndroidTestActivity | undefined,
  nowMs: number
): boolean {
  if (!activity || activity.entryCount < ANDROID_TEST_MIN_ENTRIES) {
    return false;
  }
  if (!activity.lastEntry) return false;
  const lastEntryMs = new Date(activity.lastEntry).getTime();
  if (!Number.isFinite(lastEntryMs)) return false;
  const activeWithinMs = ANDROID_TEST_ACTIVE_WITHIN_DAYS * 24 * 60 * 60 * 1000;
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
 * Play Console's standard closed-test opt-in URL for this app's package id
 * (`mobile/android-twa/twa-manifest.json` → `applicationId`). Once the
 * closed track is actually published this should be double-checked against
 * the link Play Console shows on the track's "Testers" tab — see
 * `docs/android-test-program.md`.
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
