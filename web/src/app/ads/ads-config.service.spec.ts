import { TestBed } from '@angular/core/testing';
import { RemoteConfig } from '@angular/fire/remote-config';
import { AdsConfigService } from './ads-config.service';

describe('AdsConfigService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('uses local defaults when remote config is unavailable', async () => {
    const service = TestBed.runInInjectionContext(() => new AdsConfigService());
    await service.init();

    expect(service.enabled()).toBe(false);
    expect(service.dashboardInlineEnabled()).toBe(false);
    expect(service.adClient()).toContain('ca-pub-');
  });

  it('applies remote config overrides', async () => {
    const remoteConfigMock = {
      getAll: () => ({
        ads_enabled: { asBoolean: () => true },
        ads_dashboard_inline_enabled: { asBoolean: () => true },
        ads_client: { asString: () => 'ca-pub-9999999999999999' },
        ads_dashboard_inline_slot: { asString: () => '7777777777' },
      }),
    };

    await TestBed.configureTestingModule({
      providers: [{ provide: RemoteConfig, useValue: remoteConfigMock }],
    });

    const service = TestBed.runInInjectionContext(() => new AdsConfigService());
    await service.init();

    expect(service.enabled()).toBe(true);
    expect(service.dashboardInlineEnabled()).toBe(true);
    expect(service.adClient()).toBe('ca-pub-9999999999999999');
    expect(service.dashboardInlineSlot()).toBe('7777777777');
  });
});
