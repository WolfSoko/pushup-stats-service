import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  fetchAndActivate,
  getBooleanChanges,
  getStringChanges,
  RemoteConfig,
} from '@angular/fire/remote-config';

@Injectable({ providedIn: 'root' })
export class AdsConfigService {
  private readonly remoteConfig = inject(RemoteConfig);

  constructor() {
    void fetchAndActivate(this.remoteConfig);
  }

  readonly enabled = toSignal(
    getBooleanChanges(this.remoteConfig, 'ads_enabled')
  );
  readonly dashboardInlineEnabled = toSignal(
    getBooleanChanges(this.remoteConfig, 'ads_dashboard_inline_enabled')
  );
  readonly adClient = toSignal(
    getStringChanges(this.remoteConfig, 'ads_client')
  );
  readonly dashboardInlineSlot = toSignal(
    getStringChanges(this.remoteConfig, 'ads_dashboard_inline_slot')
  );
  readonly landingInlineSlot = toSignal(
    getStringChanges(this.remoteConfig, 'ads_landing_inline_slot')
  );
}
