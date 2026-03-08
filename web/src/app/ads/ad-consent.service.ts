import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdConsentService {
  hasConsent(): boolean {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return false;
    return storage.getItem('pus_ads_consent') === 'granted';
  }
}
