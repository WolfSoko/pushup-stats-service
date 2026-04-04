import { TestBed } from '@angular/core/testing';
import { AdConsentService } from './ad-consent.service';
import { AdsStore } from './ads.store';

describe('AdConsentService', () => {
  let service: AdConsentService;
  let adsStore: InstanceType<typeof AdsStore>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    service = TestBed.inject(AdConsentService);
    adsStore = TestBed.inject(AdsStore);
  });

  it('returns true by default', () => {
    expect(service.hasConsent()).toBe(true);
  });

  it('returns false when consent state is denied', () => {
    adsStore.setTargetedAdsConsent(false);
    expect(service.hasConsent()).toBe(false);
  });
});
