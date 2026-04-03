import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { MotivationalQuoteService } from './motivational-quote.service';

describe('MotivationalQuoteService', () => {
  describe('with German locale (de)', () => {
    let service: MotivationalQuoteService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: LOCALE_ID, useValue: 'de' }],
      });
      service = TestBed.inject(MotivationalQuoteService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('getTodayQuote() should return a string', () => {
      const quote = service.getTodayQuote();
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });

    it('getTodayQuote() should be deterministic (same call = same value)', () => {
      const quote1 = service.getTodayQuote();
      const quote2 = service.getTodayQuote();
      const quote3 = service.getTodayQuote();

      expect(quote1).toBe(quote2);
      expect(quote2).toBe(quote3);
    });

    it('getTodayQuote() should return a quote within expected length', () => {
      const quote = service.getTodayQuote();
      expect(quote.length).toBeLessThanOrEqual(60);
    });
  });

  describe('with English locale (en)', () => {
    let service: MotivationalQuoteService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: LOCALE_ID, useValue: 'en' }],
      });
      service = TestBed.inject(MotivationalQuoteService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('getTodayQuote() should return a string', () => {
      const quote = service.getTodayQuote();
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });

    it('getTodayQuote() should be deterministic (same call = same value)', () => {
      const quote1 = service.getTodayQuote();
      const quote2 = service.getTodayQuote();
      const quote3 = service.getTodayQuote();

      expect(quote1).toBe(quote2);
      expect(quote2).toBe(quote3);
    });

    it('getTodayQuote() should return a quote within expected length', () => {
      const quote = service.getTodayQuote();
      expect(quote.length).toBeLessThanOrEqual(60);
    });
  });

  describe('locale comparison', () => {
    it('should return different quotes for DE and EN locales', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOCALE_ID, useValue: 'de' }],
      });
      const deService = TestBed.inject(MotivationalQuoteService);
      const deQuote = deService.getTodayQuote();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOCALE_ID, useValue: 'en' }],
      });
      const enService = TestBed.inject(MotivationalQuoteService);
      const enQuote = enService.getTodayQuote();

      expect(deQuote).not.toBe(enQuote);
    });

    it('should handle en-US locale variant', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOCALE_ID, useValue: 'en-US' }],
      });
      const service = TestBed.inject(MotivationalQuoteService);
      const quote = service.getTodayQuote();

      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });

    it('should default to German for unknown locales', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOCALE_ID, useValue: 'de' }],
      });
      const deService = TestBed.inject(MotivationalQuoteService);
      const deQuote = deService.getTodayQuote();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOCALE_ID, useValue: 'fr' }],
      });
      const frService = TestBed.inject(MotivationalQuoteService);
      const frQuote = frService.getTodayQuote();

      expect(frQuote).toBe(deQuote);
    });
  });
});
