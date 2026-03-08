import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdConsentService {
  hasConsent(): boolean {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return false;
    const value = storage.getItem('pus_ads_consent');
    if (value === null) return true;
    return value === 'granted';
  }
}
