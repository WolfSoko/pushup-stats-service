import { describe, it, expect } from '@jest/globals';
import {
  readActivePlan,
  readPublicProfile,
  validateGetUserDetailsPayload,
} from './user-details';

describe('user-details helpers', () => {
  describe('validateGetUserDetailsPayload', () => {
    it('should accept a non-empty uid and trim it', () => {
      // given / when
      const result = validateGetUserDetailsPayload({ uid: '  user-1  ' });
      // then
      expect(result).toEqual({ valid: true, uid: 'user-1' });
    });

    it('should reject a missing or empty uid', () => {
      // given / when / then
      expect(validateGetUserDetailsPayload({}).valid).toBe(false);
      expect(validateGetUserDetailsPayload({ uid: '   ' }).valid).toBe(false);
      expect(validateGetUserDetailsPayload(null).valid).toBe(false);
    });
  });

  describe('readPublicProfile', () => {
    it('should return true only when ui.publicProfile is exactly true', () => {
      // given / when / then
      expect(readPublicProfile({ ui: { publicProfile: true } })).toBe(true);
    });

    it('should treat a missing config/flag or non-true value as private', () => {
      // given / when / then
      expect(readPublicProfile(undefined)).toBe(false);
      expect(readPublicProfile({})).toBe(false);
      expect(readPublicProfile({ ui: {} })).toBe(false);
      expect(readPublicProfile({ ui: { publicProfile: false } })).toBe(false);
      expect(readPublicProfile({ ui: { publicProfile: 'yes' } })).toBe(false);
    });
  });

  describe('readActivePlan', () => {
    it('should project an active plan doc to planId + startDate', () => {
      // given / when
      const plan = readActivePlan({
        planId: 'recruit-6w',
        status: 'active',
        startDate: '2026-07-01',
      });
      // then
      expect(plan).toEqual({ planId: 'recruit-6w', startDate: '2026-07-01' });
    });

    it('should default a missing startDate to null', () => {
      // given / when
      const plan = readActivePlan({ planId: 'recruit-6w', status: 'active' });
      // then
      expect(plan).toEqual({ planId: 'recruit-6w', startDate: null });
    });

    it('should return null for a non-active, planless, or missing doc', () => {
      // given / when / then — a completed/abandoned plan must not show as active
      expect(readActivePlan({ planId: 'p', status: 'completed' })).toBeNull();
      expect(readActivePlan({ planId: 'p', status: 'abandoned' })).toBeNull();
      expect(readActivePlan({ status: 'active' })).toBeNull();
      expect(readActivePlan(null)).toBeNull();
    });
  });
});
