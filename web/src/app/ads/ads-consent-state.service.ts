import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdsConsentStateService {
  readonly targetedAdsConsent = signal(true);

  setTargetedAdsConsent(value: boolean | undefined): void {
    if (typeof value !== 'boolean') return;
    this.targetedAdsConsent.set(value);
  }
}
