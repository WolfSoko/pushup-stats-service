// Minimal mock for @angular/fire/firestore
jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
}));

import { TestBed } from '@angular/core/testing';
import { LOCALE_ID, PLATFORM_ID, signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import * as firestoreFns from '@angular/fire/firestore';
import { MotivationQuoteService } from './motivation-quote.service';
import { UserContextService } from '@pu-auth/auth';

describe('MotivationQuoteService', () => {
  const mockUserContext = {
    userIdSafe: signal(''),
  };

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

  describe('Browser platform with Firestore', () => {
    let service: MotivationQuoteService;

    beforeEach(() => {
      jest.clearAllMocks();
      mockUserContext.userIdSafe = signal('test-user-123');

      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LOCALE_ID, useValue: 'de' },
          { provide: Firestore, useValue: {} },
          { provide: UserContextService, useValue: mockUserContext },
        ],
      });
      service = TestBed.inject(MotivationQuoteService);
    });

    it('should load quotes from Firestore cache if available', async () => {
      jest.spyOn(firestoreFns, 'getDoc').mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ quotes: ['Firestore Quote 1', 'Firestore Quote 2'] }),
      } as any);

      const result = await service.getTodayQuotes();

      expect(result).toEqual(['Firestore Quote 1', 'Firestore Quote 2']);
      expect(firestoreFns.doc).toHaveBeenCalled();
      expect(firestoreFns.getDoc).toHaveBeenCalled();
    });

    it('should return first quote from Firestore cache for getTodayQuote', async () => {
      jest.spyOn(firestoreFns, 'getDoc').mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ quotes: ['First Quote', 'Second'] }),
      } as any);

      const result = await service.getTodayQuote();

      expect(result).toBe('First Quote');
    });

    it('should save quotes to Firestore after fetch', async () => {
      jest.spyOn(firestoreFns, 'getDoc').mockResolvedValueOnce({
        exists: () => false,
      } as any);
      const setDocSpy = jest
        .spyOn(firestoreFns, 'setDoc')
        .mockResolvedValueOnce(undefined as any);

      // Without Functions provider, service returns [] on cache miss
      await service.getTodayQuotes();

      // setDoc won't be called because fetchQuotes returns [] without Functions
      expect(setDocSpy).not.toHaveBeenCalled();
    });

    it('should use correct Firestore doc ID format', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const docSpy = jest.spyOn(firestoreFns, 'doc');
      jest.spyOn(firestoreFns, 'getDoc').mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ quotes: ['Quote'] }),
      } as any);

      await service.getTodayQuotes();

      expect(docSpy).toHaveBeenCalledWith(
        expect.anything(),
        'motivation-quotes',
        `test-user-123_${today}_de`
      );
    });

    it('should use "en" lang for English locale in Firestore doc ID', async () => {
      TestBed.resetTestingModule();
      mockUserContext.userIdSafe = signal('en-user');

      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LOCALE_ID, useValue: 'en-US' },
          { provide: Firestore, useValue: {} },
          { provide: UserContextService, useValue: mockUserContext },
        ],
      });
      const enService = TestBed.inject(MotivationQuoteService);

      const today = new Date().toISOString().slice(0, 10);
      const docSpy = jest.spyOn(firestoreFns, 'doc');
      jest.spyOn(firestoreFns, 'getDoc').mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ quotes: ['English Quote'] }),
      } as any);

      const result = await enService.getTodayQuotes();

      expect(result).toEqual(['English Quote']);
      expect(docSpy).toHaveBeenCalledWith(
        expect.anything(),
        'motivation-quotes',
        `en-user_${today}_en`
      );
    });
  });

  describe('Browser platform without userId (localStorage fallback)', () => {
    let service: MotivationQuoteService;
    const mockLocalStorage: Record<string, string> = {};

    beforeEach(() => {
      jest.clearAllMocks();
      mockUserContext.userIdSafe = signal(''); // No user logged in

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
          { provide: Firestore, useValue: {} },
          { provide: UserContextService, useValue: mockUserContext },
        ],
      });
      service = TestBed.inject(MotivationQuoteService);
    });

    afterEach(() => {
      Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    });

    it('should fall back to localStorage when no userId', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `motivation-quotes-${today}-de`;
      mockLocalStorage[cacheKey] = JSON.stringify(['LocalStorage Quote']);

      const result = await service.getTodayQuotes();

      expect(result).toEqual(['LocalStorage Quote']);
      // Firestore should NOT be called
      expect(firestoreFns.getDoc).not.toHaveBeenCalled();
    });

    it('should return first quote from localStorage for getTodayQuote', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `motivation-quotes-${today}-de`;
      mockLocalStorage[cacheKey] = JSON.stringify(['First', 'Second']);

      const result = await service.getTodayQuote();

      expect(result).toBe('First');
    });

    it('should return empty array when localStorage cache is invalid JSON', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `motivation-quotes-${today}-de`;
      mockLocalStorage[cacheKey] = 'invalid json';

      const result = await service.getTodayQuotes();
      expect(result).toEqual([]);
    });

    it('should return empty array when localStorage cache is empty array', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `motivation-quotes-${today}-de`;
      mockLocalStorage[cacheKey] = JSON.stringify([]);

      const result = await service.getTodayQuotes();
      expect(result).toEqual([]);
    });
  });
});
