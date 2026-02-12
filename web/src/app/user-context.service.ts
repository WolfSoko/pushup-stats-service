import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private static readonly USER_ID_STORAGE_KEY = 'pushups.userId';

  private readonly platformId = inject(PLATFORM_ID);
  readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly userId = signal('default');
  readonly userIdSafe = computed(() => (this.userId().trim() || 'default'));

  constructor() {
    if (!this.isBrowser) return;

    const stored = window.localStorage.getItem(UserContextService.USER_ID_STORAGE_KEY);
    if (stored && stored.trim()) {
      this.userId.set(stored.trim());
    }
  }

  setUserId(next: string): void {
    const value = (next || '').trim() || 'default';
    this.userId.set(value);
    if (this.isBrowser) {
      window.localStorage.setItem(UserContextService.USER_ID_STORAGE_KEY, value);
    }
  }
}
