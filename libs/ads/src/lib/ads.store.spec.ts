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

describe('AdsStore (consent gating)', () => {
  function createStore() {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }, AdsStore],
    });
    return TestBed.inject(AdsStore);
  }

  it('should start with consent unanswered and no targeted-ads consent', () => {
    // given / when
    const store = createStore();

    // then
    expect(store.consentAnswered()).toBe(false);
    expect(store.targetedAdsConsent()).toBe(false);
    expect(store.adsAllowed()).toBe(false);
  });

  it('should mark consent answered when a consent decision is applied', () => {
    // given
    const store = createStore();

    // when
    store.setTargetedAdsConsent(false);

    // then
    expect(store.consentAnswered()).toBe(true);
    expect(store.targetedAdsConsent()).toBe(false);
  });

  it('should record targeted-ads consent when granted', () => {
    // given
    const store = createStore();

    // when
    store.setTargetedAdsConsent(true);

    // then
    expect(store.targetedAdsConsent()).toBe(true);
  });

  it('should ignore non-boolean consent values', () => {
    // given
    const store = createStore();

    // when
    store.setTargetedAdsConsent(undefined);

    // then
    expect(store.consentAnswered()).toBe(false);
  });
});
