import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdsStore } from './ads.store';

describe('AdsStore (SSR)', () => {
  it('should not crash on server platform and return safe defaults', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }, AdsStore],
    });

    const store = TestBed.inject(AdsStore);

    expect(store.enabled()).toBeUndefined();
    expect(store.adClient()).toBeUndefined();
    expect(store.dashboardInlineEnabled()).toBeUndefined();
    expect(store.adsAllowed()).toBe(false);
    expect(store.consentAnswered()).toBe(false);
  });

  it('should resolve init() as no-op on server', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }, AdsStore],
    });

    const store = TestBed.inject(AdsStore);
    const result = await store.init();

    expect(result).toBe(false);
  });
});
