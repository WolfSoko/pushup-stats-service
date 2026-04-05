import { describe, it, expect } from '@jest/globals';
import { berlinDateParts, isoWeekFromYmd } from './logic';

describe('datetime/logic', () => {
  describe('berlinDateParts', () => {
    it('converts UTC date to Berlin timezone date parts', () => {
      // 2024-03-15 00:00:00 UTC = 2024-03-15 01:00:00 Berlin (UTC+1)
      const date = new Date('2024-03-15T00:00:00Z');
      const parts = berlinDateParts(date);
      expect(parts).toEqual({
        year: 2024,
        month: 3,
        day: 15,
        isoDate: '2024-03-15',
      });
    });

    it('handles DST transitions correctly', () => {
      // 2024-03-31 01:00:00 UTC = 2024-03-31 03:00:00 Berlin (UTC+2 summer time)
      const date = new Date('2024-03-31T01:00:00Z');
      const parts = berlinDateParts(date);
      expect(parts.isoDate).toBe('2024-03-31');
    });

    it('handles year boundary', () => {
      // 2024-01-01 00:00:00 UTC
      const date = new Date('2024-01-01T00:00:00Z');
      const parts = berlinDateParts(date);
      expect(parts.year).toBe(2024);
      expect(parts.month).toBe(1);
      expect(parts.day).toBe(1);
    });

    it('uses current date when none provided', () => {
      const parts = berlinDateParts();
      expect(parts).toHaveProperty('year');
      expect(parts).toHaveProperty('month');
      expect(parts).toHaveProperty('day');
      expect(parts).toHaveProperty('isoDate');
      expect(parts.month).toBeGreaterThanOrEqual(1);
      expect(parts.month).toBeLessThanOrEqual(12);
      expect(parts.day).toBeGreaterThanOrEqual(1);
      expect(parts.day).toBeLessThanOrEqual(31);
    });
  });

  describe('isoWeekFromYmd', () => {
    it('calculates ISO week correctly for mid-year date', () => {
      // 2024-03-15 is in week 11
      const week = isoWeekFromYmd(2024, 3, 15);
      expect(week.year).toBe(2024);
      expect(week.week).toBe(11);
    });

    it('handles year boundary correctly', () => {
      // 2024-01-01 is in week 1 of 2024
      const week = isoWeekFromYmd(2024, 1, 1);
      expect(week.year).toBe(2024);
      expect(week.week).toBe(1);
    });

    it('handles week 53 at year boundary', () => {
      // 2023-12-28 is in week 52 of 2023
      const week = isoWeekFromYmd(2023, 12, 28);
      expect(week.year).toBe(2023);
      expect(week.week).toBe(52);
    });

    it('correctly handles dates near ISO week boundaries', () => {
      // ISO weeks start on Monday (day 1 = Monday, day 7 = Sunday)
      // 2024-03-11 (Monday) should be week 11
      const monday = isoWeekFromYmd(2024, 3, 11);
      expect(monday.week).toBe(11);

      // 2024-03-17 (Sunday) should still be week 11
      const sunday = isoWeekFromYmd(2024, 3, 17);
      expect(sunday.week).toBe(11);

      // 2024-03-18 (Monday) should be week 12
      const nextMonday = isoWeekFromYmd(2024, 3, 18);
      expect(nextMonday.week).toBe(12);
    });
  });
});
