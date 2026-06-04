import { describe, it, expect } from '@jest/globals';
import {
  validateAdminAccess,
  validateDeleteUserPayload,
  validateLeaderboardExclusionPayload,
  isDemoUser,
  batchArray,
  validateFeedbackId,
  validateMarkFeedbackReadPayload,
  validateSetMigrationStatusPayload,
  buildGithubIssueBody,
  escapeMarkdown,
} from './logic';

describe('admin/logic', () => {
  describe('validateAdminAccess', () => {
    it('returns null for admin user', () => {
      const result = validateAdminAccess({
        uid: 'user1',
        token: { admin: true },
      });
      expect(result).toBeNull();
    });

    it('rejects unauthenticated request (undefined auth)', () => {
      const result = validateAdminAccess(undefined);
      expect(result).toEqual({
        code: 'unauthenticated',
        message: 'Nicht angemeldet.',
      });
    });

    it('rejects user without admin claim', () => {
      const result = validateAdminAccess({ uid: 'user1', token: {} });
      expect(result).toEqual({
        code: 'permission-denied',
        message: 'Kein Admin-Zugriff.',
      });
    });

    it('rejects user with admin claim set to string "true"', () => {
      const result = validateAdminAccess({
        uid: 'user1',
        token: { admin: 'true' },
      });
      expect(result).toEqual({
        code: 'permission-denied',
        message: 'Kein Admin-Zugriff.',
      });
    });

    it('rejects user with admin claim set to false', () => {
      const result = validateAdminAccess({
        uid: 'user1',
        token: { admin: false },
      });
      expect(result).toEqual({
        code: 'permission-denied',
        message: 'Kein Admin-Zugriff.',
      });
    });

    it('rejects auth with empty uid', () => {
      const result = validateAdminAccess({ uid: '', token: { admin: true } });
      expect(result).toEqual({
        code: 'unauthenticated',
        message: 'Nicht angemeldet.',
      });
    });
  });

  describe('validateDeleteUserPayload', () => {
    it('validates correct payload', () => {
      const result = validateDeleteUserPayload({ uid: 'user123' });
      expect(result.valid).toBe(true);
      expect(result.uid).toBe('user123');
      expect(result.anonymize).toBe(true);
    });

    it('defaults anonymize to true', () => {
      const result = validateDeleteUserPayload({ uid: 'user123' });
      expect(result.anonymize).toBe(true);
    });

    it('respects explicit anonymize false', () => {
      const result = validateDeleteUserPayload({
        uid: 'user123',
        anonymize: false,
      });
      expect(result.anonymize).toBe(false);
    });

    it('rejects missing uid', () => {
      const result = validateDeleteUserPayload({});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('uid');
    });

    it('rejects empty string uid', () => {
      const result = validateDeleteUserPayload({ uid: '' });
      expect(result.valid).toBe(false);
    });

    it('trims uid whitespace', () => {
      const result = validateDeleteUserPayload({ uid: '  user123  ' });
      expect(result.uid).toBe('user123');
    });

    it('rejects null payload', () => {
      const result = validateDeleteUserPayload(null);
      expect(result.valid).toBe(false);
    });
  });

  describe('isDemoUser', () => {
    it('returns true for demo user', () => {
      const result = isDemoUser('demo-123', 'demo-123');
      expect(result).toBe(true);
    });

    it('returns false for regular user', () => {
      const result = isDemoUser('user-456', 'demo-123');
      expect(result).toBe(false);
    });

    it('is case-sensitive', () => {
      const result = isDemoUser('DEMO-123', 'demo-123');
      expect(result).toBe(false);
    });
  });

  describe('validateFeedbackId', () => {
    it('returns valid for a non-empty feedbackId', () => {
      const result = validateFeedbackId({ feedbackId: 'abc123' });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.feedbackId).toBe('abc123');
    });

    it('trims whitespace from feedbackId', () => {
      const result = validateFeedbackId({ feedbackId: '  abc123  ' });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.feedbackId).toBe('abc123');
    });

    it('rejects missing feedbackId', () => {
      const result = validateFeedbackId({});
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain('feedbackId');
    });

    it('rejects empty string feedbackId', () => {
      const result = validateFeedbackId({ feedbackId: '' });
      expect(result.valid).toBe(false);
    });

    it('rejects whitespace-only feedbackId', () => {
      const result = validateFeedbackId({ feedbackId: '   ' });
      expect(result.valid).toBe(false);
    });

    it('rejects non-object payload', () => {
      const result = validateFeedbackId('abc123');
      expect(result.valid).toBe(false);
    });

    it('rejects null payload', () => {
      const result = validateFeedbackId(null);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateMarkFeedbackReadPayload', () => {
    it('returns valid with read=true when not specified', () => {
      const result = validateMarkFeedbackReadPayload({ feedbackId: 'abc123' });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.feedbackId).toBe('abc123');
        expect(result.read).toBe(true);
      }
    });

    it('accepts explicit read=true', () => {
      const result = validateMarkFeedbackReadPayload({
        feedbackId: 'abc123',
        read: true,
      });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.read).toBe(true);
    });

    it('accepts explicit read=false', () => {
      const result = validateMarkFeedbackReadPayload({
        feedbackId: 'abc123',
        read: false,
      });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.read).toBe(false);
    });

    it('rejects non-boolean read', () => {
      const result = validateMarkFeedbackReadPayload({
        feedbackId: 'abc123',
        read: 'yes',
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain('read');
    });

    it('rejects missing feedbackId', () => {
      const result = validateMarkFeedbackReadPayload({ read: true });
      expect(result.valid).toBe(false);
    });
  });

  describe('escapeMarkdown', () => {
    it('escapes @ to prevent mentions', () => {
      expect(escapeMarkdown('alice@example.com')).toBe('alice&#64;example.com');
    });

    it('escapes < and >', () => {
      expect(escapeMarkdown('<script>alert(1)</script>')).toBe(
        '&lt;script&gt;alert(1)&lt;/script&gt;'
      );
    });

    it('returns plain text unchanged', () => {
      expect(escapeMarkdown('Hello World')).toBe('Hello World');
    });

    it('escapes multiple occurrences', () => {
      expect(escapeMarkdown('@a @b')).toBe('&#64;a &#64;b');
    });
  });

  describe('buildGithubIssueBody', () => {
    it('builds title and body with all fields present', () => {
      const { title, body } = buildGithubIssueBody({
        name: 'Alice',
        message: 'This is great feedback!',
        createdAt: '2026-04-09T10:00:00.000Z',
        userId: 'uid_abc12345',
      });
      expect(title).toBe('Feedback: This is great feedback!');
      expect(body).toContain('Alice');
      expect(body).toContain('2026-04-09T10:00:00.000Z');
      expect(body).toContain('uid_abc1...');
      expect(body).toContain('This is great feedback!');
    });

    it('uses Anonym when name is null and userId is null', () => {
      const { title, body } = buildGithubIssueBody({
        name: null,
        message: 'Hello',
        createdAt: null,
        userId: null,
      });
      expect(body).toContain('Anonym');
      expect(body).toContain('unbekannt');
      expect(title).toBe('Feedback: Hello');
    });

    it('truncates long message in title with ellipsis', () => {
      const longMessage = 'A'.repeat(100);
      const { title } = buildGithubIssueBody({
        name: null,
        message: longMessage,
        createdAt: null,
        userId: null,
      });
      expect(title.length).toBeLessThanOrEqual('Feedback: '.length + 81);
      expect(title).toContain('…');
    });

    it('does not add ellipsis for message exactly 80 chars', () => {
      const message = 'B'.repeat(80);
      const { title } = buildGithubIssueBody({
        name: null,
        message,
        createdAt: null,
        userId: null,
      });
      expect(title).not.toContain('…');
    });

    it('truncates userId to 8 chars with ellipsis', () => {
      const { body } = buildGithubIssueBody({
        name: null,
        message: 'test',
        createdAt: null,
        userId: 'verylonguserid123',
      });
      expect(body).toContain('verylong...');
    });

    it('escapes @ in name to prevent GitHub mentions', () => {
      const { body } = buildGithubIssueBody({
        name: '@attacker',
        message: 'test',
        createdAt: null,
        userId: null,
      });
      expect(body).toContain('&#64;attacker');
      expect(body).not.toContain('@attacker');
    });

    it('normalizes whitespace in title', () => {
      const { title } = buildGithubIssueBody({
        name: null,
        message: 'hello   world\nnewline',
        createdAt: null,
        userId: null,
      });
      expect(title).toBe('Feedback: hello world newline');
    });
  });

  describe('batchArray', () => {
    it('batches array into chunks', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const batches = batchArray(array, 2);
      expect(batches).toEqual([
        [1, 2],
        [3, 4],
        [5, 6],
      ]);
    });

    it('handles remainder batch', () => {
      const array = [1, 2, 3, 4, 5];
      const batches = batchArray(array, 2);
      expect(batches).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('returns single batch for array smaller than batch size', () => {
      const array = [1, 2];
      const batches = batchArray(array, 10);
      expect(batches).toEqual([[1, 2]]);
    });

    it('handles empty array', () => {
      const batches = batchArray([], 2);
      expect(batches).toEqual([]);
    });

    it('handles single element', () => {
      const batches = batchArray([1], 2);
      expect(batches).toEqual([[1]]);
    });

    it('works with objects', () => {
      const array = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const batches = batchArray(array, 2);
      expect(batches).toEqual([[{ id: 1 }, { id: 2 }], [{ id: 3 }]]);
    });
  });

  describe('validateLeaderboardExclusionPayload', () => {
    it('accepts a valid {uid, excluded} payload', () => {
      const result = validateLeaderboardExclusionPayload({
        uid: 'abc',
        excluded: true,
      });
      expect(result).toEqual({ valid: true, uid: 'abc', excluded: true });
    });

    it('accepts excluded=false (un-banning)', () => {
      const result = validateLeaderboardExclusionPayload({
        uid: 'abc',
        excluded: false,
      });
      expect(result).toEqual({ valid: true, uid: 'abc', excluded: false });
    });

    it('trims surrounding whitespace from uid', () => {
      const result = validateLeaderboardExclusionPayload({
        uid: '  abc  ',
        excluded: true,
      });
      expect(result).toEqual({ valid: true, uid: 'abc', excluded: true });
    });

    it('rejects non-object payload', () => {
      expect(validateLeaderboardExclusionPayload(null)).toEqual({
        valid: false,
        error: 'payload must be an object',
      });
      expect(validateLeaderboardExclusionPayload('foo')).toEqual({
        valid: false,
        error: 'payload must be an object',
      });
    });

    it('rejects missing or empty uid', () => {
      expect(
        validateLeaderboardExclusionPayload({ excluded: true })
      ).toMatchObject({ valid: false });
      expect(
        validateLeaderboardExclusionPayload({ uid: '   ', excluded: true })
      ).toMatchObject({ valid: false });
    });

    it('rejects non-boolean excluded', () => {
      expect(
        validateLeaderboardExclusionPayload({ uid: 'abc', excluded: 'true' })
      ).toMatchObject({ valid: false });
      expect(validateLeaderboardExclusionPayload({ uid: 'abc' })).toMatchObject(
        { valid: false }
      );
    });
  });

  describe('validateSetMigrationStatusPayload', () => {
    it('should accept a valid {id, completed} payload', () => {
      // given / when
      const result = validateSetMigrationStatusPayload({
        id: 'pushup-unification',
        completed: true,
      });
      // then
      expect(result).toEqual({
        valid: true,
        id: 'pushup-unification',
        completed: true,
      });
    });

    it('should accept completed=false (reopening)', () => {
      // given / when / then
      expect(
        validateSetMigrationStatusPayload({ id: 'x', completed: false })
      ).toEqual({ valid: true, id: 'x', completed: false });
    });

    it('should trim surrounding whitespace from id', () => {
      // given / when / then
      expect(
        validateSetMigrationStatusPayload({ id: '  x  ', completed: true })
      ).toEqual({ valid: true, id: 'x', completed: true });
    });

    it('should reject a non-object payload', () => {
      // given / when / then
      expect(validateSetMigrationStatusPayload(null)).toEqual({
        valid: false,
        error: 'payload must be an object',
      });
    });

    it('should reject a missing or empty id', () => {
      // given / when / then
      expect(
        validateSetMigrationStatusPayload({ completed: true })
      ).toMatchObject({ valid: false });
      expect(
        validateSetMigrationStatusPayload({ id: '   ', completed: true })
      ).toMatchObject({ valid: false });
    });

    it('should reject a non-boolean completed', () => {
      // given / when / then
      expect(
        validateSetMigrationStatusPayload({ id: 'x', completed: 'yes' })
      ).toMatchObject({ valid: false });
      expect(validateSetMigrationStatusPayload({ id: 'x' })).toMatchObject({
        valid: false,
      });
    });
  });
});
