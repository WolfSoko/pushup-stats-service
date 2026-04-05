import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CookieConsentBannerComponent } from './cookie-consent-banner.component';
import { AdsStore } from './ads.store';
import { ANALYTICS_CONSENT_KEY, COOKIE_CONSENT_KEY } from './consent.constants';

describe('CookieConsentBannerComponent', () => {
  let fixture: ComponentFixture<CookieConsentBannerComponent>;
  let component: CookieConsentBannerComponent;

  const adsStoreMock = {
    enabled: () => true,
    adClient: () => undefined,
    targetedAdsConsent: () => false,
    consentAnswered: () => false,
    adsAllowed: () => false,
    setTargetedAdsConsent: jest.fn(),
    init: () => Promise.resolve(),
  };

  function setup(platform = 'browser') {
    adsStoreMock.setTargetedAdsConsent.mockClear();

    TestBed.configureTestingModule({
      imports: [CookieConsentBannerComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: AdsStore, useValue: adsStoreMock },
      ],
    });
    fixture = TestBed.createComponent(CookieConsentBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  });

  it('is visible when no consent has been given', () => {
    setup();
    expect(component.visible()).toBe(true);
  });

  it('is hidden on SSR (server platform)', () => {
    setup('server');
    expect(component.visible()).toBe(false);
  });

  it('is hidden when consent was previously given', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'all');
    setup();
    expect(component.visible()).toBe(false);
  });

  it('hides after accepting all and updates store + localStorage', () => {
    setup();
    component.accept('all');

    expect(component.visible()).toBe(false);
    expect(adsStoreMock.setTargetedAdsConsent).toHaveBeenCalledWith(true);
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('all');
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('granted');
  });

  it('hides after accepting necessary and sets non-personalized mode', () => {
    setup();
    component.accept('necessary');

    expect(component.visible()).toBe(false);
    expect(adsStoreMock.setTargetedAdsConsent).toHaveBeenCalledWith(false);
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('necessary');
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('denied');
  });

  it('re-shows after reopen() is called', () => {
    setup();
    component.accept('all');
    expect(component.visible()).toBe(false);

    component.reopen();
    expect(component.visible()).toBe(true);
  });
});
