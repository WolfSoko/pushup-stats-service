import { describe, it, expect } from '@jest/globals';
import {
  parseRecaptchaResponse,
  validateRecaptchaPayload,
  validateRevokeSessionsRequest,
  RecaptchaResponse,
} from './logic';

describe('authentication/logic', () => {
  describe('parseRecaptchaResponse', () => {
    const minScore = 0.5;
    const expectedAction = 'login';

    it('returns valid assessment when token is valid and conditions met', () => {
      const response: RecaptchaResponse = {
        tokenProperties: {
          valid: true,
          action: 'login',
        },
        riskAnalysis: {
          score: 0.9,
          reasons: [],
        },
      };

      const result = parseRecaptchaResponse(response, expectedAction, minScore);

      expect(result.ok).toBe(true);
      expect(result.score).toBe(0.9);
      expect(result.actionMatched).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('returns invalid when token is not valid', () => {
      const response: RecaptchaResponse = {
        tokenProperties: {
          valid: false,
          invalidReason: 'TOKEN_EXPIRED',
          action: 'login',
        },
        riskAnalysis: {
          score: 0,
          reasons: [],
        },
      };

      const result = parseRecaptchaResponse(response, expectedAction, minScore);

      expect(result.ok).toBe(false);
      expect(result.score).toBe(0);
      expect(result.actionMatched).toBe(false);
      expect(result.reason).toContain('invalid-token:TOKEN_EXPIRED');
    });

    it('returns not ok when score is below minimum', () => {
      const response: RecaptchaResponse = {
        tokenProperties: {
          valid: true,
          action: 'login',
        },
        riskAnalysis: {
          score: 0.3, // Below minScore of 0.5
          reasons: ['SUSPICIOUS_ENVIRONMENT'],
        },
      };

      const result = parseRecaptchaResponse(response, expectedAction, minScore);

      expect(result.ok).toBe(false);
      expect(result.score).toBe(0.3);
      expect(result.actionMatched).toBe(true);
      expect(result.reasons).toEqual(['SUSPICIOUS_ENVIRONMENT']);
    });

    it('returns not ok when action does not match', () => {
      const response: RecaptchaResponse = {
        tokenProperties: {
          valid: true,
          action: 'register', // Different action
        },
        riskAnalysis: {
          score: 0.9,
          reasons: [],
        },
      };

      const result = parseRecaptchaResponse(response, expectedAction, minScore);

      expect(result.ok).toBe(false);
      expect(result.score).toBe(0.9);
      expect(result.actionMatched).toBe(false);
      expect(result.action).toBe('register');
    });

    it('handles missing invalidReason gracefully', () => {
      const response: RecaptchaResponse = {
        tokenProperties: {
          valid: false,
          action: 'login',
        },
      };

      const result = parseRecaptchaResponse(response, expectedAction, minScore);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('invalid-token:unknown');
    });

    it('handles missing riskAnalysis', () => {
      const response: RecaptchaResponse = {
        tokenProperties: {
          valid: true,
          action: 'login',
        },
      };

      const result = parseRecaptchaResponse(response, expectedAction, minScore);

      expect(result.score).toBe(0);
      expect(result.reasons).toEqual([]);
    });

    it('converts risk reasons to strings', () => {
      const response: RecaptchaResponse = {
        tokenProperties: {
          valid: true,
          action: 'login',
        },
        riskAnalysis: {
          score: 0.7,
          reasons: [
            'SUSPICIOUS_ENVIRONMENT',
            'UNEXPECTED_ENVIRONMENT',
          ] as unknown[] as string[],
        },
      };

      const result = parseRecaptchaResponse(response, expectedAction, minScore);

      expect(result.reasons).toEqual([
        'SUSPICIOUS_ENVIRONMENT',
        'UNEXPECTED_ENVIRONMENT',
      ]);
    });

    it('handles score of 0 correctly', () => {
      const response: RecaptchaResponse = {
        tokenProperties: {
          valid: true,
          action: 'login',
        },
        riskAnalysis: {
          score: 0,
        },
      };

      const result = parseRecaptchaResponse(response, expectedAction, 0);

      // ok=true only if action matched AND score >= minScore (0)
      expect(result.ok).toBe(true);
    });

    it('handles score of 1.0 correctly', () => {
      const response: RecaptchaResponse = {
        tokenProperties: {
          valid: true,
          action: 'login',
        },
        riskAnalysis: {
          score: 1.0,
        },
      };

      const result = parseRecaptchaResponse(response, expectedAction, minScore);

      expect(result.ok).toBe(true);
      expect(result.score).toBe(1.0);
    });
  });

  describe('validateRecaptchaPayload', () => {
    it('validates correct payload', () => {
      const result = validateRecaptchaPayload('token-value', 'login');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects missing token', () => {
      const result = validateRecaptchaPayload(undefined, 'login');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('token');
    });

    it('rejects non-string token', () => {
      const result = validateRecaptchaPayload(12345, 'login');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('token');
    });

    it('rejects empty string token', () => {
      const result = validateRecaptchaPayload('', 'login');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('token');
    });

    it('rejects missing action', () => {
      const result = validateRecaptchaPayload('token-value', undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('action');
    });

    it('rejects non-string action', () => {
      const result = validateRecaptchaPayload('token-value', 123);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('action');
    });

    it('rejects empty string action', () => {
      const result = validateRecaptchaPayload('token-value', '');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('action');
    });

    it('rejects null values', () => {
      const result = validateRecaptchaPayload(null, null);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateRevokeSessionsRequest', () => {
    it('returns null for an authenticated email/password user', () => {
      const result = validateRevokeSessionsRequest({
        uid: 'user1',
        token: { firebase: { sign_in_provider: 'password' } },
      });
      expect(result).toBeNull();
    });

    it('returns null for an authenticated Google user', () => {
      const result = validateRevokeSessionsRequest({
        uid: 'user1',
        token: { firebase: { sign_in_provider: 'google.com' } },
      });
      expect(result).toBeNull();
    });

    it('rejects unauthenticated request (undefined auth)', () => {
      const result = validateRevokeSessionsRequest(undefined);
      expect(result).toEqual({
        code: 'unauthenticated',
        message: 'Nicht angemeldet.',
      });
    });

    it('rejects request with empty uid', () => {
      const result = validateRevokeSessionsRequest({
        uid: '',
        token: { firebase: { sign_in_provider: 'password' } },
      });
      expect(result?.code).toBe('unauthenticated');
    });

    it('rejects anonymous (guest) sessions', () => {
      const result = validateRevokeSessionsRequest({
        uid: 'anon-uid',
        token: { firebase: { sign_in_provider: 'anonymous' } },
      });
      expect(result).toEqual({
        code: 'failed-precondition',
        message: 'Gast-Sitzungen können nicht abgemeldet werden.',
      });
    });

    it('treats a missing firebase claim as non-anonymous (defensive)', () => {
      const result = validateRevokeSessionsRequest({
        uid: 'user1',
        token: {},
      });
      expect(result).toBeNull();
    });
  });
});
