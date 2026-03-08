import { TestBed } from '@angular/core/testing';
import { AdConsentService } from './ad-consent.service';

describe('AdConsentService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    globalThis.localStorage?.removeItem('pus_ads_consent');
  });

  it('returns false when no consent exists', () => {
    const service = TestBed.runInInjectionContext(() => new AdConsentService());
    expect(service.hasConsent()).toBe(false);
  });

  it('returns true when consent is granted', () => {
    globalThis.localStorage?.setItem('pus_ads_consent', 'granted');
    const service = TestBed.runInInjectionContext(() => new AdConsentService());
    expect(service.hasConsent()).toBe(true);
  });
});
