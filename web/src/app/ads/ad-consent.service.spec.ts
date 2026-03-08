import { TestBed } from '@angular/core/testing';
import { AdConsentService } from './ad-consent.service';
import { AdsConsentStateService } from './ads-consent-state.service';

describe('AdConsentService', () => {
  let service: AdConsentService;
  let state: AdsConsentStateService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    service = TestBed.inject(AdConsentService);
    state = TestBed.inject(AdsConsentStateService);
  });

  it('returns true by default', () => {
    expect(service.hasConsent()).toBe(true);
  });

  it('returns false when consent state is denied', () => {
    state.setTargetedAdsConsent(false);
    expect(service.hasConsent()).toBe(false);
  });
});
