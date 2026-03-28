import { TestBed } from '@angular/core/testing';
import { AdConsentService } from './ad-consent.service';
import { AdsConsentStateService } from './ads-consent-state.service';

describe('AdConsentService', () => {
  let service: AdConsentService;
  let state: AdsConsentStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdConsentService);
    state = TestBed.inject(AdsConsentStateService);
  });

  it('Given default state, When hasConsent() is called, Then returns true', () => {
    expect(service.hasConsent()).toBe(true);
  });

  it('Given targeted ads consent is denied, When hasConsent() is called, Then returns false', () => {
    state.setTargetedAdsConsent(false);
    expect(service.hasConsent()).toBe(false);
  });
});
