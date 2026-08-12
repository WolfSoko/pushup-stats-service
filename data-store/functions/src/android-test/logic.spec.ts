import { describe, it, expect } from '@jest/globals';
import {
  ANDROID_TEST_THRESHOLD_LIMITS,
  DEFAULT_ANDROID_TEST_THRESHOLDS,
} from '@pu-stats/models';
import {
  ANDROID_TEST_OPT_IN_URL,
  androidTestStatusPatch,
  buildAndroidTestInvitePayload,
  canBeAndroidTester,
  isAndroidTestCandidate,
  validateAndroidTestConfirmPayload,
  validateAndroidTesterAddedPayload,
  validateAndroidTestThresholdsPayload,
} from './logic';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-11T12:00:00Z').getTime();

/** A signed-up account with an email — eligible on account grounds alone. */
const ELIGIBLE = { anonymous: false, email: 'user@example.com' };

describe('android-test/logic', () => {
  describe('canBeAndroidTester', () => {
    it('should accept a signed-up account with an email', () => {
      // given / when
      const result = canBeAndroidTester(ELIGIBLE);
      // then
      expect(result).toBe(true);
    });

    it('should reject an anonymous account', () => {
      // given
      const account = { anonymous: true, email: null };
      // when
      const result = canBeAndroidTester(account);
      // then
      expect(result).toBe(false);
    });

    it('should reject a signed-up account without an email (e.g. phone-only sign-in)', () => {
      // given
      const account = { anonymous: false, email: null };
      // when
      const result = canBeAndroidTester(account);
      // then
      expect(result).toBe(false);
    });
  });

  describe('isAndroidTestCandidate', () => {
    // Regression guard: the first version had no eligibility gate at all, so
    // anonymous accounts with enough entries were offered the invite even
    // though they can never be added to the Play Console tester list.
    it('should reject an anonymous account however active it is', () => {
      // given
      const account = { anonymous: true, email: null };
      const activity = {
        entryCount: 500,
        lastEntry: new Date(NOW).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(account, activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should reject an account without an email however active it is', () => {
      // given
      const account = { anonymous: false, email: null };
      const activity = {
        entryCount: 500,
        lastEntry: new Date(NOW).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(account, activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should reject an undefined activity aggregate', () => {
      // given
      const activity = undefined;
      // when
      const result = isAndroidTestCandidate(ELIGIBLE, activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should reject a user below the entry-count threshold', () => {
      // given
      const activity = {
        entryCount: DEFAULT_ANDROID_TEST_THRESHOLDS.minEntries - 1,
        lastEntry: new Date(NOW).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(ELIGIBLE, activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should accept a user exactly at the entry-count threshold with a recent entry', () => {
      // given
      const activity = {
        entryCount: DEFAULT_ANDROID_TEST_THRESHOLDS.minEntries,
        lastEntry: new Date(NOW).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(ELIGIBLE, activity, NOW);
      // then
      expect(result).toBe(true);
    });

    it('should reject a user with no lastEntry', () => {
      // given
      const activity = { entryCount: 50, lastEntry: null };
      // when
      const result = isAndroidTestCandidate(ELIGIBLE, activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should reject a user whose last entry is just past the active-within window', () => {
      // given
      const staleMs =
        NOW -
        (DEFAULT_ANDROID_TEST_THRESHOLDS.activeWithinDays * DAY_MS + DAY_MS);
      const activity = {
        entryCount: 50,
        lastEntry: new Date(staleMs).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(ELIGIBLE, activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should accept a user whose last entry is exactly at the active-within boundary', () => {
      // given
      const boundaryMs =
        NOW - DEFAULT_ANDROID_TEST_THRESHOLDS.activeWithinDays * DAY_MS;
      const activity = {
        entryCount: 50,
        lastEntry: new Date(boundaryMs).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(ELIGIBLE, activity, NOW);
      // then
      expect(result).toBe(true);
    });

    it('should reject an unparseable lastEntry timestamp', () => {
      // given
      const activity = { entryCount: 50, lastEntry: 'not-a-date' };
      // when
      const result = isAndroidTestCandidate(ELIGIBLE, activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should apply admin-supplied thresholds instead of the defaults', () => {
      // given a user below the default entry threshold but above a lowered one
      const activity = {
        entryCount: 5,
        lastEntry: new Date(NOW).toISOString(),
      };
      // when
      const withDefaults = isAndroidTestCandidate(ELIGIBLE, activity, NOW);
      const withLowered = isAndroidTestCandidate(ELIGIBLE, activity, NOW, {
        minEntries: 5,
        activeWithinDays: 30,
      });
      // then
      expect(withDefaults).toBe(false);
      expect(withLowered).toBe(true);
    });

    it('should apply an admin-supplied activity window', () => {
      // given an entry 10 days old
      const activity = {
        entryCount: 50,
        lastEntry: new Date(NOW - 10 * DAY_MS).toISOString(),
      };
      // when
      const wideWindow = isAndroidTestCandidate(ELIGIBLE, activity, NOW, {
        minEntries: 15,
        activeWithinDays: 30,
      });
      const narrowWindow = isAndroidTestCandidate(ELIGIBLE, activity, NOW, {
        minEntries: 15,
        activeWithinDays: 7,
      });
      // then
      expect(wideWindow).toBe(true);
      expect(narrowWindow).toBe(false);
    });
  });

  describe('validateAndroidTestThresholdsPayload', () => {
    it('should fall back to the defaults for an empty payload', () => {
      // given / when
      const result = validateAndroidTestThresholdsPayload({});
      // then
      expect(result).toEqual({
        valid: true,
        thresholds: DEFAULT_ANDROID_TEST_THRESHOLDS,
      });
    });

    it('should fall back to the defaults when the payload is missing entirely', () => {
      // given / when
      const result = validateAndroidTestThresholdsPayload(undefined);
      // then
      expect(result).toEqual({
        valid: true,
        thresholds: DEFAULT_ANDROID_TEST_THRESHOLDS,
      });
    });

    it('should accept admin-supplied values', () => {
      // given
      const data = { minEntries: 5, activeWithinDays: 90 };
      // when
      const result = validateAndroidTestThresholdsPayload(data);
      // then
      expect(result).toEqual({
        valid: true,
        thresholds: { minEntries: 5, activeWithinDays: 90 },
      });
    });

    it('should default only the field that is missing', () => {
      // given
      const data = { minEntries: 3 };
      // when
      const result = validateAndroidTestThresholdsPayload(data);
      // then
      expect(result).toEqual({
        valid: true,
        thresholds: {
          minEntries: 3,
          activeWithinDays: DEFAULT_ANDROID_TEST_THRESHOLDS.activeWithinDays,
        },
      });
    });

    it('should reject a non-integer value', () => {
      // given
      const data = { minEntries: 2.5 };
      // when
      const result = validateAndroidTestThresholdsPayload(data);
      // then
      expect(result).toEqual({
        valid: false,
        error: 'minEntries must be a whole number',
      });
    });

    it('should reject a value below the allowed minimum', () => {
      // given
      const data = { minEntries: 0 };
      // when
      const result = validateAndroidTestThresholdsPayload(data);
      // then
      expect(result.valid).toBe(false);
    });

    it('should reject a value above the allowed maximum', () => {
      // given
      const data = {
        activeWithinDays:
          ANDROID_TEST_THRESHOLD_LIMITS.activeWithinDays.max + 1,
      };
      // when
      const result = validateAndroidTestThresholdsPayload(data);
      // then
      expect(result.valid).toBe(false);
    });

    it('should reject a non-numeric value', () => {
      // given
      const data = { minEntries: '15' };
      // when
      const result = validateAndroidTestThresholdsPayload(data);
      // then
      expect(result).toEqual({
        valid: false,
        error: 'minEntries must be a whole number',
      });
    });
  });

  describe('validateAndroidTestConfirmPayload', () => {
    it('should accept a valid confirm payload', () => {
      // given
      const data = { uid: 'user1', confirmed: true };
      // when
      const result = validateAndroidTestConfirmPayload(data);
      // then
      expect(result).toEqual({ valid: true, uid: 'user1', confirmed: true });
    });

    it('should trim whitespace from uid', () => {
      // given
      const data = { uid: '  user1  ', confirmed: false };
      // when
      const result = validateAndroidTestConfirmPayload(data);
      // then
      expect(result).toEqual({ valid: true, uid: 'user1', confirmed: false });
    });

    it('should reject a missing uid', () => {
      // given
      const data = { confirmed: true };
      // when
      const result = validateAndroidTestConfirmPayload(data);
      // then
      expect(result).toEqual({ valid: false, error: 'uid missing or empty' });
    });

    it('should reject a non-boolean confirmed flag', () => {
      // given
      const data = { uid: 'user1', confirmed: 'yes' };
      // when
      const result = validateAndroidTestConfirmPayload(data);
      // then
      expect(result).toEqual({
        valid: false,
        error: 'confirmed must be boolean',
      });
    });

    it('should reject a non-object payload', () => {
      // given
      const data = null;
      // when
      const result = validateAndroidTestConfirmPayload(data);
      // then
      expect(result).toEqual({
        valid: false,
        error: 'payload must be an object',
      });
    });
  });

  describe('validateAndroidTesterAddedPayload', () => {
    it('should accept a valid payload', () => {
      // given
      const data = { uid: 'user1' };
      // when
      const result = validateAndroidTesterAddedPayload(data);
      // then
      expect(result).toEqual({ valid: true, uid: 'user1' });
    });

    it('should reject an empty uid', () => {
      // given
      const data = { uid: '   ' };
      // when
      const result = validateAndroidTesterAddedPayload(data);
      // then
      expect(result).toEqual({ valid: false, error: 'uid missing or empty' });
    });
  });

  describe('androidTestStatusPatch', () => {
    const NOW_ISO = '2026-08-11T12:00:00.000Z';

    // Regression guard: an earlier version built these patches with dotted
    // keys (`{'androidTest.status': …}`). `set()` does not expand dots into
    // field paths — it writes a literal top-level field of that name — so
    // every status read came back undefined and the whole flow was dead.
    it('should nest under a single "androidTest" key and never use dotted keys', () => {
      // given
      const statuses = [
        'candidate',
        'confirmed',
        'declined',
        'optedIn',
        'notified',
      ] as const;
      for (const status of statuses) {
        // when
        const patch = androidTestStatusPatch(status, NOW_ISO);
        // then
        expect(Object.keys(patch)).toEqual(['androidTest']);
        for (const key of Object.keys(patch.androidTest)) {
          expect(key).not.toContain('.');
        }
      }
    });

    it('should stamp confirmedAt for the confirmed transition', () => {
      // given / when
      const patch = androidTestStatusPatch('confirmed', NOW_ISO);
      // then
      expect(patch.androidTest).toEqual({
        status: 'confirmed',
        confirmedAt: NOW_ISO,
      });
    });

    it('should stamp optedInAt for the optedIn transition', () => {
      // given / when
      const patch = androidTestStatusPatch('optedIn', NOW_ISO);
      // then
      expect(patch.androidTest).toEqual({
        status: 'optedIn',
        optedInAt: NOW_ISO,
      });
    });

    it('should stamp notifiedAt for the notified transition', () => {
      // given / when
      const patch = androidTestStatusPatch('notified', NOW_ISO);
      // then
      expect(patch.androidTest).toEqual({
        status: 'notified',
        notifiedAt: NOW_ISO,
      });
    });

    it('should not stamp a timestamp for candidate or declined', () => {
      // given / when
      const candidate = androidTestStatusPatch('candidate', NOW_ISO);
      const declined = androidTestStatusPatch('declined', NOW_ISO);
      // then
      expect(candidate.androidTest).toEqual({ status: 'candidate' });
      expect(declined.androidTest).toEqual({ status: 'declined' });
    });
  });

  describe('buildAndroidTestInvitePayload', () => {
    it('should build a German payload for the "de" locale', () => {
      // given
      const locale = 'de';
      // when
      const payload = JSON.parse(buildAndroidTestInvitePayload(locale));
      // then
      expect(payload.title).toBe('🎉 Du bist dabei!');
      expect(payload.tag).toBe('android-test-invite');
      expect(payload.data.url).toBe(ANDROID_TEST_OPT_IN_URL);
    });

    it('should fall back to English for an unsupported locale', () => {
      // given
      const locale = 'fr';
      // when
      const payload = JSON.parse(buildAndroidTestInvitePayload(locale));
      // then
      expect(payload.title).toBe('🎉 You’re in!');
    });

    it('should use a caller-supplied install URL when given', () => {
      // given
      const customUrl = 'https://play.google.com/apps/testing/custom.app';
      // when
      const payload = JSON.parse(
        buildAndroidTestInvitePayload('en', customUrl)
      );
      // then
      expect(payload.data.url).toBe(customUrl);
    });
  });
});
