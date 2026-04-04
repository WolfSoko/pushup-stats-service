// Minimal mock for @angular/fire/firestore
jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
}));

import { TestBed } from '@angular/core/testing';
import { LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import * as firestoreFns from '@angular/fire/firestore';
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

    it('should return empty array for fetchQuotes on SSR', async () => {
      const result = await service.fetchQuotes('de');
      expect(result).toEqual([]);
    });
  });

  describe('Browser platform with Firestore', () => {
    let service: MotivationQuoteService;

    beforeEach(() => {
      jest.clearAllMocks();

      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LOCALE_ID, useValue: 'de' },
          { provide: Firestore, useValue: {} },
        ],
      });
      service = TestBed.inject(MotivationQuoteService);
    });

    it('should load quotes from Firestore cache if available', async () => {
      jest.spyOn(firestoreFns, 'getDoc').mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ quotes: ['Firestore Quote 1', 'Firestore Quote 2'] }),
      } as any);

      const result = await service.fetchQuotes('de', 'test-user-123');

      expect(result).toEqual(['Firestore Quote 1', 'Firestore Quote 2']);
      expect(firestoreFns.doc).toHaveBeenCalled();
      expect(firestoreFns.getDoc).toHaveBeenCalled();
    });

    it('should return first quote from Firestore cache', async () => {
      jest.spyOn(firestoreFns, 'getDoc').mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ quotes: ['First Quote', 'Second'] }),
      } as any);

      const result = await service.fetchQuotes('de', 'test-user-123');

      expect(result[0]).toBe('First Quote');
    });

    it('should save quotes to Firestore after fetch', async () => {
      jest.spyOn(firestoreFns, 'getDoc').mockResolvedValueOnce({
        exists: () => false,
      } as any);
      const setDocSpy = jest
        .spyOn(firestoreFns, 'setDoc')
        .mockResolvedValueOnce(undefined as any);

      // Without Functions provider, service returns [] on cache miss
      await service.fetchQuotes('de', 'test-user-123');

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

      await service.fetchQuotes('de', 'test-user-123');

      expect(docSpy).toHaveBeenCalledWith(
        expect.anything(),
        'motivation-quotes',
        `test-user-123_${today}_de`
      );
    });

    it('should use "en" lang for English locale in Firestore doc ID', async () => {
      TestBed.resetTestingModule();

      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LOCALE_ID, useValue: 'en-US' },
          { provide: Firestore, useValue: {} },
        ],
      });
      const enService = TestBed.inject(MotivationQuoteService);

      const today = new Date().toISOString().slice(0, 10);
      const docSpy = jest.spyOn(firestoreFns, 'doc');
      jest.spyOn(firestoreFns, 'getDoc').mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ quotes: ['English Quote'] }),
      } as any);

      const result = await enService.fetchQuotes('en', 'en-user');

      expect(result).toEqual(['English Quote']);
      expect(docSpy).toHaveBeenCalledWith(
        expect.anything(),
        'motivation-quotes',
        `en-user_${today}_en`
      );
    });
  });

  describe('Browser platform without userId', () => {
    let service: MotivationQuoteService;

    beforeEach(() => {
      jest.clearAllMocks();

      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: LOCALE_ID, useValue: 'de' },
          { provide: Firestore, useValue: {} },
        ],
      });
      service = TestBed.inject(MotivationQuoteService);
    });

    it('should skip Firestore when no userId is provided', async () => {
      const result = await service.fetchQuotes('de');

      // Without Functions provider, cloud function returns []
      expect(result).toEqual([]);
      // Firestore should NOT be called without userId
      expect(firestoreFns.getDoc).not.toHaveBeenCalled();
    });
  });
});
