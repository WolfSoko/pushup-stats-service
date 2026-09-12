import { describe, expect, it } from '@jest/globals';

import { cheerId, cheerRejection } from './cheer.models';

describe('cheer.models', () => {
  it('should key a cheer by sender, recipient and day', () => {
    // when / then — the same three again is the same document
    expect(cheerId('a', 'b', '2026-09-14')).toBe('a__b__2026-09-14');
    expect(cheerId('b', 'a', '2026-09-14')).not.toBe(
      cheerId('a', 'b', '2026-09-14')
    );
  });

  describe('cheerRejection', () => {
    const ok = { from: 'a', to: 'b', isFriend: true, alreadyToday: false };

    it('should let a friend cheer once a day', () => {
      // when / then
      expect(cheerRejection(ok)).toBeNull();
    });

    it('should refuse a malformed recipient', () => {
      // when / then
      expect(cheerRejection({ ...ok, to: '' })).toBe('invalid');
      expect(cheerRejection({ ...ok, to: 42 })).toBe('invalid');
    });

    it('should refuse cheering yourself', () => {
      // when / then
      expect(cheerRejection({ ...ok, to: 'a' })).toBe('self');
    });

    it('should refuse anyone who is not a confirmed friend', () => {
      // when / then
      expect(cheerRejection({ ...ok, isFriend: false })).toBe('not-friends');
    });

    it('should refuse a second cheer the same day', () => {
      // when / then
      expect(cheerRejection({ ...ok, alreadyToday: true })).toBe('already');
    });
  });
});
