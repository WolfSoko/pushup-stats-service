import { describe, it, expect } from '@jest/globals';
import {
  getFallbackQuotes,
  sanitizeDisplayName,
  extractJsonArray,
  filterValidQuotes,
  isCacheValid,
  FALLBACK_QUOTES_DE,
  FALLBACK_QUOTES_EN,
} from './logic';

describe('motivation/logic', () => {
  describe('getFallbackQuotes', () => {
    it('returns German quotes for de language', () => {
      const quotes = getFallbackQuotes('de');
      expect(quotes).toEqual(FALLBACK_QUOTES_DE);
    });

    it('returns English quotes for en language', () => {
      const quotes = getFallbackQuotes('en');
      expect(quotes).toEqual(FALLBACK_QUOTES_EN);
    });

    it('defaults to German for unknown language', () => {
      const quotes = getFallbackQuotes('fr');
      expect(quotes).toEqual(FALLBACK_QUOTES_DE);
    });

    it('returns new array on each call', () => {
      const quotes1 = getFallbackQuotes('de');
      const quotes2 = getFallbackQuotes('de');
      expect(quotes1).not.toBe(quotes2); // Different array instances
      expect(quotes1).toEqual(quotes2); // Same content
    });
  });

  describe('sanitizeDisplayName', () => {
    it('keeps valid names as-is', () => {
      expect(sanitizeDisplayName('Alice')).toBe('Alice');
      expect(sanitizeDisplayName('Bob Smith')).toBe('Bob Smith');
    });

    it('removes special characters', () => {
      expect(sanitizeDisplayName('Alice@123#!')).toBe('Alice123');
      expect(sanitizeDisplayName('José')).toBe('José'); // Unicode allowed
    });

    it('trims whitespace', () => {
      expect(sanitizeDisplayName('  Alice  ')).toBe('Alice');
      expect(sanitizeDisplayName('\tBob\n')).toBe('Bob');
    });

    it('limits to 50 characters', () => {
      const longName = 'a'.repeat(60);
      const result = sanitizeDisplayName(longName);
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('returns Champ for empty string', () => {
      expect(sanitizeDisplayName('')).toBe('Champ');
      expect(sanitizeDisplayName('  ')).toBe('Champ');
      expect(sanitizeDisplayName('\n\t')).toBe('Champ');
    });

    it('preserves allowed punctuation', () => {
      expect(sanitizeDisplayName("O'Brien")).toBe("O'Brien");
      expect(sanitizeDisplayName('Mary-Jane')).toBe('Mary-Jane');
      expect(sanitizeDisplayName('Dr. Smith')).toBe('Dr. Smith');
    });

    it('handles undefined and null', () => {
      expect(sanitizeDisplayName(undefined as unknown as string)).toBe('Champ');
      expect(sanitizeDisplayName(null as unknown as string)).toBe('Champ');
    });

    it('handles Cyrillic characters', () => {
      expect(sanitizeDisplayName('Иван')).toBe('Иван');
      expect(sanitizeDisplayName('Матвей')).toBe('Матвей');
    });
  });

  describe('extractJsonArray', () => {
    it('extracts JSON array from text', () => {
      const text = 'Here is some text ["quote1", "quote2"] and more';
      const result = extractJsonArray(text);
      expect(result).toEqual(['quote1', 'quote2']);
    });

    it('handles multi-line JSON arrays', () => {
      const text = `
        Some text here
        [
          "quote1",
          "quote2"
        ]
        More text
      `;
      const result = extractJsonArray(text);
      expect(result).toEqual(['quote1', 'quote2']);
    });

    it('returns null for missing JSON array', () => {
      const text = 'No array here';
      const result = extractJsonArray(text);
      expect(result).toBeNull();
    });

    it('handles multiple arrays (uses first)', () => {
      const text = '["first", "one"] and ["second", "two"]';
      const result = extractJsonArray(text);
      expect(result).toEqual(['first', 'one']);
    });

    it('returns null for invalid JSON', () => {
      const text = '[invalid json]';
      const result = extractJsonArray(text);
      expect(result).toBeNull();
    });

    it('returns null for non-array JSON', () => {
      const text = '{"not": "array"}';
      const result = extractJsonArray(text);
      expect(result).toBeNull();
    });

    it('handles empty arrays', () => {
      const text = 'Result: []';
      const result = extractJsonArray(text);
      expect(result).toEqual([]);
    });
  });

  describe('filterValidQuotes', () => {
    it('filters empty quotes', () => {
      const input = ['Quote 1', '', '  ', 'Quote 2'];
      const result = filterValidQuotes(input);
      expect(result).toEqual(['Quote 1', 'Quote 2']);
    });

    it('converts objects to strings', () => {
      const input = [{ text: 'Quote 1' }, 'Quote 2'];
      const result = filterValidQuotes(input);
      expect(result[0]).toContain('Quote 1');
      expect(result[1]).toBe('Quote 2');
    });

    it('handles numbers', () => {
      const input = [123, 'Quote'];
      const result = filterValidQuotes(input);
      expect(result).toContain('123');
      expect(result).toContain('Quote');
    });

    it('returns empty array for empty input', () => {
      const result = filterValidQuotes([]);
      expect(result).toEqual([]);
    });

    it('preserves quote order', () => {
      const input = ['First', 'Second', 'Third'];
      const result = filterValidQuotes(input);
      expect(result).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('isCacheValid', () => {
    it('returns true for recent cache', () => {
      const now = Date.now();
      const generatedAt = new Date(now - 1000 * 60 * 60).toISOString(); // 1 hour ago
      const result = isCacheValid(generatedAt, now);
      expect(result).toBe(true);
    });

    it('returns false for old cache', () => {
      const now = Date.now();
      const generatedAt = new Date(now - 1000 * 60 * 60 * 24).toISOString(); // 24 hours ago
      const result = isCacheValid(generatedAt, now);
      expect(result).toBe(false);
    });

    it('returns true at boundary (just under QUOTE_CACHE_HOURS)', () => {
      const now = Date.now();
      const generatedAt = new Date(now - 1000 * 60 * 60 * 11.9).toISOString(); // 11.9 hours ago
      const result = isCacheValid(generatedAt, now);
      expect(result).toBe(true);
    });

    it('returns false at boundary (just over QUOTE_CACHE_HOURS)', () => {
      const now = Date.now();
      const generatedAt = new Date(now - 1000 * 60 * 60 * 12.1).toISOString(); // 12.1 hours ago
      const result = isCacheValid(generatedAt, now);
      expect(result).toBe(false);
    });

    it('returns false for invalid date string', () => {
      const result = isCacheValid('invalid-date', Date.now());
      expect(result).toBe(false);
    });

    it('returns true for timestamp just generated', () => {
      const now = Date.now();
      const generatedAt = new Date(now).toISOString();
      const result = isCacheValid(generatedAt, now);
      expect(result).toBe(true);
    });
  });
});
