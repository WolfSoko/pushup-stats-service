import { TestBed } from '@angular/core/testing';
import { MotivationalQuoteService } from './motivational-quote.service';

describe('MotivationalQuoteService', () => {
  let service: MotivationalQuoteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
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
