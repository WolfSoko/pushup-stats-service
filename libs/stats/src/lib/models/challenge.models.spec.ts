import { describe, expect, it } from '@jest/globals';

import {
  addDays,
  challengeDaysLeft,
  challengeEndDate,
  challengePercent,
  challengeRejection,
  challengeStatus,
  MAX_ACTIVE_CHALLENGES,
  MAX_CHALLENGE_PARTICIPANTS,
} from './challenge.models';

describe('challenge.models', () => {
  describe('challengeRejection', () => {
    const ok = {
      friendUids: ['b', 'c'],
      acceptedFriendUids: ['b', 'c', 'd'],
      target: 500,
      days: 7,
      exerciseValid: true,
      activeCount: 0,
    };

    it('should accept a valid challenge', () => {
      // when / then
      expect(challengeRejection(ok)).toBeNull();
    });

    it('should need at least one friend', () => {
      // when / then
      expect(challengeRejection({ ...ok, friendUids: [] })).toBe('no-friends');
      expect(challengeRejection({ ...ok, friendUids: 'b' })).toBe('no-friends');
    });

    it('should cap the group size', () => {
      // given one more than the cap allows
      const uids = Array.from(
        { length: MAX_CHALLENGE_PARTICIPANTS },
        (_, i) => `u${i}`
      );

      // when / then
      expect(
        challengeRejection({
          ...ok,
          friendUids: uids,
          acceptedFriendUids: uids,
        })
      ).toBe('too-many');
    });

    it('should refuse anyone who is not a confirmed friend', () => {
      // when / then
      expect(challengeRejection({ ...ok, friendUids: ['b', 'x'] })).toBe(
        'not-friends'
      );
      expect(challengeRejection({ ...ok, friendUids: ['b', 'a/b'] })).toBe(
        'not-friends'
      );
    });

    it('should refuse an exercise that cannot be counted', () => {
      // when / then
      expect(challengeRejection({ ...ok, exerciseValid: false })).toBe(
        'exercise'
      );
    });

    it('should keep the target inside its bounds', () => {
      // when / then
      expect(challengeRejection({ ...ok, target: 5 })).toBe('target');
      expect(challengeRejection({ ...ok, target: 100_001 })).toBe('target');
      expect(challengeRejection({ ...ok, target: 10.5 })).toBe('target');
      expect(challengeRejection({ ...ok, target: '500' })).toBe('target');
    });

    it('should only allow the offered durations', () => {
      // when / then
      expect(challengeRejection({ ...ok, days: 5 })).toBe('duration');
      expect(challengeRejection({ ...ok, days: 30 })).toBeNull();
    });

    it('should stop a creator who already runs the maximum', () => {
      // when / then
      expect(
        challengeRejection({ ...ok, activeCount: MAX_ACTIVE_CHALLENGES })
      ).toBe('limit');
    });
  });

  describe('dates', () => {
    it('should end a 7-day challenge six days after it starts', () => {
      // when / then — first and last day both count
      expect(challengeEndDate('2026-09-14', 7)).toBe('2026-09-20');
      expect(challengeEndDate('2026-09-14', 3)).toBe('2026-09-16');
    });

    it('should roll over month and year ends', () => {
      // when / then
      expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
      expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    });

    it('should be active through the last day and ended after it', () => {
      // when / then
      expect(challengeStatus({ to: '2026-09-20' }, '2026-09-20')).toBe(
        'active'
      );
      expect(challengeStatus({ to: '2026-09-20' }, '2026-09-21')).toBe('ended');
    });

    it('should count the days left including today', () => {
      // when / then
      expect(challengeDaysLeft({ to: '2026-09-20' }, '2026-09-14')).toBe(7);
      expect(challengeDaysLeft({ to: '2026-09-20' }, '2026-09-20')).toBe(1);
      expect(challengeDaysLeft({ to: '2026-09-20' }, '2026-09-21')).toBe(0);
    });
  });

  describe('challengePercent', () => {
    it('should round and cap at 100', () => {
      // when / then
      expect(challengePercent(0, 500)).toBe(0);
      expect(challengePercent(333, 500)).toBe(67);
      expect(challengePercent(900, 500)).toBe(100);
      expect(challengePercent(-5, 500)).toBe(0);
      expect(challengePercent(5, 0)).toBe(0);
    });
  });
});
