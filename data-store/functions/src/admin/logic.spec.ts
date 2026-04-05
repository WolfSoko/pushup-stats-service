import { describe, it, expect } from '@jest/globals';
import { validateDeleteUserPayload, isDemoUser, batchArray } from './logic';

describe('admin/logic', () => {
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
      const result = validateDeleteUserPayload({ uid: 'user123', anonymize: false });
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

  describe('batchArray', () => {
    it('batches array into chunks', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const batches = batchArray(array, 2);
      expect(batches).toEqual([[1, 2], [3, 4], [5, 6]]);
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
