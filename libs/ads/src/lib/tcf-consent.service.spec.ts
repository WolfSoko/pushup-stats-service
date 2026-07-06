import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdsStore } from './ads.store';
import { ANALYTICS_CONSENT_KEY } from './consent.constants';
import {
  TcfConsentService,
  type TcData,
  type TcfApi,
} from './tcf-consent.service';

type TcfListener = (tcData: TcData, success: boolean) => void;

describe('TcfConsentService', () => {
  let adsStoreMock: { setTargetedAdsConsent: jest.Mock };
  let gtagMock: jest.Mock;
  let tcfListener: TcfListener | undefined;

  const tcfApiMock: TcfApi = (command, version, callback) => {
    tcfListener = callback;
  };

  function setup(
    platform: 'browser' | 'server' = 'browser'
  ): TcfConsentService {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        { provide: AdsStore, useValue: adsStoreMock },
      ],
    });
    return TestBed.inject(TcfConsentService);
  }

  function emitTcData(tcData: TcData, success = true): void {
    tcfListener?.(tcData, success);
  }

  beforeEach(() => {
    adsStoreMock = { setTargetedAdsConsent: jest.fn() };
    gtagMock = jest.fn();
    window.gtag = gtagMock;
    window.__tcfapi = tcfApiMock;
    tcfListener = undefined;
    localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  });

  afterEach(() => {
    delete window.gtag;
    delete window.__tcfapi;
    delete window.googlefc;
    localStorage.removeItem(ANALYTICS_CONSENT_KEY);
    jest.useRealTimers();
  });

  it('should register a TCF listener immediately when __tcfapi is present', () => {
    // given
    const service = setup();

    // when
    service.init();

    // then
    expect(tcfListener).toBeDefined();
  });

  it('should poll until __tcfapi appears when it is not present at init', () => {
    // given
    jest.useFakeTimers();
    delete window.__tcfapi;
    const service = setup();

    // when
    service.init();
    jest.advanceTimersByTime(400);
    window.__tcfapi = tcfApiMock;
    jest.advanceTimersByTime(200);

    // then
    expect(tcfListener).toBeDefined();
  });

  it('should clear legacy banner consent flags on init so stale grants cannot bypass the CMP', () => {
    // given
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
    localStorage.setItem('pus_cookie_consent', 'all');
    const service = setup();

    // when
    service.init();

    // then
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
    expect(localStorage.getItem('pus_cookie_consent')).toBeNull();
  });

  it('should not register a listener on the server platform', () => {
    // given
    const service = setup('server');

    // when
    service.init();

    // then
    expect(tcfListener).toBeUndefined();
  });

  it('should grant everything when GDPR does not apply', () => {
    // given
    const service = setup();
    service.init();

    // when
    emitTcData({ eventStatus: 'tcloaded', gdprApplies: false });

    // then
    expect(adsStoreMock.setTargetedAdsConsent).toHaveBeenCalledWith(true);
    expect(gtagMock).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'granted',
    });
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('granted');
  });

  it('should enable targeted ads when storage + ad purposes + Google vendor are consented', () => {
    // given
    const service = setup();
    service.init();

    // when
    emitTcData({
      eventStatus: 'useractioncomplete',
      gdprApplies: true,
      purpose: { consents: { 1: true, 3: true, 4: true } },
      vendor: { consents: { 755: true } },
    });

    // then
    expect(adsStoreMock.setTargetedAdsConsent).toHaveBeenCalledWith(true);
  });

  it('should fall back to non-personalized ads when ad-personalization purposes are missing', () => {
    // given
    const service = setup();
    service.init();

    // when
    emitTcData({
      eventStatus: 'useractioncomplete',
      gdprApplies: true,
      purpose: { consents: { 1: true } },
      vendor: { consents: { 755: true } },
    });

    // then
    expect(adsStoreMock.setTargetedAdsConsent).toHaveBeenCalledWith(false);
  });

  it('should deny targeted ads when the Google vendor consent is missing', () => {
    // given
    const service = setup();
    service.init();

    // when
    emitTcData({
      eventStatus: 'useractioncomplete',
      gdprApplies: true,
      purpose: { consents: { 1: true, 3: true, 4: true } },
      vendor: { consents: {} },
    });

    // then
    expect(adsStoreMock.setTargetedAdsConsent).toHaveBeenCalledWith(false);
  });

  it('should grant analytics storage when storage and content-measurement purposes are consented', () => {
    // given
    const service = setup();
    service.init();

    // when
    emitTcData({
      eventStatus: 'tcloaded',
      gdprApplies: true,
      purpose: { consents: { 1: true, 8: true } },
      vendor: { consents: {} },
    });

    // then
    expect(gtagMock).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'granted',
    });
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('granted');
  });

  it('should deny analytics storage when the content-measurement purpose is missing', () => {
    // given
    const service = setup();
    service.init();

    // when
    emitTcData({
      eventStatus: 'tcloaded',
      gdprApplies: true,
      purpose: { consents: { 1: true } },
      vendor: { consents: {} },
    });

    // then
    expect(gtagMock).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'denied',
    });
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('denied');
  });

  it('should ignore cmpuishown events', () => {
    // given
    const service = setup();
    service.init();

    // when
    emitTcData({ eventStatus: 'cmpuishown', gdprApplies: true });

    // then
    expect(adsStoreMock.setTargetedAdsConsent).not.toHaveBeenCalled();
    expect(gtagMock).not.toHaveBeenCalled();
  });

  it('should ignore unsuccessful TCF callbacks', () => {
    // given
    const service = setup();
    service.init();

    // when
    emitTcData({ eventStatus: 'tcloaded', gdprApplies: false }, false);

    // then
    expect(adsStoreMock.setTargetedAdsConsent).not.toHaveBeenCalled();
  });

  it('should show the CMP revocation message when consent settings are opened', () => {
    // given
    const service = setup();
    const showRevocationMessage = jest.fn();
    window.googlefc = { showRevocationMessage };

    // when
    service.openConsentSettings();
    for (const entry of window.googlefc.callbackQueue ?? []) {
      entry['CONSENT_DATA_READY']?.();
    }

    // then
    expect(showRevocationMessage).toHaveBeenCalled();
  });
});
