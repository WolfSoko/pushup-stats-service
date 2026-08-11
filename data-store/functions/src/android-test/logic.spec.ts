import { describe, it, expect } from '@jest/globals';
import {
  ANDROID_TEST_ACTIVE_WITHIN_DAYS,
  ANDROID_TEST_MIN_ENTRIES,
  ANDROID_TEST_OPT_IN_URL,
  androidTestStatusPatch,
  buildAndroidTestInvitePayload,
  isAndroidTestCandidate,
  validateAndroidTestConfirmPayload,
  validateAndroidTesterAddedPayload,
} from './logic';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-11T12:00:00Z').getTime();

describe('android-test/logic', () => {
  describe('isAndroidTestCandidate', () => {
    it('should reject an undefined activity aggregate', () => {
      // given
      const activity = undefined;
      // when
      const result = isAndroidTestCandidate(activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should reject a user below the entry-count threshold', () => {
      // given
      const activity = {
        entryCount: ANDROID_TEST_MIN_ENTRIES - 1,
        lastEntry: new Date(NOW).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should accept a user exactly at the entry-count threshold with a recent entry', () => {
      // given
      const activity = {
        entryCount: ANDROID_TEST_MIN_ENTRIES,
        lastEntry: new Date(NOW).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(activity, NOW);
      // then
      expect(result).toBe(true);
    });

    it('should reject a user with no lastEntry', () => {
      // given
      const activity = { entryCount: 50, lastEntry: null };
      // when
      const result = isAndroidTestCandidate(activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should reject a user whose last entry is just past the active-within window', () => {
      // given
      const staleMs = NOW - (ANDROID_TEST_ACTIVE_WITHIN_DAYS * DAY_MS + DAY_MS);
      const activity = {
        entryCount: 50,
        lastEntry: new Date(staleMs).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(activity, NOW);
      // then
      expect(result).toBe(false);
    });

    it('should accept a user whose last entry is exactly at the active-within boundary', () => {
      // given
      const boundaryMs = NOW - ANDROID_TEST_ACTIVE_WITHIN_DAYS * DAY_MS;
      const activity = {
        entryCount: 50,
        lastEntry: new Date(boundaryMs).toISOString(),
      };
      // when
      const result = isAndroidTestCandidate(activity, NOW);
      // then
      expect(result).toBe(true);
    });

    it('should reject an unparseable lastEntry timestamp', () => {
      // given
      const activity = { entryCount: 50, lastEntry: 'not-a-date' };
      // when
      const result = isAndroidTestCandidate(activity, NOW);
      // then
      expect(result).toBe(false);
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
