import { Injectable, inject } from '@angular/core';
import { AdsStore } from './ads.store';

@Injectable({ providedIn: 'root' })
export class AdConsentService {
  private readonly adsStore = inject(AdsStore);

  hasConsent(): boolean {
    return this.adsStore.targetedAdsConsent();
  }
}
