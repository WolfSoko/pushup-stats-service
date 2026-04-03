import { TestBed } from '@angular/core/testing';
import { LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { MotivationQuoteService } from './motivation-quote.service';

describe('MotivationQuoteService', () => {
  describe('SSR (server platform)', () => {
    let service: MotivationQuoteService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: LOCALE_ID, useValue: 'de' },
        ],
      });
      service = TestBed.inject(MotivationQuoteService);
    });

    it('should return null for getTodayQuote on SSR', async () => {
      const result = await service.getTodayQuote();
      expect(result).toBeNull();
    });

    it('should return empty array for getTodayQuotes on SSR', async () => {
      const result = await service.getTodayQuotes();
      expect(result).toEqual([]);
    });
  });

  describe('Browser platform', () => {
    let service: MotivationQuoteService;
    const mockLocalStorage: Record<string, string> = {};

    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn((key: string) => mockLocalStorage[key] ?? null),
          setItem: jest.fn((key: string, value: string) => {
            mockLocalStorage[key] = value;
          }),
          removeItem: jest.fn((key: string) => {
            delete mockLocalStorage[key];
          }),
          clear: jest.fn(() => {
            Object.keys(mockLocalStorage).forEach(
              (k) => delete mockLocalStorage[k]
            );
          }),
        },
        writable: true,
      });

      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LOCALE_ID, useValue: 'de' },
        ],
      });
      service = TestBed.inject(MotivationQuoteService);
    });

    afterEach(() => {
      Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    });

    it('should load quotes from cache if available', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `motivation-quotes-${today}-de`;
      mockLocalStorage[cacheKey] = JSON.stringify(['Quote 1', 'Quote 2']);

      const result = await service.getTodayQuotes();
      expect(result).toEqual(['Quote 1', 'Quote 2']);
    });

    it('should return first quote from cache for getTodayQuote', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `motivation-quotes-${today}-de`;
      mockLocalStorage[cacheKey] = JSON.stringify(['First Quote', 'Second']);

      const result = await service.getTodayQuote();
      expect(result).toBe('First Quote');
    });

    it('should use "en" lang for English locale', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LOCALE_ID, useValue: 'en-US' },
        ],
      });
      const enService = TestBed.inject(MotivationQuoteService);

      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `motivation-quotes-${today}-en`;
      mockLocalStorage[cacheKey] = JSON.stringify(['English Quote']);

      const result = await enService.getTodayQuotes();
      expect(result).toEqual(['English Quote']);
    });

    it('should return empty array when cache is invalid JSON', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `motivation-quotes-${today}-de`;
      mockLocalStorage[cacheKey] = 'invalid json';

      // Without Functions, it will return empty array (no fetch possible)
      const result = await service.getTodayQuotes();
      expect(result).toEqual([]);
    });

    it('should return empty array when cache is empty array', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `motivation-quotes-${today}-de`;
      mockLocalStorage[cacheKey] = JSON.stringify([]);

      const result = await service.getTodayQuotes();
      expect(result).toEqual([]);
    });
  });
});
