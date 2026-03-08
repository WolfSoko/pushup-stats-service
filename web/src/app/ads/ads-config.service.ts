import { Injectable, inject, signal } from '@angular/core';
import { RemoteConfig } from '@angular/fire/remote-config';
import { adsConfig } from '../../env/ads.config';

type RemoteValue = {
  asBoolean?: () => boolean;
  asString?: () => string;
};

@Injectable({ providedIn: 'root' })
export class AdsConfigService {
  private readonly remoteConfig = inject(RemoteConfig, { optional: true });

  readonly enabled = signal(adsConfig.enabled);
  readonly dashboardInlineEnabled = signal(adsConfig.dashboardInlineEnabled);
  readonly adClient = signal(adsConfig.adClient);
  readonly dashboardInlineSlot = signal(adsConfig.dashboardInlineSlot);

  async init(): Promise<void> {
    if (!this.remoteConfig) return;

    const values =
      (
        this.remoteConfig as unknown as {
          getAll?: () => Record<string, RemoteValue>;
        }
      ).getAll?.() ?? {};

    const enabled = values['ads_enabled']?.asBoolean?.();
    if (typeof enabled === 'boolean') this.enabled.set(enabled);

    const dashboardInlineEnabled =
      values['ads_dashboard_inline_enabled']?.asBoolean?.();
    if (typeof dashboardInlineEnabled === 'boolean') {
      this.dashboardInlineEnabled.set(dashboardInlineEnabled);
    }

    const adClient = values['ads_client']?.asString?.();
    if (adClient) this.adClient.set(adClient);

    const dashboardInlineSlot =
      values['ads_dashboard_inline_slot']?.asString?.();
    if (dashboardInlineSlot) this.dashboardInlineSlot.set(dashboardInlineSlot);
  }
}
