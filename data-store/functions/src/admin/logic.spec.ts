import { describe, it, expect } from '@jest/globals';
import {
  validateAdminAccess,
  validateDeleteUserPayload,
  isDemoUser,
  batchArray,
  validateFeedbackId,
  validateMarkFeedbackReadPayload,
  buildGithubIssueBody,
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

  describe('buildGithubIssueBody', () => {
    it('builds title and body with all fields present', () => {
      const { title, body } = buildGithubIssueBody({
        name: 'Alice',
        email: 'alice@example.com',
        message: 'This is great feedback!',
        createdAt: '2026-04-09T10:00:00.000Z',
        userId: 'uid_abc12345',
      });
      expect(title).toBe('Feedback: This is great feedback!');
      expect(body).toContain('Alice');
      expect(body).toContain('alice@example.com');
      expect(body).toContain('2026-04-09T10:00:00.000Z');
      expect(body).toContain('uid_abc1...');
      expect(body).toContain('This is great feedback!');
    });

    it('uses Anonym when name and email are null', () => {
      const { title, body } = buildGithubIssueBody({
        name: null,
        email: null,
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
        email: null,
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
        email: null,
        message,
        createdAt: null,
        userId: null,
      });
      expect(title).not.toContain('…');
    });

    it('truncates userId to 8 chars with ellipsis', () => {
      const { body } = buildGithubIssueBody({
        name: null,
        email: null,
        message: 'test',
        createdAt: null,
        userId: 'verylonguserid123',
      });
      expect(body).toContain('verylong...');
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
});
