import { Injectable, inject } from '@angular/core';
import { AdsConsentStateService } from './ads-consent-state.service';

@Injectable({ providedIn: 'root' })
export class AdConsentService {
  private readonly consentState = inject(AdsConsentStateService);

  hasConsent(): boolean {
    return this.consentState.targetedAdsConsent();
  }
}
